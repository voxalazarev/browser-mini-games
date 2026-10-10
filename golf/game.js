'use strict';

// ============================================================
// Setup
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;
const TOTAL_LEVELS = 150;
const ARENA_H = 460;
const BALL_R = 8;
const HOLE_R0 = 20;

const FRICTION = 0.985;
const MIN_SPEED = 0.06;
const MAX_DRAG = 170;
const MIN_DRAG = 10;
const MAX_SPEED = 15.5;
const BOUNCE_RESTITUTION = 0.72;
const SAND_EXTRA_FRICTION = 0.9;

const STORAGE_KEY = 'draggolf_unlocked';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

// ============================================================
// Seeded RNG
// ============================================================
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rand(rng, min, max) { return min + rng() * (max - min); }

// ============================================================
// Level generation
// A hole is a corridor of connected segments (each with its own width
// and vertical center), bounded above and below by wall segments.
// Bumpers and hazards are placed with a guaranteed clear gap so there
// is always room for the ball to pass through every segment.
// ============================================================
function generateLevel(idx) {
  const rng = mulberry32(idx * 9277 + 4111);
  const diff = clamp(idx / (TOTAL_LEVELS - 1), 0, 1);

  const corridorW = lerp(210, 96, diff) * rand(rng, 0.92, 1.08);
  const numSegs = Math.round(3 + diff * 9);
  const segLenBase = lerp(260, 320, diff);
  const segLenGrow = lerp(0, 170, diff);

  const walls = [];
  const bumpers = [];
  const water = [];
  const sand = [];

  let x = 90, yc = ARENA_H / 2;
  const centers = [{ x, yc, halfW: corridorW / 2 }];

  for (let i = 0; i < numSegs; i++) {
    const segLen = rand(rng, segLenBase, segLenBase + segLenGrow);
    const halfW = Math.max(55, corridorW / 2 * rand(rng, 0.85, 1.1));
    let newYc = yc;
    if (i > 0) {
      const bend = rand(rng, 50, 70 + diff * 120) * (rng() < 0.5 ? -1 : 1);
      newYc = clamp(yc + bend, halfW + 30, ARENA_H - halfW - 30);
    }
    x += segLen;
    centers.push({ x, yc: newYc, halfW });
    yc = newYc;
  }

  // walls: connect each consecutive center's top/bottom edge
  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i], b = centers[i + 1];
    walls.push({ x1: a.x, y1: a.yc - a.halfW, x2: b.x, y2: b.yc - b.halfW });
    walls.push({ x1: a.x, y1: a.yc + a.halfW, x2: b.x, y2: b.yc + b.halfW });
  }
  // cap both ends so a ball can never roll off the start or past the hole
  const first0 = centers[0], last0 = centers[centers.length - 1];
  walls.push({ x1: first0.x - 30, y1: first0.yc - first0.halfW, x2: first0.x - 30, y2: first0.yc + first0.halfW });
  walls.push({ x1: last0.x + 40, y1: last0.yc - last0.halfW, x2: last0.x + 40, y2: last0.yc + last0.halfW });

  // obstacles: placed inside each interior segment, always leaving a safe gap
  const nBumpers = Math.round(diff * 14);
  const nHazards = Math.round(1 + diff * 10);
  function safeSpot(segIdx) {
    const a = centers[segIdx], b = centers[segIdx + 1];
    const px = rand(rng, a.x + 40, b.x - 40);
    const halfW = lerp(a.halfW, b.halfW, (px - a.x) / (b.x - a.x));
    const yc = lerp(a.yc, b.yc, (px - a.x) / (b.x - a.x));
    return { px, yc, halfW };
  }
  for (let i = 0; i < nBumpers; i++) {
    const segIdx = 1 + Math.floor(rng() * Math.max(1, centers.length - 3));
    const spot = safeSpot(Math.min(segIdx, centers.length - 2));
    const r = rand(rng, 16, 24);
    const maxOffset = spot.halfW - r - BALL_R * 2.4;
    if (maxOffset < 10) continue;
    const off = rand(rng, -maxOffset, maxOffset);
    bumpers.push({ x: spot.px, y: spot.yc + off, r });
  }
  for (let i = 0; i < nHazards; i++) {
    const segIdx = 1 + Math.floor(rng() * Math.max(1, centers.length - 3));
    const spot = safeSpot(Math.min(segIdx, centers.length - 2));
    const r = rand(rng, 18, 30);
    const maxOffset = spot.halfW - r - BALL_R * 2.2;
    if (maxOffset < 10) continue;
    const off = rand(rng, -maxOffset, maxOffset);
    const isWater = rng() < 0.5;
    (isWater ? water : sand).push({ x: spot.px, y: spot.yc + off, r });
  }

  const last = centers[centers.length - 1];
  const holeR = lerp(HOLE_R0, HOLE_R0 - 8, diff);
  const hole = { x: last.x - 50, y: last.yc, r: holeR };
  const first = centers[0];
  const tee = { x: first.x, y: first.yc };

  const minX = Math.min(...walls.map(w => Math.min(w.x1, w.x2))) - 60;
  const maxX = Math.max(...walls.map(w => Math.max(w.x1, w.x2))) + 80;

  return {
    index: idx, diff, corridorW,
    length: last.x, centers, walls, bumpers, water, sand, hole, tee,
    bounds: { minX, maxX, minY: 0, maxY: ARENA_H },
  };
}
function lerp(a, b, t) { return a + (b - a) * t; }

