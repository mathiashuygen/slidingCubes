import { type Cell, type Move, Configuration } from "@/engine";

interface LevelBase {
	id: string;
	name: string;
	description: string;
	/** A verified solution, when known. Its length is the reference for scoring. */
	solution?: Move[];
	/** Whether `solution` is known to be shortest (found by BFS). */
	optimal?: boolean;
}

/** A 2D level: reach `target` from `start`. Cells are [x, y] pairs at z = 0. */
export interface Level2D extends LevelBase {
	mode: "2d";
	start: [number, number][];
	target: [number, number][];
}

/**
 * A 3D level: compact `start` into any downward-closed shape, inside the
 * bounding box of `start` (the in-place restriction of Peters et al.).
 */
export interface Level3D extends LevelBase {
	mode: "3d";
	start: [number, number, number][];
}

export type Level = Level2D | Level3D;

export function toConfiguration(cells: [number, number][] | [number, number, number][]): Configuration {
	return new Configuration(cells.map((c): Cell => [c[0], c[1], c[2] ?? 0]));
}

export const levels2D: Level2D[] = [
	{
		mode: "2d",
		id: "first-slide",
		name: "First slide",
		description: "Slide the top square along its two neighbours.",
		start: [[0, 0], [1, 0], [1, 1]],
		target: [[0, 0], [1, 0], [0, 1]],
	},
	{
		mode: "2d",
		id: "turn-corner",
		name: "Around the corner",
		description: "Rotate the end square around its neighbour.",
		start: [[0, 0], [1, 0], [2, 0]],
		target: [[0, 0], [1, 0], [1, 1]],
	},
	{
		mode: "2d",
		id: "stand-up",
		name: "Stand up",
		description: "Turn the horizontal chain into a vertical one.",
		start: [[0, 0], [1, 0], [2, 0], [3, 0]],
		target: [[0, 0], [0, 1], [0, 2], [0, 3]],
	},
	{
		mode: "2d",
		id: "plus",
		name: "Holding together",
		description: "The centre square cannot move while it holds the others together.",
		start: [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]],
		target: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
	},
	{
		mode: "2d",
		id: "ring",
		name: "Fill the hole",
		description: "Turn the ring around a hole into a solid block.",
		start: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
		target: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]],
	},
];

export const levels3D: Level3D[] = [
	{
		mode: "3d",
		id: "drop",
		name: "Drop it",
		description: "Slide the top cube down into the corner.",
		start: [[0, 0, 0], [1, 0, 0], [1, 0, 1]],
	},
	{
		mode: "3d",
		id: "arch",
		name: "Under the arch",
		description: "Fill the gap under the arch.",
		start: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [2, 0, 1], [2, 0, 0]],
	},
	{
		mode: "3d",
		id: "pillar",
		name: "Pillar",
		description: "Bring the pillar down towards the corner.",
		start: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 2]],
	},
	{
		mode: "3d",
		id: "two-layers",
		name: "Two layers",
		description: "Compact both layers into the corner. A cube may step just outside the box, but only one at a time.",
		start: [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 0, 1]],
	},
];

export const allLevels: Level[] = [...levels2D, ...levels3D];
