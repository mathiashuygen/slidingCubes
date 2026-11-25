import {
	type Box,
	type Cell,
	Configuration,
	type Move,
	type Rules,
	applyMove,
	cellKey,
	checkMove,
	compactedInBox,
	equals,
	faceNeighbors,
	isConnected,
	legalMovesFrom,
	rules3D,
} from "@/engine";
import { MoveRecorder, type SolverOutput, SolverError, canonical, findPath, modulePath } from "./common";

/**
 * 3D compaction after Kostitsyna, Ophelders, Parada, Peters, Sonke and
 * Speckmann, "Optimal In-Place Compaction of Sliding Cubes" (JoCG 16(1), 2025).
 *
 * Operates in the initial box. Each operation is replayed before acceptance
 * and strictly decreases the weighted potential. A planar subproblem has its
 * own connected component and, when attached by a clearing pillar, a fixed
 * cube. Its moves must also be legal in the enclosing 3D configuration.
 */
export function compact3D(start: Configuration, box: Box = start.boundingBox()): SolverOutput {
	if (!isConnected(start)) throw new SolverError("The start configuration must be connected.");
	const rules = rules3D(box);
	const outside = rules.space.checkStart(start);
	if (outside) throw new SolverError(outside);
	const goal = compactedInBox(box);
	const recorder = new MoveRecorder(canonical(start), rules);
	const frame = verticalFrame(box, rules);

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
	while (!goal.isReached(recorder.config)) {
		const op = nextOperation(recorder.config, frame);
		if (!op) throw new SolverError("No operation applies, but the cubes are not compacted yet.");
		recorder.setPhase(op.name);
		recorder.applyAll(op.moves);
		const after = potential(recorder.config, box);
		if (after >= current) throw new SolverError(`${op.name} did not lower the potential.`);
		current = after;
	}
	return recorder.output();
}

/** Plan exactly one operation from an in-box state, using the normal solver order. */
export function firstCompactionOperation(start: Configuration, box: Box = start.boundingBox()): Operation {
	if (!isConnected(start)) throw new SolverError("The start configuration must be connected.");
	if (start.toArray().some((c) => !inBox(c, box))) throw new SolverError("The operation must start inside the box.");
	if (compactedInBox(box).isReached(start)) throw new SolverError("The configuration is already compacted.");
	const op = nextOperation(canonical(start), verticalFrame(box, rules3D(box)));
	if (!op) throw new SolverError("No operation applies, but the cubes are not compacted yet.");
	return op;
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
	pin?: Cell;
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
}

function verticalFrame(box: Box, rules: Rules): Frame {
	const frame: Frame = {
		label: "",
		upName: "z",
		box,
		rules,
		floor: box.min[2],
		sides: [[1, 0], [-1, 0], [0, 1], [0, -1]],
		toCell: (a, b, up) => [a, b, up],
		fromCell: (c) => [c[0], c[1], c[2]],
	};
	const thinAxis = box.min[0] === box.max[0] ? 0 : box.min[1] === box.max[1] ? 1 : undefined;
	if (thinAxis !== undefined) {
		// A vertical slab of thickness one is itself a 2D instance in xz or yz.
		const axis = thinAxis === 0 ? 1 : 0;
		frame.sides = [[-1, 0], [1, 0]];
		frame.fromCell = (c) => [c[axis], c[thinAxis], c[2]];
		frame.toCell = (a, b, z) => axis === 0 ? [a, b, z] : [b, a, z];
		frame.rules = { ...rules, axes: [axis, 2] };
	}
	return frame;
}

