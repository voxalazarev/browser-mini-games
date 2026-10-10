"""Skybound Duo Obby - a local, cooperative two-player platform game."""

import json
import math
import random
import sys
from dataclasses import dataclass
from pathlib import Path

import pygame

WIDTH, HEIGHT, FPS = 1280, 720, 60
GRAVITY, MOVE_SPEED, JUMP_SPEED = 1650, 320, 625
PLAYER_W, PLAYER_H = 34, 48
TOTAL_LEVELS = 210
SAVE_PATH = Path(__file__).with_name("co_op_obby_progress.json")

SKY_TOP, SKY_BOTTOM = (20, 35, 83), (102, 55, 133)
P1, P2 = (60, 220, 255), (255, 102, 193)
WHITE, INK, GOLD, GREEN, RED = (242, 248, 255), (10, 13, 32), (255, 212, 83), (108, 255, 169), (255, 88, 113)

WEAPONS = [
    "Starter Blaster", "Spark Wand", "Sky Sword", "Pulse Bow", "Comet Cannon", "Nova Staff",
    "Thunder Blade", "Prism Launcher", "Solar Saber", "Starfall Rifle", "Galaxy Hammer",
    "Void Wand", "Aurora Sword", "Meteor Bow", "Cosmic Cannon", "Orbit Staff", "Eclipse Blade",
    "Quasar Launcher", "Supernova Sword", "Infinity Blaster", "Legendary Skyblade",
]


def fnt(size, bold=False):
    return pygame.font.SysFont("arial", size, bold=bold)


def text(screen, value, font, color, pos, anchor="center"):
    image = font.render(value, True, color)
    screen.blit(image, image.get_rect(**{anchor: pos}))


def rounded(screen, rect, color, radius=12, outline=None):
    pygame.draw.rect(screen, color, rect, border_radius=radius)
    if outline:
        pygame.draw.rect(screen, outline, rect, width=2, border_radius=radius)


@dataclass
class Platform:
    x: float
    y: float
    w: float
    h: float = 42

    @property
    def rect(self):
        return pygame.Rect(round(self.x), round(self.y), round(self.w), round(self.h))


@dataclass
class Spike:
    x: float
    y: float
    count: int

    @property
    def rect(self):
        return pygame.Rect(round(self.x), round(self.y - 27), self.count * 22, 27)


