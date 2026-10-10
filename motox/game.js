'use strict';
/*
 * Moto Rush - a 2D motocross game with real two-wheel suspension physics.
 * Single-file engine: terrain generation, vehicle physics, rendering, audio,
 * progression (coins/bikes/stars) and UI all live here.
 */

// ============================================================
// Canvas + global constants
// ============================================================
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

const TOTAL_LEVELS = 30;
const WORLDS = ['Desert Dunes', 'Neon City', 'Jungle Ruins', 'Ice Peaks', 'Volcano Factory'];
const WORLD_PALETTE = [
  { sky: ['#8ecbe8', '#fbe6b0'], ground: '#c9a15a', groundLine: '#8a6a34', deco: '#5a8a3a' },
  { sky: ['#0b0b2a', '#2a1a4a'], ground: '#2a2a3a', groundLine: '#ff2fb0', deco: '#2fe0ff' },
  { sky: ['#2a5a3a', '#7ab06a'], ground: '#3a6a2a', groundLine: '#1f3a16', deco: '#2a8a3a' },
  { sky: ['#9fd0e8', '#e8f4ff'], ground: '#dfefff', groundLine: '#8fb8d0', deco: '#ffffff' },
  { sky: ['#3a1010', '#7a2a10'], ground: '#4a2a1a', groundLine: '#ff5a1a', deco: '#ff8020' },
];

const GRAVITY = 0.32;
const AIR_DRAG = 0.996;
const ANGULAR_DAMPING = 0.985;
const HALF_WB = 40;        // half the wheelbase
const SUSP_MAX = 36;        // suspension travel before a wheel is "airborne"
const WHEEL_R = 15;
const BODY_CLEARANCE = 4;   // how close the chassis center may get to the ground before a crash
const FALL_CRASH_DEPTH = 160; // how far into a gap before it's a fatal fall
const UPSIDE_ANGLE = 2.35;  // ~135 deg from upright counts as "upside down"
const UPSIDE_FRAMES = 120;  // ~2 seconds at 60fps

const STORE_UNLOCK = 'motox_unlocked';
const STORE_STARS = 'motox_stars';
const STORE_COINS = 'motox_coins';
const STORE_BIKES = 'motox_owned_bikes';
const STORE_BIKE_SEL = 'motox_bike_sel';
const STORE_COLORS = 'motox_colors';
const STORE_MUTE = 'motox_mute';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

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
function rand(rng, a, b) { return a + rng() * (b - a); }

// ============================================================
// Bikes - 6 bikes with real stat differences that feed the physics
// ============================================================
const BIKES = [
  { name: 'The Scrapper', cost: 0, speed: 30, accel: 35, grip: 70, susp: 55, weight: 65 },
  { name: 'Dirt Devil', cost: 400, speed: 50, accel: 55, grip: 65, susp: 80, weight: 55 },
  { name: 'Street Rocket', cost: 800, speed: 90, accel: 70, grip: 35, susp: 30, weight: 50 },
  { name: 'Frost Claw', cost: 900, speed: 55, accel: 50, grip: 90, susp: 60, weight: 60 },
  { name: 'Trials King', cost: 1100, speed: 40, accel: 60, grip: 85, susp: 75, weight: 40 },
  { name: 'Fury X-1', cost: 2200, speed: 100, accel: 95, grip: 80, susp: 90, weight: 45 },
];
function bikePhysics(b) {
  return {
    maxSpeed: lerp(6, 17, b.speed / 100),
    engineForce: lerp(0.22, 0.62, b.accel / 100),
    grip: lerp(0.55, 0.97, b.grip / 100),
    stiffness: lerp(0.09, 0.2, b.susp / 100),
    damping: lerp(0.18, 0.34, b.susp / 100),
    mass: lerp(0.8, 1.35, b.weight / 100),
  };
}

// ============================================================
// Level generation: terrain is a chain of points; cosine-interpolated
// between them. "gaps" are x-ranges with no ground (a pit to clear).
// ============================================================
const GROUND_BASE = 420;

function maxJumpGap(speed, dy) {
  // Same physics-based safety idea used elsewhere this session: how far a
  // launch at this speed can carry horizontally while falling dy further.
  const vy0 = -speed * 0.28; // a ramp gives some lift
  const disc = vy0 * vy0 + 2 * GRAVITY * dy;
  if (disc < 0) return 40;
  const t = (-vy0 + Math.sqrt(disc)) / GRAVITY;
  return speed * t;
}

