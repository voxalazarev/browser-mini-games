'use strict';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const W = 960, H = 540;
const GRAV = 0.6;
const PW = 28, PH = 44;
const WINS_NEEDED = 3;
const RARE_ODDS = 55;

// ============================================================
// Weapons: 174 common + 1 rare (1 in 55 per roll)
// ============================================================
const COMMON = [];
const add = (k, base) => (name, o) => COMMON.push(Object.assign({ name, k }, base, o));
const gun = add('bullet', { cd: 20, uses: 12, dmg: 7, spd: 12, n: 1, spr: 0, jit: 0, grav: 0, life: 60, r: 5, kb: 3, col: '#ffd54a', up: 0 });
const melee = add('melee', { cd: 25, uses: 14, dmg: 12, kb: 8, range: 55, thick: 40, dur: 8, col: '#dfe6ee' });
const beam = add('beam', { cd: 35, uses: 8, len: 700, thick: 6, dmg: 8, kb: 4, col: '#ff4060', dur: 8 });
const nova = add('nova', { cd: 45, uses: 6, radius: 100, dmg: 10, kb: 12, col: '#ffa030' });
const dash = add('dash', { cd: 50, uses: 6, frames: 14, speed: 14, dmg: 12, kb: 12, dy: 0, col: '#ffb000' });
const trap = add('mine', { cd: 40, uses: 4, dmg: 20, radius: 70, kb: 12, trig: 44, col: '#ff5040' });
const turret = add('turret', { cd: 50, uses: 3, dur: 420, dmg: 3, col: '#ffa000' });
const util = add('util', { cd: 60, uses: 1, col: '#7fffb0' });

// --- Guns, throwables, launchers (32)
gun('Pistol', { cd: 16, uses: 16, dmg: 7, spd: 13, kb: 3 });
gun('Machine Gun', { cd: 5, uses: 45, dmg: 3.2, spd: 13, jit: 6, kb: 1.5, life: 50, r: 4 });
gun('Sniper Rifle', { cd: 55, uses: 5, dmg: 26, spd: 26, pierce: true, r: 4, kb: 9, life: 80, col: '#9ff' });
gun('Shotgun', { cd: 45, uses: 7, n: 6, spr: 26, dmg: 4.5, spd: 12, life: 24, r: 4, kb: 3.2, col: '#ffb060' });
gun('Double Barrel', { cd: 60, uses: 5, n: 10, spr: 36, dmg: 4, spd: 12, life: 22, r: 4, kb: 3.6, col: '#ff9040' });
gun('Minigun', { cd: 3, uses: 70, dmg: 2, jit: 9, spd: 14, kb: 1, life: 45, r: 3 });
gun('Burst Rifle', { cd: 40, uses: 8, burst: 3, dmg: 6, spd: 15, kb: 3, jit: 2 });
gun('Revolver', { cd: 32, uses: 7, dmg: 16, spd: 16, kb: 7, r: 5, col: '#ffe090' });
gun('Slingshot', { cd: 26, uses: 14, dmg: 7, spd: 10, grav: 0.28, up: 4, r: 6, kb: 5, col: '#b08050', life: 100 });
gun('Crossbow', { cd: 50, uses: 6, dmg: 19, spd: 18, grav: 0.05, pierce: true, r: 4, kb: 7, col: '#c8a070', life: 90 });
gun('Flamethrower', { cd: 3, uses: 90, dmg: 0.9, spd: 7, jit: 14, life: 22, r: 8, burn: 180, kb: 0.4, col: '#ff7020' });
gun('Ice Blaster', { cd: 24, uses: 12, dmg: 4, freeze: 90, r: 8, spd: 10, col: '#8ff0ff', kb: 2 });
gun('Acid Spitter', { cd: 26, uses: 10, dmg: 3, burn: 240, grav: 0.18, up: 2, r: 7, spd: 9, col: '#9f3', kb: 1, life: 80 });
gun('Spark Gun', { cd: 28, uses: 10, dmg: 5, stun: 45, spd: 15, col: '#ff0', kb: 2 });
gun('Bouncy Ball Gun', { cd: 22, uses: 14, dmg: 8, bounce: 4, life: 130, r: 8, spd: 9, grav: 0.3, kb: 6, col: '#f6a' });
gun('Plasma Rifle', { cd: 12, uses: 26, dmg: 6.5, spd: 14, r: 7, col: '#c060ff', kb: 3 });
gun('Rocket Launcher', { cd: 55, uses: 5, dmg: 6, spd: 9, explode: 75, expDmg: 22, expKb: 13, r: 7, life: 130, col: '#ff5a40' });
gun('Homing Missile', { cd: 65, uses: 4, dmg: 4, spd: 7, home: 0.1, explode: 60, expDmg: 18, expKb: 11, r: 6, life: 170, col: '#ff8080' });
gun('Rocket Barrage', { cd: 70, uses: 4, n: 4, spr: 36, dmg: 3, spd: 8, explode: 42, expDmg: 9, expKb: 8, r: 5, life: 80, col: '#ff9a60' });
gun('Cannon', { cd: 80, uses: 4, dmg: 18, spd: 10, r: 16, kb: 14, grav: 0.1, explode: 65, expDmg: 12, expKb: 12, col: '#777', life: 120 });
gun('Bubble Gun', { cd: 14, uses: 22, dmg: 1, r: 12, spd: 3.5, life: 100, kb: 10, grav: -0.02, col: '#a0dcff' });
gun('Water Pistol', { cd: 4, uses: 70, dmg: 0.3, kb: 2.4, r: 3, col: '#4aaaff', spd: 10, jit: 5, life: 40 });
gun('Boomerang', { cd: 40, uses: 12, dmg: 9, boom: true, spd: 12, life: 80, r: 9, pierce: true, kb: 5, col: '#e0a030' });
gun('Shuriken', { cd: 14, uses: 22, n: 3, spr: 18, dmg: 4.5, spd: 15, kb: 2, r: 5, col: '#dde' });
gun('Spear Throw', { cd: 45, uses: 6, dmg: 22, spd: 17, grav: 0.12, r: 6, kb: 11, col: '#e8d080', life: 90 });
gun('Axe Throw', { cd: 50, uses: 6, dmg: 17, spd: 10, boom: true, r: 12, kb: 10, col: '#a0a8b0', life: 90 });
gun('Fireball', { cd: 36, uses: 8, dmg: 5, burn: 150, explode: 45, expDmg: 9, expKb: 8, r: 10, spd: 9, col: '#ff8a20', life: 100 });
gun('Bowling Ball', { cd: 70, uses: 4, dmg: 20, spd: 7, r: 16, grav: 0.5, bounce: 3, kb: 16, col: '#3a3a55', life: 150 });
gun('Grenade', { cd: 50, uses: 5, dmg: 0, spd: 9, up: 5, grav: 0.35, bounce: 3, life: 70, r: 7, explode: 80, expDmg: 24, expKb: 13, col: '#5a7a3a' });
gun('Dynamite', { cd: 60, uses: 4, dmg: 0, spd: 8, up: 5, grav: 0.35, bounce: 2, life: 90, r: 7, explode: 95, expDmg: 30, expKb: 16, col: '#d03030' });
gun('Cluster Bomb', { cd: 70, uses: 4, dmg: 0, spd: 9, up: 5, grav: 0.35, bounce: 2, life: 65, r: 8, explode: 60, expDmg: 12, expKb: 9, frag: 9, col: '#8a5a2a' });
gun('Molotov', { cd: 60, uses: 4, dmg: 0, spd: 9, up: 5, grav: 0.35, life: 120, r: 8, explode: 70, expDmg: 6, expKb: 5, burn: 280, col: '#e08030' });

// --- Melee (15)
melee('Sword', { range: 62, dmg: 12, kb: 8, cd: 22 });
melee('Katana', { range: 70, dmg: 9, kb: 6, cd: 12, uses: 22, col: '#e0f0ff' });
melee('Broadsword', { range: 78, thick: 56, dmg: 22, kb: 14, cd: 46, uses: 10 });
melee('Dagger', { range: 38, dmg: 5, kb: 3, cd: 8, uses: 35 });
melee('Baseball Bat', { range: 58, dmg: 8, kb: 22, cd: 40, col: '#c89a5a' });
melee('Sledge Hammer', { range: 56, thick: 58, dmg: 18, kb: 12, stun: 30, cd: 55, uses: 9, col: '#8a8a99' });
melee('Frying Pan', { range: 46, dmg: 9, kb: 10, stun: 18, cd: 26, col: '#666' });
melee('Spear', { range: 105, thick: 18, dmg: 13, kb: 8, cd: 30, col: '#e8d080' });
melee('Whip', { range: 125, thick: 14, dmg: 5, kb: 6, cd: 20, uses: 22, col: '#8a5a30' });
melee('Chainsaw', { range: 52, dmg: 2.4, kb: 2, cd: 4, uses: 140, dur: 4, col: '#f0a020' });
melee('Boxing Gloves', { range: 46, dmg: 7, kb: 17, cd: 22, uses: 20, col: '#e03030' });
melee('Lightsaber', { range: 82, dmg: 13, kb: 5, cd: 14, uses: 22, col: '#40e0ff' });
melee('Fire Sword', { range: 64, dmg: 9, kb: 7, cd: 24, burn: 200, col: '#ff6a20' });
melee('Ice Axe', { range: 60, dmg: 9, kb: 7, cd: 26, freeze: 100, col: '#9ff0ff' });
melee('Pillow', { range: 56, dmg: 0.5, kb: 24, cd: 20, uses: 24, col: '#fff' });

// --- Area blasts around you (7)
nova('Shockwave Stomp', { radius: 100, dmg: 10, kb: 13 });
nova('Fire Nova', { radius: 95, dmg: 6, kb: 9, burn: 200, col: '#ff6a20' });
nova('Frost Nova', { radius: 100, dmg: 4, kb: 5, freeze: 110, col: '#8ff0ff' });
nova('Thunder Clap', { radius: 110, dmg: 8, kb: 6, stun: 55, col: '#ffee40' });
nova('Wind Blast', { radius: 170, dmg: 0, kb: 28, col: '#d0f0ff' });
nova('Poison Cloud', { radius: 90, dmg: 3, kb: 2, burn: 260, col: '#8fd040' });
nova('Gravity Well', { radius: 220, dmg: 0, kb: -16, col: '#a060ff' });

// --- Dashes (4)
dash('Charge Dash', { frames: 14, speed: 14, dmg: 12, kb: 12 });
dash('Bull Rush', { frames: 22, speed: 11, dmg: 16, kb: 17, cd: 70, col: '#c06020' });
dash('Rocket Boots', { frames: 16, speed: 9, dmg: 8, kb: 8, dy: 14, col: '#ff8040' });
dash('Ninja Dash', { frames: 8, speed: 20, dmg: 7, kb: 6, cd: 30, uses: 12, col: '#556' });

