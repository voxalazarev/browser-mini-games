'use strict';

// ============================================================
// Setup - split-screen third-person 3D city parkour (P1 top, P2 bottom)
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width, H = canvas.height;
const VH = H / 2; // each player's viewport height

const GRAVITY = 0.6;
const JUMP_VEL = 16;   // positive = upward, since y is height above ground
const MAX_FALL = 16;
const MOVE_SPEED = 8;
const TURN_RATE = 0.045;    // radians/frame while a turn key is held
const PLAYER_R = 16;        // collision radius
const CAM_DIST = 220;        // camera sits behind the player
const CAM_HEIGHT = 460;      // camera height above player's feet
const CAM_PITCH = 0.76;      // radians, tilted toward the horizon
const ARENA_HALF = 5400;     // compact grid of skyscrapers
const CELL = 1250;           // building grid pitch - gaps are small enough to jump
const GRID_N = 9;
const IT_SPEED_MULT = 1.2;   // the tagger runs 1.2x faster
const IT_JUMP_MULT = Math.sqrt(1.2); // ...and jumps 1.2x higher
const FREEZE_FRAMES = 180;   // a freshly tagged player is frozen for 3s
const TAG_RANGE = 40;
const WALL_SPEED = 5;        // climbing speed on a wall
const WALL_JUMP_OUT = 10;
const WEB_SPEED = 9;         // slow enough to see coming and dodge
const WEB_COOLDOWN = 300;    // 5s between web shots
const WEB_HIT_RANGE = 45;
const SWING_ANCHOR_FWD = 260, SWING_ANCHOR_UP = 420, SWING_FRAMES = 150, SWING_LAUNCH = 12;
const GRID_STEP = 1000;       // street grid line spacing, scaled with the map
const HEIGHT_MULT = 17;      // skyscrapers: 10x taller than before
const FOCAL = 280;
const SLIDE_FRAMES = 24;
const SLIDE_SPEED_MULT = 1.75;
const MANTLE_REACH = 110;    // how close (horizontally) to a ledge you can mantle from
const MANTLE_MAX_UP = 90;    // how far above your feet a ledge can be to mantle onto
const MANTLE_ANIM_FRAMES = 20; // how long the climb-up animation plays for
const FALL_RESPAWN_HEIGHT = 50; // falling to the street from higher than this respawns you

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }

// ============================================================
// City layouts: scattered rooftop buildings you jump, mantle and
// slide between. The ground (street) and skyline walls are solid.
// ============================================================
const CITIES = [
  [
    { x: -565, z: 270, hx: 85, hz: 85, topY: 110, thick: 110 },
    { x: 495, z: -180, hx: 95, hz: 75, topY: 170, thick: 170 },
    { x: -135, z: -585, hx: 85, hz: 85, topY: 90, thick: 90 },
    { x: 675, z: 585, hx: 80, hz: 80, topY: 220, thick: 220 },
    { x: -740, z: -340, hx: 75, hz: 75, topY: 140, thick: 140 },
    { x: 135, z: 90, hx: 70, hz: 70, topY: 260, thick: 260 },
    { x: 225, z: -495, hx: 55, hz: 55, topY: 60, thick: 60 },
    { x: -315, z: 495, hx: 60, hz: 60, topY: 75, thick: 75 },
    { x: 800, z: -720, hx: 90, hz: 90, topY: 190, thick: 190 },
    { x: -800, z: 720, hx: 90, hz: 90, topY: 150, thick: 150 },
    { x: 900, z: 120, hx: 70, hz: 70, topY: 95, thick: 95 },
    { x: -900, z: -120, hx: 70, hz: 70, topY: 125, thick: 125 },
  ],
  [
    { x: -450, z: -450, hx: 90, hz: 90, topY: 120, thick: 120 },
    { x: 450, z: 450, hx: 90, hz: 90, topY: 120, thick: 120 },
    { x: 450, z: -495, hx: 80, hz: 80, topY: 200, thick: 200 },
    { x: -495, z: 450, hx: 80, hz: 80, topY: 200, thick: 200 },
    { x: 0, z: 0, hx: 105, hz: 105, topY: 290, thick: 290 },
    { x: 90, z: -90, hx: 45, hz: 45, topY: 70, thick: 70 },
    { x: -90, z: 90, hx: 45, hz: 45, topY: 70, thick: 70 },
    { x: 850, z: 0, hx: 85, hz: 85, topY: 160, thick: 160 },
    { x: -850, z: 0, hx: 85, hz: 85, topY: 100, thick: 100 },
    { x: 0, z: 850, hx: 85, hz: 85, topY: 210, thick: 210 },
    { x: 0, z: -850, hx: 85, hz: 85, topY: 130, thick: 130 },
  ],
  [
    { x: -675, z: 0, hx: 75, hz: 110, topY: 100, thick: 100 },
    { x: 675, z: 0, hx: 75, hz: 110, topY: 100, thick: 100 },
    { x: 0, z: -675, hx: 110, hz: 75, topY: 150, thick: 150 },
    { x: 0, z: 675, hx: 110, hz: 75, topY: 150, thick: 150 },
    { x: -340, z: -340, hx: 65, hz: 65, topY: 230, thick: 230 },
    { x: 340, z: 340, hx: 65, hz: 65, topY: 230, thick: 230 },
    { x: -340, z: 340, hx: 50, hz: 50, topY: 65, thick: 65 },
    { x: 340, z: -340, hx: 50, hz: 50, topY: 65, thick: 65 },
    { x: -900, z: -900, hx: 80, hz: 80, topY: 180, thick: 180 },
    { x: 900, z: 900, hx: 80, hz: 80, topY: 180, thick: 180 },
    { x: 900, z: -900, hx: 60, hz: 60, topY: 90, thick: 90 },
    { x: -900, z: 900, hx: 60, hz: 60, topY: 90, thick: 90 },
  ],
];

