import { describe, expect, it } from "vitest";
import { type Cell, isConnected, replay } from "@/engine";
import { solveLevel } from "@/solvers";
import { shortestSolution } from "@/solvers/bfs";
import { formatMoves, gameReducer, initGame, parseMoves } from "./gameState";
import { levelToJson, levels2D, levels3D, parseLevel } from "./levels";

const at = (x: number, y: number): Cell => [x, y, 0];

describe("curated levels", () => {
	for (const level of [...levels2D, ...levels3D]) {
		it(`${level.mode} "${level.name}" is valid and its par is right`, () => {
			const state = initGame(level);
			expect(isConnected(state.start)).toBe(true);
			expect(state.goal.isReached(state.start)).toBe(false);
			if (level.mode === "3d") expect(state.rules.space.checkStart(state.start)).toBeNull();

			// The par must be what the paper solver and (where recorded) BFS find today.
			const solved = solveLevel(level);
			expect(replay(state.start, solved.moves, state.rules, state.goal).ok).toBe(true);
			expect(level.par?.solver).toBe(solved.moves.length);
			if (level.par?.shortest !== undefined) {
				expect(shortestSolution(state.start, state.goal, state.rules, 300_000)?.length).toBe(level.par.shortest);
			}
		});
	}

	it("gets harder: module counts never decrease along each list", () => {
		for (const list of [levels2D, levels3D]) {
			const sizes = list.map((l) => l.start.length);
			expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
		}
	});
});

describe("level files", () => {
	it("round-trips a level through JSON", () => {
		for (const level of [levels2D[4], levels3D[3]]) expect(parseLevel(JSON.parse(levelToJson(level)))).toEqual(level);
	});

	it("explains what is wrong with a bad level", () => {
		const bad = (data: object) => () => parseLevel(data);
		expect(bad({ mode: "4d", start: [] })).toThrow(/mode/);
		expect(bad({ mode: "2d", start: [[0, 0], [2, 0]], target: [[0, 0], [1, 0]] })).toThrow(/not connected/);
		expect(bad({ mode: "2d", start: [[0, 0], [1, 0]], target: [[0, 0], [1, 0], [2, 0]] })).toThrow(/same number/);
		expect(bad({ mode: "3d", start: [[0, 0], [1, 0]] })).toThrow(/3 integers/);
		expect(bad({ mode: "3d", start: [[0, 0, 0], [0, 0, 0]] })).toThrow(/twice/);
	});
});

describe("3D game", () => {
	it("compacts with a click and reports it", () => {
		let state = initGame(levels3D[0]);
		state = gameReducer(state, { type: "click", cell: [1, 0, 1] });
		state = gameReducer(state, { type: "click", cell: [0, 0, 1] });
		expect(state.feedback).toMatchObject({ tone: "success", message: "Compacted in 1 move. The paper's solver needs 1. Shortest possible: 1." });
	});
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
		expect(state.feedback).toMatchObject({ tone: "success", message: "Target reached in 1 move. The paper's solver needs 9. Shortest possible: 1." });
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
		expect(parseMoves(formatMoves(moves, "2d"))).toEqual(moves);
		const moves3D = [{ from: [0, 0, 1] as Cell, to: [1, 0, 0] as Cell }];
		expect(parseMoves(formatMoves(moves3D, "3d"))).toEqual(moves3D);
	});

	it("rejects malformed cells", () => {
		expect(() => parseMoves('[{"from": [1], "to": [0, 1]}]')).toThrow(/Move 1 "from"/);
		expect(() => parseMoves("{}")).toThrow(/array/);
	});
});
