import {
	type Box,
	type Cell,
	type Configuration,
	type Move,
	type Rules,
	applyMove,
	cellKey,
	checkMove,
	compactedInBox,
	faceNeighbors,
	isConnected,
	legalMoves,
	legalMovesFrom,
	rules3D,
} from "@/engine";
import { MoveRecorder, type SolverOutput, SolverError, findPath, modulePath } from "./common";

/**
 * 3D compaction after Kostitsyna, Ophelders, Parada, Peters, Sonke and
 * Speckmann, "Optimal In-Place Compaction of Sliding Cubes" (JoCG 16(1), 2025).
 *
 * Like the authors' implementation, we repeatedly look for the first
 * operation of the paper that applies anywhere and perform it: [a]–[h] in 3D,
 * then, as in the paper's final phase, the same operations in 2D on the
 * bottom layer with y in the role of z. Every operation is checked move by
 * move by the rules engine and must strictly lower the potential Π, which
 * guarantees termination. Coordinates are relative to the minimum corner of
 * `box` (by default the start's bounding box), which is also the box of the
 * in-place restriction. Hints pass the level's original box for a mid-game
 * state, which the paper's guarantee does not cover; replay checks the result.
 *
 * Not implemented from the paper: operation [i] (shoving a clearing pillar
 * with cubes gathered from a small low component), [j], and the pinned-cube
 * recursion on big low components. When nothing implemented applies, a
 * bounded search for any potential-reducing move sequence takes over, and
 * its moves are labelled as such.
 */
export function compact3D(start: Configuration, box: Box = start.boundingBox()): SolverOutput {
	if (!isConnected(start)) throw new SolverError("The start configuration must be connected.");
	const rules = rules3D(box);
	const outside = rules.space.checkStart(start);
	if (outside) throw new SolverError(outside);
	const goal = compactedInBox(box);
	const recorder = new MoveRecorder(start.clone(), rules);
	const frames = [frame3D(box, rules), frameBottomLayer(box, rules)];

	// A mid-game state (for hints) may have its one cube just outside the box;
	// the paper always starts inside, so first bring that cube back in.
	const outsider = recorder.config.toArray().find((c) => !inBox(c, box));
	if (outsider) {
		const back = findPath(recorder.config, outsider, rules, (cell) => inBox(cell, box));
		if (!back) throw new SolverError("The cube outside the box cannot get back in.");
		recorder.setPhase("Bring the cube outside the box back in (not in the paper)");
		recorder.applyAll(back.moves);
	}

	let current = potential(recorder.config, box);
	// Every operation lowers Π by at least one, so this bounds the number of operations.
	for (let operations = 0; !goal.isReached(recorder.config); operations++) {
		if (operations > current + 1) throw new SolverError("The potential stopped decreasing.");
		let op: Operation | null = null;
		for (const frame of frames) {
			op = nextOperation(recorder.config, frame);
			if (op) break;
		}
		op ??= singleCubeRelocation(recorder.config, box, rules) ?? fallback(recorder.config, box, rules);
		if (!op) throw new SolverError("No operation applies, but the cubes are not compacted yet.");
		recorder.setPhase(op.name);
		recorder.applyAll(op.moves);
		const after = potential(recorder.config, box);
		if (after >= current) throw new SolverError(`${op.name} did not lower the potential.`);
		current = after;
	}
	return recorder.output();
}

interface Operation {
	name: string;
	moves: Move[];
}

/** The paper's weighted potential Π, with coordinates relative to the box's minimum corner. */
export function potential(config: Configuration, box: Box): number {
	let total = 0;
	for (const c of config) total += cubePotential(c, box);
	return total;
}

function cubePotential(c: Cell, box: Box): number {
	const x = c[0] - box.min[0];
	const y = c[1] - box.min[1];
	const z = c[2] - box.min[2];
	const w = z > 1 ? 17 : z === 1 ? 16 : y > 1 ? 3 : y === 1 ? 2 : 1;
	return w * (x + 2 * y + 4 * z);
}

