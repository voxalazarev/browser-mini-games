# Skybound Duo Obby

A two-player cooperative 2D obstacle-course platformer with **210 levels**. Levels unlock in order, become longer and more demanding, and save your progress automatically.

## Start

```bash
source .venv/bin/activate
python -m pip install -r requirements.txt
python co_op_obby.py
```

## Controls

| Player | Move | Jump | Shoot |
| --- | --- | --- | --- |
| Blue / Player 1 | `A` / `D` | `W` | `V` |
| Pink / Player 2 | Left / Right arrows | Up arrow | Left or right `Ctrl` |

Reach the green portal with **both players**. Touching a spike, an enemy, or the void resets both players to the start. Enemies only appear in a handful of challenge levels; the focus is platforming. A better shared weapon unlocks after every ten cleared levels (including the Sky Sword at level 20).

Use `Esc` for the level map, `R` to restart, and `[` / `]` to move between unlocked levels on the map. Delete `co_op_obby_progress.json` to reset progression.