function buildCity() {
  // varied skyline: sizes, spacing and heights all differ. A building is never
  // more than ~110 above its tallest earlier neighbour (so it can be climbed),
  // but can be much lower - dips and pits between the towers.
  const grid = [];
  let hue = 0;
  for (let i = 0; i < GRID_N; i++) {
    grid[i] = [];
    for (let j = 0; j < GRID_N; j++) {
      const nb = [];
      if (i > 0) nb.push(grid[i - 1][j].topY);
      if (j > 0) nb.push(grid[i][j - 1].topY);
      let topY = nb.length ? nb.reduce((s, n) => s + n, 0) / nb.length + (Math.random() - 0.5) * 1000 : 2200;
      if (nb.length) topY = Math.min(topY, Math.max(...nb) + 110);
      topY = Math.round(clamp(topY, 500, 4500) / 10) * 10;
      const big = Math.random() < 0.22;
      grid[i][j] = {
        x: (i - (GRID_N - 1) / 2) * CELL + (Math.random() - 0.5) * 300,
        z: (j - (GRID_N - 1) / 2) * CELL + (Math.random() - 0.5) * 300,
        hx: 2 * (big ? 110 + Math.random() * 40 : 45 + Math.random() * 60),
        hz: 2 * (big ? 110 + Math.random() * 40 : 45 + Math.random() * 60),
        topY, thick: topY, hue: (hue++ * 47) % 360,
      };
    }
  }
  // keep a minimum gap between neighbours so nothing overlaps
  const MIN_GAP = 225;
  const shrink = (a, b, dist, key) => {
    const gap = dist - a[key] - b[key];
    if (gap < MIN_GAP) {
      const cut = (MIN_GAP - gap) / 2;
      a[key] = Math.max(70, a[key] - cut); b[key] = Math.max(70, b[key] - cut);
    }
  };
  for (let i = 0; i < GRID_N; i++) for (let j = 0; j < GRID_N; j++) {
    const a = grid[i][j];
    if (i + 1 < GRID_N) { const b = grid[i + 1][j]; shrink(a, b, Math.abs(b.x - a.x), 'hx'); }
    if (j + 1 < GRID_N) { const b = grid[i][j + 1]; shrink(a, b, Math.abs(b.z - a.z), 'hz'); }
  }
  return { buildings: grid.flat() };
}

// ============================================================
// Game state
// ============================================================
let city = null;
let players = [];
let mode = '2p';
let running = false;
let elapsed = 0;
let keys = {};

function makePlayer(i, color, sx, sy, sz, yaw) {
  return {
    i, x: sx, z: sz, y: sy, vy: 0, yaw, onGround: true,
    color, walkPhase: 0, moving: false, sliding: 0, prevJump: false,
    spawnX: sx, spawnZ: sz, spawnY: sy, airStartY: sy, isIt: false, frozen: 0,
    vx: 0, vz: 0, web: null, webCd: 0, prevSwing: false, prevShoot: false, dodgeFlash: 0, hitFlash: 0, camYaw: yaw, wall: null, wallCd: 0, touchWall: null,
    mantling: 0, mantleFrom: null, mantleTo: null,
  };
}

let tagCooldown = 0;
let webs = [];   // web shots in flight

function startRun() {
  city = buildCity();
  const at = (i, j) => city.buildings[i * GRID_N + j];
  const b0 = at(3, 3), b1 = at(GRID_N - 4, GRID_N - 4);
  players = [
    makePlayer(0, '#4ad0ff', b0.x, b0.topY, b0.z, Math.atan2(b1.x - b0.x, b1.z - b0.z)),
    makePlayer(1, '#ff5b7a', b1.x, b1.topY, b1.z, Math.atan2(b0.x - b1.x, b0.z - b1.z)),
  ];
  const it = players[Math.random() < 0.5 ? 0 : 1];
  it.isIt = true; it.frozen = FREEZE_FRAMES;
  tagCooldown = FREEZE_FRAMES;
  elapsed = 0;
  webs = [];
  updateHud();
}

function updateHud() {
  const secs = Math.floor(elapsed / 60);
  const m = Math.floor(secs / 60), s = secs % 60;
  document.getElementById('hudTimer').textContent = m + ':' + String(s).padStart(2, '0');
  const names = mode === 'bot' ? ['You', 'Bot'] : ['P1', 'P2'];
  document.getElementById('hudRoles').innerHTML = players.map((p, i) =>
    `<span style="color:${p.color}">${names[i]}${p.isIt ? ' (IT)' : ''} - web ${p.webCd > 0 ? Math.ceil(p.webCd / 60) + 's' : 'ready'}</span>`).join(' &nbsp; ');
}

// ============================================================
// Bot AI (controls player 2 when mode === 'bot') - wanders the
// rooftops, turning randomly and hopping/sliding along the way.
// ============================================================
function botInput(self, other) {
  const input = { left: false, right: false, forward: true, back: false, jump: false, slide: false, swing: false, shoot: false };
  // steer toward the other player when IT, away from them when running
  let want = Math.atan2(other.x - self.x, other.z - self.z);
  if (!self.isIt) want += Math.PI;
  const diff = wrapAngle(want - self.yaw);
  if (diff > 0.08) input.right = true; else if (diff < -0.08) input.left = true;
  // hop when the ground ahead runs out, and try mantling when airborne
  const ax = self.x + Math.sin(self.yaw) * 90, az = self.z + Math.cos(self.yaw) * 90;
  const ahead = city.buildings.some(b => Math.abs(ax - b.x) <= b.hx && Math.abs(az - b.z) <= b.hz && Math.abs(b.topY - self.y) < 120);
  if (self.onGround && !ahead) input.jump = true;
  else if (!self.onGround && Math.random() < 0.05) input.jump = true;
  if (self.wall) { input.forward = true; input.left = input.right = false; input.jump = Math.random() < 0.002; }
  // webs: shoot when ready, dodge incoming ones after a human-ish reaction delay, swing now and then
  if (self.webCd <= 0 && Math.hypot(other.x - self.x, other.z - self.z) < 1300 && Math.random() < 0.012) input.shoot = true;
  const incoming = webs.some(w => w.target === self && !w.dodged);
  if (incoming) { self.botReact = (self.botReact || 0) + 1; if (self.botReact > 25 && Math.random() < 0.06) input.swing = true; }
  else {
    self.botReact = 0;
    if (!self.onGround && !self.web && Math.random() < 0.004) input.swing = true;
    else if (self.web && Math.random() < 0.02) input.swing = true;
  }
  return input;
}

