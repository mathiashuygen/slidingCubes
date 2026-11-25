import { describe, expect, it } from "vitest";
import { Configuration, equals, replay, rules3D } from "@/engine";
import { potential } from "@/solvers/peters";
import { operationDemo, operationDemoNames } from "./operationDemos";

describe("report operation animations", () => {
	for (const id of operationDemoNames) {
		it(`replays [${id}] legally and reduces the potential`, () => {
			const demo = operationDemo(id);
			const start = new Configuration(demo.start);
			const result = replay(start, demo.moves, rules3D(demo.box));
			expect(result.ok).toBe(true);
			expect(demo.moves.length).toBeGreaterThan(0);
			expect(potential(result.final, demo.box)).toBeLessThan(potential(start, demo.box));

			if (demo.pin) expect(demo.moves.some(({ from }) => equals(from, demo.pin!))).toBe(false);
			if (demo.operation === "i") {
				const floor = demo.box.min[2];
				expect(result.final.toArray().filter((c) => c[2] === floor).map(String).sort())
					.toEqual(demo.start.filter((c) => c[2] === floor).map(String).sort());
			}
			if (id === "e" || id === "i-zipper") expect(demo.name).toContain("zipper");
		});
	}
});