function generateLevel(idx) {
  const rng = mulberry32(idx * 7793 + 2221);
  const world = Math.floor(idx / 6);
  const inWorld = idx % 6;
  const diff = clamp((inWorld + world * 1.1) / 9, 0, 1);
  const palette = WORLD_PALETTE[world];

  const points = [{ x: 0, y: GROUND_BASE }];
  const gaps = [];
  const zones = []; // { x0, x1, kind: 'mud'|'ice' }
  const stars = [];
  const saws = []; // world 5 moving hazards: { x, y0, amp, speed, phase, r }

  let x = 0, y = GROUND_BASE;
  flat(260);

  const numFeatures = Math.round(6 + diff * 9);
  const estSpeed = lerp(7, 13, diff); // rough cruising speed used to size jumps
  let sinceGap = 0;

  for (let i = 0; i < numFeatures; i++) {
    const r = rng();
    sinceGap++;
    if (r < 0.3 + diff * 0.15 && sinceGap > 1) {
      jumpGap();
      sinceGap = 0;
    } else if (r < 0.75) {
      hill();
    } else {
      bumps();
    }
    if (world === 2 && rng() < 0.3) zoneHere('mud', rand(rng, 90, 160));
    if (world === 3 && rng() < 0.3) zoneHere('ice', rand(rng, 100, 180));
  }
  flat(320);

  function flat(len) {
    seg(len, y);
  }
  function seg(len, newY) {
    const n = Math.max(1, Math.round(len / 18));
    const x0 = x, y0 = y;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const ease = (1 - Math.cos(Math.PI * t)) / 2;
      points.push({ x: x0 + len * t, y: y0 + (newY - y0) * ease });
    }
    x = x0 + len; y = newY;
  }
  function hill() {
    const dy = rand(rng, -90, 90) * (0.5 + diff * 0.6);
    const newY = clamp(y + dy, GROUND_BASE - 170, GROUND_BASE + 10);
    seg(rand(rng, 160, 280), newY);
  }
  function bumps() {
    const n = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const dy = rand(rng, -30, 30);
      seg(rand(rng, 55, 90), clamp(y + dy, GROUND_BASE - 150, GROUND_BASE + 15));
    }
  }
  function jumpGap() {
    const rampLen = rand(rng, 90, 150);
    const rampRise = rampLen * rand(rng, 0.32, 0.5);
    seg(60, y);
    seg(rampLen, y - rampRise);
    const takeoffX = x, takeoffY = y;
    const landDrop = rand(rng, 10, 70) + diff * 20; // land a bit lower - softer
    const safeGap = maxJumpGap(estSpeed, landDrop) * 0.62;
    const gapW = clamp(rand(rng, 70, 130) + diff * 90, 60, Math.max(70, safeGap));
    gaps.push({ x0: takeoffX, x1: takeoffX + gapW });
    x = takeoffX + gapW; y = takeoffY + landDrop;
    seg(rand(rng, 120, 200), clamp(y, GROUND_BASE - 150, GROUND_BASE + 15));
  }
  function zoneHere(kind, len) {
    zones.push({ x0: x - len, x1: x, kind });
  }

  // stars: 3 per level, spread across the middle, floating just above the ground
  for (let s = 0; s < 3; s++) {
    const frac = (s + 1) / 4;
    const sx = 260 + (x - 260 - 320) * frac;
    const sy = groundHeightAtPoints(points, gaps, sx) - 55;
    stars.push({ x: sx, y: isFinite(sy) ? sy : GROUND_BASE - 55, r: 12, got: false });
  }

  const finishX = x;
  const startX = 60;
  const timeLimit = 14 + (finishX - startX) / 130;

  return {
    index: idx, world, inWorld, diff, palette,
    points, gaps, zones, stars, saws,
    startX, finishX, timeLimit,
    bounds: { minX: -60, maxX: finishX + 220 },
  };
}

// Pure helper (also used during generation, before `level` exists).
function groundHeightAtPoints(points, gaps, px) {
  for (const g of gaps) if (px >= g.x0 && px <= g.x1) return Infinity;
  if (px <= points[0].x) return points[0].y;
  if (px >= points[points.length - 1].x) return points[points.length - 1].y;
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].x < px) lo = mid; else hi = mid;
  }
  const a = points[lo], b = points[hi];
  const t = (px - a.x) / (b.x - a.x || 1);
  return a.y + (b.y - a.y) * t;
}
function groundHeightAt(lv, px) { return groundHeightAtPoints(lv.points, lv.gaps, px); }
function zoneAt(lv, px) {
  for (const z of lv.zones) if (px >= z.x0 && px <= z.x1) return z.kind;
  return null;
}

// ============================================================
// Progression storage
// ============================================================
function loadJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
}
function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } }

function loadUnlocked() { return clamp(parseInt(localStorage.getItem(STORE_UNLOCK) || '0', 10) || 0, 0, TOTAL_LEVELS - 1); }
function saveUnlocked(v) { if (v > loadUnlocked()) localStorage.setItem(STORE_UNLOCK, String(v)); }
function loadStars() { return loadJSON(STORE_STARS, {}); }
function saveStars(idx, n) {
  const s = loadStars();
  if (!s[idx] || s[idx] < n) { s[idx] = n; saveJSON(STORE_STARS, s); }
}
function loadCoins() { return parseInt(localStorage.getItem(STORE_COINS) || '0', 10) || 0; }
function addCoins(n) { localStorage.setItem(STORE_COINS, String(loadCoins() + n)); }
function spendCoins(n) { const c = loadCoins(); if (c < n) return false; localStorage.setItem(STORE_COINS, String(c - n)); return true; }
function loadOwnedBikes() { return loadJSON(STORE_BIKES, [0]); }
function saveOwnedBikes(arr) { saveJSON(STORE_BIKES, arr); }
function loadBikeSel() { return clamp(parseInt(localStorage.getItem(STORE_BIKE_SEL) || '0', 10) || 0, 0, BIKES.length - 1); }
function saveBikeSel(i) { localStorage.setItem(STORE_BIKE_SEL, String(i)); }
function loadColors() { return loadJSON(STORE_COLORS, { body: '#e8443b', helmet: '#4ad0ff' }); }
function saveColors(c) { saveJSON(STORE_COLORS, c); }
function loadMute() { return localStorage.getItem(STORE_MUTE) === '1'; }
function saveMute(v) { localStorage.setItem(STORE_MUTE, v ? '1' : '0'); }

