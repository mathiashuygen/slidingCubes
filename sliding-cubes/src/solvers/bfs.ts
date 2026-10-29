import { type Goal, type Move, type Rules, Configuration, applyMove, legalMoves } from "@/engine";

/**
 * Shortest solution by breadth-first search over whole configurations.
 * Only feasible for a handful of modules; it is a testing and comparison
 * aid, not one of the paper-based solvers. Returns null when no solution is
 * found within `maxStates` explored states.
 */
export function shortestSolution(start: Configuration, goal: Goal, rules: Rules, maxStates = 50_000): Move[] | null {
	const parents = new Map<string, { prev: string; move: Move } | null>([[start.key(), null]]);
	let frontier = [{ config: start, key: start.key() }];

	while (frontier.length > 0 && parents.size <= maxStates) {
		const next: typeof frontier = [];
		for (const { config, key } of frontier) {
			if (goal.isReached(config)) {
				const moves: Move[] = [];
				for (let k = key, p = parents.get(k); p; k = p.prev, p = parents.get(k)) moves.push(p.move);
				return moves.reverse();
			}
			for (const { from, to } of legalMoves(config, rules)) {
				const after = config.clone();
				applyMove(after, { from, to });
				const afterKey = after.key();
				if (parents.has(afterKey)) continue;
				parents.set(afterKey, { prev: key, move: { from, to } });
				next.push({ config: after, key: afterKey });
			}
		}
		frontier = next;
	}
	return null;
}
