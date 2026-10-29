import {
	type Cell,
	type Configuration,
	type Move,
	biconnectedBlocks,
	cellKey,
	equals,
	inverse,
	isConnected,
	parseCellKey,
	rules2D,
} from "@/engine";
import { MoveRecorder, type SolverOutput, SolverError, findPath, modulePath } from "./common";

/**
 * 2D reconfiguration after Dumitrescu and Pach, "Pushing Squares Around"
 * (Graphs and Combinatorics 22, 2006), Section 3.
 *
 * Both the start A and the target B are turned into a horizontal chain
 * (A → L_A and B → L_B). The chain L_A is then moved onto L_B, which the paper
 * leaves open (see relocateChain), and the moves of B → L_B are played
 * backwards. Every move is checked by the rules engine as it is recorded.
 */
export function solve2D(start: Configuration, target: Configuration): SolverOutput {
	if (start.size !== target.size) throw new SolverError("Start and target need the same number of squares.");
	if (!isConnected(start) || !isConnected(target)) throw new SolverError("Start and target must be connected.");

	const toChainA = toChain(start);
	const toChainB = toChain(target);

	const recorder = new MoveRecorder(start.clone(), rules2D);
	for (const phase of toChainA.output.phases) {
		recorder.setPhase(`Start → chain · ${phase.name}`);
		recorder.applyAll(toChainA.output.moves.slice(phase.start, phase.end));
	}
	recorder.setPhase("Relocate chain");
	relocateChain(recorder, toChainA.chain, toChainB.chain);
	// Played backwards, the target's moves turn its chain back into the target.
	const phasesB = toChainB.output.phases;
	for (let i = phasesB.length - 1; i >= 0; i--) {
		const phase = phasesB[i];
		recorder.setPhase(`Chain → target · ${phase.name} (reversed)`);
		const moves = toChainB.output.moves.slice(phase.start, phase.end);
		recorder.applyAll(moves.reverse().map(inverse));
	}
	return recorder.output();
}

/** A horizontal chain of `length` squares from (x, y) eastwards. */
export interface Chain {
	x: number;
	y: number;
	length: number;
}

const E: Cell = [1, 0, 0];
const W: Cell = [-1, 0, 0];
const N: Cell = [0, 1, 0];
const S: Cell = [0, -1, 0];
const SIDES = [E, W, N, S];
const AROUND: Cell[] = [E, W, N, S, [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0]];

const shift = (c: Cell, d: Cell): Cell => [c[0] + d[0], c[1] + d[1], 0];

function degree(config: Configuration, c: Cell): number {
	return SIDES.filter((d) => config.has(shift(c, d))).length;
}

/**
 * The holes: 4-connected components of empty cells (inside a margin of one
 * cell around the configuration). Hole 0 is the outer hole H_0.
 */
function holes(config: Configuration): Map<string, number> {
	const { min, max } = config.boundingBox();
	const inside = (c: Cell) => c[0] >= min[0] - 1 && c[0] <= max[0] + 1 && c[1] >= min[1] - 1 && c[1] <= max[1] + 1;
	const hole = new Map<string, number>();
	const fill = (seed: Cell, index: number) => {
		const queue = [seed];
		hole.set(cellKey(seed), index);
		while (queue.length > 0) {
			const c = queue.pop()!;
			for (const d of SIDES) {
				const n = shift(c, d);
				if (inside(n) && !config.has(n) && !hole.has(cellKey(n))) {
					hole.set(cellKey(n), index);
					queue.push(n);
				}
			}
		}
	};
	// The margin corner is always empty and outside, so it seeds H_0.
	fill([min[0] - 1, min[1] - 1, 0], 0);
	let next = 1;
	for (let x = min[0]; x <= max[0]; x++) {
		for (let y = min[1]; y <= max[1]; y++) {
			const c: Cell = [x, y, 0];
			if (!config.has(c) && !hole.has(cellKey(c))) fill(c, next++);
		}
	}
	return hole;
}

/** Whether `c` is on the outer boundary B_out: side- or corner-adjacent to the outer hole. */
function onOuterBoundary(hole: Map<string, number>, c: Cell): boolean {
	return AROUND.some((d) => hole.get(cellKey(shift(c, d))) === 0);
}

/**
 * The region R(C) enclosed by a block's outer cycle: the block's cells plus
 * every cell the outside cannot reach without crossing the block.
 */
