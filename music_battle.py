"""Neon Number One: a two-player, cooperative rhythm battle."""

import math
import random
import sys
from dataclasses import dataclass

import pygame

WIDTH, HEIGHT = 1280, 720
FPS = 60
TARGET_Y = 550
LANE_GAP = 70
LEFT_CENTER, RIGHT_CENTER = 315, 965
TRAVEL_TIME = 1.65
HIT_WINDOW = 0.165

INK = (9, 12, 29)
P1 = (55, 224, 255)
P2 = (255, 89, 183)
GOLD = (255, 212, 75)
WHITE = (239, 246, 255)
MUTED = (135, 155, 190)


@dataclass
class Note:
    player: int
    lane: int
    due: float
    hit: bool = False


class Music:
    """Tiny procedural bleeps so every level has its own melody without assets."""

    def __init__(self):
        self.ready = False
        try:
            pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=256)
            self.ready = True
        except pygame.error:
            pass

    def blip(self, player, lane, accuracy):
        if not self.ready:
            return
        # A short sine tone, tuned by player and lane.  Timing affects volume.
        import array
        rate, length = 22050, 0.075
        frequency = (330 if player == 1 else 440) * (1 + lane * 0.12)
        volume = max(0.18, 0.48 - accuracy * 1.7)
        samples = array.array("h", (
            int(32767 * volume * math.sin(2 * math.pi * frequency * i / rate) * (1 - i / (rate * length)))
            for i in range(int(rate * length))
        ))
        pygame.mixer.Sound(buffer=samples.tobytes()).play()


