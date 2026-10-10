'use strict';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
const FLOOR = 490;
const NET_X = 480, NET_W = 8, NET_BASE = 380;
const PW = 30, PH = 50;
const GRAV_P = 0.6, JUMP = -11.5, SPEED = 5.2;
const BALL_R = 11, BALL_G = 0.3;
const WIN = 10;
const SUPER_ODDS = 50;
const CTL = [
  { l: 'KeyA', r: 'KeyD', j: 'KeyW', dn: 'KeyS', d: 'Space' },
  { l: 'ArrowLeft', r: 'ArrowRight', j: 'ArrowUp', dn: 'ArrowDown', d: 'Slash' },
];
const COL = ['#4ad0ff', '#ff5b7a'];
const START_X = [200, 730];

let state = 'menu'; // menu | playing | pause | over
let players = [], ball = null, scores = [0, 0];
let timer = 0, rally = 0, lastWinner = 0, msg = '', shake = 0, tick = 0;
let netTop = NET_BASE, netT = 0, trampT = 0, iceT = 0;
let particles = [], banners = [];
const keys = {};
const jumpQ = [false, false], downQ = [false, false], abQ = [false, false];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// ============================================================
// Abilities: 49 common + 1 super rare (1 in 50). New ones every point.
// ============================================================
function fx(p, col) { burst(p.x + p.w / 2, p.y + p.h / 2, 12, col || '#fff'); }
function arm(p, mode) { p.nextHit = mode; p.nextT = 420; fx(p, '#ffd54a'); }
const A = (name, cd, desc, use) => ({ name, cd, desc, use });

const SUPER = A('HOMING SMASH', 10, 'Dash to the ball and smash it!', p => { p.homing = 26; p.superReady = true; });
SUPER.rare = true;

