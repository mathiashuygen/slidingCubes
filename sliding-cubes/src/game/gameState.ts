import {
	type Cell,
	type Configuration,
	type Move,
	applyMove,
	checkMove,
	equals,
	inverse,
	isConnected,
	legalMovesFrom,
	replay,
	rules2D,
} from "@/engine";
import { type Level2D, toConfiguration } from "./levels";

export interface Feedback {
	tone: "error" | "info" | "success";
	message: string;
	/** Cells to highlight with the message. */
	cells: Cell[];
}

/**
 * The 2D game as a move list with a cursor. Undo/redo and stepping through a
 * loaded solution are the same operation: moving the cursor.
 */
export interface GameState {
	level: Level2D;
	start: Configuration;
	target: Configuration;
	/** The configuration after `moves[0..cursor)`. */
	config: Configuration;
	moves: Move[];
	cursor: number;
	selected: Cell | null;
	feedback: Feedback | null;
	/** The move just performed (or undone, as its inverse), for animation. */
	lastStep: { move: Move; id: number } | null;
}

export type GameAction =
	| { type: "click"; cell: Cell }
	| { type: "deselect" }
	| { type: "undo" }
	| { type: "redo" }
	| { type: "seek"; cursor: number }
	| { type: "restart" }
	| { type: "load-level"; level: Level2D }
	| { type: "load-moves"; moves: Move[] };

export function initGame(level: Level2D): GameState {
	const start = toConfiguration(level.start);
	return {
		level,
		start,
		target: toConfiguration(level.target),
		config: start.clone(),
		moves: [],
		cursor: 0,
		selected: null,
		feedback: null,
		lastStep: null,
	};
}

function stepTo(state: GameState, cursor: number): GameState {
	cursor = Math.max(0, Math.min(cursor, state.moves.length));
	const config = state.config.clone();
	let step: Move | null = null;
	for (let i = state.cursor; i < cursor; i++) applyMove(config, (step = state.moves[i]));
	for (let i = state.cursor; i > cursor; i--) applyMove(config, (step = inverse(state.moves[i - 1])));
	const single = Math.abs(cursor - state.cursor) === 1;
	return {
		...state,
		config,
		cursor,
		selected: null,
		feedback: goalFeedback(state, config, cursor),
		lastStep: single && step ? { move: step, id: (state.lastStep?.id ?? 0) + 1 } : null,
	};
}

function goalFeedback(state: GameState, config: Configuration, cursor: number): Feedback | null {
	if (!config.equals(state.target)) return null;
	let message = `Target reached in ${cursor} move${cursor === 1 ? "" : "s"}.`;
	const reference = state.level.solution?.length;
	if (reference !== undefined) message += ` ${state.level.optimal ? "Shortest possible" : "Reference solution"}: ${reference}.`;
	return { tone: "success", message, cells: [] };
}

function click(state: GameState, cell: Cell): GameState {
	const { config, selected } = state;

	if (config.has(cell)) {
		if (selected && equals(selected, cell)) return { ...state, selected: null, feedback: null };
		let feedback: Feedback | null = null;
		if (legalMovesFrom(config, cell, rules2D).length === 0) {
			feedback = isConnected(config, cell)
				? { tone: "info", message: "This square has no legal move right now.", cells: [cell] }
				: { tone: "info", message: "This square holds the others together, so it cannot move.", cells: [cell] };
		}
		return { ...state, selected: cell, feedback };
	}

	if (!selected) return { ...state, feedback: null };

	const move = { from: selected, to: cell };
	const check = checkMove(config, move, rules2D);
	if (!check.legal) {
		return { ...state, feedback: { tone: "error", message: check.message, cells: check.cells } };
	}
	// A new move discards any undone moves after the cursor.
	return stepTo({ ...state, moves: [...state.moves.slice(0, state.cursor), move] }, state.cursor + 1);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
	switch (action.type) {
		case "click":
			return click(state, action.cell);
		case "deselect":
			return { ...state, selected: null, feedback: null };
		case "undo":
			return state.cursor > 0 ? stepTo(state, state.cursor - 1) : state;
		case "redo":
			return state.cursor < state.moves.length ? stepTo(state, state.cursor + 1) : state;
		case "seek":
			return stepTo(state, action.cursor);
		case "restart":
			return initGame(state.level);
		case "load-level":
			return initGame(action.level);
		case "load-moves": {
			// Keep the legal prefix, so the viewer can step up to the first bad move.
			const result = replay(state.start, action.moves, rules2D);
			const failure = result.failure?.kind === "illegal-move" ? result.failure : null;
			const moves = failure ? action.moves.slice(0, failure.index) : action.moves;
			const loaded = { ...initGame(state.level), moves };
			return {
				...loaded,
				feedback: failure
					? {
							tone: "error",
							message: `Move ${failure.index + 1} is illegal: ${failure.message} Loaded the ${moves.length} moves before it.`,
							cells: [failure.move.from, failure.move.to],
						}
					: { tone: "info", message: `Loaded ${moves.length} moves. Step through them with ▶ or the arrow keys.`, cells: [] },
			};
		}
	}
}

/** Parses a JSON move list. Cells may be [x, y] or [x, y, z]. */
export function parseMoves(text: string): Move[] {
	const data: unknown = JSON.parse(text);
	if (!Array.isArray(data)) throw new Error("Expected a JSON array of moves.");
	const cell = (value: unknown, where: string): Cell => {
		if (!Array.isArray(value) || (value.length !== 2 && value.length !== 3) || !value.every(Number.isInteger)) {
			throw new Error(`${where} must be [x, y] or [x, y, z] with integers.`);
		}
		return [value[0], value[1], value[2] ?? 0];
	};
	return data.map((m, i) => ({ from: cell(m?.from, `Move ${i + 1} "from"`), to: cell(m?.to, `Move ${i + 1} "to"`) }));
}

/** One move per line, with 2D cells as [x, y]. */
export function formatMoves(moves: Move[]): string {
	const lines = moves.map((m) => `  {"from": [${m.from[0]}, ${m.from[1]}], "to": [${m.to[0]}, ${m.to[1]}]}`);
	return `[\n${lines.join(",\n")}\n]`;
}
