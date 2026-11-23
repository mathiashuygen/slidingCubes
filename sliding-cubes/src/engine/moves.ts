import { type Axis, type Cell, add, cellKey, sub, unit, unitVectors } from "./cell";
import type { Configuration } from "./configuration";
import { articulationPoints, isConnected } from "./connectivity";
import type { Move, Rules } from "./rules";

export type MoveType = "slide" | "convex";

export type IllegalReason =
	| "no-module"
	| "destination-occupied"
	| "not-local"
	| "axis-not-allowed"
	| "no-support"
	| "no-pivot"
	| "blocked-clearance"
	| "disconnects"
	| "outside-space";

export interface LegalMove {
	legal: true;
	type: MoveType;
	/**
	 * The stationary modules the move relies on: the two neighbours a slide
	 * runs along, or the single neighbour a convex transition rotates around.
	 */
	support: Cell[];
	/** Cells that must be empty besides the destination (the corner a convex transition sweeps). */
	clearance: Cell[];
}

export interface IllegalMove {
	legal: false;
	reason: IllegalReason;
	/** Explanation for the player. */
	message: string;
	/** Cells that cause the problem, for highlighting. */
	cells: Cell[];
}

export type MoveCheck = LegalMove | IllegalMove;

function illegal(reason: IllegalReason, message: string, cells: Cell[] = []): IllegalMove {
	return { legal: false, reason, message, cells };
}

interface CheckOptions {
	/** Precomputed articulation points of `config`, to avoid a BFS per move. */
	articulation?: Set<string>;
}

/**
 * Checks one elementary move. Both move types live in a 2×2 square in a
 * coordinate plane, spanned by the move direction d and a perpendicular e:
 *
 * - slide: from → from + d, along occupied from + e and from + d + e.
 * - convex: from → from + d + e, rotating around one occupied corner of the
 *   square while the opposite corner (the clearance) is empty.
 *
 * In both cases the stationary modules must stay connected.
 */
export function checkMove(config: Configuration, move: Move, rules: Rules, options: CheckOptions = {}): MoveCheck {
	const { from, to } = move;
	if (!config.has(from)) return illegal("no-module", "There is no module to move here.", [from]);
	if (config.has(to)) return illegal("destination-occupied", "The destination is already occupied.", [to]);

	const diff = sub(to, from);
	const changed = ([0, 1, 2] as Axis[]).filter((a) => diff[a] !== 0);
	if (diff.some((d) => Math.abs(d) > 1) || changed.length === 0 || changed.length === 3) {
		return illegal("not-local", "A module can only move to a neighbouring cell or diagonally within a 2×2 square.", [to]);
	}
	if (changed.some((a) => !rules.axes.includes(a))) {
		return illegal("axis-not-allowed", "In 2D, modules can only move within the plane.", [to]);
	}

	let geometry: LegalMove;
	if (changed.length === 1) {
		const sides = unitVectors(rules.axes.filter((a) => a !== changed[0]));
		const side = sides.find((e) => config.has(add(from, e)) && config.has(add(to, e)));
		if (!side) {
			return illegal("no-support", "A slide needs two neighbours side by side to slide along.", [from, to]);
		}
		geometry = { legal: true, type: "slide", support: [add(from, side), add(to, side)], clearance: [] };
	} else {
		const [a, b] = changed.map((axis) => add(from, unit(axis, diff[axis] as 1 | -1)));
		const hasA = config.has(a);
		const hasB = config.has(b);
		if (hasA && hasB) {
			return illegal("blocked-clearance", "Both corners of the square are occupied, so the module cannot rotate through.", [a, b]);
		}
		if (!hasA && !hasB) {
			return illegal("no-pivot", "A convex transition needs a neighbour in the square to rotate around.", [a, b]);
		}
		geometry = { legal: true, type: "convex", support: [hasA ? a : b], clearance: [hasA ? b : a] };
	}

	const disconnects = options.articulation
		? options.articulation.has(cellKey(from))
		: !isConnected(config, from);
	if (disconnects) {
		return illegal("disconnects", "Moving this module would disconnect the others.", [from]);
	}

	const spaceProblem = rules.space.checkMove(config, move);
	if (spaceProblem) return illegal("outside-space", spaceProblem, [to]);

	return geometry;
}

/** Every cell a module could reach in one move (a slide or a convex transition), before legality checks. */
export function localDestinations(from: Cell, rules: Rules): Cell[] {
	const directions = unitVectors(rules.axes);
	const result = new Map<string, Cell>();
	for (const d of directions) {
		const slide = add(from, d);
		result.set(cellKey(slide), slide);
		for (const e of directions) {
			if (e.some((v, i) => v !== 0 && d[i] !== 0)) continue;
			const convex = add(slide, e);
			result.set(cellKey(convex), convex);
		}
	}
	return [...result.values()];
}

export interface CheckedMove extends Move {
	check: LegalMove;
}

/** Legal moves of the module at `from`, e.g. to highlight its destinations. */
export function legalMovesFrom(config: Configuration, from: Cell, rules: Rules, options: CheckOptions = {}): CheckedMove[] {
	const result: CheckedMove[] = [];
	for (const to of localDestinations(from, rules)) {
		const check = checkMove(config, { from, to }, rules, options);
		if (check.legal) result.push({ from, to, check });
	}
	return result;
}

/** All legal moves in `config`. Articulation points are computed once for the whole state. */
export function legalMoves(config: Configuration, rules: Rules): CheckedMove[] {
	const articulation = articulationPoints(config);
	return config
		.toArray()
		.filter((c) => !articulation.has(cellKey(c)))
		.flatMap((c) => legalMovesFrom(config, c, rules, { articulation }));
}

/** Applies a move in place, without checking it. */
export function applyMove(config: Configuration, move: Move): void {
	config.delete(move.from);
	config.add(move.to);
}

/** Every move is reversible: undo is the same move backwards. */
export function inverse(move: Move): Move {
	return { from: move.to, to: move.from };
}