// --- Mines / traps (4)
trap('Land Mine', { dmg: 22, radius: 75, kb: 14 });
trap('Bear Trap', { dmg: 10, radius: 40, kb: 1, stun: 100, trig: 30 });
trap('Spike Trap', { dmg: 14, radius: 45, kb: 14, up: true, trig: 34 });
trap('Ice Mine', { dmg: 4, radius: 70, kb: 5, freeze: 140, col: '#8ff0ff' });

// --- Turret (1)
turret('Sentry Turret', {});

// --- Beams (6)
beam('Laser', { cd: 30, uses: 9, dmg: 8, thick: 6, kb: 4 });
beam('Death Ray', { cd: 95, uses: 4, dmg: 24, thick: 16, kb: 12, col: '#ff2030', dur: 14 });
beam('Lightning', { cd: 35, uses: 9, dmg: 10, thick: 10, stun: 20, kb: 4, col: '#ffee50', len: 420 });
beam('Freeze Ray', { cd: 40, uses: 8, dmg: 2, thick: 8, freeze: 120, kb: 2, col: '#9ff' });
beam('Tractor Beam', { cd: 30, uses: 10, dmg: 0, thick: 14, pull: 14, kb: 0, col: '#7ac0ff' });
beam('Confusion Ray', { cd: 60, uses: 5, dmg: 1, thick: 10, invert: 200, kb: 1, col: '#d060ff' });

// --- Utility (5)
util('Medkit', { u: 'heal', amt: 35, col: '#6f6' });
util('Shield Bubble', { u: 'shield', dur: 260, col: '#7cf' });
util('Teleport Staff', { u: 'tele', dist: 260, uses: 3, cd: 30, col: '#c8f' });
util('Swap Portal', { u: 'swap', uses: 2, col: '#fa6' });
util('Speed Boots', { u: 'speed', dur: 420, col: '#ff8' });

// ===== Expansion pack: 100 more weapons =====
// --- More guns / throwables (41)
gun('Assault Rifle', { cd: 7, uses: 36, dmg: 4, spd: 14, jit: 4, kb: 2, life: 55 });
gun('SMG', { cd: 4, uses: 50, dmg: 2.6, spd: 13, jit: 7, kb: 1.2, life: 45, r: 4 });
gun('Pea Shooter', { cd: 6, uses: 60, dmg: 1.5, spd: 11, kb: 1, r: 3, col: '#7f7' });
gun('Musket', { cd: 70, uses: 4, dmg: 24, spd: 15, kb: 12, r: 6, life: 70, col: '#a86' });
gun('Hand Cannon', { cd: 50, uses: 5, dmg: 20, spd: 16, kb: 14, r: 7, col: '#fc8' });
gun('Blunderbuss', { cd: 65, uses: 4, n: 9, spr: 50, dmg: 4, spd: 11, life: 20, r: 5, kb: 4, col: '#b96' });
gun('Sawed-Off', { cd: 40, uses: 4, n: 5, spr: 44, dmg: 6, spd: 12, life: 16, r: 4, kb: 6, col: '#ca8' });
gun('Gatling Gun', { cd: 2, uses: 90, dmg: 1.6, spd: 14, jit: 10, kb: 0.8, life: 45, r: 3, col: '#eee' });
gun('Railgun', { cd: 90, uses: 3, dmg: 32, spd: 34, pierce: true, r: 5, kb: 16, life: 60, col: '#6cf' });
gun('Blaster', { cd: 14, uses: 22, dmg: 6, spd: 15, r: 5, col: '#5f5', kb: 3 });
gun('Ray Gun', { cd: 20, uses: 16, dmg: 7, spd: 12, r: 8, col: '#8f8', kb: 4, burn: 60 });
gun('Ion Cannon', { cd: 60, uses: 4, dmg: 10, spd: 10, r: 14, col: '#6af', kb: 10, stun: 40 });
gun('Photon Burst', { cd: 40, uses: 8, n: 5, spr: 30, dmg: 4, spd: 14, r: 4, col: '#fff', kb: 2 });
gun('Sonic Gun', { cd: 28, uses: 12, dmg: 3, spd: 11, r: 12, col: '#cde', kb: 6, stun: 25, pierce: true });
gun('Bee Launcher', { cd: 45, uses: 6, n: 4, spr: 60, dmg: 3, spd: 7, home: 0.08, r: 4, life: 110, col: '#fd0', kb: 2 });
gun('Snake Spitter', { cd: 30, uses: 9, dmg: 2, spd: 8, r: 6, burn: 300, grav: 0.1, col: '#4c4', kb: 1, life: 90 });
gun('Lava Gun', { cd: 32, uses: 8, dmg: 4, spd: 9, r: 9, burn: 240, grav: 0.2, up: 2, col: '#f50', kb: 3, life: 80 });
gun('Frostbite Cannon', { cd: 60, uses: 5, dmg: 8, spd: 10, r: 13, freeze: 140, col: '#bff', kb: 8 });
gun('Thunder Gun', { cd: 45, uses: 6, dmg: 9, spd: 16, r: 6, stun: 60, col: '#ff4', kb: 4 });
gun('Meteor Launcher', { cd: 85, uses: 3, dmg: 8, spd: 8, grav: 0.25, up: 6, r: 14, explode: 85, expDmg: 26, expKb: 15, life: 120, col: '#c63' });
gun('Missile Pod', { cd: 80, uses: 3, n: 6, spr: 50, dmg: 2, spd: 8, explode: 36, expDmg: 8, expKb: 7, r: 4, life: 70, col: '#fa8' });
gun('Nuke Launcher', { cd: 120, uses: 2, dmg: 8, spd: 5, explode: 150, expDmg: 40, expKb: 24, r: 12, life: 160, col: '#9f0' });
gun('Firework Rocket', { cd: 45, uses: 6, dmg: 4, spd: 10, jit: 20, explode: 50, expDmg: 12, expKb: 9, r: 5, life: 60, col: '#f8f' });
gun('Stinger', { cd: 60, uses: 4, dmg: 3, spd: 11, home: 0.14, explode: 45, expDmg: 16, expKb: 10, r: 5, life: 120, col: '#f66' });
gun('Dart Gun', { cd: 20, uses: 12, dmg: 2, spd: 14, burn: 200, r: 3, col: '#4f8', kb: 1 });
gun('Blowgun', { cd: 14, uses: 20, dmg: 3, spd: 16, r: 3, stun: 20, col: '#ad8', kb: 1.5 });
gun('Harpoon', { cd: 60, uses: 4, dmg: 22, spd: 19, pierce: true, r: 6, kb: 14, grav: 0.06, col: '#8ac' });
gun('Throwing Knife', { cd: 14, uses: 20, n: 2, spr: 8, dmg: 5, spd: 16, r: 4, kb: 2, col: '#ccd' });
gun('Kunai', { cd: 24, uses: 14, dmg: 5, spd: 14, boom: true, r: 5, pierce: true, kb: 3, col: '#889', life: 60 });
gun('Tomahawk', { cd: 40, uses: 8, dmg: 14, spd: 11, boom: true, r: 10, pierce: true, kb: 8, col: '#b74', life: 80 });
gun('Javelin', { cd: 50, uses: 5, dmg: 20, spd: 20, grav: 0.1, r: 5, kb: 12, col: '#dc9', life: 80 });
gun('Chakram', { cd: 35, uses: 10, dmg: 7, spd: 13, boom: true, r: 11, pierce: true, kb: 5, col: '#fc4', life: 90 });
gun('Yo-Yo', { cd: 12, uses: 30, dmg: 3, spd: 14, boom: true, r: 7, pierce: true, kb: 2, col: '#f4a', life: 34 });
gun('Snowball Launcher', { cd: 18, uses: 16, dmg: 3, spd: 10, grav: 0.2, up: 2, r: 9, freeze: 50, col: '#fff', kb: 4 });
gun('Pumpkin Bomb', { cd: 65, uses: 4, dmg: 0, spd: 8, up: 5, grav: 0.35, bounce: 2, life: 80, r: 12, explode: 85, expDmg: 20, expKb: 13, col: '#f80' });
gun('Watermelon Cannon', { cd: 70, uses: 4, dmg: 14, spd: 11, r: 16, grav: 0.15, kb: 14, explode: 50, expDmg: 8, expKb: 8, col: '#3c5' });
gun('Coconut Bomber', { cd: 50, uses: 6, dmg: 12, spd: 9, up: 3, grav: 0.3, bounce: 2, r: 10, kb: 9, life: 100, col: '#864' });
gun('Pinball Gun', { cd: 26, uses: 12, dmg: 6, spd: 12, bounce: 8, life: 170, r: 7, grav: 0.05, kb: 5, col: '#ccc' });
gun('Ricochet Rifle', { cd: 18, uses: 16, dmg: 8, spd: 16, bounce: 5, life: 120, r: 5, kb: 4, col: '#9df' });
gun('Disc Thrower', { cd: 22, uses: 16, dmg: 6, spd: 14, boom: true, pierce: true, r: 9, kb: 4, col: '#fff', life: 70 });
gun('Confetti Cannon', { cd: 35, uses: 8, n: 14, spr: 70, dmg: 1, spd: 10, life: 24, r: 3, kb: 1.5, col: '#f6f' });

// --- More melee (20)
melee('Rapier', { range: 78, thick: 14, dmg: 11, kb: 5, cd: 14, uses: 22, col: '#dfe' });
melee('Claymore', { range: 80, thick: 56, dmg: 20, kb: 13, cd: 48, uses: 9 });
melee('Scimitar', { range: 64, dmg: 10, kb: 7, cd: 16, uses: 20, col: '#ecd' });
melee('Machete', { range: 58, dmg: 9, kb: 6, cd: 16, uses: 20, col: '#bcb' });
melee('Cleaver', { range: 48, dmg: 14, kb: 9, cd: 32, col: '#ccc' });
melee('Battle Axe', { range: 66, thick: 52, dmg: 19, kb: 12, cd: 44, uses: 10, col: '#aab' });
melee('War Hammer', { range: 58, thick: 56, dmg: 17, kb: 14, stun: 25, cd: 50, uses: 9, col: '#99a' });
melee('Mace', { range: 54, thick: 44, dmg: 13, kb: 11, stun: 20, cd: 34, col: '#889' });
melee('Flail', { range: 110, thick: 40, dmg: 11, kb: 10, cd: 36, col: '#a99' });
melee('Nunchucks', { range: 56, thick: 34, dmg: 5, kb: 4, cd: 8, uses: 36, col: '#cb8' });
melee('Bo Staff', { range: 100, thick: 16, dmg: 8, kb: 12, cd: 24, uses: 20, col: '#c96' });
melee('Halberd', { range: 110, thick: 34, dmg: 16, kb: 10, cd: 42, uses: 10, col: '#bbd' });
melee('Pitchfork', { range: 90, thick: 30, dmg: 11, kb: 8, cd: 28, col: '#cb6' });
melee('Trident', { range: 88, thick: 32, dmg: 14, kb: 9, cd: 30, col: '#6cf' });
melee('Golf Club', { range: 70, thick: 16, dmg: 9, kb: 18, cd: 34, col: '#9c9' });
melee('Hockey Stick', { range: 82, thick: 18, dmg: 9, kb: 14, cd: 26, col: '#e96' });
melee('Tennis Racket', { range: 54, thick: 46, dmg: 4, kb: 20, cd: 18, uses: 24, col: '#fd4' });
melee('Rolling Pin', { range: 46, dmg: 8, kb: 9, stun: 20, cd: 24, col: '#dc9' });
melee('Baguette', { range: 60, dmg: 4, kb: 8, cd: 14, uses: 30, col: '#eb8' });
melee('Giant Fish', { range: 64, thick: 36, dmg: 6, kb: 16, cd: 26, uses: 16, col: '#6ac' });