// ============================================================
// Mantle: climb onto a nearby ledge that's just above your head
// by pressing jump again while airborne and close to its edge.
// ============================================================
function tryMantle(pl) {
  let best = null, bestDist = Infinity;
  for (const b of city.buildings) {
    if (b.topY <= pl.y + 1 || b.topY > pl.y + MANTLE_MAX_UP) continue;
    const cx = clamp(pl.x, b.x - b.hx, b.x + b.hx);
    const cz = clamp(pl.z, b.z - b.hz, b.z + b.hz);
    const dist = Math.hypot(pl.x - cx, pl.z - cz);
    if (dist > MANTLE_REACH) continue;
    if (dist < bestDist) { bestDist = dist; best = b; }
  }
  if (!best) return false;
  const toCenterX = best.x - pl.x, toCenterZ = best.z - pl.z;
  const len = Math.hypot(toCenterX, toCenterZ) || 1;
  let nx = pl.x + (toCenterX / len) * (bestDist + PLAYER_R * 1.4);
  let nz = pl.z + (toCenterZ / len) * (bestDist + PLAYER_R * 1.4);
  nx = clamp(nx, best.x - best.hx, best.x + best.hx);
  nz = clamp(nz, best.z - best.hz, best.z + best.hz);
  pl.mantleFrom = { x: pl.x, y: pl.y, z: pl.z };
  pl.mantleTo = { x: nx, y: best.topY, z: nz };
  pl.mantling = MANTLE_ANIM_FRAMES;
  pl.x = nx; pl.z = nz;
  pl.y = best.topY; pl.vy = 0; pl.onGround = true; pl.sliding = 0;
  return true;
}

// ============================================================
// Physics (3D: x/z on the ground plane, y is height above ground)
// ============================================================
// buildings are solid below their roofline: push the player back out, along
// the axis they came in on (using where they were before this step)
function resolveBuildings(pl, px, pz) {
  for (const b of city.buildings) {
    if (pl.y >= b.topY - 0.5) continue; // up on (or above) this roof
    const minX = b.x - b.hx - PLAYER_R, maxX = b.x + b.hx + PLAYER_R;
    const minZ = b.z - b.hz - PLAYER_R, maxZ = b.z + b.hz + PLAYER_R;
    if (pl.x <= minX || pl.x >= maxX || pl.z <= minZ || pl.z >= maxZ) continue;
    const wasOutX = px <= minX || px >= maxX, wasOutZ = pz <= minZ || pz >= maxZ;
    let nx = 0, nz = 0;
    if (wasOutX && !wasOutZ) { nx = px <= minX ? -1 : 1; pl.x = nx < 0 ? minX : maxX; }
    else if (wasOutZ && !wasOutX) { nz = pz <= minZ ? -1 : 1; pl.z = nz < 0 ? minZ : maxZ; }
    else {
      const penL = pl.x - minX, penR = maxX - pl.x, penB = pl.z - minZ, penF = maxZ - pl.z;
      const m = Math.min(penL, penR, penB, penF);
      if (m === penL) { pl.x = minX; nx = -1; } else if (m === penR) { pl.x = maxX; nx = 1; }
      else if (m === penB) { pl.z = minZ; nz = -1; } else { pl.z = maxZ; nz = 1; }
    }
    pl.touchWall = { b, nx, nz };
  }
}

// Wall-walking: keep the player pressed against a building's side face
function stickToWall(pl) {
  const { b, nx, nz } = pl.wall;
  if (nx) { pl.x = b.x + nx * (b.hx + PLAYER_R + 0.2); pl.z = clamp(pl.z, b.z - b.hz, b.z + b.hz); }
  else { pl.z = b.z + nz * (b.hz + PLAYER_R + 0.2); pl.x = clamp(pl.x, b.x - b.hx, b.x + b.hx); }
  pl.yaw = Math.atan2(-nx, -nz); // face the wall
  pl.vx = 0; pl.vz = 0;
}

// returns the (possibly consumed) jump press
function wallStep(pl, input, jumpPressed) {
  const { b, nx, nz } = pl.wall;
  pl.airStartY = 0;   // climbing down to the street is fine, not a respawn-fall
  pl.onGround = false;
  const sp = WALL_SPEED * (pl.isIt ? IT_SPEED_MULT : 1);
  const up = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const side = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  pl.moving = !!(up || side);
  pl.walkPhase += 0.3 * (up || side ? 1 : 0);
  if (jumpPressed) {
    // leap off the wall, away from it
    pl.wall = null; pl.wallCd = 25;
    pl.vx = nx * WALL_JUMP_OUT; pl.vz = nz * WALL_JUMP_OUT;
    pl.vy = JUMP_VEL * 0.9 * (pl.isIt ? IT_JUMP_MULT : 1);
    pl.yaw = Math.atan2(nx, nz);
    return true;
  }
  pl.y += up * sp;
  // sideways along the wall: "right" is to your right as you face the wall
  pl.x += (-nz) * side * sp; pl.z += nx * side * sp;
  pl.vy = 0;
  stickToWall(pl);
  if (pl.y >= b.topY && up > 0) {
    // reached the roof edge - haul yourself up onto it
    pl.wall = null; pl.wallCd = 25;
    pl.y = b.topY; pl.vy = 0;
    pl.x = b.x + nx * (b.hx - PLAYER_R - 4) + (nx ? 0 : clamp(pl.x - b.x, -b.hx + 20, b.hx - 20) - (pl.x - b.x));
    pl.z = b.z + nz * (b.hz - PLAYER_R - 4) + (nz ? 0 : clamp(pl.z - b.z, -b.hz + 20, b.hz - 20) - (pl.z - b.z));
    return false;
  }
  pl.y = clamp(pl.y, 0, b.topY);
  if (pl.y <= 0 && up < 0) { pl.wall = null; pl.wallCd = 25; pl.y = 0; pl.onGround = true; }
  return false;
}

