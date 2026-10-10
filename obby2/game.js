'use strict';

// ============================================================
// Setup
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const CANVAS_W = canvas.width;
const CANVAS_H = canvas.height;
const TOTAL_LEVELS = 150;
const GROUND_Y = 460;

const GRAVITY = 0.55;
const JUMP_VEL = -12.6;
const JUMP_HOLD_ACCEL = 0.37;  // extra upward push per frame while jump is held
const JUMP_MAX_HOLD = 20;      // frames the hold-boost can apply - the "limit"
const MOVE_SPEED = 3.8;
const MAX_FALL = 16;
const PLAYER_W = 19;
const PLAYER_H = 27;
const ZOOM = 0.72; // shrinks everything on screen (world stays the same size underneath)
const BOUNCE_VEL = -17.5;

const STORAGE_KEY = 'obby2_unlocked_level';

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ============================================================
// Seeded RNG (mulberry32) -- deterministic per level
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
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// The farthest a jump can horizontally reach given how much higher (negative dy)
// or lower (positive dy) the landing spot is, using the same physics as the player.
// Generators use this to make sure every gap they create is actually jumpable.
function maxJumpReach(dy) {
  const disc = JUMP_VEL * JUMP_VEL + 2 * GRAVITY * dy;
  if (disc < 0) return 0;
  return MOVE_SPEED * (-JUMP_VEL + Math.sqrt(disc)) / GRAVITY;
}

// ============================================================
// Chainable horizontal segment generators.
// Each takes (startX, startY, diff, rng) and returns
// { platforms, spikes, endX, endY }
// ============================================================

function segGaps(startX, startY, diff, rng) {
  const platforms = [], spikes = [];
  let x = startX, y = startY;
  const count = Math.round(5 + diff * 5);
  for (let i = 0; i < count; i++) {
    const rawDy = rand(rng, -45, 45) * (0.4 + diff * 0.6);
    const newY = clamp(y + rawDy, GROUND_Y - 4, GROUND_Y + 25);
    const safeGap = Math.max(70, maxJumpReach(newY - y) - 30);
    const gap = Math.min(rand(rng, 60 + diff * 50, 110 + diff * 70), safeGap);
    x += gap;
    const w = Math.max(65, rand(rng, 150 - diff * 50, 220 - diff * 50));
    y = newY;
    platforms.push({ x, y, w, h: 24 });
    if (rng() < 0.15 + diff * 0.13) {
      const sw = Math.min(w * 0.4, 28);
      spikes.push({ x: x + (rng() < 0.5 ? 4 : w - sw - 4), y: y - 16, w: sw, h: 16 });
    }
    x += w;
  }
  return { platforms, spikes, endX: x, endY: y };
}

function segSpikeFloor(startX, startY, diff, rng) {
  const platforms = [], spikes = [];
  let x = startX, y = startY;
  const count = Math.round(5 + diff * 5);
  for (let i = 0; i < count; i++) {
    const rawDy = rand(rng, -35, 35);
    const newY = clamp(y + rawDy, GROUND_Y - 4, GROUND_Y + 14);
    const safeGap = Math.max(70, maxJumpReach(newY - y) - 30);
    const gap = Math.min(rand(rng, 80 + diff * 40, 130 + diff * 55), safeGap);
    const spikeY = GROUND_Y + 30;
    spikes.push({ x: x, y: spikeY, w: gap, h: 26 });
    x += gap;
    const w = Math.max(70, rand(rng, 140 - diff * 40, 200 - diff * 40));
    y = newY;
    platforms.push({ x, y, w, h: 24 });
    if (rng() < 0.12) {
      const sw = Math.min(w * 0.35, 24);
      spikes.push({ x: x + w / 2 - sw / 2, y: y - 16, w: sw, h: 16 });
    }
    x += w;
  }
  return { platforms, spikes, endX: x, endY: y };
}

function segStairs(startX, startY, diff, rng) {
  const platforms = [], spikes = [];
  let x = startX, y = startY;
  const count = Math.round(6 + diff * 5);
  let dir = -1;
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % 4 === 0) dir *= -1; // occasional dip for variety
    const stepH = rand(rng, 30, 55);
    const newY = clamp(y + dir * stepH, GROUND_Y - 4, GROUND_Y + 25);
    const safeGap = Math.max(60, maxJumpReach(newY - y) - 30 - PLAYER_W);
    const gap = Math.min(rand(rng, 80, 120 + diff * 40), safeGap);
    x += gap;
    y = newY;
    const w = Math.max(55, rand(rng, 90, 140) - diff * 30);
    platforms.push({ x, y, w, h: 22 });
    if (i % 3 === 2 && rng() < 0.38) {
      const sw = Math.min(w * 0.4, 26);
      spikes.push({ x: x + (rng() < 0.5 ? 2 : w - sw - 2), y: y - 16, w: sw, h: 16 });
    }
    x += w;
  }
  return { platforms, spikes, endX: x, endY: y };
}