// --- More area blasts (10)
nova('Earthquake', { radius: 160, dmg: 14, kb: 16, cd: 70, uses: 4 });
nova('Blizzard', { radius: 150, dmg: 6, kb: 6, freeze: 160, col: '#cff' });
nova('Inferno', { radius: 130, dmg: 10, kb: 9, burn: 320, col: '#f40' });
nova('Storm Surge', { radius: 140, dmg: 8, kb: 14, stun: 40, col: '#7af' });
nova('Toxic Burst', { radius: 120, dmg: 4, kb: 5, burn: 340, col: '#7c2' });
nova('Black Hole', { radius: 280, dmg: 2, kb: -24, col: '#82f', cd: 70, uses: 3 });
nova('Repulsor', { radius: 120, dmg: 2, kb: 22, col: '#8ff' });
nova('Mini Quake', { radius: 70, dmg: 8, kb: 10, cd: 25, uses: 12, col: '#a86' });
nova('Static Field', { radius: 110, dmg: 3, kb: 3, stun: 80, col: '#ff8' });
nova('Scream', { radius: 150, dmg: 5, kb: 18, col: '#fcf' });

// --- More dashes (5)
dash('Lunge', { frames: 9, speed: 16, dmg: 9, kb: 9, cd: 26, uses: 14 });
dash('Flying Kick', { frames: 14, speed: 12, dmg: 13, kb: 14, dy: 6, col: '#fa6' });
dash('Shoulder Charge', { frames: 18, speed: 12, dmg: 14, kb: 15, cd: 60, col: '#c85' });
dash('Jet Burst', { frames: 20, speed: 8, dmg: 6, kb: 6, dy: 10, cd: 45, col: '#6af' });
dash('Sonic Rush', { frames: 12, speed: 24, dmg: 10, kb: 11, cd: 55, col: '#fff' });

// --- More traps and turrets (8)
trap('Napalm Mine', { dmg: 10, radius: 85, kb: 6, burn: 300, col: '#f60' });
trap('Shock Mine', { dmg: 8, radius: 80, kb: 6, stun: 70, col: '#ff4' });
trap('Gas Trap', { dmg: 3, radius: 90, kb: 1, burn: 360, trig: 50, col: '#9c3' });
trap('Mega Mine', { dmg: 36, radius: 120, kb: 20, trig: 50, uses: 2, col: '#f22' });
trap('Freeze Trap', { dmg: 2, radius: 80, kb: 2, freeze: 180, trig: 40, col: '#cff' });
trap('Launch Pad', { dmg: 0, radius: 50, kb: 22, up: true, trig: 36, col: '#4f8' });
turret('Rapid Turret', { cd: 14, dmg: 1.6, dur: 360 });
turret('Heavy Turret', { cd: 90, dmg: 11, dur: 480, uses: 2 });

// --- More beams (8)
beam('Plasma Beam', { cd: 26, uses: 10, dmg: 7, thick: 8, kb: 5, col: '#c4f' });
beam('Gamma Ray', { cd: 80, uses: 4, dmg: 20, thick: 18, kb: 10, col: '#4f4', dur: 12 });
beam('Sun Beam', { cd: 45, uses: 6, dmg: 5, thick: 14, burn: 200, kb: 3, col: '#fd4' });
beam('Shock Beam', { cd: 40, uses: 8, dmg: 6, thick: 10, stun: 45, kb: 2, col: '#8df' });
beam('Ice Beam', { cd: 35, uses: 8, dmg: 5, thick: 10, freeze: 150, kb: 2, col: '#aef' });
beam('Push Beam', { cd: 35, uses: 10, dmg: 1, thick: 18, kb: 26, col: '#adf' });
beam('Grapple Beam', { cd: 35, uses: 8, dmg: 3, thick: 8, pull: 20, kb: 0, col: '#fa4' });
beam('Dizzy Ray', { cd: 45, uses: 5, dmg: 1, thick: 12, invert: 320, kb: 1, col: '#f8f' });

// --- More utility (8)
util('Mega Medkit', { u: 'heal', amt: 60, col: '#4f4' });
util('Bandage', { u: 'heal', amt: 15, uses: 3, cd: 40, col: '#fdd' });
util('Energy Drink', { u: 'speed', dur: 700, col: '#4ff' });
util('Force Field', { u: 'shield', dur: 420, col: '#9df' });
util('Blink Staff', { u: 'tele', dist: 140, uses: 6, cd: 18, col: '#fcf' });
util('Long Teleport', { u: 'tele', dist: 420, uses: 2, cd: 40, col: '#c8f' });
util('Swap Gun', { u: 'swap', uses: 4, cd: 50, col: '#fa6' });
util('Moon Boots', { u: 'moon', dur: 480, col: '#ddf' });

