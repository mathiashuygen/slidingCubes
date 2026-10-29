import { type Cell, type Move, Configuration } from "@/engine";

/** A 2D level: reach `target` from `start`. Cells are [x, y] pairs at z = 0. */
export interface Level2D {
	id: string;
	name: string;
	description: string;
	start: [number, number][];
	target: [number, number][];
	/** A verified solution, when known. Its length is the reference for scoring. */
	solution?: Move[];
	/** Whether `solution` is known to be shortest (found by BFS). */
	optimal?: boolean;
}

export function toConfiguration(cells: [number, number][]): Configuration {
	return new Configuration(cells.map(([x, y]): Cell => [x, y, 0]));
}

export const levels2D: Level2D[] = [
	{
		id: "first-slide",
		name: "First slide",
		description: "Slide the top square along its two neighbours.",
		start: [[0, 0], [1, 0], [1, 1]],
		target: [[0, 0], [1, 0], [0, 1]],
	},
	{
		id: "turn-corner",
		name: "Around the corner",
		description: "Rotate the end square around its neighbour.",
		start: [[0, 0], [1, 0], [2, 0]],
		target: [[0, 0], [1, 0], [1, 1]],
	},
	{
		id: "stand-up",
		name: "Stand up",
		description: "Turn the horizontal chain into a vertical one.",
		start: [[0, 0], [1, 0], [2, 0], [3, 0]],
		target: [[0, 0], [0, 1], [0, 2], [0, 3]],
	},
	{
		id: "plus",
		name: "Holding together",
		description: "The centre square cannot move while it holds the others together.",
		start: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
		target: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
	},
	{
		id: "ring",
		name: "Fill the hole",
		description: "Turn the ring around a hole into a solid block.",
		start: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
		target: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
	},
];