// ============================================================
// Game state
// ============================================================
let level = null;
let currentLevelIndex = 0;
let balls = []; // { x, y, vx, vy, color, strokes, sunk }
let turn = 0;
let moving = false;
let camera = { x: 0, y: 0 };
let running = false;
let complete = false;
let finishOrder = [];
let shotPreShotPos = null;
let message = '', messageT = 0;

function loadUnlocked() {
  const v = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  return clamp(isNaN(v) ? 0 : v, 0, TOTAL_LEVELS - 1);
}
function saveUnlocked(v) {
  const cur = loadUnlocked();
  if (v > cur) localStorage.setItem(STORAGE_KEY, String(v));
}

function loadLevel(idx) {
  currentLevelIndex = clamp(idx, 0, TOTAL_LEVELS - 1);
  level = generateLevel(currentLevelIndex);
  balls = [
    { x: level.tee.x, y: level.tee.y - 10, vx: 0, vy: 0, color: '#4ad0ff', strokes: 0, sunk: false, splashed: false, fellOff: false, teeY: level.tee.y - 10 },
    { x: level.tee.x, y: level.tee.y + 10, vx: 0, vy: 0, color: '#ff5b7a', strokes: 0, sunk: false, splashed: false, fellOff: false, teeY: level.tee.y + 10 },
  ];
  turn = 0;
  moving = false;
  complete = false;
  finishOrder = [];
  message = ''; messageT = 0;
  camera.x = clamp(balls[0].x - CANVAS_W / 2, level.bounds.minX, Math.max(level.bounds.minX, level.bounds.maxX - CANVAS_W));
  camera.y = 0;
  document.getElementById('hudLevel').textContent = 'Hole ' + (currentLevelIndex + 1) + ' / ' + TOTAL_LEVELS;
  updateTurnHud();
}

function updateTurnHud() {
  const el = document.getElementById('hudTurn');
  if (complete) { el.textContent = 'Both players sank it!'; return; }
  const sunkNote = balls[turn === 0 ? 1 : 0].sunk ? ' (Player ' + (turn === 0 ? 2 : 1) + ' is done - waiting on you)' : '';
  el.textContent = "Player " + (turn + 1) + "'s turn  (strokes: " + balls[0].strokes + ' - ' + balls[1].strokes + ')' + sunkNote;
}

function setMessage(text) { message = text; messageT = 90; }

// ============================================================
// Physics
// ============================================================
function segReflect(ball, w) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len, ny = dy / len;
  const px = ball.x - w.x1, py = ball.y - w.y1;
  const t = clamp(px * nx + py * ny, 0, len);
  const closestX = w.x1 + nx * t, closestY = w.y1 + ny * t;
  const ddx = ball.x - closestX, ddy = ball.y - closestY;
  const d = Math.hypot(ddx, ddy);
  if (d >= BALL_R || d === 0) return false;
  const ux = ddx / d, uy = ddy / d;
  const overlap = BALL_R - d;
  ball.x += ux * overlap;
  ball.y += uy * overlap;
  const vn = ball.vx * ux + ball.vy * uy;
  if (vn < 0) {
    ball.vx -= (1 + BOUNCE_RESTITUTION) * vn * ux;
    ball.vy -= (1 + BOUNCE_RESTITUTION) * vn * uy;
  }
  return true;
}