const BODY_COLORS = ['#e8443b', '#4ad0ff', '#ffd54a', '#57e08a', '#c060ff', '#ff8a3d'];
const HELMET_COLORS = ['#4ad0ff', '#e8443b', '#ffffff', '#222222', '#ffd54a', '#57e08a', '#c060ff', '#ff8a3d', '#2fe0ff', '#ff2fb0'];

// ============================================================
// Audio (lightweight WebAudio - no asset files)
// ============================================================
const audio = { ctx: null, engineOsc: null, engineGain: null, muted: loadMute() };
function ensureAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audio.ctx = new Ctx();
  audio.engineOsc = audio.ctx.createOscillator();
  audio.engineGain = audio.ctx.createGain();
  audio.engineOsc.type = 'sawtooth';
  audio.engineOsc.frequency.value = 60;
  audio.engineGain.gain.value = 0;
  audio.engineOsc.connect(audio.engineGain).connect(audio.ctx.destination);
  audio.engineOsc.start();
}
function setEngineSound(speedFrac, throttle) {
  if (!audio.ctx || audio.muted) return;
  audio.engineOsc.frequency.value = 50 + speedFrac * 260 + (throttle ? 20 : 0);
  audio.engineGain.gain.value = 0.015 + speedFrac * 0.05;
}
function blip(freq, dur, type) {
  if (!audio.ctx || audio.muted) return;
  const o = audio.ctx.createOscillator(), g = audio.ctx.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  g.gain.value = 0.08;
  o.connect(g).connect(audio.ctx.destination);
  g.gain.exponentialRampToValueAtTime(0.001, audio.ctx.currentTime + dur);
  o.start(); o.stop(audio.ctx.currentTime + dur);
}
function sfxStar() { blip(880, 0.15, 'sine'); setTimeout(() => blip(1320, 0.15, 'sine'), 70); }
function sfxCrash() {
  if (!audio.ctx || audio.muted) return;
  const buf = audio.ctx.createBuffer(1, 4410, 44100);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = audio.ctx.createBufferSource(); src.buffer = buf;
  const g = audio.ctx.createGain(); g.gain.value = 0.3;
  src.connect(g).connect(audio.ctx.destination); src.start();
}
function sfxLand(hard) { blip(hard ? 90 : 140, 0.1, 'triangle'); }
function sfxFinish() { [660, 880, 1100].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'sine'), i * 90)); }

