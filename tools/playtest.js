// Headless playtest: stubs the DOM, loads genesis-game/game.js and lets a simple bot
// play generated levels by simulating key presses.
//   node tools/playtest.js            -> 200 seeds, prints a summary + every failure
//   SEEDS=2000 node tools/playtest.js -> more seeds
//   node tools/playtest.js 4242       -> one seed, prints its result
//   TRACE=1 node tools/playtest.js 42 -> also logs every jump
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'genesis-game', 'game.js'), 'utf8');

const el = () => ({ getContext: () => null, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, textContent: '', className: '' });
const listeners = {};
global.window = { addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
global.document = { getElementById: el };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};
global.localStorage = { getItem: () => null, setItem() {} };

eval(src + '\n;global.STEP = STEP; global.PHYS = PHYS;');
listeners.DOMContentLoaded[0]();
const g = window.genesis;
g.ctx = null;
const key = (type, code) => listeners[type].forEach((f) => f({ code, preventDefault() {} }));

// Simulates a jump started now and checks the hero never touches the bug in the air.
function jumpClears(p, bug) {
  let x = p.x, y = p.y, vy = -PHYS.jumpVelocity, bx = bug.x, bvx = bug.vx;
  for (let t = 0; t < 1; t += STEP) {
    x += PHYS.runSpeed * STEP;
    vy += PHYS.gravity * STEP;
    y += vy * STEP;
    bx += bvx * STEP;
    if (bx < bug.minX) { bx = bug.minX; bvx = Math.abs(bvx); }
    if (bx + bug.w > bug.maxX) { bx = bug.maxX - bug.w; bvx = -Math.abs(bvx); }
    if (y >= p.y) return x > bx + bug.w + 8;   // landed: must be past the bug
    if (x + p.w - 4 > bx && x + 4 < bx + bug.w && y + p.h > bug.y) return false;
  }
  return true;
}

function play(seed) {
  g.reset(seed);
  g.startRun(false);
  for (const code of ['KeyS', 'KeyW', 'KeyD']) key('keyup', code);
  key('keydown', 'KeyD');
  let crouch = false, waiting = false, steps = 0, jumps = 0;
  while (g.state === 'playing' || g.state === 'dying') {
    const p = g.player, lv = g.level, front = p.x + p.w;
    const ahead = (o, dist) => o.x - front < dist && o.x + o.w > p.x;
    const needCrouch = lv.solids.some((s) => s.kind === 'ceiling' && ahead(s, 30)) || lv.hazards.some((h) => h.kind === 'laser' && ahead(h, 30));
    if (needCrouch !== crouch) { key(needCrouch ? 'keydown' : 'keyup', 'KeyS'); crouch = needCrouch; }
    const pitAhead = !lv.solids.some((s) => s.kind === 'ground' && s.x <= front + 30 && s.x + s.w >= front + 30);
    // Bugs: jump only if a simulated jump (hero arc vs. the bug's patrol, bounces included)
    // clears it; otherwise hold back while it walks away, like a human would.
    const bug = lv.bugs.find((b) => b.x + b.w > p.x && b.x - front < 160);
    const bugJump = bug && bug.x - front < 110 && jumpClears(p, bug);
    const waitForBug = !!bug && !bugJump && bug.vx > 0 && bug.x - front < 120 && p.onGround;
    if (waitForBug !== waiting) { key(waitForBug ? 'keyup' : 'keydown', 'KeyD'); waiting = waitForBug; }
    // Blocks only count while the hero is below their top (not when running across them)
    const obstacle = lv.solids.some((s) => s.kind === 'block' && s.y < p.y + p.h - 1 && ahead(s, 45)) ||
      lv.hazards.some((h) => h.kind === 'spikes' && ahead(h, 25)) || bugJump;
    if (!needCrouch && p.onGround && (pitAhead || obstacle)) {
      key('keydown', 'KeyW'); key('keyup', 'KeyW'); jumps++;
      if (process.env.TRACE) console.log('jump at', Math.round(p.x), Math.round(p.y));
    }
    g.step(STEP);
    if (++steps > 120 * 200) break;
  }
  if (crouch) key('keyup', 'KeyS');
  return { seed, win: g.ui.endTitle.textContent === 'GOAL REACHED', reason: g.ui.endReason.textContent,
    x: Math.round(g.player.x), endX: g.level.endX, elapsed: +g.elapsed.toFixed(1), jumps };
}

if (process.argv[2]) {
  console.log(JSON.stringify(play(parseInt(process.argv[2], 10))));
} else {
  const results = [];
  const count = parseInt(process.env.SEEDS, 10) || 200;
  for (let seed = 1; seed <= count; seed++) results.push(play(seed));
  const wins = results.filter((r) => r.win);
  const times = wins.map((r) => r.elapsed).sort((a, b) => a - b);
  console.log(`won ${wins.length}/${results.length} · bot time min ${times[0]} s, median ${times[times.length >> 1]} s, max ${times[times.length - 1]} s`);
  for (const r of results.filter((r) => !r.win)) console.log('FAIL', JSON.stringify(r));
}
