# Sliding cubes and squares

A browser game and visualiser for reconfiguring modular robots in the sliding square (2D) and sliding cube (3D) models, built for the Computational Geometry project of Mathias Louis Huygen and Iliass Jdaoudi.

- **2D:** reach a target shape. Reference solver: Dumitrescu and Pach, *Pushing Squares Around* (Graphs and Combinatorics 22, 2006), Section 3.
- **3D:** compact the cubes into the corner of their bounding box, in place. Reference solver: Kostitsyna, Ophelders, Parada, Peters, Sonke and Speckmann, *Optimal In-Place Compaction of Sliding Cubes* (JoCG 16(1), 2025).

## Running

You need [Node.js](https://nodejs.org/) 24 or newer (it comes with `npm`). Check with `node -v`.

All commands are run from the `sliding-cubes/` folder (the one containing `package.json`), not the repository root.

### 1. Install the dependencies (once)

```bash
cd sliding-cubes
npm ci
```

`npm ci` installs the exact versions from `package-lock.json`. Run it again after pulling changes that touch `package.json`.

### 2. Start the app

```bash
npm run dev
```

Open <http://localhost:3000> in a browser. The page reloads by itself when you edit the code; stop the server with `Ctrl+C`. If port 3000 is taken, Next.js picks the next free one and prints it in the terminal.

### Other commands

```bash
npm test           # run the Vitest suite once: engine, solvers, levels, tutorial
npm run test:watch # rerun the tests on every change
npm run lint       # ESLint
npm run build      # build the static site into out/
```

### Serving the built site

The app is a static site with no backend (`output: "export"`), so `npm start` does not work. After `npm run build`, serve the `out/` folder with any static file server, for example:

```bash
python3 -m http.server 8000 --directory out
```

and open <http://localhost:8000>. The `out/` folder can also be put on any static host (GitHub Pages, Netlify, …) as is.

### With Docker

If you have Docker and no Node.js, run this in `sliding-cubes/`:

```bash
docker compose up
```

It builds the image, starts the dev server and serves it at <http://localhost:3001>.

## What is in the app

- **Tutorial:** nine short lessons: side/face adjacency, slides, convex transitions, blocked corners, squares that hold the others together, holes, 3D compaction and the in-place box rule. Each highlights the relevant 2×2 square.
- **Curated levels:** 11 in 2D and 9 in 3D, ordered by size, from `src/game/levels.json`.
- **Random levels:** seeded generator for both modes, with a verified reference solution.
- **Play:** click a module to see its legal destinations (slide or convex transition); illegal clicks explain why. Undo/redo, reset, move counter, score against the reference.
- **Hints:** the first move of a complete continuation, verified by replay before it is shown (see below).
- **Solution viewer:** run the paper solver (in a Web Worker), play/step through its moves, and jump between the algorithm's steps.
- **Move lists:** paste a JSON move list to replay and check it, or export your own moves.
- **Level files:** import, show or download a level as JSON.

## Architecture

```
src/engine      Rules engine, no React: cells, configurations, move legality with reasons,
                connectivity (articulation points, biconnected blocks), goals, replay
src/solvers     Dumitrescu–Pach (2D), Peters et al. (3D), BFS for small instances,
                hints, and the Web Worker that runs them
src/game        Game state (a move list with a cursor), levels and their JSON format,
                random generator, tutorial lessons
src/components  2D SVG board, 3D React Three Fiber board, the playground UI
```

Every move a solver produces goes through the same engine the player uses (`MoveRecorder` throws on the first illegal move), and tests replay every solution from the start to the goal.

### Rules

A move takes place in a 2×2 square of a coordinate plane: a **slide** moves a module one cell along two neighbours side by side; a **convex transition** rotates it around one neighbour, through an empty corner. The modules that stay must remain connected. In 3D, cubes stay in the bounding box of the start, except that at most one cube at a time may be in a cell sharing a face with the box (the journal version's definition of *in-place*). The 3D goal is a downward-closed shape from the box's minimum corner, with every cube back inside the box.

## The solvers

### 2D: Dumitrescu–Pach (`src/solvers/dumitrescuPach.ts`)

Builds a horizontal chain east of the rightmost column, one square per iteration (Steps 1.A, 1.B, 2.A, 2.B with maximal cycles, connectors, critical pairs and the measure Φ = q − y). Both start and target are turned into chains; the start's chain is moved onto the target's, and the target's moves are played backwards.

**Our addition:** moving one chain onto another is not in the paper. We shift it one column at a time (carrying the end square over the top) and one row at a time (moving squares into the next row from the far end).

### 3D: Peters et al. (`src/solvers/peters.ts`)

The solver compacts into a downward-closed subset of the original bounding box. It checks the paper’s operations [a]–[j] and replays each accepted sequence with the shared move engine. Every completed operation strictly decreases the weighted potential Π. Hints first bring an exterior cube back inside the original box when necessary.

- **Local reductions [a]–[g].** The solver checks non-cut subpillars and legal lowering moves. Long pillar shoves use the seven elementary moves in the Figure 3 zipper step for each additional level. The zipper can also run in the reflected orientation at a box wall. If neither orientation fits in the box (a tall pillar against the wall of a one-cube-thick box), the solver uses the short shove instead, labelled "not in the paper": it is legal and lowers Π, but takes quadratically many moves in the pillar's height.
- **Small clear floor components [h], [i].** The solver gathers floor cubes around the clearing pillar. It lowers the height-one head after gathering in [h]. For [i] it fills a short side column directly or builds a zipper, then restores the original floor occupancy.
- **Big floor components and strips [j].** The solver runs a planar subproblem on the selected component, pins the cube under its clearing pillar, and checks each proposed planar move against both the component and the surrounding 3D configuration. When the only high component of the planar run is the pillar through the pinned cube, [j] uses that pillar as its clearing pillar, as in the proof of Lemma 11; only [j]'s first case (rightmost cube to the left end) is used there, so the pillar never moves. In [h], if the gathered square covers the chosen empty cell e, e is chosen again by the same rule. The same planar operations finish the bottom layer. A one-cell-thick vertical box can use the corresponding vertical plane.

The planner uses shortest legal paths to route individual cubes to specified destinations and considers alternate placement orders for the bounded-size helper patterns. Those searches can affect planning time. The paper’s asymptotic bound concerns the number of elementary moves. Replay and the test suite check concrete inputs.

## Hints

- **2D:** a shortest continuation (BFS) up to 7 squares, otherwise Dumitrescu–Pach rerun from the current position to the target.
- **3D:** a shortest continuation up to 6 cubes, otherwise compaction rerun from the current position **inside the level's original box** and origin. The paper does not guarantee this for mid-game states (the open question in our proposal). Every continuation is replayed before its first move is shown; if verification fails, no hint is given.

## Level format

```json
{
	"mode": "2d",
	"id": "first-slide",
	"name": "First slide",
	"description": "Slide the top square along its two neighbours.",
	"start": [[0, 0], [1, 0], [1, 1]],
	"target": [[0, 0], [1, 0], [0, 1]],
	"par": { "solver": 9, "shortest": 1 }
}
```

3D levels use `[x, y, z]` cells and have no `target`; their box is the bounding box of `start`. `par` gives the paper solver's move count and, when BFS can find it, the shortest. The tests recompute every par, so `levels.json` cannot drift from the solvers.

## Measurements

From the test suite and experiments during development (seeded, reproducible):

- **2D solver:** no failures on over 4,000 random and hole-heavy shapes; all four steps occur. Compared with the shortest solutions, Dumitrescu–Pach is far from optimal on small levels, e.g. 71 vs 8 moves ("Snake") and 92 vs 14 ("Staircase").
- **3D solver:** The tests replay curated levels, seeded random shapes, and bridges that exercise the short shove, long zipper, helper restoration and pinned strip operations.
- **In-place exterior cell:** none of 919 random shapes of 3–6 cubes needed a cube outside the box to compact; the exterior cell seems to matter only for larger configurations.
- **3D mid-game hints:** from 300 positions (random levels of 5–16 cubes after 5–60 random moves), compaction inside the original box succeeded every time once an outside cube is first brought back in.