const inBox = (c: Cell, box: Box) => [0, 1, 2].every((i) => box.min[i] <= c[i] && c[i] <= box.max[i]);

/**
 * Where the operations act. Cells are addressed as (a, b, up): `up` is the
 * axis cubes are lowered along (z in 3D, y in the bottom-layer 2D phase), and
 * (a, b) the horizontal position. In 2D, b is fixed.
 */
interface Frame {
	label: string;
	/** Name of the axis cubes are lowered along. */
	upName: string;
	box: Box;
	rules: Rules;
	/** The lowest value of `up` inside the box. */
	floor: number;
	/** Horizontal neighbour offsets in (a, b). */
	sides: [number, number][];
	toCell(a: number, b: number, up: number): Cell;
	fromCell(c: Cell): [number, number, number];
	/** Whether a cube belongs to the part of the configuration this frame works on. */
	includes(c: Cell): boolean;
}

function frame3D(box: Box, rules: Rules): Frame {
	return {
		label: "",
		upName: "z",
		box,
		rules,
		floor: box.min[2],
		sides: [[1, 0], [-1, 0], [0, 1], [0, -1]],
		toCell: (a, b, up) => [a, b, up],
		fromCell: (c) => [c[0], c[1], c[2]],
		includes: () => true,
	};
}

/** The paper's final phase: the same operations on the bottom layer, with y as "up" and only x horizontal. */
function frameBottomLayer(box: Box, rules: Rules): Frame {
	const z = box.min[2];
	return {
		label: " (2D, bottom layer)",
		upName: "y",
		box,
		rules: { ...rules, axes: [0, 1] },
		floor: box.min[1],
		sides: [[1, 0], [-1, 0]],
		toCell: (a, _b, up) => [a, up, z],
		fromCell: (c) => [c[0], z, c[1]],
		includes: (c) => c[2] === z,
	};
}

/**
 * Plays `moves` on a copy of `config`. Returns null when a move is illegal or
 * the result does not lower Π or leaves a cube outside the box.
 */
function tryMoves(config: Configuration, moves: Move[], frame: Frame): Move[] | null {
	if (moves.length === 0) return null;
	const work = config.clone();
	for (const m of moves) {
		if (!checkMove(work, m, frame.rules).legal) return null;
		applyMove(work, m);
	}
	for (const c of work) if (!inBox(c, frame.box)) return null;
	return potential(work, frame.box) < potential(config, frame.box) ? moves : null;
}

interface Pillar {
	a: number;
	b: number;
	zb: number;
	zt: number;
}

/** Maximal runs of the frame's cubes along `up`. */
function pillars(config: Configuration, frame: Frame): Pillar[] {
	const columns = new Map<string, number[]>();
	for (const c of config) {
		if (!frame.includes(c)) continue;
		const [a, b, up] = frame.fromCell(c);
		const key = `${a},${b}`;
		(columns.get(key) ?? columns.set(key, []).get(key)!).push(up);
	}
	const result: Pillar[] = [];
	for (const [key, ups] of columns) {
		const [a, b] = key.split(",").map(Number);
		ups.sort((p, q) => p - q);
		let zb = ups[0];
		for (let i = 1; i <= ups.length; i++) {
			if (i === ups.length || ups[i] !== ups[i - 1] + 1) {
				result.push({ a, b, zb, zt: ups[i - 1] });
				zb = ups[i];
			}
		}
	}
	return result;
}

function column(frame: Frame, a: number, b: number, zb: number, zt: number): Cell[] {
	return Array.from({ length: zt - zb + 1 }, (_, i) => frame.toCell(a, b, zb + i));
}