def level_data(level):
    """Return an original beat chart; higher levels are denser and faster."""
    rng = random.Random(level * 9176)
    bpm = 92 + level * 7
    beat = 60 / bpm
    count = 18 + level * 3
    notes = []
    time = 2.2
    for step in range(count):
        # Alternating call-and-response, growing into occasional simultaneous chords.
        lead = 1 if step % 2 == 0 else 2
        lane = (step * (level % 3 + 1) + rng.randrange(4)) % 4
        notes.append(Note(lead, lane, time))
        if level >= 5 and step % max(8 - level // 4, 3) == 0:
            notes.append(Note(3 - lead, (lane + 1 + level) % 4, time))
        if level >= 12 and step % 7 == 3:
            notes.append(Note(lead, (lane + 2) % 4, time + beat * 0.5))
        time += beat * (0.5 if level >= 16 and step % 6 == 4 else 1)
    return bpm, notes, time + 1.0


def font(size, bold=False):
    return pygame.font.SysFont("arial", size, bold=bold)


def label(surface, text, fnt, color, pos, anchor="center"):
    image = fnt.render(text, True, color)
    rect = image.get_rect(**{anchor: pos})
    surface.blit(image, rect)
    return rect


def rounded(surface, rect, color, radius=16, border=None):
    pygame.draw.rect(surface, color, rect, border_radius=radius)
    if border:
        pygame.draw.rect(surface, border, rect, width=2, border_radius=radius)


class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Neon Number One — Music Battle")
        self.clock = pygame.time.Clock()
        self.music = Music()
        self.title = font(48, True)
        self.big = font(34, True)
        self.medium = font(21, True)
        self.small = font(16, True)
        self.state = "select"
        self.level = 1
        self.message = ""
        self.start_level(1, select_only=True)

    def start_level(self, level, select_only=False):
        self.level = max(1, min(20, level))
        self.bpm, self.notes, self.end_time = level_data(self.level)
        self.song_time = -2.4
        self.scores = {1: 0.0, 2: 0.0}
        self.hits = {1: 0, 2: 0}
        self.failed_note = None
        self.message = ""
        if not select_only:
            self.state = "playing"

    def lane_x(self, player, lane):
        center = LEFT_CENTER if player == 1 else RIGHT_CENTER
        return center + (lane - 1.5) * LANE_GAP

    def key_for(self, player, lane):
        p1 = [pygame.K_w, pygame.K_a, pygame.K_s, pygame.K_d]
        p2 = [pygame.K_UP, pygame.K_LEFT, pygame.K_DOWN, pygame.K_RIGHT]
        return (p1 if player == 1 else p2)[lane]

    def key_name(self, player, lane):
        return (["W", "A", "S", "D"] if player == 1 else ["↑", "←", "↓", "→"])[lane]

    def hit(self, player, lane):
        candidates = [n for n in self.notes if n.player == player and n.lane == lane and not n.hit]
        if not candidates:
            return
        note = min(candidates, key=lambda n: abs(n.due - self.song_time))
        error = abs(note.due - self.song_time)
        if error <= HIT_WINDOW:
            note.hit = True
            self.hits[player] += 1
            self.scores[player] += max(15, round(1000 * (1 - error / HIT_WINDOW)))
            self.music.blip(player, lane, error)
        # Early/late presses outside the window are harmless; a missed note decides it.

    def update(self, dt):
        if self.state != "playing":
            return
        self.song_time += dt
        if self.song_time < 0:
            return
        for note in self.notes:
            if not note.hit and self.song_time > note.due + HIT_WINDOW:
                self.failed_note = note
                self.state = "result"
                self.message = "BOTH PLAYERS LOST!"
                return
        if self.song_time >= self.end_time and all(note.hit for note in self.notes):
            self.state = "result"
            if self.scores[1] >= self.scores[2]:
                self.message = "PLAYER 1 WON!"
            else:
                self.message = "PLAYER 2 WON!"

    def event(self, event):
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.KEYDOWN:
            if event.key == pygame.K_ESCAPE:
                self.state = "select"
            elif self.state == "playing":
                if event.key == pygame.K_r:
                    self.start_level(self.level)
                else:
                    for player in (1, 2):
                        for lane in range(4):
                            if event.key == self.key_for(player, lane):
                                self.hit(player, lane)
            elif self.state == "result":
                if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                    self.start_level(self.level + 1 if self.message != "BOTH PLAYERS LOST!" else self.level)
                elif event.key == pygame.K_r:
                    self.start_level(self.level)
            else:
                if pygame.K_1 <= event.key <= pygame.K_9:
                    self.start_level(event.key - pygame.K_0)
                    self.state = "playing"
                elif event.key == pygame.K_0:
                    self.start_level(10)
                    self.state = "playing"
                elif event.key == pygame.K_RIGHTBRACKET:
                    self.start_level(self.level + 1)
                    self.state = "playing"
                elif event.key == pygame.K_LEFTBRACKET:
                    self.start_level(self.level - 1)
                    self.state = "playing"
        elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.state == "select":
            for level, rect in self.level_buttons():
                if rect.collidepoint(event.pos):
                    self.start_level(level)
                    self.state = "playing"
        return True

    def avatar(self, x, y, color, number, name):
        # A simple stage character: head, jacket, legs, and a glowing number badge.
        glow = pygame.Surface((150, 190), pygame.SRCALPHA)
        pygame.draw.circle(glow, (*color, 35), (75, 85), 67)
        self.screen.blit(glow, (x - 75, y - 85))
        pygame.draw.circle(self.screen, (255, 220, 190), (x, y - 38), 23)
        pygame.draw.circle(self.screen, color, (x, y - 44), 25, width=7)
        rounded(self.screen, pygame.Rect(x - 31, y - 12, 62, 66), color, 18)
        pygame.draw.line(self.screen, color, (x - 17, y + 50), (x - 22, y + 78), 12)
        pygame.draw.line(self.screen, color, (x + 17, y + 50), (x + 22, y + 78), 12)
        label(self.screen, str(number), self.big, INK, (x, y + 21))
        label(self.screen, name, self.small, color, (x, y + 100))

    def level_buttons(self):
        buttons = []
        for i in range(20):
            row, col = divmod(i, 5)
            rect = pygame.Rect(265 + col * 154, 275 + row * 76, 130, 56)
            buttons.append((i + 1, rect))
        return buttons

    def draw_select(self):
        self.screen.fill(INK)
        for y in range(0, HEIGHT, 48):
            pygame.draw.line(self.screen, (15, 23, 52), (0, y), (WIDTH, y), 1)
        label(self.screen, "NEON NUMBER ONE", self.title, GOLD, (WIDTH // 2, 90))
        label(self.screen, "A two-player rhythm battle • Catch every note together", self.medium, WHITE, (WIDTH // 2, 137))
        self.avatar(130, 207, P1, 1, "PLAYER 1")
        self.avatar(1150, 207, P2, 2, "PLAYER 2")
        label(self.screen, "SELECT A LEVEL", self.big, WHITE, (WIDTH // 2, 218))
        for level, rect in self.level_buttons():
            _, notes, _ = level_data(level)
            color = P1 if level <= 10 else P2
            rounded(self.screen, rect, (19, 31, 67), 12, color)
            label(self.screen, f"{level:02}", self.medium, WHITE, rect.center)
            label(self.screen, f"{92 + level * 7} BPM  •  {len(notes)} notes", self.small, MUTED, (rect.centerx, rect.bottom + 14))
        label(self.screen, "Click a level  •  [ / ] changes selected level  •  Esc quits a song", self.small, MUTED, (WIDTH // 2, 665))

    def draw_game(self):
        self.screen.fill((7, 10, 25))
        # stage panels
        pygame.draw.rect(self.screen, (14, 24, 55), (42, 105, 546, 555), border_radius=24)
        pygame.draw.rect(self.screen, (43, 18, 55), (692, 105, 546, 555), border_radius=24)
        pygame.draw.line(self.screen, GOLD, (WIDTH // 2, 118), (WIDTH // 2, 640), 2)
        label(self.screen, f"LEVEL {self.level:02}", self.big, GOLD, (WIDTH // 2, 38))
        label(self.screen, f"{self.bpm} BPM", self.small, MUTED, (WIDTH // 2, 70))
        label(self.screen, "PLAYER 1 — NUMBER ONE", self.medium, P1, (LEFT_CENTER, 135))
        label(self.screen, "PLAYER 2 — RIVAL", self.medium, P2, (RIGHT_CENTER, 135))
        self.avatar(85, 590, P1, 1, "")
        self.avatar(1195, 590, P2, 2, "")
        for player, color in ((1, P1), (2, P2)):
            for lane in range(4):
                x = self.lane_x(player, lane)
                pygame.draw.line(self.screen, (*color, 60), (x, 166), (x, TARGET_Y + 34), 2)
                bucket = pygame.Rect(x - 28, TARGET_Y - 29, 56, 58)
                rounded(self.screen, bucket, (20, 34, 70), 10, color)
                label(self.screen, self.key_name(player, lane), self.medium, WHITE, bucket.center)
        # notes descend according to how close they are to their due beat
        for note in self.notes:
            if note.hit:
                continue
            remaining = note.due - self.song_time
            if remaining > TRAVEL_TIME or remaining < -0.25:
                continue
            x = self.lane_x(note.player, note.lane)
            y = TARGET_Y - remaining / TRAVEL_TIME * 350
            color = P1 if note.player == 1 else P2
            pygame.draw.polygon(self.screen, color, [(x, y - 19), (x + 18, y), (x, y + 19), (x - 18, y)])
            pygame.draw.polygon(self.screen, WHITE, [(x, y - 13), (x + 12, y), (x, y + 13), (x - 12, y)], 2)
        label(self.screen, f"ACCURACY {int(self.scores[1])}", self.small, P1, (LEFT_CENTER, 625))
        label(self.screen, f"ACCURACY {int(self.scores[2])}", self.small, P2, (RIGHT_CENTER, 625))
        if self.song_time < 0 and self.state == "playing":
            count = str(max(1, math.ceil(-self.song_time)))
            label(self.screen, count, font(88, True), GOLD, (WIDTH // 2, 355))

    def draw_result(self):
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 180))
        self.screen.blit(overlay, (0, 0))
        color = (255, 88, 105) if self.message == "BOTH PLAYERS LOST!" else GOLD
        label(self.screen, self.message, self.title, color, (WIDTH // 2, 275))
        if self.failed_note:
            who = "Player 1" if self.failed_note.player == 1 else "Player 2"
            key = self.key_name(self.failed_note.player, self.failed_note.lane)
            label(self.screen, f"{who} missed {key} — every note matters.", self.medium, WHITE, (WIDTH // 2, 326))
        else:
            label(self.screen, f"P1 {int(self.scores[1])}  •  P2 {int(self.scores[2])}", self.big, WHITE, (WIDTH // 2, 326))
        action = "Press R to try again" if self.message == "BOTH PLAYERS LOST!" else "Press Enter for the next level"
        label(self.screen, action, self.medium, WHITE, (WIDTH // 2, 390))
        label(self.screen, "Esc: level select", self.small, MUTED, (WIDTH // 2, 426))

    def draw(self):
        if self.state == "select":
            self.draw_select()
        else:
            self.draw_game()
            if self.state == "result":
                self.draw_result()
        pygame.display.flip()

    def run(self):
        running = True
        while running:
            dt = self.clock.tick(FPS) / 1000
            for event in pygame.event.get():
                running = self.event(event) and running
            self.update(dt)
            self.draw()
        pygame.quit()


if __name__ == "__main__":
    Game().run()
