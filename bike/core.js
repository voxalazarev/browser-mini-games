// Pure game logic (no DOM): levels, terrain, bike physics and tricks.
var Bike = (function () {
  'use strict';

  var G = 0.45, MOTOR = 0.14, VM = 5.0, DRAG = 0.004, VCAP = 16, WL = 0.55, WH = 2.4;
  var PIT = 1000000, DX = 8, TOTAL = 100, START_X = 160;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function wrap(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  var TRICKS = [
    { n: 'Tuck', d: 24, p: 100, k: 'body' },
    { n: 'No Hander', d: 28, p: 150, k: 'body' },
    { n: 'No Footer', d: 28, p: 150, k: 'legs' },
    { n: 'Heel Clicker', d: 30, p: 180, k: 'legs' },
    { n: 'Wheel Kick', d: 30, p: 160, k: 'frame' },
    { n: '180 Turn', d: 30, p: 170, k: 'spin' },
    { n: 'Barspin', d: 32, p: 180, k: 'bar' },
    { n: 'Lookback', d: 34, p: 200, k: 'body' },
    { n: 'Seat Grab', d: 34, p: 190, k: 'body' },
    { n: 'Turndown', d: 34, p: 200, k: 'frame' },
    { n: 'Can-Can', d: 36, p: 200, k: 'legs' },
    { n: 'Nac-Nac', d: 36, p: 220, k: 'legs' },
    { n: 'Indian Air', d: 38, p: 210, k: 'legs' },
    { n: 'Tailwhip', d: 40, p: 260, k: 'frame' },
    { n: 'Toboggan', d: 40, p: 230, k: 'legs' },
    { n: 'Christ Air', d: 42, p: 240, k: 'body' },
    { n: 'Tabletop', d: 44, p: 250, k: 'frame' },
    { n: 'Cliffhanger', d: 46, p: 280, k: 'body' },
    { n: 'Double Barspin', d: 48, p: 300, k: 'bar' },
    { n: 'Superman', d: 50, p: 300, k: 'body' },
    { n: 'Rocket Air', d: 52, p: 320, k: 'body' },
    { n: '360 Spin', d: 56, p: 350, k: 'spin' },
    { n: 'Superman Seat Grab', d: 60, p: 400, k: 'body' },
    { n: 'Superman Indian', d: 64, p: 450, k: 'body' },
  ];

  function randomTricks() {
    var pool = TRICKS.slice(), out = [];
    for (var i = 0; i < 4; i++) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }

  // ------------------------------------------------------------
  // Levels
  // ------------------------------------------------------------
  function buildLevel(L) {
    var d = L / (TOTAL - 1);
    var rng = mulberry32(L * 7919 + 13);
    function R(a, b) { return a + rng() * (b - a); }
    var ys = [460];
    var cy = 460;
    var pw = 1.7;

    function seg(len, y1, mode) {
      var n = Math.max(1, Math.round(len / DX));
      var y0 = cy;
      for (var i = 1; i <= n; i++) {
        var t = i / n, yy;
        if (mode === 'pit') yy = PIT;
        else if (mode === 'ease') yy = y0 + (y1 - y0) * (1 - Math.cos(Math.PI * t)) / 2;
        else if (mode === 'pow') yy = y0 + (y1 - y0) * Math.pow(t, pw);
        else if (mode === 'easeout') yy = y0 + (y1 - y0) * Math.sin(Math.PI * t / 2);
        else yy = y0 + (y1 - y0) * t;
        ys.push(yy);
      }
      if (mode !== 'pit') cy = y1;
    }
    function flat(len) { seg(len, cy, 'lin'); }
    function descend(D, s) { seg(1.5708 * D / s, cy + D, 'ease'); }
    function climb(H, s) { seg(1.5708 * H / s, cy - H, 'ease'); }

    var ramps = [];
    var gL = G * 0.6;
    var vdes = lerp(7.5, 13.5, d);

    // Rolling ground instead of flat plateaus: hills and small kicker ramps.
    function hill(H) { climb(H, 0.2); descend(H, 0.3); }
    // A valley: the ground plunges away (you land on this slope), then climbs back up.
    function valley(D) {
      seg(D * R(4, 5.5), cy + D, 'easeout');
      climb(D, 0.28);
    }
    function kicker(r) {
      var tanK = R(0.3, 0.45), len = r / tanK, x0 = (ys.length - 1) * DX;
      seg(len, cy - r, 'lin');
      ramps.push({ x0: x0, x1: (ys.length - 1) * DX, pit: null, tall: false, label: 'KICK' });
      var D = r + R(40, 90);
      seg(D * R(4, 5.5), cy + D, 'easeout');
      climb(D - r, 0.25);
    }
    function fill(len) {
      var endIdx = ys.length - 1 + Math.round(len / DX);
      function left() { return (endIdx - (ys.length - 1)) * DX; }
      valley(Math.min(R(60, 130) * lerp(0.85, 1.15, d), Math.max(30, len / 10.5)));
      var guard = 0;
      while (left() > 300 && guard++ < 14) {
        var pk = rng(), L2 = left();
        if (pk < 0.3 && L2 > 950) kicker(R(22, 42));
        else if (pk < 0.65 && L2 > 600) valley(Math.min(R(50, 120), L2 / 10.5));
        else hill(Math.min(R(35, 100), L2 / 13.5));
      }
    }

    // One hop = run down a dip for speed, launch off a ramp, fly over a gap and land on a
    // plateau that can be far below (dy > 0) or higher up (dy < 0) than the lip.
    function hop(gap, dy, plateau, minDip) {
      var up = dy < -30;
      var vd = up ? lerp(9.5, 13.5, d) : vdes;
      var rampLen = up ? R(85, 100) : R(90, 110), tanA = up ? R(0.9, 1.15) : R(0.5, 0.72), rise = rampLen * tanA;
      var alpha = Math.atan(tanA), c = Math.cos(alpha);
      var v0sq = vd * vd + 2 * G * WL * rise;
      var e0 = ramps.length === 0 ? 0 : lerp(0, 30, d);
      var Dv = Math.max(minDip || 50, (v0sq - e0) / (2 * G * lerp(0.5, 1.5, d)));
      descend(Dv, R(0.28, 0.4));
      flat(R(100, 140));
      var x0 = (ys.length - 1) * DX;
      seg(rampLen, cy - rise, 'lin');
      var x1 = (ys.length - 1) * DX, lipY = cy;
      var vmin = vd * 0.92;
      function h(x) { return x * tanA - gL * x * x / (2 * vmin * vmin * c * c); }
      var g0 = gap, guard = 0;
      if (up) g0 = R(0.4, 0.7) * tanA * vmin * vmin * c * c / gL;
      while (h(g0) < -dy + 20 && g0 > 70 && guard++ < 40) g0 *= 0.92;
      if (-dy > h(g0) - 20) dy = -(h(g0) - 20);
      seg(g0, cy, 'pit');
      cy = lipY + dy;
      var vmx = 15.5, disc = Math.pow(vmx * Math.sin(alpha), 2) + 2 * gL * dy;
      if (disc > 0) plateau = Math.max(plateau, Math.min(2400, vmx * c * (vmx * Math.sin(alpha) + Math.sqrt(disc)) / gL - g0 + 150));
      fill(plateau);
      ramps.push({ x0: x0, x1: x1, pit: { x0: x1, x1: x1 + g0 }, tall: up, label: dy < -40 ? 'CLIMB!' : (dy > 250 ? 'DROP!' : 'JUMP!') });
    }
    function canyonHop() {
      hop(lerp(170, 260, d) * R(0.85, 1.1), rng() < 0.3 ? -R(80, 140) : R(300, 900) * lerp(0.8, 1.2, d), R(500, 800));
    }
    function climbHop() {
      hop(lerp(100, 190, d) * R(0.85, 1.1), rng() < 0.8 ? -R(90, 150) * lerp(0.9, 1.2, d) : R(60, 200), R(350, 600));
    }
    function trainHop() {
      hop(lerp(90, 170, d) * R(0.8, 1.15), rng() < 0.2 ? -R(70, 120) : R(-20, 70), R(250, 400), 45);
    }
    function ridgeHop(up) {
      hop(lerp(110, 200, d) * R(0.85, 1.1), up ? -R(80, 140) : R(80, 220), R(350, 550));
    }
    function bigAirHop() {
      hop(lerp(140, 230, d) * R(0.85, 1.1), R(700, 1300), R(700, 1000));
    }

    var style = L % 6;
    var styleNames = ['Canyon Leaps', 'Mountain Climb', 'Gap Train', 'Ridge Runner', 'Mixed Bag', 'Big Air'];
    flat(200);
    var n, k2;
    if (style === 0) { n = 4 + Math.floor(d * 3); for (k2 = 0; k2 < n; k2++) canyonHop(); }
    else if (style === 1) { n = 5 + Math.floor(d * 4); for (k2 = 0; k2 < n; k2++) climbHop(); }
    else if (style === 2) { n = 9 + Math.floor(d * 7); for (k2 = 0; k2 < n; k2++) trainHop(); }
    else if (style === 3) { n = 6 + Math.floor(d * 4); for (k2 = 0; k2 < n; k2++) ridgeHop(k2 % 2 === 0); }
    else if (style === 4) {
      n = 7 + Math.floor(d * 4);
      for (k2 = 0; k2 < n; k2++) { var pk = rng(); if (pk < 0.25) canyonHop(); else if (pk < 0.5) climbHop(); else if (pk < 0.75) trainHop(); else ridgeHop(rng() < 0.5); }
    } else {
      n = 3 + Math.floor(d * 3);
      for (k2 = 0; k2 < n; k2++) { bigAirHop(); climbHop(); }
    }
    flat(160);
    var endX = (ys.length - 1) * DX;
    var finishX = endX - 150;
    flat(200);

    var maxReal = 0;
    for (var k = 0; k < ys.length; k++) if (ys[k] < PIT && ys[k] > maxReal) maxReal = ys[k];
    return { L: L, d: d, ys: ys, finishX: finishX, length: (ys.length - 1) * DX, deathY: maxReal + 450, tol: lerp(1.0, 0.75, d), N: ramps.length, ramps: ramps, style: style, styleName: styleNames[style] };
  }

  function groundY(lv, x) {
    var ys = lv.ys, f = x / DX, i = Math.floor(f);
    if (i < 0) return ys[0];
    if (i >= ys.length - 1) return ys[ys.length - 1];
    var a = ys[i], b = ys[i + 1];
    if (a >= PIT || b >= PIT) return PIT;
    return a + (b - a) * (f - i);
  }
  function nearGround(lv, x) {
    var ys = lv.ys, i = clamp(Math.floor(x / DX), 0, ys.length - 1);
    for (var k = 0; k < 300; k++) {
      var a = ys[i - k], b = ys[i + k];
      if (a !== undefined && a < PIT) return a;
      if (b !== undefined && b < PIT) return b;
    }
    return lv.deathY;
  }
  function slopeAt(lv, x) {
    var ys = lv.ys, i = clamp(Math.floor(x / DX), 0, ys.length - 2);
    var a = ys[i], b = ys[i + 1];
    if (a >= PIT || b >= PIT) return 0;
    return Math.atan2(b - a, DX);
  }

  // ------------------------------------------------------------
  // Rider
  // ------------------------------------------------------------
  function newRider(lv) {
    return {
      x: START_X, y: groundY(lv, START_X), v: 0, vx: 0, vy: 0,
      angle: 0, angVel: 0, rot: 0, onGround: true, hv: 0, stall: 0, camX: 0,
      state: 'ride', reason: '', trick: null, tricks: randomTricks(),
      combo: 0, score: 0, deaths: 0, events: [], finished: false, air: 0, tDone: 0, boostT: 0,
    };
  }

  function crash(p, reason) {
    if (p.state !== 'ride') return;
    p.state = 'crashed'; p.reason = reason; p.combo = 0; p.trick = null;
    p.events.push({ type: 'crash', text: reason });
  }

  function startTrick(p, slot) {
    if (p.state !== 'ride' || p.onGround || p.trick) return;
    p.trick = { def: p.tricks[slot], t: 0 };
  }

  function stepRider(lv, p, inp) {
    if (p.state !== 'ride') return;
    if (p.boostT > 0) p.boostT--;
    if (inp.heavy) p.hv = Math.min(1, p.hv + 0.08); else p.hv = Math.max(0, p.hv - 0.15);
    var w = WL + (WH - WL) * p.hv;

    if (p.onGround) {
      var th = slopeAt(lv, p.x);
      var a = G * w * Math.sin(th);
      if (p.v < VM) a += MOTOR * (1 - p.v / VM);
      a -= DRAG * p.v;
      p.v = clamp(p.v + a, -8, VCAP);
      var vx = p.v * Math.cos(th), vy = p.v * Math.sin(th);
      var nx = p.x + vx, ny = p.y + vy;
      var gy = groundY(lv, nx);
      if (ny < gy - 2) {
        p.onGround = false; p.vx = vx; p.vy = vy; p.x = nx; p.y = ny; p.rot = 0; p.angVel = 0; p.air = 0; p.tDone = 0;
      } else {
        p.x = nx; p.y = gy;
      }
      p.angle += wrap(slopeAt(lv, p.x) - p.angle) * 0.3;
      if (Math.abs(p.v) < 0.25) p.stall++; else p.stall = 0;
      if (p.stall > 90) crash(p, 'Stopped on the hill!');
    } else {
      p.vy += G * (0.6 + 1.4 * p.hv);
      p.x += p.vx; p.y += p.vy; p.air++;
      var dirIn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      if (dirIn) p.angVel += (dirIn * 0.065 - p.angVel) * 0.15; else p.angVel *= 0.97;
      p.angle += p.angVel; p.rot += p.angVel;
      if (p.trick) {
        p.trick.t++;
        if (p.trick.t >= p.trick.def.d) {
          var pts = Math.round(p.trick.def.p * (1 + Math.min(p.combo, 8) * 0.25));
          p.score += pts; p.combo++; p.tDone++;
          p.events.push({ type: 'trick', text: p.trick.def.n + ' +' + pts });
          p.trick = null;
        }
      }
      var g2 = groundY(lv, p.x);
      if (p.y >= g2) {
        var th2 = slopeAt(lv, p.x);
        var diff = wrap(p.angle - th2);
        if (p.y - g2 > 140) crash(p, 'Smashed into the wall!');
        else if (p.trick) crash(p, 'Landed in the middle of a trick!');
        else if (Math.abs(diff) > lv.tol) crash(p, 'Bad landing!');
        else {
          p.v = clamp(p.vx * Math.cos(th2) + p.vy * Math.sin(th2), -8, VCAP);
          p.y = g2; p.onGround = true;
          var fl = Math.floor((Math.abs(p.rot) + 1.0) / (2 * Math.PI));
          if (fl > 0) {
            var fp = fl * 300;
            p.score += fp; p.combo += fl;
            p.events.push({ type: 'flip', text: fl + 'x ' + (p.rot < 0 ? 'back' : 'front') + ' flip +' + fp });
          }
          p.rot = 0; p.angVel = 0;
          if (p.tDone > 0) {
            var boost = clamp(p.air / 10, 1.5, 7) * (1 + 0.2 * (p.tDone - 1));
            p.v = Math.min(VCAP, p.v + boost);
            p.boostT = 45;
            p.events.push({ type: 'boost', text: 'SPEED BOOST +' + boost.toFixed(1) });
          }
          p.tDone = 0;
        }
      }
    }

    if (p.state !== 'ride') return;
    if (p.y > nearGround(lv, p.x) + 500) { crash(p, 'Fell into the pit!'); return; }
    if (p.x > p.camX + 480) p.camX = p.x - 480;
    if (p.x < p.camX + 30) { crash(p, 'Rolled off the screen!'); return; }
    if (p.x >= lv.finishX) { p.finished = true; p.state = 'done'; p.events.push({ type: 'finish', text: 'FINISH!' }); }
  }

  return {
    G: G, TOTAL: TOTAL, START_X: START_X, PIT: PIT, DX: DX, TRICKS: TRICKS,
    buildLevel: buildLevel, groundY: groundY, slopeAt: slopeAt, newRider: newRider,
    stepRider: stepRider, startTrick: startTrick, randomTricks: randomTricks, wrap: wrap,
  };
})();
