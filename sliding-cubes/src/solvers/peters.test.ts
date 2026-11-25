import { describe, expect, it } from "vitest";
import { type Cell, Configuration, applyMove, compactedInBox, equals, replay, rules3D, sub } from "@/engine";
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

	it("keeps the legal prefix when the thin bridge runs out of operations without the fallback", () => {
		const narrow = toConfiguration(levels3D.find((level) => level.id === "zipper-thin-bridge")!.start);
		expect(compact3D(narrow, undefined, true)).toMatchObject({ stopped: expect.any(String), moves: [] });

		const wide = toConfiguration(levels3D.find((level) => level.id === "zipper-thin-bridge-wide")!.start);
		const box = wide.boundingBox();
		const { moves, phases, stopped } = compact3D(wide, box, true);
		expect(stopped).toMatch(/No operation applies/);
		expect(phases.map((phase) => phase.name)).toEqual(["[e] long zipper shove"]);
		expect(moves).toHaveLength(51);
		expect(replay(wide, moves, rules3D(box)).ok).toBe(true);
	});

	it("labels every move with an operation of the paper", () => {
		const { phases } = check(toConfiguration(levels3D[2].start));
		for (const { name } of phases) expect(name).toMatch(/^\[[a-j]\] /);
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

	it("starts by bringing back a cube that is just outside the box (mid-game hints)", () => {
		const box = { min: [0, 0, 0] as Cell, max: [1, 0, 1] as Cell };
		const midGame = new Configuration([[0, 0, 0], [1, 0, 0], [1, 1, 0]]);
		const { moves, phases } = compact3D(midGame, box);
		expect(phases[0].name).toMatch(/^Bring the cube outside the box back in/);
		expect(replay(midGame, moves, rules3D(box), compactedInBox(box)).ok).toBe(true);
	});

	function bridge(width: number, height: number): Configuration {
		const cells: Cell[] = [];
		for (let z = 0; z <= height; z++) cells.push([0, 0, z], [width, 0, z]);
		for (let x = 1; x < width; x++) cells.push([x, 0, height], [x, 1, height]);
		return new Configuration(cells);
	}

	it("gathers under a height-one pillar and lowers its head in the same operation", () => {
		const start = bridge(5, 1);
		const { moves, phases } = check(start);
		const phase = phases.find((p) => p.name.startsWith("[h]"))!;
		const end = moves[phase.end - 1];
		expect(end.from[2]).toBe(1);
		expect(end.to[2]).toBe(0);
	});

	it("restores the floor after short and long clearing-pillar shoves", () => {
		for (const [height, variant] of [[4, "short"], [7, "zipper"]] as const) {
			const state = bridge(7, height);
			const { phases, moves } = check(state);
			const floor = () => state.toArray().filter((c) => c[2] === 0).map((c) => c.join(",")).sort();
			let observed = false;
			for (const phase of phases) {
				const before = floor();
				for (const move of moves.slice(phase.start, phase.end)) applyMove(state, move);
				if (phase.name.startsWith("[i]")) {
					expect(floor()).toEqual(before);
					if (phase.name.includes(variant)) observed = true;
				}
			}
			expect(observed).toBe(true);
		}
	});

	it("executes the tall zipper inside a bridge's original box", () => {
		const { phases } = check(bridge(7, 10));
		expect(phases.some((p) => p.name.startsWith("[e] long zipper shove"))).toBe(true);
	});

	it("applies [j] to a floor strip in the bottom-layer phase", () => {
		// The strip (4,0)–(5,0) hangs from (4,1); its rightmost cube moves to the left end of the floor row.
		const start = new Configuration([[1, 0, 0], [2, 0, 0], [2, 1, 0], [3, 1, 0], [4, 0, 0], [4, 1, 0], [5, 0, 0]]);
		const { phases, moves } = check(start);
		expect(phases[0].name).toMatch(/^\[j\] clear a low strip/);
		expect(moves[0].from).toEqual([5, 0, 0]);
		expect(moves[phases[0].end - 1].to).toEqual([3, 0, 0]);
	});

	it("shifts a big floor strip while keeping its attachment to the bridge fixed", () => {
		const pin: Cell = [2, 0, 0];
		const start = new Configuration([[0, 0, 0], pin, [3, 0, 0], [4, 0, 0],
			[0, 0, 1], [1, 0, 1], [2, 0, 1], [0, 1, 0]]);
		const { moves, phases } = check(start);
		expect(phases[0].name).toMatch(/^\[j\].*pinned/);
		for (const m of moves.slice(0, phases[0].end)) {
			expect(equals(m.from, pin)).toBe(false);
			expect(m.to[2]).toBe(0);
		}
	});

	it("applies [j] on a big strip whose only high component is the pinned cube's pillar (Lemma 11)", () => {
		// L = the x = 2 column plus (3,0,0) and (4,0,0); its only high component is the pillar on the pinned (2,2,0).
		const start = new Configuration([[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [1, 2, 1], [2, 2, 1],
			[2, 0, 0], [2, 1, 0], [2, 2, 0], [3, 0, 0], [4, 0, 0]]);
		const { phases } = check(start);
		expect(phases.some((p) => p.name.startsWith("[j] clear a low strip (2D, pinned"))).toBe(true);
	});

	it("chooses e again in [h] when the gathered square has covered it", () => {
		// The first e is (3,2,0), inside the 3×3 square around the cube under the pillar.
		check(new Configuration([[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [0, 2, 2], [1, 2, 2], [2, 2, 2], [3, 2, 2],
			[4, 2, 2], [5, 2, 2], [5, 2, 1], [2, 2, 0], [3, 2, 0], [4, 2, 0], [5, 2, 0], [6, 2, 0]]));
	});

	it("completes a planar unlock when the sideways step offsets the height reduction", () => {
		check(new Configuration([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 1, 0], [2, 2, 0],
			[2, 3, 0], [1, 3, 0], [0, 3, 0], [0, 4, 0]]));
	});

	it("falls back to the short shove when a long pillar at the wall of a thin box has no room for the zipper", () => {
		// One cube thick: the zipper's third column is outside the box or is the other leg.
		for (const [width, height] of [[2, 8], [3, 8], [3, 12]]) {
			const cells: Cell[] = [];
			for (let z = 0; z <= height; z++) cells.push([0, 0, z], [width, 0, z]);
			for (let x = 1; x < width; x++) cells.push([x, 0, height]);
			const { phases } = check(new Configuration(cells));
			expect(phases.some((p) => p.name.includes("no room for the zipper"))).toBe(true);
		}
	});

	it("replays a translated bridge under the same in-place constraints", () => {
		const start = bridge(7, 4);
		const shift: Cell = [13, -7, 4];
		const translated = new Configuration(start.toArray().map((c) => sub(c, shift)));
		expect(check(translated).moves.length).toBe(check(start).moves.length);
	});
});