// ===== Procedural mega-pack: 1000 more weapons =====
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateWeapons(seed, COUNTS, dbl) {
  const rng = mulberry32(seed);
  const R = (a, b) => a + rng() * (b - a);
  const used = new Set(COMMON.map(w => w.name));
  const ALL = ['bullet', 'melee', 'beam', 'nova', 'mine'];
  const MODS = [
    ['Flaming', ALL, w => { w.burn = 180; }, '#ff7a20'],
    ['Frozen', ALL, w => { w.freeze = 90; }, '#8ff0ff'],
    ['Shocking', ALL, w => { w.stun = 40; }, '#ffee40'],
    ['Toxic', ALL, w => { w.burn = 260; }, '#8fd040'],
    ['Blazing', ALL, w => { w.burn = 240; w.dmg *= 1.1; }, '#ff5010'],
    ['Glacial', ALL, w => { w.freeze = 140; }, '#bff'],
    ['Thunder', ALL, w => { w.stun = 60; w.cd *= 1.15; }, '#ff4'],
    ['Scorching', ALL, w => { w.burn = 140; w.dmg *= 1.2; }, '#fa4'],
    ['Chilling', ALL, w => { w.freeze = 70; w.cd *= 0.85; }, '#9ef'],
    ['Static', ALL, w => { w.stun = 25; w.cd *= 0.8; }, '#ee8'],
    ['Heavy', ALL, w => { w.dmg *= 1.4; w.kb *= 1.3; w.cd *= 1.25; }],
    ['Swift', ALL, w => { w.cd *= 0.65; w.dmg *= 0.8; }],
    ['Mighty', ALL, w => { w.dmg *= 1.6; w.cd *= 1.3; }],
    ['Brutal', ALL, w => { w.kb *= 1.7; w.dmg *= 1.1; }],
    ['Rapid', ALL, w => { w.cd *= 0.5; w.dmg *= 0.6; w.uses *= 1.6; }],
    ['Endless', ALL, w => { w.uses *= 2.2; }],
    ['Tiny', ALL, w => { w.dmg *= 0.75; w.cd *= 0.7; w.uses *= 1.3; }],
    ['Giant', ALL, w => { if (w.r) w.r *= 1.6; if (w.range) w.range *= 1.25; if (w.radius) w.radius *= 1.3; w.dmg *= 1.25; w.cd *= 1.3; }],
    ['Colossal', ALL, w => { if (w.r) w.r *= 2; if (w.range) { w.range *= 1.4; w.thick *= 1.4; } if (w.radius) w.radius *= 1.5; w.dmg *= 1.5; w.cd *= 1.6; w.kb *= 1.5; }],
    ['Twin', ['bullet'], w => { w.n = 2; w.spr = 8; w.cd *= 1.3; }],
    ['Triple', ['bullet'], w => { w.n = 3; w.spr = 18; w.cd *= 1.4; w.dmg *= 0.8; }],
    ['Quad', ['bullet'], w => { w.n = 4; w.spr = 26; w.cd *= 1.5; w.dmg *= 0.7; }],
    ['Scatter', ['bullet'], w => { w.n = 6; w.spr = 36; w.life = Math.min(w.life, 30); w.dmg *= 0.55; w.cd *= 1.5; }],
    ['Homing', ['bullet'], w => { w.home = 0.09; w.life += 50; w.spd *= 0.75; }],
    ['Seeking', ['bullet'], w => { w.home = 0.14; w.life += 60; w.spd *= 0.7; w.dmg *= 0.8; }],
    ['Bouncing', ['bullet'], w => { w.bounce = 4; w.life = Math.max(w.life, 120); w.grav = 0.08; }],
    ['Ricochet', ['bullet'], w => { w.bounce = 6; w.life = Math.max(w.life, 140); }],
    ['Piercing', ['bullet'], w => { w.pierce = true; w.dmg *= 0.9; }],
    ['Boomerang', ['bullet'], w => { w.boom = true; w.pierce = true; w.life = Math.max(w.life, 70); }],
    ['Explosive', ['bullet'], w => { w.explode = 55; w.expDmg = w.dmg * 1.6 + 6; w.expKb = 10; w.dmg *= 0.5; }],
    ['Volatile', ['bullet'], w => { w.explode = 80; w.expDmg = 22; w.expKb = 13; w.cd *= 1.3; w.dmg *= 0.4; }],
    ['Cluster', ['bullet'], w => { w.explode = 45; w.expDmg = 8; w.expKb = 7; w.frag = 6; w.cd *= 1.4; w.dmg *= 0.4; }],
    ['Lobbing', ['bullet'], w => { w.grav = 0.3; w.up = 5; w.life = Math.max(w.life, 90); w.spd *= 0.8; }],
    ['Sniper', ['bullet'], w => { w.spd *= 1.8; w.dmg *= 1.8; w.cd *= 1.6; w.pierce = true; w.jit = 0; }],
    ['Burst', ['bullet'], w => { w.burst = 3; w.cd *= 1.8; w.dmg *= 0.8; }],
    ['Wobbly', ['bullet'], w => { w.jit = 16; w.cd *= 0.8; }],
    ['Long', ['melee'], w => { w.range *= 1.5; w.cd *= 1.1; }],
    ['Wide', ['melee'], w => { w.thick *= 1.7; }],
    ['Spiked', ['melee'], w => { w.dmg *= 1.25; w.burn = (w.burn || 0) + 60; }],
    ['Vicious', ['melee'], w => { w.dmg *= 1.5; w.cd *= 1.3; }],
    ['Quick', ['melee', 'turret'], w => { w.cd *= 0.5; w.dmg *= 0.6; }],
    ['Stunning', ['melee'], w => { w.stun = 35; w.cd *= 1.2; }],
    ['Sweeping', ['beam'], w => { w.thick *= 2; }],
    ['Pulsing', ['beam'], w => { w.dur *= 1.8; }],
    ['Expanding', ['nova'], w => { w.radius *= 1.5; }],
    ['Crushing', ['nova'], w => { w.kb *= 1.6; w.dmg *= 1.2; }],
    ['Sticky', ['mine'], w => { w.trig *= 1.4; }],
    ['Massive', ['mine'], w => { w.radius *= 1.4; w.dmg *= 1.3; }],
    ['Furious', ['dash'], w => { w.dmg *= 1.4; w.kb *= 1.3; }],
    ['Lightning', ['dash'], w => { w.speed *= 1.4; w.frames *= 0.8; }],
    ['Marathon', ['dash'], w => { w.frames *= 1.6; }],
    ['Sudden', ['dash'], w => { w.cd *= 0.6; w.dmg *= 0.8; }],
    ['Reckless', ['dash'], w => { w.dmg *= 1.6; w.cd *= 1.3; }],
    ['Steady', ['dash'], w => { w.speed *= 0.8; w.frames *= 1.3; w.kb *= 1.2; }],
    ['Ferocious', ['dash'], w => { w.dmg *= 1.3; w.kb *= 1.5; w.cd *= 1.2; }],
    ['Nimble', ['dash'], w => { w.cd *= 0.5; w.speed *= 1.15; }],
    ['Relentless', ['dash'], w => { w.uses *= 2; w.dmg *= 0.8; }],
    ['Savage', ['dash'], w => { w.dmg *= 1.8; w.cd *= 1.4; }],
    ['Wild', ['dash'], w => { w.dy = 8; w.frames *= 1.1; }],
    ['Zealous', ['dash'], w => { w.kb *= 1.8; }],
    ['Slow', ['turret'], w => { w.cd *= 1.7; w.dmg *= 2; }],
    ['Sturdy', ['turret'], w => { w.dur *= 1.6; }],
    ['Fragile', ['turret'], w => { w.dur *= 0.6; w.dmg *= 1.5; }],
    ['Precise', ['turret'], w => { w.dmg *= 1.3; }],
    ['Deadly', ['turret'], w => { w.dmg *= 2; w.cd *= 1.8; }],
    ['Mega', ['turret'], w => { w.dmg *= 1.6; w.dur *= 1.3; w.cd *= 1.3; }],
    ['Fleeting', ['turret'], w => { w.dur *= 0.5; w.cd *= 0.6; }],
    ['Stubborn', ['turret'], w => { w.dur *= 2; w.dmg *= 0.7; }],
    ['Angry', ['turret'], w => { w.cd *= 0.5; w.dmg *= 1.2; }],
    ['Lazy', ['turret'], w => { w.cd *= 1.4; w.dur *= 1.4; }],
  ];
  const NOUNS = {
    bullet: ['Blaster', 'Rifle', 'Launcher', 'Cannon', 'Pistol', 'Shooter', 'Repeater', 'Thrower', 'Spitter', 'Gun', 'Mortar', 'Slinger', 'Carbine', 'Caster', 'Driver', 'Projector'],
    melee: ['Blade', 'Hammer', 'Axe', 'Staff', 'Club', 'Spear', 'Sword', 'Whip', 'Mace', 'Gauntlet', 'Cleaver', 'Saber'],
    beam: ['Ray', 'Beam', 'Laser', 'Lance', 'Emitter'],
    nova: ['Blast', 'Nova', 'Pulse', 'Burst', 'Wave', 'Shock'],
    dash: ['Dash', 'Rush', 'Charge', 'Lunge'],
    mine: ['Mine', 'Trap', 'Bomb', 'Snare'],
    turret: ['Turret', 'Sentry', 'Tower'],
  };
  const BASE = {
    bullet: () => ({ cd: R(8, 60), uses: R(8, 40), dmg: R(3, 16), spd: R(9, 18), n: 1, spr: 0, jit: R(0, 6), grav: 0, life: R(35, 80), r: R(4, 8), kb: R(2, 8), up: 0 }),
    melee: () => ({ cd: R(10, 50), uses: R(10, 30), dmg: R(5, 18), kb: R(5, 15), range: R(40, 90), thick: R(20, 50), dur: 8 }),
    beam: () => ({ cd: R(25, 90), uses: R(4, 10), len: R(450, 700), thick: R(6, 14), dmg: R(4, 18), kb: R(2, 12), dur: 8 }),
    nova: () => ({ cd: R(40, 80), uses: R(4, 8), radius: R(80, 150), dmg: R(3, 13), kb: R(5, 16) }),
    dash: () => ({ cd: R(30, 70), uses: R(5, 10), frames: R(9, 20), speed: R(10, 20), dmg: R(6, 16), kb: R(6, 15), dy: rng() < 0.25 ? R(6, 12) : 0 }),
    mine: () => ({ cd: R(30, 60), uses: R(2, 5), dmg: R(8, 28), radius: R(60, 110), kb: R(6, 16), trig: R(40, 55) }),
    turret: () => ({ cd: R(14, 80), uses: R(2, 3), dur: R(300, 480), dmg: R(1.5, 8) }),
  };
  const KIND_KEY = { bullet: 'bullet', melee: 'melee', beam: 'beam', nova: 'nova', dash: 'dash', mine: 'mine', turret: 'turret' };

  for (const kind of Object.keys(COUNTS)) {
    const pairs = [];
    const compat = MODS.filter(m => m[1].includes(kind));
    if (!dbl) {
      for (const m of compat) for (const noun of NOUNS[kind]) pairs.push([[m], noun]);
      for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
    } else {
      const seen = new Set();
      for (let tries = 0; tries < COUNTS[kind] * 8 && pairs.length < COUNTS[kind] * 3; tries++) {
        const m1 = compat[Math.floor(rng() * compat.length)], m2 = compat[Math.floor(rng() * compat.length)];
        const noun = NOUNS[kind][Math.floor(rng() * NOUNS[kind].length)];
        if (m1 === m2) continue;
        const key = m1[0] + '|' + m2[0] + '|' + noun;
        if (seen.has(key)) continue;
        seen.add(key); pairs.push([[m1, m2], noun]);
      }
    }
    let made = 0;
    for (const [ms, noun] of pairs) {
      if (made >= COUNTS[kind]) break;
      const name = ms.map(m => m[0]).join(' ') + ' ' + noun;
      if (used.has(name)) continue;
      used.add(name);
      const w = BASE[kind]();
      for (const m of ms) m[2](w);
      w.dmg *= R(0.9, 1.1); w.cd *= R(0.9, 1.1);
      w.name = name; w.k = KIND_KEY[kind];
      const cm = ms.find(m => m[3]);
      w.col = cm ? cm[3] : 'hsl(' + Math.floor(rng() * 360) + ',80%,65%)';
      w.uses = Math.max(1, Math.round(w.uses)); w.cd = Math.max(2, Math.round(w.cd));
      w.dmg = Math.min(w.dmg, 40); w.kb = Math.min(w.kb || 0, 30);
      if (w.r) w.r = Math.min(w.r, 34);
      if (w.spd) w.spd = Math.min(w.spd, 34);
      if (w.life) w.life = Math.round(w.life);
      if (w.frames) w.frames = Math.round(w.frames);
      if (w.dur) w.dur = Math.round(w.dur);
      COMMON.push(w);
      made++;
    }
  }

  if (dbl) return;
  const TIERS = ['Minor', 'Lesser', 'Small', 'Basic', 'Common', 'Fine', 'Greater', 'Major', 'Superior', 'Grand', 'Royal', 'Supreme'];
  const UTILS = [
    ['heal', 'Tonic', t => ({ amt: Math.round(15 + t * 70), col: '#6f6' })],
    ['shield', 'Aegis', t => ({ dur: Math.round(150 + t * 350), col: '#7cf' })],
    ['speed', 'Boots', t => ({ dur: Math.round(300 + t * 500), col: '#ff8' })],
    ['moon', 'Sandals', t => ({ dur: Math.round(300 + t * 400), col: '#ddf' })],
    ['tele', 'Staff', t => ({ dist: Math.round(100 + t * 350), col: '#c8f' })],
  ];
  for (const [u, noun, f] of UTILS) {
    TIERS.forEach((tier, i) => {
      const t = i / (TIERS.length - 1);
      COMMON.push(Object.assign({ name: tier + ' ' + noun, k: 'util', u, cd: 40, uses: t < 0.5 ? 2 : 1 }, f(t)));
    });
  }
}
generateWeapons(20260924, { bullet: 500, melee: 200, beam: 60, nova: 60, dash: 40, mine: 50, turret: 30 }, false);
generateWeapons(77031, { bullet: 520, melee: 220, beam: 70, nova: 70, dash: 40, mine: 50, turret: 30 }, true);

// --- The rare one: shotgun blast of huge bullets
const RARE = {
  name: 'MEGA SCATTERGUN', k: 'bullet', rare: true,
  cd: 70, uses: 4, n: 5, spr: 40, dmg: 22, spd: 11, jit: 0, grav: 0,
  life: 50, r: 26, kb: 22, col: '#ff30d0', up: 0,
};
const FISTS = { name: 'Fists', k: 'melee', cd: 20, uses: Infinity, dmg: 4, kb: 5, range: 36, thick: 30, dur: 6, col: '#ffd0a0' };
const TOTAL_WEAPONS = COMMON.length + 1;

function rollWeapon() {
  if (Math.random() < 1 / RARE_ODDS) return RARE;
  return COMMON[Math.floor(Math.random() * COMMON.length)];
}

// ============================================================
// Maps (all symmetric, spawns on solid footing)
// ============================================================
const S = (x, y, w, h) => ({ x, y, w, h, solid: true });
const T = (x, y, w) => ({ x, y, w, h: 12, solid: false });

