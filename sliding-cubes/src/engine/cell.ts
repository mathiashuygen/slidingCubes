/**
 * Integer grid cells. 2D configurations are 3D configurations with z = 0,
 * so the whole engine works on [x, y, z] triples.
 */
export type Cell = readonly [x: number, y: number, z: number];

export type Axis = 0 | 1 | 2;

export const AXES: readonly Axis[] = [0, 1, 2];

export function cellKey(c: Cell): string {
	return `${c[0]},${c[1]},${c[2]}`;
}

export function add(a: Cell, b: Cell): Cell {
	return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Cell, b: Cell): Cell {
	return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function equals(a: Cell, b: Cell): boolean {
	return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** Unit vector along `axis`, pointing in the direction of `sign`. */
export function unit(axis: Axis, sign: 1 | -1): Cell {
	const v: [number, number, number] = [0, 0, 0];
	v[axis] = sign;
	return v;
}

/** The unit vectors along the given axes, in both directions. */
export function unitVectors(axes: readonly Axis[]): Cell[] {
	return axes.flatMap((axis) => [unit(axis, 1), unit(axis, -1)]);
}

/** The six face-adjacent cells (four side-adjacent ones when z never changes). */
export function faceNeighbors(c: Cell): Cell[] {
	return unitVectors(AXES).map((v) => add(c, v));
}
