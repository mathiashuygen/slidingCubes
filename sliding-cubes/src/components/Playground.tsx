"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { type Cell, checkMove, legalMovesFrom, localDestinations } from "@/engine";
import { type Feedback, formatMoves, gameReducer, initGame, moduleNoun, parseMoves } from "@/game/gameState";
import { generateLevel2D, generateLevel3D } from "@/game/generator";
import { type Level, levels2D, levels3D } from "@/game/levels";
import type { Move } from "@/engine";
import type { Phase } from "@/solvers";
import { shortestSolution } from "@/solvers/bfs";
import { Board2D } from "./Board2D";
import { useSolver } from "./useSolver";

// Three.js needs the browser, so the 3D board is never prerendered.
const Board3D = dynamic(() => import("./Board3D"), {
	ssr: false,
	loading: () => <p className="text-sm text-zinc-500">Loading 3D view…</p>,
});

const PLAY_INTERVAL_MS = 450;

const button =
	"rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800";

const feedbackStyle: Record<Feedback["tone"], string> = {
	error: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100",
	info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
	success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
};

const levelsByMode = { "2d": levels2D, "3d": levels3D } as const;

/** Up to this many modules, brute-force search finds a shortest solution quickly. */
const BFS_LIMIT = { "2d": 7, "3d": 6 } as const;

const SOLVER_NAMES = { "2d": "Dumitrescu–Pach", "3d": "Peters et al." } as const;

type SolverRun =
	| { status: "idle" }
	| { status: "running" }
	| { status: "done"; moves: Move[]; phases: Phase[]; ms: number }
	| { status: "error"; message: string };

