'use strict';

var cv = document.getElementById('game');
var ctx = cv.getContext('2d');
var W = 960, H = 540;

// ============================================================
// 3D world + camera
// ============================================================
// Regulation table tennis proportions: 274cm x 152.5cm table, net 15.25cm high.
var TABLE_L = 560;              // table length (Z: 0 .. TABLE_L)
var TABLE_W = Math.round(TABLE_L * 152.5 / 274); // real length:width ratio
var TABLE_Y = 0;                // table surface height
var NET_Z = TABLE_L / 2, NET_H = TABLE_W * (15.25 / 152.5); // real net:width ratio
var P_Z = [TABLE_L - 26, 26];   // player 1 (near/bottom), player 2 (far/top) paddle depth
var PADDLE_HALF_W = Math.round(34 * TABLE_W / 260), PADDLE_SPEED = 6.2;
var BALL_R = 7;

var CAM = { x: 0, y: 190, z: TABLE_L + 300, theta: 0.36, focal: 560 };

function project(x, y, z) {
  var rx = x - CAM.x, ry = y - CAM.y, rz = CAM.z - z;
  var ct = Math.cos(CAM.theta), st = Math.sin(CAM.theta);
  var y2 = ry * ct - rz * st;
  var z2 = ry * st + rz * ct;
  if (z2 < 20) return null;
  var scale = CAM.focal / z2;
  return { x: W / 2 + rx * scale, y: H * 0.42 - y2 * scale, scale: scale, z2: z2 };
}

// ============================================================
// Game constants
// ============================================================
var GRAV = 0.62;
var BALL_SPEED0 = 8.6, BALL_SPEED_MAX = 17.5, SPEED_UP = 0.45;
var BOUNCE_DAMP = 0.8;
var WIN_AT = 11;
var COL = ['#4ad0ff', '#ff5b7a'];
var PX = [0, 0]; // paddle X positions

var state = 'menu'; // menu | ready | playing | pause | over
var scores = [0, 0];
var ball = null;
var timer = 0, rally = 0, lastWinner = 0, msg = '';
var bounceSinceHit = 0, bounceSideSinceHit = -1; // real table-tennis rule: must bounce once on your side before you return it
var particles = [];
var trail = [];
var shake = 0;
var keys = {};
var hitFlash = [0, 0];
var swing = [0, 0];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function resetPaddles() { PX[0] = 0; PX[1] = 0; }

function serve(side) {
  var dir = side === 0 ? -1 : 1; // ball travels toward the OTHER player first (loser serves feel)
  ball = {
    x: 0, y: 120, z: TABLE_L / 2,
    vx: (Math.random() - 0.5) * 3,
    vy: -2,
    vz: dir * BALL_SPEED0 * 0.95,
    speed: BALL_SPEED0,
    bounced: false,
  };
  rally = 0;
  trail.length = 0;
  bounceSinceHit = 0; bounceSideSinceHit = -1;
}

function newMatch() {
  scores = [0, 0];
  resetPaddles();
  particles = [];
  serve(Math.random() < 0.5 ? 0 : 1);
  state = 'ready';
  timer = 80;
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('over').classList.add('hidden');
}

function showMenu() {
  state = 'menu';
  document.getElementById('over').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}

function burst3(x, y, z, n, col) {
  for (var i = 0; i < n; i++) {
    var a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
    particles.push({
      x: x, y: y, z: z,
      vx: Math.cos(a) * s, vy: Math.random() * 3 + 1, vz: Math.sin(a) * s,
      life: 16 + Math.random() * 14, col: col,
    });
  }
}

function pointFor(winner, customMsg) {
  scores[winner]++;
  lastWinner = winner;
  burst3(ball.x, Math.max(ball.y, 0), ball.z, 24, COL[winner]);
  shake = 7;
  var lead = Math.abs(scores[0] - scores[1]);
  if (scores[winner] >= WIN_AT && lead >= 2) {
    state = 'over';
    document.getElementById('overTitle').textContent = 'PLAYER ' + (winner + 1) + ' WINS!';
    document.getElementById('overScore').textContent = scores[0] + '  -  ' + scores[1];
    document.getElementById('over').classList.remove('hidden');
    return;
  }
  msg = customMsg || ('Point for Player ' + (winner + 1) + '!');
  state = 'pause';
  timer = 65;
}