function stepPlayer(pl, input) {
  pl.touchWall = null;
  if (pl.wallCd > 0) pl.wallCd--;
  if (pl.frozen > 0) { pl.frozen--; input = { left: false, right: false, forward: false, back: false, jump: false, slide: false, swing: false, shoot: false }; }
  if (pl.onGround) pl.airStartY = pl.y; // remember the height of the surface we're standing on
  if (pl.sliding > 0) pl.sliding--;
  if (pl.mantling > 0) pl.mantling--;
  let jumpPressed = input.jump && !pl.prevJump;
  pl.prevJump = input.jump;

  if (input.left) pl.yaw -= TURN_RATE;
  if (input.right) pl.yaw += TURN_RATE;

  pl.moving = !!input.forward || !!input.back;
  if (input.slide && pl.onGround && pl.moving && pl.sliding <= 0) pl.sliding = SLIDE_FRAMES;

  // --- webs: swing (E / .) also dodges an incoming web; shoot (Q / ,) has a cooldown ---
  const swingPressed = !!input.swing && !pl.prevSwing; pl.prevSwing = !!input.swing;
  const shootPressed = !!input.shoot && !pl.prevShoot; pl.prevShoot = !!input.shoot;
  if (pl.webCd > 0) pl.webCd--;
  if (pl.dodgeFlash > 0) pl.dodgeFlash--;
  if (pl.hitFlash > 0) pl.hitFlash--;
  if (swingPressed) {
    let dodged = false;
    for (const w of webs) if (w.target === pl && !w.dodged && !w.done) { w.dodged = true; dodged = true; pl.dodgeFlash = 60; }
    if (pl.web && !dodged) pl.web = null;               // press again to let go
    else if (!pl.web && pl.wall) { pl.wall = null; pl.wallCd = 25; startSwing(pl); }
    else if (!pl.web && !pl.onGround) startSwing(pl);
  }
  if (shootPressed && pl.webCd <= 0) { fireWeb(pl); pl.webCd = WEB_COOLDOWN; }

  if (pl.wall) {
    if (pl.web) pl.web = null;
    if (wallStep(pl, input, jumpPressed)) jumpPressed = false;
    if (pl.wall) { pl.x = clamp(pl.x, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R); pl.z = clamp(pl.z, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R); return; }
  }

  const swinging = !!pl.web;
  const speedMul = pl.sliding > 0 ? SLIDE_SPEED_MULT : 1;
  if (swinging) {
    if (input.forward) { pl.vx += Math.sin(pl.yaw) * 0.15; pl.vz += Math.cos(pl.yaw) * 0.15; }
  } else if (input.forward || input.back) {
    const speed = MOVE_SPEED * (pl.isIt ? IT_SPEED_MULT : 1) * speedMul * (input.back ? -1 : 1);
    // move in small steps and resolve building collisions after each, so fast
    // movement can never skip through a wall
    const n = Math.max(1, Math.ceil(Math.abs(speed) / 4));
    for (let s = 0; s < n; s++) {
      const px = pl.x, pz = pl.z;
      pl.x += Math.sin(pl.yaw) * speed / n;
      pl.z += Math.cos(pl.yaw) * speed / n;
      resolveBuildings(pl, px, pz);
    }
    pl.walkPhase += 0.33 * speedMul * (input.back ? -1 : 1);
  }

  // momentum from swinging / web release carries you along
  if (pl.vx || pl.vz) {
    const sx = pl.x, sz = pl.z, want = Math.hypot(pl.vx, pl.vz);
    const n = Math.max(1, Math.ceil(want / 4));
    for (let s = 0; s < n; s++) {
      const px = pl.x, pz = pl.z;
      pl.x += pl.vx / n; pl.z += pl.vz / n;
      resolveBuildings(pl, px, pz);
    }
    if (Math.hypot(pl.x - sx, pl.z - sz) < want * 0.6) { pl.vx = 0; pl.vz = 0; pl.web = null; } // hit a wall
    if (!pl.web) {
      const k = pl.onGround ? 0.8 : 0.992;
      pl.vx *= k; pl.vz *= k;
      if (Math.hypot(pl.vx, pl.vz) < 0.2) { pl.vx = 0; pl.vz = 0; }
    }
  }

  if (jumpPressed) {
    if (pl.web) { pl.web = null; pl.vy += 4; }
    else if (pl.onGround) { pl.vy = JUMP_VEL * (pl.isIt ? IT_JUMP_MULT : 1); pl.onGround = false; pl.sliding = 0; }
    else { tryMantle(pl); }
  }

  resolveBuildings(pl, pl.x, pl.z);

  // airborne and pressed against a building's side: cling to it and walk on the wall
  const tw = pl.touchWall;
  if (tw && !pl.onGround && !pl.wall && pl.wallCd <= 0 && pl.y > 2 && pl.y < tw.b.topY - 40) {
    pl.wall = tw; pl.web = null; pl.vx = 0; pl.vz = 0; pl.vy = 0; pl.mantling = 0;
    stickToWall(pl);
    pl.x = clamp(pl.x, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R); pl.z = clamp(pl.z, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R);
    return;
  }

  pl.vy = Math.max(pl.vy - GRAVITY, -MAX_FALL);
  const prevY = pl.y;
  pl.y += pl.vy;
  pl.onGround = false;

  // land on top of a building's roof when falling onto it
  for (const b of city.buildings) {
    if (Math.abs(pl.x - b.x) > b.hx || Math.abs(pl.z - b.z) > b.hz) continue;
    if (pl.vy > 0) continue; // still rising
    if (prevY < b.topY - 1) continue; // was already below its top - handled by the side walls
    if (pl.y >= b.topY) continue; // hasn't dropped down to the top surface yet
    pl.y = b.topY; pl.vy = 0; pl.onGround = true;
  }
  // the street itself is always solid
  if (pl.y <= 0) {
    if (pl.airStartY > FALL_RESPAWN_HEIGHT) {
      // fell off a rooftop - respawn back at the start point
      // whoever falls becomes the tagger (and is frozen for a moment, like a normal tag)
      if (!pl.isIt) {
        pl.isIt = true; players[1 - pl.i].isIt = false;
        pl.frozen = FREEZE_FRAMES; tagCooldown = FREEZE_FRAMES;
      }
      pl.vx = 0; pl.vz = 0; pl.web = null; pl.wall = null;
      pl.x = pl.spawnX; pl.z = pl.spawnZ; pl.vy = 0; pl.y = pl.spawnY; pl.onGround = true; pl.airStartY = pl.spawnY; pl.sliding = 0;
      pl.x = clamp(pl.x, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R);
      pl.z = clamp(pl.z, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R);
      return;
    }
    pl.y = 0; pl.vy = 0; pl.onGround = true;
  }

  if (pl.web) {
    const w = pl.web;
    if (pl.onGround || --w.t <= 0) pl.web = null;
    else {
      // pendulum: the rope can't stretch - pull back onto the sphere and drop outward velocity
      const dx = pl.x - w.ax, dy = pl.y + 40 - w.ay, dz = pl.z - w.az;
      const d = Math.hypot(dx, dy, dz);
      if (d > w.len) {
        const k = w.len / d;
        pl.x = w.ax + dx * k; pl.y = w.ay + dy * k - 40; pl.z = w.az + dz * k;
        const nx = dx / d, ny = dy / d, nz = dz / d;
        const vr = pl.vx * nx + pl.vy * ny + pl.vz * nz;
        if (vr > 0) { pl.vx -= nx * vr; pl.vy -= ny * vr; pl.vz -= nz * vr; }
      }
    }
  }

  pl.x = clamp(pl.x, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R);
  pl.z = clamp(pl.z, -ARENA_HALF + PLAYER_R, ARENA_HALF - PLAYER_R);
}

