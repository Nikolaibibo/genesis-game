'use strict';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const WIDTH = 960;
const HEIGHT = 540;
const GROUND_Y = 460;          // top edge of the ground
const STEP = 1 / 120;          // fixed physics timestep (s)
const TIME_LIMIT = 180;        // seconds

const PHYS = {
  gravity: 2000,               // px/s^2
  jumpVelocity: 780,           // px/s, peak height ~152 px
  runSpeed: 280,               // px/s
  crouchSpeed: 140,            // px/s
  maxFall: 1100,               // px/s
  coyoteTime: 0.08,            // s after leaving a ledge where a jump still counts
  jumpBuffer: 0.1,             // s a jump press is remembered before landing
};

const HERO = { w: 40, h: 40, crouchH: 20 };

const COLORS = {
  hero: '#22e6ff',
  solid: '#7b5cff',
  ceiling: '#ff9f1c',
  hazard: '#ff3d9a',
  bug: '#ff3d9a',
  goal: '#a6ff3d',
  grid: 'rgba(80, 110, 255, 0.12)',
};

// ---------------------------------------------------------------------------
// Level definition
// ---------------------------------------------------------------------------
// Ground segments [startX, endX]; gaps between them are pits.
const GROUND = [
  [0, 900], [1040, 1800], [1950, 2700], [2850, 3800],
  [3950, 5200], [5320, 6600],
];

function buildLevel() {
  const G = GROUND_Y;
  const solids = [];
  const hazards = [];
  const bugs = [];

  for (const [x0, x1] of GROUND) {
    solids.push({ x: x0, y: G, w: x1 - x0, h: HEIGHT - G + 200, kind: 'ground' });
  }

  // Section 1: warm-up
  solids.push({ x: 480, y: G - 60, w: 60, h: 60, kind: 'block' });
  solids.push({ x: 660, y: G - 120, w: 140, h: 20, kind: 'platform' });

  // Section 2: spikes + first crouch tunnel
  hazards.push({ x: 1200, y: G - 20, w: 60, h: 20, kind: 'spikes' });
  solids.push({ x: 1400, y: G - 260, w: 200, h: 230, kind: 'ceiling' }); // 30 px gap: crouch only

  // Section 3: stairs + patrolling bug + wall
  solids.push({ x: 2050, y: G - 90, w: 120, h: 20, kind: 'platform' });
  solids.push({ x: 2250, y: G - 170, w: 120, h: 20, kind: 'platform' });
  solids.push({ x: 2450, y: G - 250, w: 140, h: 20, kind: 'platform' });
  bugs.push(makeBug(2200, 2440, 90));   // stays clear of the low first step, so it can be jumped

  // Section 4: laser band (crouch under or jump over) + long tunnel + bug
  hazards.push({ x: 3000, y: G - 62, w: 120, h: 30, kind: 'laser' });
  solids.push({ x: 3250, y: G - 260, w: 260, h: 230, kind: 'ceiling' });
  bugs.push(makeBug(3560, 3680, 110));   // leaves landing room before the pit

  // Section 5: spike field (no low platform above the take-off spot), tunnel, laser, wall
  hazards.push({ x: 4240, y: G - 20, w: 120, h: 20, kind: 'spikes' });
  solids.push({ x: 4420, y: G - 200, w: 120, h: 20, kind: 'platform' });
  solids.push({ x: 4700, y: G - 260, w: 180, h: 230, kind: 'ceiling' });
  hazards.push({ x: 4960, y: G - 62, w: 60, h: 30, kind: 'laser' });

  // Section 6: final run
  bugs.push(makeBug(5400, 5700, 130));
  solids.push({ x: 5800, y: G - 140, w: 160, h: 20, kind: 'platform' });
  hazards.push({ x: 6040, y: G - 20, w: 100, h: 20, kind: 'spikes' });

  const goal = { x: 6300, y: G - 220, w: 40, h: 220 };
  return { solids, hazards, bugs, goal, endX: 6600 };
}

