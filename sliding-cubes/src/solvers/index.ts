import { type Level, toConfiguration } from "@/game/levels";
import type { SolverOutput } from "./common";
import { solve2D } from "./dumitrescuPach";
import { compact3D } from "./peters";

export type { Phase, SolverOutput } from "./common";
export { SolverError } from "./common";

/** Runs the paper's solver for the level's mode: Dumitrescu–Pach in 2D, Peters et al. in 3D. */
export function solveLevel(level: Level): SolverOutput {
	return level.mode === "2d" ? solve2D(toConfiguration(level.start), toConfiguration(level.target)) : compact3D(toConfiguration(level.start));
}

export type SolverRequest = { id: number; level: Level };
export type SolverResponse = { id: number; ok: true; output: SolverOutput; ms: number } | { id: number; ok: false; error: string };