function enclosedRegion(block: Cell[]): Set<string> {
	const keys = new Set(block.map(cellKey));
	const xs = block.map((c) => c[0]);
	const ys = block.map((c) => c[1]);
	const [x0, x1, y0, y1] = [Math.min(...xs) - 1, Math.max(...xs) + 1, Math.min(...ys) - 1, Math.max(...ys) + 1];
	const outside = new Set<string>();
	const queue: Cell[] = [[x0, y0, 0]];
	outside.add(cellKey(queue[0]));
	while (queue.length > 0) {
		const c = queue.pop()!;
		for (const d of SIDES) {
			const n = shift(c, d);
			const k = cellKey(n);
			if (n[0] < x0 || n[0] > x1 || n[1] < y0 || n[1] > y1 || keys.has(k) || outside.has(k)) continue;
			outside.add(k);
			queue.push(n);
		}
	}
	const region = new Set<string>();
	for (let x = x0; x <= x1; x++) {
		for (let y = y0; y <= y1; y++) {
			const k = cellKey([x, y, 0]);
			if (!outside.has(k)) region.add(k);
		}
	}
	return region;
}

interface MaximalCycle {
	block: Cell[];
	region: Set<string>;
}

/**
 * Maximal cycles: the outer cycles of blocks (with a cycle, so at least four
 * cells) whose region is not inside another block's region.
 */
function maximalCycles(config: Configuration): MaximalCycle[] {
	const cycles = biconnectedBlocks(config)
		.filter((b) => b.length >= 4)
		.map((block) => ({ block, region: enclosedRegion(block) }));
	return cycles.filter(
		(c) => !cycles.some((other) => other !== c && other.region.size > c.region.size && c.block.every((cell) => other.region.has(cellKey(cell)))),
	);
}

/** The paper's progress measure Φ(G) = q − y: total contents of maximal cycles minus their number. */
function potential(config: Configuration): number {
	const cycles = maximalCycles(config);
	const contents = new Set<string>();
	for (const { region } of cycles) {
		for (const k of region) if (config.has(parseCellKey(k))) contents.add(k);
	}
	return contents.size - cycles.length;
}

/**
 * Turns a connected configuration into a horizontal chain, extending it one
 * square eastwards per iteration from a base s in the rightmost column.
 */
export function toChain(start: Configuration): { output: SolverOutput; chain: Chain } {
	const recorder = new MoveRecorder(start.clone(), rules2D);
	const config = recorder.config;
	const n = config.size;
	const x0 = Math.max(...config.toArray().map((c) => c[0]));
	// Base s: the lowest occupied cell in the rightmost column.
	const ys = config.toArray().filter((c) => c[0] === x0).map((c) => c[1]);
	const s: Cell = [x0, Math.min(...ys), 0];
	const chain = { x: x0, y: s[1], length: n };
	// Z: the chain built so far, from s eastwards.
	let length = 1;
	const inChain = (c: Cell) => c[1] === s[1] && c[0] >= x0 && c[0] < x0 + length;

	// Each iteration uses fewer than 2n steps (the paper's bound); allow some slack before giving up.
	const maxSteps = 4 * n * n + 10;
	let steps = 0;

	const extend = (m: Cell, phase: string) => {
		recorder.setPhase(phase);
		recorder.relocate(m, [x0 + length, s[1], 0]);
		length++;
	};

	while (length < n) {
		if (++steps > maxSteps) throw new SolverError("Chain construction did not finish within the paper's step bound.");
		const others = config.toArray().filter((c) => !inChain(c));
		const hole = holes(config);

		// Step 1: squares of degree one outside the chain.
		const leaves = others.filter((c) => degree(config, c) === 1);
		if (leaves.length > 0) {
			const outer = leaves.find((c) => onOuterBoundary(hole, c));
			if (outer) {
				extend(outer, "Step 1.A");
				continue;
			}
			// Step 1.B: move an inner leaf along its hole until it has two neighbours.
			const m = leaves[0];
			recorder.setPhase("Step 1.B");
			const reached = findPath(config, m, rules2D, (c, rest) => degree(rest, c) >= 2);
			if (!reached) throw new SolverError("Step 1.B: the inner leaf cannot reach a cell with two neighbours.");
			recorder.applyAll(reached.moves);
			continue;
		}

		// Step 2: every square outside the chain has degree at least two, so there are cycles.
		const m = step2Module(config, s);
		if (onOuterBoundary(hole, m)) {
			extend(m, "Step 2.A");
			continue;
		}
		recorder.setPhase("Step 2.B");
		recorder.applyAll(step2B(config, m));
	}
	return { output: recorder.output(), chain };
}