function makeBug(minX, maxX, speed) {
  return { x: minX, y: GROUND_Y - 18, w: 30, h: 18, minX, maxX, vx: speed, phase: Math.random() * 6 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function formatTime(t) {
  const s = Math.max(0, Math.ceil(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function loadBest() {
  try { return parseFloat(localStorage.getItem('genesis-best')) || null; } catch { return null; }
}

function saveBest(t) {
  try { localStorage.setItem('genesis-best', String(t)); } catch { /* storage unavailable */ }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    const map = {
      KeyA: 'left', ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
      KeyW: 'jump', ArrowUp: 'jump',
      KeyS: 'crouch', ArrowDown: 'crouch',
      Enter: 'confirm', Space: 'confirm',
      KeyR: 'restart', KeyP: 'pause', Escape: 'pause',
    };
    window.addEventListener('keydown', (e) => {
      const action = map[e.code];
      if (!action) return;
      e.preventDefault();
      if (!this.down.has(action)) this.pressed.add(action);
      this.down.add(action);
    });
    window.addEventListener('keyup', (e) => {
      const action = map[e.code];
      if (action) this.down.delete(action);
    });
    window.addEventListener('blur', () => this.down.clear());
  }

  isDown(a) { return this.down.has(a); }

  consume(a) {
    const had = this.pressed.has(a);
    this.pressed.delete(a);
    return had;
  }

  clearPressed() { this.pressed.clear(); }
}

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = HERO.w;
    this.h = HERO.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.crouching = false;
    this.facing = 1;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.squash = 0;           // landing squash animation
  }

  setCrouch(want, solids) {
    if (want === this.crouching) return;
    if (want) {
      this.y += HERO.h - HERO.crouchH;   // keep feet in place
      this.h = HERO.crouchH;
      this.crouching = true;
    } else {
      const standing = { x: this.x, y: this.y - (HERO.h - HERO.crouchH), w: this.w, h: HERO.h };
      if (solids.some((s) => overlaps(standing, s))) return;   // no headroom: stay down
      this.y = standing.y;
      this.h = HERO.h;
      this.crouching = false;
    }
  }

  update(dt, input, solids, fx) {
    this.setCrouch(input.isDown('crouch'), solids);

    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    const speed = this.crouching ? PHYS.crouchSpeed : PHYS.runSpeed;
    this.vx = dir * speed;
    if (dir !== 0) this.facing = dir;

    if (input.consume('jump')) this.jumpBuffer = PHYS.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    this.coyote = this.onGround ? PHYS.coyoteTime : Math.max(0, this.coyote - dt);

    if (this.jumpBuffer > 0 && this.coyote > 0 && !this.crouching) {
      this.vy = -PHYS.jumpVelocity;
      this.jumpBuffer = 0;
      this.coyote = 0;
      this.onGround = false;
      fx.burst(this.x + this.w / 2, this.y + this.h, COLORS.hero, 10);
    }

    this.vy = Math.min(this.vy + PHYS.gravity * dt, PHYS.maxFall);

    // Horizontal pass
    this.x += this.vx * dt;
    for (const s of solids) {
      if (!overlaps(this, s)) continue;
      if (this.vx > 0) this.x = s.x - this.w;
      else if (this.vx < 0) this.x = s.x + s.w;
    }
    this.x = Math.max(0, this.x);

    // Vertical pass
    const wasOnGround = this.onGround;
    this.onGround = false;
    this.y += this.vy * dt;
    for (const s of solids) {
      if (!overlaps(this, s)) continue;
      if (this.vy > 0) {
        this.y = s.y - this.h;
        this.onGround = true;
      } else if (this.vy < 0) {
        this.y = s.y + s.h;
      }
      this.vy = 0;
    }

    if (this.onGround && !wasOnGround) this.squash = 1;
    this.squash = Math.max(0, this.squash - dt * 6);
  }
}

// ---------------------------------------------------------------------------
// Particles
// ---------------------------------------------------------------------------
class Effects {
  constructor() { this.parts = []; }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 220;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.5 + Math.random() * 0.4, color });
    }
  }

  update(dt) {
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 900 * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
  }

  draw(ctx) {
    for (const p of this.parts) {
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------
class Game {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.input = new Input();
    this.fx = new Effects();
    this.ui = {
      hud: document.getElementById('hud'),
      timer: document.getElementById('hud-timer'),
      progress: document.getElementById('hud-progress'),
      start: document.getElementById('screen-start'),
      end: document.getElementById('screen-end'),
      pause: document.getElementById('screen-pause'),
      endTitle: document.getElementById('end-title'),
      endReason: document.getElementById('end-reason'),
      endStats: document.getElementById('end-stats'),
      bestStart: document.getElementById('best-start'),
    };
    this.best = loadBest();
    this.showBest();
    this.state = 'start';     // start | playing | paused | dying | over
    this.reset();
    this.last = performance.now();
    this.acc = 0;
    requestAnimationFrame((t) => this.frame(t));
  }

  reset() {
    this.level = buildLevel();
    this.player = new Player(80, GROUND_Y - HERO.h);
    this.camX = 0;
    this.timeLeft = TIME_LIMIT;
    this.elapsed = 0;
    this.dyingTimer = 0;
    this.fx.parts = [];
  }

  showBest() {
    this.ui.bestStart.textContent = this.best ? `Best time: ${this.best.toFixed(2)} s` : '';
  }

  startRun() {
    this.reset();
    this.state = 'playing';
    this.ui.start.classList.add('hidden');
    this.ui.end.classList.add('hidden');
    this.ui.hud.classList.remove('hidden');
    this.input.clearPressed();
  }

  finish(win, reason) {
    this.state = 'over';
    this.ui.endTitle.textContent = win ? 'GOAL REACHED' : 'GAME OVER';
    this.ui.endTitle.className = win ? 'win' : 'lose';
    this.ui.endReason.textContent = reason;
    if (win) {
      const newBest = !this.best || this.elapsed < this.best;
      if (newBest) { this.best = this.elapsed; saveBest(this.elapsed); this.showBest(); }
      this.ui.endStats.textContent =
        `Time: ${this.elapsed.toFixed(2)} s · left on clock: ${formatTime(this.timeLeft)}` + (newBest ? ' · NEW BEST' : '');
    } else {
      const pct = Math.round(this.progress() * 100);
      this.ui.endStats.textContent = `Made it ${pct}% of the way`;
    }
    this.ui.end.classList.remove('hidden');
    this.input.clearPressed();
  }

  die(reason) {
    if (this.state !== 'playing') return;
    const p = this.player;
    this.fx.burst(p.x + p.w / 2, p.y + p.h / 2, COLORS.hazard, 40);
    this.state = 'dying';
    this.dyingTimer = 0.8;
    this.deathReason = reason;
  }

  progress() {
    const goalX = this.level.goal.x;
    return Math.min(1, Math.max(0, (this.player.x - 80) / (goalX - 80)));
  }

  // --- loop ---------------------------------------------------------------
  frame(now) {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.handleMeta();

    if (this.state === 'playing' || this.state === 'dying') {
      this.acc += dt;
      while (this.acc >= STEP) {
        this.step(STEP);
        this.acc -= STEP;
      }
    } else {
      this.acc = 0;
      if (this.state === 'over') this.fx.update(dt);
    }

    this.render(now / 1000);
    this.updateHud();
    requestAnimationFrame((t) => this.frame(t));
  }

  handleMeta() {
    const i = this.input;
    if (this.state === 'start' && i.consume('confirm')) this.startRun();
    else if (this.state === 'over' && (i.consume('confirm') || i.consume('restart'))) this.startRun();
    else if (this.state === 'playing' && i.consume('pause')) {
      this.state = 'paused';
      this.ui.pause.classList.remove('hidden');
    } else if (this.state === 'paused' && i.consume('pause')) {
      this.state = 'playing';
      this.ui.pause.classList.add('hidden');
      i.clearPressed();
    } else if (this.state === 'playing' && i.consume('restart')) this.startRun();
    i.consume('confirm');
  }

  step(dt) {
    this.fx.update(dt);
    const lv = this.level;

    for (const b of lv.bugs) {
      b.x += b.vx * dt;
      if (b.x < b.minX) { b.x = b.minX; b.vx = Math.abs(b.vx); }
      if (b.x + b.w > b.maxX) { b.x = b.maxX - b.w; b.vx = -Math.abs(b.vx); }
      b.phase += dt * 10;
    }

    if (this.state === 'dying') {
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) this.finish(false, this.deathReason);
      return;
    }

    this.timeLeft -= dt;
    this.elapsed += dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.finish(false, 'Time ran out.');
      return;
    }

    const p = this.player;
    p.update(dt, this.input, lv.solids, this.fx);
    p.x = Math.min(p.x, lv.endX - p.w);

    if (p.y > HEIGHT + 60) return this.die('You fell into the void.');
    // Hazards use a slightly forgiving hitbox
    const hit = { x: p.x + 4, y: p.y + 3, w: p.w - 8, h: p.h - 3 };
    if (lv.hazards.some((h) => overlaps(hit, h))) return this.die('Hit a hazard.');
    if (lv.bugs.some((b) => overlaps(hit, b))) return this.die('A bug got you.');
    if (overlaps(p, lv.goal)) {
      this.fx.burst(lv.goal.x + 20, lv.goal.y + 40, COLORS.goal, 60);
      this.finish(true, 'You reached the beacon.');
      return;
    }

    // Camera: follow with a slight look-ahead, clamped to the level
    const target = p.x - WIDTH * 0.35 + p.facing * 60;
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    this.camX = Math.max(0, Math.min(this.camX, lv.endX - WIDTH));
  }

  updateHud() {
    if (this.state === 'start') return;
    this.ui.timer.textContent = formatTime(this.timeLeft);
    this.ui.timer.classList.toggle('warn', this.timeLeft <= 30);
    this.ui.progress.style.width = `${(this.progress() * 100).toFixed(1)}%`;
  }

  // --- rendering ----------------------------------------------------------
  render(t) {
    const ctx = this.ctx;
    this.drawBackground(ctx, t);

    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);
    const lv = this.level;
    const left = this.camX - 50;
    const right = this.camX + WIDTH + 50;
    const visible = (o) => o.x + o.w > left && o.x < right;

    for (const s of lv.solids) if (visible(s)) this.drawSolid(ctx, s);
    for (const h of lv.hazards) if (visible(h)) this.drawHazard(ctx, h, t);
    for (const b of lv.bugs) if (visible(b)) this.drawBug(ctx, b);
    this.drawGoal(ctx, lv.goal, t);
    if (this.state !== 'dying' && !(this.state === 'over' && this.ui.endTitle.className === 'lose')) {
      this.drawHero(ctx, this.player, t);
    }
    this.fx.draw(ctx);
    ctx.restore();
  }

  drawBackground(ctx, t) {
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#070a1f');
    g.addColorStop(0.6, '#0d0a2a');
    g.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Far parallax grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const size = 48;
    const off = -(this.camX * 0.3) % size;
    ctx.beginPath();
    for (let x = off; x < WIDTH; x += size) { ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); }
    for (let y = 0; y < HEIGHT; y += size) { ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); }
    ctx.stroke();

    // Distant "skyline" bars
    ctx.fillStyle = 'rgba(123, 92, 255, 0.08)';
    for (let i = 0; i < 30; i++) {
      const bx = ((i * 173 - this.camX * 0.15) % 1400 + 1400) % 1400 - 200;
      const bh = 80 + ((i * 97) % 160);
      ctx.fillRect(bx, GROUND_Y - bh, 60, bh);
    }

    // Horizon glow
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
    ctx.fillStyle = `rgba(255, 61, 154, ${0.05 + pulse * 0.04})`;
    ctx.fillRect(0, GROUND_Y - 120, WIDTH, 120);
  }

  drawSolid(ctx, s) {
    const color = s.kind === 'ceiling' ? COLORS.ceiling : COLORS.solid;
    ctx.fillStyle = s.kind === 'ground' ? '#120f33' : 'rgba(123, 92, 255, 0.18)';
    if (s.kind === 'ceiling') ctx.fillStyle = 'rgba(255, 159, 28, 0.14)';
    ctx.fillRect(s.x, s.y, s.w, s.h);

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    if (s.kind === 'ground') {
      ctx.beginPath();
      ctx.moveTo(s.x, s.y + 1);
      ctx.lineTo(s.x + s.w, s.y + 1);
      ctx.stroke();
    } else {
      ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
    }
    ctx.restore();

    if (s.kind === 'ceiling') {
      // hazard stripes on the underside to signal "duck"
      ctx.save();
      ctx.beginPath();
      ctx.rect(s.x, s.y + s.h - 10, s.w, 10);
      ctx.clip();
      ctx.fillStyle = 'rgba(255, 159, 28, 0.6)';
      for (let x = s.x - 10; x < s.x + s.w; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, s.y + s.h);
        ctx.lineTo(x + 10, s.y + s.h - 10);
        ctx.lineTo(x + 20, s.y + s.h - 10);
        ctx.lineTo(x + 10, s.y + s.h);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawHazard(ctx, h, t) {
    ctx.save();
    ctx.shadowColor = COLORS.hazard;
    ctx.shadowBlur = 14;
    ctx.fillStyle = COLORS.hazard;
    if (h.kind === 'spikes') {
      const n = Math.max(1, Math.round(h.w / 20));
      const sw = h.w / n;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        ctx.moveTo(h.x + i * sw, h.y + h.h);
        ctx.lineTo(h.x + i * sw + sw / 2, h.y);
        ctx.lineTo(h.x + (i + 1) * sw, h.y + h.h);
      }
      ctx.fill();
    } else {
      // laser band between two emitters
      const flicker = 0.6 + 0.4 * Math.sin(t * 30);
      ctx.globalAlpha = flicker;
      ctx.fillRect(h.x, h.y + h.h * 0.3, h.w, h.h * 0.4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd1e6';
      ctx.fillRect(h.x - 6, h.y - 4, 8, h.h + 8);
      ctx.fillRect(h.x + h.w - 2, h.y - 4, 8, h.h + 8);
    }
    ctx.restore();
  }

  drawBug(ctx, b) {
    ctx.save();
    ctx.shadowColor = COLORS.bug;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.bug;
    ctx.beginPath();
    ctx.ellipse(b.x + b.w / 2, b.y + b.h / 2 + 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // legs
    ctx.strokeStyle = COLORS.bug;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const lx = b.x + 6 + i * 9;
      const wiggle = Math.sin(b.phase + i) * 3;
      ctx.beginPath();
      ctx.moveTo(lx, b.y + b.h - 2);
      ctx.lineTo(lx + wiggle, b.y + b.h + 2);
      ctx.stroke();
    }
    // eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    const ex = b.vx > 0 ? b.x + b.w - 9 : b.x + 5;
    ctx.fillRect(ex, b.y + 4, 4, 4);
    ctx.restore();
  }

  drawGoal(ctx, g, t) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    ctx.save();
    const grad = ctx.createLinearGradient(g.x, 0, g.x + g.w, 0);
    grad.addColorStop(0, 'rgba(166, 255, 61, 0)');
    grad.addColorStop(0.5, `rgba(166, 255, 61, ${0.55 * pulse})`);
    grad.addColorStop(1, 'rgba(166, 255, 61, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(g.x - 30, 0, g.w + 60, GROUND_Y);
    ctx.shadowColor = COLORS.goal;
    ctx.shadowBlur = 25;
    ctx.fillStyle = COLORS.goal;
    ctx.fillRect(g.x + g.w / 2 - 4, g.y, 8, g.h);
    ctx.beginPath();
    ctx.arc(g.x + g.w / 2, g.y, 14 + pulse * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHero(ctx, p, t) {
    // squash on landing, stretch while rising
    const stretch = p.vy < 0 ? Math.min(0.15, -p.vy / 5000) : 0;
    const sq = p.squash * 0.18;
    const w = p.w * (1 + sq - stretch);
    const h = p.h * (1 - sq + stretch);
    const x = p.x + (p.w - w) / 2;
    const y = p.y + (p.h - h);
    const r = Math.min(10, h / 2);

    ctx.save();
    ctx.shadowColor = COLORS.hero;
    ctx.shadowBlur = 20 + 6 * Math.sin(t * 4);
    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, '#7ff3ff');
    body.addColorStop(1, '#0aa6c4');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();

    // inner shadow
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(0, 40, 60, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2));
    ctx.stroke();

    // face
    const eyeY = y + h * (p.crouching ? 0.45 : 0.38);
    const look = p.facing * 4;
    ctx.fillStyle = '#04121a';
    const eyeH = p.crouching ? 3 : 7;
    ctx.fillRect(x + w * 0.3 + look - 2, eyeY, 4, eyeH);
    ctx.fillRect(x + w * 0.62 + look - 2, eyeY, 4, eyeH);
    if (!p.crouching) {
      ctx.strokeStyle = '#04121a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2 + look, y + h * 0.62, 5, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.restore();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.genesis = new Game(document.getElementById('game'));   // exposed for console debugging
});
