'use strict';

var cv = document.getElementById('game');
var ctx = cv.getContext('2d');
var W = 960, H = 540, PH = 270;
var SC = 0.65;
var VIEW_W = W / SC, VIEW_H = PH / SC;
var TOTAL = Bike.TOTAL;
var STORE = 'trailriders_unlocked', DONE_STORE = 'trailriders_done';

var KEYS = [
  { heavy: ['KeyW', 'KeyS'], left: 'KeyA', right: 'KeyD', tricks: ['KeyZ', 'KeyX', 'KeyC', 'KeyV'], labels: ['Z', 'X', 'C', 'V'] },
  { heavy: ['ArrowUp', 'ArrowDown'], left: 'ArrowLeft', right: 'ArrowRight', tricks: ['Slash', 'Period', 'Comma', 'KeyM'], labels: ['/', '.', ',', 'M'] },
];
var COL = ['#4ad0ff', '#ff5b7a'];
var THEMES = [
  { sky: ['#5aa8e8', '#d4efff'], dirt: '#6b4a2f', grass: '#4caf50' },
  { sky: ['#e8955a', '#ffe6c0'], dirt: '#8a5a34', grass: '#c9a227' },
  { sky: ['#3a4a7a', '#9db4e0'], dirt: '#3b3f52', grass: '#7a9ab0' },
  { sky: ['#4a2a6a', '#e0a0d8'], dirt: '#4a3350', grass: '#b06ad0' },
  { sky: ['#2a6a5a', '#b8f0d8'], dirt: '#3c5a3c', grass: '#6adf8a' },
  { sky: ['#7a2a2a', '#ffb090'], dirt: '#5a3028', grass: '#e0703a' },
  { sky: ['#1a2a4a', '#5a7ab0'], dirt: '#2c3a52', grass: '#4a8ac0' },
  { sky: ['#8ab0c0', '#f0f8ff'], dirt: '#7a7a86', grass: '#f0f4ff' },
];

var state = 'menu'; // menu | ready | playing | complete
var level = 0, lv = null, theme = THEMES[0], frame = 0, timer = 0;
var S = [];
var keys = {};

function loadUnlocked() {
  try { return Math.min(TOTAL - 1, parseInt(localStorage.getItem(STORE) || '0', 10) || 0); } catch (e) { return 0; }
}
function saveUnlocked(v) {
  try { if (v > loadUnlocked()) localStorage.setItem(STORE, String(v)); } catch (e) { /* ignore */ }
}
function loadDone() {
  try { return JSON.parse(localStorage.getItem(DONE_STORE) || '[]'); } catch (e) { return []; }
}
function saveDone(i) {
  try {
    var d = loadDone();
    if (d.indexOf(i) < 0) { d.push(i); localStorage.setItem(DONE_STORE, JSON.stringify(d)); }
  } catch (e) { /* ignore */ }
}