const MAPS = [
  {
    name: 'Classic Arena', sky: ['#243b6b', '#0e1428'],
    plats: [S(0, 480, 960, 60), T(120, 370, 200), T(640, 370, 200), T(380, 260, 200)],
    haz: [], spawns: [[150, 436], [780, 436]],
    crates: [[220, 370], [740, 370], [480, 260], [480, 480]],
  },
  {
    name: 'Twin Islands', sky: ['#3b2a5c', '#120c22'],
    plats: [S(0, 470, 360, 70), S(600, 470, 360, 70), T(400, 340, 160), T(60, 330, 180), T(720, 330, 180)],
    haz: [], spawns: [[120, 426], [810, 426]],
    crates: [[150, 330], [810, 330], [480, 340], [200, 470], [760, 470]],
  },
  {
    name: 'Sky Steps', sky: ['#1d5c6b', '#0a1a22'],
    plats: [T(60, 430, 240), T(660, 430, 240), T(330, 340, 300), T(100, 240, 200), T(660, 240, 200), T(380, 150, 200)],
    haz: [], spawns: [[140, 386], [790, 386]],
    crates: [[200, 240], [760, 240], [480, 150], [480, 340]],
  },
  {
    name: 'Spike Pit', sky: ['#4a2a2a', '#150a0a'],
    plats: [S(0, 470, 330, 70), S(630, 470, 330, 70), T(400, 360, 160), T(100, 330, 160), T(700, 330, 160), T(430, 230, 100)],
    haz: [{ x: 330, y: 495, w: 300, h: 45, kind: 'spikes', dmg: 14 }],
    spawns: [[100, 426], [830, 426]],
    crates: [[180, 330], [780, 330], [480, 360], [480, 230]],
  },
  {
    name: 'Tower', sky: ['#2c4a3a', '#0b1610'],
    plats: [S(180, 480, 600, 60), T(120, 380, 260), T(580, 380, 260), T(340, 280, 280), T(160, 180, 200), T(600, 180, 200)],
    haz: [], spawns: [[230, 436], [700, 436]],
    crates: [[250, 380], [710, 380], [480, 280], [260, 180], [700, 180]],
  },
  {
    name: 'Lava Bridge', sky: ['#5a2a12', '#1a0a04'],
    plats: [S(260, 440, 440, 24), T(430, 320, 100), T(180, 300, 120), T(660, 300, 120), T(40, 400, 140), T(780, 400, 140)],
    haz: [{ x: 0, y: 505, w: 960, h: 35, kind: 'lava', dmg: 20 }],
    spawns: [[300, 396], [630, 396]],
    crates: [[480, 320], [240, 300], [720, 300], [480, 440], [110, 400], [850, 400]],
  },
  {
    name: 'Cage', sky: ['#333344', '#0c0c14'],
    plats: [S(0, 0, 30, 540), S(930, 0, 30, 540), S(0, 0, 960, 30), S(0, 490, 960, 50), T(200, 380, 200), T(560, 380, 200), T(380, 270, 200)],
    haz: [], spawns: [[100, 446], [830, 446]],
    crates: [[300, 380], [660, 380], [480, 270], [480, 490]],
  },
  {
    name: 'Zig Zag', sky: ['#5c3b6b', '#170c1e'],
    plats: [T(40, 300, 180), T(220, 380, 140), T(390, 460, 180), T(600, 380, 140), T(740, 300, 180), T(400, 200, 160)],
    haz: [], spawns: [[80, 256], [850, 256]],
    crates: [[110, 300], [830, 300], [480, 460], [480, 200], [290, 380], [670, 380]],
  },
  {
    name: 'Pillars', sky: ['#2b3f5c', '#0a0f18'],
    plats: [S(0, 480, 960, 60), S(220, 340, 40, 140), S(700, 340, 40, 140), S(460, 400, 40, 80), T(120, 300, 120), T(720, 300, 120), T(440, 240, 80)],
    haz: [], spawns: [[100, 436], [830, 436]],
    crates: [[180, 300], [780, 300], [480, 240], [480, 400], [240, 340], [720, 340]],
  },
];

// ===== Procedural maps: 1000 more, always left/right mirrored so they're fair =====
const MAP_ADJ = ['Rusty', 'Frozen', 'Molten', 'Shadow', 'Neon', 'Golden', 'Mossy', 'Crystal', 'Stormy', 'Silent', 'Burning', 'Ancient', 'Floating', 'Hidden', 'Broken', 'Cursed', 'Sunny', 'Windy', 'Dusty', 'Toxic', 'Iron', 'Velvet', 'Savage', 'Lucky', 'Crimson', 'Azure', 'Emerald', 'Violet', 'Amber', 'Ivory', 'Hollow', 'Twisted', 'Lonely', 'Grand', 'Tiny', 'Wild', 'Royal', 'Electric', 'Misty', 'Sacred'];
const MAP_PLACE = ['Canyon', 'Fortress', 'Ruins', 'Temple', 'Bridge', 'Harbor', 'Citadel', 'Garden', 'Factory', 'Rooftops', 'Docks', 'Mines', 'Colosseum', 'Summit', 'Bazaar', 'Outpost', 'Lagoon', 'Crypt', 'Arena', 'Terrace', 'Workshop', 'Cliffs', 'Station', 'Tavern', 'Reactor', 'Grove', 'Arcade', 'Bunker', 'Springs', 'Junkyard', 'Depot'];
const GENERATED_MAPS = 1000;
const TOTAL_MAPS = MAPS.length + GENERATED_MAPS;
const mapCache = {};

function genMap(j) {
  const rng = mulberry32(j * 7919 + 13);
  const R = (a, b) => a + rng() * (b - a);
  const RI = (a, b) => Math.floor(R(a, b + 1));
  const plats = [], haz = [], spots = [];
  const style = ['full', 'full', 'islands', 'floating', 'pit', 'cage', 'pillars', 'lavabridge'][RI(0, 7)];
  const addT = (x, y, w, center) => {
    plats.push(T(x, y, w)); spots.push([x + w / 2, y]);
    if (!center) { const mx = W - x - w; plats.push(T(mx, y, w)); spots.push([mx + w / 2, y]); }
  };
  let groundTop = 480, sx = 100, sy = 436, tierBase = 380;
  if (style === 'full') {
    plats.push(S(0, 480, 960, 60)); sx = RI(60, 200);
  } else if (style === 'islands') {
    const gap = RI(140, 320), half = (W - gap) / 2;
    plats.push(S(0, 470, half, 70), S(W - half, 470, half, 70));
    groundTop = 470; sy = 426; sx = RI(40, half - 80);
  } else if (style === 'floating') {
    const sw = RI(160, 240);
    addT(60, 430, sw);
    sx = 60 + sw / 2 - PW / 2; sy = 386; tierBase = 340; groundTop = 430;
    if (rng() < 0.5) haz.push({ x: 0, y: 505, w: W, h: 35, kind: 'lava', dmg: 20 });
  } else if (style === 'pit') {
    const pw = RI(180, 320), half = (W - pw) / 2;
    plats.push(S(0, 470, half, 70), S(W - half, 470, half, 70));
    haz.push({ x: half, y: 495, w: pw, h: 45, kind: rng() < 0.5 ? 'spikes' : 'lava', dmg: rng() < 0.5 ? 14 : 20 });
    groundTop = 470; sy = 426; sx = RI(40, half - 80);
  } else if (style === 'cage') {
    plats.push(S(0, 0, 30, 540), S(930, 0, 30, 540), S(0, 0, 960, 30), S(0, 490, 960, 50));
    groundTop = 490; sy = 446; sx = RI(60, 200); tierBase = 390;
  } else if (style === 'pillars') {
    plats.push(S(0, 480, 960, 60)); sx = RI(50, 120);
    const n = RI(1, 2);
    for (let k = 0; k < n; k++) {
      const h = RI(80, 150), x = RI(180 + k * 110, 240 + k * 110);
      plats.push(S(x, 480 - h, 40, h), S(W - x - 40, 480 - h, 40, h));
      spots.push([x + 20, 480 - h], [W - x - 20, 480 - h]);
    }
  } else {
    const x0 = RI(200, 300);
    plats.push(S(x0, 440, W - 2 * x0, 24));
    haz.push({ x: 0, y: 505, w: W, h: 35, kind: 'lava', dmg: 20 });
    addT(40, 400, 140);
    groundTop = 440; sx = x0 + 30; sy = 396;
  }
  const tiers = RI(2, 4);
  for (let t = 0; t < tiers; t++) {
    const y = Math.max(120, tierBase - t * 85 + RI(-12, 12));
    const w1 = RI(90, 220), x1 = RI(40, 440 - w1);
    addT(x1, y, w1);
    if (rng() < 0.5) { const w2 = RI(80, 160), x2 = x1 + w1 + RI(30, 60); if (x2 + w2 <= 440) addT(x2, y, w2); }
    if (rng() < 0.45) { const cw = RI(80, 180); addT(W / 2 - cw / 2, y, cw, true); }
  }
  let patch = false;
  if (['full', 'cage', 'pillars'].includes(style) && rng() < 0.35) {
    const pw = RI(60, 120);
    haz.push({ x: W / 2 - pw / 2, y: groundTop - 16, w: pw, h: 16, kind: 'spikes', dmg: 12 });
    patch = true;
  }
  if (['full', 'cage', 'lavabridge'].includes(style) && !patch) spots.push([W / 2, groundTop]);
  for (let i = spots.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [spots[i], spots[k]] = [spots[k], spots[i]]; }
  const hue = RI(0, 359);
  return {
    name: MAP_ADJ[j % MAP_ADJ.length] + ' ' + MAP_PLACE[Math.floor(j / MAP_ADJ.length) % MAP_PLACE.length],
    sky: ['hsl(' + hue + ',40%,28%)', 'hsl(' + ((hue + 20) % 360) + ',50%,8%)'],
    plats, haz, spawns: [[sx, sy], [W - sx - PW, sy]],
    crates: spots.slice(0, 8).map(s => [Math.round(s[0]), s[1]]),
  };
}

function getMap(i) {
  if (i < MAPS.length) return MAPS[i];
  const j = i - MAPS.length;
  return mapCache[j] || (mapCache[j] = genMap(j));
}

// ============================================================
// State
// ============================================================
const keys = {};
const CTL = [
  { l: 'KeyA', r: 'KeyD', j: 'KeyW', f: 'KeyV', d: 'KeyB' },
  { l: 'ArrowLeft', r: 'ArrowRight', j: 'ArrowUp', f: 'Slash', d: 'ArrowDown' },
];
const COLORS = ['#4ad0ff', '#ff5b7a'];

let state = 'menu'; // menu | countdown | playing | roundover | matchover
let timer = 0;
let selMap = -1;
let map = MAPS[0];
let mapIdx = 0;
let players = [];
let scores = [0, 0];
let projs = [], melees = [], beams = [], explosions = [], deploy = [], crates = [], particles = [], banners = [];
let crateTimer = 0;
let lastWinner = -1;
let shake = 0;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function circleRect(c, r) {
  const nx = clamp(c.x, r.x, r.x + r.w), ny = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - nx, dy = c.y - ny;
  return dx * dx + dy * dy <= c.r * c.r;
}
function enemyOf(p) { return players[1 - p.id]; }
function solidHit(r) { return map.plats.some(s => s.solid && overlap(r, s)); }

function makePlayer(id) {
  const sp = map.spawns[id];
  return {
    id, x: sp[0], y: sp[1], w: PW, h: PH, vx: 0, vy: 0, face: id === 0 ? 1 : -1,
    onGround: false, jumps: 2, jHeld: false, hp: 100, dead: false,
    weapon: FISTS, ammo: Infinity, cd: 0, burst: null,
    stun: 0, freeze: 0, burn: 0, invert: 0, shield: 0, speedT: 0, hazCd: 0, flash: 0,
    dash: { t: 0 }, dashT: 0, dashCd: 0, launchCd: 0,
  };
}