const ABIL = [
  // --- Movement (12)
  A('Dash', 8, 'Quick burst sideways', p => { p.dashT = 8; p.dashDir = p.dirIn || p.face; fx(p); }),
  A('Back Dash', 8, 'Quick burst backwards', p => { p.dashT = 8; p.dashDir = -p.face; fx(p); }),
  A('Super Jump', 8, 'Launch way up', p => { p.vy = -19; fx(p, '#ffd54a'); }),
  A('Mega Slam', 6, 'Slam down super fast', p => { p.vy = 24; fx(p); }),
  A('Speed Boost', 10, 'Run 70% faster (4s)', p => { p.speedT = 240; fx(p, '#7fffb0'); }),
  A('Moon Gravity', 10, 'Floaty jumps (5s)', p => { p.gravT = 300; p.gravF = 0.35; fx(p, '#ddf'); }),
  A('Anvil Boots', 8, 'Fall super heavy (4s)', p => { p.gravT = 240; p.gravF = 2.4; fx(p, '#888'); }),
  A('Net Blink', 10, 'Teleport next to the net', p => { p.x = p.id === 0 ? NET_X - NET_W / 2 - p.w : NET_X + NET_W / 2; fx(p, '#c8f'); }),
  A('Baseline Blink', 10, 'Teleport to the back', p => { p.x = p.id === 0 ? 0 : W - p.w; fx(p, '#c8f'); }),
  A('Hover', 10, 'Float in the air (1.5s)', p => { p.gravT = 90; p.gravF = 0; p.vy = 0; fx(p, '#ddf'); }),
  A('Air Rocket', 8, 'Blast up and forward', p => { p.dashT = 6; p.dashDir = p.face; p.vy = -15; fx(p, '#ff8040'); }),
  A('Spring Legs', 10, 'Next 3 jumps are huge', p => { p.springN = 3; fx(p, '#7fffb0'); }),
  // --- Racket (10)
  A('Giant Racket', 10, 'Huge racket (5s)', p => { p.scaleT = 300; p.scale = 1.9; fx(p, '#ffd54a'); }),
  A('Long Reach', 10, 'Racket reaches far (5s)', p => { p.reachT = 300; fx(p, '#ffd54a'); }),
  A('Double Racket', 10, 'A 2nd racket over your head (6s)', p => { p.extraT = 360; fx(p, '#ffd54a'); }),
  A('Magnet Racket', 10, 'Racket pulls the ball in (5s)', p => { p.magT = 300; fx(p, '#f66'); }),
  A('Power Hit', 8, 'Next hit is 60% stronger', p => arm(p, 'power')),
  A('Lob Master', 8, 'Next hit is a high lob', p => arm(p, 'lob')),
  A('Drop Shot', 8, 'Next hit barely clears the net', p => arm(p, 'drop')),
  A('Smash Hit', 8, 'Next hit slams downward', p => arm(p, 'smash')),
  A('Wobble Shot', 8, 'Next hit wobbles in the air', p => arm(p, 'wobble')),
  A('Rocket Serve', 8, 'Next hit is a laser shot', p => arm(p, 'rocket')),
  // --- Ball control (13)
  A('Freeze Ball', 10, 'Freeze the ball (1.5s)', () => { ball.frozen = 90; }),
  A('Slow-Mo Ball', 10, 'Ball in slow motion (3s)', () => { ball.slowT = 180; }),
  A('Fast Ball', 10, 'Ball speeds up (2.5s)', () => { ball.fastT = 150; }),
  A('Feather Ball', 10, 'Ball floats (4s)', () => { ball.gravT = 240; ball.gravF = 0.3; }),
  A('Heavy Ball', 10, 'Ball drops fast (3s)', () => { ball.gravT = 180; ball.gravF = 2.3; }),
  A('Safety Net', 10, 'Ball may bounce one extra time', () => { ball.bonus = (ball.bonus || 0) + 1; }),
  A('Ball Snap', 10, 'Teleport the ball over your racket', p => { const r = racket(p); ball.x = r.x; ball.y = r.y - 80; ball.vx = 0; ball.vy = 0; }),
  A('Mirror Ball', 10, 'Flip the ball to the other side', () => { ball.x = W - ball.x; ball.vx = -ball.vx; }),
  A('Reverse Ball', 10, 'Reverse the ball direction', () => { ball.vx = -ball.vx; ball.vy = -ball.vy * 0.5; }),
  A('Tailwind', 10, 'Wind pushes the ball to their side', p => { ball.windT = 240; ball.windDir = p.id === 0 ? 1 : -1; }),
  A('Pull Wind', 10, 'Wind pulls the ball to your side', p => { ball.windT = 240; ball.windDir = p.id === 0 ? -1 : 1; }),
  A('Ball Magnet', 10, 'Pull the ball toward you', p => { ball.pullT = 90; ball.pullId = p.id; }),
  A('Blast Away', 10, 'Blast the ball away from you', p => { ball.vx = (ball.x >= p.x ? 1 : -1) * 11; ball.vy = -7; }),
  // --- Opponent (10)
  A('Freeze Opponent', 10, 'Freeze them (1.5s)', (p, o) => { o.stunT = 90; fx(o, '#8ff0ff'); }),
  A('Slow Opponent', 10, 'They move at 40% speed (4s)', (p, o) => { o.slowT = 240; fx(o, '#8ff0ff'); }),
  A('Confuse Opponent', 10, 'Their controls flip (4s)', (p, o) => { o.invT = 240; fx(o, '#d060ff'); }),
  A('No-Jump Curse', 10, 'They cannot jump (4s)', (p, o) => { o.noJumpT = 240; fx(o, '#d060ff'); }),
  A('Launch Opponent', 10, 'Fling them into the sky', (p, o) => { o.vy = -20; fx(o, '#ffd54a'); }),
  A('Shove Opponent', 10, 'Shove them to the back', (p, o) => { o.dashT = 12; o.dashDir = o.id === 0 ? -1 : 1; fx(o); }),
  A('Tiny Racket Curse', 10, 'Their racket shrinks (5s)', (p, o) => { o.scaleT = 300; o.scale = 0.5; fx(o, '#d060ff'); }),
  A('Heavy Curse', 10, 'They fall like a rock (4s)', (p, o) => { o.gravT = 240; o.gravF = 2.5; fx(o, '#888'); }),
  A('Butterfingers', 10, 'Their racket is off (1.5s)', (p, o) => { o.hitCd = 90; fx(o, '#f66'); }),
  A('Banish Opponent', 10, 'Send them to the back wall', (p, o) => { o.x = o.id === 0 ? 0 : W - o.w; fx(o, '#c8f'); }),
  // --- Court (4)
  A('Tall Net', 10, 'Net grows tall (5s)', () => { netTop = 250; netT = 300; }),
  A('Low Net', 10, 'Net shrinks (5s)', () => { netTop = 440; netT = 300; }),
  A('Trampoline Court', 10, 'Floor is super bouncy (6s)', () => { trampT = 360; }),
  A('Ice Rink', 10, 'Everyone slides (6s)', () => { iceT = 360; }),
];

