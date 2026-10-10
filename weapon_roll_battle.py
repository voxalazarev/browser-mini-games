"""Weapon Roll Battle: local two-player platform combat with 50 weapons and 50 maps."""

import math
import random
import sys
from dataclasses import dataclass

import pygame

WIDTH, HEIGHT, FPS = 1280, 720, 60
# A higher jump makes the upper routes and obstacle arenas easier to reach.
GRAVITY, SPEED, JUMP = 1600, 340, 780
P1, P2 = (54, 213, 255), (255, 82, 170)
WHITE, INK, GOLD, RED, GREEN, MUTED = (242, 247, 255), (8, 12, 28), (255, 213, 73), (255, 85, 103), (102, 240, 160), (135, 155, 188)


def fnt(size, bold=False): return pygame.font.SysFont("arial", size, bold=bold)


def label(screen, value, font, color, pos, anchor="center"):
    image = font.render(value, True, color)
    screen.blit(image, image.get_rect(**{anchor: pos}))


def rounded(screen, rect, color, radius=12, border=None):
    pygame.draw.rect(screen, color, rect, border_radius=radius)
    if border: pygame.draw.rect(screen, border, rect, 2, border_radius=radius)


@dataclass(frozen=True)
class Weapon:
    name: str
    damage: int
    cooldown: float
    pellets: int = 1
    spread: float = 0.0
    speed: float = 750
    kind: str = "bullet"  # bullet, beam, rocket
    color: tuple = GOLD