function startSwing(pl) {
  const fx = Math.sin(pl.yaw), fz = Math.cos(pl.yaw);
  pl.web = {
    ax: pl.x + fx * SWING_ANCHOR_FWD, ay: pl.y + SWING_ANCHOR_UP, az: pl.z + fz * SWING_ANCHOR_FWD,
    len: Math.hypot(SWING_ANCHOR_FWD, SWING_ANCHOR_UP - 40), t: SWING_FRAMES,
  };
  pl.vx = fx * SWING_LAUNCH; pl.vz = fz * SWING_LAUNCH;
}

function fireWeb(pl) {
  webs.push({ owner: pl, target: players[1 - pl.i], x: pl.x, y: pl.y + 55, z: pl.z, vx: 0, vy: 0, vz: 0, life: 320, dodged: false, done: false });
}

function updateWebs() {
  for (const w of webs) {
    const t = w.target;
    if (!w.dodged) {
      // homing at a fixed, readable speed
      const dx = t.x - w.x, dy = t.y + 40 - w.y, dz = t.z - w.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      w.vx = dx / d * WEB_SPEED; w.vy = dy / d * WEB_SPEED; w.vz = dz / d * WEB_SPEED;
    }
    w.x += w.vx; w.y += w.vy; w.z += w.vz;
    if (--w.life <= 0) w.done = true;
    if (city.buildings.some(b => Math.abs(w.x - b.x) < b.hx && Math.abs(w.z - b.z) < b.hz && w.y < b.topY)) w.done = true;
    if (!w.done && !w.dodged && Math.hypot(t.x - w.x, t.y + 40 - w.y, t.z - w.z) < WEB_HIT_RANGE) {
      w.done = true;
      if (tagCooldown === 0 && !t.isIt) {
        // webbed: you become the tagger (and are frozen for a moment, like a normal tag)
        t.isIt = true; w.owner.isIt = false;
        t.frozen = FREEZE_FRAMES; t.hitFlash = 90; tagCooldown = FREEZE_FRAMES;
        t.web = null; t.wall = null; t.wallCd = 25;
      }
    }
  }
  webs = webs.filter(w => !w.done);
}

// ============================================================
// Main loop
// ============================================================
function update() {
  if (!running) return;
  elapsed++;

  for (const pl of players) {
    let input;
    if (mode === 'bot' && pl.i === 1) input = botInput(pl, players[0]);
    else if (pl.i === 0) input = {
      left: !!keys['KeyA'],
      right: !!keys['KeyD'],
      forward: !!keys['KeyW'],
      back: !!keys['KeyS'],
      jump: !!keys['Space'],
      slide: false,
      swing: !!keys['KeyE'],
      shoot: !!keys['KeyQ'],
    };
    else input = {
      left: !!keys['ArrowLeft'],
      right: !!keys['ArrowRight'],
      forward: !!keys['ArrowUp'],
      back: !!keys['ArrowDown'],
      jump: !!keys['Slash'],
      slide: false,
      swing: !!keys['Period'],
      shoot: !!keys['Comma'],
    };
    stepPlayer(pl, input);
  }
  updateWebs();
  // in the air the camera swings round to keep the other player in view
  for (const pl of players) {
    const o = players[1 - pl.i];
    const target = pl.onGround ? pl.yaw : Math.atan2(o.x - pl.x, o.z - pl.z);
    pl.camYaw += wrapAngle(target - pl.camYaw) * 0.12;
  }

  if (tagCooldown > 0) tagCooldown--;
  const [p0, p1] = players;
  if (tagCooldown === 0 && Math.hypot(p0.x - p1.x, p0.z - p1.z) < TAG_RANGE && Math.abs(p0.y - p1.y) < 60) {
    p0.isIt = !p0.isIt; p1.isIt = !p1.isIt;
    (p0.isIt ? p0 : p1).frozen = FREEZE_FRAMES;
    tagCooldown = FREEZE_FRAMES;
  }

  updateHud();
}

