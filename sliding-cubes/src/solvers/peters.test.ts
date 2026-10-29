import { describe, expect, it } from "vitest";
import { type Cell, Configuration, compactedInBox, replay, rules3D, sub } from "@/engine";
import { growShape, seededRandom } from "@/game/generator";
import { levels3D, toConfiguration } from "@/game/levels";
import { compact3D, potential } from "./peters";

function check(start: Configuration) {
	const box = start.boundingBox();
	const output = compact3D(start);
	expect(replay(start, output.moves, rules3D(box), compactedInBox(box)).ok).toBe(true);
	return output;
}

/** S(C): the coordinate sum the paper's O(S(C)) bound is stated in. */
const coordinateSum = (c: Configuration) => c.toArray().reduce((sum, [x, y, z]) => sum + x + y + z, 0);

describe("Peters et al. 3D compaction", () => {
	it("uses the paper's weights for the potential", () => {
		const box = { min: [0, 0, 0] as Cell, max: [3, 3, 3] as Cell };
		// w = 17, 16, 3, 2, 1 for z > 1, z = 1, then z = 0 with y > 1, y = 1, y = 0.
		const at = (c: Cell) => potential(new Configuration([c]), box);
		expect([at([1, 0, 2]), at([1, 0, 1]), at([1, 2, 0]), at([1, 1, 0]), at([1, 0, 0])]).toEqual([17 * 9, 16 * 5, 3 * 5, 2 * 3, 1]);
	});

	for (const level of levels3D) {
		it(`compacts the "${level.name}" level`, () => {
			check(toConfiguration(level.start));
		});
	}

	it("labels every move with an operation of the paper", () => {
		const { phases } = check(toConfiguration(levels3D[2].start));
		for (const { name } of phases) expect(name).toMatch(/^\[[a-h]\] |^Fallback/);
	});

	for (const size of [4, 8, 14, 22]) {
		it(`compacts random shapes of ${size} cubes in O(S(C)) moves`, () => {
			const rand = seededRandom(size * 7);
			for (let trial = 0; trial < (size > 15 ? 4 : 10); trial++) {
				let start = growShape(size, rand, 3);
				const { min } = start.boundingBox();
				start = new Configuration(start.toArray().map((c) => sub(c, min)));
				const { moves } = check(start);
				expect(moves.length).toBeLessThanOrEqual(2 * coordinateSum(start) + 10);
			}
		});
	}

	it("brings far-away floor cubes in under a bridge", () => {
		for (const [k, h] of [[5, 1], [7, 2], [7, 4]]) {
			const cells: Cell[] = [];
			for (let z = 0; z <= h; z++) cells.push([0, 0, z], [k, 0, z]);
			for (let x = 1; x < k; x++) cells.push([x, 0, h], [x, 1, h]);
			check(new Configuration(cells));
		}
	});
});