function attemptHit(i) {
  var b = ball;
  var dir = i === 0 ? -1 : 1; // ball must be heading toward this player's end
  var vzToward = i === 0 ? b.vz > 0 : b.vz < 0;
  if (!vzToward) return false;
  var pz = P_Z[i];
  var crossed = i === 0 ? b.z >= pz - 10 && b.z <= TABLE_L + 20 : b.z <= pz + 10 && b.z >= -20;
  if (!crossed) return false;
  if (Math.abs(b.x - PX[i]) > PADDLE_HALF_W + BALL_R) return false;
  if (b.y < -10 || b.y > 130) return false;

  // real rule: you may only return the ball after it has bounced once on your own side
  if (!(bounceSinceHit >= 1 && bounceSideSinceHit === i)) {
    pointFor(1 - i, 'FAULT! Player ' + (i + 1) + ' volleyed before the bounce');
    return true;
  }

  rally++;
  b.speed = Math.min(BALL_SPEED_MAX, b.speed + SPEED_UP);
  var relX = clamp((b.x - PX[i]) / PADDLE_HALF_W, -1, 1);
  var forward = i === 0 ? -1 : 1;
  var ang = relX * 0.55;
  b.vz = forward * b.speed * Math.cos(ang);
  b.vx = b.speed * Math.sin(ang) + swing[i] * 3;
  b.vy = 11 + Math.min(rally, 10) * 0.2 + Math.random() * 1.5;
  b.z = pz + (i === 0 ? -8 : 8);
  b.bounced = false;
  bounceSinceHit = 0; bounceSideSinceHit = -1;
  hitFlash[i] = 8;
  burst3(b.x, b.y, b.z, 10, COL[i]);
  return true;
}

function updateBall() {
  var b = ball;
  b.vy -= GRAV;
  b.x += b.vx; b.y += b.vy; b.z += b.vz;
  trail.push({ x: b.x, y: b.y, z: b.z });
  if (trail.length > 12) trail.shift();

  if (b.x < -TABLE_W / 2 + BALL_R) { b.x = -TABLE_W / 2 + BALL_R; b.vx = Math.abs(b.vx) * 0.7; }
  if (b.x > TABLE_W / 2 - BALL_R) { b.x = TABLE_W / 2 - BALL_R; b.vx = -Math.abs(b.vx) * 0.7; }

  // net
  var wasSide = b.z - b.vz < NET_Z ? -1 : 1;
  var nowSide = b.z < NET_Z ? -1 : 1;
  if (wasSide !== nowSide && b.y < NET_H + BALL_R) {
    b.vz *= -0.35; b.vx *= 0.6;
    b.z = NET_Z + nowSide * -1 * 2;
    burst3(b.x, b.y, NET_Z, 6, '#fff');
  }

  // table bounce
  if (b.y - BALL_R <= TABLE_Y && b.vy < 0) {
    b.y = TABLE_Y + BALL_R;
    b.vy = -b.vy * BOUNCE_DAMP;
    b.bounced = true;
    burst3(b.x, TABLE_Y, b.z, 5, '#fff');

    var half = b.z < NET_Z ? 1 : 0;
    if (half === bounceSideSinceHit) {
      // real rule: a second bounce on the same side without a return loses the point
      pointFor(1 - half, 'FAULT! Player ' + (half + 1) + ' let it bounce twice');
      return;
    }
    bounceSinceHit = 1; bounceSideSinceHit = half;
  }

  attemptHit(0);
  attemptHit(1);

  if (b.z < -30) { pointFor(0); return; }
  if (b.z > TABLE_L + 30) { pointFor(1); return; }
  if (b.y < -160) { pointFor(b.z < NET_Z ? 0 : 1); return; }
}

function update() {
  for (var i = particles.length - 1; i >= 0; i--) {
    var q = particles[i];
    q.x += q.vx; q.y += q.vy; q.z += q.vz; q.vy -= 0.2;
    if (--q.life <= 0) particles.splice(i, 1);
  }
  if (shake > 0) shake--;
  hitFlash[0] = Math.max(0, hitFlash[0] - 1);
  hitFlash[1] = Math.max(0, hitFlash[1] - 1);

  if (state === 'menu' || state === 'over') return;

  // W/S and Up/Down move the paddle sideways, matching the original 2D scheme
  var up0 = !!keys['KeyW'], down0 = !!keys['KeyS'];
  var up1 = !!keys['ArrowUp'], down1 = !!keys['ArrowDown'];
  var v0 = (down0 ? PADDLE_SPEED : 0) - (up0 ? PADDLE_SPEED : 0);
  var v1 = (down1 ? PADDLE_SPEED : 0) - (up1 ? PADDLE_SPEED : 0);
  PX[0] = clamp(PX[0] + v0, -TABLE_W / 2 + 10, TABLE_W / 2 - 10);
  PX[1] = clamp(PX[1] + v1, -TABLE_W / 2 + 10, TABLE_W / 2 - 10);
  if (v0) swing[0] = Math.sign(v0) * -1;
  if (v1) swing[1] = Math.sign(v1) * -1;
  swing[0] *= 0.85; swing[1] *= 0.85;

  if (state === 'ready') { if (--timer <= 0) state = 'playing'; return; }
  if (state === 'pause') { if (--timer <= 0) { serve(lastWinner); state = 'playing'; } return; }
  if (state === 'playing') updateBall();
}

