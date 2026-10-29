import { type Cell, cellKey } from "./cell";

export interface Box {
	/** Inclusive lower corner. */
	min: Cell;
	/** Inclusive upper corner. */
	max: Cell;
}

/**
 * A finite set of occupied cells. Sparse on purpose: there is no grid size,
 * so the 2D mode can grow in any direction.
 */
export class Configuration implements Iterable<Cell> {
	private readonly cells = new Map<string, Cell>();

	constructor(cells: Iterable<Cell> = []) {
		for (const c of cells) this.add(c);
	}

	get size(): number {
		return this.cells.size;
	}

	has(c: Cell): boolean {
		return this.cells.has(cellKey(c));
	}

	add(c: Cell): void {
		this.cells.set(cellKey(c), [c[0], c[1], c[2]]);
	}

	delete(c: Cell): void {
		this.cells.delete(cellKey(c));
	}

	clone(): Configuration {
		return new Configuration(this.cells.values());
	}

	toArray(): Cell[] {
		return [...this.cells.values()];
	}

	equals(other: Configuration): boolean {
		if (other.size !== this.size) return false;
		for (const c of this) if (!other.has(c)) return false;
		return true;
	}

	/** Smallest box containing every cell. Throws on an empty configuration. */
	boundingBox(): Box {
		const cells = this.toArray();
		if (cells.length === 0) throw new Error("An empty configuration has no bounding box");
		const min = [Infinity, Infinity, Infinity];
		const max = [-Infinity, -Infinity, -Infinity];
		for (const c of cells) {
			for (let i = 0; i < 3; i++) {
				min[i] = Math.min(min[i], c[i]);
				max[i] = Math.max(max[i], c[i]);
			}
		}
		return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
	}

	[Symbol.iterator](): Iterator<Cell> {
		return this.cells.values();
	}
}