class Player:
    def __init__(self, number, color, x, y):
        self.number, self.color = number, color
        self.x, self.y = float(x), float(y)
        self.vx = self.vy = 0.0
        self.grounded = False
        self.facing = 1
        self.jump_buffer = 0.0
        self.coyote = 0.0
        self.shoot_timer = 0.0
        self.frame = 0.0

    @property
    def rect(self):
        return pygame.Rect(round(self.x), round(self.y), PLAYER_W, PLAYER_H)

    def update(self, keys, dt, platforms, controls):
        direction = int(keys[controls["right"]]) - int(keys[controls["left"]])
        self.vx += (direction * MOVE_SPEED - self.vx) * min(1, dt * 16)
        if direction:
            self.facing = direction
            self.frame += dt * 13
        if keys[controls["jump"]]:
            self.jump_buffer = 0.11
        self.jump_buffer -= dt
        self.coyote -= dt
        if self.jump_buffer > 0 and self.coyote > 0:
            self.vy = -JUMP_SPEED
            self.grounded = False
            self.jump_buffer = 0
            self.coyote = 0
        self.vy += GRAVITY * dt
        self.vy = min(self.vy, 850)
        self.x += self.vx * dt
        self.resolve_x(platforms)
        was_grounded = self.grounded
        self.grounded = False
        self.y += self.vy * dt
        self.resolve_y(platforms)
        if was_grounded and not self.grounded:
            self.coyote = max(self.coyote, 0.09)
        if self.grounded:
            self.coyote = 0.12
        self.shoot_timer = max(0, self.shoot_timer - dt)

    def resolve_x(self, platforms):
        for platform in platforms:
            if self.rect.colliderect(platform.rect):
                if self.vx > 0:
                    self.x = platform.x - PLAYER_W
                elif self.vx < 0:
                    self.x = platform.x + platform.w
                self.vx = 0

    def resolve_y(self, platforms):
        for platform in platforms:
            if self.rect.colliderect(platform.rect):
                if self.vy > 0:
                    self.y = platform.y - PLAYER_H
                    self.grounded = True
                elif self.vy < 0:
                    self.y = platform.y + platform.h
                self.vy = 0

    def draw(self, screen, camera, weapon_tier):
        x, y = round(self.x - camera), round(self.y)
        bob = int(math.sin(self.frame) * 2) if abs(self.vx) > 20 else 0
        # Animated stepping legs and arm.
        step = int(math.sin(self.frame) * 5)
        pygame.draw.line(screen, (25, 33, 68), (x + 11, y + 39), (x + 9 + step, y + 50), 7)
        pygame.draw.line(screen, (25, 33, 68), (x + 24, y + 39), (x + 26 - step, y + 50), 7)
        rounded(screen, pygame.Rect(x + 3, y + 16 + bob, 28, 26), self.color, 9)
        pygame.draw.circle(screen, (255, 220, 191), (x + 17, y + 12 + bob), 13)
        pygame.draw.arc(screen, self.color, (x + 4, y - 2 + bob, 26, 27), math.pi, math.tau, 5)
        pygame.draw.circle(screen, INK, (x + 13, y + 11 + bob), 2)
        pygame.draw.circle(screen, INK, (x + 21, y + 11 + bob), 2)
        # Weapon grows in colour/length at every ten levels.
        weapon_color = GOLD if weapon_tier % 2 == 0 else (176, 137, 255)
        hand = (x + (31 if self.facing > 0 else 3), y + 27 + bob)
        end = (hand[0] + self.facing * (18 + min(weapon_tier, 8) * 2), hand[1] - 7)
        pygame.draw.line(screen, weapon_color, hand, end, 5)
        pygame.draw.circle(screen, WHITE, end, 4)
        text(screen, str(self.number), fnt(14, True), INK, (x + 17, y + 29 + bob))


class Enemy:
    def __init__(self, x, y, left, right, level):
        self.x, self.y, self.left, self.right = x, y, left, right
        self.speed = 72 + (level % 8) * 8
        self.direction = 1
        self.frame = 0.0
        self.alive = True

    @property
    def rect(self):
        return pygame.Rect(round(self.x), round(self.y), 34, 31)

    def update(self, dt):
        self.frame += dt * 8
        self.x += self.direction * self.speed * dt
        if self.x < self.left or self.x + 34 > self.right:
            self.direction *= -1
            self.x = max(self.left, min(self.x, self.right - 34))

    def draw(self, screen, camera):
        x, y = round(self.x - camera), round(self.y + math.sin(self.frame) * 2)
        pygame.draw.ellipse(screen, (113, 68, 174), (x, y + 4, 34, 27))
        pygame.draw.polygon(screen, (164, 111, 232), [(x + 5, y + 8), (x + 11, y - 5), (x + 17, y + 6), (x + 25, y - 5), (x + 30, y + 10)])
        pygame.draw.circle(screen, WHITE, (x + 12, y + 14), 4)
        pygame.draw.circle(screen, WHITE, (x + 24, y + 14), 4)
        pygame.draw.circle(screen, INK, (x + 12, y + 15), 2)
        pygame.draw.circle(screen, INK, (x + 24, y + 15), 2)