/** Debug viewer for both modes: play by clicking, or load a move list and step through it. */
export function Playground() {
	const [state, dispatch] = useReducer(gameReducer, levels2D[0], initGame);
	const [movesText, setMovesText] = useState("");
	const [textError, setTextError] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);
	const [solverRun, setSolverRun] = useState<SolverRun>({ status: "idle" });
	const { solve, cancel } = useSolver();

	const { config, moves, cursor, selected, rules, level } = state;
	const stateRef = useRef(state);
	useEffect(() => {
		stateRef.current = state;
	});
	const mode = level.mode;
	const noun = moduleNoun(state);
	const isPlaying = playing && cursor < moves.length;

	const destinations = useMemo(() => (selected ? legalMovesFrom(config, selected, rules) : []), [config, selected, rules]);
	// In 3D, illegal local destinations are shown too: empty cells are hard to click otherwise.
	const candidates = useMemo(
		() =>
			selected
				? localDestinations(selected, rules)
						.filter((to) => !config.has(to))
						.map((to) => ({ to, check: checkMove(config, { from: selected, to }, rules) }))
				: [],
		[config, selected, rules],
	);

	useEffect(() => {
		if (!isPlaying) return;
		const id = setInterval(() => dispatch({ type: "redo" }), PLAY_INTERVAL_MS);
		return () => clearInterval(id);
	}, [isPlaying]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.target instanceof HTMLElement && e.target.closest("textarea, select, input")) return;
			if (e.key === "ArrowLeft") dispatch({ type: "undo" });
			else if (e.key === "ArrowRight") dispatch({ type: "redo" });
			else if (e.key === "Escape") dispatch({ type: "deselect" });
			else return;
			e.preventDefault();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	function loadLevel(next: Level) {
		cancel();
		setSolverRun({ status: "idle" });
		dispatch({ type: "load-level", level: next });
		setMovesText("");
		setTextError(null);
		setPlaying(false);
	}

	function loadMoves() {
		try {
			dispatch({ type: "load-moves", moves: parseMoves(movesText) });
			setTextError(null);
		} catch (e) {
			setTextError(e instanceof Error ? e.message : String(e));
		}
		setPlaying(false);
	}

	function loadSolution(moves: Move[]) {
		setMovesText(formatMoves(moves, mode));
		setTextError(null);
		dispatch({ type: "load-moves", moves });
		setPlaying(false);
	}

	async function runPaperSolver() {
		const forLevel = level;
		setSolverRun({ status: "running" });
		const response = await solve(forLevel);
		// Ignore results for a level the player has since left.
		if (forLevel !== stateRef.current.level) return;
		if (!response.ok) {
			setSolverRun({ status: "error", message: response.error });
			return;
		}
		setSolverRun({ status: "done", moves: response.output.moves, phases: response.output.phases, ms: response.ms });
		loadSolution(response.output.moves);
	}

	/** The level's stored solution, a shortest one for small levels, or else the paper solver's. */
	function showSolution() {
		const solution =
			level.solution ?? (state.start.size <= BFS_LIMIT[mode] ? shortestSolution(state.start, state.goal, rules) : null);
		if (solution) loadSolution(solution);
		else void runPaperSolver();
	}

	function onCellClick(cell: Cell) {
		setPlaying(false);
		dispatch({ type: "click", cell });
	}

	const levels: readonly Level[] = levelsByMode[mode];

	return (
		<div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
			<main className="flex h-[60vh] flex-1 items-center justify-center p-4 lg:h-auto">
				{mode === "2d" ? (
					<Board2D
						config={config}
						start={state.start}
						target={state.target!}
						selected={selected}
						destinations={destinations}
						feedback={state.feedback}
						lastStep={state.lastStep}
						onCellClick={onCellClick}
					/>
				) : (
					<Board3D
						// Remount per level, so the camera frames the new box.
						key={level.id}
						config={config}
						box={state.box!}
						selected={selected}
						candidates={candidates}
						feedback={state.feedback}
						lastStep={state.lastStep}
						onCellClick={onCellClick}
						onDeselect={() => dispatch({ type: "deselect" })}
					/>
				)}
			</main>

			<aside className="flex w-full flex-col gap-5 overflow-y-auto border-zinc-200 p-5 lg:w-96 lg:border-l dark:border-zinc-800">
				<header className="flex flex-col gap-2">
					<h1 className="text-lg font-semibold">Sliding cubes and squares</h1>
					<div className="flex gap-1.5" role="tablist">
						{(["2d", "3d"] as const).map((m) => (
							<button
								key={m}
								role="tab"
								aria-selected={mode === m}
								className={`${button} ${mode === m ? "bg-zinc-900 text-white hover:bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-100" : ""}`}
								onClick={() => mode !== m && loadLevel(levelsByMode[m][0])}
							>
								{m === "2d" ? "2D squares" : "3D cubes"}
							</button>
						))}
					</div>
					<p className="text-sm text-zinc-500">
						{mode === "2d"
							? "Click a square, then one of its highlighted destinations. Match the target shape."
							: "Drag to orbit, scroll to zoom. Click a cube, then a destination. Pack the cubes into the green corner of the box (the origin), leaving no gaps towards it."}
					</p>
				</header>

				<section className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor="level">
						Level
					</label>
					<select
						id="level"
						className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
						value={level.id}
						onChange={(e) => {
							const next = levels.find((l) => l.id === e.target.value);
							if (next) loadLevel(next);
						}}
					>
						{levels.map((l) => (
							<option key={l.id} value={l.id}>
								{l.name} ({l.start.length} {noun}s)
							</option>
						))}
						{!levels.includes(level) && (
							<option value={level.id}>
								{level.name} ({level.start.length} {noun}s)
							</option>
						)}
					</select>
					<p className="text-sm text-zinc-500">{level.description}</p>
				</section>

				<RandomLevelForm key={mode} mode={mode} onGenerate={loadLevel} />

				<section className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between">
						<span className="text-sm font-medium">Moves</span>
						<span className="font-mono text-sm tabular-nums">
							{cursor} / {moves.length}
						</span>
					</div>
					<div className="flex flex-wrap gap-1.5">
						<button className={button} disabled={cursor === 0} onClick={() => dispatch({ type: "seek", cursor: 0 })} title="Go to start">
							⏮
						</button>
						<button className={button} disabled={cursor === 0} onClick={() => dispatch({ type: "undo" })} title="Undo (←)">
							◀
						</button>
						<button
							className={button}
							disabled={moves.length === 0}
							onClick={() => {
								if (isPlaying) return setPlaying(false);
								if (cursor === moves.length) dispatch({ type: "seek", cursor: 0 });
								setPlaying(true);
							}}
						>
							{isPlaying ? "Pause" : "Play"}
						</button>
						<button className={button} disabled={cursor === moves.length} onClick={() => dispatch({ type: "redo" })} title="Redo (→)">
							▶
						</button>
						<button
							className={button}
							disabled={cursor === moves.length}
							onClick={() => dispatch({ type: "seek", cursor: moves.length })}
							title="Go to end"
						>
							⏭
						</button>
						<button
							className={button}
							onClick={() => {
								dispatch({ type: "restart" });
								setPlaying(false);
							}}
							title="Back to the start position and clear all moves"
						>
							Reset
						</button>
					</div>
					{state.feedback && (
						<p className={`rounded-md border px-3 py-2 text-sm ${feedbackStyle[state.feedback.tone]}`}>{state.feedback.message}</p>
					)}
				</section>

				{mode === "2d" ? (
					<section className="flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
						<span className="font-medium text-zinc-900 dark:text-zinc-100">Legend</span>
						<Legend className="fill-sky-500" round>
							slide destination
						</Legend>
						<Legend className="fill-violet-500" round>
							convex transition destination
						</Legend>
						<Legend className="fill-none stroke-amber-500">supporting neighbours (hover a destination)</Legend>
						<Legend className="fill-none stroke-zinc-400" dashed>
							corner that must stay empty
						</Legend>
						<Legend className="fill-emerald-500/10 stroke-emerald-500" dashed>
							target
						</Legend>
						<Legend className="fill-sky-500 stroke-emerald-200">square already on a target cell</Legend>
					</section>
				) : (
					<section className="flex flex-col gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
						<span className="font-medium text-zinc-900 dark:text-zinc-100">Legend</span>
						<Legend className="fill-sky-500">slide destination</Legend>
						<Legend className="fill-violet-500">convex transition destination</Legend>
						<Legend className="fill-zinc-400/50">not allowed (click it to see why)</Legend>
						<Legend className="fill-none stroke-amber-500">supporting neighbours (hover a destination)</Legend>
						<Legend className="fill-none stroke-zinc-400">corner that must stay empty</Legend>
						<Legend className="fill-none stroke-emerald-500">the box; one cube may step just outside it</Legend>
						<Legend className="fill-emerald-500/20 stroke-emerald-500">walls meeting at the origin: the corner to fill</Legend>
						<span>Axes start at the origin: x red, y green, z blue (up). Hover a cube to see its coordinates.</span>
					</section>
				)}

				<SolverPanel
					name={SOLVER_NAMES[mode]}
					run={solverRun}
					// Phases describe the solver's moves only while those are the loaded moves.
					current={solverRun.status === "done" && solverRun.moves === moves ? solverRun : null}
					cursor={cursor}
					onRun={() => void runPaperSolver()}
					onCancel={() => {
						cancel();
						setSolverRun({ status: "idle" });
					}}
					onSeek={(index) => {
						setPlaying(false);
						dispatch({ type: "seek", cursor: index });
					}}
				/>

				<section className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor="moves">
						Move list (JSON)
					</label>
					<textarea
						id="moves"
						className="h-40 rounded-md border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
						placeholder={mode === "2d" ? '[\n  {"from": [1, 1], "to": [0, 1]}\n]' : '[\n  {"from": [1, 0, 1], "to": [0, 0, 1]}\n]'}
						spellCheck={false}
						value={movesText}
						onChange={(e) => setMovesText(e.target.value)}
					/>
					{textError && <p className="text-sm text-rose-600 dark:text-rose-400">{textError}</p>}
					<div className="flex flex-wrap gap-1.5">
						<button className={button} disabled={movesText.trim() === ""} onClick={loadMoves}>
							Load moves
						</button>
						<button className={button} disabled={moves.length === 0} onClick={() => setMovesText(formatMoves(moves, mode))}>
							Export my moves
						</button>
						<button
							className={button}
							onClick={showSolution}
							title="The level's known solution, a shortest one for small levels, or else the paper solver's"
						>
							Show solution
						</button>
					</div>
					<p className="text-xs text-zinc-500">
						Loading replays the list through the rules engine from the level start and stops at the first illegal move.
					</p>
				</section>
			</aside>
		</div>
	);
}

