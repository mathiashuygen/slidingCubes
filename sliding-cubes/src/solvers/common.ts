import {
	type Cell,
	type Configuration,
	type Move,
	type Rules,
	applyMove,
	cellKey,
	checkMove,
	equals,
	isConnected,
	localDestinations,
} from "@/engine";

/** A stretch of the move list that belongs to one step of the algorithm. */
export interface Phase {
	name: string;
	/** Index of the first move in the phase. */
	start: number;
	/** Index one past the last move. */
	end: number;
}

export interface SolverOutput {
	moves: Move[];
	phases: Phase[];
}

/** Thrown when a solver reaches a case it does not handle, instead of producing bad moves. */
export class SolverError extends Error {
	override name = "SolverError";
}

/**
 * Applies a solver's moves to a working configuration, checking each one with
 * the rules engine and labelling it with the current phase.
 */
export class MoveRecorder {
	readonly moves: Move[] = [];
	readonly phases: Phase[] = [];
	private phase = "";

	constructor(
		readonly config: Configuration,
		readonly rules: Rules,
	) {}

	setPhase(name: string): void {
		this.phase = name;
	}

	apply(move: Move): void {
		const check = checkMove(this.config, move, this.rules);
		if (!check.legal) {
			const at = (c: Cell) => `(${c.join(", ")})`;
			throw new SolverError(
				`${this.phase || "Solver"}: move ${this.moves.length + 1} from ${at(move.from)} to ${at(move.to)} is illegal: ${check.message}`,
			);
		}
		applyMove(this.config, move);
		const index = this.moves.length;
		this.moves.push({ from: move.from, to: move.to });
		const last = this.phases[this.phases.length - 1];
		if (last && last.name === this.phase && last.end === index) last.end++;
		else this.phases.push({ name: this.phase, start: index, end: index + 1 });
	}

	applyAll(moves: readonly Move[]): void {
		for (const m of moves) this.apply(m);
	}

	/** Moves one module to `to` along a shortest legal path, or throws. */
	relocate(from: Cell, to: Cell): void {
		const path = modulePath(this.config, from, to, this.rules);
		if (!path) {
			throw new SolverError(`${this.phase || "Solver"}: no legal path from (${from.join(", ")}) to (${to.join(", ")}).`);
		}
		this.applyAll(path);
	}

	output(): SolverOutput {
		return { moves: this.moves, phases: this.phases };
	}
}

/**
 * Shortest sequence of moves that takes the single module at `from` to `to`
 * while every other module stays put. Returns null when `from` cannot move
 * without disconnecting the others, or `to` is unreachable.
 *
 * The other modules are fixed and stay connected, so each step only needs the
 * local geometry and the space constraint to be legal. The search is finite
 * because the module must stay adjacent to the others.
 */
export function modulePath(config: Configuration, from: Cell, to: Cell, rules: Rules, accept?: (cell: Cell) => boolean): Move[] | null {
	const reached = findPath(config, from, rules, accept ?? ((c) => equals(c, to)));
	return reached?.moves ?? null;
}

/**
 * Like modulePath, but stops at the nearest cell for which `accept` holds
 * (other than `from` itself). Returns the moves and the cell reached.
 */
export function findPath(
	config: Configuration,
	from: Cell,
	rules: Rules,
	accept: (cell: Cell, work: Configuration) => boolean,
): { moves: Move[]; cell: Cell } | null {
	if (!config.has(from) || !isConnected(config, from)) return null;
	const work = config.clone();
	work.delete(from);
	// The stationary modules never change, so no move can disconnect them.
	const noCut = { articulation: new Set<string>() };

	const parents = new Map<string, { prev: Cell; cell: Cell } | null>([[cellKey(from), null]]);
	const path = (cell: Cell) => {
		const moves: Move[] = [];
		for (let p = parents.get(cellKey(cell)); p; p = parents.get(cellKey(p.prev))) moves.push({ from: p.prev, to: p.cell });
		return moves.reverse();
	};

	let frontier = [from];
	while (frontier.length > 0) {
		const next: Cell[] = [];
		for (const pos of frontier) {
			work.add(pos);
			for (const target of localDestinations(pos, rules)) {
				const key = cellKey(target);
				if (parents.has(key) || work.has(target)) continue;
				if (!checkMove(work, { from: pos, to: target }, rules, noCut).legal) continue;
				parents.set(key, { prev: pos, cell: target });
				next.push(target);
			}
			work.delete(pos);
		}
		for (const cell of next) {
			if (accept(cell, work)) return { moves: path(cell), cell };
		}
		frontier = next;
	}
	return null;
}