/** Whether the configuration stays connected (or becomes empty) without `cells`. */
function connectedWithout(config: Configuration, cells: Cell[]): boolean {
	const removed = new Set(cells.map(cellKey));
	const rest = config.toArray().filter((c) => !removed.has(cellKey(c)));
	if (rest.length <= 1) return true;
	const seen = new Set([cellKey(rest[0])]);
	const queue = [rest[0]];
	while (queue.length > 0) {
		for (const n of faceNeighbors(queue.pop()!)) {
			const k = cellKey(n);
			if (config.has(n) && !removed.has(k) && !seen.has(k)) {
				seen.add(k);
				queue.push(n);
			}
		}
	}
	return seen.size === rest.length;
}

/** The paper's operations in order; the first that applies anywhere in the frame. */
function nextOperation(config: Configuration, frame: Frame): Operation | null {
	return localZReduction(config, frame) ?? localPotentialReduction(config, frame) ?? lowComponentOperation(config, frame);
}

interface Side {
	a: number;
	b: number;
	adjacent: Pillar[];
}

/**
 * [a]–[e] on non-cut based subpillars P = ⟨a, b, zb..t⟩ (the corollaries of
 * the paper only need based ones) and their adjacent pillars P'.
 */
function localZReduction(config: Configuration, frame: Frame): Operation | null {
	const all = pillars(config, frame);
	const byColumn = new Map<string, Pillar[]>();
	for (const p of all) (byColumn.get(`${p.a},${p.b}`) ?? byColumn.set(`${p.a},${p.b}`, []).get(`${p.a},${p.b}`)!).push(p);

	// Non-cut based subpillars: bottom parts of pillars whose removal keeps C connected.
	const subpillars: { a: number; b: number; zb: number; t: number }[] = [];
	for (const { a, b, zb, zt } of all) {
		for (let t = zb; t <= zt; t++) if (connectedWithout(config, column(frame, a, b, zb, t))) subpillars.push({ a, b, zb, t });
	}

	const cell = frame.toCell;
	for (const letter of ["a", "b", "c", "d", "e"] as const) {
		for (const { a, b, zb, t } of subpillars) {
			const sides: Side[] = frame.sides.map(([da, db]) => ({
				a: a + da,
				b: b + db,
				adjacent: (byColumn.get(`${a + da},${b + db}`) ?? []).filter((q) => q.zt >= zb && q.zb <= t),
			}));
			// Unlocking slides the head of P sideways first.
			const withUnlock = (s: Side, moves: Move[]) =>
				tryMoves(config, moves, frame) ?? tryMoves(config, [{ from: cell(a, b, t), to: cell(s.a, s.b, t) }, ...moves], frame);

			if (letter === "e") {
				const op = pillarShove(config, frame, a, b, zb, sides);
				if (op) return op;
				continue;
			}
			for (const s of sides) {
				if (s.adjacent.length === 0) continue;
				const top = s.adjacent.reduce((p, q) => (q.zt > p.zt ? q : p));
				const bottom = s.adjacent.reduce((p, q) => (q.zb < p.zb ? q : p));
				let moves: Move[] | null = null;

				if (letter === "a" && top.zt <= t - 2) {
					moves = tryMoves(config, [{ from: cell(a, b, t), to: cell(s.a, s.b, t - 1) }], frame);
				}
				if (letter === "b") {
					for (const q of s.adjacent) {
						if (q.zb <= zb) continue;
						moves = withUnlock(s, [
							{ from: cell(a, b, q.zb - 1), to: cell(s.a, s.b, q.zb - 1) },
							{ from: cell(a, b, q.zb), to: cell(a, b, q.zb - 1) },
						]);
						if (moves) break;
					}
				}
				if (letter === "c" && bottom.zb < zb) {
					moves = withUnlock(s, [{ from: cell(a, b, zb), to: cell(a, b, zb - 1) }]);
				}
				if (letter === "d" && bottom.zb === zb && zb > frame.floor) {
					moves = withUnlock(s, [{ from: cell(a, b, zb), to: cell(s.a, s.b, zb - 1) }]);
				}
				if (moves) return { name: `[${letter}] local ${frame.upName}-reduction${frame.label}`, moves };
			}
		}
	}
	return null;
}