// ============================================================
// Flow
// ============================================================
function startLevel(idx) {
  level = idx;
  lv = Bike.buildLevel(idx);
  theme = THEMES[idx % THEMES.length];
  frame = 0; timer = 150;
  S = [0, 1].map(function () {
    var r = Bike.newRider(lv);
    return { r: r, camY: r.y - VIEW_H * 0.5, crashT: 0, popups: [], finishFrame: 0, crashes: 0 };
  });
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

function fmtTime(f) { return (f / 60).toFixed(1) + 's'; }

function completeLevel() {
  state = 'complete';
  saveDone(level);
  if (level + 1 < TOTAL) saveUnlocked(level + 1);
  var f0 = S[0].finishFrame, f1 = S[1].finishFrame;
  var lines = [];
  for (var i = 0; i < 2; i++) {
    lines.push('Player ' + (i + 1) + ':  ' + fmtTime(S[i].finishFrame) + '   tricks ' + S[i].r.score + ' pts   crashes ' + S[i].crashes);
  }
  var winner = f0 === f1 ? 'A tie!' : 'Player ' + (f0 < f1 ? 1 : 2) + ' finished first!';
  var best = S[0].r.score === S[1].r.score ? '' : '\nPlayer ' + (S[0].r.score > S[1].r.score ? 1 : 2) + ' has the best tricks!';
  var last = level + 1 >= TOTAL;
  document.getElementById('resTitle').textContent = last ? 'YOU BEAT ALL 100 LEVELS!' : 'LEVEL ' + (level + 1) + ' COMPLETE!';
  document.getElementById('resBody').textContent = lines.join('\n') + '\n' + winner + best + '';
  document.getElementById('nextBtn').style.display = last ? 'none' : '';
  document.getElementById('result').classList.remove('hidden');
}

function popup(pi, text, col) {
  var r = S[pi].r;
  S[pi].popups.push({ text: text, x: r.x, y: r.y - 80, life: 70, col: col });
}

function inputFor(pi) {
  var k = KEYS[pi];
  return { heavy: !!(keys[k.heavy[0]] || keys[k.heavy[1]]), left: !!keys[k.left], right: !!keys[k.right] };
}

function update() {
  if (state === 'menu' || state === 'complete') return;
  if (state === 'ready') { if (--timer <= 0) state = 'playing'; return; }
  frame++;
  for (var pi = 0; pi < 2; pi++) {
    var st = S[pi], r = st.r;
    if (r.state === 'ride') Bike.stepRider(lv, r, inputFor(pi));
    for (var e = 0; e < r.events.length; e++) {
      var ev = r.events[e];
      if (ev.type === 'crash') { st.crashes++; st.crashT = 0; }
      else if (ev.type === 'finish') { st.finishFrame = frame; popup(pi, 'FINISHED!', '#ffd700'); }
      else popup(pi, ev.text, '#ffd54a');
    }
    r.events.length = 0;
    if (r.state === 'crashed') {
      st.crashT++;
      if (st.crashT > 75) {
        var nr = Bike.newRider(lv);
        nr.score = r.score; nr.deaths = r.deaths + 1;
        st.r = nr; st.crashT = 0; st.camY = nr.y - VIEW_H * 0.5;
        popup(pi, 'New tricks!', '#fff');
      }
    }
    for (var i = st.popups.length - 1; i >= 0; i--) { st.popups[i].y -= 0.7; if (--st.popups[i].life <= 0) st.popups.splice(i, 1); }
    var lead = st.r.onGround ? 0 : Math.max(-130, Math.min(130, st.r.vy * 8));
    st.camY += (st.r.y - VIEW_H * 0.5 + lead - st.camY) * 0.3;
  }
  if (S[0].r.state === 'done' && S[1].r.state === 'done') completeLevel();
}

// ============================================================
// Drawing
// ============================================================
function poseOf(p) {
  var pose = {};
  if (!p.trick) return pose;
  var d = p.trick.def, u = p.trick.t / d.d, s = Math.sin(Math.PI * u);
  if (d.k === 'body') {
    var big = /Superman|Rocket|Christ|Cliff/.test(d.n);
    pose.lean = s * (big ? 1.3 : 0.7);
    pose.noHands = /Hander|Superman|Christ|Cliff|Rocket/.test(d.n);
    pose.superLegs = /Superman|Rocket/.test(d.n) ? s : 0;
  } else if (d.k === 'legs') pose.legSwing = s;
  else if (d.k === 'bar') pose.barAng = u * Math.PI * 2 * (/Double/.test(d.n) ? 2 : 1);
  else if (d.k === 'frame') pose.frameAng = /Tabletop|Turndown|Wheel/.test(d.n) ? s * 1.4 : u * Math.PI * 2;
  else if (d.k === 'spin') {
    var sx = Math.cos(u * Math.PI * 2 * (/360/.test(d.n) ? 1 : 0.5));
    pose.spinX = Math.abs(sx) < 0.15 ? (sx < 0 ? -0.15 : 0.15) : sx;
  }
  return pose;
}

function line(x1, y1, x2, y2, w, col) {
  ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function wheel(x, y, rot) {
  ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#8a8a99'; ctx.lineWidth = 1;
  for (var k = 0; k < 3; k++) {
    var a = rot + k * Math.PI / 3;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 10, y - Math.sin(a) * 10); ctx.lineTo(x + Math.cos(a) * 10, y + Math.sin(a) * 10); ctx.stroke();
  }
}

function drawBike(p, col, alpha) {
  var pose = poseOf(p);
  ctx.save();
  ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (pose.spinX !== undefined) ctx.scale(pose.spinX, 1);
  var wr = p.x / 11;

  ctx.save();
  if (pose.frameAng) { ctx.translate(18, -12); ctx.rotate(pose.frameAng); ctx.translate(-18, 12); }
  wheel(-18, -12, wr);
  line(-18, -12, 0, -16, 3, '#333');
  line(0, -16, -8, -34, 3, '#333');
  line(-8, -34, -18, -12, 3, '#333');
  line(0, -16, 14, -30, 3, '#333');
  line(-8, -34, 14, -30, 3, '#333');
  line(-11, -35, -3, -35, 4, '#222');
  ctx.restore();

  if (p.boostT > 0) {
    ctx.globalAlpha = (alpha === undefined ? 1 : alpha) * Math.min(1, p.boostT / 20);
    for (var b = 0; b < 4; b++) line(-34 - b * 6, -34 + b * 8, -70 - b * 14, -34 + b * 8, 4 - b * 0.6, b % 2 ? '#ffd54a' : '#ff7a20');
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
  }
  wheel(18, -12, wr);
  line(14, -30, 18, -12, 3, '#333');
  var ba = pose.barAng || 0;
  line(14 + Math.cos(ba) * 9, -32 - Math.sin(ba) * 3, 14 - Math.cos(ba) * 9, -32 + Math.sin(ba) * 3, 3, '#222');

  var hip = [-6, -37], sh = [2, -58];
  var la = pose.lean || 0;
  var dx = sh[0] - hip[0], dy = sh[1] - hip[1], c = Math.cos(-la), s = Math.sin(-la);
  sh = [hip[0] + dx * c - dy * s, hip[1] + dx * s + dy * c];
  var tl = Math.hypot(dx, dy);
  var head = [sh[0] + (sh[0] - hip[0]) / tl * 11, sh[1] + (sh[1] - hip[1]) / tl * 11];

  var foot = [0, -16], knee = [6, -28];
  if (pose.legSwing) { foot = [pose.legSwing * 22, -16 - pose.legSwing * 22]; knee = [(hip[0] + foot[0]) / 2 + 5, (hip[1] + foot[1]) / 2 - 3]; }
  if (pose.superLegs) {
    foot = [foot[0] + (-36 - foot[0]) * pose.superLegs, foot[1] + (-44 - foot[1]) * pose.superLegs];
    knee = [(hip[0] + foot[0]) / 2, (hip[1] + foot[1]) / 2];
  }
  line(hip[0], hip[1], knee[0], knee[1], 5, '#223');
  line(knee[0], knee[1], foot[0], foot[1], 5, '#223');
  line(hip[0], hip[1], sh[0], sh[1], 8, col);
  if (pose.noHands) { line(sh[0], sh[1], sh[0] + 12, sh[1] - 6, 4, '#f2c9a0'); line(sh[0], sh[1], sh[0] - 12, sh[1] - 6, 4, '#f2c9a0'); }
  else line(sh[0], sh[1], 15, -34, 4, '#f2c9a0');
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(head[0], head[1], 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(head[0], head[1] - 1, 7.5, Math.PI, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTerrain(camX, camY) {
  var i0 = Math.max(0, Math.floor(camX / Bike.DX) - 2), i1 = Math.min(lv.ys.length - 1, Math.ceil((camX + VIEW_W) / Bike.DX) + 2);
  var bottom = camY + VIEW_H + 80;
  var i = i0;
  while (i <= i1) {
    if (lv.ys[i] >= Bike.PIT) { i++; continue; }
    var start = i;
    while (i <= i1 && lv.ys[i] < Bike.PIT) i++;
    var end = i - 1;
    ctx.beginPath();
    ctx.moveTo(start * Bike.DX, bottom);
    for (var k = start; k <= end; k++) ctx.lineTo(k * Bike.DX, lv.ys[k]);
    ctx.lineTo(end * Bike.DX, bottom);
    ctx.closePath();
    ctx.fillStyle = theme.dirt; ctx.fill();
    ctx.beginPath();
    for (var m = start; m <= end; m++) { if (m === start) ctx.moveTo(m * Bike.DX, lv.ys[m]); else ctx.lineTo(m * Bike.DX, lv.ys[m]); }
    ctx.strokeStyle = theme.grass; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.stroke();
  }
}

function drawRamps(camX) {
  for (var i = 0; i < lv.ramps.length; i++) {
    var rp = lv.ramps[i];
    if (rp.x1 < camX - 50 || rp.x0 > camX + VIEW_W + 50) continue;
    ctx.beginPath();
    var first = true;
    for (var x = rp.x0; x <= rp.x1; x += Bike.DX) {
      var yy = lv.ys[Math.round(x / Bike.DX)];
      if (first) { ctx.moveTo(x, yy - 3); first = false; } else ctx.lineTo(x, yy - 3);
    }
    ctx.strokeStyle = '#ff9a20'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke();
    ctx.strokeStyle = '#fff3c0'; ctx.lineWidth = 2; ctx.stroke();
    var ly = lv.ys[Math.round(rp.x1 / Bike.DX)];
    ctx.textAlign = 'center'; ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = rp.label === 'CLIMB!' ? '#40e070' : (rp.label === 'DROP!' ? '#ffd54a' : '#ff3030');
    ctx.fillText(rp.label || 'JUMP!', rp.x1 - 30, ly - 46);
    if (rp.pit) {
      for (var k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#fff' : '#e02020'; ctx.fillRect(rp.x1 - 2, ly - 30 + k * 10, 8, 10); }
    }
  }
}

function drawFlag() {
  var fy = Bike.groundY(lv, lv.finishX);
  line(lv.finishX, fy, lv.finishX, fy - 90, 4, '#eee');
  for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
    ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff';
    ctx.fillRect(lv.finishX + c * 10, fy - 90 + r * 10, 10, 10);
  }
  var sy = Bike.groundY(lv, Bike.START_X - 100);
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('START', Bike.START_X - 100, sy - 20);
}

function drawPanel(pi) {
  var st = S[pi], r = st.r, y0 = pi * PH;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, y0, W, PH); ctx.clip();
  var g = ctx.createLinearGradient(0, y0, 0, y0 + PH);
  g.addColorStop(0, theme.sky[0]); g.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, PH);

  ctx.save();
  ctx.translate(0, y0);
  ctx.scale(SC, SC);
  ctx.translate(-r.camX, -st.camY);
  drawTerrain(r.camX, st.camY);
  drawRamps(r.camX);
  drawFlag();
  if (r.state === 'crashed') {
    var t = st.crashT;
    var cr = { x: r.x + t * 1.5 * Math.sign(r.vx || 1), y: r.y - 10 + t * 2 + 0.05 * t * t, angle: r.angle + t * 0.25, trick: null };
    drawBike(cr, COL[pi], Math.max(0, 1 - t / 75));
  } else {
    drawBike(r, COL[pi], 1);
  }
  ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
  for (var i = 0; i < st.popups.length; i++) {
    var pp = st.popups[i];
    ctx.globalAlpha = Math.min(1, pp.life / 25);
    ctx.fillStyle = pp.col; ctx.fillText(pp.text, pp.x, pp.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // HUD (panel coordinates)
  ctx.textAlign = 'left'; ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = COL[pi]; ctx.fillText('PLAYER ' + (pi + 1), 12, y0 + 22);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Tricks: ' + r.score + (r.combo > 1 ? '   combo x' + r.combo : ''), 12, y0 + 40);
  ctx.textAlign = 'right';
  ctx.fillText('Level ' + (level + 1) + ' - ' + lv.styleName + '   ' + fmtTime(r.state === 'done' ? st.finishFrame : frame), W - 12, y0 + 22);
  ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '12px sans-serif';
  ctx.fillText('Crashes: ' + st.crashes, W - 12, y0 + 40);

  // weight meter
  ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(12, y0 + 48, 110, 10);
  ctx.fillStyle = r.hv > 0.5 ? '#e05030' : '#f0c040'; ctx.fillRect(12, y0 + 48, 110 * r.hv, 10);
  ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.fillText('HEAVY', 128, y0 + 57);

  // trick chips
  var kl = KEYS[pi].labels;
  for (var k = 0; k < 4; k++) {
    var td = r.tricks[k], cx = 12 + k * 232, cy = y0 + PH - 30;
    var active = r.trick && r.trick.def === td;
    ctx.fillStyle = active ? '#ffd54a' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx, cy, 222, 24);
    if (active) { ctx.fillStyle = '#ff9a20'; ctx.fillRect(cx, cy, 222 * (r.trick.t / td.d), 24); }
    ctx.textAlign = 'left'; ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = active ? '#000' : COL[pi]; ctx.fillText('[' + kl[k] + ']', cx + 6, cy + 17);
    ctx.fillStyle = active ? '#000' : '#fff'; ctx.font = '12px sans-serif';
    ctx.fillText(td.n + '  ' + (td.d / 60).toFixed(1) + 's', cx + 34, cy + 17);
  }

  ctx.textAlign = 'center';
  if (r.state === 'crashed') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, y0 + 70, W, 60);
    ctx.fillStyle = '#ff5050'; ctx.font = 'bold 26px sans-serif'; ctx.fillText('CRASH! ' + r.reason, W / 2, y0 + 108);
    ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText('Restarting with new tricks...', W / 2, y0 + 126);
  } else if (r.state === 'done') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, y0 + 80, W, 50);
    ctx.fillStyle = '#ffd700'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText('FINISHED in ' + fmtTime(st.finishFrame) + (S[1 - pi].r.state === 'done' ? '' : ' - waiting for the other rider'), W / 2, y0 + 113);
  }
  if (state === 'ready') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 60px sans-serif';
    var n = Math.ceil(timer / 50);
    ctx.fillText(n > 0 ? String(n) : 'GO!', W / 2, y0 + 150);
  }
  ctx.restore();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#12121c'; ctx.fillRect(0, 0, W, H);
  if (!lv) return;
  drawPanel(0);
  drawPanel(1);
  ctx.fillStyle = '#000'; ctx.fillRect(0, PH - 2, W, 4);
}