function stepBall(ball) {
  if (ball.sunk) return;
  ball.x += ball.vx;
  ball.y += ball.vy;

  for (const w of level.walls) segReflect(ball, w);
  for (const b of level.bumpers) {
    const d = dist(ball.x, ball.y, b.x, b.y);
    const minD = BALL_R + b.r;
    if (d < minD && d > 0) {
      const ux = (ball.x - b.x) / d, uy = (ball.y - b.y) / d;
      ball.x = b.x + ux * minD; ball.y = b.y + uy * minD;
      const vn = ball.vx * ux + ball.vy * uy;
      if (vn < 0) {
        ball.vx -= (1 + BOUNCE_RESTITUTION) * vn * ux;
        ball.vy -= (1 + BOUNCE_RESTITUTION) * vn * uy;
      }
    }
  }

  let inSand = false;
  for (const s of level.sand) { if (dist(ball.x, ball.y, s.x, s.y) < s.r) inSand = true; }
  for (const w of level.water) {
    if (dist(ball.x, ball.y, w.x, w.y) < w.r) { ball.splashed = true; }
  }

  if (dist(ball.x, ball.y, level.hole.x, level.hole.y) < level.hole.r) {
    ball.sunk = true;
    ball.vx = 0; ball.vy = 0;
    return;
  }

  ball.vx *= FRICTION * (inSand ? SAND_EXTRA_FRICTION : 1);
  ball.vy *= FRICTION * (inSand ? SAND_EXTRA_FRICTION : 1);
  if (Math.hypot(ball.vx, ball.vy) < MIN_SPEED) { ball.vx = 0; ball.vy = 0; }

  // safety net: walls should always contain the ball, but if one somehow
  // slips through a seam at a sharp bend, don't let it fly off forever.
  if (ball.y < -60 || ball.y > ARENA_H + 60) {
    ball.fellOff = true;
    ball.vx = 0; ball.vy = 0;
  }
}

function anyMoving() {
  return balls.some(b => !b.sunk && (b.vx !== 0 || b.vy !== 0));
}

function endOfShot() {
  const b = balls[turn];
  if (b.sunk) {
    finishOrder.push(turn);
    setMessage('Player ' + (turn + 1) + ' sank it!');
    if (balls[0].sunk && balls[1].sunk) {
      complete = true;
      saveUnlocked(currentLevelIndex + 1);
      updateTurnHud();
      showWin();
      return;
    }
    // this player is done - the other one still needs to finish
    turn = 1 - turn;
    updateTurnHud();
    return;
  }
  if (b.fellOff) {
    b.x = level.tee.x; b.y = b.teeY;
    b.fellOff = false;
    setMessage('Player ' + (turn + 1) + ' fell off! Back to the start.');
  } else if (b.splashed) {
    b.x = shotPreShotPos.x; b.y = shotPreShotPos.y;
    b.splashed = false;
    setMessage('Splash! Player ' + (turn + 1) + ' resets.');
  }
  // pass to the other player, unless they've already sunk their ball
  if (!balls[1 - turn].sunk) turn = 1 - turn;
  updateTurnHud();
}

function showWin() {
  document.getElementById('winTitle').textContent = 'BOTH PLAYERS SANK IT!';
  const firstMsg = finishOrder.length ? 'Player ' + (finishOrder[0] + 1) + ' finished first. ' : '';
  document.getElementById('winBody').textContent =
    firstMsg + 'Strokes - Player 1: ' + balls[0].strokes + '   Player 2: ' + balls[1].strokes;
  document.getElementById('winScreen').classList.remove('hidden');
}

function update() {
  if (messageT > 0) messageT--;
  if (!running || complete) return;
  if (moving) {
    for (const b of balls) stepBall(b);
    if (!anyMoving()) { moving = false; endOfShot(); }
  }
  const b = balls[turn];
  const targetX = clamp(b.x - CANVAS_W / 2, level.bounds.minX, Math.max(level.bounds.minX, level.bounds.maxX - CANVAS_W));
  camera.x += (targetX - camera.x) * 0.15;
}

// ============================================================
// Input: drag to aim, release to shoot
// ============================================================
let dragging = false, dragStart = null, dragNow = null;

function worldMouse(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) + camera.x, y: (e.clientY - rect.top) + camera.y };
}

canvas.addEventListener('mousedown', (e) => {
  if (!running || moving || complete) return;
  dragging = true;
  dragStart = worldMouse(e);
  dragNow = dragStart;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const rect = canvas.getBoundingClientRect();
  dragNow = { x: (e.clientX - rect.left) + camera.x, y: (e.clientY - rect.top) + camera.y };
});
window.addEventListener('mouseup', () => {
  if (!dragging) return;
  dragging = false;
  const dx = dragNow.x - dragStart.x, dy = dragNow.y - dragStart.y;
  const dragLen = Math.hypot(dx, dy);
  if (dragLen < MIN_DRAG) return;
  const power = Math.min(dragLen, MAX_DRAG) / MAX_DRAG;
  const ux = -dx / dragLen, uy = -dy / dragLen;
  const b = balls[turn];
  shotPreShotPos = { x: b.x, y: b.y };
  b.vx = ux * power * MAX_SPEED;
  b.vy = uy * power * MAX_SPEED;
  b.strokes++;
  moving = true;
  updateTurnHud();
});