// ============================================================
// Game state
// ============================================================
let level = null, currentLevelIndex = 0;
let bikes = [];
let numPlayers = 1;
const KEYMAPS = [
  { gas: ['KeyW'], brake: ['KeyS'], left: ['KeyA'], right: ['KeyD'] },
  { gas: ['ArrowUp'], brake: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'] },
];
let camera = { x: 0, y: 0, zoom: 1 };
let running = false, paused = false;
let keys = {};
let gameTime = 0;
let shake = 0;
let raceOver = false;
let selectedWorldTab = 0;

function currentBike(p) { return BIKES[loadBikeSel()]; }

function newBike(lv, p) {
  return {
    p,
    x: lv.startX, y: groundHeightAt(lv, lv.startX) - SUSP_MAX - WHEEL_R + 6,
    vx: 0, vy: 0, angle: 0, angVel: 0,
    frontGrounded: false, rearGrounded: false,
    upsideTimer: 0, wasAirborne: false, hardLandingFlash: 0,
    crashed: false, crashTimer: 0, finished: false, finishTime: 0,
    coinsThisRun: 0, flipAccum: 0, flipPopups: [],
  };
}

function loadLevel(idx) {
  currentLevelIndex = clamp(idx, 0, TOTAL_LEVELS - 1);
  level = generateLevel(currentLevelIndex);
  bikes = [newBike(level, 0)];
  if (numPlayers === 2) bikes.push(newBike(level, 1));
  camera.x = bikes[0].x - 200; camera.y = 0; camera.zoom = 1;
  gameTime = 0; shake = 0; raceOver = false;
  for (const s of level.stars) s.got = false;
  document.getElementById('crashScreen').classList.add('hidden');
  document.getElementById('winScreen').classList.add('hidden');
}

function restartLevel() { loadLevel(currentLevelIndex); }

function respawnBike(b) {
  const lv = level;
  b.x = lv.startX; b.y = groundHeightAt(lv, lv.startX) - SUSP_MAX - WHEEL_R + 6;
  b.vx = 0; b.vy = 0; b.angle = 0; b.angVel = 0;
  b.frontGrounded = false; b.rearGrounded = false; b.upsideTimer = 0; b.wasAirborne = false;
  b.crashed = false; b.crashTimer = 0;
  document.getElementById('crashScreen').classList.add('hidden');
}

// ============================================================
// Physics
// ============================================================
// Ground contact uses a geometric (position-based) model rather than a force-integrated
// spring: snapping the chassis to the line between the two wheels' rest points is what
// most 2D motocross games actually do, and it is numerically stable by construction -
// an explicit-Euler force/torque suspension (what this used to be) is a classic case of
// a stiff spring-damper injecting energy every frame instead of dissipating it, which is
// exactly what made the bike spin out of control on perfectly flat ground.
function stepPhysics(b) {
  const km = KEYMAPS[b.p];
  const stats = bikePhysics(currentBike(b.p));
  let forward = { x: Math.cos(b.angle), y: Math.sin(b.angle) };
  let rear = { x: b.x - HALF_WB * forward.x, y: b.y - HALF_WB * forward.y };
  let front = { x: b.x + HALF_WB * forward.x, y: b.y + HALF_WB * forward.y };

  const rearGY = groundHeightAt(level, rear.x);
  const frontGY = groundHeightAt(level, front.x);
  const rearDrop = rearGY - rear.y, frontDrop = frontGY - front.y;
  const rearNear = isFinite(rearDrop) && rearDrop < SUSP_MAX;
  const frontNear = isFinite(frontDrop) && frontDrop < SUSP_MAX;
  const wasAnyGrounded = b.frontGrounded || b.rearGrounded;

  b.vy += GRAVITY;

  const zone = zoneAt(level, b.x);
  const gripMul = zone === 'ice' ? 0.42 : zone === 'mud' ? 0.6 : 1;
  const throttle = km.gas.some(k => keys[k]);
  const brake = km.brake.some(k => keys[k]);
  const lean = (km.left.some(k => keys[k]) ? -1 : 0) + (km.right.some(k => keys[k]) ? 1 : 0);
  let hardImpact = 0;

  if (rearNear && frontNear) {
    // both wheels down: snap the chassis onto the line between their rest positions
    const restRearY = rearGY - WHEEL_R, restFrontY = frontGY - WHEEL_R;
    const targetAngle = Math.atan2(restFrontY - restRearY, front.x - rear.x);
    const targetY = (restRearY + restFrontY) / 2;
    const impactSpeed = Math.max(0, targetY - b.y - b.vy);
    if (!wasAnyGrounded) hardImpact = impactSpeed;
    b.angVel = wrapAngle(targetAngle - b.angle) * 0.45;
    b.angle += b.angVel;
    b.vy = (targetY - b.y) * 0.4;
    b.y += b.vy;
    b.frontGrounded = true; b.rearGrounded = true;

    forward = { x: Math.cos(b.angle), y: Math.sin(b.angle) };
    if (throttle) {
      const speed = b.vx * forward.x + b.vy * forward.y;
      if (speed < stats.maxSpeed) { const f = stats.engineForce * gripMul; b.vx += forward.x * f; b.vy += forward.y * f; }
    }
    if (brake) { b.vx *= 1 - 0.07 * stats.grip * gripMul; b.vy *= 1 - 0.07 * stats.grip * gripMul; }
    if (!throttle && !brake) b.vx *= 1 - 0.012 * stats.grip;
    b.x += b.vx;
  } else if (rearNear || frontNear) {
    // one wheel down: pivot about that wheel like a pendulum (gravity pulls it back
    // level, lean gives direct control) - a single pinned contact, unlike the two-wheel
    // case, has no cross-coupling to go unstable.
    const pivot = rearNear ? rear : front;
    const restY = (rearNear ? rearGY : frontGY) - WHEEL_R;
    const sign = rearNear ? 1 : -1; // which way "nose up" rotates the free end
    b.angVel += sign * Math.sin(b.angle) * -0.0093; // gravity restoring torque
    if (lean) b.angVel += lean * 0.004;
    b.angVel *= 0.97;
    b.angle += b.angVel;
    forward = { x: Math.cos(b.angle), y: Math.sin(b.angle) };
    rear = { x: b.x - HALF_WB * forward.x, y: b.y - HALF_WB * forward.y };
    front = { x: b.x + HALF_WB * forward.x, y: b.y + HALF_WB * forward.y };
    const curPivot = rearNear ? rear : front;
    b.x += pivot.x - curPivot.x;
    b.y += restY - curPivot.y;
    b.vy = 0;
    if (rearNear && throttle) {
      const speed = b.vx * forward.x + b.vy * forward.y;
      if (speed < stats.maxSpeed) { const f = stats.engineForce * gripMul * 0.7; b.vx += forward.x * f; }
    }
    if (brake) b.vx *= 1 - 0.05 * stats.grip * gripMul;
    b.x += b.vx;
    b.frontGrounded = frontNear; b.rearGrounded = rearNear;
  } else {
    // airborne: lean freely controls rotation
    if (lean) b.angVel += lean * 0.01;
    b.angVel *= ANGULAR_DAMPING;
    b.angle += b.angVel;
    b.x += b.vx; b.y += b.vy;
    b.vx *= AIR_DRAG; b.vy *= AIR_DRAG;
    b.frontGrounded = false; b.rearGrounded = false;
  }

  const anyGrounded = b.frontGrounded || b.rearGrounded;
  if (!anyGrounded) {
    if (!b.wasAirborne) b.flipAccum = 0;
    b.wasAirborne = true;
    b.flipAccum += b.angVel;
  } else if (b.wasAirborne) {
    b.wasAirborne = false;
    const rot = Math.abs(b.flipAccum);
    if (!b.crashed && rot > 5.6) {
      const kind = b.flipAccum > 0 ? 'Frontflip' : 'Backflip';
      const n = Math.max(1, Math.floor(rot / 6.28));
      addCoins(50 * n); b.coinsThisRun += 50 * n;
      b.flipPopups.push({ text: 'P' + (b.p + 1) + ' ' + kind + (n > 1 ? ' x' + n : '') + '! +' + (50 * n), t: 70 });
    }
    b.flipAccum = 0;
  }

  if (hardImpact > 2) {
    shake = Math.max(shake, hardImpact > 9 ? 10 : 5);
    sfxLand(hardImpact > 9);
  }

  checkCrashAndFinish(b);
}

function checkCrashAndFinish(b) {
  if (b.crashed || b.finished) return;
  const groundY = groundHeightAt(level, b.x);
  // Only check "body slammed into the ground" while fully airborne - the grounded and
  // one-wheel-pivot states already keep the chassis geometrically above the terrain by
  // construction, so checking this on a plain ground-at-center-x lookup there as well
  // produces false positives on ordinary slope transitions (the center x's ground height
  // and the wheel-based chassis height drift apart slightly on a slope).
  if (!b.frontGrounded && !b.rearGrounded) {
    if (isFinite(groundY)) {
      if (b.y > groundY - WHEEL_R) return doCrash(b, 'hit the ground hard!');
    } else if (b.y - groundHeightAtNearest(b.x) > FALL_CRASH_DEPTH) {
      return doCrash(b, 'fell into the gap!');
    }
  }
  const upsideDown = Math.abs(wrapAngle(b.angle)) > UPSIDE_ANGLE;
  b.upsideTimer = upsideDown ? b.upsideTimer + 1 : 0;
  if (b.upsideTimer > UPSIDE_FRAMES) return doCrash(b, 'flipped over for too long!');

  for (const saw of level.saws) {
    const sy = saw.y0 + Math.sin(gameTime * saw.speed + saw.phase) * saw.amp;
    if (Math.hypot(b.x - saw.x, b.y - sy) < saw.r + 20) return doCrash(b, 'hit a saw blade!');
  }

  for (const s of level.stars) {
    if (!s.got && Math.hypot(b.x - s.x, b.y - s.y) < s.r + 22) { s.got = true; addCoins(20); b.coinsThisRun += 20; sfxStar(); }
  }

  if (b.x > level.finishX) doFinish(b);
}

function groundHeightAtNearest(px) {
  // for fall-depth checks inside a gap, use the last known finite ground height nearby
  for (let d = 0; d < 400; d += 20) {
    const a = groundHeightAt(level, px - d);
    if (isFinite(a)) return a;
  }
  return GROUND_BASE;
}

function doCrash(b, reason) {
  b.crashed = true;
  b.crashTimer = 70;
  shake = Math.max(shake, 14);
  sfxCrash();
  if (numPlayers === 1) {
    document.getElementById('crashReason').textContent = 'You ' + reason;
    document.getElementById('crashScreen').classList.remove('hidden');
  }
}

function doFinish(b) {
  b.finished = true;
  b.finishTime = gameTime;
  sfxFinish();
  if (raceOver) return;
  raceOver = true;
  const starsCollected = level.stars.filter(s => s.got).length;
  const underTime = b.finishTime / 60 <= level.timeLimit;
  let stars = 1;
  if (underTime) stars = 2;
  if (underTime && starsCollected === 3) stars = 3;
  saveStars(currentLevelIndex, stars);
  saveUnlocked(currentLevelIndex + 1);
  addCoins(100); b.coinsThisRun += 100;
  document.getElementById('winStars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  const title = numPlayers === 2 ? 'PLAYER ' + (b.p + 1) + ' WINS THE RACE!' : 'TRACK COMPLETE';
  document.querySelector('#winScreen h1').textContent = title;
  let stats = 'Time: ' + (b.finishTime / 60).toFixed(1) + 's (limit ' + level.timeLimit.toFixed(1) + 's)  ·  Stars: ' + starsCollected + '/3  ·  Coins: +' + b.coinsThisRun;
  if (numPlayers === 2) {
    const other = bikes[1 - b.p];
    stats += '\nPlayer ' + (1 - b.p + 1) + ': ' + (other.finished ? (other.finishTime / 60).toFixed(1) + 's' : (other.crashed ? 'crashed' : 'still racing') );
  }
  document.getElementById('winStats').textContent = stats;
  document.getElementById('btnNextLevel').disabled = currentLevelIndex >= TOTAL_LEVELS - 1;
  document.getElementById('winScreen').classList.remove('hidden');
}

// ============================================================
// Main loop
// ============================================================
function update() {
  if (!running || paused) return;
  if (!raceOver) {
    for (const b of bikes) {
      if (b.crashed) {
        if (--b.crashTimer <= 0) respawnBike(b);
        continue;
      }
      if (b.finished) continue;
      stepPhysics(b);
    }
    gameTime++;
  }

  const lead = bikes[0];
  const speed = Math.hypot(lead.vx, lead.vy);
  const stats = bikePhysics(currentBike(0));
  setEngineSound(clamp(speed / stats.maxSpeed, 0, 1), KEYMAPS[0].gas.some(k => keys[k]));

  const minX = Math.min(...bikes.map(b => b.x)), maxX = Math.max(...bikes.map(b => b.x));
  const midX = (minX + maxX) / 2, midY = bikes.reduce((s, b) => s + b.y, 0) / bikes.length;
  const spread = numPlayers === 2 ? (maxX - minX) : 0;
  const targetZoom = clamp(1 - speed / 70 - spread / 1400, 0.55, 1);
  camera.zoom += (targetZoom - camera.zoom) * 0.05;
  const targetX = midX - W / (2.6 * camera.zoom);
  const targetY = clamp(midY - H / 2, -200, 250);
  camera.x += (targetX - camera.x) * 0.12;
  camera.y += (targetY - camera.y) * 0.08;
  if (shake > 0) shake *= 0.85; if (shake < 0.1) shake = 0;

  for (const b of bikes) for (let i = b.flipPopups.length - 1; i >= 0; i--) { if (--b.flipPopups[i].t <= 0) b.flipPopups.splice(i, 1); }
}

// ============================================================
// Rendering
// ============================================================
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!level) return;
  const pal = level.palette;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.sky[0]); g.addColorStop(1, pal.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const shx = (Math.random() - 0.5) * shake, shy = (Math.random() - 0.5) * shake;
  ctx.save();
  ctx.translate(W / 2 + shx, H / 2 + shy);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-W / 2, -H / 2);
  ctx.translate(-camera.x, -camera.y);

  drawTerrain(pal);
  drawDecor(pal);

  for (const saw of level.saws) {
    const sy = saw.y0 + Math.sin(gameTime * saw.speed + saw.phase) * saw.amp;
    ctx.save(); ctx.translate(saw.x, sy); ctx.rotate(gameTime * 0.3);
    ctx.fillStyle = '#ccc';
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(saw.r, -6); ctx.lineTo(saw.r + 8, 0); ctx.lineTo(saw.r, 6); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, saw.r * 0.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  for (const s of level.stars) {
    if (s.got) continue;
    drawStar(s.x, s.y + Math.sin(gameTime * 0.08 + s.x) * 4, s.r);
  }

  drawFinish();
  for (const b of bikes) if (!b.crashed) drawBike(b);

  ctx.restore();
  drawFlipPopups();
}

