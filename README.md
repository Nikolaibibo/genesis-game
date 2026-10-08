# Genesis

A small 2D jump-and-run for the browser. You run through a neon level, jump over pits, spikes and bugs, crouch under low ceilings and laser bands, and try to reach the beacon before the 3-minute timer runs out.

The game was built in one pass from [`docs/specification.md`](docs/specification.md) as a demo of an AI-assisted coding workflow. It uses plain HTML5 canvas and vanilla JavaScript, with no game engine, no build step, no dependencies and no image files.

## Play

Open `genesis-game/index.html` in a desktop browser.

You can also serve the folder locally:

```sh
cd genesis-game
python -m http.server 8765
# open http://127.0.0.1:8765/
```

| Key | Action |
| --- | --- |
| `A` / `D` (or ← / →) | Move |
| `W` (or ↑) | Jump |
| `S` (or ↓) | Crouch (half height, half speed) |
| `Enter` / `Space` | Start |
| `P` / `Esc` | Pause |
| `R` | Restart |

## Project layout

```
genesis-game/
  index.html     canvas, HUD and the start / pause / end overlays
  style.css      neon theme for the overlays
  game.js        input, physics, level, rendering, game loop
docs/
  specification.md   the original spec
tools/
  playtest.js    headless bot that plays the level in Node
```

## How it works

- **Loop:** physics runs at a fixed timestep of 1/120 s. Rendering happens once per animation frame.
- **Collision:** AABB, resolved one axis at a time (first x, then y). Hazards use a slightly smaller hitbox so that near misses don't count as hits.
- **Jump feel:** you can still jump for 80 ms after running off an edge (coyote time). A jump pressed up to 100 ms before landing is remembered (jump buffer). Jump height is about 150 px.
- **Crouch:** the hero keeps its feet in place when crouching. It only stands up again when there is room above, so you can't get stuck in a ceiling.
- **Camera:** follows the hero smoothly and looks a bit ahead in the running direction.
- **Level:** one level, about 6,600 px long. Obstacles:
  - ceilings you can only crouch under
  - laser bands you can crouch under or jump over
  - spikes
  - blocks
  - pits
  - patrolling bugs, which are lethal and cannot be stomped
- **Best time:** stored in `localStorage`. If storage is blocked, the game still runs.
- **Debug:** the running game is exposed as `window.genesis` in the browser console.

## Playtest

```sh
node tools/playtest.js
```

This stubs the DOM, loads `game.js`, and lets a simple bot play the level with simulated key presses. It prints the result as JSON, for example:

```json
{"state":"over","win":"GOAL REACHED","elapsed":"26.3","jumps":12}
```

It is a quick check that the level is still finishable after you change it. It does not test rendering.

## Assumptions made where the spec was open

- The overlays use vanilla CSS, not Tailwind, so the game works offline without a CDN.
- The game has a single level.
- Bugs are lethal on any contact.
- Arrow keys, pause, restart, a progress bar and a best-time record were added on top of the spec.