// ============================================================
// Rendering
// ============================================================
function drawArrow(x1, y1, x2, y2, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 12 * Math.cos(ang - 0.4), y2 - 12 * Math.sin(ang - 0.4));
  ctx.lineTo(x2 - 12 * Math.cos(ang + 0.4), y2 - 12 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0, '#0e4a24'); g.addColorStop(1, '#082b15');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (!level) return;

  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // fairway
  ctx.fillStyle = '#1a6b38';
  for (let i = 0; i < level.centers.length - 1; i++) {
    const a = level.centers[i], b = level.centers[i + 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.yc - a.halfW);
    ctx.lineTo(b.x, b.yc - b.halfW);
    ctx.lineTo(b.x, b.yc + b.halfW);
    ctx.lineTo(a.x, a.yc + a.halfW);
    ctx.closePath();
    ctx.fill();
  }

  // walls
  ctx.strokeStyle = '#d8d0b0'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  for (const w of level.walls) {
    ctx.beginPath(); ctx.moveTo(w.x1, w.y1); ctx.lineTo(w.x2, w.y2); ctx.stroke();
  }

  // hazards
  ctx.fillStyle = '#3a8bd8';
  for (const w of level.water) { ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#d8c070';
  for (const s of level.sand) { ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill(); }

  // bumpers
  for (const b of level.bumpers) {
    ctx.fillStyle = '#c04040';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff3'; ctx.lineWidth = 2; ctx.stroke();
  }

  // hole
  ctx.fillStyle = '#060606';
  ctx.beginPath(); ctx.arc(level.hole.x, level.hole.y, level.hole.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(level.hole.x + level.hole.r, level.hole.y);
  ctx.lineTo(level.hole.x + level.hole.r, level.hole.y - 50); ctx.stroke();
  ctx.fillStyle = '#e8443b';
  ctx.beginPath();
  ctx.moveTo(level.hole.x + level.hole.r, level.hole.y - 50);
  ctx.lineTo(level.hole.x + level.hole.r + 26, level.hole.y - 42);
  ctx.lineTo(level.hole.x + level.hole.r, level.hole.y - 34);
  ctx.closePath(); ctx.fill();

  // balls
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    if (b.sunk) continue;
    ctx.fillStyle = b.color;
    ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = i === turn && !complete && !balls[i].sunk ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2; ctx.stroke();
  }

  // aim arrow (opposite the drag direction)
  if (dragging && dragStart && dragNow) {
    const dx = dragNow.x - dragStart.x, dy = dragNow.y - dragStart.y;
    const dragLen = Math.hypot(dx, dy);
    if (dragLen >= MIN_DRAG) {
      const power = Math.min(dragLen, MAX_DRAG) / MAX_DRAG;
      const ux = -dx / dragLen, uy = -dy / dragLen;
      const b = balls[turn];
      const len = 40 + power * 110;
      const col = power < 0.5 ? '#ffd54a' : power < 0.85 ? '#ff9a3d' : '#ff4040';
      drawArrow(b.x, b.y, b.x + ux * len, b.y + uy * len, col);
    }
  }

  ctx.restore();

  // HUD text
  ctx.textAlign = 'center';
  if (messageT > 0) {
    ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 20px sans-serif';
    ctx.globalAlpha = Math.min(1, messageT / 30);
    ctx.fillText(message, CANVAS_W / 2, 90);
    ctx.globalAlpha = 1;
  }
}

// ============================================================
// Main loop
// ============================================================
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// ============================================================
// UI wiring
// ============================================================
function showScreen(id) { document.getElementById(id).classList.remove('hidden'); }
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }
function hideAllScreens() { ['overlay', 'levelSelect', 'winScreen'].forEach(hideScreen); }

function startGame(idx) {
  hideAllScreens();
  loadLevel(idx);
  running = true;
}

function buildLevelGrid() {
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  const unlocked = loadUnlocked();
  for (let i = 0; i < TOTAL_LEVELS; i++) {
    const btn = document.createElement('button');
    btn.textContent = String(i + 1);
    btn.disabled = i > unlocked;
    if (i === currentLevelIndex) btn.classList.add('current');
    if (i < unlocked) btn.classList.add('done');
    btn.addEventListener('click', () => startGame(i));
    grid.appendChild(btn);
  }
}

document.getElementById('btnPlay').addEventListener('click', () => startGame(loadUnlocked()));
document.getElementById('btnLevels').addEventListener('click', () => { buildLevelGrid(); hideAllScreens(); showScreen('levelSelect'); });
document.getElementById('btnBackFromSelect').addEventListener('click', () => { hideAllScreens(); showScreen('overlay'); });
document.getElementById('btnMenu').addEventListener('click', () => { running = false; hideAllScreens(); showScreen('overlay'); });
document.getElementById('btnNextLevel').addEventListener('click', () => startGame(clamp(currentLevelIndex + 1, 0, TOTAL_LEVELS - 1)));
document.getElementById('btnWinMenu').addEventListener('click', () => { buildLevelGrid(); hideAllScreens(); showScreen('levelSelect'); });

// initial state
loadLevel(0);
running = false;
draw();
showScreen('overlay');
requestAnimationFrame(loop);
