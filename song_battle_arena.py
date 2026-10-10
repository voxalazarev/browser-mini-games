"""Beat Clash Arena: 120 two-player rhythm and button-spam battles."""

import array
import math
import random
import sys
from dataclasses import dataclass

import pygame

WIDTH, HEIGHT, FPS = 1280, 720, 60
TOTAL_LEVELS = 120
TARGET_Y = 548
ARROW_SIZE = 36
BUCKET_HEIGHT = int(ARROW_SIZE * 2.5)  # exactly 2.5 falling-arrow heights
TRAVEL_TIME, HIT_WINDOW = 1.75, 0.155
P1, P2 = (56, 219, 255), (255, 86, 175)
INK, WHITE, GOLD, RED, MUTED = (8, 12, 29), (242, 248, 255), (255, 214, 75), (255, 82, 105), (139, 157, 193)


@dataclass
class Note:
    player: int
    lane: int
    due: float
    hit: bool = False


def font(size, bold=False):
    return pygame.font.SysFont("arial", size, bold=bold)


def label(screen, value, fnt, color, pos, anchor="center"):
    image = fnt.render(value, True, color)
    screen.blit(image, image.get_rect(**{anchor: pos}))


def rounded(screen, rect, color, radius=12, border=None):
    pygame.draw.rect(screen, color, rect, border_radius=radius)
    if border:
        pygame.draw.rect(screen, border, rect, width=2, border_radius=radius)