/**
 * [e]: P has at most one adjacent pillar per side, P' is the adjacent pillar
 * with the lowest bottom above zb, and some other side is empty at zb. Then
 * ⟨a, b, zb..z'b⟩ is shoved towards P'.
 */
function pillarShove(config: Configuration, frame: Frame, a: number, b: number, zb: number, sides: Side[]): Operation | null {
	if (sides.some((s) => s.adjacent.length > 1)) return null;
	const higher = sides.filter((s) => s.adjacent.length === 1 && s.adjacent[0].zb > zb);
	if (higher.length === 0) return null;
	const target = higher.reduce((p, q) => (q.adjacent[0].zb < p.adjacent[0].zb ? q : p));
	if (!sides.some((s) => s !== target && !config.has(frame.toCell(s.a, s.b, zb)))) return null;
	const moves = shoveMoves(config, frame, a, b, zb, target.adjacent[0].zb, target);
	return moves && tryMoves(config, moves, frame) ? { name: `[e] pillar shove${frame.label}`, moves } : null;
}

/**
 * A pillar shove: the support of ⟨a, b, zb..zt⟩ moves to the side column
 * (s.a, s.b, zb..zt − 1) and the head ends at (a, b, zb).
 *
 * We build the side column from the top down, each time moving the lowest
 * cube of the pillar that can get there along a shortest legal path. This is
 * the paper's short pillar shove [e′]; it takes O(|P|²) moves, whereas the
 * paper's long shove uses a linear "zipper" gadget for |P| ≥ 9.
 */
function shoveMoves(config: Configuration, frame: Frame, a: number, b: number, zb: number, zt: number, s: { a: number; b: number }): Move[] | null {
	const work = config.clone();
	const moves: Move[] = [];
	const perform = (path: Move[]) => {
		for (const m of path) applyMove(work, m);
		moves.push(...path);
	};

	for (let z = zt - 1; z >= zb; z--) {
		const destination = frame.toCell(s.a, s.b, z);
		if (work.has(destination)) return null;
		const path = column(frame, a, b, zb, zt)
			.filter((c) => work.has(c))
			.map((mover) => modulePath(work, mover, destination, frame.rules))
			.find((p) => p);
		if (!path) return null;
		perform(path);
	}
	const head = frame.toCell(a, b, zb);
	if (!work.has(head)) {
		const rest = column(frame, a, b, zb, zt).find((c) => work.has(c));
		const path = rest && modulePath(work, rest, head, frame.rules);
		if (!path) return null;
		perform(path);
	}
	return moves;
}

/** [f]: the move of a frame cube above the floor that lowers Π the most, keeping it inside the box. */
function localPotentialReduction(config: Configuration, frame: Frame): Operation | null {
	const high = config.toArray().filter((c) => frame.includes(c) && frame.fromCell(c)[2] > frame.floor);
	const move = bestReducingMove(config, frame, high);
	return move && { name: `[f] local potential reduction${frame.label}`, moves: [move] };
}

function bestReducingMove(config: Configuration, frame: Frame, cubes: Cell[]): Move | null {
	let best: Move | null = null;
	let bestGain = 0;
	for (const c of cubes) {
		for (const m of legalMovesFrom(config, c, frame.rules)) {
			if (!inBox(m.to, frame.box)) continue;
			const gain = cubePotential(c, frame.box) - cubePotential(m.to, frame.box);
			if (gain > bestGain) {
				bestGain = gain;
				best = { from: m.from, to: m.to };
			}
		}
	}
	return best;
}

