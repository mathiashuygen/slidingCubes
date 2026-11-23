"use client";

import { type MouseEvent, type PointerEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Cell, type CheckedMove, type Configuration, type Move, cellKey, equals, sub } from "@/engine";
import type { Feedback } from "@/game/gameState";

const PADDING = 2;
const STEP_MS = 260;

interface Board2DProps {
	config: Configuration;
	start: Configuration;
	target: Configuration;
	selected: Cell | null;
	destinations: CheckedMove[];
	feedback: Feedback | null;
	lastStep: { move: Move; id: number } | null;
	/** A suggested move, whose destination is marked. */
	hint?: Move | null;
	/** Cells to outline together, e.g. the 2×2 square a tutorial lesson is about. */
	focus?: Cell[];
	onCellClick: (cell: Cell) => void;
}

/**
 * SVG grid in cell units. Cell (x, y) covers [x, x + 1] × [-y - 1, -y] in SVG
 * coordinates, so y points up like in the papers.
 */
export function Board2D({ config, start, target, selected, destinations, feedback, lastStep, hint, focus, onCellClick }: Board2DProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [hovered, setHovered] = useState<Cell | null>(null);

	// Destinations are within one cell of the configuration, so the padding
	// covers them; including them would rescale the board on every selection.
	const view = useMemo(() => {
		const cells = [...start, ...target, ...config];
		const xs = cells.map((c) => c[0]);
		const ys = cells.map((c) => c[1]);
		const minX = Math.min(...xs) - PADDING;
		const maxX = Math.max(...xs) + PADDING;
		const minY = Math.min(...ys) - PADDING;
		const maxY = Math.max(...ys) + PADDING;
		return { minX, maxX, minY, maxY, width: maxX - minX + 1, height: maxY - minY + 1 };
	}, [start, target, config]);

	function cellAt(event: MouseEvent<SVGSVGElement> | PointerEvent<SVGSVGElement>): Cell | null {
		const svg = svgRef.current;
		const matrix = svg?.getScreenCTM()?.inverse();
		if (!svg || !matrix) return null;
		const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
		return [Math.floor(p.x), Math.floor(-p.y), 0];
	}

	const hoveredMove = hovered ? destinations.find((m) => equals(m.to, hovered)) : undefined;
	const problemCells = feedback?.tone === "error" ? feedback.cells : [];

	return (
		<svg
			ref={svgRef}
			viewBox={`${view.minX} ${-view.maxY - 1} ${view.width} ${view.height}`}
			className="h-full w-full cursor-pointer touch-manipulation select-none"
			onClick={(e) => {
				const cell = cellAt(e);
				if (cell) onCellClick(cell);
			}}
			onPointerMove={(e) => {
				const cell = cellAt(e);
				if (!cell || !hovered || !equals(cell, hovered)) setHovered(cell);
			}}
			onPointerLeave={() => setHovered(null)}
		>
			<g className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={0.02}>
				{Array.from({ length: view.width + 1 }, (_, i) => (
					<line key={`x${i}`} x1={view.minX + i} x2={view.minX + i} y1={-view.maxY - 1} y2={-view.minY} />
				))}
				{Array.from({ length: view.height + 1 }, (_, i) => (
					<line key={`y${i}`} y1={-view.minY - i} y2={-view.minY - i} x1={view.minX} x2={view.maxX + 1} />
				))}
			</g>

			{/* Origin marker, so coordinates in move lists are easy to place. */}
			<circle cx={0} cy={0} r={0.06} className="fill-zinc-400 dark:fill-zinc-600" />

			<g className="fill-emerald-500/10 stroke-emerald-500" strokeWidth={0.04} strokeDasharray="0.12 0.08">
				{[...target].map((c) => (
					<rect key={cellKey(c)} x={c[0] + 0.06} y={-c[1] - 1 + 0.06} width={0.88} height={0.88} rx={0.1} />
				))}
			</g>

			{[...config].map((c) => {
				const animate = lastStep && equals(lastStep.move.to, c) ? lastStep : null;
				return (
					<Square
						key={cellKey(c)}
						cell={c}
						selected={selected !== null && equals(selected, c)}
						step={animate}
						config={config}
					/>
				);
			})}

			{/* Inner ring on squares that already sit on a target cell. */}
			<g fill="none" className="stroke-emerald-200" strokeWidth={0.06}>
				{[...target]
					.filter((c) => config.has(c))
					.map((c) => (
						<rect key={cellKey(c)} x={c[0] + 0.24} y={-c[1] - 1 + 0.24} width={0.52} height={0.52} rx={0.08} />
					))}
			</g>

			{hoveredMove && (
				<g fill="none" strokeWidth={0.07}>
					{hoveredMove.check.support.map((c) => (
						<rect key={cellKey(c)} x={c[0] + 0.1} y={-c[1] - 1 + 0.1} width={0.8} height={0.8} rx={0.12} className="stroke-amber-500" />
					))}
					{hoveredMove.check.clearance.map((c) => (
						<rect key={cellKey(c)} x={c[0] + 0.1} y={-c[1] - 1 + 0.1} width={0.8} height={0.8} rx={0.12} strokeDasharray="0.1 0.08" className="stroke-zinc-400" />
					))}
				</g>
			)}

			{destinations.map((m) => (
				<circle
					key={cellKey(m.to)}
					cx={m.to[0] + 0.5}
					cy={-m.to[1] - 0.5}
					r={hoveredMove === m ? 0.22 : 0.16}
					className={m.check.type === "slide" ? "fill-sky-500" : "fill-violet-500"}
				/>
			))}

			{focus && focus.length > 0 && <FocusOutline cells={focus} />}

			{hint && (
				<rect
					x={hint.to[0] + 0.08}
					y={-hint.to[1] - 1 + 0.08}
					width={0.84}
					height={0.84}
					rx={0.14}
					fill="none"
					strokeWidth={0.08}
					strokeDasharray="0.14 0.08"
					className="animate-pulse stroke-amber-500"
				/>
			)}

			<g fill="none" strokeWidth={0.08} className="stroke-rose-500">
				{problemCells.map((c) => (
					<rect key={cellKey(c)} x={c[0] + 0.04} y={-c[1] - 1 + 0.04} width={0.92} height={0.92} rx={0.12} />
				))}
			</g>
		</svg>
	);
}

