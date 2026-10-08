// Headless playthrough of genesis-game/game.js: stubs the DOM, drives Game.step() with a simple bot.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || require('path').join(__dirname, '..', 'genesis-game', 'game.js'), 'utf8');

const el = () => ({ getContext: () => null, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, style: {}, textContent: '', className: '' });
const listeners = {};
global.window = { addEventListener: (t, f) => { (listeners[t] ||= []).push(f); } };
global.document = { getElementById: el };
global.performance = { now: () => 0 };
global.requestAnimationFrame = () => {};
global.localStorage = { getItem: () => null, setItem() {} };

eval(src + '\n;global.Game = Game; global.STEP = STEP;');
listeners.DOMContentLoaded[0]();
const g = window.genesis;
g.ctx = null;
g.startRun();

const key = (type, code) => listeners[type].forEach((f) => f({ code, preventDefault() {} }));
key('keydown', 'KeyD');
let crouch = false, steps = 0, jumps = 0;
while (g.state === 'playing' || g.state === 'dying') {
  const p = g.player, lv = g.level, front = p.x + p.w;
  const ahead = (o, d) => o.x - front < d && o.x + o.w > p.x;
  const needCrouch = lv.solids.some((s) => s.kind === 'ceiling' && ahead(s, 30)) || lv.hazards.some((h) => h.kind === 'laser' && ahead(h, 30));
  if (needCrouch !== crouch) { key(needCrouch ? 'keydown' : 'keyup', 'KeyS'); crouch = needCrouch; }
  const pitAhead = !lv.solids.some((s) => s.kind === 'ground' && s.x <= front + 30 && s.x + s.w >= front + 30);
  const obstacle = lv.solids.some((s) => s.kind === 'block' && ahead(s, 45)) ||
    lv.hazards.some((h) => h.kind === 'spikes' && ahead(h, 25)) ||
    lv.bugs.some((b) => ahead(b, 70));
  if (!needCrouch && p.onGround && (pitAhead || obstacle)) { key('keydown', 'KeyW'); key('keyup', 'KeyW'); jumps++; if (process.env.TRACE) console.log('jump at', Math.round(p.x), Math.round(p.y)); }
  g.step(STEP);
  if (++steps > 120 * 200) break;
}
console.log(JSON.stringify({ state: g.state, win: g.ui.endTitle.textContent, reason: g.ui.endReason.textContent, x: Math.round(g.player.x), y: Math.round(g.player.y), elapsed: g.elapsed.toFixed(1), jumps }));