// ============================================================
// Rendering: a third-person 3D camera trailing each player,
// drawn into the top/bottom half of the canvas.
// ============================================================
function thirdPersonCam(pl) {
  return {
    x: pl.x - Math.sin(pl.camYaw) * CAM_DIST,
    y: pl.y + CAM_HEIGHT,
    z: pl.z - Math.cos(pl.camYaw) * CAM_DIST,
    yaw: pl.camYaw,
    pitch: CAM_PITCH,
  };
}

function project(cam, wx, wy, wz) {
  const dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
  const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
  const cx = dx * cosY - dz * sinY;
  const cz0 = dx * sinY + dz * cosY;
  const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
  const cy = dy * cosP + cz0 * sinP;
  const cz = -dy * sinP + cz0 * cosP;
  if (cz < 10) return null;
  const scale = FOCAL / cz;
  return { x: cx * scale, y: -cy * scale, scale, depth: cz };
}

// local offsets: lx = sideways (right+), ly = height above feet, lz = forward (facing+)
function localToWorld(pl, lx, ly, lz) {
  const cosY = Math.cos(pl.yaw), sinY = Math.sin(pl.yaw);
  return {
    x: pl.x + lx * cosY + lz * sinY,
    y: pl.y + ly,
    z: pl.z - lx * sinY + lz * cosY,
  };
}

function drawViewport(self, other, yOffset) {
  const cam = thirdPersonCam(self);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, yOffset, W, VH); ctx.clip();
  ctx.translate(0, yOffset);
  const midY = VH / 2;

  // sky + street
  const g = ctx.createLinearGradient(0, 0, 0, VH);
  g.addColorStop(0, '#6a85b0'); g.addColorStop(1, '#1a2436');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, midY);
  ctx.fillStyle = '#2b2b33'; ctx.fillRect(0, midY, W, VH - midY);

  // street grid (road lines) for depth cues
  ctx.strokeStyle = 'rgba(255,210,90,0.25)'; ctx.lineWidth = 1;
  for (let gz = -ARENA_HALF; gz <= ARENA_HALF; gz += GRID_STEP) {
    const a = project(cam, -ARENA_HALF, 0, gz), b = project(cam, ARENA_HALF, 0, gz);
    if (a && b) { ctx.beginPath(); ctx.moveTo(W / 2 + a.x, midY + a.y); ctx.lineTo(W / 2 + b.x, midY + b.y); ctx.stroke(); }
  }
  for (let gx = -ARENA_HALF; gx <= ARENA_HALF; gx += GRID_STEP) {
    const a = project(cam, gx, 0, -ARENA_HALF), b = project(cam, gx, 0, ARENA_HALF);
    if (a && b) { ctx.beginPath(); ctx.moveTo(W / 2 + a.x, midY + a.y); ctx.lineTo(W / 2 + b.x, midY + b.y); ctx.stroke(); }
  }

  // skyline boundary walls
  const wallH = 6000;
  drawWall(cam, -ARENA_HALF, -ARENA_HALF, ARENA_HALF, -ARENA_HALF, wallH, midY, '#394258');
  drawWall(cam, -ARENA_HALF, ARENA_HALF, ARENA_HALF, ARENA_HALF, wallH, midY, '#394258');
  drawWall(cam, -ARENA_HALF, -ARENA_HALF, -ARENA_HALF, ARENA_HALF, wallH, midY, '#2d3447');
  drawWall(cam, ARENA_HALF, -ARENA_HALF, ARENA_HALF, ARENA_HALF, wallH, midY, '#2d3447');

  // depth-sort buildings + both characters, draw far to near
  const drawables = city.buildings.map(b => ({ type: 'bld', b, d: Math.hypot(b.x - cam.x, b.z - cam.z) }));
  // a character must be drawn after (on top of) the roof it stands on, even when
  // that building's centre is nearer the camera than the character is
  const charDepth = (p) => {
    let d = Math.hypot(p.x - cam.x, p.z - cam.z);
    for (const b of city.buildings) {
      if (Math.abs(p.x - b.x) <= b.hx + PLAYER_R && Math.abs(p.z - b.z) <= b.hz + PLAYER_R && b.topY <= p.y + 2) {
        d = Math.min(d, Math.hypot(b.x - cam.x, b.z - cam.z) - 0.1);
      }
    }
    return d;
  };
  drawables.push({ type: 'char', p: other, d: charDepth(other) });
  drawables.push({ type: 'char', p: self, d: charDepth(self) });
  drawables.sort((a, b) => b.d - a.d);
  for (const item of drawables) {
    if (item.type === 'bld') drawBuilding(cam, item.b, midY);
    else {
      drawCharacter(cam, item.p, midY);
      if (item.p.isIt) {
        const pt = project(cam, item.p.x, item.p.y + 95, item.p.z);
        if (pt) {
          ctx.fillStyle = '#ffd400'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(item.p.frozen > 0 ? 'IT ' + Math.ceil(item.p.frozen / 60) : 'IT', W / 2 + pt.x, midY + pt.y);
        }
      }
      const msg = item.p.dodgeFlash > 0 ? ['DODGE!', '#7ff'] : item.p.hitFlash > 0 ? ['WEBBED!', '#fff'] : null;
      if (msg) {
        const pt2 = project(cam, item.p.x, item.p.y + 125, item.p.z);
        if (pt2) { ctx.fillStyle = msg[1]; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(msg[0], W / 2 + pt2.x, midY + pt2.y); }
      }
    }
  }

  // web lines: swing ropes and shots in flight
  ctx.lineCap = 'round';
  for (const p of players) {
    if (!p.web) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath();
    if (pathPoly(cam, [[p.x, p.y + 50, p.z], [p.web.ax, p.web.ay, p.web.az]], midY, false)) ctx.stroke();
  }
  for (const w of webs) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath();
    if (pathPoly(cam, [[w.owner.x, w.owner.y + 55, w.owner.z], [w.x, w.y, w.z]], midY, false)) ctx.stroke();
    const pt = project(cam, w.x, w.y, w.z);
    if (pt) {
      ctx.fillStyle = w.dodged ? '#9ab' : '#fff'; ctx.beginPath();
      ctx.arc(W / 2 + pt.x, midY + pt.y, Math.max(3, 14 * pt.scale), 0, Math.PI * 2); ctx.fill();
    }
  }

  ctx.restore();
}

