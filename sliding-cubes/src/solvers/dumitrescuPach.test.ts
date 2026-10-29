import { describe, expect, it } from "vitest";
import { type Cell, Configuration, biconnectedBlocks, matchesTarget, replay, rules2D } from "@/engine";
import { growShape, seededRandom } from "@/game/generator";
import { toConfiguration } from "@/game/levels";
import { MoveRecorder } from "./common";
import { relocateChain, solve2D, toChain } from "./dumitrescuPach";

const squares = (...cells: [number, number][]) => toConfiguration(cells);

describe("biconnected blocks", () => {
	it("splits a ring with a tail into a cycle block and a bridge", () => {
		const ring = squares([0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2], [3, 2]);
		const sizes = biconnectedBlocks(ring).map((b) => b.length).sort();
		expect(sizes).toEqual([2, 8]);
	});
});

describe("Dumitrescu–Pach chain construction", () => {
	it("turns shapes with cycles and holes into a horizontal chain east of the rightmost column", () => {
		const ring = squares([0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]);
		const { output, chain } = toChain(ring);
		const result = replay(ring, output.moves, rules2D);
		expect(result.ok).toBe(true);
		const expected = new Configuration(Array.from({ length: 8 }, (_, i): Cell => [chain.x + i, chain.y, 0]));
		expect(result.final.equals(expected)).toBe(true);
		expect(chain.x).toBe(2);
	});

	it("moves a leaf inside a hole until it has two neighbours (Step 1.B)", () => {
		const ring: [number, number][] = [];
		for (let i = 0; i < 4; i++) ring.push([i, 0], [4, i], [4 - i, 4], [0, 4 - i]);
		const start = squares(...ring, [1, 2]);
		const { output } = toChain(start);
		expect(output.phases.some((p) => p.name === "Step 1.B")).toBe(true);
		expect(replay(start, output.moves, rules2D).ok).toBe(true);
	});

	it("handles a cycle edge on an inner boundary (Step 2.B)", () => {
		// Found by random search: a hole closed off by squares touching at corners.
		const start = squares(
			[0, 0], [1, 0], [2, 0], [1, 1], [3, 0], [1, 2], [2, 2], [1, 3], [3, 2], [2, 3], [0, 3], [1, 4], [2, 4], [0, 4], [1, 5],
			[3, 4], [2, 5], [1, 6], [4, 4], [3, 5], [2, 6], [0, 6], [4, 5], [3, 6], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7], [7, 7],
			[6, 6], [7, 6], [7, 5], [7, 4], [7, 3], [6, 3], [5, 3], [6, 2], [5, 2], [6, 1], [5, 1], [7, 1], [4, 1], [5, 0],
		);
		const { output } = toChain(start);
		expect(output.phases.some((p) => p.name === "Step 2.B")).toBe(true);
		expect(replay(start, output.moves, rules2D).ok).toBe(true);
	});

	it("labels moves with the paper's steps", () => {
		const { output } = toChain(squares([0, 0], [1, 0], [0, 1], [1, 1], [0, 2]));
		const names = new Set(output.phases.map((p) => p.name));
		expect([...names].every((name) => /^Step (1\.A|1\.B|2\.A|2\.B)$/.test(name))).toBe(true);
	});
});

describe("chain relocation", () => {
	for (const [dx, dy] of [[3, 0], [-2, 0], [0, 2], [0, -3], [4, -2]]) {
		it(`shifts a chain by (${dx}, ${dy})`, () => {
			const chain = { x: 0, y: 0, length: 5 };
			const start = new Configuration(Array.from({ length: 5 }, (_, i): Cell => [i, 0, 0]));
			const recorder = new MoveRecorder(start.clone(), rules2D);
			relocateChain(recorder, chain, { x: dx, y: dy, length: 5 });
			const target = new Configuration(Array.from({ length: 5 }, (_, i): Cell => [dx + i, dy, 0]));
			expect(replay(start, recorder.moves, rules2D, matchesTarget(target)).ok).toBe(true);
		});
	}
});

describe("2D solver on random levels", () => {
	for (const size of [2, 3, 5, 8, 12, 18]) {
		it(`reconfigures random shapes of ${size} squares`, () => {
			const rand = seededRandom(size * 31);
			for (let trial = 0; trial < 8; trial++) {
				const start = growShape(size, rand);
				const target = growShape(size, rand);
				// Put the target somewhere else, so the chains need relocating.
				const shifted = new Configuration(target.toArray().map((c): Cell => [c[0] + 3, c[1] - 2, 0]));
				const { moves, phases } = solve2D(start, shifted);
				expect(replay(start, moves, rules2D, matchesTarget(shifted)).ok).toBe(true);
				expect(phases.at(-1)?.end ?? 0).toBe(moves.length);
				// The paper's bound: fewer than 2n³ moves per chain conversion, plus the relocation.
				expect(moves.length).toBeLessThan(4 * size ** 3 + 20 * size * size);
			}
		});
	}
});
