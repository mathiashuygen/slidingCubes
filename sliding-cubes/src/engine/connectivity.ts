import { type Cell, cellKey, equals, faceNeighbors } from "./cell";
import type { Configuration } from "./configuration";

function occupiedNeighbors(config: Configuration, c: Cell): Cell[] {
	return faceNeighbors(c).filter((n) => config.has(n));
}

/**
 * Whether the adjacency graph is connected, optionally pretending `without`
 * is removed (the stationary modules during a move).
 */
export function isConnected(config: Configuration, without?: Cell): boolean {
	const cells = config.toArray().filter((c) => !without || !equals(c, without));
	if (cells.length <= 1) return true;

	const skip = without ? cellKey(without) : null;
	const seen = new Set([cellKey(cells[0])]);
	const queue = [cells[0]];
	while (queue.length > 0) {
		const c = queue.pop()!;
		for (const n of occupiedNeighbors(config, c)) {
			const k = cellKey(n);
			if (k === skip || seen.has(k)) continue;
			seen.add(k);
			queue.push(n);
		}
	}
	return seen.size === cells.length;
}

/**
 * Biconnected components (blocks) of the adjacency graph, as lists of cells
 * (Tarjan with an edge stack). A block of two cells is a bridge; larger
 * blocks contain cycles. Iterative, like articulationPoints.
 */
export function biconnectedBlocks(config: Configuration): Cell[][] {
	const disc = new Map<string, number>();
	const low = new Map<string, number>();
	const cells = new Map<string, Cell>();
	const edges: [string, string][] = [];
	const blocks: Cell[][] = [];
	let time = 0;

	interface Frame {
		key: string;
		parent: string | null;
		neighbors: Cell[];
		next: number;
	}

	for (const root of config) {
		const rootKey = cellKey(root);
		if (disc.has(rootKey)) continue;
		disc.set(rootKey, time);
		low.set(rootKey, time++);
		cells.set(rootKey, root);
		const stack: Frame[] = [{ key: rootKey, parent: null, neighbors: occupiedNeighbors(config, root), next: 0 }];

		while (stack.length > 0) {
			const frame = stack[stack.length - 1];
			if (frame.next < frame.neighbors.length) {
				const n = frame.neighbors[frame.next++];
				const k = cellKey(n);
				if (!disc.has(k)) {
					disc.set(k, time);
					low.set(k, time++);
					cells.set(k, n);
					edges.push([frame.key, k]);
					stack.push({ key: k, parent: frame.key, neighbors: occupiedNeighbors(config, n), next: 0 });
				} else if (k !== frame.parent && disc.get(k)! < disc.get(frame.key)!) {
					low.set(frame.key, Math.min(low.get(frame.key)!, disc.get(k)!));
					edges.push([frame.key, k]);
				}
				continue;
			}

			stack.pop();
			const parent = stack[stack.length - 1];
			if (!parent) continue;
			low.set(parent.key, Math.min(low.get(parent.key)!, low.get(frame.key)!));
			if (low.get(frame.key)! >= disc.get(parent.key)!) {
				const block = new Set<string>();
				for (;;) {
					const [u, v] = edges.pop()!;
					block.add(u);
					block.add(v);
					if (u === parent.key && v === frame.key) break;
				}
				blocks.push([...block].map((key) => cells.get(key)!));
			}
		}
	}
	return blocks;
}

/**
 * Keys of the modules whose removal disconnects the configuration (Tarjan).
 * These are exactly the modules that cannot move. Iterative, because a long
 * 2D chain would overflow the call stack.
 */
export function articulationPoints(config: Configuration): Set<string> {
	const disc = new Map<string, number>();
	const low = new Map<string, number>();
	const result = new Set<string>();
	let time = 0;

	interface Frame {
		key: string;
		neighbors: Cell[];
		next: number;
		children: number;
	}

	for (const root of config) {
		const rootKey = cellKey(root);
		if (disc.has(rootKey)) continue;

		disc.set(rootKey, time);
		low.set(rootKey, time++);
		const stack: Frame[] = [{ key: rootKey, neighbors: occupiedNeighbors(config, root), next: 0, children: 0 }];

		while (stack.length > 0) {
			const frame = stack[stack.length - 1];
			const parent = stack.length > 1 ? stack[stack.length - 2] : null;

			if (frame.next < frame.neighbors.length) {
				const n = frame.neighbors[frame.next++];
				const k = cellKey(n);
				if (!disc.has(k)) {
					disc.set(k, time);
					low.set(k, time++);
					frame.children++;
					stack.push({ key: k, neighbors: occupiedNeighbors(config, n), next: 0, children: 0 });
				} else if (k !== parent?.key) {
					low.set(frame.key, Math.min(low.get(frame.key)!, disc.get(k)!));
				}
				continue;
			}

			stack.pop();
			if (parent) {
				low.set(parent.key, Math.min(low.get(parent.key)!, low.get(frame.key)!));
				const parentIsRoot = stack.length === 1;
				if (!parentIsRoot && low.get(frame.key)! >= disc.get(parent.key)!) result.add(parent.key);
			} else if (frame.children > 1) {
				result.add(frame.key);
			}
		}
	}
	return result;
}