/** A dashed rectangle around the bounding box of `cells`. */
function FocusOutline({ cells }: { cells: Cell[] }) {
	const xs = cells.map((c) => c[0]);
	const ys = cells.map((c) => c[1]);
	const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs) + 1, Math.min(...ys), Math.max(...ys) + 1];
	return (
		<rect
			x={x0 - 0.04}
			y={-y1 - 0.04}
			width={x1 - x0 + 0.08}
			height={y1 - y0 + 0.08}
			rx={0.12}
			fill="none"
			strokeWidth={0.06}
			strokeDasharray="0.2 0.1"
			className="stroke-sky-600 dark:stroke-sky-400"
		/>
	);
}

interface SquareProps {
	cell: Cell;
	selected: boolean;
	/** Set when this square just arrived here, to animate the move. */
	step: { move: Move; id: number } | null;
	config: Configuration;
}

function Square({ cell, selected, step, config }: SquareProps) {
	const ref = useRef<SVGGElement>(null);

	useLayoutEffect(() => {
		if (!step || !ref.current) return;
		// SVG y points down, so negate the y offset.
		const offset = (c: Cell) => {
			const d = sub(c, cell);
			return `translate(${d[0]}px, ${-d[1]}px)`;
		};
		const { from, to } = step.move;
		const frames = [{ transform: offset(from) }];
		// A convex transition sweeps through the empty corner of its 2×2 square.
		const corners: Cell[] = [[to[0], from[1], 0], [from[0], to[1], 0]];
		const isConvex = from[0] !== to[0] && from[1] !== to[1];
		const clearance = corners.find((c) => !config.has(c));
		if (isConvex && clearance) frames.push({ transform: offset(clearance) });
		frames.push({ transform: "translate(0px, 0px)" });
		ref.current.animate(frames, { duration: STEP_MS, easing: "ease-in-out" });
		// Only a new step should animate, not other re-renders.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step?.id]);

	return (
		<g ref={ref}>
			<rect
				x={cell[0] + 0.06}
				y={-cell[1] - 1 + 0.06}
				width={0.88}
				height={0.88}
				rx={0.1}
				strokeWidth={0.05}
				className={selected ? "fill-amber-400 stroke-amber-600" : "fill-sky-500 stroke-sky-700 dark:fill-sky-600 dark:stroke-sky-400"}
			/>
		</g>
	);
}
