"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Level } from "@/game/levels";
import type { SolverRequest, SolverResponse } from "@/solvers";

/**
 * Runs the paper solvers in a Web Worker. `solve` resolves with the worker's
 * response; `cancel` stops a running solve (the worker is restarted lazily).
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

	const solve = useCallback((level: Level) => {
		if (!worker.current) {
			worker.current = new Worker(new URL("../solvers/solver.worker.ts", import.meta.url), { type: "module" });
			worker.current.onmessage = (event: MessageEvent<SolverResponse>) => {
				pending.current.get(event.data.id)?.(event.data);
				pending.current.delete(event.data.id);
			};
		}
		const id = ++nextId.current;
		const request: SolverRequest = { id, level };
		return new Promise<SolverResponse>((resolve) => {
			pending.current.set(id, resolve);
			worker.current!.postMessage(request);
		});
	}, []);

	return { solve, cancel };
}
