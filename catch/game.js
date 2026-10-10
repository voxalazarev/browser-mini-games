'use strict';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
const TOTAL = 150;

const AR_W = 34, AR_H = 46;
const BUCKET_TOP = 430, BUCKET_BOT = 510;
const TARGET_Y = (BUCKET_TOP + BUCKET_BOT) / 2;
const TARGET_TOP = TARGET_Y - AR_H / 2;
const LANE_W = 100;
const AREA_X = [40, 520];
const KEYS = [['KeyW', 'KeyA', 'KeyS', 'KeyD'], ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']];
const LABELS = [['↑', '←', '↓', '→'], ['↑', '←', '↓', '→']];
const LANE_COL = ['#ff5b7a', '#ffb84a', '#5be08a', '#4ab8ff'];
const P_COL = ['#4ad0ff', '#ff5b7a'];
const GIMMICKS = ['Steady', 'Bursts', 'Chords', 'Jacks & Trills', 'Speed Swings'];
const STORE = 'arrowcatch_done';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================
// Levels (150, each harder than the last)
// ============================================================
function params(L) {
  const d = L / (TOTAL - 1);
  return {
    d,
    speed: 4,
    interval: 46,
    events: Math.round(8 + L * 0.6),
    chord: Math.min(0.2, Math.max(0, d - 0.25) * 0.3),
    lives: 1,
    gimmick: L % 5,
  };
}

function buildLevel(L) {
  const pr = params(L), d = pr.d;
  const rng = mulberry32(L * 1543 + 99);
  const times = [];
  let t = 0;
  for (let i = 0; i < pr.events; i++) {
    let gap = pr.interval;
    if (pr.gimmick === 1) { if (i % 8 >= 4) gap = Math.round(gap * 0.5); }
    else if (rng() < d * 0.1) gap = Math.round(gap * 0.5);
    else if (rng() < 0.15) gap = Math.round(gap * 1.4);
    t += Math.max(14, gap);
    times.push(t);
  }

  const raw = [[], []];
  for (let p = 0; p < 2; p++) {
    const r = mulberry32(L * 7717 + p * 31337 + 5);
    const seq = [];
    let last = -1, i = 0;
    while (i < times.length) {
      const wRand = 4, wStairs = 3;
      const wTrill = d * 4 * (pr.gimmick === 3 ? 2 : 1), wJack = d * 3 * (pr.gimmick === 3 ? 2 : 1);
      let x = r() * (wRand + wStairs + wTrill + wJack), kind;
      if ((x -= wRand) < 0) kind = 'rand';
      else if ((x -= wStairs) < 0) kind = 'stairs';
      else if ((x -= wTrill) < 0) kind = 'trill';
      else kind = 'jack';
      const len = Math.min(times.length - i, 3 + Math.floor(r() * 5));
      const a = Math.floor(r() * 4), b = (a + 1 + Math.floor(r() * 3)) % 4, dir = r() < 0.5 ? 1 : -1;
      for (let k = 0; k < len; k++) {
        let lane;
        if (kind === 'rand') { do { lane = Math.floor(r() * 4); } while (lane === last); }
        else if (kind === 'stairs') lane = (((a + dir * k) % 4) + 4) % 4;
        else if (kind === 'trill') lane = k % 2 === 0 ? a : b;
        else lane = a;
        const lanes = [lane];
        const pChord = pr.gimmick === 2 ? Math.min(0.35, pr.chord + 0.1) : pr.chord;
        if (r() < pChord) { let l2; do { l2 = Math.floor(r() * 4); } while (l2 === lane); lanes.push(l2); }
        seq.push(lanes); last = lane; i++;
      }
    }
    for (let k = 0; k < times.length; k++) {
      for (const lane of seq[k]) {
        const spd = pr.speed * (pr.gimmick === 4 ? 0.85 + r() * 0.3 : 1);
        raw[p].push({ lane, spd, target: times[k], spawn: times[k] - (TARGET_TOP + AR_H) / spd });
      }
    }
  }
  let minSpawn = Infinity;
  for (const list of raw) for (const a of list) minSpawn = Math.min(minSpawn, a.spawn);
  const shift = 40 - minSpawn;
  for (const list of raw) {
    for (const a of list) { a.spawn += shift; a.target += shift; }
    list.sort((x, y) => x.spawn - y.spawn);
  }
  return { pr, queue: raw };
}

// ============================================================
// State
// ============================================================
let state = 'menu'; // menu | ready | playing | complete | failed
let failInfo = null;
let level = 0, frame = 0, timer = 0, cur = null, P = [], pops = [], stars = [];
for (let i = 0; i < 60; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.5 + 0.3 });

