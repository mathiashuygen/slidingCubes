"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { legalMovesFrom, matchesTarget, rules2D } from "@/engine";
import { type Feedback, formatMoves, gameReducer, initGame, parseMoves } from "@/game/gameState";
import { generateLevel2D } from "@/game/generator";
import { type Level2D, levels2D } from "@/game/levels";
import { shortestSolution } from "@/solvers/bfs";
import { Board2D } from "./Board2D";

const PLAY_INTERVAL_MS = 450;

const button =
	"rounded-md border border-zinc-300 px-2.5 py-1 text-sm hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:border-zinc-700 dark:hover:bg-zinc-800";

const feedbackStyle: Record<Feedback["tone"], string> = {
	error: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100",
	info: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100",
	success: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100",
};

/** 2D debug viewer: play by clicking, or load a move list and step through it. */
export function Playground2D() {
	const [state, dispatch] = useReducer(gameReducer, levels2D[0], initGame);
	const [movesText, setMovesText] = useState("");
	const [textError, setTextError] = useState<string | null>(null);
	const [playing, setPlaying] = useState(false);

	const { config, moves, cursor, selected } = state;
	const isPlaying = playing && cursor < moves.length;

	const destinations = useMemo(
		() => (selected ? legalMovesFrom(config, selected, rules2D) : []),
		[config, selected],
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

	function loadMoves() {
		try {
			dispatch({ type: "load-moves", moves: parseMoves(movesText) });
			setTextError(null);
		} catch (e) {
			setTextError(e instanceof Error ? e.message : String(e));
		}
		setPlaying(false);
	}

	function showSolution() {
		const solution = state.level.solution ?? shortestSolution(state.start, matchesTarget(state.target), rules2D);
		if (!solution) {
			setTextError("BFS found no solution within its state limit.");
			return;
		}
		setMovesText(formatMoves(solution));
		setTextError(null);
		dispatch({ type: "load-moves", moves: solution });
		setPlaying(false);
	}

	return (
		<div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
			<main className="flex min-h-[60vh] flex-1 items-center justify-center p-4">
				<Board2D
					config={config}
					start={state.start}
					target={state.target}
					selected={selected}
					destinations={destinations}
					feedback={state.feedback}
					lastStep={state.lastStep}
					onCellClick={(cell) => {
						setPlaying(false);
						dispatch({ type: "click", cell });
					}}
				/>
			</main>

			<aside className="flex w-full flex-col gap-5 overflow-y-auto border-zinc-200 p-5 lg:w-96 lg:border-l dark:border-zinc-800">
				<header>
					<h1 className="text-lg font-semibold">Sliding squares · 2D debug viewer</h1>
					<p className="text-sm text-zinc-500">Click a square, then one of its highlighted destinations.</p>
				</header>

				<section className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor="level">
						Level
					</label>
					<select
						id="level"
						className="rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700"
						value={state.level.id}
						onChange={(e) => {
							const level = levels2D.find((l) => l.id === e.target.value);
							if (level) dispatch({ type: "load-level", level });
							setPlaying(false);
						}}
					>
						{levels2D.map((l) => (
							<option key={l.id} value={l.id}>
								{l.name} ({l.start.length} squares)
							</option>
						))}
						{!levels2D.includes(state.level) && (
							<option value={state.level.id}>
								{state.level.name} ({state.level.start.length} squares)
							</option>
						)}
					</select>
					<p className="text-sm text-zinc-500">{state.level.description}</p>
				</section>

				<RandomLevelForm
					onGenerate={(level) => {
						dispatch({ type: "load-level", level });
						setMovesText("");
						setTextError(null);
						setPlaying(false);
					}}
				/>

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

				<section className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor="moves">
						Move list (JSON)
					</label>
					<textarea
						id="moves"
						className="h-40 rounded-md border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
						placeholder={'[\n  {"from": [1, 1], "to": [0, 1]}\n]'}
						spellCheck={false}
						value={movesText}
						onChange={(e) => setMovesText(e.target.value)}
					/>
					{textError && <p className="text-sm text-rose-600 dark:text-rose-400">{textError}</p>}
					<div className="flex flex-wrap gap-1.5">
						<button className={button} disabled={movesText.trim() === ""} onClick={loadMoves}>
							Load moves
						</button>
						<button className={button} disabled={moves.length === 0} onClick={() => setMovesText(formatMoves(moves))}>
							Export my moves
						</button>
						<button
							className={button}
							onClick={showSolution}
							title="The level's known solution, or the shortest one by brute force (small levels only)"
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

const DIFFICULTIES = {
	easy: { size: 5, scrambleMoves: 6 },
	medium: { size: 8, scrambleMoves: 15 },
	hard: { size: 14, scrambleMoves: 40 },
};

const randomSeed = () => Math.floor(Math.random() * 100_000);

function RandomLevelForm({ onGenerate }: { onGenerate: (level: Level2D) => void }) {
	const [size, setSize] = useState(DIFFICULTIES.medium.size);
	const [scrambleMoves, setScrambleMoves] = useState(DIFFICULTIES.medium.scrambleMoves);
	const [seed, setSeed] = useState(1);
	const [error, setError] = useState<string | null>(null);

	function generate(options: { size: number; scrambleMoves: number; seed: number }) {
		try {
			onGenerate(generateLevel2D(options));
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
				{(Object.keys(DIFFICULTIES) as (keyof typeof DIFFICULTIES)[]).map((name) => (
					<button
						key={name}
						className={`${button} capitalize`}
						onClick={() => {
							const options = { ...DIFFICULTIES[name], seed: randomSeed() };
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
				className="grid grid-cols-3 gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					generate({ size, scrambleMoves, seed });
				}}
			>
				<label className="flex flex-col gap-1 text-xs text-zinc-500">
					Squares
					<input className={input} type="number" min={3} max={40} value={size} onChange={(e) => setSize(e.target.valueAsNumber)} />
				</label>
				<label className="flex flex-col gap-1 text-xs text-zinc-500">
					Scramble
					<input
						className={input}
						type="number"
						min={1}
						max={200}
						value={scrambleMoves}
						onChange={(e) => setScrambleMoves(e.target.valueAsNumber)}
					/>
				</label>
				<label className="flex flex-col gap-1 text-xs text-zinc-500">
					Seed
					<input className={input} type="number" min={0} value={seed} onChange={(e) => setSeed(e.target.valueAsNumber)} />
				</label>
				<button type="submit" className={`${button} col-span-3`}>
					Generate
				</button>
			</form>
			{error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
			<p className="text-xs text-zinc-500">
				The same squares, scramble and seed always give the same level. Every generated level comes with a solution checked by the rules engine.
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
