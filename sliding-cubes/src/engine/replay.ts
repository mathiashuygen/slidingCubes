import type { Configuration } from "./configuration";
import { isConnected } from "./connectivity";
import type { Goal } from "./goals";
import { type IllegalReason, applyMove, checkMove } from "./moves";
import type { Move, Rules } from "./rules";

export type ReplayFailure =
	| { kind: "invalid-start"; message: string }
	| { kind: "illegal-move"; index: number; move: Move; reason: IllegalReason; message: string }
	| { kind: "goal-not-reached"; message: string };

export interface ReplayResult {
	ok: boolean;
	/** State after the last legal move. */
	final: Configuration;
	movesApplied: number;
	failure?: ReplayFailure;
}

/**
 * Replays `moves` from `start`, checking every intermediate state and, when
 * given, the goal at the end. Used to verify solver output and hints, and to
 * explain the first illegal move. Does not modify `start`.
 */
export function replay(start: Configuration, moves: readonly Move[], rules: Rules, goal?: Goal): ReplayResult {
	const config = start.clone();

	const startProblem = !isConnected(config)
		? "The start configuration is not connected."
		: rules.space.checkStart(config);
	if (startProblem) {
		return { ok: false, final: config, movesApplied: 0, failure: { kind: "invalid-start", message: startProblem } };
	}

	for (let index = 0; index < moves.length; index++) {
		const move = moves[index];
		const check = checkMove(config, move, rules);
		if (!check.legal) {
			return {
				ok: false,
				final: config,
				movesApplied: index,
				failure: { kind: "illegal-move", index, move, reason: check.reason, message: check.message },
			};
		}
		applyMove(config, move);
	}

	if (goal && !goal.isReached(config)) {
		return {
			ok: false,
			final: config,
			movesApplied: moves.length,
			failure: { kind: "goal-not-reached", message: `The moves end before the goal: ${goal.description}` },
		};
	}
	return { ok: true, final: config, movesApplied: moves.length };
}