function drawTerrain(pal) {
  const i0 = Math.max(0, binarySearchX(level.points, camera.x - 100));
  const i1 = Math.min(level.points.length - 1, binarySearchX(level.points, camera.x + W / camera.zoom + 100) + 1);
  ctx.beginPath();
  let started = false;
  for (let i = i0; i <= i1; i++) {
    const p = level.points[i];
    const inGap = level.gaps.some(gp => p.x >= gp.x0 - 1 && p.x <= gp.x1 + 1);
    if (inGap) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(level.points[i1].x, H + 200);
  ctx.lineTo(level.points[i0].x, H + 200);
  ctx.closePath();
  ctx.fillStyle = pal.ground; ctx.fill();

  // gap floor (lava/pit)
  for (const gp of level.gaps) {
    ctx.fillStyle = level.world === 4 ? '#ff4010' : '#1a1410';
    ctx.fillRect(gp.x0, H - 80, gp.x1 - gp.x0, 260);
  }
  // zones overlay
  for (const z of level.zones) {
    ctx.fillStyle = z.kind === 'ice' ? 'rgba(200,240,255,0.55)' : 'rgba(90,60,20,0.55)';
    ctx.fillRect(z.x0, GROUND_BASE - 160, z.x1 - z.x0, 220);
  }

  ctx.strokeStyle = pal.groundLine; ctx.lineWidth = 4;
  ctx.beginPath(); started = false;
  for (let i = i0; i <= i1; i++) {
    const p = level.points[i];
    const inGap = level.gaps.some(gp => p.x >= gp.x0 - 1 && p.x <= gp.x1 + 1);
    if (inGap) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}
function binarySearchX(points, px) {
  let lo = 0, hi = points.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (points[m].x < px) lo = m; else hi = m; }
  return lo;
}
function drawDecor(pal) {
  ctx.fillStyle = pal.deco; ctx.globalAlpha = 0.35;
  const spacing = 240;
  const start = Math.floor(camera.x / spacing) * spacing;
  for (let x = start; x < camera.x + W / camera.zoom + spacing; x += spacing) {
    const gy = groundHeightAt(level, x);
    if (!isFinite(gy)) continue;
    if (level.world === 0) { ctx.fillRect(x, gy - 30, 6, 30); ctx.fillRect(x - 10, gy - 22, 6, 22); ctx.fillRect(x + 10, gy - 18, 6, 18); }
    else if (level.world === 1) { ctx.fillRect(x, gy - 140, 30, 140); }
    else if (level.world === 2) { ctx.beginPath(); ctx.arc(x, gy - 10, 16, Math.PI, 0); ctx.fill(); }
    else if (level.world === 3) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + 15, gy - 60); ctx.lineTo(x + 30, gy); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, gy - 8, 12, 0, 6.3); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawStar(x, y, r) {
  ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = '#a87a10'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + i * (2 * Math.PI / 5), a2 = a1 + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
    ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
}
function drawFinish() {
  const fx = level.finishX, fy = groundHeightAt(level, fx);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? '#111' : '#fff';
    ctx.fillRect(fx - 3, fy - 10 - i * 20, 20, 20);
  }
  ctx.fillStyle = '#999'; ctx.fillRect(fx - 3, fy - 130, 4, 130);
  ctx.fillRect(fx + 13, fy - 130, 4, 130);
  ctx.fillStyle = '#e8443b'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FINISH', fx + 7, fy - 136);
}