# Every entry has distinct combat behaviour or a distinct damage/cooldown/pellet mix.
WEAPONS = [
    Weapon("Prism Needler", 7, .12, speed=900, color=(112, 240, 255)), Weapon("Ember Flicker", 10, .18, speed=850, color=(255, 139, 68)),
    Weapon("Twin Spark", 6, .22, 2, .08), Weapon("Scatterpop", 5, .38, 6, .23),
    Weapon("Boomstick", 13, .62, 5, .17), Weapon("Laser Beam", 18, .72, kind="beam", color=(255, 72, 190)),
    Weapon("Rail Needle", 38, 1.15, speed=1450), Weapon("One Shot Sniper", 100, 2.9, speed=1650, color=(255, 230, 125)),
    Weapon("Arc Blaster", 16, .45, 3, .09), Weapon("Meteor Pebbler", 4, .08, speed=690, color=(193, 163, 255)),
    Weapon("Fire Spitter", 8, .14, speed=650, kind="fire", color=(255, 105, 60)), Weapon("Tri-Burst Relic", 11, .30, 3, .035, color=(255, 202, 84)),
    Weapon("Frost Ray", 14, .55, kind="beam", color=(139, 210, 255)), Weapon("RPG-7", 34, 1.18, speed=470, kind="rocket"),
    Weapon("Thunder Tube", 30, .95, 2, .13), Weapon("Pinpoint", 23, .64, speed=1250),
    Weapon("Firecracker", 9, .26, 4, .12), Weapon("Sawtooth", 17, .42, 2, .05),
    Weapon("Nova Cannon", 48, 1.48, speed=520, kind="rocket", color=(255, 156, 70)), Weapon("Bubble Popper", 12, .33, speed=560),
    Weapon("Pulse Prism", 15, .35, speed=980, color=(95, 231, 255)), Weapon("Volt Shotgun", 8, .54, 8, .25, color=(195, 130, 255)),
    Weapon("Solar Lance", 29, .88, kind="beam", color=(255, 225, 100)), Weapon("Dart Storm", 5, .11, 2, .05),
    Weapon("Meteor Rifle", 41, 1.25, speed=1050), Weapon("Spray Can", 4, .18, 5, .20),
    Weapon("Crystal Carbine", 19, .48, speed=1120, color=(112, 255, 240)), Weapon("Heavy Slug", 57, 1.72, speed=880),
    Weapon("Star Slinger", 13, .29, 2, .07), Weapon("Ricochet Ray", 21, .68, kind="beam", color=(137, 255, 205)),
    Weapon("Rocket Nest", 24, .72, 3, .10, speed=430, kind="rocket"), Weapon("Whisper", 3, .06, speed=980),
    Weapon("Dragon Breath", 6, .31, 10, .30, speed=570, color=(255, 104, 66)), Weapon("Ion Spear", 35, 1.05, speed=1500),
    Weapon("Quasar", 27, .78, 2, .08, kind="beam", color=(181, 117, 255)), Weapon("Bolt Action", 64, 2.05, speed=1350),
    Weapon("Prism Shot", 10, .39, 5, .15, color=(117, 255, 222)), Weapon("Sandstorm", 6, .23, 6, .20),
    Weapon("Sonic Boom", 22, .70, 3, .12), Weapon("Gas Grenade", 5, 1.15, speed=390, kind="gas", color=(112, 235, 114)),
    Weapon("Moon Shardcaster", 25, .73, speed=1100, color=(186, 207, 255)), Weapon("Orbit Gun", 14, .40, 4, .16),
    Weapon("Flash Cannon", 33, 1.00, kind="beam", color=(255, 255, 210)), Weapon("Tornado", 7, .29, 7, .25),
    Weapon("Void Sniper", 80, 2.55, speed=1550, color=(128, 80, 255)), Weapon("Dough Cannon", 16, .72, speed=480, kind="dough", color=(244, 205, 143)),
    Weapon("Trident Thrower", 28, .84, speed=1200, kind="trident"), Weapon("Serpent Scepter", 9, 1.8, speed=250, kind="snake", color=(100, 230, 99)),
    Weapon("Titan Rocket", 70, 2.25, speed=350, kind="rocket", color=(255, 193, 73)), Weapon("COLOSSUS SHOTGUN", 26, 0, 7, .24, speed=740, kind="mega", color=(255, 239, 80)),
    Weapon("Aurora Chakram", 18, .34, 2, .12, speed=900, color=(121, 255, 220)),
    Weapon("Comet Whip", 26, .66, speed=1160, color=(255, 151, 84)),
    Weapon("Echo Needle", 8, .10, 3, .04, speed=1040, color=(161, 210, 255)),
    Weapon("Sunflare Orb", 32, 1.02, speed=520, color=(255, 190, 78)),
    Weapon("Moonlit Fan", 7, .27, 7, .22, speed=760, color=(174, 180, 255)),
    Weapon("Gravity Marble", 23, .70, speed=430, color=(191, 136, 255)),
    Weapon("Copper Coil", 13, .24, 2, .03, speed=890, color=(229, 149, 83)),
    Weapon("Jade Needle", 21, .52, speed=1280, color=(91, 240, 164)),
    Weapon("Violet Shard", 36, 1.10, speed=1060, color=(191, 113, 255)),
    Weapon("Thunder Marbles", 9, .43, 5, .18, speed=720, color=(128, 190, 255)),
    Weapon("Comet Fan", 11, .31, 4, .25, speed=780, color=(255, 130, 186)),
    Weapon("Bramble Launcher", 15, .37, 3, .10, speed=650, color=(111, 218, 98)),
    Weapon("Chrome Dart", 29, .82, speed=1420, color=(205, 230, 244)),
    Weapon("Blue Nova", 44, 1.36, speed=560, color=(91, 158, 255)),
    Weapon("Red Nova", 39, 1.22, speed=600, color=(255, 91, 108)),
    Weapon("Prismatic Drill", 24, .58, speed=1000, color=(255, 133, 220)),
    Weapon("Cloudburst", 6, .20, 9, .28, speed=620, color=(161, 219, 255)),
    Weapon("Iron Comet", 52, 1.62, speed=900, color=(178, 190, 205)),
    Weapon("Glass Cannon", 72, 2.30, speed=1500, color=(224, 250, 255)),
    Weapon("Lantern Bolt", 17, .41, 2, .06, speed=1020, color=(255, 223, 118)),
    Weapon("Magma Needle", 12, .16, speed=700, kind="fire", color=(255, 91, 36)),
    Weapon("Ashen Fan", 5, .29, 8, .32, speed=580, kind="fire", color=(218, 104, 74)),
    Weapon("Frostbite Burst", 20, .48, 3, .08, speed=900, color=(133, 224, 255)),
    Weapon("Icicle Lance", 34, .91, speed=1320, color=(172, 246, 255)),
    Weapon("Static Bloom", 14, .36, 4, .13, speed=830, color=(231, 245, 109)),
    Weapon("Storm Needle", 27, .73, speed=1250, color=(112, 151, 255)),
    Weapon("Blackstar", 61, 1.86, speed=1180, color=(104, 77, 167)),
    Weapon("White Dwarf", 46, 1.42, speed=760, color=(255, 255, 236)),
    Weapon("Ruby Scatter", 10, .46, 6, .20, speed=740, color=(255, 87, 104)),
    Weapon("Sapphire Scatter", 10, .46, 6, .20, speed=740, color=(93, 151, 255)),
    Weapon("Emerald Spray", 5, .13, 6, .16, speed=780, color=(83, 236, 126)),
    Weapon("Topaz Hammer", 42, 1.18, speed=540, color=(255, 205, 75)),
    Weapon("Meteor Fan", 16, .61, 5, .25, speed=610, color=(255, 126, 72)),
    Weapon("Orbiting Suns", 19, .54, 3, .14, speed=670, color=(255, 230, 97)),
    Weapon("Void Bloom", 31, .98, 4, .11, speed=530, kind="gas", color=(132, 87, 209)),
    Weapon("Toxic Thorn", 8, .38, 4, .18, speed=620, kind="snake", color=(123, 229, 86)),
    Weapon("Rocket Swarm", 18, .42, 5, .17, speed=410, kind="rocket", color=(255, 136, 58)),
    Weapon("Mini Meteor", 55, 1.72, speed=450, kind="rocket", color=(255, 174, 65)),
    Weapon("Dough Flail", 12, .51, 3, .12, speed=500, kind="dough", color=(244, 198, 140)),
    Weapon("Sugar Slug", 28, 1.02, speed=680, kind="dough", color=(255, 180, 219)),
    Weapon("Coral Trident", 19, .56, 3, .08, speed=1080, kind="trident", color=(255, 126, 164)),
    Weapon("Harpoon Star", 37, 1.08, speed=1420, kind="trident", color=(121, 224, 213)),
    Weapon("Serpent Coil", 13, 1.35, speed=230, kind="snake", color=(74, 213, 113)),
    Weapon("Royal Viper", 17, 1.65, speed=260, kind="snake", color=(198, 230, 74)),
    Weapon("Signal Flare", 21, .64, 3, .12, speed=680, kind="fire", color=(255, 112, 52)),
    Weapon("Smog Sprayer", 7, .74, 4, .18, speed=420, kind="gas", color=(113, 224, 151)),
    Weapon("Galaxy Gate", 30, 1.10, kind="beam", color=(190, 126, 255)),
    Weapon("Prism Sweep", 12, .42, kind="beam", color=(110, 255, 235)),
    Weapon("Solar Guillotine", 50, 1.58, kind="beam", color=(255, 242, 134)),
    Weapon("Meteor Shower", 22, .84, 4, .30, speed=480, kind="rocket", color=(255, 115, 74)),
]
# Ordinary bullet entries are upgraded into oversized plasma weapons. This
# keeps the weapon names and varied stats while removing basic bullet shots.
WEAPONS = [
    Weapon(w.name, max(28, w.damage * 2), w.cooldown, w.pellets, w.spread,
           max(900, w.speed), "plasma" if w.kind == "bullet" else w.kind, w.color)
    for w in WEAPONS
]
assert len(WEAPONS) == 100