function SolverPanel({
	name,
	run,
	current,
	cursor,
	onRun,
	onCancel,
	onSeek,
}: {
	name: string;
	run: SolverRun;
	current: { moves: Move[]; phases: Phase[]; ms: number } | null;
	cursor: number;
	onRun: () => void;
	onCancel: () => void;
	onSeek: (index: number) => void;
}) {
	// The phase of the move just played, or of the first move at the start.
	const index = Math.max(cursor - 1, 0);
	const active = current?.phases.findIndex((p) => index >= p.start && index < p.end) ?? -1;

	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between gap-2">
				<span className="text-sm font-medium">Paper solver</span>
				<span className="text-xs text-zinc-500">{name}</span>
			</div>
			<div className="flex flex-wrap gap-1.5">
				<button className={button} disabled={run.status === "running"} onClick={onRun}>
					{run.status === "running" ? "Solving…" : "Run solver"}
				</button>
				{run.status === "running" && (
					<button className={button} onClick={onCancel}>
						Cancel
					</button>
				)}
			</div>
			{run.status === "error" && <p className="text-sm text-rose-600 dark:text-rose-400">{run.message}</p>}
			{current && (
				<>
					<p className="text-xs text-zinc-500">
						{current.moves.length} moves in {current.phases.length} steps, found in {Math.max(1, Math.round(current.ms))} ms. Every move was checked by the
						rules engine.
					</p>
					<ol className="max-h-48 overflow-y-auto rounded-md border border-zinc-200 text-xs dark:border-zinc-800">
						{current.phases.map((phase, i) => (
							<li key={i}>
								<button
									className={`flex w-full justify-between gap-2 px-2 py-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
										i === active ? "bg-amber-100 font-medium dark:bg-amber-900/40" : ""
									}`}
									onClick={() => onSeek(phase.start)}
									title="Jump to the start of this step"
								>
									<span>{phase.name}</span>
									<span className="shrink-0 font-mono tabular-nums text-zinc-500">
										{phase.start + 1}–{phase.end}
									</span>
								</button>
							</li>
						))}
					</ol>
				</>
			)}
		</section>
	);
}