function giveWeapon(p, w) {
  p.weapon = w; p.ammo = w.uses; p.cd = 0; p.burst = null;
  banners.push({ text: 'P' + (p.id + 1) + ': ' + w.name + (w.rare ? '  ** RARE! **' : ''), col: w.rare ? '#ffd700' : COLORS[p.id], life: w.rare ? 200 : 110, big: !!w.rare });
  if (w.rare) shake = 14;
}

// ============================================================
// Match flow
// ============================================================
function startMatch() {
  mapIdx = selMap < 0 ? Math.floor(Math.random() * TOTAL_MAPS) : selMap;
  map = getMap(mapIdx);
  scores = [0, 0];
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('end').classList.add('hidden');
  startRound();
}

function startRound() {
  projs = []; melees = []; beams = []; explosions = []; deploy = []; crates = []; particles = []; banners = [];
  players = [makePlayer(0), makePlayer(1)];
  for (const p of players) giveWeapon(p, rollWeapon());
  crateTimer = 240;
  spawnCrate();
  state = 'countdown';
  timer = 150;
}

function checkEnd() {
  const d0 = players[0].dead, d1 = players[1].dead;
  if (!d0 && !d1) return;
  state = 'roundover';
  timer = 130;
  lastWinner = d0 && !d1 ? 1 : d1 && !d0 ? 0 : -1;
  if (lastWinner >= 0) scores[lastWinner]++;
}

function afterRound() {
  if (scores[0] >= WINS_NEEDED || scores[1] >= WINS_NEEDED) {
    state = 'matchover';
    document.getElementById('endTitle').textContent = (scores[0] > scores[1] ? 'PLAYER 1' : 'PLAYER 2') + ' WINS THE MATCH!';
    document.getElementById('end').classList.remove('hidden');
  } else {
    startRound();
  }
}

function showMenu() {
  state = 'menu';
  document.getElementById('end').classList.add('hidden');
  document.getElementById('menu').classList.remove('hidden');
}

// ============================================================
// Combat
// ============================================================
function burst(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 4;
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 20 + Math.random() * 15, col, r: 2 + Math.random() * 3 });
  }
}

function kill(t) {
  if (t.dead) return;
  t.dead = true;
  burst(clamp(t.x + t.w / 2, 0, W), clamp(t.y + t.h / 2, 0, H), 40, COLORS[t.id]);
  shake = 12;
  checkEnd();
}

function hurt(t, dmg, kx, ky, o) {
  o = o || {};
  if (t.dead) return;
  if (t.shield > 0) { dmg *= 0.1; kx *= 0.25; ky *= 0.25; }
  t.hp -= dmg;
  const sc = 1 + (1 - Math.max(0, t.hp) / 100) * 0.9;
  if (Math.abs(kx) >= 6) t.vx = kx * sc; else t.vx += kx * sc;
  if (Math.abs(ky) >= 3) t.vy = ky * sc; else t.vy += ky * sc;
  t.vx = clamp(t.vx, -34, 34); t.vy = clamp(t.vy, -24, 24);
  if (kx || ky) t.onGround = false;
  if (o.stun) t.stun = Math.max(t.stun, o.stun);
  if (o.freeze) t.freeze = Math.max(t.freeze, o.freeze);
  if (o.burn) t.burn = Math.max(t.burn, o.burn);
  if (o.invert) t.invert = Math.max(t.invert, o.invert);
  t.flash = 6;
  if (dmg > 0.5) burst(t.x + t.w / 2, t.y + t.h / 2, 3, '#fff');
  if (t.hp <= 0) kill(t);
}

function explode(x, y, r, dmg, kb, owner, o) {
  o = o || {};
  explosions.push({ x, y, r, life: 16, max: 16, col: o.col || '#ffb040' });
  burst(x, y, 12, o.col || '#ffb040');
  for (const t of players) {
    if (t === owner || t.dead) continue;
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2, d = Math.hypot(cx - x, cy - y);
    if (d > r + 18) continue;
    const f = 1 - Math.min(1, d / (r + 18)) * 0.5;
    const a = Math.atan2(cy - y, cx - x);
    let kx = Math.cos(a) * kb, ky = Math.sin(a) * kb * 0.7 - 3;
    if (o.up) { kx = Math.cos(a) * kb * 0.3; ky = -kb * 1.1; }
    if (kb < 0) ky = Math.sin(a) * kb * 0.7;
    hurt(t, dmg * f, kx, ky, o);
  }
}

function spawnFrags(b) {
  for (let k = 0; k < b.frag; k++) {
    const a = k / b.frag * Math.PI * 2;
    projs.push({
      x: b.x, y: b.y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7 - 2, r: 4, dmg: 4, kb: 3,
      owner: b.owner, grav: 0.3, life: 30, maxLife: 30, pierce: false, bounce: 0,
      explode: 0, expDmg: 0, expKb: 0, home: 0, boom: false, frag: 0, col: '#ffcc66', hit: new Set(),
    });
  }
}

function shootBullet(p, w) {
  const n = w.n || 1;
  for (let i = 0; i < n; i++) {
    let a = 0;
    if (n > 1) a = (-(w.spr || 0) / 2 + (w.spr || 0) * i / (n - 1)) * Math.PI / 180;
    if (w.jit) a += (Math.random() - 0.5) * w.jit * Math.PI / 180;
    projs.push({
      x: p.x + p.w / 2 + p.face * 16, y: p.y + p.h / 2 - 4,
      vx: Math.cos(a) * w.spd * p.face, vy: Math.sin(a) * w.spd - (w.up || 0),
      r: w.r, dmg: w.dmg, kb: w.kb || 0, owner: p, grav: w.grav || 0, life: w.life, maxLife: w.life,
      pierce: !!w.pierce, bounce: w.bounce || 0, explode: w.explode || 0, expDmg: w.expDmg || 0, expKb: w.expKb || 0,
      home: w.home || 0, boom: !!w.boom, burn: w.burn, freeze: w.freeze, stun: w.stun, frag: w.frag || 0,
      col: w.col, rare: !!w.rare, hit: new Set(),
    });
  }
}

function meleeRect(m) {
  const p = m.owner, w = m.w;
  return {
    x: p.face > 0 ? p.x + p.w - 4 : p.x - w.range + 4, y: p.y + p.h / 2 - w.thick / 2,
    w: w.range, h: w.thick,
  };
}

function shootBeam(p, w) {
  const e = enemyOf(p);
  const y = p.y + p.h / 2 - 4, x0 = p.x + p.w / 2 + p.face * 10;
  let x1 = x0 + p.face * w.len;
  for (const s of map.plats) {
    if (!s.solid || y < s.y || y > s.y + s.h) continue;
    if (p.face > 0 && s.x > x0 && s.x < x1) x1 = s.x;
    if (p.face < 0 && s.x + s.w < x0 && s.x + s.w > x1) x1 = s.x + s.w;
  }
  beams.push({ x0, x1, y, thick: w.thick, life: w.dur, max: w.dur, col: w.col });
  if (e.dead) return;
  const r = { x: Math.min(x0, x1), y: y - w.thick / 2 - 2, w: Math.abs(x1 - x0), h: w.thick + 4 };
  if (overlap(r, e)) {
    hurt(e, w.dmg, p.face * w.kb, -w.kb * 0.3, w);
    if (w.pull) e.vx = -p.face * w.pull;
  }
}

function shootUtil(p, w) {
  const e = enemyOf(p);
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
  burst(cx, cy, 14, w.col);
  if (w.u === 'heal') p.hp = Math.min(100, p.hp + w.amt);
  else if (w.u === 'shield') p.shield = w.dur;
  else if (w.u === 'speed') p.speedT = w.dur;
  else if (w.u === 'moon') p.jumpT = w.dur;
  else if (w.u === 'tele') {
    let nx = clamp(p.x + p.face * w.dist, 10, W - 10 - p.w);
    for (let k = 0; k < 14 && solidHit({ x: nx, y: p.y, w: p.w, h: p.h }); k++) nx -= p.face * 20;
    p.x = nx; p.vx = 0;
    burst(p.x + p.w / 2, cy, 14, w.col);
  } else if (w.u === 'swap' && !e.dead) {
    const tx = e.x, ty = e.y;
    e.x = p.x; e.y = p.y; p.x = tx; p.y = ty;
    e.vx = 0; e.vy = 0; p.vx = 0; p.vy = 0;
  }
}

function shoot(p, w) {
  switch (w.k) {
    case 'bullet': shootBullet(p, w); break;
    case 'melee': { const m = { owner: p, w, life: w.dur, hit: false }; melees.push(m); break; }
    case 'beam': shootBeam(p, w); break;
    case 'nova':
      explode(p.x + p.w / 2, p.y + p.h / 2, w.radius, w.dmg, w.kb, p, w);
      break;
    case 'dash': p.dash = { t: w.frames, sp: w.speed, dmg: w.dmg, kb: w.kb, dy: w.dy, did: false, hit: false }; break;
    case 'mine': deploy.push({ type: 'mine', x: p.x + p.w / 2, y: p.y + p.h, vy: 0, owner: p, arm: 40, life: 1500, w, landed: false }); break;
    case 'turret': deploy.push({ type: 'turret', x: p.x + p.w / 2 + p.face * 24, y: p.y + p.h, vy: 0, owner: p, life: w.dur, cd: 20, w, landed: false }); break;
    case 'util': shootUtil(p, w); break;
  }
}

function tryFire(p) {
  const w = p.weapon;
  p.cd = w.cd;
  shoot(p, w);
  if (w.burst) p.burst = { w, left: w.burst - 1, t: 5 };
  if (w.uses !== Infinity) {
    p.ammo--;
    if (p.ammo <= 0) { p.weapon = FISTS; p.ammo = Infinity; }
  }
}

// ============================================================
// Update
// ============================================================
function movePlayer(p) {
  p.x += p.vx;
  for (const s of map.plats) {
    if (!s.solid || !overlap(p, s)) continue;
    if (p.vx > 0) p.x = s.x - p.w; else if (p.vx < 0) p.x = s.x + s.w;
    p.vx = 0;
  }
  const prevBottom = p.y + p.h;
  p.y += p.vy;
  p.onGround = false;
  for (const s of map.plats) {
    if (!overlap(p, s)) continue;
    if (s.solid) {
      if (p.vy >= 0) { p.y = s.y - p.h; p.vy = 0; p.onGround = true; }
      else { p.y = s.y + s.h; p.vy = 0; }
    } else if (p.vy >= 0 && prevBottom <= s.y + 1) {
      p.y = s.y - p.h; p.vy = 0; p.onGround = true;
    }
  }
}