// ============================================================
// Setup
// ============================================================
function makePlayer(id) {
  return {
    id, x: START_X[id], y: FLOOR - PH, w: PW, h: PH, vx: 0, vy: 0, face: id === 0 ? 1 : -1,
    swing: 0, hitCd: 0, dashT: 0, dashDir: 1, dirIn: 0, abil: null, abCd: 0,
    speedT: 0, gravT: 0, gravF: 1, springN: 0, scaleT: 0, scale: 1, reachT: 0, extraT: 0, magT: 0,
    nextHit: null, nextT: 0, stunT: 0, slowT: 0, invT: 0, noJumpT: 0, homing: 0, superReady: false,
  };
}

function resetForRound(p) {
  p.x = START_X[p.id]; p.y = FLOOR - PH; p.vx = 0; p.vy = 0;
  p.hitCd = 0; p.dashT = 0; p.speedT = 0; p.gravT = 0; p.springN = 0; p.scaleT = 0; p.reachT = 0;
  p.extraT = 0; p.magT = 0; p.nextHit = null; p.nextT = 0; p.stunT = 0; p.slowT = 0; p.invT = 0;
  p.noJumpT = 0; p.homing = 0; p.superReady = false;
  p.abil = Math.random() < 1 / SUPER_ODDS ? SUPER : pick(ABIL);
  p.abCd = 0;
  if (p.abil.rare) {
    banners.push({ text: 'SUPER RARE! P' + (p.id + 1) + ': ' + p.abil.name, col: '#ffd700', life: 200, big: true });
    shake = 12;
  } else {
    banners.push({ text: 'P' + (p.id + 1) + ' ability: ' + p.abil.name, col: COL[p.id], life: 130, big: false });
  }
}

function racket(p) {
  return { x: p.x + p.w / 2 + p.face * (p.reachT > 0 ? 62 : 30), y: p.y + 18, r: 26 * (p.scaleT > 0 ? p.scale : 1) };
}
function rackets(p) {
  const list = [racket(p)];
  if (p.extraT > 0) list.push({ x: p.x + p.w / 2, y: p.y - 34, r: 24 });
  return list;
}

function serve(side) {
  ball = { x: side === 0 ? 240 : 720, y: 160, vx: 0, vy: 0, frozen: 50, bounces: 0, bonus: 0 };
  rally = 0; netTop = NET_BASE; netT = 0; trampT = 0; iceT = 0;
  banners = [];
  for (const p of players) resetForRound(p);
}

function newMatch() {
  scores = [0, 0];
  players = [makePlayer(0), makePlayer(1)];
  particles = [];
  serve(Math.random() < 0.5 ? 0 : 1);
  state = 'playing';
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('over').classList.add('hidden');
}

function showMenu() {
  state = 'menu';
  document.getElementById('over').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}

function burst(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 20 + Math.random() * 15, col });
  }
}

function pointFor(winner) {
  scores[winner]++;
  lastWinner = winner;
  burst(ball.x, ball.y, 24, COL[winner]);
  shake = 8;
  if (scores[winner] >= WIN) {
    state = 'over';
    document.getElementById('overTitle').textContent = 'PLAYER ' + (winner + 1) + ' WINS!';
    document.getElementById('overScore').textContent = scores[0] + '  -  ' + scores[1];
    document.getElementById('over').classList.remove('hidden');
    return;
  }
  msg = 'Point for Player ' + (winner + 1) + '!';
  state = 'pause';
  timer = 80;
}