class Sounds:
    """Procedural notes give each generated song a distinct sound palette."""
    def __init__(self):
        self.ready = False
        try:
            pygame.mixer.init(frequency=22050, size=-16, channels=1, buffer=256)
            self.ready = True
        except pygame.error:
            pass

    def tone(self, frequency, duration=0.07, volume=0.33):
        if not self.ready:
            return
        rate = 22050
        samples = array.array("h", (
            int(32767 * volume * math.sin(math.tau * frequency * i / rate) * (1 - i / (rate * duration)))
            for i in range(int(rate * duration))
        ))
        pygame.mixer.Sound(buffer=samples.tobytes()).play()

    def hit(self, player, lane, level):
        scale = [1, 9 / 8, 5 / 4, 3 / 2]
        base = 220 + (level * 29) % 250
        self.tone(base * scale[lane] * (1 if player == 1 else 1.5))

    def fail(self):
        self.tone(110, 0.18, 0.45)

    def spam(self, player):
        self.tone(450 if player == 1 else 570, 0.035, 0.24)

    def backing(self, level, tick):
        """A compact, level-specific backing song: bass, melody, and a beat pulse."""
        if not self.ready:
            return
        # Each six-level style has a different scale; the level rotates its melody.
        scales = [
            [0, 3, 7, 10], [0, 2, 7, 9], [0, 5, 7, 12],
            [0, 2, 3, 7, 10], [0, 4, 7, 11], [0, 3, 5, 8, 10],
        ]
        scale = scales[level % len(scales)]
        root = 130 + (level % 9) * 12
        melody_step = (tick * (level % 5 + 1) + level // 3) % len(scale)
        if tick % 2 == 0:
            self.tone(root / 2, 0.095, 0.20)  # bass pulse
        self.tone(root * (2 ** (scale[melody_step] / 12)), 0.09, 0.17)
        if tick % 4 == 2:
            self.tone(880 + (level % 4) * 55, 0.028, 0.10)  # bright percussion tick


def song_for(level):
    """Create 120 different beat maps with song names, tempo, and motifs."""
    names = ["Neon Run", "Moon Circuit", "Turbo Heart", "Crystal Rush", "Solar Bounce", "Pixel Storm"]
    rng = random.Random(503 + level * 719)
    bpm = 86 + (level * 5) % 126
    beat = 60 / bpm
    count = 18 + level // 2
    motif = level % 6
    notes, t = [], 2.3
    for step in range(count):
        player = 1 if (step + motif) % 2 == 0 else 2
        lane = (step * (motif + 1) + rng.randrange(4)) % 4
        notes.append(Note(player, lane, t))
        # From level 15 upward, the song occasionally calls both players at once.
        if level >= 15 and step % max(8 - level // 25, 3) == 1:
            notes.append(Note(3 - player, (lane + 1 + motif) % 4, t))
        # Fast off-beat notes start appearing late in the campaign.
        if level >= 55 and step % 9 == 5:
            notes.append(Note(player, (lane + 2) % 4, t + beat * 0.48))
        t += beat * (0.62 if level >= 90 and step % 7 == 4 else 1)
    return f"{names[motif]} #{level:03}", bpm, notes, t + 1.0


class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Beat Clash Arena")
        self.clock = pygame.time.Clock()
        self.sounds = Sounds()
        self.title, self.big, self.medium, self.small = font(45, True), font(31, True), font(21, True), font(16, True)
        self.level = 1
        self.state = "select"
        self.start_level(1, keep_select=True)

    def start_level(self, level, keep_select=False):
        self.level = max(1, min(TOTAL_LEVELS, level))
        self.song_name, self.bpm, self.notes, self.song_end = song_for(self.level)
        self.song_time = -2.4
        self.next_backing_tick = 0
        self.scores = {1: 0, 2: 0}
        self.winner = None
        self.loser = None
        self.result = ""
        self.spam_bar = 0.0
        self.spam_time = 9.0
        self.flash = 0.0
        self.state = "select" if keep_select else "rhythm"

    @staticmethod
    def lanes(player):
        return ([pygame.K_w, pygame.K_a, pygame.K_s, pygame.K_d] if player == 1 else
                [pygame.K_UP, pygame.K_LEFT, pygame.K_DOWN, pygame.K_RIGHT])

    @staticmethod
    def key_name(player, lane):
        return (["W", "A", "S", "D"] if player == 1 else ["↑", "←", "↓", "→"])[lane]

    @staticmethod
    def center(player):
        return 320 if player == 1 else 960

    def lane_x(self, player, lane):
        return self.center(player) + (lane - 1.5) * 74

    def lose_rhythm(self, player, reason):
        self.loser, self.winner = player, 3 - player
        self.result = reason
        self.sounds.fail()
        self.state = "transition"
        self.transition_time = 1.65

    def press_note(self, player, lane):
        if self.song_time < 0:
            return
        nearby = [note for note in self.notes if note.player == player and note.lane == lane and not note.hit]
        note = min(nearby, key=lambda item: abs(item.due - self.song_time)) if nearby else None
        if not note or abs(note.due - self.song_time) > HIT_WINDOW:
            self.lose_rhythm(player, f"PLAYER {player} PRESSED TOO EARLY OR LATE!")
            return
        error = abs(note.due - self.song_time)
        note.hit = True
        self.scores[player] += round(1000 * (1 - error / HIT_WINDOW))
        self.sounds.hit(player, lane, self.level)
        self.flash = 0.08

    def press_spam(self, player):
        # The rhythm winner has a real advantage: every push is 70% stronger.
        amount = 0.072 if player == self.winner else 0.043
        self.spam_bar += amount if player == 1 else -amount
        self.spam_bar = max(-1, min(1, self.spam_bar))
        self.sounds.spam(player)
        if abs(self.spam_bar) >= 1:
            self.finish_spam(1 if self.spam_bar > 0 else 2)

    def finish_spam(self, winner):
        self.winner, self.loser = winner, 3 - winner
        self.result = f"PLAYER {winner} WON LEVEL {self.level}!"
        self.state = "result"

    def update(self, dt):
        self.flash = max(0, self.flash - dt)
        if self.state == "rhythm":
            self.song_time += dt
            if self.song_time >= 0:
                # Play backing notes on half-beats, keeping tempo tied to this level's song.
                half_beat = 30 / self.bpm
                while self.song_time >= self.next_backing_tick * half_beat:
                    self.sounds.backing(self.level, self.next_backing_tick)
                    self.next_backing_tick += 1
                for note in self.notes:
                    if not note.hit and self.song_time > note.due + HIT_WINDOW:
                        self.lose_rhythm(note.player, f"PLAYER {note.player} MISSED A NOTE!")
                        return
            if self.song_time > self.song_end and all(note.hit for note in self.notes):
                # A perfect song is settled by timing accuracy, then starts the spam battle.
                self.winner = 1 if self.scores[1] >= self.scores[2] else 2
                self.loser = 3 - self.winner
                self.result = f"PERFECT SONG! PLAYER {self.winner} HAD BETTER TIMING."
                self.state = "transition"
                self.transition_time = 1.65
        elif self.state == "transition":
            self.transition_time -= dt
            if self.transition_time <= 0:
                self.state = "spam"
        elif self.state == "spam":
            self.spam_time -= dt
            self.spam_bar *= max(0, 1 - dt * 0.07)  # a gentle pull toward centre
            if self.spam_time <= 0:
                self.finish_spam(1 if self.spam_bar >= 0 else 2)

    def handle_event(self, event):
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1 and self.state == "select":
            for level, rect in self.level_buttons():
                if rect.collidepoint(event.pos):
                    self.start_level(level)
                    return True
        if event.type != pygame.KEYDOWN:
            return True
        if event.key == pygame.K_ESCAPE:
            self.state = "select"
            return True
        if self.state == "select":
            if pygame.K_1 <= event.key <= pygame.K_9:
                self.start_level(event.key - pygame.K_0)
            elif event.key == pygame.K_0:
                self.start_level(10)
            elif event.key == pygame.K_RIGHTBRACKET:
                self.start_level(self.level + 1)
            elif event.key == pygame.K_LEFTBRACKET:
                self.start_level(self.level - 1)
        elif self.state == "rhythm":
            for player in (1, 2):
                for lane, key in enumerate(self.lanes(player)):
                    if event.key == key:
                        self.press_note(player, lane)
        elif self.state == "spam":
            if event.key == pygame.K_w:
                self.press_spam(1)
            elif event.key == pygame.K_UP:
                self.press_spam(2)
        elif self.state == "result":
            if event.key in (pygame.K_RETURN, pygame.K_SPACE):
                self.start_level(self.level + 1 if self.level < TOTAL_LEVELS else 1)
            elif event.key == pygame.K_r:
                self.start_level(self.level)
        return True

    def level_buttons(self):
        buttons = []
        for index in range(TOTAL_LEVELS):
            row, col = divmod(index, 15)
            buttons.append((index + 1, pygame.Rect(110 + col * 71, 220 + row * 34, 54, 25)))
        return buttons

    def draw_select(self):
        self.screen.fill(INK)
        for y in range(0, HEIGHT, 40):
            pygame.draw.line(self.screen, (20, 30, 64), (0, y), (WIDTH, y), 1)
        label(self.screen, "BEAT CLASH ARENA", self.title, GOLD, (WIDTH // 2, 58))
        label(self.screen, "120 two-phase song battles", self.medium, WHITE, (WIDTH // 2, 104))
        label(self.screen, "Phase 1: strict falling arrows. Miss or press off-beat and you lose the round.", self.small, MUTED, (WIDTH // 2, 142))
        label(self.screen, "Phase 2: W vs ↑ spam showdown — phase-one winner gets stronger pushes.", self.small, MUTED, (WIDTH // 2, 167))
        for level, rect in self.level_buttons():
            color = P1 if level == self.level else (32, 51, 95)
            rounded(self.screen, rect, color, 5, GOLD if level % 10 == 0 else None)
            if level % 10 == 0 or level == self.level:
                label(self.screen, str(level), self.small, WHITE, rect.center)
        label(self.screen, "Click a level • 1–9 / 0 starts early levels • [ / ] moves one level", self.small, WHITE, (WIDTH // 2, 665))

    def draw_arrow(self, x, y, direction, color):
        # Four distinguishable arrow directions, all the same 36px height.
        if direction == 0: points = [(x, y - 18), (x + 16, y), (x + 7, y), (x + 7, y + 18), (x - 7, y + 18), (x - 7, y), (x - 16, y)]
        elif direction == 1: points = [(x - 18, y), (x, y - 16), (x, y - 7), (x + 18, y - 7), (x + 18, y + 7), (x, y + 7), (x, y + 16)]
        elif direction == 2: points = [(x, y + 18), (x + 16, y), (x + 7, y), (x + 7, y - 18), (x - 7, y - 18), (x - 7, y), (x - 16, y)]
        else: points = [(x + 18, y), (x, y - 16), (x, y - 7), (x - 18, y - 7), (x - 18, y + 7), (x, y + 7), (x, y + 16)]
        pygame.draw.polygon(self.screen, color, points)
        pygame.draw.polygon(self.screen, WHITE, points, 2)

    def draw_rhythm(self):
        self.screen.fill((9, 14, 34))
        for x in range(0, WIDTH, 100):
            pygame.draw.line(self.screen, (16, 27, 61), (x, 92), (x, HEIGHT), 1)
        pygame.draw.rect(self.screen, (15, 30, 66), (38, 104, 564, 560), border_radius=24)
        pygame.draw.rect(self.screen, (60, 20, 63), (678, 104, 564, 560), border_radius=24)
        label(self.screen, f"LEVEL {self.level:03} • {self.song_name}", self.big, GOLD, (WIDTH // 2, 35))
        label(self.screen, f"{self.bpm} BPM", self.small, MUTED, (WIDTH // 2, 70))
        for player, color, name in ((1, P1, "PLAYER 1 • WASD"), (2, P2, "PLAYER 2 • ARROWS")):
            label(self.screen, name, self.medium, color, (self.center(player), 135))
            for lane in range(4):
                x = self.lane_x(player, lane)
                pygame.draw.line(self.screen, (*color, 75), (x, 160), (x, TARGET_Y + BUCKET_HEIGHT // 2), 2)
                # Buckets are 90 px / 2.5 arrow heights exactly.
                bucket = pygame.Rect(x - 29, TARGET_Y - BUCKET_HEIGHT // 2, 58, BUCKET_HEIGHT)
                rounded(self.screen, bucket, (23, 38, 76), 10, color)
                label(self.screen, self.key_name(player, lane), self.medium, WHITE, bucket.center)
        for note in self.notes:
            if note.hit:
                continue
            remaining = note.due - self.song_time
            if remaining > TRAVEL_TIME or remaining < -0.25:
                continue
            self.draw_arrow(self.lane_x(note.player, note.lane), TARGET_Y - remaining / TRAVEL_TIME * 360, note.lane, P1 if note.player == 1 else P2)
        label(self.screen, f"TIMING {self.scores[1]}", self.small, P1, (self.center(1), 636))
        label(self.screen, f"TIMING {self.scores[2]}", self.small, P2, (self.center(2), 636))
        if self.song_time < 0:
            label(self.screen, str(max(1, math.ceil(-self.song_time))), font(82, True), GOLD, (WIDTH // 2, 358))
        if self.flash > 0:
            label(self.screen, "PERFECT!", self.medium, GOLD, (WIDTH // 2, 110))

    def draw_transition(self):
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 190))
        self.screen.blit(overlay, (0, 0))
        label(self.screen, self.result, self.big, RED, (WIDTH // 2, 285))
        label(self.screen, f"PLAYER {self.winner} gets the spam advantage!", self.medium, GOLD, (WIDTH // 2, 340))
        label(self.screen, "NEXT: RAPIDLY PRESS W (P1) OR ↑ (P2)", self.medium, WHITE, (WIDTH // 2, 395))

    def draw_spam(self):
        self.screen.fill((17, 13, 40))
        label(self.screen, "FINAL SPAM SHOWDOWN", self.title, GOLD, (WIDTH // 2, 75))
        label(self.screen, f"PLAYER {self.winner} WON PHASE ONE — stronger button pushes!", self.medium, WHITE, (WIDTH // 2, 120))
        label(self.screen, "P1 TAP W  →", self.big, P1, (220, 225))
        label(self.screen, "←  P2 TAP ↑", self.big, P2, (1060, 225))
        # The single bottom bar moves right with P1 W and left with P2 Up.
        bar = pygame.Rect(110, 570, WIDTH - 220, 64)
        rounded(self.screen, bar, (35, 39, 69), 18, WHITE)
        middle = bar.centerx
        marker = int(middle + self.spam_bar * (bar.w / 2 - 22))
        if marker >= middle:
            pygame.draw.rect(self.screen, P1, (middle, bar.y + 8, marker - middle, bar.h - 16), border_radius=12)
        else:
            pygame.draw.rect(self.screen, P2, (marker, bar.y + 8, middle - marker, bar.h - 16), border_radius=12)
        pygame.draw.line(self.screen, WHITE, (middle, bar.y - 10), (middle, bar.bottom + 10), 3)
        pygame.draw.circle(self.screen, GOLD, (marker, bar.centery), 21)
        label(self.screen, f"{max(0, self.spam_time):.1f} SECONDS", self.big, WHITE, (WIDTH // 2, 465))
        label(self.screen, "Push your colour all the way to your side!", self.small, MUTED, (WIDTH // 2, 515))

    def draw_result(self):
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 175))
        self.screen.blit(overlay, (0, 0))
        color = P1 if self.winner == 1 else P2
        label(self.screen, self.result, self.title, color, (WIDTH // 2, 287))
        label(self.screen, f"Player 1 timing: {self.scores[1]} • Player 2 timing: {self.scores[2]}", self.medium, WHITE, (WIDTH // 2, 344))
        label(self.screen, "Enter: next level   •   R: replay   •   Esc: level select", self.medium, GOLD, (WIDTH // 2, 408))

    def draw(self):
        if self.state == "select": self.draw_select()
        elif self.state == "spam": self.draw_spam()
        else:
            self.draw_rhythm()
            if self.state == "transition": self.draw_transition()
            elif self.state == "result": self.draw_result()
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