// ============================================================
// Input + menu
// ============================================================
window.addEventListener('keydown', function (e) {
  if (e.code.indexOf('Arrow') === 0 || e.code === 'Space' || e.code === 'Slash' || e.code === 'Comma' || e.code === 'Period') e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'Escape' && state !== 'menu') { showMenu(); return; }
  if (e.repeat || state !== 'playing') return;
  for (var pi = 0; pi < 2; pi++) {
    var slot = KEYS[pi].tricks.indexOf(e.code);
    if (slot >= 0) Bike.startTrick(S[pi].r, slot);
  }
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () { keys = {}; });

function buildMenu() {
  var unlocked = loadUnlocked(), done = loadDone();
  document.getElementById('sub').textContent = TOTAL + ' levels - all unlocked, pick any (' + done.length + ' beaten)';
  var grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  for (var i = 0; i < TOTAL; i++) {
    (function (i) {
      var b = document.createElement('button');
      b.textContent = String(i + 1);
      if (done.indexOf(i) >= 0) b.classList.add('done');
      b.addEventListener('click', function () { startLevel(i); });
      grid.appendChild(b);
    })(i);
  }
}

document.getElementById('nextBtn').addEventListener('click', function () { startLevel(Math.min(TOTAL - 1, level + 1)); });
document.getElementById('replayBtn').addEventListener('click', function () { startLevel(level); });
document.getElementById('menuBtn').addEventListener('click', showMenu);

buildMenu();
var last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