const DIFFICULTIES = {
	"2d": {
		easy: { size: 5, scrambleMoves: 6 },
		medium: { size: 8, scrambleMoves: 15 },
		hard: { size: 14, scrambleMoves: 40 },
	},
	"3d": {
		easy: { size: 4, scrambleMoves: 0 },
		medium: { size: 6, scrambleMoves: 0 },
		hard: { size: 10, scrambleMoves: 0 },
	},
};

const randomSeed = () => Math.floor(Math.random() * 100_000);

/** An emptied number input reports NaN; show it as empty rather than "NaN". */
const inputValue = (n: number) => (Number.isNaN(n) ? "" : n);

function RandomLevelForm({ mode, onGenerate }: { mode: Level["mode"]; onGenerate: (level: Level) => void }) {
	const difficulties = DIFFICULTIES[mode];
	const [size, setSize] = useState(difficulties.medium.size);
	const [scrambleMoves, setScrambleMoves] = useState(difficulties.medium.scrambleMoves);
	const [seed, setSeed] = useState(1);
	const [error, setError] = useState<string | null>(null);

	function generate(options: { size: number; scrambleMoves: number; seed: number }) {
		try {
			onGenerate(mode === "2d" ? generateLevel2D(options) : generateLevel3D(options));
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}

	const input = "w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm tabular-nums dark:border-zinc-700";

	return (
		<section className="flex flex-col gap-2">
			<span className="text-sm font-medium">Random level</span>
			<div className="flex flex-wrap gap-1.5">
				{(Object.keys(difficulties) as (keyof typeof difficulties)[]).map((name) => (
					<button
						key={name}
						className={`${button} capitalize`}
						onClick={() => {
							const options = { ...difficulties[name], seed: randomSeed() };
							setSize(options.size);
							setScrambleMoves(options.scrambleMoves);
							setSeed(options.seed);
							generate(options);
						}}
					>
						{name}
					</button>
				))}
			</div>
			<form
				className={`grid gap-2 ${mode === "2d" ? "grid-cols-3" : "grid-cols-2"}`}
				onSubmit={(e) => {
					e.preventDefault();
					generate({ size, scrambleMoves, seed });
				}}
			>
				<label className="flex flex-col gap-1 text-xs text-zinc-500">
					{mode === "2d" ? "Squares" : "Cubes"}
					<input className={input} type="number" min={3} max={40} value={inputValue(size)} onChange={(e) => setSize(e.target.valueAsNumber)} />
				</label>
				{mode === "2d" && (
					<label className="flex flex-col gap-1 text-xs text-zinc-500">
						Scramble
						<input
							className={input}
							type="number"
							min={1}
							max={200}
							value={inputValue(scrambleMoves)}
							onChange={(e) => setScrambleMoves(e.target.valueAsNumber)}
						/>
					</label>
				)}
				<label className="flex flex-col gap-1 text-xs text-zinc-500">
					Seed
					<input className={input} type="number" min={0} value={inputValue(seed)} onChange={(e) => setSeed(e.target.valueAsNumber)} />
				</label>
				<button type="submit" className={`${button} ${mode === "2d" ? "col-span-3" : "col-span-2"}`}>
					Generate
				</button>
			</form>
			{error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
			<p className="text-xs text-zinc-500">
				{mode === "2d"
					? "The same squares, scramble and seed always give the same level. Every generated level comes with a solution checked by the rules engine."
					: "The same cubes and seed always give the same level. Levels up to 6 cubes come with a shortest solution; larger ones with the paper solver’s solution."}
			</p>
		</section>
	);
}

function Legend({ className, round, dashed, children }: { className: string; round?: boolean; dashed?: boolean; children: string }) {
	return (
		<span className="flex items-center gap-2">
			<svg viewBox="0 0 1 1" className="h-4 w-4 shrink-0">
				{round ? (
					<circle cx={0.5} cy={0.5} r={0.25} className={className} />
				) : (
					<rect x={0.1} y={0.1} width={0.8} height={0.8} rx={0.15} strokeWidth={0.1} strokeDasharray={dashed ? "0.15 0.1" : undefined} className={className} />
				)}
			</svg>
			{children}
		</span>
	);
}
