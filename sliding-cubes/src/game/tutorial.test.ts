import { describe, expect, it } from "vitest";
import { type Cell, articulationPoints, checkMove, isConnected, localDestinations } from "@/engine";
import { shortestSolution } from "@/solvers/bfs";
import { initGame } from "./gameState";
import { lessons } from "./tutorial";

const lesson = (title: string) => {
	const found = lessons.find((l) => l.title === title);
	if (!found) throw new Error(`No lesson "${title}"`);
	return initGame(found.level);
};

describe("tutorial", () => {
	for (const { title, level } of lessons) {
		it(`"${title}" is a valid, solvable level`, () => {
			const state = initGame(level);
			expect(isConnected(state.start)).toBe(true);
			expect(state.goal.isReached(state.start)).toBe(false);
			expect(shortestSolution(state.start, state.goal, state.rules)).not.toBeNull();
		});
	}

	// The lesson texts make specific claims; check them.
	it("slides: two slides take the top square to the left end", () => {
		const state = lesson("Slides");
		expect(shortestSolution(state.start, state.goal, state.rules)).toHaveLength(2);
	});

	it("blocked corners: the diagonal move is blocked, and two moves solve it", () => {
		const state = lesson("Blocked corners");
		const check = checkMove(state.start, { from: [0, 1, 0], to: [1, 0, 0] }, state.rules);
		expect(check).toMatchObject({ legal: false, reason: "blocked-clearance" });
		expect(shortestSolution(state.start, state.goal, state.rules)).toHaveLength(2);
	});

	it("holding together: the centre square is an articulation point", () => {
		const state = lesson("Squares that hold the others together");
		expect(articulationPoints(state.start).has("1,1,0")).toBe(true);
	});

	it("the box: one cube may step outside, a second is refused", () => {
		const state = lesson("The box");
		// Box x 0..1, y 0..1, z 0..2: the top cube rotates out to y = 2.
		const config = state.start.clone();
		const out: Cell = [1, 2, 1];
		expect(checkMove(config, { from: [1, 1, 2], to: out }, state.rules).legal).toBe(true);
		config.delete([1, 1, 2]);
		config.add(out);
		const outsideMoves = config
			.toArray()
			.flatMap((from) => localDestinations(from, state.rules).map((to) => checkMove(config, { from, to }, state.rules)));
		expect(outsideMoves.some((c) => !c.legal && c.reason === "outside-space")).toBe(true);
	});
});