function updatePlayer(p) {
  if (p.dead) return;
  const ctl = CTL[p.id];
  const live = state === 'playing';
  const e = enemyOf(p);

  if (p.cd > 0) p.cd--;
  if (p.hazCd > 0) p.hazCd--;
  if (p.dashCd > 0) p.dashCd--;
  if (p.launchCd > 0) p.launchCd--;
  if (p.flash > 0) p.flash--;
  if (p.stun > 0) p.stun--;
  if (p.freeze > 0) p.freeze--;
  if (p.invert > 0) p.invert--;
  if (p.shield > 0) p.shield--;
  if (p.speedT > 0) p.speedT--;
  if (p.jumpT > 0) p.jumpT--;
  if (p.burn > 0) {
    p.burn--;
    p.hp -= 0.08;
    if (Math.random() < 0.3) burst(p.x + p.w / 2, p.y + 6, 1, '#ff8020');
    if (p.hp <= 0) { kill(p); return; }
  }

  const canAct = live && p.stun <= 0;
  let dir = 0;
  if (canAct && p.dash.t <= 0) {
    if (keys[ctl.l]) dir -= 1;
    if (keys[ctl.r]) dir += 1;
    if (p.invert > 0) dir = -dir;
  }
  if (dir) p.face = dir;
  if (canAct && keys[ctl.d] && p.dashCd <= 0 && p.dashT <= 0 && p.dash.t <= 0) {
    p.dashT = 8; p.dashCd = 900;
    burst(p.x + p.w / 2, p.y + p.h / 2, 8, '#fff');
  }

  const speed = 4.3 * (p.speedT > 0 ? 1.6 : 1) * (p.freeze > 0 ? 0.4 : 1);
  if (p.dash.t > 0) {
    p.dash.t--;
    p.vx = p.face * p.dash.sp;
    if (p.dash.dy && !p.dash.did) { p.vy = -p.dash.dy; p.dash.did = true; }
    if (!p.dash.hit && !e.dead && overlap(p, e)) {
      p.dash.hit = true;
      hurt(e, p.dash.dmg, p.face * p.dash.kb, -p.dash.kb * 0.4, {});
    }
  } else if (p.dashT > 0) {
    p.dashT--;
    p.vx = p.face * 15;
    if (p.vy > 1) p.vy = 1;
    if (Math.random() < 0.6) burst(p.x + p.w / 2 - p.face * 10, p.y + p.h / 2, 1, COLORS[p.id]);
  } else if (Math.abs(p.vx) > speed + 0.5) {
    p.vx *= p.onGround ? 0.9 : 0.985;
  } else {
    p.vx += (dir * speed - p.vx) * (p.onGround ? 0.3 : 0.16);
  }

  const jumpKey = canAct && keys[ctl.j];
  if (jumpKey && !p.jHeld) {
    const jb = p.jumpT > 0 ? 1.3 : 1;
    if (p.onGround) { p.vy = -13 * jb; p.jumps = 1; p.onGround = false; }
    else if (p.jumps <= 0) {
      if (p.launchCd <= 0) {
        p.vy = -20; p.launchCd = 600;
        burst(p.x + p.w / 2, p.y + p.h, 20, '#ffd54a');
        shake = 6;
      }
    }
    else if (p.jumps > 0) { p.vy = -11.5 * jb; p.jumps--; burst(p.x + p.w / 2, p.y + p.h, 5, '#fff'); }
  }
  p.jHeld = !!jumpKey;

  p.vy = Math.min(p.vy + GRAV * (p.jumpT > 0 ? 0.6 : 1), 17);
  movePlayer(p);
  if (p.onGround) p.jumps = 2;

  for (const h of map.haz) {
    if (p.hazCd <= 0 && overlap(p, h)) {
      hurt(p, h.dmg, 0, -14, {});
      p.vy = -15; p.hazCd = 40;
      if (p.dead) return;
    }
  }

  if (p.y > H + 90 || p.x < -90 || p.x > W + 90 || p.y < -320) { kill(p); return; }

  if (p.burst) {
    p.burst.t--;
    if (p.burst.t <= 0) {
      shoot(p, p.burst.w);
      p.burst.left--; p.burst.t = 5;
      if (p.burst.left <= 0) p.burst = null;
    }
  }

  if (canAct && keys[ctl.f] && p.cd <= 0) tryFire(p);
}

function updateMelees() {
  for (let i = melees.length - 1; i >= 0; i--) {
    const m = melees[i];
    m.life--;
    const e = enemyOf(m.owner);
    if (!m.hit && !e.dead && !m.owner.dead && overlap(meleeRect(m), e)) {
      m.hit = true;
      const w = m.w;
      hurt(e, w.dmg, m.owner.face * w.kb, -w.kb * 0.35, w);
    }
    if (m.life <= 0) melees.splice(i, 1);
  }
}

function updateProjs() {
  for (let i = projs.length - 1; i >= 0; i--) {
    const b = projs[i];
    b.life--;
    if (b.home) {
      const t = enemyOf(b.owner);
      if (!t.dead) {
        const dx = t.x + t.w / 2 - b.x, dy = t.y + t.h / 2 - b.y, d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(b.vx, b.vy) || 1;
        b.vx += (dx / d * sp - b.vx) * b.home; b.vy += (dy / d * sp - b.vy) * b.home;
        const ns = Math.hypot(b.vx, b.vy) || 1;
        b.vx *= sp / ns; b.vy *= sp / ns;
      }
    }
    if (b.boom && b.life < b.maxLife * 0.55) {
      const o = b.owner;
      const dx = o.x + o.w / 2 - b.x, dy = o.y + o.h / 2 - b.y, d = Math.hypot(dx, dy) || 1;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      b.vx += (dx / d * sp - b.vx) * 0.15; b.vy += (dy / d * sp - b.vy) * 0.15;
      if (d < 24) { projs.splice(i, 1); continue; }
    }
    b.vy += b.grav;
    const px = b.x, py = b.y;
    b.x += b.vx; b.y += b.vy;

    let dead = false;
    for (const s of map.plats) {
      const m = b.r * 0.4;
      const inside = b.x > s.x - m && b.x < s.x + s.w + m && b.y > s.y - m && b.y < s.y + s.h + m;
      if (!inside) continue;
      if (!s.solid && !(b.grav > 0 && b.vy > 0 && py <= s.y + 1)) continue;
      if (b.bounce > 0) {
        b.bounce--;
        const horiz = s.solid && (px <= s.x || px >= s.x + s.w) && py > s.y && py < s.y + s.h;
        if (horiz) { b.x = px; b.vx = -b.vx * 0.85; }
        else { b.y = py; b.vy = -b.vy * 0.85; if (Math.abs(b.vy) < 1.5) b.vy = -1.5; }
      } else {
        if (b.explode) explode(b.x, b.y, b.explode, b.expDmg, b.expKb, b.owner, b);
        if (b.frag) spawnFrags(b);
        dead = true;
      }
      break;
    }
    if (dead) { projs.splice(i, 1); continue; }

    const t = enemyOf(b.owner);
    if (!t.dead && !b.hit.has(t) && circleRect(b, t)) {
      hurt(t, b.dmg, Math.sign(b.vx || 1) * b.kb, -b.kb * 0.3, b);
      if (b.explode) explode(b.x, b.y, b.explode, b.expDmg, b.expKb, b.owner, b);
      if (b.frag) spawnFrags(b);
      if (!b.pierce) { projs.splice(i, 1); continue; }
      b.hit.add(t);
    }

    const off = b.x < -120 || b.x > W + 120 || b.y > H + 200 || b.y < -300;
    if (b.life <= 0 || off) {
      if (b.life <= 0 && !off) {
        if (b.explode) explode(b.x, b.y, b.explode, b.expDmg, b.expKb, b.owner, b);
        if (b.frag) spawnFrags(b);
      }
      projs.splice(i, 1);
    }
  }
}

function updateDeploy() {
  for (let i = deploy.length - 1; i >= 0; i--) {
    const d = deploy[i];
    d.life--;
    if (!d.landed) {
      const py = d.y;
      d.vy += GRAV; d.y += d.vy;
      for (const s of map.plats) {
        if (d.x >= s.x && d.x <= s.x + s.w && py <= s.y + 2 && d.y >= s.y) { d.y = s.y; d.vy = 0; d.landed = true; break; }
      }
    }
    if (d.life <= 0 || d.y > H + 200) { deploy.splice(i, 1); continue; }
    const e = enemyOf(d.owner);
    if (d.type === 'mine') {
      if (d.arm > 0) { d.arm--; continue; }
      if (!e.dead && Math.hypot(e.x + e.w / 2 - d.x, e.y + e.h / 2 - (d.y - 10)) < d.w.trig + e.w / 2) {
        explode(d.x, d.y - 10, d.w.radius, d.w.dmg, d.w.kb, d.owner, d.w);
        deploy.splice(i, 1);
      }
    } else if (d.type === 'turret' && d.landed) {
      d.cd--;
      if (d.cd <= 0 && !e.dead) {
        d.cd = d.w.cd;
        const dx = e.x + e.w / 2 - d.x, dy = e.y + e.h / 2 - (d.y - 20), n = Math.hypot(dx, dy) || 1;
        projs.push({
          x: d.x, y: d.y - 20, vx: dx / n * 9, vy: dy / n * 9, r: 4, dmg: d.w.dmg, kb: 2,
          owner: d.owner, grav: 0, life: 80, maxLife: 80, pierce: false, bounce: 0,
          explode: 0, expDmg: 0, expKb: 0, home: 0, boom: false, frag: 0, col: '#ffb020', hit: new Set(),
        });
      }
    }
  }
}

function spawnCrate() {
  const free = map.crates.filter(c => !crates.some(k => k.sx === c[0] && k.sy === c[1]));
  if (!free.length) return;
  const c = pick(free);
  crates.push({ sx: c[0], sy: c[1], x: c[0] - 12, y: c[1] - 24, w: 24, h: 24, t: Math.random() * 6 });
}

function updateCrates() {
  crateTimer--;
  if (crateTimer <= 0) {
    crateTimer = 330;
    if (crates.length < 3) spawnCrate();
  }
  for (let i = crates.length - 1; i >= 0; i--) {
    const c = crates[i];
    c.t += 0.08;
    for (const p of players) {
      if (!p.dead && overlap(p, c)) {
        giveWeapon(p, rollWeapon());
        burst(c.x + 12, c.y + 12, 16, '#ffd54a');
        crates.splice(i, 1);
        break;
      }
    }
  }
}

function updateFx() {
  for (let i = beams.length - 1; i >= 0; i--) if (--beams[i].life <= 0) beams.splice(i, 1);
  for (let i = explosions.length - 1; i >= 0; i--) if (--explosions[i].life <= 0) explosions.splice(i, 1);
  for (let i = banners.length - 1; i >= 0; i--) if (--banners[i].life <= 0) banners.splice(i, 1);
  for (let i = particles.length - 1; i >= 0; i--) {
    const q = particles[i];
    q.x += q.vx; q.y += q.vy; q.vy += 0.15;
    if (--q.life <= 0) particles.splice(i, 1);
  }
  if (shake > 0) shake--;
}