@dataclass
class Block:
    x: float
    y: float
    w: float
    h: float
    @property
    def rect(self): return pygame.Rect(round(self.x), round(self.y), round(self.w), round(self.h))


class Fighter:
    def __init__(self, number, color, x, y):
        self.number, self.color, self.x, self.y = number, color, float(x), float(y)
        self.vx = self.vy = 0.0
        self.hp, self.cooldown, self.facing, self.on_ground = 100, 0., 1 if number == 1 else -1, False
        self.jump_buffer, self.coyote, self.frame, self.flash = 0., 0., 0., 0.
        self.poison_time, self.poison_tick, self.burn_time, self.burn_tick, self.slow_time = 0., 0., 0., 0., 0.
        self.weapon = None
    @property
    def rect(self): return pygame.Rect(round(self.x), round(self.y), 34, 48)
    def update(self, keys, dt, blocks, controls):
        direction = int(keys[controls["right"]]) - int(keys[controls["left"]])
        speed = SPEED * (.53 if self.slow_time > 0 else 1)
        self.vx += (direction * speed - self.vx) * min(1, dt * 15)
        if direction: self.facing, self.frame = direction, self.frame + dt * 13
        if keys[controls["jump"]]: self.jump_buffer = .11
        self.jump_buffer -= dt; self.coyote -= dt
        if self.jump_buffer > 0 and self.coyote > 0:
            self.vy, self.jump_buffer, self.coyote = -JUMP, 0, 0
        self.vy = min(880, self.vy + GRAVITY * dt)
        self.x += self.vx * dt
        for block in blocks:
            if self.rect.colliderect(block.rect):
                self.x = block.x - 34 if self.vx > 0 else block.x + block.w
                self.vx = 0
        was = self.on_ground; self.on_ground = False; self.y += self.vy * dt
        for block in blocks:
            if self.rect.colliderect(block.rect):
                if self.vy > 0: self.y, self.on_ground = block.y - 48, True
                else: self.y = block.y + block.h
                self.vy = 0
        self.coyote = .12 if self.on_ground else max(0, self.coyote - dt)
        if was and not self.on_ground: self.coyote = max(self.coyote, .09)
        self.cooldown, self.flash = max(0, self.cooldown - dt), max(0, self.flash - dt)
        self.slow_time = max(0, self.slow_time - dt)
    def draw(self, screen):
        x, y = round(self.x), round(self.y)
        bob, step = int(math.sin(self.frame) * 2), int(math.sin(self.frame) * 5)
        pygame.draw.ellipse(screen, (0, 0, 0), (x - 4, y + 44, 42, 9))
        pygame.draw.line(screen, (27, 34, 58), (x + 11, y + 39), (x + 8 + step, y + 51), 7)
        pygame.draw.line(screen, (27, 34, 58), (x + 24, y + 39), (x + 27 - step, y + 51), 7)
        rounded(screen, pygame.Rect(x + 3, y + 17 + bob, 28, 25), self.color if not self.flash else WHITE, 8)
        pygame.draw.circle(screen, (255, 216, 184), (x + 17, y + 12 + bob), 13)
        pygame.draw.arc(screen, self.color, (x + 4, y - 2 + bob, 26, 28), math.pi, math.tau, 5)
        pygame.draw.circle(screen, INK, (x + 13, y + 11 + bob), 2); pygame.draw.circle(screen, INK, (x + 21, y + 11 + bob), 2)
        end = (x + 17 + self.facing * 27, y + 28 + bob)
        pygame.draw.line(screen, self.weapon.color, (x + 17, y + 29 + bob), end, 6)
        label(screen, str(self.number), fnt(14, True), INK, (x + 17, y + 30 + bob))