// ============================================================
// Draw
// ============================================================
function poly(pts, fill, stroke) {
  for (var k = 0; k < pts.length; k++) if (!pts[k]) return;
  ctx.beginPath();
  for (var i = 0; i < pts.length; i++) { if (i === 0) ctx.moveTo(pts[i].x, pts[i].y); else ctx.lineTo(pts[i].x, pts[i].y); }
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
}

function drawTable() {
  var bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a1626'); bg.addColorStop(1, '#050a12');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  var corners = [
    project(-TABLE_W / 2, TABLE_Y, 0), project(TABLE_W / 2, TABLE_Y, 0),
    project(TABLE_W / 2, TABLE_Y, TABLE_L), project(-TABLE_W / 2, TABLE_Y, TABLE_L),
  ];
  poly(corners, '#0f4a7a', 'rgba(255,255,255,0.5)');

  // floor beyond table
  var floor = [
    project(-800, TABLE_Y - 1, -500), project(800, TABLE_Y - 1, -500),
    project(800, TABLE_Y - 1, TABLE_L + 240), project(-800, TABLE_Y - 1, TABLE_L + 240),
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  poly(floor, '#12181f', null);
  ctx.restore();

  // center line (length-wise) + end lines
  var c1 = project(0, TABLE_Y + 0.5, 0), c2 = project(0, TABLE_Y + 0.5, TABLE_L);
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();

  // net
  var n1 = project(-TABLE_W / 2 - 8, TABLE_Y, NET_Z), n2 = project(TABLE_W / 2 + 8, TABLE_Y, NET_Z);
  var n3 = project(TABLE_W / 2 + 8, TABLE_Y + NET_H, NET_Z), n4 = project(-TABLE_W / 2 - 8, TABLE_Y + NET_H, NET_Z);
  ctx.fillStyle = 'rgba(230,235,245,0.55)';
  poly([n1, n2, n3, n4], 'rgba(230,235,245,0.55)', 'rgba(255,255,255,0.8)');
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 0.6;
  for (var gx = -TABLE_W / 2 - 8; gx <= TABLE_W / 2 + 8; gx += 14) {
    var a = project(gx, TABLE_Y, NET_Z), b = project(gx, TABLE_Y + NET_H, NET_Z);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // table legs (just visual)
  ctx.strokeStyle = '#1a1a22'; ctx.lineWidth = 4;
  [[-TABLE_W / 2 + 6, 24], [TABLE_W / 2 - 6, 24], [-TABLE_W / 2 + 6, TABLE_L - 24], [TABLE_W / 2 - 6, TABLE_L - 24]].forEach(function (p) {
    var top = project(p[0], TABLE_Y, p[1]), bot = project(p[0], TABLE_Y - 90, p[1]);
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(bot.x, bot.y); ctx.stroke();
  });
}

function drawPaddle(i) {
  var x = PX[i], z = P_Z[i], y = 34;
  var facing = i === 0 ? 1 : -1;
  var tilt = swing[i] * 0.5;
  var blade = 30, thick = 6;

  // handle
  var hTop = project(x - facing * 0 + tilt * 4, y - 14, z + facing * 6);
  var hBot = project(x + tilt * 10, y - 46, z + facing * 22);
  ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hTop.x, hTop.y); ctx.lineTo(hBot.x, hBot.y); ctx.stroke();
  ctx.strokeStyle = '#6a4526'; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(hTop.x, hTop.y); ctx.lineTo(hBot.x, hBot.y); ctx.stroke();

  // blade: an ellipse standing upright, offset toward the ball side
  var faceZ = z - facing * thick;
  var center = project(x + tilt * 3, y + blade * 0.55, faceZ);
  var top = project(x + tilt * 3, y + blade * 1.55, faceZ);
  var side = project(x + blade * 0.62 + tilt * 3, y + blade * 0.55, faceZ);
  if (!center || !top || !side) return;
  var ry = Math.hypot(top.x - center.x, top.y - center.y);
  var rx = Math.hypot(side.x - center.x, side.y - center.y);
  var ang = Math.atan2(top.y - center.y, top.x - center.x) + Math.PI / 2;

  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(ang);
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 1.12, ry * 1.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = hitFlash[i] > 0 ? '#fff' : '#1c1c22'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 0, rx * 0.92, ry * 0.92, 0, 0, Math.PI * 2);
  var g = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 1, 0, 0, ry);
  g.addColorStop(0, hitFlash[i] > 0 ? '#fff' : lighten(COL[i]));
  g.addColorStop(1, COL[i]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function lighten(hex) {
  var n = parseInt(hex.slice(1), 16);
  var r = Math.min(255, ((n >> 16) & 255) + 70), g2 = Math.min(255, ((n >> 8) & 255) + 70), b = Math.min(255, (n & 255) + 70);
  return 'rgb(' + r + ',' + g2 + ',' + b + ')';
}

function drawBallShadow() {
  if (!ball) return;
  var s = project(ball.x, TABLE_Y + 0.4, ball.z);
  if (!s) return;
  var k = clamp(1 - ball.y / 220, 0.15, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(s.x, s.y, 10 * s.scale * k, 4 * s.scale * k, 0, 0, Math.PI * 2); ctx.fill();
}

function drawBall() {
  if (!ball) return;
  var p = project(ball.x, ball.y, ball.z);
  if (!p) return;
  var r = Math.max(2, BALL_R * p.scale);
  ctx.fillStyle = '#fff8ea';
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

  drawTable();
  drawBallShadow();

  for (var t = 0; t < trail.length; t++) {
    var tp = project(trail[t].x, trail[t].y, trail[t].z);
    if (!tp) continue;
    ctx.globalAlpha = (t / trail.length) * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(tp.x, tp.y, Math.max(1, BALL_R * tp.scale * 0.6), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // paint order: far paddle, ball, near paddle (near player is lower on screen / closer to camera)
  drawPaddle(1);
  drawBall();
  for (var i = 0; i < particles.length; i++) {
    var q = particles[i], pp = project(q.x, Math.max(q.y, -5), q.z);
    if (!pp) continue;
    ctx.globalAlpha = Math.min(1, q.life / 14);
    ctx.fillStyle = q.col;
    ctx.beginPath(); ctx.arc(pp.x, pp.y, Math.max(1, 3 * pp.scale), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawPaddle(0);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD();
}

function drawHUD() {
  ctx.textAlign = 'center';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillStyle = COL[0]; ctx.fillText(String(scores[0]), W / 2 - 70, 60);
  ctx.fillStyle = '#fff'; ctx.fillText(':', W / 2, 56);
  ctx.fillStyle = COL[1]; ctx.fillText(String(scores[1]), W / 2 + 70, 60);
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = COL[0]; ctx.textAlign = 'left'; ctx.fillText('PLAYER 1 (near)', 20, 26);
  ctx.fillStyle = COL[1]; ctx.textAlign = 'right'; ctx.fillText('PLAYER 2 (far)', W - 20, 26);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffffcc'; ctx.font = '12px sans-serif';
  ctx.fillText('First to ' + WIN_AT + ', win by 2', W / 2, 80);
  if (rally > 2 && state === 'playing') {
    ctx.fillStyle = '#ffd54a'; ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Rally: ' + rally, W / 2, 96);
  }
  if (state === 'pause') {
    ctx.fillStyle = COL[lastWinner]; ctx.font = 'bold 36px sans-serif';
    ctx.fillText(msg, W / 2, H - 90);
  }
  if (state === 'ready') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 56px sans-serif';
    var n = Math.ceil(timer / 27);
    ctx.fillText(n > 0 ? String(n) : 'GO!', W / 2, H - 100);
  }
}

// ============================================================
// Input + loop
// ============================================================
window.addEventListener('keydown', function (e) {
  if (e.code.indexOf('Arrow') === 0) e.preventDefault();
  keys[e.code] = true;
  if (e.code === 'Escape' && state !== 'menu') showMenu();
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
window.addEventListener('blur', function () { keys = {}; });

document.getElementById('startBtn').addEventListener('click', newMatch);
document.getElementById('rematchBtn').addEventListener('click', newMatch);
document.getElementById('menuBtn').addEventListener('click', showMenu);

var last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