// ============================================================
// Hitting
// ============================================================
function hit(p, r) {
  const b = ball;
  const dir = p.id === 0 ? 1 : -1;
  rally++;
  const sp = 8.2 + Math.min(rally, 24) * 0.22 + Math.abs(p.vx) * 0.25;
  const rel = clamp((b.y - r.y) / r.r, -1, 1);
  let vx = dir * sp;
  let vy = -9 - 2.5 * rel + p.vy * 0.25;
  const inAir = p.y < FLOOR - p.h - 40;
  if (inAir && r.y < 300 && b.y < r.y - 6) {
    vy = 3 + Math.random();
    vx = dir * Math.min(sp * 1.25, 17);
    burst(b.x, b.y, 12, '#ffd54a');
  }
  const mode = p.nextT > 0 ? p.nextHit : null;
  if (mode === 'power') vx *= 1.6;
  else if (mode === 'lob') { vx = dir * 5.5; vy = -16; }
  else if (mode === 'drop') { vx = dir * 4; vy = -7; }
  else if (mode === 'smash') { vx = dir * Math.min(sp * 1.4, 19); vy = 5; }
  else if (mode === 'wobble') b.wobbleT = 120;
  else if (mode === 'rocket') { vx = dir * 21; vy = -8; }
  if (mode) { p.nextHit = null; p.nextT = 0; }

  let superHit = false;
  if (p.superReady) {
    superHit = true;
    vx = dir * 26; vy = -8;
    p.superReady = false; p.homing = 0;
    shake = 14;
    burst(b.x, b.y, 30, '#ffd700');
    banners.push({ text: 'HOMING SMASH!', col: '#ffd700', life: 60, big: true });
  } else {
    const s = Math.hypot(vx, vy);
    if (s > 19) { vx *= 19 / s; vy *= 19 / s; }
  }
  b.vx = vx; b.vy = vy; b.bounces = 0; b.bonus = 0;
  const dx = b.x - r.x, dy = b.y - r.y, d = Math.hypot(dx, dy) || 1;
  b.x = r.x + dx / d * (r.r + BALL_R + 1);
  b.y = r.y + dy / d * (r.r + BALL_R + 1);
  p.hitCd = 12; p.swing = 10;
  if (!superHit) burst(b.x, b.y, 6, '#fff');
}

// ============================================================
// Update
// ============================================================
function updatePlayer(p) {
  const c = CTL[p.id], o = players[1 - p.id];
  for (const k of ['speedT', 'gravT', 'scaleT', 'reachT', 'extraT', 'magT', 'nextT', 'stunT', 'slowT', 'invT', 'noJumpT']) {
    if (p[k] > 0) p[k]--;
  }
  if (p.abCd > 0) p.abCd--;
  if (p.hitCd > 0) p.hitCd--;
  if (p.swing > 0) p.swing--;

  const stunned = p.stunT > 0;
  let dir = (keys[c.l] ? -1 : 0) + (keys[c.r] ? 1 : 0);
  if (stunned) dir = 0; else if (p.invT > 0) dir = -dir;
  p.dirIn = dir;

  if (abQ[p.id]) {
    if (state === 'playing' && !stunned && p.abCd <= 0 && p.abil) {
      p.abil.use(p, o);
      p.abCd = p.abil.cd * 60;
    }
    abQ[p.id] = false;
  }

  const minX = p.id === 0 ? 0 : NET_X + NET_W / 2;
  const maxX = p.id === 0 ? NET_X - NET_W / 2 - p.w : W - p.w;

  if (p.homing > 0) {
    p.homing--;
    if (p.homing <= 0) p.superReady = false;
    jumpQ[p.id] = false; downQ[p.id] = false;
    const reach = p.reachT > 0 ? 62 : 30;
    const tx = ball.x - p.face * reach - p.w / 2, ty = ball.y - 18;
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    if (d > 0.5) { const st = Math.min(d, 34); p.x += dx / d * st; p.y += dy / d * st; }
    p.vx = 0; p.vy = 0;
    burst(p.x + p.w / 2, p.y + p.h / 2, 2, '#ffd700');
  } else {
    const spd = SPEED * (p.speedT > 0 ? 1.7 : 1) * (p.slowT > 0 ? 0.4 : 1);
    if (p.dashT > 0) {
      p.dashT--;
      p.vx = p.dashDir * 14;
      if (p.vy > 0.5) p.vy = 0.5;
    } else {
      p.vx += (dir * spd - p.vx) * (iceT > 0 ? 0.06 : 0.35);
    }
    if (jumpQ[p.id]) {
      if (!stunned && p.noJumpT <= 0) {
        p.vy = JUMP * (p.springN > 0 ? 1.5 : 1);
        if (p.springN > 0) p.springN--;
      }
      jumpQ[p.id] = false;
    }
    if (downQ[p.id]) { if (!stunned) p.vy = -JUMP; downQ[p.id] = false; }
    p.vy += GRAV_P * (p.gravT > 0 ? p.gravF : 1);
    p.x += p.vx; p.y += p.vy;
  }

  p.x = clamp(p.x, minX, maxX);
  if (p.y >= FLOOR - p.h) { p.y = FLOOR - p.h; p.vy = 0; }
  if (p.y < 0) { p.y = 0; if (p.vy < 0) p.vy = 0; }
}