function segMoving(startX, startY, diff, rng) {
  const platforms = [], spikes = [];
  let x = startX, y = startY;
  const count = Math.round(5 + diff * 5);
  for (let i = 0; i < count; i++) {
    const gap = rand(rng, 120 + diff * 40, 170 + diff * 55);
    x += gap;
    const w = Math.max(70, rand(rng, 110, 150));
    const dy = rand(rng, -40, 40);
    y = clamp(y + dy, GROUND_Y - 4, GROUND_Y + 14);
    const axis = rng() < 0.6 ? 'x' : 'y';
    const amp = rand(rng, 50, 90);
    const speed = rand(rng, 0.015, 0.03) * (1 + diff * 0.4);
    platforms.push({
      x, y, w, h: 22,
      move: { axis, amp, speed, phase: rng() * Math.PI * 2, base: axis === 'x' ? x : y }
    });
    x += w;
    // occasional static rest platform between movers
    if (i % 2 === 1) {
      const gap2 = rand(rng, 90, 130);
      x += gap2;
      const w2 = rand(rng, 80, 130);
      platforms.push({ x, y, w: w2, h: 22 });
      x += w2;
    }
  }
  return { platforms, spikes, endX: x, endY: y };
}

function segWalls(startX, startY, diff, rng) {
  // continuous ground with embedded spike patches and walls to hop over
  const platforms = [], spikes = [];
  let x = startX, y = startY;
  const groundStartX = x;
  const segLen = Math.round(900 + diff * 500);
  platforms.push({ x: groundStartX, y, w: segLen, h: 30 });
  let cx = groundStartX + rand(rng, 100, 160);
  while (cx < groundStartX + segLen - 120) {
    if (rng() < 0.5) {
      // wall to jump over
      const wallW = 26;
      const wallH = rand(rng, 55, 75 + diff * 20);
      platforms.push({ x: cx, y: y - wallH, w: wallW, h: wallH + 10 });
      cx += wallW + rand(rng, 140, 220);
    } else {
      // spike patch on the ground
      const sw = rand(rng, 40, 90 + diff * 30);
      spikes.push({ x: cx, y: y - 16, w: sw, h: 16 });
      cx += sw + rand(rng, 120, 200);
    }
  }
  x = groundStartX + segLen;
  return { platforms, spikes, endX: x, endY: y };
}

function segHazards(startX, startY, diff, rng) {
  // A gap sequence like segGaps, but the platforms themselves are the obstacle:
  // some crumble away a moment after you land, some launch you into the air,
  // and some have a spike patrolling back and forth just above them.
  const platforms = [], spikes = [];
  let x = startX, y = startY;
  const count = Math.round(5 + diff * 4);
  for (let i = 0; i < count; i++) {
    const rawDy = rand(rng, -35, 35);
    const newY = clamp(y + rawDy, GROUND_Y - 4, GROUND_Y + 18);
    const safeGap = Math.max(70, maxJumpReach(newY - y) - 30);
    const gap = Math.min(rand(rng, 70 + diff * 40, 120 + diff * 50), safeGap);
    x += gap;
    const w = Math.max(80, rand(rng, 150 - diff * 30, 190 - diff * 30));
    y = newY;
    const plat = { x, y, w, h: 24 };
    const kind = rng();
    if (kind < 0.28) {
      plat.crumble = { full: 50, timer: 50, broken: false };
    } else if (kind < 0.5) {
      plat.bounce = true;
    }
    platforms.push(plat);
    if (i > 0 && rng() < 0.22 + diff * 0.1) {
      const amp = Math.min(w * 0.4, 55);
      spikes.push({
        x: x + w / 2 - 10, y: y - 50, w: 20, h: 16,
        move: { axis: 'x', amp, speed: rand(rng, 0.02, 0.032), phase: rng() * Math.PI * 2, base: x + w / 2 - 10 },
      });
    }
    x += w;
  }
  return { platforms, spikes, endX: x, endY: y };
}