class Projectile:
    def __init__(self, player, tier):
        self.x = player.x + PLAYER_W / 2 + player.facing * 19
        self.y = player.y + 27
        self.vx = player.facing * (570 + tier * 18)
        self.tier = tier

    @property
    def rect(self):
        return pygame.Rect(round(self.x - 6), round(self.y - 6), 12, 12)

    def update(self, dt):
        self.x += self.vx * dt

    def draw(self, screen, camera):
        x = round(self.x - camera)
        color = GOLD if self.tier % 2 == 0 else (173, 133, 255)
        pygame.draw.circle(screen, color, (x, round(self.y)), 7)
        pygame.draw.circle(screen, WHITE, (x, round(self.y)), 3)


def make_level(level):
    """Deterministically make 210 increasingly long, playable obstacle courses."""
    rng = random.Random(10007 + level * 71)
    difficulty = min(1.0, level / TOTAL_LEVELS)
    segments = 7 + level // 4
    platforms = [Platform(0, 592, 290, 128)]
    spikes, enemies = [], []
    cursor, y = 290.0, 592.0
    for i in range(segments):
        max_gap = 58 + int(difficulty * 71)
        gap = rng.randint(34, max_gap)
        # Deliberate stair climbs, high floating paths, then descents.
        # Each change remains inside a normal jump's vertical reach.
        phase = i % 12
        if phase in (3, 4, 5):
            vertical_step = -rng.randint(28, 57)
        elif phase in (8, 9, 10):
            vertical_step = rng.randint(25, 54)
        else:
            vertical_step = rng.choice([-1, 0, 0, 1]) * rng.randint(0, 25 + int(difficulty * 32))
        y += vertical_step
        y = max(350, min(592, y))
        width = rng.randint(max(103, 165 - level // 3), 208)
        cursor += gap
        platform = Platform(cursor, y, width, 128)
        platforms.append(platform)
        # Hazard density grows, but leave safe landings and platform edges.
        if i > 1 and width >= 140 and rng.random() < 0.12 + difficulty * 0.28:
            count = 1 if width < 180 else rng.choice([1, 2])
            spikes.append(Spike(cursor + width * 0.55, y, count))
        cursor += width
    goal = Platform(cursor + 70, 592, 240, 128)
    platforms.append(goal)
    # Only occasional challenge stages contain enemies.
    if level % 7 == 0 or level % 11 == 0:
        candidates = [p for p in platforms[3:-1] if p.w > 140]
        rng.shuffle(candidates)
        for platform in candidates[:1 + level // 75]:
            enemies.append(Enemy(platform.x + 45, platform.y - 31, platform.x + 22, platform.x + platform.w - 22, level))
    return platforms, spikes, enemies, goal.x + 82


class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Skybound Duo Obby")
        self.clock = pygame.time.Clock()
        self.title, self.large, self.medium, self.small = fnt(39, True), fnt(27, True), fnt(19, True), fnt(15, True)
        self.progress = self.load_progress()
        self.state, self.selected = "map", self.progress["unlocked"]
        self.toast, self.toast_time = "", 0.0
        self.start_level(self.selected, show_map=True)

    def load_progress(self):
        try:
            saved = json.loads(SAVE_PATH.read_text())
            return {"unlocked": max(1, min(TOTAL_LEVELS, int(saved.get("unlocked", 1))))}
        except (OSError, ValueError, TypeError):
            return {"unlocked": 1}

    def save_progress(self):
        SAVE_PATH.write_text(json.dumps(self.progress))

    def start_level(self, level, show_map=False):
        self.level = max(1, min(level, self.progress["unlocked"]))
        self.selected = self.level
        self.platforms, self.spikes, self.enemies, self.goal_x = make_level(self.level)
        self.players = [Player(1, P1, 95, 500), Player(2, P2, 170, 500)]
        self.projectiles = []
        self.camera = 0.0
        self.done = {1: False, 2: False}
        self.state = "map" if show_map else "playing"
        self.restart_delay = 0.0

    @property
    def tier(self):
        return min(len(WEAPONS) - 1, self.level // 10)

    def restart(self, reason):
        self.toast, self.toast_time = reason, 1.15
        self.start_level(self.level)
        self.toast, self.toast_time = reason, 1.15

    def shoot(self, player):
        if player.shoot_timer <= 0 and self.state == "playing":
            self.projectiles.append(Projectile(player, self.tier))
            player.shoot_timer = max(0.16, 0.42 - self.tier * 0.01)

    def handle_event(self, event):
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.state = "map"
            elif event.key == pygame.K_r:
                self.restart("LEVEL RESTARTED")
            elif self.state == "map":
                if event.key in (pygame.K_RIGHTBRACKET, pygame.K_RIGHT):
                    self.selected = min(self.progress["unlocked"], self.selected + 1)
                elif event.key in (pygame.K_LEFTBRACKET, pygame.K_LEFT):
                    self.selected = max(1, self.selected - 1)
                elif event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    self.start_level(self.selected)
                elif pygame.K_1 <= event.key <= pygame.K_9:
                    desired = event.key - pygame.K_0
                    if desired <= self.progress["unlocked"]:
                        self.start_level(desired)
            elif self.state == "playing":
                if event.key == pygame.K_v:
                    self.shoot(self.players[0])
                elif event.key in (pygame.K_LCTRL, pygame.K_RCTRL):
                    self.shoot(self.players[1])
            elif self.state == "won" and event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.start_level(min(TOTAL_LEVELS, self.level + 1))
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.state == "map":
            for level, rect in self.map_buttons():
                if level <= self.progress["unlocked"] and rect.collidepoint(event.pos):
                    self.start_level(level)
        return True

    def update(self, dt):
        self.toast_time = max(0, self.toast_time - dt)
        if self.state != "playing":
            return
        keys = pygame.key.get_pressed()
        controls = [
            {"left": pygame.K_a, "right": pygame.K_d, "jump": pygame.K_w},
            {"left": pygame.K_LEFT, "right": pygame.K_RIGHT, "jump": pygame.K_UP},
        ]
        for player, mapping in zip(self.players, controls):
            player.update(keys, dt, self.platforms, mapping)
        for enemy in self.enemies:
            enemy.update(dt)
        for bullet in self.projectiles[:]:
            bullet.update(dt)
            for enemy in self.enemies:
                if enemy.alive and bullet.rect.colliderect(enemy.rect):
                    enemy.alive = False
                    if bullet in self.projectiles:
                        self.projectiles.remove(bullet)
                    break
            if bullet in self.projectiles and (bullet.x < -50 or bullet.x > self.goal_x + 500):
                self.projectiles.remove(bullet)
        self.enemies = [enemy for enemy in self.enemies if enemy.alive]
        for player in self.players:
            if player.y > HEIGHT + 90:
                self.restart("BOTH PLAYERS FELL — RESTART!")
                return
            if any(player.rect.colliderect(spike.rect) for spike in self.spikes):
                self.restart("SPIKES! BOTH PLAYERS RESTART!")
                return
            if any(player.rect.colliderect(enemy.rect) for enemy in self.enemies):
                self.restart("ENEMY HIT! BOTH PLAYERS RESTART!")
                return
            if player.x + PLAYER_W / 2 >= self.goal_x:
                self.done[player.number] = True
        lead = max(player.x for player in self.players)
        self.camera += (max(0, lead - WIDTH * 0.54) - self.camera) * min(1, dt * 4)
        if all(self.done.values()):
            self.state = "won"
            if self.level < TOTAL_LEVELS and self.progress["unlocked"] <= self.level:
                self.progress["unlocked"] = self.level + 1
                self.save_progress()
            self.toast = "LEVEL COMPLETE!"

    def draw_world(self):
        # Gradient sky, cloud layers, and distant mountains give the course depth.
        for y in range(HEIGHT):
            t = y / HEIGHT
            color = tuple(int(SKY_TOP[i] * (1 - t) + SKY_BOTTOM[i] * t) for i in range(3))
            pygame.draw.line(self.screen, color, (0, y), (WIDTH, y))
        sun_x = int(1050 - self.camera * 0.04)
        pygame.draw.circle(self.screen, (255, 204, 126), (sun_x, 128), 58)
        for i in range(-1, 8):
            x = int(i * 235 - (self.camera * 0.10) % 235)
            cloud_y = 112 + (i * 47) % 150
            cloud = pygame.Surface((125, 55), pygame.SRCALPHA)
            pygame.draw.ellipse(cloud, (238, 233, 255, 48), (5, 20, 70, 27))
            pygame.draw.circle(cloud, (248, 240, 255, 55), (47, 22), 22)
            pygame.draw.circle(cloud, (248, 240, 255, 48), (76, 27), 17)
            self.screen.blit(cloud, (x, cloud_y))
        for i in range(-1, 8):
            x = i * 260 - (self.camera * 0.18) % 260
            pygame.draw.polygon(self.screen, (48, 64, 120), [(int(x - 150), 640), (int(x), 420), (int(x + 180), 640)])
            pygame.draw.polygon(self.screen, (36, 51, 98), [(int(x + 40), 640), (int(x + 160), 465), (int(x + 330), 640)])
        for platform in self.platforms:
            rect = platform.rect.move(-round(self.camera), 0)
            if rect.right < -20 or rect.left > WIDTH + 20:
                continue
            # Soil, rock strata, and grass make platforms read as floating islands.
            rounded(self.screen, rect, (91, 62, 52), 9, (54, 42, 56))
            pygame.draw.rect(self.screen, (118, 79, 58), (rect.x + 3, rect.y + 10, rect.w - 6, rect.h - 13), border_radius=5)
            for stripe in range(rect.y + 25, rect.bottom, 22):
                pygame.draw.line(self.screen, (81, 56, 52), (rect.x + 7, stripe), (rect.right - 7, stripe), 2)
            pygame.draw.rect(self.screen, (91, 193, 132), (rect.x, rect.y, rect.w, 10), border_radius=5)
            pygame.draw.line(self.screen, (180, 247, 159), (rect.x + 5, rect.y + 3), (rect.right - 5, rect.y + 3), 2)
        for spike in self.spikes:
            rect = spike.rect.move(-round(self.camera), 0)
            for i in range(spike.count):
                x = rect.x + i * 22
                pygame.draw.polygon(self.screen, RED, [(x, rect.bottom), (x + 11, rect.top), (x + 22, rect.bottom)])
        goal_x = int(self.goal_x - self.camera)
        pygame.draw.rect(self.screen, (35, 82, 77), (goal_x - 35, 481, 14, 111))
        pygame.draw.circle(self.screen, GREEN, (goal_x - 28, 481), 13)
        pygame.draw.arc(self.screen, GREEN, (goal_x - 15, 505, 64, 76), -math.pi / 2, math.pi / 2, 7)
        text(self.screen, "EXIT", self.small, GREEN, (goal_x + 18, 488))
        for enemy in self.enemies:
            enemy.draw(self.screen, self.camera)
        for bullet in self.projectiles:
            bullet.draw(self.screen, self.camera)
        for player in self.players:
            shadow = pygame.Surface((46, 12), pygame.SRCALPHA)
            pygame.draw.ellipse(shadow, (0, 0, 0, 70), (0, 0, 46, 12))
            self.screen.blit(shadow, (player.x - self.camera - 6, player.y + PLAYER_H - 4))
            player.draw(self.screen, self.camera, self.tier)

    def draw_hud(self):
        rounded(self.screen, pygame.Rect(20, 18, 350, 72), (11, 17, 42), 14, (82, 125, 183))
        text(self.screen, f"LEVEL {self.level} / {TOTAL_LEVELS}", self.medium, WHITE, (38, 37), "midleft")
        text(self.screen, WEAPONS[self.tier], self.small, GOLD, (38, 67), "midleft")
        rounded(self.screen, pygame.Rect(WIDTH - 365, 18, 345, 72), (11, 17, 42), 14, (82, 125, 183))
        text(self.screen, "P1: A/D + W + V", self.small, P1, (WIDTH - 346, 39), "midleft")
        text(self.screen, "P2: ←/→ + ↑ + Ctrl", self.small, P2, (WIDTH - 346, 67), "midleft")
        if self.toast_time > 0:
            text(self.screen, self.toast, self.large, RED, (WIDTH // 2, 100))

    def map_buttons(self):
        buttons = []
        for index in range(TOTAL_LEVELS):
            row, col = divmod(index, 15)
            buttons.append((index + 1, pygame.Rect(112 + col * 71, 220 + row * 31, 53, 23)))
        return buttons

    def draw_map(self):
        self.screen.fill(INK)
        for y in range(0, HEIGHT, 48):
            pygame.draw.line(self.screen, (23, 34, 72), (0, y), (WIDTH, y), 1)
        text(self.screen, "SKYBOUND DUO OBBY", self.title, GOLD, (WIDTH // 2, 66))
        text(self.screen, f"Unlocked: {self.progress['unlocked']} / {TOTAL_LEVELS}  •  Select an unlocked level", self.medium, WHITE, (WIDTH // 2, 110))
        text(self.screen, "Both players must reach the exit. One fall or spike resets everybody.", self.small, (159, 184, 223), (WIDTH // 2, 145))
        for level, rect in self.map_buttons():
            unlocked = level <= self.progress["unlocked"]
            color = P1 if level == self.selected else ((43, 76, 122) if unlocked else (29, 36, 59))
            rounded(self.screen, rect, color, 5, GOLD if level % 10 == 0 and unlocked else None)
            if level % 10 == 0:
                text(self.screen, str(level), self.small, WHITE if unlocked else (92, 101, 126), rect.center)
            elif level in (1, self.selected):
                text(self.screen, str(level), self.small, WHITE, rect.center)
        tier = self.progress["unlocked"] // 10
        text(self.screen, f"Next weapon milestone: Level {(tier + 1) * 10}  •  {WEAPONS[min(len(WEAPONS)-1, tier + 1)]}", self.medium, GOLD, (WIDTH // 2, 625))
        text(self.screen, "Click a level • Enter starts • [ / ] changes selection • Progress saves automatically", self.small, WHITE, (WIDTH // 2, 670))

    def draw_win(self):
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 165))
        self.screen.blit(overlay, (0, 0))
        text(self.screen, "LEVEL COMPLETE!", self.title, GREEN, (WIDTH // 2, 263))
        if self.level < TOTAL_LEVELS:
            unlocked_weapon = WEAPONS[min(len(WEAPONS) - 1, (self.level + 1) // 10)]
            if (self.level + 1) % 10 == 0:
                text(self.screen, f"New weapon ready next level: {unlocked_weapon}", self.medium, GOLD, (WIDTH // 2, 317))
            else:
                text(self.screen, "Both heroes made it to the exit.", self.medium, WHITE, (WIDTH // 2, 317))
            text(self.screen, "Press Enter for the next unlocked level", self.medium, WHITE, (WIDTH // 2, 376))
        else:
            text(self.screen, "You conquered all 210 Skybound levels!", self.medium, GOLD, (WIDTH // 2, 327))
        text(self.screen, "Esc: level map", self.small, WHITE, (WIDTH // 2, 422))

    def draw(self):
        if self.state == "map":
            self.draw_map()
        else:
            self.draw_world()
            self.draw_hud()
            if self.state == "won":
                self.draw_win()
        pygame.display.flip()

    def run(self):
        running = True
        while running:
            dt = self.clock.tick(FPS) / 1000
            for event in pygame.event.get():
                running = self.handle_event(event) and running
            self.update(dt)
            self.draw()
        pygame.quit()


if __name__ == "__main__":
    Game().run()