function drawWall(cam, x1, z1, x2, z2, h, midY, color) {
  const bl = project(cam, x1, 0, z1), br = project(cam, x2, 0, z2);
  const tl = project(cam, x1, h, z1), tr = project(cam, x2, h, z2);
  if (!bl || !br || !tl || !tr) return;
  ctx.fillStyle = color; ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(W / 2 + bl.x, midY + bl.y); ctx.lineTo(W / 2 + br.x, midY + br.y);
  ctx.lineTo(W / 2 + tr.x, midY + tr.y); ctx.lineTo(W / 2 + tl.x, midY + tl.y);
  ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
}

// Project a 3D polygon/polyline after clipping it to the camera's near plane,
// so big nearby walls don't vanish when a corner passes behind the camera.
function toCamSpace(cam, wx, wy, wz) {
  const dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
  const cosY = Math.cos(cam.yaw), sinY = Math.sin(cam.yaw);
  const cx = dx * cosY - dz * sinY;
  const cz0 = dx * sinY + dz * cosY;
  const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
  return { x: cx, y: dy * cosP + cz0 * sinP, z: -dy * sinP + cz0 * cosP };
}
const NEAR = 10;
function clipNear(pts, closed) {
  const out = [], n = pts.length, edges = closed ? n : n - 1;
  for (let i = 0; i < edges; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ain = a.z >= NEAR, bin = b.z >= NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a.z) / (b.z - a.z);
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NEAR });
    }
  }
  if (!closed && pts[n - 1].z >= NEAR) out.push(pts[n - 1]);
  return out;
}
function pathPoly(cam, pts3d, midY, closed) {
  const clipped = clipNear(pts3d.map(p => toCamSpace(cam, p[0], p[1], p[2])), closed);
  if (clipped.length < 2) return false;
  clipped.forEach((p, i) => {
    const s = FOCAL / p.z, sx = W / 2 + p.x * s, sy = midY - p.y * s;
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  });
  if (closed) ctx.closePath();
  return true;
}