const CHAINABLE = { gaps: segGaps, spikefloor: segSpikeFloor, stairs: segStairs, moving: segMoving, wall: segWalls, hazards: segHazards };
const CHAIN_NAMES = Object.keys(CHAINABLE);

// ============================================================
// Full level generators
// ============================================================
function startPlatformAndPlayers(x, y) {
  const platforms = [{ x, y, w: 200, h: 40 }];
  const start = [
    { x: x + 40, y: y - PLAYER_H },
    { x: x + 100, y: y - PLAYER_H },
  ];
  return { platforms, start };
}

// A held jump can carry a player about 256px above whatever they jumped off of.
// The camera needs enough headroom above the lowest platform to still show them
// at the very top of that arc, not just the platforms themselves.
const MAX_JUMP_RISE = 520;

function boundsFrom(platforms, spikes, goal) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const all = platforms.concat(spikes).concat([goal]);
  for (const o of all) {
    minX = Math.min(minX, o.x);
    maxX = Math.max(maxX, o.x + o.w);
    minY = Math.min(minY, o.y);
    maxY = Math.max(maxY, o.y + o.h);
  }
  return { minX: minX - 60, maxX: maxX + 80, minY: minY - 100 - MAX_JUMP_RISE, maxY: maxY + 100 };
}

function genHorizontal(idx, diff, rng) {
  const startX = 0, startY = GROUND_Y;
  const { platforms: basePlat, start } = startPlatformAndPlayers(startX, startY);
  let platforms = basePlat.slice();
  let spikes = [];
  let cx = startX + 200, cy = startY;

  const isCombo = idx > 0 && idx % 8 === 7;
  let segCount = isCombo ? 2 : 1;
  let chosenNames = [];
  if (isCombo) {
    for (let i = 0; i < segCount; i++) chosenNames.push(pick(rng, CHAIN_NAMES));
  } else {
    chosenNames.push(CHAIN_NAMES[idx % CHAIN_NAMES.length]);
  }

  for (const name of chosenNames) {
    const seg = CHAINABLE[name](cx, cy, diff, rng);
    platforms = platforms.concat(seg.platforms);
    spikes = spikes.concat(seg.spikes);
    cx = seg.endX + 20;
    cy = seg.endY;
  }

  const goalW = 90, goalH = 60;
  const goalPlatform = { x: cx - 20, y: cy, w: goalW + 40, h: 24 };
  platforms.push(goalPlatform);
  const goal = { x: cx, y: cy - goalH, w: goalW, h: goalH };
  const bounds = boundsFrom(platforms, spikes, goal);
  const voidY = GROUND_Y + 240;

  return {
    orientation: 'h', platforms, spikes, goal, start, bounds, voidY,
    label: isCombo ? 'combo: ' + chosenNames.join(' + ') : chosenNames[0],
  };
}

function genClimb(idx, diff, rng) {
  const startX = 0, startY = GROUND_Y;
  const { platforms: basePlat, start } = startPlatformAndPlayers(startX, startY);
  const platforms = basePlat.slice();
  const spikes = [];
  let x = startX, y = startY, w = 200, lastW = 200;
  const steps = Math.round(8 + diff * 7);
  let side = 1;
  for (let i = 0; i < steps; i++) {
    const dy = rand(rng, 78, 118);
    const newW = Math.max(70, rand(rng, 150 - diff * 40, 190 - diff * 40));
    // Pick a real edge-to-edge gap (not a raw offset) so this step never overlaps the
    // previous platform - overlap makes it ambiguous which one a vertical jump lands on -
    // and never exceeds how far a jump can actually carry while gaining this much height.
    const reach = maxJumpReach(-dy);
    const gap = Math.min(rand(rng, 40, 100), Math.max(24, reach - newW - 30 - PLAYER_W));
    const prevX0 = x, prevX1 = x + w;
    y -= dy;
    x = side > 0 ? prevX1 + gap : prevX0 - gap - newW;
    x = clamp(x, 20, 680 - newW);
    w = newW;
    side *= -1;
    platforms.push({ x, y, w, h: 22 });
    lastW = w;
    if (i > 2 && rng() < 0.11 + diff * 0.1) {
      const sw = Math.min(w * 0.35, 24);
      spikes.push({ x: x + w / 2 - sw / 2, y: y - 16, w: sw, h: 16 });
    }
  }

  // final wall to jump over onto the goal platform (climb-then-clear-the-wall).
  // Kept low (well under the ~144px max jump height) and close (well under max jump
  // reach) so the last jump of the climb is always physically possible.
  const wallTopY = y - 60;
  const wallLeft = x + lastW + 50;
  const wall = { x: wallLeft, y: wallTopY, w: 34, h: 420 };
  platforms.push(wall);
  const goal = { x: wallLeft + 60, y: wallTopY - 60, w: 130, h: 60 };
  platforms.push({ x: wallLeft + 40, y: wallTopY, w: 170, h: 24 }); // landing platform behind wall

  const bounds = boundsFrom(platforms, spikes, goal);
  const voidY = startY + 240;

  return { orientation: 'v', platforms, spikes, goal, start, bounds, voidY, label: 'climb' };
}

