import type { ReactNode } from "react";

/**
 * Small grid diagrams for the report. Each panel draws a window of the grid
 * with y pointing up, the in-place box, modules, marked cells and arrows.
 * All configurations are taken from the solver runs described in the text.
 */

type Kind =
	| "module" // an ordinary module
	| "root" // the low component containing the origin
	| "low" // the low component the operation works on
	| "focus" // the modules the caption is about
	| "pinned" // the pinned cube
	| "ghost" // a destination
	| "mark" // a marked empty cell, such as e
	| "outside"; // a cell the in-place rule rules out

interface GridCell {
	x: number;
	y: number;
	kind: Kind;
	label?: string;
	crossed?: boolean;
}

interface Arrow {
	points: [number, number][];
}

interface Range {
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}

interface PanelProps {
	id: string;
	title: string;
	view: Range;
	box?: Range;
	/** A region to outline, such as the 3×3 gathering square. */
	outline?: Range;
	cells: GridCell[];
	arrows?: Arrow[];
	axes: [string, string];
	size?: number;
}

const FILL: Record<Kind, string> = {
	module: "fill-sky-500",
	root: "fill-zinc-300 dark:fill-zinc-600",
	low: "fill-amber-300 dark:fill-amber-500",
	focus: "fill-rose-400 dark:fill-rose-500",
	pinned: "fill-amber-300 dark:fill-amber-500",
	ghost: "fill-none",
	mark: "fill-emerald-100 dark:fill-emerald-950",
	outside: "fill-rose-50 dark:fill-rose-950/40",
};

const STROKE: Partial<Record<Kind, string>> = {
	pinned: "stroke-rose-600 dark:stroke-rose-400",
	ghost: "stroke-sky-600 dark:stroke-sky-400",
	mark: "stroke-emerald-600 dark:stroke-emerald-400",
	outside: "stroke-rose-300 dark:stroke-rose-800",
};

const DASHED = new Set<Kind>(["ghost", "mark", "outside"]);

export function GridPanel({ id, title, view, box, outline, cells, arrows = [], axes, size = 26 }: PanelProps) {
	const pad = 22;
	const cols = view.x1 - view.x0 + 1;
	const rows = view.y1 - view.y0 + 1;
	const width = cols * size + pad * 2;
	const height = rows * size + pad * 2 + 18;
	// Cell (x, y) has its top-left corner here; y points up.
	const px = (x: number) => pad + (x - view.x0) * size;
	const py = (y: number) => pad + (view.y1 - y) * size;
	const cx = (x: number) => px(x) + size / 2;
	const cy = (y: number) => py(y) + size / 2;

	const grid: ReactNode[] = [];
	for (let x = view.x0; x <= view.x1; x++) {
		for (let y = view.y0; y <= view.y1; y++) {
			grid.push(
				<rect key={`g${x},${y}`} x={px(x)} y={py(y)} width={size} height={size} className="fill-none stroke-zinc-200 dark:stroke-zinc-800" />,
			);
		}
	}

	return (
		<svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" style={{ maxWidth: width * 1.25 }} role="img" aria-label={title}>
			<defs>
				<marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
					<path d="M0 0 L10 5 L0 10 z" className="fill-zinc-900 dark:fill-zinc-100" />
				</marker>
			</defs>
			{grid}
			{box && (
				<rect
					x={px(box.x0) - 1.5}
					y={py(box.y1) - 1.5}
					width={(box.x1 - box.x0 + 1) * size + 3}
					height={(box.y1 - box.y0 + 1) * size + 3}
					className="fill-none stroke-emerald-600 dark:stroke-emerald-400"
					strokeWidth={1.5}
					strokeDasharray="5 3"
				/>
			)}
			{outline && (
				<rect
					x={px(outline.x0) + 0.5}
					y={py(outline.y1) + 0.5}
					width={(outline.x1 - outline.x0 + 1) * size - 1}
					height={(outline.y1 - outline.y0 + 1) * size - 1}
					className="fill-none stroke-rose-500 dark:stroke-rose-400"
					strokeWidth={2}
					strokeDasharray="3 3"
				/>
			)}
			{cells.map((c) => (
				<g key={`${c.x},${c.y},${c.kind}`}>
					<rect
						x={px(c.x) + 2}
						y={py(c.y) + 2}
						width={size - 4}
						height={size - 4}
						rx={3}
						className={`${FILL[c.kind]} ${STROKE[c.kind] ?? "stroke-none"}`}
						strokeWidth={c.kind === "pinned" ? 3 : 1.5}
						strokeDasharray={DASHED.has(c.kind) ? "4 3" : undefined}
					/>
					{c.crossed && (
						<path
							d={`M${px(c.x) + 5} ${py(c.y) + 5} L${px(c.x) + size - 5} ${py(c.y) + size - 5} M${px(c.x) + size - 5} ${py(c.y) + 5} L${px(c.x) + 5} ${py(c.y) + size - 5}`}
							className="stroke-rose-600 dark:stroke-rose-400"
							strokeWidth={1.5}
						/>
					)}
					{c.label && (
						<text x={cx(c.x)} y={cy(c.y) + 4} textAnchor="middle" className="fill-zinc-900 text-[11px] font-semibold dark:fill-zinc-50">
							{c.label}
						</text>
					)}
				</g>
			))}
			{arrows.map((a, i) => (
				<polyline
					key={i}
					points={a.points.map(([x, y]) => `${cx(x)},${cy(y)}`).join(" ")}
					className="fill-none stroke-zinc-900 dark:stroke-zinc-100"
					strokeWidth={1.75}
					strokeLinejoin="round"
					markerEnd={`url(#${id}-arrow)`}
				/>
			))}
			<text x={pad} y={height - 6} className="fill-zinc-500 text-[10px]">
				{title} · {axes[0]} → , {axes[1]} ↑
			</text>
		</svg>
	);
}