/**
 * Step 2: a maximal cycle C with exactly one connector, and the upper square a
 * of the highest vertical edge of C at its largest (or, if the connector is
 * on that edge, smallest) x-coordinate.
 */
function step2Module(config: Configuration, s: Cell): Cell {
	const cycles = maximalCycles(config);
	if (cycles.length === 0) throw new SolverError("Step 2: expected a cycle, but there is none.");

	const connectors = (c: MaximalCycle) => {
		const result = c.block.filter((v) =>
			SIDES.some((d) => {
				const n = shift(v, d);
				return config.has(n) && !c.region.has(cellKey(n));
			}),
		);
		if (c.block.some((v) => equals(v, s)) && !result.some((v) => equals(v, s))) result.push(s);
		return result;
	};
	const leaf = cycles.find((c) => connectors(c).length === 1);
	if (!leaf) throw new SolverError("Step 2: no maximal cycle with exactly one connector (contradicts Lemma 2).");
	const [connector] = connectors(leaf);

	for (const pickX of [Math.max, Math.min]) {
		const x = pickX(...leaf.block.map((c) => c[0]));
		const blockKeys = new Set(leaf.block.map(cellKey));
		const edges = leaf.block.filter((a) => a[0] === x && blockKeys.has(cellKey(shift(a, S)))).sort((p, q) => q[1] - p[1]);
		const a = edges[0];
		if (!a) continue;
		const b = shift(a, S);
		if (equals(connector, a) || equals(connector, b)) continue;
		if (!isConnected(config, a)) throw new SolverError("Step 2: the chosen square would disconnect the configuration.");
		return a;
	}
	throw new SolverError("Step 2: the connector lies on both extreme vertical edges.");
}

/**
 * Step 2.B: a is on the inner boundary. Removing it merges holes into H; move
 * it to an empty cell e of H next to a critical pair, chosen so that the
 * paper's measure Φ strictly increases (the Claim guarantees one exists).
 */
function step2B(config: Configuration, a: Cell): Move[] {
	const before = potential(config);
	const rest = config.clone();
	rest.delete(a);
	const hole = holes(rest);
	const h = hole.get(cellKey(a));

	const candidates: Cell[] = [];
	for (const [key, index] of hole) {
		if (index !== h || index === 0) continue;
		const e = parseCellKey(key);
		if (equals(e, a)) continue;
		for (const dx of [1, -1]) {
			for (const dy of [1, -1]) {
				const c = shift(e, [dx, 0, 0]);
				const d = shift(e, [0, dy, 0]);
				const f = shift(e, [dx, dy, 0]);
				if (rest.has(c) && rest.has(d) && !rest.has(f)) candidates.push(e);
			}
		}
	}

	for (const e of candidates) {
		const moves = modulePath(config, a, e, rules2D);
		if (!moves) continue;
		const after = rest.clone();
		after.add(e);
		if (potential(after) > before) return moves;
	}
	throw new SolverError("Step 2.B: no critical pair whose cell increases Φ (contradicts the Claim).");
}

/**
 * Moves a horizontal chain onto another position. Not covered by the paper:
 * we shift it one row or column at a time. A column shift carries the end
 * square over the top of the chain; a row shift moves the squares one by one
 * into the neighbouring row, from the far end inwards.
 */
export function relocateChain(recorder: MoveRecorder, from: Chain, to: Chain): void {
	const { length } = from;
	let { x, y } = from;
	if (length === 1) {
		if (x !== to.x || y !== to.y) throw new SolverError("A single square cannot move on its own.");
		return;
	}
	const cell = (cx: number, cy: number): Cell => [cx, cy, 0];

	while (y !== to.y) {
		const dy = to.y > y ? 1 : -1;
		// Fill the new row from the far (east) end; the mover is always the west end of the old row.
		for (let i = length - 1; i >= 0; i--) {
			const west = x + (length - 1 - i);
			recorder.relocate(cell(west, y), cell(x + i, y + dy));
		}
		y += dy;
	}
	while (x !== to.x) {
		const dx = to.x > x ? 1 : -1;
		const tail = dx > 0 ? x : x + length - 1;
		const head = dx > 0 ? x + length : x - 1;
		recorder.relocate(cell(tail, y), cell(head, y));
		x += dx;
	}
}