function generateLevel(idx) {
  const rng = mulberry32(idx * 9973 + 12345);
  const diff = clamp(idx / (TOTAL_LEVELS - 1), 0, 1);
  // Every 4th level (after the first few) is a vertical climb; rest cycle through
  // horizontal archetypes (with combos mixed in every 7th).
  const isClimb = idx >= 2 && idx % 4 === 3;
  const level = isClimb ? genClimb(idx, diff, rng) : genHorizontal(idx, diff, rng);
  level.index = idx;
  return level;
}

// ============================================================
// Game state
// ============================================================
let currentLevelIndex = 0;
let level = null;
let players = [];
let keys = {};
let running = false;
let deathTimer = 0;
let winTriggered = false;
let camera = { x: 0, y: 0 };
let numPlayers = 1;

function loadUnlocked() {
  const v = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  return clamp(isNaN(v) ? 0 : v, 0, TOTAL_LEVELS - 1);
}
function saveUnlocked(v) {
  const cur = loadUnlocked();
  if (v > cur) localStorage.setItem(STORAGE_KEY, String(v));
}

function makePlayer(sx, sy, color, keyLeft, keyRight, keyJump) {
  return {
    x: sx, y: sy, w: PLAYER_W, h: PLAYER_H,
    vx: 0, vy: 0, onGround: false, onPlatform: null,
    color, keyLeft, keyRight, keyJump,
    canJump: true, jumpHold: JUMP_MAX_HOLD,
  };
}

function loadLevel(idx) {
  currentLevelIndex = clamp(idx, 0, TOTAL_LEVELS - 1);
  level = generateLevel(currentLevelIndex);
  resetPlayers();
  winTriggered = false;
  deathTimer = 0;
  document.getElementById('hudLevel').textContent = 'Level ' + (currentLevelIndex + 1) + ' / ' + TOTAL_LEVELS;
  document.getElementById('hudHint').textContent = numPlayers === 2
    ? 'P1: Arrow Keys | P2: WASD | hold jump to jump higher'
    : 'Arrow Keys to move and jump | hold jump to jump higher';
}

function resetPlayers() {
  const s = level.start;
  players = [makePlayer(s[0].x, s[0].y, '#4ad0ff', ['ArrowLeft'], ['ArrowRight'], ['ArrowUp'])];
  if (numPlayers === 2) {
    players.push(makePlayer(s[1].x, s[1].y, '#ff5b7a', ['a', 'A'], ['d', 'D'], ['w', 'W']));
  }
  for (const p of level.platforms) {
    if (p.crumble) { p.crumble.timer = p.crumble.full; p.crumble.broken = false; }
  }
  const midX = numPlayers === 2 ? (s[0].x + s[1].x) / 2 : s[0].x;
  const midY = numPlayers === 2 ? (s[0].y + s[1].y) / 2 : s[0].y;
  camera.x = clamp(midX - CANVAS_W / 2, level.bounds.minX, Math.max(level.bounds.minX, level.bounds.maxX - CANVAS_W));
  camera.y = clamp(midY - CANVAS_H / 2, level.bounds.minY, Math.max(level.bounds.minY, level.bounds.maxY - CANVAS_H));
}