function loadDone() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); } catch (e) { return new Set(); }
}
function markDone(L) {
  const s = loadDone(); s.add(L);
  try { localStorage.setItem(STORE, JSON.stringify([...s])); } catch (e) { /* ignore */ }
}

function startLevel(L) {
  level = L;
  cur = buildLevel(L);
  frame = 0; timer = 150; pops = []; failInfo = null;
  P = [0, 1].map(() => ({
    lives: cur.pr.lives, score: 0, combo: 0, best: 0, caught: 0, missed: 0, wrong: 0,
    active: [], idx: 0, flash: [0, 0, 0, 0],
  }));
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('result').classList.add('hidden');
  state = 'ready';
}

function showMenu() {
  state = 'menu';
  document.getElementById('result').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
  buildMenu();
}

function popup(pi, lane, text, col) {
  pops.push({ x: AREA_X[pi] + lane * LANE_W + LANE_W / 2, y: BUCKET_TOP - 10, text, col, life: 40 });
}

function pressLane(pi, lane) {
  const p = P[pi];
  p.flash[lane] = 8;
  let best = null;
  for (const a of p.active) {
    if (a.lane !== lane) continue;
    if (a.y + AR_H >= BUCKET_TOP && a.y <= BUCKET_BOT && (!best || a.y > best.y)) best = a;
  }
  if (best) {
    p.active.splice(p.active.indexOf(best), 1);
    const perfect = Math.abs(best.y + AR_H / 2 - TARGET_Y) < 16;
    p.score += 100 + (perfect ? 50 : 0) + Math.min(p.combo, 40) * 3;
    p.combo++; p.best = Math.max(p.best, p.combo); p.caught++;
    popup(pi, lane, perfect ? 'PERFECT!' : 'GOOD', perfect ? '#ffd700' : '#fff');
  } else {
    p.combo = 0; p.score = Math.max(0, p.score - 20);
    p.wrong++;
    popup(pi, lane, 'X', '#f55');
    if (p.wrong >= 6) { p.wrong = 0; p.lives--; popup(pi, lane, '-1 LIFE', '#f55'); if (!failInfo) failInfo = { pi, lane, why: 'pressed the wrong key too many times' }; checkFail(); }
  }
}

function checkFail() {
  if (state !== 'playing') return;
  const dead = P.findIndex(p => p.lives <= 0);
  if (dead < 0) return;
  if (!failInfo) failInfo = { pi: dead, lane: -1, why: 'ran out of lives' };
  state = 'failed';
  const f = failInfo;
  showResult('PLAYER ' + (f.pi + 1) + ' MADE THE MISTAKE!',
    'Player ' + (f.pi + 1) + ' ' + f.why + (f.lane >= 0 ? ' (' + LABELS[f.pi][f.lane] + ' bucket)' : '') + '.\nOne life each - try again!', false);
}

function showResult(title, body, won) {
  document.getElementById('resTitle').textContent = title;
  document.getElementById('resBody').textContent = body;
  document.getElementById('nextBtn').style.display = won && level < TOTAL - 1 ? '' : 'none';
  document.getElementById('result').classList.remove('hidden');
}

function complete() {
  state = 'complete';
  markDone(level);
  const s0 = P[0].score, s1 = P[1].score;
  const acc = i => Math.round(P[i].caught / Math.max(1, P[i].caught + P[i].missed) * 100);
  showResult('LEVEL ' + (level + 1) + ' CLEARED!',
    'Player 1: ' + s0 + ' pts  (' + acc(0) + '% caught, best combo ' + P[0].best + ')\n' +
    'Player 2: ' + s1 + ' pts  (' + acc(1) + '% caught, best combo ' + P[1].best + ')\n' +
    (s0 === s1 ? 'A tie!' : 'Player ' + (s0 > s1 ? 1 : 2) + ' takes the bonus!'), true);
}

