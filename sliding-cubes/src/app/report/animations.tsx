"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useMemo, useState } from "react";
import { type Box, type Cell, Configuration, type Move, rules2D } from "@/engine";
import { MoveRecorder } from "@/solvers/common";
import { relocateChain } from "@/solvers/dumitrescuPach";
import { compact3D } from "@/solvers/peters";
import type { ColorGroup } from "./MoveScene";

// Three.js needs the browser, so the scenes are never prerendered.
const MoveScene = dynamic(() => import("./MoveScene"), {
	ssr: false,
	loading: () => <div className="h-64 w-full rounded-md bg-zinc-50 dark:bg-zinc-900" />,
});

interface Case {
	start: Cell[];
	moves: Move[];
	box?: Box;
	groups: ColorGroup[];
	/** What the moves are, for the counter. */
	operation: string;
	stepMs: number;
}

const AMBER = "#fcd34d";
const RED = "#f43f5e";

/** The first operation the solver performs from `start`: the one that resolves the stuck state. */
function firstOperation(start: Cell[], box?: Box): { moves: Move[]; name: string } {
	const output = compact3D(new Configuration(start), box);
	const phase = output.phases[0];
	return { moves: output.moves.slice(phase.start, phase.end), name: phase.name };
}

const CASES: Record<string, () => Case> = {
	pinned() {
		const start: Cell[] = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [1, 2, 1], [2, 0, 0], [2, 1, 0], [2, 2, 0], [2, 2, 1], [3, 0, 0], [4, 0, 0]];
		const { moves, name } = firstOperation(start);
		return {
			start, moves, box: new Configuration(start).boundingBox(), operation: name, stepMs: 700,
			groups: [{ cells: [[2, 2, 0]], color: RED }, { cells: [[2, 0, 0], [2, 1, 0], [3, 0, 0], [4, 0, 0]], color: AMBER }],
		};
	},
	gather() {
		const start: Cell[] = [[0, 0, 0], [0, 1, 0], [0, 2, 0], [0, 2, 1], [0, 2, 2], [1, 2, 2], [2, 0, 0], [2, 2, 2], [3, 0, 0],
			[3, 2, 1], [3, 2, 2], [4, 0, 0], [4, 1, 0], [4, 2, 0], [4, 2, 1], [5, 0, 0]];
		const box: Box = { min: [0, 0, 0], max: [6, 2, 2] };
		const { moves, name } = firstOperation(start, box);
		return {
			start, moves, box, operation: name, stepMs: 550,
			groups: [{ cells: [[4, 2, 0]], color: RED }, { cells: [[2, 0, 0], [3, 0, 0], [4, 0, 0], [5, 0, 0], [4, 1, 0]], color: AMBER }],
		};
	},
	thin() {
		const start: Cell[] = [[0, 0, 0], [2, 0, 8]];
		for (let z = 0; z <= 8; z++) start.push([1, 0, z], [3, 0, z]);
		const { moves, name } = firstOperation(start);
		const leg: Cell[] = Array.from({ length: 9 }, (_, z): Cell => [3, 0, z]);
		return { start, moves, box: new Configuration(start).boundingBox(), operation: name, stepMs: 260, groups: [{ cells: leg, color: AMBER }] };
	},
	chain() {
		const start: Cell[] = [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]];
		const recorder = new MoveRecorder(new Configuration(start), rules2D);
		relocateChain(recorder, { x: 0, y: 0, length: 4 }, { x: 1, y: 1, length: 4 });
		return {
			start, moves: recorder.output().moves, operation: "relocate chain (one row up, one column right)", stepMs: 450,
			groups: [{ cells: start, color: AMBER }],
		};
	},
};

export function CaseAnimation({ name, caption }: { name: keyof typeof CASES; caption: ReactNode }) {
	const data = useMemo(() => {
		try {
			return CASES[name]();
		} catch (e) {
			return e as Error;
		}
	}, [name]);
	const [playing, setPlaying] = useState(true);
	const [restart, setRestart] = useState(0);
	const [step, setStep] = useState(0);

	const button = "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
	return (
		<figure className="my-2 flex flex-col gap-2">
			{data instanceof Error ? (
				<p className="text-sm text-rose-600">The solver failed on this case: {data.message}</p>
			) : (
				<>
					<MoveScene {...data} playing={playing} restart={restart} onStep={setStep} />
					<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
						<button type="button" className={button} onClick={() => setPlaying((p) => !p)}>
							{playing ? "Pause" : "Play"}
						</button>
						<button type="button" className={button} onClick={() => setRestart((r) => r + 1)}>
							Restart
						</button>
						<span className="font-mono">
							move {Math.min(step + 1, data.moves.length)} / {data.moves.length}
						</span>
						<span className="truncate">· {data.operation}</span>
						<span className="ml-auto">drag to rotate</span>
					</div>
				</>
			)}
			<figcaption className="text-sm text-zinc-500">{caption}</figcaption>
		</figure>
	);
}