/** The paper's final phase: the same operations on the bottom layer, with y as "up" and only x horizontal. */
function frameBottomLayer(box: Box, rules: Rules, pin?: Cell): Frame {
	const z = box.min[2];
	return {
		pin,
		label: pin ? " (2D, pinned low component)" : " (2D, bottom layer)",
		upName: "y",
		box,
		rules: { ...rules, axes: [0, 1] },
		floor: box.min[1],
		sides: [[1, 0], [-1, 0]],
		toCell: (a, _b, up) => [a, up, z],
		fromCell: (c) => [c[0], z, c[1]],
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
	const rest = config.clone();
	for (const c of cells) rest.delete(c);
	return isConnected(rest);
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

/** Figure 2 and the pillar shoves on non-cut subpillars. */
function localZReduction(config: Configuration, frame: Frame): Operation | null {
	const all = pillars(config, frame);
	const byColumn = new Map<string, Pillar[]>();
	for (const p of all) (byColumn.get(`${p.a},${p.b}`) ?? byColumn.set(`${p.a},${p.b}`, []).get(`${p.a},${p.b}`)!).push(p);

	// [a,b] also allow an interior section of a pillar. [c,d,e] require a based one.
	const subpillars: { a: number; b: number; zb: number; t: number; based: boolean }[] = [];
	for (const { a, b, zb: base, zt } of all) {
		if (frame.pin) {
			const [pa, pb, height] = frame.fromCell(frame.pin);
			if (a === pa && b === pb && base <= height && height <= zt) continue;
		}
		for (let zb = base; zb <= zt; zb++) {
			for (let t = zb; t <= zt; t++) {
				if (connectedWithout(config, column(frame, a, b, zb, t))) subpillars.push({ a, b, zb, t, based: zb === base });
			}
		}
	}

	const cell = frame.toCell;
	for (const letter of ["a", "b", "c", "d", "e"] as const) {
		for (const { a, b, zb, t, based } of subpillars) {
			if (!based && letter !== "a" && letter !== "b") continue;
			const sides: Side[] = frame.sides.map(([da, db]) => ({
				a: a + da,
				b: b + db,
				adjacent: (byColumn.get(`${a + da},${b + db}`) ?? []).filter((q) => q.zt >= zb && q.zb <= t),
			}));
			// Unlocking slides the head of P sideways first.
			const withUnlock = (s: Side, moves: Move[]) => {
				const direct = tryMoves(config, moves, frame);
				if (direct) return direct;
				const head = cell(a, b, t), parking = cell(s.a, s.b, t);
				const unlocked = [{ from: head, to: parking }, ...moves];
				// At equal weights the sideways unlock can use the entire potential
				// drop. Bring its head back, or down into the newly cleared cell.
				return tryMoves(config, unlocked, frame) ??
					tryMoves(config, [...unlocked, { from: parking, to: head }], frame) ??
					tryMoves(config, [...unlocked, { from: parking, to: cell(a, b, t - 1) }], frame);
			};

			if (letter === "e") {
				const op = pillarShove(config, frame, a, b, zb, t, sides);
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

type Column = (height: number) => Cell;
type SidePosition = { a: number; b: number };
type Arrangement = { work: Configuration; moves: Move[] };

/**
 * Place cubes into a specified set of holes, keeping all other cubes fixed
 * except the listed donors. A relocation fills one hole permanently. The
 * memoized choice of ordering handles supports which become removable only
 * after another hole has been filled. This never searches for an arbitrary
 * lower-potential configuration.
 */
function place(
	config: Configuration, donors: Cell[], targets: Cell[], frame: Frame,
	complete: (result: Arrangement) => Arrangement | null = (result) => result,
): Arrangement | null {
	const holes = new Configuration(targets);
	const seen = new Set<string>();
	function visit(work: Configuration, moves: Move[]): Arrangement | null {
		const key = work.key();
		if (seen.has(key)) return null;
		seen.add(key);
		const empty = holes.toArray().filter((c) => !work.has(c));
		if (empty.length === 0) return complete({ work, moves });
		for (const from of donors) {
			if (!work.has(from) || holes.has(from) || !isConnected(work, from)) continue;
			for (const to of empty) {
				const path = modulePath(work, from, to, frame.rules);
				if (!path) continue;
				const next = work.clone();
				for (const m of path) applyMove(next, m);
				const result = visit(next, moves.concat(path));
				if (result) return result;
			}
		}
		return null;
	}
	return visit(config, []);
}

function restore(stage: Arrangement, goal: Configuration, frame: Frame): Arrangement | null {
	const donors = stage.work.toArray().filter((c) => !goal.has(c));
	const targets = goal.toArray().filter((c) => !stage.work.has(c));
	const result = place(stage.work, donors, targets, frame);
	return result && result.work.equals(goal) ? { work: result.work, moves: stage.moves.concat(result.moves) } : null;
}

/** Figure 3, inset. Translate the seven-cube zipper one level upwards. */
function zipperSteps(k: number, src: Column, dst: Column, spare: Column): Cell[][] {
	return [
		[spare(k + 2), spare(k + 3)], [spare(k), spare(k + 1)], [spare(k + 1), spare(k + 2)],
		[src(k), spare(k + 1)], [dst(k + 2), dst(k + 3)], [src(k + 2), dst(k + 2)], [spare(k + 2), src(k + 2)],
	];
}

/** The same stencil can travel backwards on the far side of the destination. */
function advanceZipper(stage: Arrangement, k: number, src: Column, dst: Column, spare: Column, frame: Frame, mirrored: boolean): boolean {
	const flip = (col: Column): Column => (z) => col(k + 3 - z);
	const steps = mirrored
		? zipperSteps(0, flip(dst), flip(src), flip(spare)).reverse().map(([to, from]) => [from, to])
		: zipperSteps(k, src, dst, spare);
	for (const [from, to] of steps) {
		const m = { from, to };
		if (!checkMove(stage.work, m, frame.rules).legal) return false;
		applyMove(stage.work, m);
		stage.moves.push(m);
	}
	return true;
}

/** Finish a zipper by returning its helpers and filling the base of the two columns. */
function zipper(
	config: Configuration, goal: Configuration, donors: Cell[], k: number, top: number,
	src: Column, dst: Column, spare: Column, frame: Frame, mirrored: boolean,
): Arrangement | null {
	if (k + 3 > top) return null;
	const template = [dst(k), dst(k + 1), dst(k + 2), spare(k), spare(k + 2)];
	// Two stationary exterior helpers on the same side would violate the in-place rule.
	if (template.filter((c) => !inBox(c, frame.box)).length > 1) return null;
	if (template.some((c) => config.has(c))) return null;
	return place(config, donors, template, frame, (built) => {
		const stage = { work: built.work.clone(), moves: built.moves.slice() };
		for (let z = k; z < top - 3; z++) {
			if (!advanceZipper(stage, z, src, dst, spare, frame, mirrored)) return null;
		}
		return restore(stage, goal, frame);
	});
}

/** Try both orientations of the Figure 3 gadget when a box wall blocks one side. */
function shoveSides(a: number, b: number, target: SidePosition, frame: Frame) {
	const sides = [];
	for (const mirrored of [false, true]) {
		const center = mirrored ? target : { a, b };
		const other = mirrored ? { a, b } : target;
		for (const [da, db] of frame.sides) {
			const side = { a: center.a + da, b: center.b + db };
			if (side.a !== other.a || side.b !== other.b) sides.push({ ...side, mirrored });
		}
	}
	return sides;
}

function shoveGoal(config: Configuration, src: Column, dst: Column, base: number, top: number): Configuration {
	const goal = config.clone();
	for (let z = base + 1; z <= top; z++) goal.delete(src(z));
	for (let z = base; z < top; z++) goal.add(dst(z));
	return goal;
}

/** [e] shoves the base towards an adjacent pillar with the lowest raised bottom. */
function pillarShove(config: Configuration, frame: Frame, a: number, b: number, base: number, t: number, sides: Side[]): Operation | null {
	if (sides.some((s) => s.adjacent.length > 1)) return null;
	const higher = sides.filter((s) => s.adjacent.length && s.adjacent[0].zb > base);
	const top = Math.min(...higher.map((s) => s.adjacent[0].zb));
	const height = top - base + 1;
	const src = (z: number) => frame.toCell(a, b, z);
	for (const target of higher.filter((s) => s.adjacent[0].zb === top)) {
		const dst = (z: number) => frame.toCell(target.a, target.b, z);
		if (!sides.some((s) => s !== target && !config.has(frame.toCell(s.a, s.b, base)))) continue;
		// Plays the optional unlock, then `build` from the unlocked state.
		const attempt = (build: (work: Configuration, goal: Configuration) => Arrangement | null): Move[] | null => {
			for (const unlock of [false, true]) {
				const work = config.clone();
				const moves: Move[] = [];
				if (unlock) {
					const m = { from: src(t), to: dst(t) };
					if (!checkMove(work, m, frame.rules).legal) continue;
					applyMove(work, m);
					moves.push(m);
				}
				const result = build(work, shoveGoal(work, src, dst, base, top));
				if (!result) continue;
				moves.push(...result.moves);
				if (tryMoves(config, moves, frame)) return moves;
			}
			return null;
		};
		// Figure 3 [e']: fill the side from above using the lowest available source cube.
		const short = (work: Configuration, goal: Configuration) => place(work, column(frame, a, b, base, top),
			column(frame, target.a, target.b, base, top - 1).reverse(), frame, (stage) => restore(stage, goal, frame));
		if (height < 9) {
			const moves = attempt(short);
			if (moves) return { name: `[e] short pillar shove${frame.label}`, moves };
			continue;
		}
		for (const side of shoveSides(a, b, target, frame)) {
			if (config.has(frame.toCell(side.a, side.b, base))) continue;
			const spare = (z: number) => frame.toCell(side.a, side.b, z);
			const moves = attempt((work, goal) =>
				zipper(work, goal, column(frame, a, b, base, base + 4), base + 5, top, src, dst, spare, frame, side.mirrored));
			if (moves) return { name: `[e] long zipper shove${frame.label}`, moves };
		}
		// The zipper needs a free third column. Against a wall of a one-cube-thick
		// box that column is outside the box, where the in-place rule allows only
		// one cube. The short shove still works, with quadratically many moves.
		const moves = attempt(short);
		if (moves) return { name: `[e] short pillar shove on a long pillar (not in the paper: no room for the zipper)${frame.label}`, moves };
	}
	return null;
}

/** Figure 6. Helpers are borrowed from L and all floor cells are restored. */
function clearingShove(config: Configuration, frame: Frame, low: Cell[], p: Pillar): Operation | null {
	const src = (z: number) => frame.toCell(p.a, p.b, z);
	const sides = frame.sides.map(([da, db]) => ({ a: p.a + da, b: p.b + db }));
	const at = (s: SidePosition): Column => (z) => frame.toCell(s.a, s.b, z);
	const base = p.zb;
	if (sides.some((s) => config.has(at(s)(base)))) return null;
	let top = base + 1;
	while (top <= p.zt && !sides.some((s) => config.has(at(s)(top)))) top++;
	if (top > p.zt) return null;
	const originalLow = new Configuration(low);
	const floorDonors = low.slice().sort((a, b) => b[1] - a[1] || b[0] - a[0]);
	for (const target of sides.filter((s) => config.has(at(s)(top)))) {
		const dst = at(target);
		const goal = shoveGoal(config, src, dst, base, top);
		if (top - frame.floor < 5 || low.length + top - base + 1 < 9) {
			const destinations = column(frame, target.a, target.b, base, top - 1).reverse();
			const donors = [...floorDonors, ...column(frame, p.a, p.b, base, top)];
			// A floor cube under the new column can keep L attached during the transfer.
			for (const holes of [destinations, [dst(frame.floor), ...destinations]]) {
				const built = place(config, donors, holes, frame, (stage) => restore(stage, goal, frame));
				if (built && tryMoves(config, built.moves, frame)) return { name: `[i] short clearing-pillar shove${frame.label}`, moves: built.moves };
			}
			continue;
		}
		for (const side of shoveSides(p.a, p.b, target, frame)) {
			const spare = at(side);
			const work = config.clone();
			const setup: Move[] = [];
			const patches = new Configuration([...floorSquare(frame, target.a, target.b), ...floorSquare(frame, side.a, side.b)]);
			gatherFloor(work, setup, low, patches, frame);
			const floor = work.toArray()
				.filter((c) => originalLow.has(c) || (patches.has(c) && !config.has(c)))
				.sort((a, b) => b[1] - a[1] || b[0] - a[0]);
			// If L is exhausted, use the bottom of P to complete the gadget.
			for (let borrowed = 0; borrowed <= 5 && base + borrowed + 3 <= top; borrowed++) {
				const sources = [...column(frame, p.a, p.b, base, base + borrowed - 1), ...floor];
				const built = zipper(work, goal, sources, base + borrowed, top, src, dst, spare, frame, side.mirrored);
				if (!built) continue;
				const moves = setup.concat(built.moves);
				if (tryMoves(config, moves, frame)) return { name: `[i] clearing-pillar zipper shove${frame.label}`, moves };
			}
		}
	}
	return null;
}

/** [f]: the move of a frame cube above the floor that lowers Π the most, keeping it inside the box. */
function localPotentialReduction(config: Configuration, frame: Frame): Operation | null {
	const high = config.toArray().filter((c) => frame.fromCell(c)[2] > frame.floor);
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

/** Plan one 2D operation on this component. The rest of the world is stationary. */
function planarOperation(world: Configuration, cells: Cell[], parent: Frame, pin?: Cell): Operation | null {
	const local = new Configuration(cells);
	const exterior = world.toArray().filter((c) => !local.has(c));
	const rules: Rules = {
		...parent.rules,
		axes: [0, 1],
		space: {
			checkStart: parent.rules.space.checkStart,
			checkMove(state, move) {
				if (pin && equals(move.from, pin)) return "Moving the pinned cube.";
				const whole = new Configuration([...exterior, ...state]);
				const check = checkMove(whole, move, parent.rules);
				return check.legal ? null : check.message;
			},
		},
	};
	return nextOperation(local, frameBottomLayer(parent.box, rules, pin));
}

function lowComponentOperation(config: Configuration, frame: Frame): Operation | null {
	const lows = components(config.toArray().filter((c) => frame.fromCell(c)[2] === frame.floor));
	if (!lows.length) return null;
	const origin = frame.box.min;
	const atOrigin = lows.find((l) => l.some((c) => equals(c, origin)));
	// If the origin is absent, the recursive root is attached to the pin's pillar.
	const pin = frame.pin;
	const atPin = pin && lows.find((l) => l.some((c) => c[0] === pin[0] &&
		column(frame, c[0], c[2], frame.floor, pin[1]).every((p) => config.has(p))));
	const root = atOrigin ?? atPin ?? lows[0];
	const clear = [];
	// Strips attached to the pinned cube's own pillar (Lemma 11, single-pillar case).
	const pinnedStrips: { low: Cell[]; p: Pillar }[] = [];
	// Try non-root components first. A sole origin-free strip can itself be
	// clear (Lemma 11); the pin and its pillar remain protected throughout.
	for (const low of [...lows.filter((l) => l !== root), root]) {
		if (low === atOrigin || (pin && low.some((c) => equals(c, pin))) || !connectedWithout(config, low)) continue;
		const rest = config.clone();
		for (const c of low) rest.delete(c);
		const footprint = new Configuration(low);
		for (const p of pillars(rest, frame)) {
			const base = frame.toCell(p.a, p.b, frame.floor);
			if (p.zb !== frame.floor + 1 || !footprint.has(base)) continue;
			const cells = column(frame, p.a, p.b, p.zb, p.zt);
			if (pin && cells.some((c) => equals(c, pin))) {
				pinnedStrips.push({ low, p });
				continue;
			}
			if (connectedWithout(rest, cells)) clear.push({ low, p, base });
		}
	}

	for (const { low } of clear) {
		const move = bestReducingMove(config, frame, low);
		if (move) return { name: `[g] low component move${frame.label}`, moves: [move] };
	}
	for (const { low, p, base } of clear) {
		const planar = frame.sides.length === 2;
		const distance = planar ? p.a - frame.fromCell(origin)[0] : base[0] - origin[0] + base[1] - origin[1];
		const small = low.length < distance + 1;
		if (small) {
			const op = underPillarOperation(config, frame, low, p) ?? clearingShove(config, frame, low, p);
			if (op) return op;
		}
		if (planar) {
			const op = stripOperation(config, frame, low, p);
			if (op) return op;
		} else if (!small) {
			const op = planarOperation(config, low, frame, base);
			if (op) return op;
		}
	}
	// Lemma 11: if the only high component is the pinned cube's pillar, the
	// paper applies [j] with that pillar as P. Only [j]'s first case is used,
	// which moves the rightmost cube of the strip and never touches P.
	for (const { low, p } of pinnedStrips) {
		const op = stripOperation(config, frame, low, p, true);
		if (op) return op;
	}
	// Lemma 11, last case: the entire pinned component is already a
	// one-dimensional strip. Its attachment is the parent's pin; there is
	// no second clearing pillar inside the strip.
	if (pin && lows.length === 1 && lows[0].length === config.size && !atOrigin) {
		const strip = lows[0].slice().sort((a, b) => a[0] - b[0]);
		const left = strip[0], right = strip[strip.length - 1];
		if (right[0] > pin[0]) {
			const target: Cell = [left[0] - 1, left[1], left[2]];
			const path = modulePath(config, right, target, frame.rules);
			if (path && tryMoves(config, path, frame)) return { name: `[j] shift a pinned low strip${frame.label}`, moves: path };
		}
	}
	// Final planar phase on the unique floor component, with the entire world checked.
	if (frame.sides.length === 4 && lows.length === 1) return planarOperation(config, lows[0], frame);
	return null;
}

/**
 * Figure 7. The strip is ordered along x, with y playing the role of height.
 * With `shiftOnly`, only the first case (rightmost cube to the left end) applies.
 */
function stripOperation(config: Configuration, frame: Frame, low: Cell[], p: Pillar, shiftOnly = false): Operation | null {
	const x = (c: Cell) => frame.fromCell(c)[0];
	const strip = low.slice().sort((a, b) => x(a) - x(b));
	const left = strip[0], right = strip[strip.length - 1];
	const above = (c: Cell) => frame.toCell(x(c), p.b, frame.floor + 1);
	const attachment = strip.find((c) => config.has(above(c)));
	if (!attachment) return null;
	const work = config.clone();
	const moves: Move[] = [];
	if (shiftOnly && equals(attachment, right)) return null;
	if (!equals(attachment, right)) {
		const dest = frame.toCell(x(left) - 1, p.b, frame.floor);
		if (!relocate(work, moves, right, dest, frame)) return null;
	} else if (p.zt > frame.floor + 1) {
		const op = underPillarOperation(config, frame, low, p);
		if (!op) return null;
		moves.push(...op.moves);
	} else {
		if (!relocate(work, moves, left, frame.toCell(x(right) + 1, p.b, frame.floor), frame)) return null;
		if (!relocate(work, moves, above(right), left, frame)) return null;
	}
	return tryMoves(config, moves, frame) && { name: `[j] clear a low strip${frame.label}`, moves };
}

function relocate(work: Configuration, moves: Move[], from: Cell, to: Cell, frame: Frame): boolean {
	const path = modulePath(work, from, to, frame.rules);
	if (!path) return false;
	for (const m of path) applyMove(work, m);
	moves.push(...path);
	return true;
}

function floorSquare(frame: Frame, a: number, b: number): Cell[] {
	const cells: Cell[] = [];
	for (const db of frame.sides.length === 4 ? [-1, 0, 1] : [0]) {
		for (const da of [-1, 0, 1]) {
			const c = frame.toCell(a + da, b + db, frame.floor);
			if (inBox(c, frame.box)) cells.push(c);
		}
	}
	return cells;
}

/** Gather non-cut donors in decreasing (y,x) order. Recheck cut status after each relocation. */
function gatherFloor(work: Configuration, moves: Move[], low: Cell[], footprint: Configuration, frame: Frame): void {
	const donors = low.filter((c) => !footprint.has(c)).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
	for (;;) {
		let placed = false;
		for (const donor of donors) {
			if (!work.has(donor)) continue;
			for (const dest of footprint) {
				if (work.has(dest) || !relocate(work, moves, donor, dest, frame)) continue;
				placed = true;
				break;
			}
			if (placed) break;
		}
		if (!placed) return;
	}
}

function underPillarOperation(config: Configuration, frame: Frame, low: Cell[], p: Pillar): Operation | null {
	const { a, b } = p;
	const floor = frame.floor;
	const base = frame.toCell(a, b, floor);
	const head = frame.toCell(a, b, floor + 1);
	const sides = frame.sides.map(([da, db]) => frame.toCell(a + da, b + db, floor + 1)).filter((c) => inBox(c, frame.box));
	const count = sides.filter((c) => config.has(c)).length;
	if (!count || (count !== sides.length && p.zt !== floor + 1)) return null;
	const cut = !isConnected(config, base);
	const [minA, minB] = frame.fromCell(frame.box.min);
	// The paper's e: an empty floor cell with e ≤ c in both coordinates, highest y, then highest x.
	const emptyCell = (state: Configuration): Cell | undefined => {
		for (let y = b; y >= minB; y--) {
			for (let x = a; x >= minA; x--) {
				const c = frame.toCell(x, y, floor);
				if (!state.has(c)) return c;
			}
		}
	};
	const e = emptyCell(config);
	if (!e) return null;
	function finish(state: Configuration, gathered: Move[]): Operation | null {
		if (!isConnected(state, base)) return null;
		// Gathering can fill e when it lies in the 3×3 square. Then choose e
		// again by the same rule, or else a free cell of the square.
		const again = emptyCell(state);
		const destinations = state.has(e!) ? [...(again ? [again] : []), ...floorSquare(frame, a, b)] : [e!];
		for (const dest of destinations) {
			if (state.has(dest)) continue;
			const work = state.clone();
			const moves = gathered.slice();
			if (!relocate(work, moves, base, dest, frame)) continue;
			if (cut && !relocate(work, moves, head, base, frame)) continue;
			if (tryMoves(config, moves, frame)) return { name: `[h] move the cube under the clearing pillar${frame.label}`, moves };
		}
		return null;
	}
	if (!cut) return finish(config, []);
	const footprint = new Configuration(floorSquare(frame, a, b));
	const work = config.clone();
	const moves: Move[] = [];
	gatherFloor(work, moves, low, footprint, frame);
	const result = finish(work, moves);
	if (result) return result;

	// An exhausted L may have fewer cubes than the footprint. Reposition the
	// remaining donors within that footprint until the base is free to leave.
	const movable = footprint.toArray().filter((c) => !equals(c, base) && (!config.has(c) || low.some((q) => equals(c, q))));
	const queue = [{ state: work, setup: moves }];
	const seen = new Set([work.key()]);
	for (let i = 0; i < queue.length; i++) {
		const { state, setup } = queue[i];
		for (const from of movable.filter((c) => state.has(c))) {
			for (const to of movable.filter((c) => !state.has(c))) {
				const next = state.clone();
				next.delete(from);
				next.add(to);
				if (seen.has(next.key())) continue;
				const path = modulePath(state, from, to, frame.rules);
				if (!path) continue;
				seen.add(next.key());
				const history = setup.concat(path);
				const done = finish(next, history);
				if (done) return done;
				queue.push({ state: next, setup: history });
			}
		}
	}
	return null;
}