function rampOf(b) { return 1 + Math.min((b.age || 0) / 60 * 0.04, 1.2); }

function updateBall() {
  const b = ball;
  if (b.frozen > 0) { b.frozen--; return; }
  let ts = 1;
  if (b.slowT > 0) { ts = 0.45; b.slowT--; } else if (b.fastT > 0) { ts = 1.5; b.fastT--; }
  b.age = (b.age || 0) + 1;
  ts *= rampOf(b);
  let gf = 1;
  if (b.gravT > 0) { gf = b.gravF; b.gravT--; }
  if (b.windT > 0) { b.vx += b.windDir * 0.07 * ts; b.windT--; }
  if (b.pullT > 0) {
    const r = racket(players[b.pullId]);
    const dx = r.x - b.x, dy = r.y - b.y, d = Math.hypot(dx, dy) || 1;
    b.vx += dx / d * 0.9; b.vy += dy / d * 0.9; b.pullT--;
  }
  if (b.wobbleT > 0) { b.vy += Math.sin(tick * 0.5) * 0.35; b.wobbleT--; }
  for (const p of players) {
    if (p.magT <= 0) continue;
    const r = racket(p), dx = r.x - b.x, dy = r.y - b.y;
    if (dx * dx + dy * dy < 150 * 150 && (p.id === 0 ? b.x < NET_X + 12 : b.x > NET_X - 12)) {
      b.vx += dx * 0.012; b.vy += dy * 0.012;
    }
  }
  b.vy += BALL_G * gf * ts;
  const steps = clamp(Math.ceil(Math.hypot(b.vx, b.vy) * ts / 12), 1, 6);
  for (let st = 0; st < steps && state === 'playing'; st++) {
    b.x += b.vx * ts / steps; b.y += b.vy * ts / steps;
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.9; }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.9; }

    const nx1 = NET_X - NET_W / 2, nx2 = NET_X + NET_W / 2;
    const cx = clamp(b.x, nx1, nx2), cy = clamp(b.y, netTop, FLOOR);
    const dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy);
    if (d < BALL_R) {
      let nxn, nyn;
      if (d > 0.001) { nxn = dx / d; nyn = dy / d; } else { nxn = b.x < NET_X ? -1 : 1; nyn = 0; }
      b.x = cx + nxn * BALL_R; b.y = cy + nyn * BALL_R;
      const vn = b.vx * nxn + b.vy * nyn;
      if (vn < 0) { b.vx -= 1.55 * vn * nxn; b.vy -= 1.55 * vn * nyn; }
      if (nyn < -0.7) b.vx += (b.x < NET_X ? -1 : 1) * 1.2;
    }

    for (const p of players) {
      if (p.hitCd > 0) continue;
      if (p.id === 0 ? b.x > NET_X + 12 : b.x < NET_X - 12) continue;
      for (const r of rackets(p)) {
        const rx = b.x - r.x, ry = b.y - r.y;
        if (rx * rx + ry * ry < (r.r + BALL_R) * (r.r + BALL_R)) { hit(p, r); break; }
      }
    }

    if (b.y + BALL_R >= FLOOR) {
      b.y = FLOOR - BALL_R;
      b.bounces++;
      if (b.bounces >= 2 + (b.bonus || 0)) pointFor(b.x < NET_X ? 1 : 0);
      else {
        b.vy = trampT > 0 ? -Math.abs(b.vy) * 1.12 - 4 : -Math.abs(b.vy) * 0.72;
        b.vx *= 0.92;
        burst(b.x, FLOOR, 6, '#fff');
      }
    }
  }
}