function Figure({ caption, children }: { caption: ReactNode; children: ReactNode }) {
	return (
		<figure className="my-2 flex flex-col gap-2">
			<div className="flex flex-wrap items-end justify-center gap-4">{children}</div>
			<figcaption className="text-sm text-zinc-500">{caption}</figcaption>
		</figure>
	);
}

function Panel({ children }: { children: ReactNode }) {
	return <div className="min-w-0 flex-1 basis-56">{children}</div>;
}

const cells = (kind: Kind, list: [number, number][], label?: string): GridCell[] =>
	list.map(([x, y]) => ({ x, y, kind, label }));

/** Figure 2: the stuck state of the Lemma 11 case, as its two layers. */
export function PinnedStripFigure() {
	const view = { x0: 0, x1: 4, y0: -1, y1: 2 };
	const box = { x0: 0, x1: 4, y0: 0, y1: 2 };
	return (
		<Figure
			caption={
				<>
					Figure 2. Where the 3D solver stopped (bug 1). Grey: the floor component at the origin; blue:
					cubes at z = 1; dashed blue: the destination. The floor component L (amber) is attached to the
					rest only through the pillar on the pinned cube p (red ring), so the planar run on L may not move p.
					That pillar is L&apos;s only high component, and the proof of Lemma 11 then applies{" "}
					<span className="font-mono">[j]</span>: the rightmost cube of the strip moves to the left end of
					the row, passing just outside the box (dashed green). Our solver skipped the pinned pillar, so it
					found no operation.
				</>
			}
		>
			<Panel>
				<GridPanel
					id="fig2a"
					title="layer z = 1"
					view={{ ...view, y0: 0 }}
					box={box}
					axes={["x", "y"]}
					cells={cells("module", [[0, 2], [1, 2], [2, 2]])}
				/>
			</Panel>
			<Panel>
				<GridPanel
					id="fig2b"
					title="layer z = 0"
					view={view}
					box={box}
					axes={["x", "y"]}
					cells={[
						...cells("root", [[0, 0], [0, 1], [0, 2]]),
						...cells("low", [[2, 0], [2, 1], [3, 0], [4, 0]]),
						{ x: 2, y: 2, kind: "pinned", label: "p" },
						{ x: 1, y: 0, kind: "ghost" },
					]}
					arrows={[{ points: [[4, 0], [4, -1], [1, -1], [1, 0]] }]}
				/>
			</Panel>
		</Figure>
	);
}

