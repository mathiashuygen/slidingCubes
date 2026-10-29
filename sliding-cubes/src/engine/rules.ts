import { type Axis, type Cell, equals } from "./cell";
import type { Box, Configuration } from "./configuration";

/** One module moving from one cell to another. Plain data, so it serializes to JSON. */
export interface Move {
	from: Cell;
	to: Cell;
}

/**
 * Limits where modules may be, separate from the local move geometry.
 * Both methods return a message for the player, or null when allowed.
 */
export interface SpaceConstraint {
	checkStart(config: Configuration): string | null;
	/** `config` is the state before `move`. */
	checkMove(config: Configuration, move: Move): string | null;
}

export interface Rules {
	mode: "2d" | "3d";
	/** Axes moves may use. Every move lies in a plane spanned by two of them. */
	axes: readonly Axis[];
	space: SpaceConstraint;
}

/** 2D (Dumitrescu–Pach): squares at z = 0 on an unbounded grid. */
export const rules2D: Rules = {
	mode: "2d",
	axes: [0, 1],
	space: {
		checkStart(config) {
			for (const c of config) if (c[2] !== 0) return "2D configurations must lie in the plane z = 0.";
			return null;
		},
		checkMove: () => null,
	},
};

function isInside(c: Cell, box: Box): boolean {
	return [0, 1, 2].every((i) => box.min[i] <= c[i] && c[i] <= box.max[i]);
}

/** Outside the box, but sharing a face with a cell inside it. */
function isFaceAdjacentExterior(c: Cell, box: Box): boolean {
	let outsideAxes = 0;
	for (let i = 0; i < 3; i++) {
		if (c[i] === box.min[i] - 1 || c[i] === box.max[i] + 1) outsideAxes++;
		else if (c[i] < box.min[i] || c[i] > box.max[i]) return false;
	}
	return outsideAxes === 1;
}

/**
 * The in-place restriction of Peters et al.: every cube stays in the box,
 * except at most one cube in an immediately face-adjacent exterior cell.
 * Returns a message when `cells` breaks it.
 */
export function inPlaceViolation(cells: Iterable<Cell>, box: Box): string | null {
	let outside = 0;
	for (const c of cells) {
		if (isInside(c, box)) continue;
		if (!isFaceAdjacentExterior(c, box)) {
			return "A cube may only leave the box into a cell that shares a face with it.";
		}
		outside++;
	}
	if (outside > 1) return "Only one cube at a time may be outside the box.";
	return null;
}

/** 3D (Peters et al.): cubes in `box`, under the in-place restriction. */
export function rules3D(box: Box): Rules {
	return {
		mode: "3d",
		axes: [0, 1, 2],
		space: {
			checkStart: (config) => inPlaceViolation(config, box),
			checkMove(config, move) {
				// Only the moving cube changes status, so check the state after the move.
				const after = config.toArray().filter((c) => !equals(c, move.from));
				after.push(move.to);
				return inPlaceViolation(after, box);
			},
		},
	};
}
