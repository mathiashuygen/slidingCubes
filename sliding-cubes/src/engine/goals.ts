import { type Cell, add, unit } from "./cell";
import type { Configuration } from "./configuration";

export interface Goal {
	description: string;
	isReached(config: Configuration): boolean;
}

/**
 * 3D goal: whenever (x, y, z) is occupied, so is every cell between `origin`
 * and it. Checking the three cells directly below, behind and left of each
 * cube is enough, because the condition then propagates to all of them.
 */
export function downwardClosed(origin: Cell): Goal {
	return {
		description: "Compact the cubes into a downward-closed shape.",
		isReached(config) {
			for (const c of config) {
				for (const axis of [0, 1, 2] as const) {
					if (c[axis] < origin[axis]) return false;
					if (c[axis] > origin[axis] && !config.has(add(c, unit(axis, -1)))) return false;
				}
			}
			return true;
		},
	};
}

/** 2D goal: exactly the cells of `target`, at the same position. */
export function matchesTarget(target: Configuration): Goal {
	return {
		description: "Reach the target shape.",
		isReached: (config) => config.equals(target),
	};
}
