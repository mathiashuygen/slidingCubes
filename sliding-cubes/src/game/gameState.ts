import {
	type Box,
	type Cell,
	type Configuration,
	type Goal,
	type Move,
	type Rules,
	applyMove,
	checkMove,
	compactedInBox,
	equals,
	inverse,
	isConnected,
	legalMovesFrom,
	matchesTarget,
	replay,
	rules2D,
	rules3D,
} from "@/engine";
import { type Level, toConfiguration } from "./levels";

export interface Feedback {
	tone: "error" | "info" | "success";
	message: string;
	/** Cells to highlight with the message. */
	cells: Cell[];
}

/**
 * The game as a move list with a cursor. Undo/redo and stepping through a
 * loaded solution are the same operation: moving the cursor.
 */
export interface GameState {
	level: Level;
	rules: Rules;
	goal: Goal;
	start: Configuration;
	/** The shape to match (2D only). */
	target: Configuration | null;
	/** The box cubes must stay in (3D only). */
	box: Box | null;
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
	| { type: "load-level"; level: Level }
	| { type: "load-moves"; moves: Move[] };

export function initGame(level: Level): GameState {
	const start = toConfiguration(level.start);
	const common = { level, start, config: start.clone(), moves: [], cursor: 0, selected: null, feedback: null, lastStep: null };
	if (level.mode === "2d") {
		const target = toConfiguration(level.target);
		return { ...common, rules: rules2D, goal: matchesTarget(target), target, box: null };
	}
	// Peters et al.: the box is the start's bounding box, and its minimum corner is the origin.
	const box = start.boundingBox();
	return { ...common, rules: rules3D(box), goal: compactedInBox(box), target: null, box };
}

/** "square" in 2D, "cube" in 3D. */
export function moduleNoun(state: GameState): string {
	return state.level.mode === "2d" ? "square" : "cube";
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
	if (!state.goal.isReached(config)) return null;
	const what = state.level.mode === "2d" ? "Target reached" : "Compacted";
	let message = `${what} in ${cursor} move${cursor === 1 ? "" : "s"}.`;
	const reference = state.level.solution?.length;
	if (reference !== undefined) message += ` ${state.level.optimal ? "Shortest possible" : "Reference solution"}: ${reference}.`;
	return { tone: "success", message, cells: [] };
}

function click(state: GameState, cell: Cell): GameState {
	const { config, selected, rules } = state;

	if (config.has(cell)) {
		if (selected && equals(selected, cell)) return { ...state, selected: null, feedback: null };
		let feedback: Feedback | null = null;
		if (legalMovesFrom(config, cell, rules).length === 0) {
			feedback = isConnected(config, cell)
				? { tone: "info", message: `This ${moduleNoun(state)} has no legal move right now.`, cells: [cell] }
				: { tone: "info", message: `This ${moduleNoun(state)} holds the others together, so it cannot move.`, cells: [cell] };
		}
		return { ...state, selected: cell, feedback };
	}

	if (!selected) return { ...state, feedback: null };

	const move = { from: selected, to: cell };
	const check = checkMove(config, move, rules);
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
			const result = replay(state.start, action.moves, state.rules);
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

/** Parses a JSON move list. Cells may be [x, y] (z = 0) or [x, y, z]. */
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

/** One move per line. 2D cells are written as [x, y], 3D cells as [x, y, z]. */
export function formatMoves(moves: Move[], mode: Level["mode"]): string {
	const cell = (c: Cell) => (mode === "2d" ? `[${c[0]}, ${c[1]}]` : `[${c[0]}, ${c[1]}, ${c[2]}]`);
	const lines = moves.map((m) => `  {"from": ${cell(m.from)}, "to": ${cell(m.to)}}`);
	return `[\n${lines.join(",\n")}\n]`;
}
