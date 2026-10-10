# Neon Number One — Music Battle

A local two-player rhythm game: keep the beat together to clear 20 progressively faster songs. Every falling note must be caught; one missed note makes **both players lose the level**. On a successful clear, the player with the most accurate timing wins the battle.

## Run it

All games use the shared root virtual environment at `.venv`.

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python music_battle.py
```

## Controls

| Player | Lanes |
| --- | --- |
| Player 1 / NUMBER ONE | `W` `A` `S` `D` |
| Player 2 / RIVAL | Arrow keys |

Choose a level with the mouse, or with number keys (`1`–`9`) and `0` for level 10. Use `[` / `]` to move through levels. Press `R` to restart a song and `Esc` to return to the level select screen.
