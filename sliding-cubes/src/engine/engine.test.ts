import { describe, expect, it } from "vitest";
import {
	type Cell,
	type Move,
	Configuration,
	applyMove,
	articulationPoints,
	cellKey,
	checkMove,
	downwardClosed,
	inPlaceViolation,
	inverse,
	isConnected,
	legalMoves,
	matchesTarget,
	replay,
	rules2D,
	rules3D,
} from "./index";

/** 2D configuration from [x, y] pairs. */
function squares(...cells: [number, number][]): Configuration {
	return new Configuration(cells.map(([x, y]): Cell => [x, y, 0]));
}

function move2D(from: [number, number], to: [number, number]): Move {
	return { from: [from[0], from[1], 0], to: [to[0], to[1], 0] };
}

describe("move geometry", () => {
	it("allows a slide along two neighbours", () => {
		const config = squares([1, 1], [0, 0], [1, 0]);
		const check = checkMove(config, move2D([1, 1], [0, 1]), rules2D);
		expect(check).toMatchObject({ legal: true, type: "slide", support: [[1, 0, 0], [0, 0, 0]] });
	});

	it("allows a convex transition around one neighbour", () => {
		const config = squares([0, 1], [1, 1]);
		const check = checkMove(config, move2D([0, 1], [1, 0]), rules2D);
		expect(check).toMatchObject({ legal: true, type: "convex", support: [[1, 1, 0]], clearance: [[0, 0, 0]] });
	});

	it("rejects a convex transition through an occupied corner", () => {
		const config = squares([0, 1], [1, 1], [0, 0]);
		expect(checkMove(config, move2D([0, 1], [1, 0]), rules2D)).toMatchObject({ legal: false, reason: "blocked-clearance" });
	});

	it("rejects a slide without two neighbours", () => {
		const config = squares([0, 0], [1, 0]);
		expect(checkMove(config, move2D([1, 0], [2, 0]), rules2D)).toMatchObject({ legal: false, reason: "no-support" });
	});

	it("rejects a convex transition with nothing to rotate around", () => {
		const config = squares([0, 0], [-1, 0]);
		expect(checkMove(config, move2D([0, 0], [1, 1]), rules2D)).toMatchObject({ legal: false, reason: "no-pivot" });
	});

	it("rejects occupied destinations, missing modules and long jumps", () => {
		const config = squares([0, 0], [1, 0], [2, 0]);
		expect(checkMove(config, move2D([0, 0], [1, 0]), rules2D)).toMatchObject({ reason: "destination-occupied" });
		expect(checkMove(config, move2D([5, 5], [5, 6]), rules2D)).toMatchObject({ reason: "no-module" });
		expect(checkMove(config, move2D([0, 0], [0, 2]), rules2D)).toMatchObject({ reason: "not-local" });
	});

	it("keeps 2D moves in the plane", () => {
		const config = squares([0, 0], [1, 0]);
		const check = checkMove(config, { from: [0, 0, 0], to: [1, 0, 1] }, rules2D);
		expect(check).toMatchObject({ legal: false, reason: "axis-not-allowed" });
	});

	it("rejects a geometrically valid move that disconnects the rest", () => {
		// Path (0,0)-(1,0)-(1,1)-(2,1): sliding (1,1) left strands (2,1).
		const config = squares([0, 0], [1, 0], [1, 1], [2, 1]);
		expect(checkMove(config, move2D([1, 1], [0, 1]), rules2D)).toMatchObject({ legal: false, reason: "disconnects" });
	});
});

