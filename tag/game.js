// ============================================================
// Tag - 2D side-view platformer. Whoever is "IT" chases the other player.
// Touch to pass it on. Least time spent as IT after the round wins.
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;

const R = 16;
const SPEED = 3.4;
const IT_SPEED = 3.7;
const GRAVITY = 0.55;
const JUMP_VEL = 12.5;
const MAX_FALL = 14;
const FREEZE_FRAMES = 180; // new IT can't move for 3s
const TAG_COOLDOWN = FREEZE_FRAMES;   // frames of immunity after a tag
const ROUND_FRAMES = 60 * 60;

const OBSTACLES = [
  { x: 0, y: H - 30, w: W, h: 30 },
  { x: 120, y: 400, w: 160, h: 16 }, { x: 680, y: 400, w: 160, h: 16 },
  { x: 390, y: 330, w: 180, h: 16 },
  { x: 40, y: 270, w: 140, h: 16 }, { x: 780, y: 270, w: 140, h: 16 },
  { x: 250, y: 200, w: 130, h: 16 }, { x: 580, y: 200, w: 130, h: 16 },
  { x: 400, y: 110, w: 160, h: 16 },
];

let mode = '2p', running = false, keys = {};
let players = [], frame = 0, cooldown = 0, over = false;

function makePlayer(color, x, y) {
  return { x, y, vy: 0, onGround: false, color, itTime: 0, isIt: false, frozen: 0 };
}

function startRun() {
  players = [makePlayer('#4aa8ff', 80, H - 30 - R), makePlayer('#ff6a5a', W - 80, H - 30 - R)];
  players[Math.random() < 0.5 ? 0 : 1].isIt = true;
  frame = 0; cooldown = TAG_COOLDOWN; over = false;
  players.find(p => p.isIt).frozen = FREEZE_FRAMES;
  updateHud();
}

function fmt(f) { const s = Math.ceil(f / 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

function updateHud() {
  document.getElementById('hudTimer').textContent = fmt(Math.max(0, ROUND_FRAMES - frame));
  const names = mode === 'bot' ? ['You', 'Bot'] : ['P1', 'P2'];
  document.getElementById('hudRoles').innerHTML = players.map((p, i) =>
    `<span style="color:${p.color}">${names[i]}${p.isIt ? ' (IT)' : ''}: ${(p.itTime / 60).toFixed(1)}s</span>`).join(' &nbsp; ');
}

// Floor (index 0) is solid; platforms are one-way: you pass up through them
// from below and only land on them when falling from above.
function landsOn(x, y, step) {
  for (let i = 0; i < OBSTACLES.length; i++) {
    const o = OBSTACLES[i];
    if (x + R > o.x && x - R < o.x + o.w && y + R <= o.y && y + step + R > o.y) return true;
  }
  return false;
}

function move(p, dx, jump) {
  const sp = p.isIt ? IT_SPEED : SPEED;
  p.x = clamp(p.x + dx * sp, R, W - R);
  if (dx) p.face = dx;
  p.walk = dx ? (p.walk || 0) + 0.25 : 0;
  if (jump && p.onGround) p.vy = -JUMP_VEL;
  p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
  p.onGround = false;
  if (p.vy >= 0) {
    for (let i = 0, n = Math.ceil(p.vy); i < n; i++) {
      if (landsOn(p.x, p.y, 1)) { p.onGround = true; p.vy = 0; break; }
      p.y += 1;
    }
  } else p.y += p.vy;
  if (p.y < R) { p.y = R; p.vy = 0; }
}

// ---- Bot: plans routes across the platform graph -------------
function hgapOf(a, b) { return Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)); }
function canReach(a, b) {
  if (a === b) return false;
  const rise = a.y - b.y, gap = hgapOf(a, b);
  if (rise > 135) return false;
  // airtime to land at +rise (or -rise when falling), times horizontal speed, with a safety margin
  const t = (JUMP_VEL + Math.sqrt(Math.max(0, JUMP_VEL * JUMP_VEL - 2 * GRAVITY * rise))) / GRAVITY;
  return gap <= t * SPEED * 0.8;
}
function nodeBelow(p) {
  let best = -1, by = 1e9;
  OBSTACLES.forEach((o, i) => {
    if (p.x + R > o.x && p.x - R < o.x + o.w && o.y >= p.y + R - 4 && o.y < by) { by = o.y; best = i; }
  });
  return best;
}
function bfs(from) {
  const dist = OBSTACLES.map(() => Infinity), prev = OBSTACLES.map(() => -1);
  dist[from] = 0; const q = [from];
  while (q.length) {
    const u = q.shift();
    OBSTACLES.forEach((o, v) => {
      if (dist[v] === Infinity && canReach(OBSTACLES[u], o)) { dist[v] = dist[u] + 1; prev[v] = u; q.push(v); }
    });
  }
  return { dist, prev };
}
function firstHop(prev, from, to) {
  let c = to;
  while (c !== -1 && prev[c] !== from) c = prev[c];
  return c;
}