function drawBuilding(cam, b, midY) {
  const shade = clamp(1 - Math.hypot(b.x - cam.x, b.z - cam.z) / 1400, 0.35, 1);
  const x0 = b.x - b.hx, x1 = b.x + b.hx, z0 = b.z - b.hz, z1 = b.z + b.hz;
  const yb = Math.max(0, b.topY - b.thick), yt = b.topY;
  // four side walls (each facing outward); skip the ones facing away from the camera
  const faces = [
    { a: [x0, z0], c: [x1, z0], nx: 0, nz: -1, tone: 30 },
    { a: [x1, z0], c: [x1, z1], nx: 1, nz: 0, tone: 24 },
    { a: [x1, z1], c: [x0, z1], nx: 0, nz: 1, tone: 36 },
    { a: [x0, z1], c: [x0, z0], nx: -1, nz: 0, tone: 20 },
  ];
  const spacing = Math.max(110, (yt - yb) / 70);
  for (const f of faces) {
    const mx = (f.a[0] + f.c[0]) / 2, mz = (f.a[1] + f.c[1]) / 2;
    if ((cam.x - mx) * f.nx + (cam.z - mz) * f.nz <= 0) continue;
    ctx.fillStyle = `hsl(${b.hue}, 18%, ${f.tone * shade + 8}%)`;
    ctx.beginPath();
    if (pathPoly(cam, [[f.a[0], yb, f.a[1]], [f.c[0], yb, f.c[1]], [f.c[0], yt, f.c[1]], [f.a[0], yt, f.a[1]]], midY, true)) ctx.fill();
    // window rows
    ctx.strokeStyle = `rgba(255, 230, 150, ${0.28 * shade + 0.05})`; ctx.lineWidth = Math.max(1, 3 * shade);
    ctx.beginPath();
    for (let y = yb + spacing; y < yt - 20; y += spacing) {
      pathPoly(cam, [[f.a[0], y, f.a[1]], [f.c[0], y, f.c[1]]], midY, false);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (pathPoly(cam, [[f.a[0], yb, f.a[1]], [f.c[0], yb, f.c[1]], [f.c[0], yt, f.c[1]], [f.a[0], yt, f.a[1]]], midY, true)) ctx.stroke();
  }
  // roof
  ctx.fillStyle = `hsl(${b.hue}, 20%, ${55 * shade + 10}%)`;
  ctx.beginPath();
  if (pathPoly(cam, [[x0, yt, z0], [x1, yt, z0], [x1, yt, z1], [x0, yt, z1]], midY, true)) {
    ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
}

// Animated stick-figure character: swinging legs/arms while running,
// a tucked pose in mid-air, a low slide pose, and a straight idle stance.
function drawCharacter(cam, pl, midY) {
  const mantling = pl.mantling > 0;
  const sliding = !mantling && pl.sliding > 0;
  const airborne = !mantling && !pl.onGround;
  const legAmp = (pl.moving && pl.onGround && !sliding && !mantling) ? 16 : 0;
  const armAmp = (pl.moving && pl.onGround && !sliding && !mantling) ? 11 : 0;

  // while mantling, interpolate the rendered body between where the
  // climb started and the ledge it ends on, for a visible climb-up motion
  let basis = pl;
  let mantleProgress = 0;
  if (mantling) {
    mantleProgress = 1 - pl.mantling / MANTLE_ANIM_FRAMES;
    const t = mantleProgress;
    basis = {
      yaw: pl.yaw,
      x: pl.mantleFrom.x + (pl.mantleTo.x - pl.mantleFrom.x) * t,
      y: pl.mantleFrom.y + (pl.mantleTo.y - pl.mantleFrom.y) * t,
      z: pl.mantleFrom.z + (pl.mantleTo.z - pl.mantleFrom.z) * t,
    };
  }

  function limbEnd(side, isLeg) {
    if (mantling) {
      // arms pull up on the ledge, legs kick to scramble over it
      const kick = Math.sin(mantleProgress * Math.PI);
      return isLeg ? { lz: 14 + kick * 10, ly: 6 + kick * 22 } : { lz: 28, ly: 50 + kick * 14 };
    }
    if (sliding) return isLeg ? { lz: side > 0 ? 26 : -20, ly: 0 } : { lz: -16, ly: 28 };
    if (airborne) return isLeg ? { lz: -8, ly: 14 } : { lz: 10, ly: 44 };
    const phase = pl.walkPhase + (side > 0 ? 0 : Math.PI) + (isLeg ? 0 : Math.PI);
    const swing = Math.sin(phase) * (isLeg ? legAmp : armAmp);
    return { lz: swing, ly: isLeg ? 0 : 40 };
  }

  const crouch = sliding ? 0.45 : (mantling ? 0.75 : 1);
  const hipY = 32 * crouch, shoulderY = 68 * crouch, headY = 82 * crouch, headR = 11;
  const parts = [];
  for (const side of [-1, 1]) {
    const foot = limbEnd(side, true);
    const hip = localToWorld(basis, side * 8, hipY, 0);
    const kneeBend = Math.abs(foot.lz) * 0.4 + (airborne ? 6 : 0);
    const knee = localToWorld(basis, side * 8, hipY * 0.5, foot.lz * 0.5 + kneeBend);
    const footW = localToWorld(basis, side * 8, foot.ly, foot.lz);
    parts.push([hip, knee, footW]);

    const hand = limbEnd(side, false);
    const shoulder = localToWorld(basis, side * 16, shoulderY, 0);
    const elbow = localToWorld(basis, side * 16, (shoulderY + hand.ly) * 0.5, hand.lz * 0.5);
    const handW = localToWorld(basis, side * 16, hand.ly, hand.lz);
    parts.push([shoulder, elbow, handW]);
  }
  const hipL = localToWorld(basis, -8, hipY, 0), hipR = localToWorld(basis, 8, hipY, 0);
  const shL = localToWorld(basis, -16, shoulderY, 0), shR = localToWorld(basis, 16, shoulderY, 0);
  const head = localToWorld(basis, 0, headY, 0);

  const proj = (w) => project(cam, w.x, w.y, w.z);
  const pHipL = proj(hipL), pHipR = proj(hipR), pShL = proj(shL), pShR = proj(shR), pHead = proj(head);
  if (!pHipL || !pHipR || !pShL || !pShR || !pHead) return;

  ctx.save();

  // torso
  ctx.fillStyle = pl.color;
  ctx.beginPath();
  ctx.moveTo(W / 2 + pShL.x, midY + pShL.y); ctx.lineTo(W / 2 + pShR.x, midY + pShR.y);
  ctx.lineTo(W / 2 + pHipR.x, midY + pHipR.y); ctx.lineTo(W / 2 + pHipL.x, midY + pHipL.y);
  ctx.closePath(); ctx.fill();

  // limbs
  ctx.strokeStyle = pl.color; ctx.lineCap = 'round';
  for (const seg of parts) {
    const a = proj(seg[0]), b = proj(seg[1]), c = proj(seg[2]);
    if (!a || !b || !c) continue;
    ctx.lineWidth = Math.max(2, 7 * a.scale);
    ctx.beginPath();
    ctx.moveTo(W / 2 + a.x, midY + a.y); ctx.lineTo(W / 2 + b.x, midY + b.y); ctx.lineTo(W / 2 + c.x, midY + c.y);
    ctx.stroke();
  }

  // head
  const r = Math.max(4, headR * pHead.scale);
  ctx.fillStyle = pl.color;
  ctx.beginPath(); ctx.arc(W / 2 + pHead.x, midY + pHead.y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = mantling ? '#ff9f40' : (sliding ? '#ffd54a' : (airborne ? '#57e0ff' : '#57e08a')); ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('P' + (pl.i + 1), W / 2 + pHead.x, midY + pHead.y - r - 8);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (!city) return;

  drawViewport(players[0], players[1], 0);
  drawViewport(players[1], players[0], VH);
  ctx.fillStyle = '#000'; ctx.fillRect(0, VH - 2, W, 4);
  ctx.strokeStyle = players[0].color; ctx.lineWidth = 3; ctx.strokeRect(1, 1, W - 2, VH - 2);
  ctx.strokeStyle = players[1].color; ctx.strokeRect(1, VH + 1, W - 2, VH - 2);
}

// ============================================================
// Input + UI wiring
// ============================================================
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Slash', 'Period'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { keys = {}; });

function showScreen(id) { document.getElementById(id).classList.remove('hidden'); }
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }
function hideAllScreens() { ['menu'].forEach(hideScreen); }

function setMode(m) {
  mode = m;
  document.getElementById('btn2P').classList.toggle('selected', m === '2p');
  document.getElementById('btnBot').classList.toggle('selected', m === 'bot');
}
setMode('2p');
document.getElementById('btn2P').addEventListener('click', () => setMode('2p'));
document.getElementById('btnBot').addEventListener('click', () => setMode('bot'));

function startGame() {
  hideAllScreens();
  document.getElementById('hud').classList.remove('hidden');
  startRun();
  running = true;
}
document.getElementById('btnPlay').addEventListener('click', startGame);
document.getElementById('btnNewCity').addEventListener('click', () => startRun());
document.getElementById('btnMenu').addEventListener('click', () => { running = false; document.getElementById('hud').classList.add('hidden'); hideAllScreens(); showScreen('menu'); });

// ============================================================
// Boot
// ============================================================
startRun();
running = false;
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