function colorsFor(p) { return p === 1 ? { body: '#ff5b7a', helmet: '#ffffff' } : loadColors(); }

function drawBike(bike) {
  const colors = colorsFor(bike.p);
  const forward = { x: Math.cos(bike.angle), y: Math.sin(bike.angle) };
  const rear = { x: bike.x - HALF_WB * forward.x, y: bike.y - HALF_WB * forward.y };
  const front = { x: bike.x + HALF_WB * forward.x, y: bike.y + HALF_WB * forward.y };

  ctx.save();
  ctx.translate(bike.x, bike.y); ctx.rotate(bike.angle);
  // frame
  ctx.strokeStyle = '#222'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-HALF_WB, 0); ctx.lineTo(0, -22); ctx.lineTo(HALF_WB, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -22); ctx.lineTo(6, -2); ctx.stroke();
  ctx.fillStyle = colors.body; ctx.fillRect(-16, -20, 26, 10);
  // rider
  const lean = clamp(bike.angVel * 6, -0.5, 0.5);
  ctx.save(); ctx.translate(-2, -26); ctx.rotate(lean * 0.4);
  ctx.strokeStyle = colors.body; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -22); ctx.stroke();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(14, 2); ctx.stroke(); // arm to bars
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(14, 10); ctx.stroke(); // leg to peg
  ctx.fillStyle = colors.helmet;
  ctx.beginPath(); ctx.arc(-6, -28, 9, 0, 6.3); ctx.fill();
  ctx.restore();
  ctx.restore();

  drawWheel(rear, bike.angle, bike.rearGrounded);
  drawWheel(front, bike.angle, bike.frontGrounded);
}
function drawWheel(pos, angle, grounded) {
  ctx.save();
  ctx.translate(pos.x, pos.y);
  ctx.rotate(gameTime * 0.3 + angle);
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, WHEEL_R, 0, 6.3); ctx.fill();
  ctx.strokeStyle = grounded ? '#ffd54a' : '#666'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, WHEEL_R - 3, 0, 6.3); ctx.stroke();
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(i * 1.26) * WHEEL_R, Math.sin(i * 1.26) * WHEEL_R); ctx.stroke(); }
  ctx.restore();
}
function drawFlipPopups() {
  const el = document.getElementById('flipPopup');
  const all = bikes.flatMap(b => b.flipPopups);
  if (!all.length) { el.style.opacity = 0; return; }
  const p = all[all.length - 1];
  el.textContent = p.text;
  el.style.opacity = Math.min(1, p.t / 20);
}

