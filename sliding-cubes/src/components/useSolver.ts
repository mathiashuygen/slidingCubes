"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Cell } from "@/engine";
import type { Level } from "@/game/levels";
import type { SolverRequest, SolverResponse } from "@/solvers";

type RequestWithoutId = SolverRequest extends infer R ? (R extends SolverRequest ? Omit<R, "id"> : never) : never;

/**
 * Runs the paper solvers in a Web Worker. `solve` and `hint` resolve with the
 * worker's response; `cancel` stops a running request (the worker is
 * restarted lazily).
 */
export function useSolver() {
	const worker = useRef<Worker | null>(null);
	const nextId = useRef(0);
	const pending = useRef(new Map<number, (response: SolverResponse) => void>());

	const cancel = useCallback(() => {
		worker.current?.terminate();
		worker.current = null;
		for (const [id, resolve] of pending.current) resolve({ id, ok: false, error: "Cancelled." });
		pending.current.clear();
	}, []);

	useEffect(() => cancel, [cancel]);

	const send = useCallback((request: RequestWithoutId) => {
		if (!worker.current) {
			worker.current = new Worker(new URL("../solvers/solver.worker.ts", import.meta.url), { type: "module" });
			worker.current.onmessage = (event: MessageEvent<SolverResponse>) => {
				pending.current.get(event.data.id)?.(event.data);
				pending.current.delete(event.data.id);
			};
		}
		const id = ++nextId.current;
		return new Promise<SolverResponse>((resolve) => {
			pending.current.set(id, resolve);
			worker.current!.postMessage({ ...request, id });
		});
	}, []);

	const solve = useCallback((level: Level) => send({ kind: "solve", level }), [send]);
	const hint = useCallback((level: Level, cells: Cell[]) => send({ kind: "hint", level, cells }), [send]);

	return { solve, hint, cancel };
}
