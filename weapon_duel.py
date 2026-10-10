import math
import sys

import pygame


WIDTH, HEIGHT = 960, 600
FPS = 60
PLAYER_SIZE = 34
PLAYER_SPEED = 280
PROJECTILE_SPEED = 620
SHOT_COOLDOWN = 0.38
MAX_HEALTH = 5


class Player:
    def __init__(self, name, color, position, controls):
        self.name = name
        self.color = color
        self.position = pygame.Vector2(position)
        self.controls = controls
        self.facing = pygame.Vector2(1, 0)
        self.health = MAX_HEALTH
        self.cooldown = 0.0

    @property
    def rect(self):
        return pygame.Rect(
            round(self.position.x - PLAYER_SIZE / 2),
            round(self.position.y - PLAYER_SIZE / 2),
            PLAYER_SIZE,
            PLAYER_SIZE,
        )

    def update(self, keys, dt):
        movement = pygame.Vector2(
            int(keys[self.controls["right"]]) - int(keys[self.controls["left"]]),
            int(keys[self.controls["down"]]) - int(keys[self.controls["up"]]),
        )
        if movement.length_squared():
            movement = movement.normalize()
            self.facing = movement
            self.position += movement * PLAYER_SPEED * dt

        half = PLAYER_SIZE / 2
        self.position.x = max(half, min(WIDTH - half, self.position.x))
        self.position.y = max(half, min(HEIGHT - half, self.position.y))
        self.cooldown = max(0.0, self.cooldown - dt)

    def shoot(self):
        if self.cooldown > 0:
            return None
        self.cooldown = SHOT_COOLDOWN
        start = self.position + self.facing * (PLAYER_SIZE / 2 + 9)
        return Projectile(start, self.facing, self.color, self)

    def draw(self, screen):
        pygame.draw.rect(screen, self.color, self.rect, border_radius=7)
        tip = self.position + self.facing * 25
        pygame.draw.line(screen, (245, 245, 245), self.position, tip, 5)


class Projectile:
    def __init__(self, position, direction, color, owner):
        self.position = pygame.Vector2(position)
        self.velocity = pygame.Vector2(direction) * PROJECTILE_SPEED
        self.color = color
        self.owner = owner
        self.radius = 7

    def update(self, dt):
        self.position += self.velocity * dt

    def is_outside(self):
        return not pygame.Rect(0, 0, WIDTH, HEIGHT).inflate(40, 40).collidepoint(self.position)

    def draw(self, screen):
        pygame.draw.circle(screen, self.color, self.position, self.radius)
        pygame.draw.circle(screen, (255, 255, 255), self.position, self.radius, 2)


def new_round():
    wasd = Player(
        "WASD player",
        (55, 185, 255),
        (170, HEIGHT / 2),
        {"up": pygame.K_w, "down": pygame.K_s, "left": pygame.K_a, "right": pygame.K_d},
    )
    arrows = Player(
        "Arrow player",
        (255, 90, 80),
        (WIDTH - 170, HEIGHT / 2),
        {"up": pygame.K_UP, "down": pygame.K_DOWN, "left": pygame.K_LEFT, "right": pygame.K_RIGHT},
    )
    return [wasd, arrows], []


def draw_text(screen, font, text, color, center):
    image = font.render(text, True, color)
    screen.blit(image, image.get_rect(center=center))


def main():
    pygame.init()
    screen = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Weapon Duel")
    clock = pygame.time.Clock()
    font = pygame.font.Font(None, 32)
    title_font = pygame.font.Font(None, 54)

    players, projectiles = new_round()
    winner = None
    running = True

    while running:
        dt = clock.tick(FPS) / 1000
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_r and winner:
                    players, projectiles = new_round()
                    winner = None
                elif not winner:
                    if event.key == pygame.K_v:
                        shot = players[0].shoot()
                        if shot:
                            projectiles.append(shot)
                    elif event.key == pygame.K_SPACE:
                        shot = players[1].shoot()
                        if shot:
                            projectiles.append(shot)

        if not winner:
            keys = pygame.key.get_pressed()
            for player in players:
                player.update(keys, dt)

            remaining = []
            for projectile in projectiles:
                projectile.update(dt)
                hit = False
                for player in players:
                    if player is not projectile.owner and player.rect.collidepoint(projectile.position):
                        player.health -= 1
                        hit = True
                        if player.health <= 0:
                            winner = projectile.owner
                        break
                if not hit and not projectile.is_outside():
                    remaining.append(projectile)
            projectiles = remaining

        screen.fill((22, 27, 39))
        pygame.draw.rect(screen, (32, 40, 57), (24, 76, WIDTH - 48, HEIGHT - 100), border_radius=14)
        pygame.draw.line(screen, (68, 79, 100), (WIDTH / 2, 95), (WIDTH / 2, HEIGHT - 43), 2)

        for projectile in projectiles:
            projectile.draw(screen)
        for player in players:
            player.draw(screen)

        draw_text(screen, font, f"WASD + V   Health: {players[0].health}", players[0].color, (190, 35))
        draw_text(screen, font, f"Arrows + Space   Health: {players[1].health}", players[1].color, (WIDTH - 190, 35))
        draw_text(screen, font, "Move to aim. Hit your opponent 5 times.", (210, 215, 225), (WIDTH / 2, HEIGHT - 22))

        if winner:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((0, 0, 0, 150))
            screen.blit(overlay, (0, 0))
            draw_text(screen, title_font, f"{winner.name} wins!", winner.color, (WIDTH / 2, HEIGHT / 2 - 20))
            draw_text(screen, font, "Press R for a new round", (255, 255, 255), (WIDTH / 2, HEIGHT / 2 + 35))

        pygame.display.flip()

    pygame.quit()
    return 0


if __name__ == "__main__":
    sys.exit(main())
