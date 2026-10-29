import { describe, expect, it } from "vitest";
import { type Cell, applyMove, checkMove, legalMoves } from "@/engine";
import { initGame } from "@/game/gameState";
import { generateLevel2D, generateLevel3D, seededRandom } from "@/game/generator";
import { type Level, levels2D, levels3D } from "@/game/levels";
import { hintFor } from "./index";

/** Plays `steps` random legal moves from the level's start, staying inside the level's rules. */
function midGame(level: Level, steps: number, rand: () => number): Cell[] {
	const state = initGame(level);
	const config = state.start.clone();
	for (let i = 0; i < steps; i++) {
		const moves = legalMoves(config, state.rules);
		if (moves.length === 0) break;
		applyMove(config, moves[Math.floor(rand() * moves.length)]);
	}
	return config.toArray();
}

function expectLegalHint(level: Level, cells: Cell[]) {
	const hint = hintFor(level, cells);
	const state = initGame(level);
	const config = state.start.clone();
	for (const c of state.start) config.delete(c);
	for (const c of cells) config.add(c);
	if (hint.move) expect(checkMove(config, hint.move, state.rules).legal).toBe(true);
	return hint;
}

describe("hints", () => {
	it("gives a shortest first move on small levels", () => {
		const hint = hintFor(levels2D[0], initGame(levels2D[0]).start.toArray());
		expect(hint).toMatchObject({ source: "shortest", remaining: 1, move: { from: [1, 1, 0], to: [0, 1, 0] } });
	});

	it("says nothing is left once the level is solved", () => {
		const level = levels2D[0];
		expect(hintFor(level, level.target.map(([x, y]): Cell => [x, y, 0])).move).toBeNull();
	});

	it("reruns Dumitrescu–Pach from mid-game 2D positions", () => {
		const rand = seededRandom(3);
		for (let i = 0; i < 6; i++) {
			const level = generateLevel2D({ size: 12, scrambleMoves: 20, seed: i });
			const hint = expectLegalHint(level, midGame(level, 15, rand));
			expect(hint.source).toBe("solver");
		}
	});

	it("still gives a 3D hint while a cube is just outside the box", () => {
		// "Drop it", with the top cube rotated into the exterior cell at y = 1.
		const hint = expectLegalHint(levels3D[0], [[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
		expect(hint.move).not.toBeNull();
	});

	it("reruns compaction inside the original box from mid-game 3D positions", () => {
		const rand = seededRandom(4);
		for (const level of [...levels3D, ...[0, 1, 2].map((seed) => generateLevel3D({ size: 10, seed }))]) {
			expectLegalHint(level, midGame(level, 10, rand));
		}
	});
});
