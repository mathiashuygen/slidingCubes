import { type Cell, type Move, Configuration, isConnected } from "@/engine";
import curated from "./levels.json";

interface LevelBase {
	id: string;
	name: string;
	description: string;
	/** A verified solution, when known. Its length is the reference for scoring. */
	solution?: Move[];
	/** Whether `solution` is known to be shortest (found by BFS). */
	optimal?: boolean;
	/** Reference move counts for curated levels. */
	par?: Par;
}

export interface Par {
	/** Moves the paper's solver takes. */
	solver: number;
	/** Moves of a shortest solution, when known (found by BFS). */
	shortest?: number;
}

/** A 2D level: reach `target` from `start`. Cells are [x, y] pairs at z = 0. */
export interface Level2D extends LevelBase {
	mode: "2d";
	start: [number, number][];
	target: [number, number][];
}

/**
 * A 3D level: compact `start` into any downward-closed shape, inside the
 * bounding box of `start` (the in-place restriction of Peters et al.).
 */
export interface Level3D extends LevelBase {
	mode: "3d";
	start: [number, number, number][];
}

export type Level = Level2D | Level3D;

export function toConfiguration(cells: [number, number][] | [number, number, number][]): Configuration {
	return new Configuration(cells.map((c): Cell => [c[0], c[1], c[2] ?? 0]));
}

/** Parses and validates a level, e.g. from a JSON file. Throws with a readable message. */
export function parseLevel(data: unknown): Level {
	const fail = (message: string): never => {
		throw new Error(`Invalid level: ${message}`);
	};
	if (typeof data !== "object" || data === null) fail("expected a JSON object.");
	const raw = data as Record<string, unknown>;
	const mode = raw.mode;
	if (mode !== "2d" && mode !== "3d") return fail('"mode" must be "2d" or "3d".');
	const dims = mode === "2d" ? 2 : 3;
	const cells = (value: unknown, field: string) => {
		if (!Array.isArray(value) || value.length < 2) fail(`"${field}" must list at least two cells.`);
		const list = value as unknown[];
		for (const c of list) {
			if (!Array.isArray(c) || c.length !== dims || !c.every(Number.isInteger)) fail(`every cell in "${field}" must be ${dims} integers.`);
		}
		const config = toConfiguration(list as [number, number][]);
		if (config.size !== list.length) fail(`"${field}" lists a cell twice.`);
		if (!isConnected(config)) fail(`"${field}" is not connected.`);
		return list;
	};
	const start = cells(raw.start, "start");
	const base = {
		id: typeof raw.id === "string" && raw.id ? raw.id : `custom-${Date.now()}`,
		name: typeof raw.name === "string" && raw.name ? raw.name : "Custom level",
		description: typeof raw.description === "string" ? raw.description : "",
	};
	let par: Par | undefined;
	if (raw.par !== undefined) {
		const p = raw.par as Record<string, unknown>;
		if (!Number.isInteger(p?.solver) || (p.shortest !== undefined && !Number.isInteger(p.shortest))) {
			fail('"par" must be {"solver": moves, "shortest"?: moves}.');
		}
		par = { solver: p.solver as number, ...(p.shortest !== undefined && { shortest: p.shortest as number }) };
	}
	if (mode === "2d") {
		const target = cells(raw.target, "target");
		if (target.length !== start.length) fail('"start" and "target" need the same number of squares.');
		return { mode, ...base, start: start as [number, number][], target: target as [number, number][], ...(par && { par }) };
	}
	return { mode, ...base, start: start as [number, number, number][], ...(par && { par }) };
}

/** A level as JSON, in the same format parseLevel reads. */
export function levelToJson(level: Level): string {
	// Generated solutions are not part of the format.
	const copy: Record<string, unknown> = { ...level };
	delete copy.solution;
	delete copy.optimal;
	// One cell per line, e.g. [1, 2], instead of one number per line.
	return JSON.stringify(copy, null, "\t").replace(/\[\s*(-?\d+),\s*(-?\d+)(?:,\s*(-?\d+))?\s*\]/g, (_, x, y, z) =>
		z === undefined ? `[${x}, ${y}]` : `[${x}, ${y}, ${z}]`,
	);
}

const withMode = <M extends Level["mode"]>(mode: M, list: object[]) => list.map((l) => parseLevel({ ...l, mode }) as Extract<Level, { mode: M }>);

/** The curated levels, in order of difficulty, from levels.json. */
export const levels2D: Level2D[] = withMode("2d", curated["2d"]);
export const levels3D: Level3D[] = withMode("3d", curated["3d"]);

export const allLevels: Level[] = [...levels2D, ...levels3D];