// ============================================================
// Update
// ============================================================
function update() {
  for (let i = pops.length - 1; i >= 0; i--) { pops[i].y -= 0.8; if (--pops[i].life <= 0) pops.splice(i, 1); }
  if (state === 'ready') {
    if (--timer <= 0) state = 'playing';
    return;
  }
  if (state !== 'playing') return;
  frame++;
  let allDone = true;
  for (let pi = 0; pi < 2; pi++) {
    const p = P[pi], q = cur.queue[pi];
    for (let l = 0; l < 4; l++) if (p.flash[l] > 0) p.flash[l]--;
    while (p.idx < q.length && q[p.idx].spawn <= frame) {
      const a = q[p.idx++];
      p.active.push({ lane: a.lane, y: -AR_H, vy: a.spd });
    }
    for (let i = p.active.length - 1; i >= 0; i--) {
      const a = p.active[i];
      a.y += a.vy;
      if (a.y > BUCKET_BOT) {
        p.active.splice(i, 1);
        p.lives--; p.combo = 0; p.missed++;
        popup(pi, a.lane, 'MISS', '#f55');
        if (p.lives <= 0 && !failInfo) failInfo = { pi, lane: a.lane, why: 'missed an arrow' };
      }
    }
    if (p.idx < q.length || p.active.length) allDone = false;
  }
  checkFail();
  if (state === 'playing' && allDone) complete();
}

// ============================================================
// Draw
// ============================================================
function drawArrow(cx, y, col, label) {
  const x = cx - 22;
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x + 8, y); ctx.lineTo(x + 36, y); ctx.quadraticCurveTo(x + 44, y, x + 44, y + 8);
  ctx.lineTo(x + 44, y + AR_H - 8); ctx.quadraticCurveTo(x + 44, y + AR_H, x + 36, y + AR_H);
  ctx.lineTo(x + 8, y + AR_H); ctx.quadraticCurveTo(x, y + AR_H, x, y + AR_H - 8);
  ctx.lineTo(x, y + 8); ctx.quadraticCurveTo(x, y, x + 8, y);
  ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(label, cx, y + 34);
}

function drawBucket(pi, lane) {
  const p = P[pi], cx = AREA_X[pi] + lane * LANE_W + LANE_W / 2;
  const inside = p.active.some(a => a.lane === lane && a.y + AR_H >= BUCKET_TOP && a.y <= BUCKET_BOT);
  ctx.beginPath();
  ctx.moveTo(cx - 44, BUCKET_TOP); ctx.lineTo(cx + 44, BUCKET_TOP);
  ctx.lineTo(cx + 34, BUCKET_BOT); ctx.lineTo(cx - 34, BUCKET_BOT);
  ctx.closePath();
  ctx.fillStyle = p.flash[lane] > 0 ? LANE_COL[lane] : '#2b2f45';
  ctx.fill();
  ctx.strokeStyle = LANE_COL[lane]; ctx.lineWidth = inside ? 6 : 3; ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(LABELS[pi][lane], cx, BUCKET_TOP + 50);
}

function drawHearts(x, y, n, total, align) {
  ctx.font = '18px sans-serif'; ctx.textAlign = align;
  let s = '';
  for (let i = 0; i < total; i++) s += i < n ? '♥' : '♡';
  ctx.fillStyle = '#ff5b7a';
  ctx.fillText(s, x, y);
}