function update() {
  tick++;
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.x += q.vx; q.y += q.vy; q.vy += 0.15;
    if (--q.life <= 0) particles.splice(i, 1);
  }
  for (let i = banners.length - 1; i >= 0; i--) if (--banners[i].life <= 0) banners.splice(i, 1);
  if (shake > 0) shake--;
  if (netT > 0 && --netT <= 0) netTop = NET_BASE;
  if (trampT > 0) trampT--;
  if (iceT > 0) iceT--;
  if (state === 'playing') {
    for (const p of players) updatePlayer(p);
    updateBall();
  } else if (state === 'pause') {
    for (const p of players) updatePlayer(p);
    if (--timer <= 0) { serve(lastWinner); state = 'playing'; }
  } else {
    jumpQ[0] = jumpQ[1] = false; downQ[0] = downQ[1] = false; abQ[0] = abQ[1] = false;
  }
}

// ============================================================
// Draw
// ============================================================
function drawRacket(x, y, r, col) {
  ctx.strokeStyle = col || '#e8e8f0'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.8, r, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath(); ctx.moveTo(x + k * r * 0.3, y - r + 4); ctx.lineTo(x + k * r * 0.3, y + r - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - r * 0.7, y + k * r * 0.35); ctx.lineTo(x + r * 0.7, y + k * r * 0.35); ctx.stroke();
  }
}

