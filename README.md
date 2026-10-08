# Genesis

A small 2D jump-and-run for the browser. Every run generates a new neon level. You run through it, jump over pits, spikes and bugs, crouch under low ceilings and laser bands, and try to reach the beacon before the 3-minute timer runs out.

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
| `R` | Restart the same level |

After a run, `Enter` starts a new level and `R` retries the current one.

Every level has a number (its seed), shown in the HUD and kept in the URL. Open `index.html?seed=4242` to play level #4242 again or send it to someone. Best times are stored per level.

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
- **Level generation:** each level is built from a seed (mulberry32 PRNG), so the same seed always gives the same level. The generator chains random chunks with one obstacle each, separated by flat runways, up to about 6,500 px. Each chunk is fair on its own. Difficulty rises along the level: pits and spike fields get wider, tunnels get longer, bugs get faster and runways get shorter. The first two chunks are always easy ones, and the same chunk never comes twice in a row. Chunk types:
  - pits
  - spikes and double spikes
  - blocks, some wide enough to run across
  - ceilings you can only crouch under
  - laser bands you can crouch under or jump over
  - patrolling bugs, which are lethal and cannot be stomped
  - stairs of floating platforms
- **Best time:** stored per seed in `localStorage`. If storage is blocked, the game still runs.
- **Debug:** the running game is exposed as `window.genesis` in the browser console.

## Playtest

```sh
node tools/playtest.js
```

This stubs the DOM, loads `game.js`, and lets a bot play generated levels with simulated key presses. The bot simulates the arc of a jump before it jumps over a bug, and it waits while a bug walks away, the way a human would.

```sh
node tools/playtest.js              # seeds 1-200, prints a summary and every failure
SEEDS=2000 node tools/playtest.js   # more seeds
node tools/playtest.js 4242         # one seed
TRACE=1 node tools/playtest.js 4242 # one seed, logs every jump
```

Current result: the bot finishes all of seeds 1 to 2,000, in 22 to 32 s per level.

Run it after every change to the generator or the physics. It checks that levels are finishable, not that they are fun, and it does not test rendering.

## Assumptions made where the spec was open

- The overlays use vanilla CSS, not Tailwind, so the game works offline without a CDN.
- Levels are generated rather than hand-built, so every run is different.
- Bugs are lethal on any contact.
- Arrow keys, pause, restart, a progress bar and a best-time record were added on top of the spec.