function update() {
  if (state === 'menu' || state === 'matchover') { updateFx(); return; }
  if (state === 'countdown') {
    timer--;
    for (const p of players) { p.vy = Math.min(p.vy + GRAV, 17); movePlayer(p); }
    if (timer <= 0) state = 'playing';
    updateFx();
    return;
  }
  if (state === 'playing') updateCrates();
  for (const p of players) updatePlayer(p);
  updateMelees();
  updateProjs();
  updateDeploy();
  updateFx();
  if (state === 'roundover') {
    timer--;
    if (timer <= 0) afterRound();
  }
}

// ============================================================
// Draw
// ============================================================
function drawSpikes(h) {
  ctx.fillStyle = '#c8ccd8';
  const n = Math.round(h.w / 20), sw = h.w / n;
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(h.x + i * sw, h.y + h.h);
    ctx.lineTo(h.x + i * sw + sw / 2, h.y);
    ctx.lineTo(h.x + (i + 1) * sw, h.y + h.h);
    ctx.fill();
  }
}

function drawMap() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, map.sky[0]); g.addColorStop(1, map.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  for (const s of map.plats) {
    if (s.solid) {
      ctx.fillStyle = '#3c4258'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#6a7394'; ctx.fillRect(s.x, s.y, s.w, 5);
    } else {
      ctx.fillStyle = '#3aa89a'; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.fillStyle = '#7ff0dc'; ctx.fillRect(s.x, s.y, s.w, 3);
    }
  }
  for (const h of map.haz) {
    if (h.kind === 'lava') {
      ctx.fillStyle = '#ff5a10'; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = '#ffb030'; ctx.fillRect(h.x, h.y, h.w, 4);
    } else drawSpikes(h);
  }
}

function drawPlayer(p) {
  if (p.dead) return;
  const col = p.flash > 0 ? '#fff' : COLORS[p.id];
  ctx.fillStyle = col;
  ctx.fillRect(p.x, p.y, p.w, p.h);
  if (p.freeze > 0) { ctx.fillStyle = 'rgba(140,240,255,0.55)'; ctx.fillRect(p.x - 2, p.y - 2, p.w + 4, p.h + 4); }
  ctx.fillStyle = '#111';
  ctx.fillRect(p.x + (p.face > 0 ? 17 : 4), p.y + 9, 7, 7);
  ctx.fillStyle = p.weapon.col || '#ddd';
  ctx.fillRect(p.face > 0 ? p.x + p.w - 2 : p.x - 14, p.y + 22, 16, 6);
  if (p.shield > 0) {
    ctx.strokeStyle = 'rgba(120,200,255,0.8)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x + p.w / 2, p.y + p.h / 2, 34, 0, Math.PI * 2); ctx.stroke();
  }
  if (p.burn > 0) { ctx.fillStyle = 'rgba(255,120,20,0.45)'; ctx.fillRect(p.x, p.y, p.w, p.h); }
  ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  if (p.stun > 0) ctx.fillText('* * *', p.x + p.w / 2, p.y - 6);
  if (p.invert > 0) ctx.fillText('?!', p.x + p.w / 2, p.y - 6);
  ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = COLORS[p.id];
  ctx.fillText('P' + (p.id + 1), p.x + p.w / 2, p.y - 18);
}

function drawWorld() {
  for (const c of crates) {
    const by = Math.sin(c.t) * 2;
    ctx.fillStyle = '#e0a020'; ctx.fillRect(c.x, c.y + by, c.w, c.h);
    ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2; ctx.strokeRect(c.x + 1, c.y + by + 1, c.w - 2, c.h - 2);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('?', c.x + 12, c.y + by + 18);
  }
  for (const d of deploy) {
    ctx.fillStyle = d.type === 'mine' ? (d.arm > 0 ? '#886' : d.w.col) : '#aa7a20';
    if (d.type === 'mine') ctx.fillRect(d.x - 9, d.y - 6, 18, 6);
    else { ctx.fillRect(d.x - 10, d.y - 14, 20, 14); ctx.fillRect(d.x - 2, d.y - 24, 4, 12); }
  }
  for (const m of melees) {
    const r = meleeRect(m);
    ctx.fillStyle = m.w.col; ctx.globalAlpha = 0.55; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalAlpha = 1;
  }
  for (const b of beams) {
    ctx.globalAlpha = b.life / b.max;
    ctx.strokeStyle = b.col; ctx.lineWidth = b.thick;
    ctx.beginPath(); ctx.moveTo(b.x0, b.y); ctx.lineTo(b.x1, b.y); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, b.thick / 3);
    ctx.beginPath(); ctx.moveTo(b.x0, b.y); ctx.lineTo(b.x1, b.y); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const b of projs) {
    ctx.fillStyle = b.col;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    if (b.rare) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke(); }
  }
  for (const x of explosions) {
    ctx.globalAlpha = x.life / x.max * 0.6;
    ctx.fillStyle = x.col;
    ctx.beginPath(); ctx.arc(x.x, x.y, x.r * (1 - x.life / x.max * 0.4), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  for (const q of particles) {
    ctx.globalAlpha = Math.min(1, q.life / 15);
    ctx.fillStyle = q.col; ctx.fillRect(q.x, q.y, q.r, q.r);
  }
  ctx.globalAlpha = 1;
  for (const p of players) drawPlayer(p);
}

function drawHUD() {
  ctx.textAlign = 'left';
  for (let i = 0; i < 2; i++) {
    const p = players[i];
    const x0 = i === 0 ? 20 : W - 320;
    ctx.fillStyle = '#000a'; ctx.fillRect(x0 - 2, 12, 304, 22);
    ctx.fillStyle = COLORS[i]; ctx.fillRect(x0, 14, 300 * Math.max(0, p.hp) / 100, 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = i === 0 ? 'left' : 'right';
    const tx = i === 0 ? x0 : x0 + 300;
    ctx.fillText('P' + (i + 1) + '  ' + Math.max(0, Math.ceil(p.hp)) + ' HP', tx, 28 - 16 + 40);
    ctx.fillStyle = p.weapon.rare ? '#ffd700' : '#dde';
    ctx.fillText(p.weapon.name + (p.ammo === Infinity ? '' : '  x' + Math.ceil(p.ammo)), tx, 66);
    ctx.fillStyle = p.dashCd > 0 ? '#666' : '#7fffb0';
    ctx.fillText(p.dashCd > 0 ? 'dash ' + Math.ceil(p.dashCd / 60) + 's' : 'DASH ready', tx, 100);
    ctx.fillStyle = p.launchCd > 0 ? '#666' : '#ffd54a';
    ctx.fillText(p.launchCd > 0 ? 'launch ' + Math.ceil(p.launchCd / 60) + 's' : 'LAUNCH ready (3rd jump)', tx, 116);
    for (let k = 0; k < WINS_NEEDED; k++) {
      ctx.fillStyle = k < scores[i] ? '#ffd700' : '#444';
      const cx = i === 0 ? x0 + 6 + k * 18 : x0 + 294 - k * 18;
      ctx.beginPath(); ctx.arc(cx, 80, 6, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffffaa'; ctx.font = '12px sans-serif';
  ctx.fillText('#' + (mapIdx + 1) + ' ' + map.name, W / 2, 26);
  ctx.fillText('First to ' + WINS_NEEDED, W / 2, 42);
  let by = 110;
  for (const b of banners) {
    ctx.globalAlpha = Math.min(1, b.life / 30);
    ctx.font = b.big ? 'bold 26px sans-serif' : 'bold 15px sans-serif';
    ctx.fillStyle = b.col;
    ctx.fillText(b.text, W / 2, by);
    by += b.big ? 32 : 20;
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  if (state === 'countdown') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 72px sans-serif';
    const n = Math.ceil(timer / 50);
    ctx.fillText(n > 0 ? String(n) : 'FIGHT!', W / 2, 260);
  } else if (state === 'roundover') {
    ctx.fillStyle = lastWinner < 0 ? '#fff' : COLORS[lastWinner]; ctx.font = 'bold 48px sans-serif';
    ctx.fillText(lastWinner < 0 ? 'DRAW!' : 'PLAYER ' + (lastWinner + 1) + ' SCORES!', W / 2, 260);
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (state === 'menu') {
    ctx.fillStyle = '#12121c'; ctx.fillRect(0, 0, W, H);
    return;
  }
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  drawMap();
  drawWorld();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHUD();
}

// ============================================================
// Input + menu
// ============================================================
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Slash') e.preventDefault();
  if (e.code === 'Escape' && state !== 'menu') showMenu();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

function drawPreview(m) {
  const pc = document.getElementById('preview'), c = pc.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, pc.width, pc.height);
  if (!m) {
    c.fillStyle = '#222'; c.fillRect(0, 0, pc.width, pc.height);
    c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center';
    c.fillText('RANDOM MAP', pc.width / 2, pc.height / 2);
    return;
  }
  c.scale(pc.width / W, pc.width / W);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, m.sky[0]); g.addColorStop(1, m.sky[1]);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (const s of m.plats) { c.fillStyle = s.solid ? '#6a7394' : '#7ff0dc'; c.fillRect(s.x, s.y, s.w, s.h); }
  for (const h of m.haz) { c.fillStyle = h.kind === 'lava' ? '#ff5a10' : '#c8ccd8'; c.fillRect(h.x, h.y, h.w, h.h); }
  c.fillStyle = COLORS[0]; c.fillRect(m.spawns[0][0], m.spawns[0][1], PW, PH);
  c.fillStyle = COLORS[1]; c.fillRect(m.spawns[1][0], m.spawns[1][1], PW, PH);
}

function buildMenu() {
  document.getElementById('sub').textContent =
    TOTAL_WEAPONS + ' weapons  -  ' + TOTAL_MAPS + ' maps  -  1 in ' + RARE_ODDS + ' chance of the RARE Mega Scattergun';
  const num = document.getElementById('mapNum');
  num.max = TOTAL_MAPS;
  document.getElementById('mapOf').textContent = '/ ' + TOTAL_MAPS;
  if (selMap < 0) {
    num.value = '';
    document.getElementById('mapName').textContent = 'Random map every match';
    drawPreview(null);
  } else {
    num.value = selMap + 1;
    const m = getMap(selMap);
    document.getElementById('mapName').textContent = m.name;
    drawPreview(m);
  }
}

function setMap(i) { selMap = i; buildMenu(); }
document.getElementById('mapPrev').addEventListener('click', () => setMap(selMap <= 0 ? TOTAL_MAPS - 1 : selMap - 1));
document.getElementById('mapNext').addEventListener('click', () => setMap(selMap < 0 ? 0 : (selMap + 1) % TOTAL_MAPS));
document.getElementById('mapRandom').addEventListener('click', () => setMap(-1));
document.getElementById('mapNum').addEventListener('change', e => {
  const v = parseInt(e.target.value, 10);
  if (!isNaN(v)) setMap(clamp(v, 1, TOTAL_MAPS) - 1); else buildMenu();
});

document.getElementById('startBtn').addEventListener('click', startMatch);
document.getElementById('rematchBtn').addEventListener('click', startMatch);
document.getElementById('menuBtn').addEventListener('click', showMenu);

buildMenu();
let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
