import { describe, expect, it } from "vitest";
import { type Cell, isConnected, matchesTarget, replay, rules2D } from "@/engine";
import { shortestSolution } from "@/solvers/bfs";
import { formatMoves, gameReducer, initGame, parseMoves } from "./gameState";
import { levels2D, toConfiguration } from "./levels";

const at = (x: number, y: number): Cell => [x, y, 0];

describe("2D levels", () => {
	for (const level of levels2D) {
		it(`${level.name} is valid and solvable`, () => {
			const start = toConfiguration(level.start);
			const target = toConfiguration(level.target);
			expect(start.size).toBe(target.size);
			expect(isConnected(start)).toBe(true);
			expect(isConnected(target)).toBe(true);

			const solution = shortestSolution(start, matchesTarget(target), rules2D);
			expect(solution).not.toBeNull();
			expect(replay(start, solution!, rules2D, matchesTarget(target)).ok).toBe(true);
		});
	}
});

describe("game reducer", () => {
	// First slide: (0,0) (1,0) (1,1), target (0,0) (1,0) (0,1).
	const level = levels2D[0];

	it("selects a square, then moves it to a legal destination", () => {
		let state = gameReducer(initGame(level), { type: "click", cell: at(1, 1) });
		expect(state.selected).toEqual(at(1, 1));

		state = gameReducer(state, { type: "click", cell: at(0, 1) });
		expect(state.cursor).toBe(1);
		expect(state.selected).toBeNull();
		expect(state.feedback).toMatchObject({ tone: "success", message: "Target reached in 1 move." });
		expect(state.lastStep?.move).toEqual({ from: at(1, 1), to: at(0, 1) });
	});

	it("explains an illegal destination without moving", () => {
		let state = gameReducer(initGame(level), { type: "click", cell: at(1, 1) });
		state = gameReducer(state, { type: "click", cell: at(1, 2) });
		expect(state.cursor).toBe(0);
		expect(state.feedback).toMatchObject({ tone: "error" });
	});

	it("explains why a square holding the others cannot move", () => {
		const state = gameReducer(initGame(levels2D[3]), { type: "click", cell: at(1, 1) });
		expect(state.feedback?.message).toMatch(/holds the others together/);
	});

	it("undoes, redoes, and drops undone moves after a new move", () => {
		let state = initGame(levels2D[1]);
		state = gameReducer(state, { type: "click", cell: at(2, 0) });
		state = gameReducer(state, { type: "click", cell: at(1, 1) });
		state = gameReducer(state, { type: "undo" });
		expect(state.cursor).toBe(0);
		expect(state.config.equals(state.start)).toBe(true);
		expect(state.lastStep?.move).toEqual({ from: at(1, 1), to: at(2, 0) });

		state = gameReducer(state, { type: "redo" });
		expect(state.config.has(at(1, 1))).toBe(true);

		state = gameReducer(state, { type: "undo" });
		state = gameReducer(state, { type: "click", cell: at(2, 0) });
		state = gameReducer(state, { type: "click", cell: at(1, -1) });
		expect(state.moves).toEqual([{ from: at(2, 0), to: at(1, -1) }]);
	});

	it("loads a move list up to its first illegal move", () => {
		const moves = parseMoves('[{"from": [1, 1], "to": [0, 1]}, {"from": [0, 0], "to": [5, 5]}]');
		const state = gameReducer(initGame(level), { type: "load-moves", moves });
		expect(state.moves).toHaveLength(1);
		expect(state.cursor).toBe(0);
		expect(state.feedback?.message).toMatch(/^Move 2 is illegal/);

		const end = gameReducer(state, { type: "seek", cursor: 99 });
		expect(end.cursor).toBe(1);
		expect(end.feedback?.tone).toBe("success");
	});
});

describe("move list format", () => {
	it("round-trips through JSON", () => {
		const moves = [{ from: at(1, 1), to: at(0, 1) }, { from: at(0, 1), to: at(-1, 0) }];
		expect(parseMoves(formatMoves(moves))).toEqual(moves);
	});

	it("rejects malformed cells", () => {
		expect(() => parseMoves('[{"from": [1], "to": [0, 1]}]')).toThrow(/Move 1 "from"/);
		expect(() => parseMoves("{}")).toThrow(/array/);
	});
});