function killPlayers(reason) {
  if (deathTimer > 0) return;
  deathTimer = 45;
  document.getElementById('deathReason').textContent = reason;
  showScreen('deathScreen');
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function platformPos(p, t) {
  if (!p.move) return { x: p.x, y: p.y };
  const off = Math.sin(t * p.move.speed + p.move.phase) * p.move.amp;
  if (p.move.axis === 'x') return { x: p.move.base + off, y: p.y };
  return { x: p.x, y: p.move.base + off };
}

let timeAcc = 0;

function updatePhysics(dt) {
  timeAcc += dt;
  // precompute moving-platform current positions
  const platPos = level.platforms.map(p => platformPos(p, timeAcc));

  for (const pl of players) {
    const left = pl.keyLeft.some(k => keys[k]);
    const right = pl.keyRight.some(k => keys[k]);
    const jump = pl.keyJump.some(k => keys[k]);

    pl.vx = 0;
    if (left) pl.vx -= MOVE_SPEED;
    if (right) pl.vx += MOVE_SPEED;

    if (jump && pl.onGround && pl.canJump) {
      pl.vy = JUMP_VEL;
      pl.onGround = false;
      pl.canJump = false;
      pl.jumpHold = 0;
    } else if (jump && pl.jumpHold < JUMP_MAX_HOLD && pl.vy < 0) {
      // Holding the jump key adds a little extra lift each frame, up to a hard
      // limit - the longer you hold it (within that cap), the higher you go.
      pl.vy -= JUMP_HOLD_ACCEL;
      pl.jumpHold++;
    }
    if (!jump) { pl.canJump = true; pl.jumpHold = JUMP_MAX_HOLD; }

    pl.vy = Math.min(pl.vy + GRAVITY, MAX_FALL);

    // carry with moving platform
    let carryDX = 0, carryDY = 0;
    if (pl.onPlatform) {
      const idx = level.platforms.indexOf(pl.onPlatform);
      if (idx >= 0 && pl.onPlatform.move) {
        const prev = pl._platPrev || platPos[idx];
        carryDX = platPos[idx].x - prev.x;
        carryDY = platPos[idx].y - prev.y;
      }
    }

    // Ride along with the platform first (both axes at once) so the horizontal
    // collision check below never sees a stale Y from before the platform moved -
    // that mismatch was what pushed players off platforms moving up/down fast.
    pl.x += carryDX;
    pl.y += carryDY;

    // horizontal move
    pl.x += pl.vx;
    resolveAxis(pl, platPos, 'x');

    // vertical move
    pl.y += pl.vy;
    pl.onGround = false;
    pl.onPlatform = null;
    resolveAxis(pl, platPos, 'y');

    // store platform prev positions for next-frame carry calc
    if (pl.onPlatform) {
      const idx = level.platforms.indexOf(pl.onPlatform);
      pl._platPrev = platPos[idx];
    } else {
      pl._platPrev = null;
    }

    // crumbling platforms wear down the moment you're standing on them
    if (pl.onPlatform && pl.onPlatform.crumble && !pl.onPlatform.crumble.broken) {
      pl.onPlatform.crumble.timer--;
      if (pl.onPlatform.crumble.timer <= 0) pl.onPlatform.crumble.broken = true;
    }

    // hazards
    for (const s of level.spikes) {
      const spos = s.move ? platformPos(s, timeAcc) : s;
      if (rectsOverlap(pl, { x: spos.x, y: spos.y, w: s.w, h: s.h })) { killPlayers('Touched a spike!'); return; }
    }
    if (pl.y > level.voidY) { killPlayers('Fell into the void!'); return; }
  }

  // goal check: both players overlapping goal
  if (!winTriggered && players.every(pl => rectsOverlap(pl, level.goal))) {
    winTriggered = true;
    saveUnlocked(currentLevelIndex + 1);
    showScreen('winScreen');
  }

  // camera follows the midpoint of the active players, clamped to bounds
  const midX = players.length === 2 ? (players[0].x + players[1].x) / 2 : players[0].x;
  const midY = players.length === 2 ? (players[0].y + players[1].y) / 2 : players[0].y;
  const targetX = clamp(midX - CANVAS_W / 2, level.bounds.minX, Math.max(level.bounds.minX, level.bounds.maxX - CANVAS_W));
  const targetY = clamp(midY - CANVAS_H / 2, level.bounds.minY, Math.max(level.bounds.minY, level.bounds.maxY - CANVAS_H));
  camera.x += (targetX - camera.x) * 0.2;
  // Horizontal levels keep everything (platforms, jump height) small enough to fit
  // in one screen, so the camera stays put vertically instead of chasing jumps.
  // Climbing levels genuinely go far up, so they still scroll.
  if (level.orientation === 'v') camera.y += (targetY - camera.y) * 0.2;
}

function resolveAxis(pl, platPos, axis) {
  for (let i = 0; i < level.platforms.length; i++) {
    const raw = level.platforms[i];
    if (raw.crumble && raw.crumble.broken) continue; // gone - no longer solid
    const pos = platPos[i];
    const box = { x: pos.x, y: pos.y, w: raw.w, h: raw.h };
    if (!rectsOverlap(pl, box)) continue;
    if (axis === 'x') {
      if (pl.vx > 0 || (pl.x + pl.w - box.x) < (box.x + box.w - pl.x)) {
        pl.x = box.x - pl.w;
      } else {
        pl.x = box.x + box.w;
      }
    } else {
      if (pl.vy >= 0) {
        pl.y = box.y - pl.h;
        if (raw.bounce) {
          pl.vy = BOUNCE_VEL;
          pl.canJump = false;
          pl.jumpHold = JUMP_MAX_HOLD;
        } else {
          pl.vy = 0;
          pl.onGround = true;
          pl.onPlatform = raw;
        }
      } else {
        pl.y = box.y + box.h;
        pl.vy = 0;
      }
    }
  }
}

// ============================================================
// Rendering
// ============================================================
function draw() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // background
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#1b1b3a');
  grad.addColorStop(1, '#0d0d18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-CANVAS_W / 2, -CANVAS_H / 2);
  ctx.translate(-camera.x, -camera.y);

  // platforms
  const t = timeAcc;
  for (const p of level.platforms) {
    if (p.crumble && p.crumble.broken) continue;
    const pos = platformPos(p, t);
    if (p.crumble) {
      const ratio = p.crumble.timer / p.crumble.full;
      const r = Math.round(63 + (224 - 63) * (1 - ratio));
      const g = Math.round(111 + (72 - 111) * (1 - ratio));
      const b = Math.round(174 + (59 - 174) * (1 - ratio));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
    } else if (p.bounce) {
      ctx.fillStyle = '#ffb640';
    } else {
      ctx.fillStyle = p.move ? '#7a5cff' : '#3f6fae';
    }
    ctx.fillRect(pos.x, pos.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.strokeRect(pos.x, pos.y, p.w, p.h);
    if (p.bounce) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(pos.x + p.w / 2, pos.y - 6);
      ctx.lineTo(pos.x + p.w / 2 - 8, pos.y + 4);
      ctx.lineTo(pos.x + p.w / 2 + 8, pos.y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  // spikes
  for (const s of level.spikes) {
    const spos = s.move ? platformPos(s, t) : s;
    ctx.fillStyle = s.move ? '#ff8a3d' : '#e8443b';
    const n = Math.max(1, Math.round(s.w / 16));
    const sw = s.w / n;
    for (let i = 0; i < n; i++) {
      const bx = spos.x + i * sw;
      ctx.beginPath();
      ctx.moveTo(bx, spos.y + s.h);
      ctx.lineTo(bx + sw / 2, spos.y);
      ctx.lineTo(bx + sw, spos.y + s.h);
      ctx.closePath();
      ctx.fill();
    }
  }

  // goal
  ctx.fillStyle = 'rgba(80, 220, 130, 0.35)';
  ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  ctx.strokeStyle = '#57e08a';
  ctx.lineWidth = 2;
  ctx.strokeRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
  ctx.fillStyle = '#57e08a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('GOAL', level.goal.x + level.goal.w / 2, level.goal.y - 6);

  // players
  for (const pl of players) {
    ctx.fillStyle = pl.color;
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
  }

  ctx.restore();
}

// ============================================================
// Main loop
// ============================================================
function loop() {
  if (running) {
    if (deathTimer > 0) {
      deathTimer--;
      if (deathTimer === 0) {
        resetPlayers();
        hideScreen('deathScreen');
      }
    } else if (!winTriggered) {
      updatePhysics(1);
    }
    draw();
  }
  requestAnimationFrame(loop);
}

// ============================================================
// UI wiring
// ============================================================
function showScreen(id) { document.getElementById(id).classList.remove('hidden'); }
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }
function hideAllScreens() {
  ['overlay', 'levelSelect', 'deathScreen', 'winScreen'].forEach(hideScreen);
}

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
    btn.addEventListener('click', () => startGame(i));
    grid.appendChild(btn);
  }
}

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

function setMode(n) {
  numPlayers = n;
  document.getElementById('btn1P').classList.toggle('selected', n === 1);
  document.getElementById('btn2P').classList.toggle('selected', n === 2);
}
document.getElementById('btn1P').addEventListener('click', () => setMode(1));
document.getElementById('btn2P').addEventListener('click', () => setMode(2));
setMode(1);

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