class Shot:
    def __init__(self, owner, weapon, angle=0):
        self.owner, self.weapon = owner, weapon
        self.x, self.y = owner.x + 17 + owner.facing * 21, owner.y + 27
        self.vx, self.vy, self.life = weapon.speed * owner.facing * math.cos(angle), weapon.speed * math.sin(angle), 1.55
        self.radius = 16 if weapon.kind == "mega" else (12 if weapon.kind in ("rocket", "dough", "gas") else (10 if weapon.kind == "plasma" else 4))
    @property
    def rect(self): return pygame.Rect(round(self.x-self.radius), round(self.y-self.radius), self.radius*2, self.radius*2)
    def update(self, dt): self.x += self.vx*dt; self.y += self.vy*dt; self.life -= dt
    def draw(self, screen):
        x, y = round(self.x), round(self.y)
        if self.weapon.kind == "trident":
            pygame.draw.line(screen, self.weapon.color, (x - 13, y), (x + 13, y), 4)
            for offset in (-6, 0, 6): pygame.draw.line(screen, self.weapon.color, (x + 9, y + offset), (x + 15, y + offset), 3)
        elif self.weapon.kind == "fire":
            pygame.draw.circle(screen, (255, 74, 46), (x, y), 8); pygame.draw.circle(screen, GOLD, (x, y + 2), 4)
        elif self.weapon.kind == "dough":
            pygame.draw.circle(screen, self.weapon.color, (x, y), self.radius); pygame.draw.circle(screen, (255, 237, 194), (x-3, y-3), 3)
        elif self.weapon.kind == "plasma":
            pygame.draw.circle(screen, (255, 255, 255), (x, y), self.radius + 5)
            pygame.draw.circle(screen, self.weapon.color, (x, y), self.radius + 2)
            pygame.draw.circle(screen, WHITE, (x, y), max(2, self.radius // 2))
        else:
            pygame.draw.circle(screen, self.weapon.color, (x, y), self.radius)
            pygame.draw.circle(screen, WHITE, (x, y), max(1, self.radius//2))


class Snake:
    """A killable summoned snake. Dead snakes respawn beside their owner after 5 seconds."""
    def __init__(self, owner):
        self.owner, self.x, self.y = owner, owner.x + owner.facing * 25, owner.y + 30
        self.hp, self.alive, self.respawn, self.attack = 25, True, 0., 0.
    @property
    def rect(self): return pygame.Rect(round(self.x - 13), round(self.y - 10), 27, 20)
    def hurt(self, damage):
        self.hp -= damage
        if self.hp <= 0: self.alive, self.respawn = False, 5.0
    def update(self, dt, target):
        if not self.alive:
            self.respawn -= dt
            if self.respawn <= 0:
                self.alive, self.hp = True, 25
                self.x, self.y = self.owner.x + self.owner.facing * 26, self.owner.y + 30
            return False
        dx, dy = target.x - self.x, (target.y + 24) - self.y
        distance = max(1, math.hypot(dx, dy)); self.x += dx / distance * 155 * dt; self.y += dy / distance * 155 * dt
        self.attack = max(0, self.attack - dt)
        if self.rect.colliderect(target.rect) and self.attack <= 0:
            self.attack = .85; return True
        return False
    def draw(self, screen):
        if not self.alive: return
        pygame.draw.ellipse(screen, (59, 181, 78), self.rect)
        pygame.draw.circle(screen, (230, 255, 190), (round(self.x + 7), round(self.y - 3)), 3)
        pygame.draw.circle(screen, RED, (round(self.x + 9), round(self.y - 3)), 1)


class GasCloud:
    def __init__(self, x, y, owner): self.x, self.y, self.owner, self.life, self.tick = x, y, owner, 3.8, 0.
    def update(self, dt, target):
        self.life -= dt; self.tick -= dt
        if self.life > 0 and self.tick <= 0 and math.hypot(target.x + 17 - self.x, target.y + 24 - self.y) < 65:
            self.tick = .7; return True
        return False
    def draw(self, screen):
        cloud = pygame.Surface((140, 140), pygame.SRCALPHA)
        pygame.draw.circle(cloud, (93, 237, 110, 45), (70, 70), 62)
        pygame.draw.circle(cloud, (151, 255, 127, 55), (47, 76), 28)
        pygame.draw.circle(cloud, (151, 255, 127, 55), (94, 55), 31)
        screen.blit(cloud, (self.x - 70, self.y - 70))


def make_map(index):
    """Build one of several visibly different, deterministic platform arenas.

    Every family leaves a safe low route between the two spawn pads, while the
    extra geometry changes the sight lines and jumping decisions each round.
    """
    rng = random.Random(index * 3947)
    family = (index - 1) % 6
    names = ["Sky Island Zigzag", "Neon Rooftop Run", "Clockwork Tower", "Canyon Bridges", "Crystal Pinball", "Lava Stepfield"]
    name = f"{names[family]} {index:02}"
    blocks = [Block(0, 650, 250, 80), Block(1030, 650, 250, 80)]

    if family == 0:  # wide floating islands, alternating high and low
        for i in range(7):
            x = 255 + i * 112
            y = 485 if i % 2 else 575
            blocks.append(Block(x, y, 92, rng.choice([16, 24, 34])))
        blocks += [Block(405, 385, 110, 18), Block(765, 385, 110, 18)]
    elif family == 1:  # connected rooftops with tall cover chimneys
        for i in range(5):
            x, y = 265 + i * 150, 560 - (i % 2) * 52
            blocks.append(Block(x, y, 126, 90))
            if i in (1, 3): blocks.append(Block(x + 45, y - 92, 35, 92))
        blocks += [Block(430, 425, 92, 16), Block(775, 470, 92, 16)]
    elif family == 2:  # central tower: stacked ledges and side balconies
        blocks += [Block(600, 535, 80, 115), Block(500, 455, 100, 18), Block(680, 385, 100, 18), Block(485, 315, 90, 18), Block(705, 245, 90, 18)]
        blocks += [Block(320, 545, 130, 18), Block(830, 545, 130, 18), Block(275, 430, 35, 120), Block(970, 430, 35, 120)]
    elif family == 3:  # canyon: long ledges separated by openings and overhangs
        blocks += [Block(255, 565, 170, 85), Block(480, 510, 150, 140), Block(685, 565, 150, 85), Block(895, 510, 145, 140)]
        blocks += [Block(350, 390, 145, 18), Block(790, 350, 150, 18), Block(585, 275, 110, 18)]
    elif family == 4:  # pinball: staggered bumpers and a high center lane
        blocks += [Block(275, 585, 110, 65), Block(460, 510, 115, 140), Block(665, 585, 110, 65), Block(850, 510, 115, 140)]
        blocks += [Block(380, 410, 90, 18), Block(600, 340, 80, 18), Block(820, 410, 90, 18)]
        blocks += [Block(540, 560, 35, 90), Block(705, 445, 35, 105)]
    else:  # lava-style stepping stones with tall safe end pillars
        for i in range(8):
            x = 265 + i * 105
            y = 585 - (i % 3) * 62
            blocks.append(Block(x, y, 78, 65 if i % 2 else 24))
        blocks += [Block(430, 350, 100, 18), Block(750, 350, 100, 18), Block(600, 440, 80, 18)]

    # Guaranteed ground route: every arena can always be crossed, even if the
    # decorative upper route is awkward. The 5px seams are easy to jump and
    # preserve the void risk without making a map unwinnable.
    for i in range(8):
        blocks.append(Block(245 + i * 99, 610, 94, 40))

    # Small seeded cover pieces make each numbered map unique within its family.
    for i in range(2 + index % 3):
        x = rng.randint(300, 930)
        y = rng.choice([430, 470, 520, 570])
        blocks.append(Block(x, y, rng.choice([22, 30, 42]), rng.choice([44, 58, 76])))
    return name, blocks


class Game:
    def __init__(self):
        pygame.init(); self.screen = pygame.display.set_mode((WIDTH, HEIGHT)); pygame.display.set_caption("Weapon Roll Battle")
        self.clock = pygame.time.Clock(); self.title, self.big, self.medium, self.small = fnt(43, True), fnt(29, True), fnt(20, True), fnt(15, True)
        self.rng, self.round_no, self.state = random.Random(), 0, "intro"; self.new_round()
    def new_round(self):
        self.round_no += 1; self.map_index = self.rng.randint(1, 50); self.map_name, self.blocks = make_map(self.map_index)
        self.players = [Fighter(1, P1, 90, 580), Fighter(2, P2, 1155, 580)]
        for p in self.players: p.weapon = self.rng.choice(WEAPONS)
        self.shots, self.beams, self.snakes, self.gas_clouds = [], [], [], []
        self.state, self.roll_time, self.winner = "roll", 3.2, None
    def shoot(self, player):
        weapon = player.weapon
        if player.cooldown > 0 or self.state != "playing": return
        player.cooldown = weapon.cooldown
        if weapon.kind == "beam":
            self.beams.append([player, .10])
            self.apply_beam(player)
        elif weapon.kind == "snake":
            # One persistent, killable snake per owner; it returns 5 seconds after defeat.
            if not any(s.owner is player for s in self.snakes): self.snakes.append(Snake(player))
        else:
            for _ in range(weapon.pellets): self.shots.append(Shot(player, weapon, self.rng.uniform(-weapon.spread, weapon.spread)))
    def hurt(self, target, damage):
        target.hp = max(0, target.hp - damage); target.flash = .12
        if target.hp <= 0: self.winner, self.state = 3 - target.number, "result"
    def apply_beam(self, owner):
        target = self.players[1 if owner.number == 1 else 0]
        y_ok = abs((target.y + 24) - (owner.y + 25)) < 46
        ahead = (target.x - owner.x) * owner.facing > 0
        if y_ok and ahead and abs(target.x - owner.x) < 560: self.hurt(target, owner.weapon.damage)
    def update(self, dt):
        if self.state == "roll":
            self.roll_time -= dt
            if self.roll_time <= 0: self.state = "playing"
            return
        if self.state != "playing": return
        keys = pygame.key.get_pressed()
        controls = [{"left":pygame.K_a,"right":pygame.K_d,"jump":pygame.K_w}, {"left":pygame.K_LEFT,"right":pygame.K_RIGHT,"jump":pygame.K_UP}]
        for player, control in zip(self.players, controls): player.update(keys, dt, self.blocks, control)
        # Poison and fire keep damaging briefly after a snake or flame hit.
        for player in self.players:
            player.poison_time, player.burn_time = max(0, player.poison_time-dt), max(0, player.burn_time-dt)
            player.poison_tick, player.burn_tick = max(0, player.poison_tick-dt), max(0, player.burn_tick-dt)
            if player.poison_time > 0 and player.poison_tick <= 0:
                player.poison_tick = .75; self.hurt(player, 3)
            if player.burn_time > 0 and player.burn_tick <= 0:
                player.burn_tick = .5; self.hurt(player, 2)
        for player in self.players:
            if player.y > HEIGHT + 70: self.hurt(player, 18); player.x, player.y, player.vx, player.vy = (90,580,0,0) if player.number == 1 else (1155,580,0,0)
        for shot in self.shots[:]:
            shot.update(dt)
            if any(shot.rect.colliderect(b.rect) for b in self.blocks):
                if shot.weapon.kind == "gas": self.gas_clouds.append(GasCloud(shot.x, shot.y, shot.owner))
                self.shots.remove(shot); continue
            # Bullets can kill an enemy snake before it reaches a player.
            bitten = False
            for snake in self.snakes:
                if snake.alive and snake.owner is not shot.owner and shot.rect.colliderect(snake.rect):
                    snake.hurt(shot.weapon.damage); self.shots.remove(shot); bitten = True; break
            if bitten: continue
            target = self.players[1 if shot.owner.number == 1 else 0]
            if shot.rect.colliderect(target.rect):
                if shot.weapon.kind == "gas":
                    self.gas_clouds.append(GasCloud(shot.x, shot.y, shot.owner)); self.shots.remove(shot); continue
                damage = shot.weapon.damage
                if shot.weapon.kind == "rocket":
                    damage = int(damage * 1.25)
                self.hurt(target, damage)
                if shot.weapon.kind == "fire": target.burn_time, target.burn_tick = 3.0, .5
                if shot.weapon.kind == "dough": target.slow_time = 2.5
                self.shots.remove(shot); continue
            if shot.life <= 0 or shot.x < -30 or shot.x > WIDTH+30: self.shots.remove(shot)
        for snake in self.snakes:
            target = self.players[1 if snake.owner.number == 1 else 0]
            if snake.update(dt, target):
                self.hurt(target, snake.owner.weapon.damage)
                target.poison_time, target.poison_tick = 4.0, .7
        for cloud in self.gas_clouds[:]:
            target = self.players[1 if cloud.owner.number == 1 else 0]
            if cloud.update(dt, target): self.hurt(target, cloud.owner.weapon.damage)
            if cloud.life <= 0: self.gas_clouds.remove(cloud)
        for beam in self.beams[:]:
            beam[1] -= dt
            if beam[1] <= 0: self.beams.remove(beam)
    def handle(self, event):
        if event.type == pygame.QUIT: return False
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_r: self.new_round()
            elif self.state == "playing":
                if event.key == pygame.K_SPACE: self.shoot(self.players[0])
                elif event.key == pygame.K_SLASH: self.shoot(self.players[1])
            elif self.state == "result" and event.key in (pygame.K_RETURN, pygame.K_SPACE): self.new_round()
        return True
    def draw_background(self):
        self.screen.fill((16, 23, 54))
        for y in range(110, HEIGHT, 55): pygame.draw.line(self.screen, (24, 37, 80), (0,y), (WIDTH,y), 1)
        for x in range(0, WIDTH, 90): pygame.draw.line(self.screen, (24, 37, 80), (x,110), (x,HEIGHT), 1)
        pygame.draw.circle(self.screen, (255, 202, 111), (1070, 125), 50)
    def draw_world(self):
        self.draw_background()
        for block in self.blocks:
            r = block.rect; rounded(self.screen, r, (58, 74, 115), 7, (127, 195, 199))
            pygame.draw.rect(self.screen, (96, 187, 143), (r.x, r.y, r.w, min(8,r.h)), border_radius=4)
        for owner, life in self.beams:
            x1,y = owner.x+17,owner.y+26; x2 = x1+owner.facing*570
            pygame.draw.line(self.screen, owner.weapon.color, (x1,y), (x2,y), 8)
            pygame.draw.line(self.screen, WHITE, (x1,y), (x2,y), 2)
        for shot in self.shots: shot.draw(self.screen)
        for cloud in self.gas_clouds: cloud.draw(self.screen)
        for snake in self.snakes: snake.draw(self.screen)
        for p in self.players: p.draw(self.screen)
    def hp_panel(self, player, x, align):
        rect = pygame.Rect(x, HEIGHT-81, 410, 62)
        rounded(self.screen, rect, (12,18,42), 13, player.color)
        label(self.screen, f"PLAYER {player.number}  {player.hp} HP", self.medium, player.color, (rect.x+16 if align=="left" else rect.right-16, rect.y+17), "midleft" if align=="left" else "midright")
        bar = pygame.Rect(rect.x+16, rect.y+36, rect.w-32, 14); pygame.draw.rect(self.screen, (53,57,79), bar, border_radius=7)
        pygame.draw.rect(self.screen, player.color, (bar.x,bar.y,bar.w*player.hp/100,bar.h), border_radius=7)
        label(self.screen, player.weapon.name, self.small, GOLD, (rect.x+16 if align=="left" else rect.right-16, rect.y+57), "bottomleft" if align=="left" else "bottomright")
    def draw(self):
        self.draw_world(); label(self.screen, f"ROUND {self.round_no}  •  MAP {self.map_index:02}/50: {self.map_name}", self.big, GOLD, (WIDTH//2,34))
        label(self.screen, "P1: A/D move • W jump • Space shoot       P2: ←/→ move • ↑ jump • / shoot       R: new battle", self.small, WHITE, (WIDTH//2,68))
        self.hp_panel(self.players[0],20,"left"); self.hp_panel(self.players[1],WIDTH-430,"right")
        if self.state == "roll":
            o=pygame.Surface((WIDTH,HEIGHT),pygame.SRCALPHA); o.fill((0,0,0,155)); self.screen.blit(o,(0,0))
            label(self.screen,"WEAPON ROLL!",self.title,GOLD,(WIDTH//2,235))
            label(self.screen,f"PLAYER 1 ROLLED: {self.players[0].weapon.name}",self.big,P1,(WIDTH//2,305))
            label(self.screen,f"PLAYER 2 ROLLED: {self.players[1].weapon.name}",self.big,P2,(WIDTH//2,350))
            label(self.screen,"One roll each this battle • 100 unique weapons • COLOSSUS chance: 1 in 100",self.medium,WHITE,(WIDTH//2,415))
        elif self.state == "result":
            o=pygame.Surface((WIDTH,HEIGHT),pygame.SRCALPHA); o.fill((0,0,0,175)); self.screen.blit(o,(0,0))
            color=P1 if self.winner==1 else P2; label(self.screen,f"PLAYER {self.winner} WON!",self.title,color,(WIDTH//2,290))
            label(self.screen,"Press Enter for a new map and new weapon rolls",self.medium,WHITE,(WIDTH//2,355))
        pygame.display.flip()
    def run(self):
        running=True
        while running:
            dt=self.clock.tick(FPS)/1000
            for event in pygame.event.get(): running=self.handle(event) and running
            self.update(dt); self.draw()
        pygame.quit()

if __name__ == "__main__": Game().run()
