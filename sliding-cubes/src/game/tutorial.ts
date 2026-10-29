import type { Cell } from "@/engine";
import type { Level } from "./levels";

/** One step of the guided tutorial: a small level with an explanation. */
export interface Lesson {
	title: string;
	/** Paragraphs shown above the board. */
	text: string[];
	level: Level;
	/** Cells to outline, usually the 2×2 square a move happens in. */
	focus?: Cell[];
}

const square = (x: number, y: number, z = 0): Cell[] => [
	[x, y, z],
	[x + 1, y, z],
	[x, y + 1, z],
	[x + 1, y + 1, z],
];

const level2D = (id: string, name: string, start: [number, number][], target: [number, number][]): Level => ({
	mode: "2d",
	id: `tutorial-${id}`,
	name,
	description: "",
	start,
	target,
});

const level3D = (id: string, name: string, start: [number, number, number][]): Level => ({
	mode: "3d",
	id: `tutorial-${id}`,
	name,
	description: "",
	start,
});

export const lessons: Lesson[] = [
	{
		title: "Squares and connections",
		text: [
			"Squares are connected when they share a side; touching at a corner does not count. After every move, the squares that did not move must still be connected.",
			"Your goal in 2D is the dashed target shape. Click the top square, then the blue dot.",
		],
		level: level2D("connections", "Squares and connections", [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 0], [0, 1]]),
	},
	{
		title: "Slides",
		text: [
			"A slide moves a square one cell along two neighbours that lie side by side, like a drawer on rails. Every move happens inside one 2×2 square, outlined here.",
			"Hover a blue dot to see the two neighbours (amber) the slide runs along. Slide the top square to the left end in two moves.",
		],
		level: level2D("slides", "Slides", [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 0], [1, 0], [2, 0], [0, 1]]),
		focus: square(1, 0),
	},
	{
		title: "Convex transitions",
		text: [
			"A convex transition rotates a square around one neighbour, diagonally to the other side of its 2×2 square. The corner it sweeps through (dashed when you hover) must be empty.",
			"Rotate the end square around its neighbour: click it, then the purple dot.",
		],
		level: level2D("convex", "Convex transitions", [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [1, 1]]),
		focus: square(1, 0),
	},
	{
		title: "Blocked corners",
		text: [
			"Try moving the top-left square diagonally to the empty bottom-right cell: both corners of the outlined square are occupied, so it cannot rotate through. The game explains why.",
			"Find another way: two slides do it.",
		],
		level: level2D("blocked", "Blocked corners", [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]]),
		focus: square(0, 0),
	},
	{
		title: "Squares that hold the others together",
		text: [
			"Click the centre square: it cannot move, because the others would fall apart without it. In graph terms it is an articulation point.",
			"Move the arms instead to straighten the plus into a line.",
		],
		level: level2D("holding", "Holding together", [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]),
		focus: [[1, 1, 0]],
	},
	{
		title: "Holes and cycles",
		text: [
			"Squares can enclose a hole. The ring is a cycle, so any single square of it can move without disconnecting the rest. Squares can move inside holes too.",
			"Turn the ring into a block. Stuck? The Hint button reruns the Dumitrescu–Pach algorithm from your position.",
		],
		level: level2D("holes", "Holes and cycles", [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1], [0, 2], [1, 2], [2, 2]], [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]]),
	},
	{
		title: "Cubes in 3D",
		text: [
			"Cubes are connected through faces, and move with the same slides and convex transitions, now in any of the three coordinate planes. Drag to orbit and scroll to zoom.",
			"In 3D there is no target shape: pack the cubes into the green corner of the box (the origin) so no cube has a gap below it, behind it or to its left. Slide the top cube into the corner.",
		],
		level: level3D("cubes", "Cubes in 3D", [[0, 0, 0], [1, 0, 0], [1, 0, 1]]),
		focus: square(0, 0).map(([x, y]): Cell => [x, 0, y]),
	},
	{
		title: "The box",
		text: [
			"Compaction happens in place: cubes stay inside the green box. One cube at a time may step just outside, into a cell that shares a face with the box. Try moving a cube out, then a second one: the game tells you why not.",
			"Small grey cubes are moves that are not allowed; click one to see the reason. Bring the pillar down.",
		],
		level: level3D("box", "The box", [[0, 0, 0], [1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 1, 2]]),
	},
	{
		title: "Any compact shape counts",
		text: [
			"Many shapes are compact: all that matters is that every cube is supported towards the origin. The Peters et al. algorithm guarantees a number of moves proportional to the sum of the cubes' coordinates.",
			"Compact both layers. Then continue with the 2D and 3D levels, or generate random ones.",
		],
		level: level3D("compact", "Any compact shape counts", [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 0, 1]]),
	},
];
