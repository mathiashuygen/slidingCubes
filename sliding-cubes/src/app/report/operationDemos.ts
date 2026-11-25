import { type Box, type Cell, Configuration } from "@/engine";
import { firstCompactionOperation } from "@/solvers/peters";
import levels from "@/game/levels.json";

interface Demo {
	start: Cell[];
	box?: Box;
	operation: string;
	highlight: Cell[];
	pin?: Cell;
}

function levelDemo(id: string, operation: string, highlight: Cell[]): Demo {
	const level = levels["3d"].find((entry) => entry.id === id);
	if (!level) throw new Error(`Missing 3D example ${id}.`);
	return { start: level.start.map(([x, y, z]) => [x, y, z]), operation, highlight };
}

const demos = {
	a: () => levelDemo("paper-a", "a", [[1, 0, 3]]),
	b: () => levelDemo("paper-b", "b", [[0, 0, 1], [0, 0, 2]]),
	"b-unlock": () => levelDemo("paper-b-unlock", "b", [[0, 0, 3], [0, 0, 1], [0, 0, 2]]),
	c: () => levelDemo("paper-c", "c", [[0, 0, 2]]),
	"c-unlock": () => levelDemo("paper-c-unlock", "c", [[0, 0, 3], [0, 0, 2]]),
	d: () => levelDemo("paper-d", "d", [[0, 0, 1]]),
	"d-unlock": () => levelDemo("paper-d-unlock", "d", [[0, 0, 2], [0, 0, 1]]),
	e: () => levelDemo("zipper", "e", Array.from({ length: 10 }, (_, z): Cell => [3, 0, z])),
	f: () => levelDemo("drop", "f", [[1, 0, 1]]),
	g: (): Demo => ({
		start: [[1, 0, 2], [2, 0, 2], [3, 0, 2], [4, 0, 0], [1, 0, 1], [1, 0, 0],
			[0, 0, 0], [3, 0, 1], [3, 0, 0], [3, 1, 0], [4, 1, 0], [4, 0, 1]],
		operation: "g",
		highlight: [[3, 1, 0], [3, 0, 0], [4, 0, 0], [4, 1, 0]],
	}),
	h: (): Demo => ({
		start: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [0, 2, 2], [1, 2, 2], [2, 0, 0], [2, 2, 2], [3, 0, 0],
			[3, 2, 1], [3, 2, 2], [4, 0, 0], [4, 1, 0], [4, 2, 0], [4, 2, 1], [5, 0, 0]],
		box: { min: [0, 0, 0], max: [6, 2, 2] },
		operation: "h",
		highlight: [[2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0], [4, 1, 0], [4, 2, 0]],
	}),
	i: (): Demo => ({
		start: [[1, 0, 2], [2, 0, 2], [3, 0, 2], [1, 0, 1], [1, 0, 0], [0, 0, 0], [3, 0, 1], [3, 0, 0], [4, 0, 0]],
		operation: "i",
		highlight: [[3, 0, 0], [4, 0, 0]],
	}),
	"i-zipper": (): Demo => ({
		start: [[0, 1, 0], [1, 0, 9], [2, 0, 9], [3, 0, 0],
			...Array.from({ length: 10 }, (_, z): Cell => [0, 0, z]),
			...Array.from({ length: 9 }, (_, z): Cell => [2, 0, z])],
		operation: "i",
		highlight: [[2, 0, 0], [3, 0, 0]],
	}),
	j: (): Demo => ({
		start: [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [1, 2, 1], [2, 0, 0], [2, 1, 0], [2, 2, 0], [2, 2, 1], [3, 0, 0], [4, 0, 0]],
		operation: "j",
		highlight: [[2, 0, 0], [2, 1, 0], [3, 0, 0], [4, 0, 0]],
		pin: [2, 2, 0],
	}),
};

export type OperationDemoName = keyof typeof demos;
export const operationDemoNames = Object.keys(demos) as OperationDemoName[];

export function operationDemo(name: OperationDemoName) {
	const demo = demos[name]();
	const config = new Configuration(demo.start);
	const box = demo.box ?? config.boundingBox();
	const result = firstCompactionOperation(config, box);
	if (!result.name.startsWith(`[${demo.operation}] `)) {
		throw new Error(`Expected [${demo.operation}], but the solver selected ${result.name}.`);
	}
	return { ...demo, box, moves: result.moves, name: result.name };
}
