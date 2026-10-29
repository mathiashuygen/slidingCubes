import test from "node:test";
import assert from "node:assert/strict";
import {
  connected,
  legalMoves,
  applyMove,
  matchesTarget,
  same,
} from "./rules.ts";

test("side adjacency excludes diagonal contact", () => {
  assert.equal(
    connected([
      [0, 0],
      [1, 1],
    ]),
    false,
  );
  assert.equal(
    connected([
      [0, 0],
      [1, 0],
      [1, 1],
    ]),
    true,
  );
});
test("bridge squares cannot move", () =>
  assert.deepEqual(
    legalMoves(
      [
        [-1, 0],
        [0, 0],
        [1, 0],
      ],
      [0, 0],
    ),
    [],
  ));
test("slide needs both stationary supports", () => {
  const moves = legalMoves(
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [0, 1],
  );
  assert.ok(moves.some((m) => m.kind === "slide" && same(m.to, [1, 1])));
  assert.ok(
    !legalMoves(
      [
        [0, 0],
        [0, 1],
      ],
      [0, 1],
    ).some((m) => m.kind === "slide"),
  );
});
test("rotation requires empty destination and clearance", () => {
  assert.ok(
    legalMoves(
      [
        [0, 0],
        [1, 0],
      ],
      [1, 0],
    ).some((m) => same(m.to, [0, 1])),
  );
  assert.ok(
    !legalMoves(
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      [1, 0],
    ).some((m) => same(m.to, [0, 1])),
  );
});
test("moves preserve module count, connectivity, and are reversible", () => {
  const states = [
    [
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ],
  ];
  for (const state of states)
    for (const cell of state)
      for (const move of legalMoves(state, cell)) {
        const next = applyMove(state, move);
        assert.equal(next.length, state.length);
        assert.ok(connected(next));
        assert.ok(legalMoves(next, move.to).some((m) => same(m.to, move.from)));
      }
});
test("target matching is absolute and ignores module order", () => {
  assert.ok(
    matchesTarget(
      [
        [1, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [1, 0],
      ],
    ),
  );
  assert.ok(
    !matchesTarget(
      [
        [1, 0],
        [2, 0],
      ],
      [
        [0, 0],
        [1, 0],
      ],
    ),
  );
});
test("invalid moves are rejected", () =>
  assert.throws(() =>
    applyMove(
      [
        [0, 0],
        [1, 0],
      ],
      { from: [1, 0], to: [5, 5], kind: "slide" },
    ),
  ));

// Exhaustive breadth-first search is a small-level validation tool, not the paper solver.
test("every curated level has a legal solution within eight moves", async () => {
  const { levels } = await import("../levels/levels.ts");
  const signature = (cells) =>
    cells
      .map((c) => c.join(","))
      .sort()
      .join(";");
  for (const level of levels) {
    const queue = [{ cells: level.start, depth: 0 }];
    const seen = new Set([signature(level.start)]);
    let solved = false;
    for (let i = 0; i < queue.length; i++) {
      const { cells, depth } = queue[i];
      if (matchesTarget(cells, level.target)) {
        solved = true;
        break;
      }
      if (depth === 8) continue;
      for (const cell of cells)
        for (const move of legalMoves(cells, cell)) {
          const next = applyMove(cells, move),
            id = signature(next);
          if (!seen.has(id)) {
            seen.add(id);
            queue.push({ cells: next, depth: depth + 1 });
          }
        }
    }
    assert.ok(solved, level.name + " must be solvable");
  }
});
