import {
	type Move,
	Configuration,
	applyMove,
	compactedInBox,
	faceNeighbors,
	inverse,
	legalMoves,
	matchesTarget,
	replay,
	rules2D,
	rules3D,
	sub,
} from "@/engine";
import { shortestSolution } from "@/solvers/bfs";
import { compact3D } from "@/solvers/peters";
import type { Level2D, Level3D } from "./levels";

/** Small seeded PRNG (mulberry32), so a seed always gives the same level. */
export function seededRandom(seed: number): () => number {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(items: readonly T[], rand: () => number): T {
	return items[Math.floor(rand() * items.length)];
}

/** Grows a connected shape from one module by repeatedly adding a free neighbour of a random module. */
export function growShape(size: number, rand: () => number, dims: 2 | 3 = 2): Configuration {
	const shape = new Configuration([[0, 0, 0]]);
	while (shape.size < size) {
		const neighbors = faceNeighbors(pick(shape.toArray(), rand)).filter((n) => dims === 3 || n[2] === 0);
		shape.add(pick(neighbors, rand));
	}
	return shape;
}

export interface GeneratorOptions {
	/** Number of squares, at least 3. */
	size: number;
	/** Length of the scramble walk; more moves usually means a harder level. */
	scrambleMoves: number;
	seed: number;
}

/** 2D levels up to this size also get a BFS-shortest reference solution. */
const MAX_BFS_SIZE = 7;

function checkSeed(seed: number) {
	if (!Number.isInteger(seed)) throw new Error("The seed must be a whole number.");
}

/** How often the scramble prefers moves that take it furthest from the target. */
const GREEDY_BIAS = 0.7;

/**
 * Random 2D level with a verified solution. Grows a random target shape, then
 * scrambles it with a walk of legal moves that never revisits a state and
 * mostly moves away from the target. The start is where the walk ends, and
 * the walk reversed is a solution. Small levels replace it with the shortest
 * solution from BFS.
 */
export function generateLevel2D({ size, scrambleMoves, seed }: GeneratorOptions): Level2D {
	if (!Number.isInteger(size) || size < 3) throw new Error("A level needs a whole number of at least 3 squares.");
	if (!Number.isInteger(scrambleMoves) || scrambleMoves < 1) throw new Error("Scramble needs a whole number of at least 1 move.");
	checkSeed(seed);
	const rand = seededRandom(seed);
	const target = growShape(size, rand);

	const config = target.clone();
	const visited = new Set([config.key()]);
	const walk: Move[] = [];
	const distance = (c: Configuration) => c.toArray().filter((cell) => !target.has(cell)).length;

	for (let i = 0; i < scrambleMoves; i++) {
		const options = legalMoves(config, rules2D)
			.map(({ from, to }) => {
				const after = config.clone();
				applyMove(after, { from, to });
				return { move: { from, to }, key: after.key(), distance: distance(after) };
			})
			.filter((o) => !visited.has(o.key));
		if (options.length === 0) break;

		const furthest = Math.max(...options.map((o) => o.distance));
		const choice = rand() < GREEDY_BIAS ? pick(options.filter((o) => o.distance === furthest), rand) : pick(options, rand);
		applyMove(config, choice.move);
		visited.add(choice.key);
		walk.push(choice.move);
	}

	const start = config;
	const shortest = size <= MAX_BFS_SIZE ? shortestSolution(start, matchesTarget(target), rules2D, 20_000) : null;
	const solution = shortest ?? walk.map(inverse).reverse();

	// Never hand out a level whose solution the engine does not accept.
	const check = replay(start, solution, rules2D, matchesTarget(target));
	if (!check.ok) throw new Error(`Generated level failed verification: ${check.failure?.message}`);

	const to2D = (c: Configuration) => c.toArray().map((cell): [number, number] => [cell[0], cell[1]]);
	return {
		mode: "2d",
		id: `random-${size}-${scrambleMoves}-${seed}`,
		name: `Random #${seed}`,
		description: `${size} random squares, scrambled with ${walk.length} moves. ${
			shortest ? `The shortest solution takes ${solution.length} moves.` : `A known solution takes ${solution.length} moves.`
		}`,
		start: to2D(start),
		target: to2D(target),
		solution,
		optimal: shortest !== null,
	};
}

/** 3D levels up to this size get a BFS-shortest reference solution; larger ones the paper solver's. */
const MAX_BFS_SIZE_3D = 6;

/**
 * Random 3D level: a random connected shape that is not yet downward-closed
 * in its own bounding box. Unlike 2D there is no fixed target to scramble
 * from, so the reference solution comes from BFS for small levels and from
 * the paper's solver otherwise.
 */
export function generateLevel3D({ size, seed }: { size: number; seed: number }): Level3D {
	if (!Number.isInteger(size) || size < 3) throw new Error("A level needs a whole number of at least 3 cubes.");
	checkSeed(seed);
	const rand = seededRandom(seed);

	let start = growShape(size, rand, 3);
	for (let attempt = 0; compactedInBox(start.boundingBox()).isReached(start); attempt++) {
		if (attempt === 100) throw new Error("Could not grow a shape that still needs compacting.");
		start = growShape(size, rand, 3);
	}

	// Put the box's minimum corner, the origin for compaction, at (0, 0, 0).
	const { min } = start.boundingBox();
	start = new Configuration(start.toArray().map((c) => sub(c, min)));
	const box = start.boundingBox();
	const goal = compactedInBox(box);
	const shortest = size <= MAX_BFS_SIZE_3D ? shortestSolution(start, goal, rules3D(box), 30_000) : null;
	const solution = shortest ?? compact3D(start).moves;
	const check = replay(start, solution, rules3D(box), goal);
	if (!check.ok) throw new Error(`Generated level failed verification: ${check.failure?.message}`);

	return {
		mode: "3d",
		id: `random3d-${size}-${seed}`,
		name: `Random 3D #${seed}`,
		description: `${size} random cubes. ${
			shortest ? `The shortest compaction takes ${solution.length} moves.` : `The paper's solver compacts it in ${solution.length} moves.`
		}`,
		start: start.toArray().map((c): [number, number, number] => [c[0], c[1], c[2]]),
		solution,
		optimal: shortest !== null,
	};
}