function navigate(self, a, n) {
  const rise = a.y - n.y, gap = hgapOf(a, n);
  const gx = clamp(self.x, n.x + R + 4, n.x + n.w - R - 4);
  const toGx = Math.abs(gx - self.x) < 6 ? 0 : Math.sign(gx - self.x);
  if (!self.onGround) return [toGx, false];
  const overlap = self.x >= n.x + R && self.x <= n.x + n.w - R;
  if (rise > 0) {
    if (overlap) return [0, true];
    const dir = Math.sign(gx - self.x);
    const edgeDist = dir > 0 ? a.x + a.w - self.x : self.x - a.x;
    return [dir, edgeDist <= 14];
  }
  const dir = (n.x + n.w / 2) >= (a.x + a.w / 2) ? 1 : -1;
  const edgeDist = dir > 0 ? a.x + a.w - self.x : self.x - a.x;
  return [dir, gap > 0 && edgeDist <= 14];
}

function botInput(self, other) {
  const A = OBSTACLES;
  if (self.onGround) { const nb = nodeBelow(self); if (nb >= 0) self.node = nb; }
  if (self.node === undefined) self.node = nodeBelow(self);
  const me = self.node, them = nodeBelow(other);
  const { dist, prev } = bfs(me);
  let goal = me;
  if (self.isIt) goal = them;
  else {
    self.goalT = (self.goalT || 0) - 1;
    if (self.goalT <= 0 || self.goal === undefined) {
      const dc = bfs(them).dist;
      let best = -1e9;
      A.forEach((o, c) => {
        if (dist[c] > 3) return;
        const s = (dc[c] === Infinity ? 9 : dc[c]) - 0.3 * dist[c];
        if (s > best) { best = s; self.goal = c; }
      });
      self.goalT = 40;
    }
    goal = self.goal;
  }

  const hop = (goal !== me && dist[goal] < Infinity) ? firstHop(prev, me, goal) : -1;
  if (hop >= 0) return navigate(self, A[me], A[hop]);

  // already on the goal platform (or unreachable)
  const a = A[me];
  if (self.isIt) {
    const dx = Math.abs(other.x - self.x) < 8 ? 0 : Math.sign(other.x - self.x);
    const jump = self.onGround && other.y < self.y - 30 && Math.abs(other.x - self.x) < 50;
    return [dx, jump];
  }
  const dir = self.x === other.x ? 1 : Math.sign(self.x - other.x);
  const edgeDist = dir > 0 ? a.x + a.w - self.x : self.x - a.x;
  const close = Math.hypot(other.x - self.x, other.y - self.y) < 90;
  if (edgeDist < 30 && close) {
    // cornered: hop over the chaser
    return [-dir, self.onGround];
  }
  return [edgeDist < 20 ? 0 : dir, false];
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function update() {
  if (!running || over) return;
  const [a, b] = players;
  const k = c => keys[c] ? 1 : 0;
  for (const p of players) if (p.frozen > 0) p.frozen--;
  const fz = p => p.frozen > 0;
  move(a, fz(a) ? 0 : k('KeyD') - k('KeyA'), !fz(a) && keys['KeyW']);
  if (mode === 'bot') { const [dx, j] = botInput(b, a); move(b, fz(b) ? 0 : dx, !fz(b) && j); }
  else move(b, fz(b) ? 0 : k('ArrowRight') - k('ArrowLeft'), !fz(b) && keys['ArrowUp']);

  frame++;
  if (cooldown > 0) cooldown--;
  players.find(p => p.isIt).itTime++;
  if (cooldown === 0 && Math.hypot(a.x - b.x, a.y - b.y) < R * 2) {
    a.isIt = !a.isIt; b.isIt = !b.isIt; cooldown = TAG_COOLDOWN;
    (a.isIt ? a : b).frozen = FREEZE_FRAMES;
  }
  if (frame >= ROUND_FRAMES) over = true;
  updateHud();
}

function drawCharacter(p) {
  const f = p.face || 1, air = !p.onGround, t = p.walk || 0;
  const hipY = p.y + 4, headY = p.y - R + 6;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = p.color;
  const limb = (x, y, ang, len) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(ang) * len, y + Math.cos(ang) * len); ctx.stroke(); };
  const sw = air ? 0.7 : Math.sin(t) * 0.8;
  limb(p.x, hipY, sw, 12); limb(p.x, hipY, -sw, 12);               // legs
  ctx.beginPath(); ctx.moveTo(p.x, headY + 6); ctx.lineTo(p.x, hipY); ctx.stroke(); // body
  const arm = air ? 2.4 : -Math.sin(t) * 0.8;
  limb(p.x, headY + 10, arm, 10); limb(p.x, headY + 10, air ? -2.4 : Math.sin(t) * 0.8, 10); // arms
  ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, headY, 7, 0, Math.PI * 2); ctx.fill(); // head
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(p.x + f * 3, headY - 1, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(p.x + f * 4, headY - 1, 1.1, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.fillStyle = '#1b2233'; ctx.fillRect(0, 0, W, H);
  for (const o of OBSTACLES) { ctx.fillStyle = '#5a5f78'; ctx.fillRect(o.x, o.y, o.w, o.h); ctx.fillStyle = '#8b92b5'; ctx.fillRect(o.x, o.y, o.w, 3); }
  for (const p of players) {
    drawCharacter(p);
    if (p.isIt) {
      ctx.fillStyle = '#ffd400'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.frozen > 0 ? 'IT ' + Math.ceil(p.frozen / 60) : 'IT', p.x, p.y - R - 10);
    }
  }
  if (over) {
    const [a, b] = players;
    const msg = a.itTime === b.itTime ? 'Draw!' : (a.itTime < b.itTime ? (mode === 'bot' ? 'You win!' : 'P1 wins!') : (mode === 'bot' ? 'Bot wins!' : 'P2 wins!'));
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 48px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(msg, W / 2, H / 2);
    ctx.font = '18px sans-serif'; ctx.fillText('Press New Round or Menu', W / 2, H / 2 + 36);
  }
}

// ============================================================
// Input + UI wiring
// ============================================================
window.addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow')) e.preventDefault();
  keys[e.code] = true;
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function showScreen(id) { document.getElementById(id).classList.remove('hidden'); }
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }


function setMode(m) {
  mode = m;
  document.getElementById('btn2P').classList.toggle('selected', m === '2p');
  document.getElementById('btnBot').classList.toggle('selected', m === 'bot');
}
setMode('2p');
document.getElementById('btn2P').addEventListener('click', () => setMode('2p'));
document.getElementById('btnBot').addEventListener('click', () => setMode('bot'));

function startGame() {
  hideScreen('menu');
  document.getElementById('hud').classList.remove('hidden');
  startRun();
  running = true;
}
document.getElementById('btnPlay').addEventListener('click', startGame);
document.getElementById('btnNewCity').addEventListener('click', () => startRun());
document.getElementById('btnMenu').addEventListener('click', () => {
  running = false; document.getElementById('hud').classList.add('hidden'); showScreen('menu');
});

startRun();
draw();
showScreen('menu');

let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