// ============================================================
// HUD
// ============================================================
function updateHud() {
  if (!running) return;
  const lead = bikes[0];
  const speed = Math.hypot(lead.vx, lead.vy);
  document.getElementById('hudSpeed').innerHTML = Math.round(speed * 11) + ' <span>km/h</span>';
  document.getElementById('hudTimer').textContent = (gameTime / 60).toFixed(1) + 's';
  const fracs = bikes.map(b => clamp((b.x - level.startX) / (level.finishX - level.startX), 0, 1));
  const leaderIdx = fracs[0] >= (fracs[1] || -1) ? 0 : 1;
  document.getElementById('hudProgressBar').style.width = (fracs[leaderIdx] * 100) + '%';
  document.getElementById('hudProgressBar').style.background = numPlayers === 2 ? colorsFor(leaderIdx).body : '#4ad0ff';
}

// ============================================================
// Input
// ============================================================
window.addEventListener('keydown', (e) => {
  ensureAudio();
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Space' && running && !paused) restartLevel();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { keys = {}; });

function bindTouch(id, code) {
  const el = document.getElementById(id);
  const on = (e) => { e.preventDefault(); ensureAudio(); keys[code] = true; };
  const off = (e) => { e.preventDefault(); keys[code] = false; };
  el.addEventListener('touchstart', on); el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
  el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
}
bindTouch('tGas', 'KeyW'); bindTouch('tBrake', 'KeyS'); bindTouch('tLeft', 'KeyA'); bindTouch('tRight', 'KeyD');

// ============================================================
// UI wiring
// ============================================================
function showScreen(id) { document.getElementById(id).classList.remove('hidden'); }
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }
function hideAllScreens() { ['menu', 'levelSelect', 'garage', 'pauseScreen', 'crashScreen', 'winScreen'].forEach(hideScreen); }

function startGame(idx) {
  hideAllScreens();
  document.getElementById('hud').classList.remove('hidden');
  const touch = document.getElementById('touchControls');
  if (numPlayers === 1 && 'ontouchstart' in window) touch.classList.remove('hidden'); else touch.classList.add('hidden');
  loadLevel(idx);
  running = true; paused = false;
}
function backToMenu() {
  running = false;
  document.getElementById('hud').classList.add('hidden');
  hideAllScreens();
  showScreen('menu');
}

function buildLevelGrid() {
  const grid = document.getElementById('levelGrid');
  grid.innerHTML = '';
  const unlocked = loadUnlocked();
  const stars = loadStars();
  for (let i = selectedWorldTab * 6; i < selectedWorldTab * 6 + 6; i++) {
    const btn = document.createElement('button');
    const s = stars[i] || 0;
    btn.innerHTML = (i + 1) + '<div class="stars">' + '★'.repeat(s) + '☆'.repeat(3 - s) + '</div>';
    btn.disabled = i > unlocked;
    if (i === currentLevelIndex) btn.classList.add('current');
    btn.addEventListener('click', () => startGame(i));
    grid.appendChild(btn);
  }
}
function buildWorldTabs() {
  const wrap = document.getElementById('worldTabs');
  wrap.innerHTML = '';
  WORLDS.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.textContent = (i + 1) + '. ' + name;
    if (i === selectedWorldTab) btn.classList.add('active');
    btn.addEventListener('click', () => { selectedWorldTab = i; buildWorldTabs(); buildLevelGrid(); });
    wrap.appendChild(btn);
  });
}