/** Figure 3: [h] before and after gathering, floor layer only. */
export function GatherFigure() {
	const view = { x0: 0, x1: 6, y0: 0, y1: 2 };
	const box = view;
	const root = cells("root", [[0, 0], [0, 1], [0, 2]]);
	// The 3×3 square around c = (4, 2), cut off by the box at y = 2.
	const square = { x0: 3, x1: 5, y0: 1, y1: 2 };
	return (
		<Figure
			caption={
				<>
					Figure 3. Operation <span className="font-mono">[h]</span> (bug 2), floor layer z = 0. Grey: the
					floor component at the origin; amber: L; green: the empty cell e. The cube c (red) sits under the clearing pillar and holds L together, so cubes of L are first gathered into
					the 3×3 square around c (dashed red outline, cut off by the box). The empty cell e was chosen before
					gathering and lies inside that square, so the gathering fills it. The solver now chooses e again
					with the paper&apos;s rule (highest y, then highest x), here e′, and moves c there.
				</>
			}
		>
			<Panel>
				<GridPanel
					id="fig3a"
					title="before gathering"
					view={view}
					box={box}
					outline={square}
					axes={["x", "y"]}
					cells={[
						...root,
						...cells("low", [[2, 0], [3, 0], [4, 0], [5, 0], [4, 1]]),
						{ x: 4, y: 2, kind: "focus", label: "c" },
						{ x: 3, y: 2, kind: "mark", label: "e" },
					]}
				/>
			</Panel>
			<Panel>
				<GridPanel
					id="fig3b"
					title="after gathering"
					view={view}
					box={box}
					outline={square}
					axes={["x", "y"]}
					cells={[
						...root,
						...cells("low", [[3, 1], [4, 1], [5, 1], [5, 2]]),
						{ x: 3, y: 2, kind: "low", label: "e", crossed: true },
						{ x: 4, y: 2, kind: "focus", label: "c" },
						{ x: 2, y: 2, kind: "mark", label: "e′" },
					]}
					arrows={[{ points: [[4, 2.45], [4, 2.75], [2, 2.75], [2, 2.45]] }]}
				/>
			</Panel>
		</Figure>
	);
}

/** Figure 4: the thin bridge, side view of the box's only vertical plane. */
export function ThinBridgeFigure() {
	const view = { x0: 0, x1: 4, y0: 0, y1: 8 };
	const box = { x0: 0, x1: 3, y0: 0, y1: 8 };
	const column = (x: number, from: number, to: number): [number, number][] =>
		Array.from({ length: to - from + 1 }, (_, i) => [x, from + i]);
	const outside = cells("outside", column(4, 0, 8));
	return (
		<Figure
			caption={
				<>
					Figure 4. The one-cube-thick bridge (bug 3), seen from the side after the first pillar shove; the
					dashed green line is the box. The
					right leg P (red) must be shoved one column left onto the column under P′ with{" "}
					<span className="font-mono">[e]</span>. It has 9 cubes, so the paper uses the zipper, which needs a
					free helper column on a third side of P. Here that column is either outside the box (×), where
					the in-place rule allows only one cube, or the other leg. The solver now uses the short shove,
					which reaches the same result with more moves.
				</>
			}
		>
			<Panel>
				<GridPanel
					id="fig4a"
					title="stuck"
					view={view}
					box={box}
					axes={["x", "z"]}
					size={22}
					cells={[
						...cells("module", [[0, 0], ...column(1, 0, 8)]),
						{ x: 2, y: 8, kind: "module", label: "P′" },
						...cells("focus", column(3, 0, 7)),
						{ x: 3, y: 8, kind: "focus", label: "P" },
						...outside.map((c) => ({ ...c, label: "×" })),
					]}
				/>
			</Panel>
			<Panel>
				<GridPanel
					id="fig4b"
					title="after the shove"
					view={view}
					box={box}
					axes={["x", "z"]}
					size={22}
					cells={[
						...cells("module", [[0, 0], ...column(1, 0, 8), [2, 8]]),
						...cells("focus", [...column(2, 0, 7), [3, 0]]),
					]}
				/>
			</Panel>
		</Figure>
	);
}

/** Figure 5: our chain relocation in 2D (not in the paper). */
export function ChainRelocationFigure() {
	const view = { x0: 0, x1: 5, y0: 0, y1: 1 };
	return (
		<Figure
			caption={
				<>
					Figure 5. Moving one chain onto another (2D, our addition). Left: a row shift moves the squares
					one by one into the next row, starting with the west end going to the far east cell. Right: a
					column shift carries the west end over the top to the east end. Each square follows a shortest
					legal path; the arrows show the route.
				</>
			}
		>
			<Panel>
				<GridPanel
					id="fig5a"
					title="row shift, first move"
					view={view}
					axes={["x", "y"]}
					cells={[
						...cells("module", [[1, 0], [2, 0], [3, 0], [4, 0]]),
						{ x: 0, y: 0, kind: "focus" },
						{ x: 4, y: 1, kind: "ghost" },
					]}
					arrows={[{ points: [[0, 0], [1, 1], [4, 1]] }]}
				/>
			</Panel>
			<Panel>
				<GridPanel
					id="fig5b"
					title="column shift"
					view={view}
					axes={["x", "y"]}
					cells={[
						...cells("module", [[1, 0], [2, 0], [3, 0], [4, 0]]),
						{ x: 0, y: 0, kind: "focus" },
						{ x: 5, y: 0, kind: "ghost" },
					]}
					arrows={[{ points: [[0, 0], [1, 1], [4, 1], [5, 0]] }]}
				/>
			</Panel>
		</Figure>
	);
}