/** Connected components of `cells` (face adjacency within the set). */
function components(cells: Cell[]): Cell[][] {
	const keys = new Map(cells.map((c) => [cellKey(c), c]));
	const seen = new Set<string>();
	const result: Cell[][] = [];
	for (const c of cells) {
		if (seen.has(cellKey(c))) continue;
		const comp = [c];
		seen.add(cellKey(c));
		for (let i = 0; i < comp.length; i++) {
			for (const n of faceNeighbors(comp[i])) {
				const k = cellKey(n);
				if (keys.has(k) && !seen.has(k)) {
					seen.add(k);
					comp.push(keys.get(k)!);
				}
			}
		}
		result.push(comp);
	}
	return result;
}

/**
 * [g] and [h] on clear low components: components L of the frame's floor,
 * other than the root, such that C \ L is connected and L touches a non-cut
 * pillar P of C \ L (the clearing pillar).
 */
function lowComponentOperation(config: Configuration, frame: Frame): Operation | null {
	const lows = components(config.toArray().filter((c) => frame.includes(c) && frame.fromCell(c)[2] === frame.floor));
	if (lows.length === 0) return null;
	const { min } = frame.box;
	const originKey = cellKey(min);
	// Root: the low component at the origin, or else the one closest to it.
	const distance = (l: Cell[]) => Math.min(...l.map((c) => c[0] - min[0] + c[1] - min[1] + c[2] - min[2]));
	const root = lows.find((l) => l.some((c) => cellKey(c) === originKey)) ?? lows.reduce((p, q) => (distance(q) < distance(p) ? q : p));

	for (const low of lows) {
		if (low === root || !connectedWithout(config, low)) continue;
		const pillar = clearingPillar(config, frame, low);
		if (!pillar) continue;

		// [g]: any move of a cube of L that lowers Π.
		const move = bestReducingMove(config, frame, low);
		if (move) return { name: `[g] low component move${frame.label}`, moves: [move] };

		const [px, py] = [frame.toCell(pillar.a, pillar.b, 0)[0] - min[0], frame.toCell(pillar.a, pillar.b, 0)[1] - min[1]];
		const small = low.length < px + py + 1;
		if (small) {
			const op = underPillarOperation(config, frame, low, pillar);
			if (op) return op;
		}
	}
	return null;
}

/** A non-cut pillar of C \ L standing on a cube of L. */
function clearingPillar(config: Configuration, frame: Frame, low: Cell[]): Pillar | null {
	const lowKeys = new Set(low.map(cellKey));
	const rest = config.clone();
	for (const c of low) rest.delete(c);
	for (const p of pillars(rest, frame)) {
		if (p.zb !== frame.floor + 1 || !lowKeys.has(cellKey(frame.toCell(p.a, p.b, frame.floor)))) continue;
		if (connectedWithout(rest, column(frame, p.a, p.b, p.zb, p.zt))) return p;
	}
	return null;
}

/**
 * [h]: the cells N_P beside the pillar's lowest cube are all present (or some
 * are present and the pillar has height one). Move the cube c under the
 * pillar to the empty floor cell e with a ≤ pa and b ≤ pb, of highest b and
 * then highest a, going below the floor. If c holds L together, first fill
 * the 3×3 square around c with other cubes of L.
 */
