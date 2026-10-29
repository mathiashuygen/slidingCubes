import { type Box, type Cell, type Configuration, type Move, compactedInBox, matchesTarget, replay, rules2D, rules3D } from "@/engine";
import { type Level, toConfiguration } from "@/game/levels";
import { shortestSolution } from "./bfs";
import { type SolverOutput, SolverError } from "./common";
import { solve2D } from "./dumitrescuPach";
import { compact3D } from "./peters";

export type { Phase, SolverOutput } from "./common";
export { SolverError } from "./common";

/** Runs the paper's solver for the level's mode: Dumitrescu–Pach in 2D, Peters et al. in 3D. */
export function solveLevel(level: Level): SolverOutput {
	return level.mode === "2d" ? solve2D(toConfiguration(level.start), toConfiguration(level.target)) : compact3D(toConfiguration(level.start));
}

/** Up to this many modules, a hint is the first move of a shortest solution (BFS). */
export const EXACT_HINT_LIMIT = { "2d": 7, "3d": 6 } as const;

export interface Hint {
	/** The suggested move, or null when the level is already solved. */
	move: Move | null;
	/** How many moves the verified continuation takes. */
	remaining: number;
	/** Where the continuation comes from. */
	source: "shortest" | "solver";
}

/**
 * A hint from the current configuration: the first move of a complete
 * continuation, verified by replay before it is shown. 2D reruns
 * Dumitrescu–Pach to the target. 3D reruns compaction inside the level's
 * original box, which the paper does not guarantee for mid-game states, so
 * it can fail; then there is no hint.
 */
export function hintFor(level: Level, cells: Cell[]): Hint {
	const current = toConfigurationFrom(cells);
	const start = toConfiguration(level.start);
	let rules, goal;
	let box: Box | null = null;
	if (level.mode === "2d") {
		rules = rules2D;
		goal = matchesTarget(toConfiguration(level.target));
	} else {
		box = start.boundingBox();
		rules = rules3D(box);
		goal = compactedInBox(box);
	}
	if (goal.isReached(current)) return { move: null, remaining: 0, source: "shortest" };

	let moves: Move[] | null = null;
	let source: Hint["source"] = "shortest";
	if (current.size <= EXACT_HINT_LIMIT[level.mode]) moves = shortestSolution(current, goal, rules);
	if (!moves) {
		source = "solver";
		moves = level.mode === "2d" ? solve2D(current, toConfiguration(level.target)).moves : compact3D(current, box!).moves;
	}
	const check = replay(current, moves, rules, goal);
	if (!check.ok) throw new SolverError(`The continuation failed verification: ${check.failure?.message}`);
	return { move: moves[0] ?? null, remaining: moves.length, source };
}

function toConfigurationFrom(cells: Cell[]): Configuration {
	return toConfiguration(cells.map((c): [number, number, number] => [c[0], c[1], c[2]]));
}

export type SolverRequest = { id: number; kind: "solve"; level: Level } | { id: number; kind: "hint"; level: Level; cells: Cell[] };

export type SolverResponse =
	| { id: number; ok: true; kind: "solve"; output: SolverOutput; ms: number }
	| { id: number; ok: true; kind: "hint"; hint: Hint; ms: number }
	| { id: number; ok: false; error: string };
