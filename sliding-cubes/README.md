# Sliding cubes and squares

A browser game and visualiser for reconfiguring modular robots in the sliding square (2D) and sliding cube (3D) models, built for the Computational Geometry project of Mathias Louis Huygen and Iliass Jdaoudi.

- **2D:** reach a target shape. Reference solver: Dumitrescu and Pach, *Pushing Squares Around* (Graphs and Combinatorics 22, 2006), Section 3.
- **3D:** compact the cubes into the corner of their bounding box, in place. Reference solver: Kostitsyna, Ophelders, Parada, Peters, Sonke and Speckmann, *Optimal In-Place Compaction of Sliding Cubes* (JoCG 16(1), 2025).

## Running

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # Vitest: engine, solvers, levels, tutorial
npm run build      # static site in out/ (no backend needed)
```

Or with Docker: `docker compose up` serves the dev server on port 3001.

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

Like the authors' implementation, repeatedly performs the first operation that applies: [a]–[d] local z-reductions on non-cut based subpillars, [e] pillar shoves, [f] potential-reducing moves, [g]–[h] on clear low components, then the same operations in 2D on the bottom layer. Every operation must strictly lower the potential Π (weights 17, 16, 3, 2, 1).

**Deviations, all labelled in the move list:**

- Operations [i] and [j] and the pinned-cube recursion on big low components are not implemented. When nothing implemented applies, a fallback moves one cube along a legal path to the reachable cell of lowest potential, and if that fails, a bounded search looks for any potential-reducing sequence. On random shapes the fallbacks never fire; on bridge-like shapes built to trigger these cases they do, and every instance still compacts.
- Pillar shoves use the short shove [e′] for every height, which takes O(|P|²) moves; the paper's linear "zipper" for |P| ≥ 9 is only shown in a figure and is not reconstructed.
- For hints from a mid-game state, a cube that is just outside the box is first brought back in.

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
- **3D solver:** 141 random shapes of 4–30 cubes compact without fallbacks in about 0.4–0.5 × S(C) moves, where S(C) = Σ(x + y + z), consistent with the O(S(C)) bound. On the curated levels it is close to optimal, e.g. 11 vs 10 moves ("Tower").
- **In-place exterior cell:** none of 919 random shapes of 3–6 cubes needed a cube outside the box to compact; the exterior cell seems to matter only for larger configurations.
- **3D mid-game hints:** from 300 positions (random levels of 5–16 cubes after 5–60 random moves), compaction inside the original box succeeded every time once an outside cube is first brought back in.
