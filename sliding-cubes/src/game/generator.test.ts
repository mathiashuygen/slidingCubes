import { describe, expect, it } from "vitest";
import { isConnected, matchesTarget, replay, rules2D } from "@/engine";
import { initGame } from "./gameState";
import { generateLevel2D, generateLevel3D, growShape, seededRandom } from "./generator";
import { toConfiguration } from "./levels";

describe("random level generator", () => {
	it("grows connected shapes of the requested size", () => {
		const rand = seededRandom(1);
		for (const size of [1, 5, 20, 60]) {
			const shape = growShape(size, rand);
			expect(shape.size).toBe(size);
			expect(isConnected(shape)).toBe(true);
		}
	});

	it("gives the same level for the same seed", () => {
		const options = { size: 8, scrambleMoves: 12, seed: 42 };
		expect(generateLevel2D(options)).toEqual(generateLevel2D(options));
		expect(generateLevel2D({ ...options, seed: 43 }).target).not.toEqual(generateLevel2D(options).target);
	});

	for (const [size, scrambleMoves] of [[3, 4], [5, 8], [7, 12], [10, 20], [25, 60]]) {
		it(`produces solvable levels with ${size} squares`, () => {
			for (let seed = 0; seed < 10; seed++) {
				const level = generateLevel2D({ size, scrambleMoves, seed });
				const start = toConfiguration(level.start);
				const target = toConfiguration(level.target);

				expect(start.size).toBe(size);
				expect(target.size).toBe(size);
				expect(isConnected(start)).toBe(true);
				expect(isConnected(target)).toBe(true);
				expect(start.equals(target)).toBe(false);
				expect(replay(start, level.solution!, rules2D, matchesTarget(target)).ok).toBe(true);
				expect(level.optimal).toBe(size <= 7);
				expect(level.solution!.length).toBeLessThanOrEqual(scrambleMoves);
			}
		});
	}

	it("rejects levels that are too small", () => {
		expect(() => generateLevel2D({ size: 2, scrambleMoves: 5, seed: 0 })).toThrow();
		expect(() => generateLevel3D({ size: 2, seed: 0 })).toThrow();
	});
});

describe("random 3D level generator", () => {
	it("grows shapes that use all three dimensions", () => {
		const shape = growShape(30, seededRandom(5), 3);
		expect(shape.size).toBe(30);
		expect(isConnected(shape)).toBe(true);
		expect(shape.toArray().some((c) => c[2] !== 0)).toBe(true);
	});

	for (const size of [3, 4, 5, 6]) {
		it(`produces compactable levels with ${size} cubes and a shortest solution`, () => {
			for (let seed = 0; seed < 5; seed++) {
				const level = generateLevel3D({ size, seed });
				const state = initGame(level);
				expect(state.start.size).toBe(size);
				expect(state.box!.min).toEqual([0, 0, 0]);
				expect(isConnected(state.start)).toBe(true);
				expect(state.goal.isReached(state.start)).toBe(false);
				expect(level.optimal).toBe(true);
				expect(replay(state.start, level.solution!, state.rules, state.goal).ok).toBe(true);
			}
		});
	}

	it("gives larger levels a reference solution from the paper's solver", () => {
		const level = generateLevel3D({ size: 12, seed: 1 });
		const state = initGame(level);
		expect(level.optimal).toBe(false);
		expect(replay(state.start, level.solution!, state.rules, state.goal).ok).toBe(true);
		expect(generateLevel3D({ size: 12, seed: 1 })).toEqual(level);
	});
});