function underPillarOperation(config: Configuration, frame: Frame, low: Cell[], pillar: Pillar): Operation | null {
	const { a: pa, b: pb } = pillar;
	const floor = frame.floor;
	const inside = (c: Cell) => inBox(c, frame.box);
	const neighbours = frame.sides.map(([da, db]) => frame.toCell(pa + da, pb + db, floor + 1)).filter(inside);
	const present = neighbours.filter((c) => config.has(c)).length;
	const height = pillar.zt - pillar.zb + 1;
	if (!(present === neighbours.length || (present > 0 && height === 1))) return null;

	// The empty floor cell e, scanning b, then a, downwards from the pillar.
	const lowB = frame.fromCell(frame.box.min)[1];
	const lowA = frame.fromCell(frame.box.min)[0];
	let e: Cell | null = null;
	for (let b = pb; b >= Math.min(lowB, pb) && !e; b--) {
		for (let a = pa; a >= lowA; a--) {
			const cell = frame.toCell(a, b, floor);
			if (inside(cell) && !config.has(cell)) {
				e = cell;
				break;
			}
		}
	}
	if (!e) return null;

	const work = config.clone();
	const moves: Move[] = [];
	const c = frame.toCell(pa, pb, floor);
	if (!isConnected(work, c)) {
		// Gather the 3×3 square around c from non-cut cubes of L, highest (b, a) first.
		const lowKeys = new Set(low.map(cellKey));
		for (const [da, db] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
			const cell = frame.toCell(pa + da, pb + db, floor);
			if (work.has(cell) || !inside(cell)) continue;
			const donors = work
				.toArray()
				.filter((d) => lowKeys.has(cellKey(d)) && Math.max(Math.abs(d[0] - c[0]), Math.abs(d[1] - c[1]), Math.abs(d[2] - c[2])) > 1)
				.filter((d) => isConnected(work, d))
				.sort((p, q) => frame.fromCell(q)[1] - frame.fromCell(p)[1] || frame.fromCell(q)[0] - frame.fromCell(p)[0]);
			const path = donors.map((d) => modulePath(work, d, cell, frame.rules)).find((p) => p);
			if (!path) continue;
			for (const m of path) applyMove(work, m);
			moves.push(...path);
			lowKeys.delete(cellKey(path[0].from));
			lowKeys.add(cellKey(cell));
		}
	}
	const path = modulePath(work, c, e, frame.rules);
	if (!path) return null;
	moves.push(...path);
	return tryMoves(config, moves, frame) ? { name: `[h] move the cube under the clearing pillar${frame.label}`, moves } : null;
}

/**
 * First fallback, not from the paper: move one cube along a legal path (which
 * may step just outside the box) to the reachable cell inside the box with
 * the lowest potential, if that lowers Π. This covers the small low
 * components that operation [h] cannot handle because they are too small to
 * gather a 3×3 square, as in our reading of the paper.
 */
function singleCubeRelocation(config: Configuration, box: Box, rules: Rules): Operation | null {
	let best: { moves: Move[]; gain: number } | null = null;
	for (const c of config) {
		let target: Cell | null = null;
		let gain = 0;
		findPath(config, c, rules, (cell) => {
			const g = cubePotential(c, box) - cubePotential(cell, box);
			if (inBox(cell, box) && g > gain) {
				gain = g;
				target = cell;
			}
			return false;
		});
		if (!target || (best && best.gain >= gain)) continue;
		const moves = modulePath(config, c, target, rules);
		if (moves) best = { moves, gain };
	}
	return best && { name: "Fallback: move one cube towards the origin (not in the paper)", moves: best.moves };
}

/**
 * Last fallback for the cases that are not implemented ([i], [j] and the pinned
 * recursion): breadth-first search over configurations for the shortest move
 * sequence that lowers Π and ends with every cube in the box.
 */
function fallback(config: Configuration, box: Box, rules: Rules, maxStates = 150_000): Operation | null {
	const start = potential(config, box);
	const parents = new Map<string, { prev: string; move: Move } | null>([[config.key(), null]]);
	let frontier = [config];
	while (frontier.length > 0 && parents.size < maxStates) {
		const next: Configuration[] = [];
		for (const state of frontier) {
			const key = state.key();
			for (const { from, to } of legalMoves(state, rules)) {
				const after = state.clone();
				applyMove(after, { from, to });
				const afterKey = after.key();
				if (parents.has(afterKey)) continue;
				parents.set(afterKey, { prev: key, move: { from, to } });
				if (potential(after, box) < start && after.toArray().every((c) => inBox(c, box))) {
					const moves: Move[] = [];
					for (let k = afterKey, p = parents.get(k); p; k = p.prev, p = parents.get(k)) moves.push(p.move);
					return { name: "Fallback: search for any potential-reducing moves (not in the paper)", moves: moves.reverse() };
				}
				next.push(after);
			}
		}
		frontier = next;
	}
	return null;
}
