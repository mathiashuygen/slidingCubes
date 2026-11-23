/// <reference lib="webworker" />
import { type SolverRequest, type SolverResponse, hintFor, solveLevel } from "./index";

// Solving can take a while (the 2D algorithm needs O(n³) moves), so it runs off the main thread.
self.onmessage = (event: MessageEvent<SolverRequest>) => {
	const request = event.data;
	const started = performance.now();
	let response: SolverResponse;
	try {
		const ms = () => performance.now() - started;
		response =
			request.kind === "solve"
				? { id: request.id, ok: true, kind: "solve", output: solveLevel(request.level), ms: ms() }
				: { id: request.id, ok: true, kind: "hint", hint: hintFor(request.level, request.cells), ms: ms() };
	} catch (error) {
		response = { id: request.id, ok: false, error: error instanceof Error ? error.message : String(error) };
	}
	self.postMessage(response);
};