function draw() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a2550'); g.addColorStop(1, '#0a0b18');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff55';
  for (const s of stars) ctx.fillRect(s.x, s.y, s.r, s.r);
  if (!cur) return;

  for (let pi = 0; pi < 2; pi++) {
    const p = P[pi];
    for (let l = 0; l < 4; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(AREA_X[pi] + l * LANE_W + 6, 0, LANE_W - 12, H);
      ctx.fillStyle = LANE_COL[l] + '22';
      ctx.fillRect(AREA_X[pi] + l * LANE_W + 6, BUCKET_TOP, LANE_W - 12, BUCKET_BOT - BUCKET_TOP);
    }
    for (const a of p.active) drawArrow(AREA_X[pi] + a.lane * LANE_W + LANE_W / 2, a.y, LANE_COL[a.lane], LABELS[pi][a.lane]);
    for (let l = 0; l < 4; l++) drawBucket(pi, l);

    const x0 = AREA_X[pi], xr = x0 + 4 * LANE_W;
    ctx.textAlign = 'left'; ctx.fillStyle = P_COL[pi]; ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PLAYER ' + (pi + 1), x0, 30);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(String(p.score), xr, 30);
    drawHearts(x0, 54, p.lives, cur.pr.lives, 'left');
    if (p.combo > 1) {
      ctx.fillStyle = '#ffd700'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'right';
      ctx.fillText(p.combo + ' combo', xr, 52);
    }
  }

  ctx.fillStyle = '#333a55'; ctx.fillRect(W / 2 - 1, 0, 2, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif';
  ctx.fillText('LEVEL ' + (level + 1), W / 2, 24);
  ctx.fillStyle = '#ffffffaa'; ctx.font = '11px sans-serif';
  ctx.fillText(GIMMICKS[cur.pr.gimmick], W / 2, 40);
  const total = cur.queue[0].length + cur.queue[1].length;
  const left = cur.queue.reduce((s, q, i) => s + (q.length - P[i].idx) + P[i].active.length, 0);
  ctx.fillStyle = '#ffffff22'; ctx.fillRect(W / 2 - 40, 50, 80, 6);
  ctx.fillStyle = '#5be08a'; ctx.fillRect(W / 2 - 40, 50, 80 * (1 - left / total), 6);

  ctx.font = 'bold 16px sans-serif';
  for (const q of pops) {
    ctx.globalAlpha = Math.min(1, q.life / 20);
    ctx.fillStyle = q.col; ctx.fillText(q.text, q.x, q.y);
  }
  ctx.globalAlpha = 1;

  if (state === 'failed' && failInfo) {
    const x0 = AREA_X[failInfo.pi];
    ctx.fillStyle = 'rgba(255,40,60,0.28)'; ctx.fillRect(x0 - 20, 0, 4 * LANE_W + 40, H);
    if (failInfo.lane >= 0) {
      ctx.strokeStyle = '#ff3050'; ctx.lineWidth = 6;
      ctx.strokeRect(x0 + failInfo.lane * LANE_W + 6, 0, LANE_W - 12, H);
    }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PLAYER ' + (failInfo.pi + 1), x0 + 2 * LANE_W, 200);
    ctx.fillStyle = '#ff5060'; ctx.fillText('MISTAKE!', x0 + 2 * LANE_W, 245);
  }
  if (state === 'ready') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
    const n = Math.ceil(timer / 50);
    ctx.fillText(n > 0 ? String(n) : 'GO!', W / 2, 260);
  }
}

// ============================================================
// Input + menu
// ============================================================
window.addEventListener('keydown', e => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'Escape' && state !== 'menu') { showMenu(); return; }
  if (state !== 'playing') return;
  for (let pi = 0; pi < 2; pi++) {
    const lane = KEYS[pi].indexOf(e.code);
    if (lane >= 0) pressLane(pi, lane);
  }
});

function buildMenu() {
  const done = loadDone();
  document.getElementById('sub').textContent = TOTAL + ' levels, all unlocked - ' + done.size + ' cleared';
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  for (let i = 0; i < TOTAL; i++) {
    const b = document.createElement('button');
    b.textContent = String(i + 1);
    if (done.has(i)) b.classList.add('done');
    b.addEventListener('click', () => startLevel(i));
    grid.appendChild(b);
  }
}

document.getElementById('nextBtn').addEventListener('click', () => startLevel(Math.min(TOTAL - 1, level + 1)));
document.getElementById('retryBtn').addEventListener('click', () => startLevel(level));
document.getElementById('menuBtn').addEventListener('click', showMenu);

buildMenu();
let last = performance.now(), acc = 0;
function frameLoop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);
