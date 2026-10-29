/// <reference lib="webworker" />
import { type SolverRequest, type SolverResponse, solveLevel } from "./index";

// Solving can take a while (the 2D algorithm needs O(n³) moves), so it runs off the main thread.
self.onmessage = (event: MessageEvent<SolverRequest>) => {
	const { id, level } = event.data;
	const started = performance.now();
	let response: SolverResponse;
	try {
		response = { id, ok: true, output: solveLevel(level), ms: performance.now() - started };
	} catch (error) {
		response = { id, ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	self.postMessage(response);
};