function buildGarage() {
  document.getElementById('coinCount').textContent = 'Coins: ' + loadCoins();
  const owned = loadOwnedBikes();
  const sel = loadBikeSel();
  const list = document.getElementById('bikeList');
  list.innerHTML = '';
  BIKES.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'bikeRow' + (i === sel ? ' selected' : '');
    const stats = [['SPD', b.speed], ['ACC', b.accel], ['GRP', b.grip], ['SUS', b.susp], ['WGT', b.weight]];
    row.innerHTML =
      '<div class="bikeName">' + b.name + '</div>' +
      '<div class="bars">' + stats.map(s => '<div>' + s[0] + '<div class="statBar"><i style="width:' + s[1] + '%"></i></div></div>').join('') + '</div>';
    const btn = document.createElement('button');
    if (owned.includes(i)) {
      btn.textContent = i === sel ? 'Selected' : 'Select';
      btn.disabled = i === sel;
      btn.addEventListener('click', () => { saveBikeSel(i); buildGarage(); });
    } else {
      btn.textContent = 'Buy (' + b.cost + ')';
      btn.addEventListener('click', () => {
        if (spendCoins(b.cost)) { const o = loadOwnedBikes(); o.push(i); saveOwnedBikes(o); saveBikeSel(i); buildGarage(); }
      });
    }
    row.appendChild(btn);
    list.appendChild(row);
  });

  const colors = loadColors();
  const picks = document.getElementById('colorPicks');
  picks.innerHTML = '<b style="width:100%">Suit</b>';
  BODY_COLORS.forEach(c => picks.appendChild(swatch(c, colors.body === c, () => { colors.body = c; saveColors(colors); buildGarage(); })));
  const picks2 = document.createElement('div');
  picks2.style.cssText = 'display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:4px';
  picks2.innerHTML = '<b style="width:100%">Helmet</b>';
  HELMET_COLORS.forEach(c => picks2.appendChild(swatch(c, colors.helmet === c, () => { colors.helmet = c; saveColors(colors); buildGarage(); })));
  picks.after(picks2);
}
function swatch(color, active, onClick) {
  const d = document.createElement('div');
  d.className = 'swatch' + (active ? ' active' : '');
  d.style.background = color;
  d.addEventListener('click', onClick);
  return d;
}

function setMode(n) {
  numPlayers = n;
  document.getElementById('btn1P').classList.toggle('selected', n === 1);
  document.getElementById('btn2P').classList.toggle('selected', n === 2);
}
document.getElementById('btn1P').addEventListener('click', () => setMode(1));
document.getElementById('btn2P').addEventListener('click', () => setMode(2));
setMode(1);

document.getElementById('btnPlay').addEventListener('click', () => startGame(loadUnlocked()));
document.getElementById('btnLevels').addEventListener('click', () => { buildWorldTabs(); buildLevelGrid(); hideAllScreens(); showScreen('levelSelect'); });
document.getElementById('btnBackFromSelect').addEventListener('click', () => { hideAllScreens(); showScreen('menu'); });
document.getElementById('btnGarage').addEventListener('click', () => { buildGarage(); hideAllScreens(); showScreen('garage'); });
document.getElementById('btnBackFromGarage').addEventListener('click', () => { hideAllScreens(); showScreen('menu'); });
document.getElementById('btnMute').addEventListener('click', (e) => {
  audio.muted = !audio.muted; saveMute(audio.muted);
  e.target.textContent = 'Sound: ' + (audio.muted ? 'Off' : 'On');
});
(function initMuteLabel() { document.getElementById('btnMute').textContent = 'Sound: ' + (loadMute() ? 'Off' : 'On'); })();

document.getElementById('btnPause').addEventListener('click', () => { paused = true; showScreen('pauseScreen'); });
document.getElementById('btnResume').addEventListener('click', () => { paused = false; hideScreen('pauseScreen'); });
document.getElementById('btnPauseRestart').addEventListener('click', () => { paused = false; hideScreen('pauseScreen'); restartLevel(); });
document.getElementById('btnPauseMenu').addEventListener('click', backToMenu);
document.getElementById('btnRestart').addEventListener('click', () => restartLevel());

document.getElementById('btnNextLevel').addEventListener('click', () => startGame(clamp(currentLevelIndex + 1, 0, TOTAL_LEVELS - 1)));
document.getElementById('btnRetryWin').addEventListener('click', () => startGame(currentLevelIndex));
document.getElementById('btnWinMenu').addEventListener('click', () => { running = false; document.getElementById('hud').classList.add('hidden'); buildWorldTabs(); buildLevelGrid(); hideAllScreens(); showScreen('levelSelect'); });

// ============================================================
// Boot
// ============================================================
loadLevel(0);
running = false;
draw();
showScreen('menu');

let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  updateHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