describe("3D in-place restriction", () => {
	const box = { min: [0, 0, 0] as Cell, max: [2, 0, 0] as Cell };

	it("lets one cube step into a face-adjacent exterior cell", () => {
		const config = new Configuration([[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
		expect(checkMove(config, { from: [2, 0, 0], to: [1, 0, 1] }, rules3D(box))).toMatchObject({ legal: true, type: "convex" });
	});

	it("rejects a second cube outside the box", () => {
		const config = new Configuration([[0, 0, 1], [0, 0, 0], [1, 0, 0], [2, 0, 0]]);
		const check = checkMove(config, { from: [2, 0, 0], to: [1, 0, 1] }, rules3D(box));
		expect(check).toMatchObject({ legal: false, reason: "outside-space" });
	});

	it("only allows exterior cells that share a face with the box", () => {
		expect(inPlaceViolation([[3, 0, 0]], box)).toBeNull();
		expect(inPlaceViolation([[3, 0, 1]], box)).not.toBeNull();
		expect(inPlaceViolation([[4, 0, 0]], box)).not.toBeNull();
		expect(inPlaceViolation([[3, 0, 0], [-1, 0, 0]], box)).not.toBeNull();
	});
});

describe("connectivity", () => {
	it("finds articulation points of a path", () => {
		const config = squares([0, 0], [1, 0], [2, 0], [3, 0]);
		expect(articulationPoints(config)).toEqual(new Set(["1,0,0", "2,0,0"]));
	});

	it("finds none in a cycle", () => {
		expect(articulationPoints(squares([0, 0], [1, 0], [0, 1], [1, 1])).size).toBe(0);
	});

	it("handles a ring with a hole and a tail", () => {
		const ring = squares([0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2]);
		expect(articulationPoints(ring)).toEqual(new Set(["2,2,0"]));
	});

	it("does not overflow on a long chain", () => {
		const chain = new Configuration(Array.from({ length: 20_000 }, (_, x): Cell => [x, 0, 0]));
		expect(articulationPoints(chain).size).toBe(19_998);
	});
});

describe("legal move enumeration", () => {
	it("gives every corner of a 2×2 block two convex transitions", () => {
		const moves = legalMoves(squares([0, 0], [1, 0], [0, 1], [1, 1]), rules2D);
		expect(moves).toHaveLength(8);
		expect(moves.every((m) => m.check.type === "convex")).toBe(true);
	});
});

describe("replay", () => {
	const start = squares([0, 0], [1, 0], [1, 1]);

	it("accepts a legal sequence that reaches the target", () => {
		const moves = [move2D([1, 1], [0, 1])];
		const result = replay(start, moves, rules2D, matchesTarget(squares([0, 0], [1, 0], [0, 1])));
		expect(result).toMatchObject({ ok: true, movesApplied: 1 });
	});

	it("reports the first illegal move and leaves the start untouched", () => {
		const moves = [move2D([1, 1], [0, 1]), move2D([1, 0], [3, 0])];
		const result = replay(start, moves, rules2D);
		expect(result.failure).toMatchObject({ kind: "illegal-move", index: 1, reason: "not-local" });
		expect(result.movesApplied).toBe(1);
		expect(start.has([1, 1, 0])).toBe(true);
	});

	it("rejects a disconnected start", () => {
		const result = replay(squares([0, 0], [2, 0]), [], rules2D);
		expect(result.failure?.kind).toBe("invalid-start");
	});

	it("reports an unreached goal", () => {
		const result = replay(start, [], rules2D, matchesTarget(squares([0, 0], [1, 0], [2, 0])));
		expect(result.failure?.kind).toBe("goal-not-reached");
	});
});

describe("downward-closed goal", () => {
	const goal = downwardClosed([0, 0, 0]);

	it("accepts a staircase", () => {
		expect(goal.isReached(new Configuration([[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]]))).toBe(true);
	});

	it("rejects a floating cube", () => {
		expect(goal.isReached(new Configuration([[0, 0, 0], [1, 0, 0], [1, 0, 1]]))).toBe(false);
	});
});

/** Small seeded PRNG (mulberry32) so failures are reproducible. */
function random(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Grows a connected configuration by repeatedly adding a neighbour of a random module. */
function growConfiguration(size: number, dims: 2 | 3, rand: () => number): Configuration {
	const config = new Configuration([[0, 0, 0]]);
	const all: Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
	const directions = all.slice(0, dims * 2);
	while (config.size < size) {
		const cells = config.toArray();
		const c = cells[Math.floor(rand() * cells.length)];
		const d = directions[Math.floor(rand() * directions.length)];
		config.add([c[0] + d[0], c[1] + d[1], c[2] + d[2]]);
	}
	return config;
}

describe("random walks", () => {
	for (const dims of [2, 3] as const) {
		it(`stays connected and reversible in ${dims}D`, () => {
			const rand = random(dims);
			for (let trial = 0; trial < 20; trial++) {
				const config = growConfiguration(4 + Math.floor(rand() * 12), dims, rand);
				const rules = dims === 2 ? rules2D : rules3D(config.boundingBox());
				const start = config.clone();
				const played: Move[] = [];

				for (let step = 0; step < 40; step++) {
					const moves = legalMoves(config, rules);
					// Enumeration with precomputed articulation points must agree with the plain check.
					for (const m of moves) expect(checkMove(config, m, rules).legal).toBe(true);
					if (moves.length === 0) break;

					const move = moves[Math.floor(rand() * moves.length)];
					applyMove(config, move);
					played.push(move);
					expect(isConnected(config)).toBe(true);
					expect(checkMove(config, inverse(move), rules).legal).toBe(true);
				}

				expect(replay(start, played, rules).ok).toBe(true);
				const undone = played.map(inverse).reverse();
				expect(replay(config, undone, rules, matchesTarget(start)).ok).toBe(true);
			}
		});
	}

	it("enumerates exactly the moves checkMove accepts", () => {
		const rand = random(7);
		const config = growConfiguration(10, 2, rand);
		const listed = new Set(legalMoves(config, rules2D).map((m) => cellKey(m.from) + ">" + cellKey(m.to)));
		for (const from of config) {
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const to: Cell = [from[0] + dx, from[1] + dy, 0];
					const legal = checkMove(config, { from, to }, rules2D).legal;
					expect(listed.has(cellKey(from) + ">" + cellKey(to))).toBe(legal);
				}
			}
		}
	});
});