function drawPlayer(p) {
  const cx = p.x + p.w / 2;
  ctx.fillStyle = COL[p.id];
  ctx.fillRect(p.x, p.y + 20, p.w, p.h - 20);
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(cx, p.y + 11, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = COL[p.id];
  ctx.fillRect(cx - 12, p.y + 2, 24, 5);
  ctx.fillStyle = '#111';
  ctx.fillRect(cx + p.face * 5 - 2, p.y + 9, 4, 4);
  if (p.stunT > 0) { ctx.fillStyle = 'rgba(140,240,255,0.55)'; ctx.fillRect(p.x - 3, p.y - 3, p.w + 6, p.h + 6); }
  if (p.invT > 0) { ctx.fillStyle = '#d060ff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('?!', cx, p.y - 8); }
  if (p.hitCd > 20) { ctx.fillStyle = '#f66'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('X', cx, p.y - 8); }

  const r = racket(p);
  const sw = p.swing > 0 ? p.swing / 10 : 0;
  const hx = r.x + p.face * sw * 14, hy = r.y - sw * 10;
  ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx + p.face * 8, p.y + 32); ctx.lineTo(hx, hy + r.r * 0.5); ctx.stroke();
  drawRacket(hx, hy, r.r, p.superReady ? '#ffd700' : null);
  if (p.extraT > 0) drawRacket(cx, p.y - 34, 24, '#ffd54a');
}

function drawCourt() {
  ctx.fillStyle = '#2f9e5a'; ctx.fillRect(0, FLOOR, W, H - FLOOR);
  if (trampT > 0) { ctx.fillStyle = '#ff5bd0'; ctx.fillRect(0, FLOOR, W, 5); }
  else if (iceT > 0) { ctx.fillStyle = '#bff'; ctx.fillRect(0, FLOOR, W, H - FLOOR); }
  else { ctx.fillStyle = '#e9f5ec'; ctx.fillRect(0, FLOOR, W, 4); }
  ctx.fillStyle = '#e9f5ec'; ctx.fillRect(NET_X - 1, FLOOR, 2, H - FLOOR);
  ctx.fillStyle = '#3a3f52'; ctx.fillRect(NET_X - NET_W / 2, netTop, NET_W, FLOOR - netTop);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
  for (let y = netTop + 8; y < FLOOR; y += 10) {
    ctx.beginPath(); ctx.moveTo(NET_X - NET_W / 2, y); ctx.lineTo(NET_X + NET_W / 2, y); ctx.stroke();
  }
  ctx.fillStyle = '#fff'; ctx.fillRect(NET_X - NET_W / 2 - 1, netTop - 3, NET_W + 2, 5);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, FLOOR);
  g.addColorStop(0, '#5aa8e8'); g.addColorStop(1, '#bfe3ff');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (!ball) { drawCourt(); return; }
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawCourt();

  const sh = clamp(1 - (FLOOR - ball.y) / 500, 0.2, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(ball.x, FLOOR + 6, 12 * sh + 4, 4 * sh + 1, 0, 0, Math.PI * 2); ctx.fill();
  for (const p of players) drawPlayer(p);
  ctx.fillStyle = ball.bounces > 0 ? '#ffa030' : '#d8f04a';
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL_R - 3, 0.4, 2.4); ctx.stroke();
  for (const q of particles) {
    ctx.globalAlpha = Math.min(1, q.life / 15);
    ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD();
}

function drawHUD() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillStyle = COL[0]; ctx.fillText(String(scores[0]), W / 2 - 70, 70);
  ctx.fillStyle = '#fff'; ctx.fillText(':', W / 2, 66);
  ctx.fillStyle = COL[1]; ctx.fillText(String(scores[1]), W / 2 + 70, 70);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = COL[0]; ctx.textAlign = 'left'; ctx.fillText('PLAYER 1', 20, 28);
  ctx.fillStyle = COL[1]; ctx.textAlign = 'right'; ctx.fillText('PLAYER 2', W - 20, 28);
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    if (!p.abil) continue;
    const key = i === 0 ? 'SPACE' : '/';
    const ready = p.abCd <= 0;
    ctx.textAlign = i === 0 ? 'left' : 'right';
    const x = i === 0 ? 20 : W - 20;
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = p.abil.rare ? '#b8860b' : '#1b2a44';
    ctx.fillText('[' + key + '] ' + p.abil.name, x, 50);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = ready ? '#1f7a3a' : '#7a2020';
    ctx.fillText(ready ? 'READY - ' + p.abil.desc : 'recharging ' + Math.ceil(p.abCd / 60) + 's', x, 66);
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffffcc'; ctx.font = '12px sans-serif';
  ctx.fillText('First to ' + WIN, W / 2, 92);
  ctx.fillStyle = '#7a2020'; ctx.font = 'bold 12px sans-serif';
  ctx.fillText('Ball speed x' + rampOf(ball).toFixed(1), W / 2, 108);
  let by = 130;
  for (const b of banners) {
    ctx.globalAlpha = Math.min(1, b.life / 25);
    ctx.font = b.big ? 'bold 30px sans-serif' : 'bold 16px sans-serif';
    ctx.fillStyle = b.col; ctx.textAlign = 'center';
    ctx.fillText(b.text, W / 2, by);
    by += b.big ? 36 : 22;
  }
  ctx.globalAlpha = 1;
  if (state === 'pause') {
    ctx.fillStyle = COL[lastWinner]; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(msg, W / 2, 260);
  }
}

// ============================================================
// Input + loop
// ============================================================
window.addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Slash') e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'Escape' && state !== 'menu') { showMenu(); return; }
  if (e.repeat) return;
  if (state !== 'playing' && state !== 'pause') return;
  for (let i = 0; i < 2; i++) {
    if (e.code === CTL[i].j) jumpQ[i] = true;
    if (e.code === CTL[i].dn) downQ[i] = true;
    if (e.code === CTL[i].d) abQ[i] = true;
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

document.getElementById('startBtn').addEventListener('click', newMatch);
document.getElementById('rematchBtn').addEventListener('click', newMatch);
document.getElementById('menuBtn').addEventListener('click', showMenu);

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
