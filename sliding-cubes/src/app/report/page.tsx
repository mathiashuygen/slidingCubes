import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: "Report · Sliding Cubes",
	description:
		"Project report: reconfiguring sliding squares and sliding cubes, the two algorithms we implemented, and how we verified them.",
};

const GITHUB = "https://github.com/mathiashuygen/slidingCubes";

const sections = [
	["introduction", "1. Introduction"],
	["model", "2. The sliding model"],
	["2d", "3. 2D: Dumitrescu and Pach"],
	["3d", "4. 3D: in-place compaction"],
	["app", "5. The application"],
	["verification", "6. Verification and results"],
	["deviations", "7. Deviations from the papers"],
	["conclusion", "8. Conclusion and future work"],
	["references", "References"],
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
	return (
		<section id={id} className="scroll-mt-6 flex flex-col gap-3">
			<h2 className="text-xl font-semibold tracking-tight">{title}</h2>
			{children}
		</section>
	);
}

function H3({ children }: { children: ReactNode }) {
	return <h3 className="mt-2 font-semibold">{children}</h3>;
}

/** A citation that links to the reference list. */
function Cite({ n }: { n: number }) {
	return (
		<a href={`#ref-${n}`} className="text-sky-700 hover:underline dark:text-sky-400">
			[{n}]
		</a>
	);
}

function Op({ children }: { children: ReactNode }) {
	return <span className="font-mono text-[0.92em] font-semibold">{children}</span>;
}

/** Figure 1: a slide and a convex transition in a 2×2 square. */
function MovesFigure() {
	const cell = 36;
	const square = (x: number, y: number, kind: "fixed" | "mover" | "target") => (
		<rect
			key={`${x},${y},${kind}`}
			x={x * cell + 2}
			y={y * cell + 2}
			width={cell - 4}
			height={cell - 4}
			rx={4}
			className={
				kind === "fixed"
					? "fill-zinc-300 dark:fill-zinc-600"
					: kind === "mover"
						? "fill-sky-500"
						: "fill-none stroke-sky-500"
			}
			strokeDasharray={kind === "target" ? "4 3" : undefined}
			strokeWidth={2}
		/>
	);
	const grid = (ox: number) => (
		<g transform={`translate(${ox},10)`}>
			{[0, 1].map((x) =>
				[0, 1].map((y) => (
					<rect
						key={`${x}${y}`}
						x={x * cell}
						y={y * cell}
						width={cell}
						height={cell}
						className="fill-none stroke-zinc-300 dark:stroke-zinc-700"
					/>
				)),
			)}
		</g>
	);
	return (
		<figure className="my-2 flex flex-col items-center gap-2">
			<svg
				viewBox="0 0 300 110"
				className="w-full max-w-sm"
				role="img"
				aria-label="A slide and a convex transition"
			>
				{grid(30)}
				<g transform="translate(30,10)">
					{square(0, 1, "fixed")}
					{square(1, 1, "fixed")}
					{square(0, 0, "mover")}
					{square(1, 0, "target")}
					<path
						d="M26 18 H50"
						className="stroke-zinc-900 dark:stroke-zinc-100"
						strokeWidth={2}
						markerEnd="url(#arrow)"
					/>
				</g>
				{grid(190)}
				<g transform="translate(190,10)">
					{square(0, 1, "fixed")}
					{square(0, 0, "mover")}
					{square(1, 1, "target")}
					<path
						d="M26 18 Q54 18 54 44"
						className="fill-none stroke-zinc-900 dark:stroke-zinc-100"
						strokeWidth={2}
						markerEnd="url(#arrow)"
					/>
				</g>
				<defs>
					<marker
						id="arrow"
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="6"
						markerHeight="6"
						orient="auto-start-reverse"
					>
						<path d="M0 0 L10 5 L0 10 z" className="fill-zinc-900 dark:fill-zinc-100" />
					</marker>
				</defs>
				<text x="66" y="102" textAnchor="middle" className="fill-current text-[11px]">
					slide
				</text>
				<text x="226" y="102" textAnchor="middle" className="fill-current text-[11px]">
					convex transition
				</text>
			</svg>
			<figcaption className="text-sm text-zinc-500">
				Figure 1. The two moves. Blue: the moving module; grey: stationary neighbours; dashed: its
				destination. The convex transition needs the swept corner (top right) to be empty.
			</figcaption>
		</figure>
	);
}

export default function Report() {
	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-10 leading-relaxed">
			<header className="flex flex-col gap-3">
				<Link href="/" className="text-sm text-sky-700 hover:underline dark:text-sky-400">
					← Back to the game
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight">
					Reconfiguring sliding squares and sliding cubes
				</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					Project report · Computational Geometry · Mathias Louis Huygen and Iliass Jdaoudi
				</p>
				<p className="text-sm">
					Source code:{" "}
					<a href={GITHUB} className="text-sky-700 hover:underline dark:text-sky-400">
						github.com/mathiashuygen/slidingCubes
					</a>{" "}
					<Cite n={3} />
				</p>
			</header>

			<nav
				aria-label="Contents"
				className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
			>
				<p className="mb-2 font-semibold">Contents</p>
				<ol className="grid gap-1 sm:grid-cols-2">
					{sections.map(([id, title]) => (
						<li key={id}>
							<a href={`#${id}`} className="hover:underline">
								{title}
							</a>
						</li>
					))}
				</ol>
			</nav>

			<Section id="introduction" title="1. Introduction">
				<p>
					A modular robot is made of many identical units that attach to each other and move by
					sliding or rotating over their neighbours. Together they can change shape. The central
					question is <em>universal reconfiguration</em>: can any configuration be turned into any
					other with the same number of modules, keeping the robot connected throughout, and how
					many moves does that take?
				</p>
				<p>
					We studied this question in the sliding square model (2D) and the sliding cube model (3D),
					and built a browser application around it. Players move squares and cubes themselves, and
					two algorithms from the literature solve every level, step by step:
				</p>
				<ul className="list-disc pl-6">
					<li>
						<strong>2D:</strong> Dumitrescu and Pach <Cite n={2} />, who proved that any two
						connected configurations of squares can be transformed into each other.
					</li>
					<li>
						<strong>3D:</strong> Kostitsyna, Ophelders, Parada, Peters, Sonke and Speckmann{" "}
						<Cite n={1} />, who compact any configuration of cubes inside its own bounding box with
						an asymptotically optimal number of moves.
					</li>
				</ul>
				<p>
					Every move the algorithms produce goes through the same rules engine that checks the
					player&apos;s moves, so a solution is only shown if it is legal from start to end.
				</p>
			</Section>

			<Section id="model" title="2. The sliding model">
				<p>
					A configuration is a set of <em>n</em> grid cells, each occupied by one module: squares in
					ℤ² or cubes in ℤ³. Two modules are adjacent when they share a side (2D) or a face (3D);
					touching at a corner or edge does not count. One module moves at a time, inside a 2×2
					square of some coordinate plane:
				</p>
				<ul className="list-disc pl-6">
					<li>
						a <strong>slide</strong> moves it one cell along two stationary neighbours that lie side
						by side;
					</li>
					<li>
						a <strong>convex transition</strong> rotates it around one stationary neighbour to the
						diagonal cell, through an empty corner.
					</li>
				</ul>
				<MovesFigure />
				<p>
					After removing the moving module, the remaining modules must still be connected. This is
					the definition of a move in <Cite n={1} />. Dumitrescu and Pach only require the
					configuration to be connected after each step, but they note that their result also holds
					under this stricter condition <Cite n={2} />, so our engine uses it in both modes.
				</p>
				<p>
					In 3D the problem is <em>compaction</em>: there is no target shape. A configuration is{" "}
					<em>finished</em> when, for every cube, the whole box between the origin (the minimum
					corner of the bounding box) and that cube is filled. The algorithm is <em>in-place</em>:
					cubes stay in the original bounding box, except that at most one cube at a time may be in
					a cell sharing a face with the box.
				</p>
			</Section>

			<Section id="2d" title="3. 2D: Dumitrescu and Pach">
				<p>
					The algorithm of <Cite n={2} /> turns any connected configuration into a horizontal chain.
					To go from a start A to a target B, it turns A into a chain, moves that chain onto the
					chain of B, and plays the moves for B backwards (every move can be undone by the reverse
					move).
				</p>
				<p>
					A base cell <em>s</em> is chosen in the rightmost column, and a chain <em>Z</em> grows
					eastwards from it, one module per iteration. Each iteration picks a module to add:
				</p>
				<ul className="list-disc pl-6">
					<li>
						<Op>Step 1.A</Op>: a module of degree one on the outer boundary walks around the outside
						to the end of the chain.
					</li>
					<li>
						<Op>Step 1.B</Op>: a module of degree one inside a hole moves along the hole until it
						has two neighbours.
					</li>
					<li>
						<Op>Step 2</Op>: if every module outside the chain has degree at least two, there are
						cycles. The algorithm takes a <em>maximal cycle</em> with exactly one <em>connector</em>{" "}
						and the top module <em>a</em> of its highest vertical edge in the rightmost column (or the
						leftmost column, if the connector lies on that edge). If <em>a</em> is on the
						outer boundary it joins the chain (<Op>2.A</Op>); otherwise it moves into the hole it
						borders, next to a <em>critical pair</em> (<Op>2.B</Op>).
					</li>
				</ul>
				<p>
					The measure Φ = <em>q</em> − <em>y</em> (the number of modules inside maximal cycles minus
					the number of maximal cycles) strictly increases in every step 2.B, and every step 1.B adds
					an edge, so each iteration ends after fewer than 2<em>n</em> steps of type 1.B or 2.B. The whole transformation
					takes fewer than 2<em>n</em>³ moves.
				</p>
				<H3>Our implementation</H3>
				<p>
					We compute maximal cycles from the biconnected blocks of the adjacency graph: the outer
					cycle of a block encloses a region, and a cycle is maximal when no other block&apos;s
					region contains it. In step 2.B we try the cells next to critical pairs and keep the first
					move that strictly increases Φ, which the paper&apos;s Claim guarantees to exist. The
					paper says moving a chain to another position is easy but does not give the moves, so we
					designed them: the chain shifts one row at a time (squares move into the next row from the
					far end) and one column at a time (the end square is carried over the top).
				</p>
			</Section>

			<Section id="3d" title="4. 3D: in-place compaction">
				<p>
					The algorithm of <Cite n={1} /> repeatedly applies a local <em>operation</em> that lowers the potential
				</p>
				<p className="text-center font-mono">
					Π = Σ w<sub>c</sub> · (x + 2y + 4z)
				</p>
				<p>
					where the weight w<sub>c</sub> is 17 for cubes above z = 1, 16 at z = 1, and on the floor
					3, 2 or 1 depending on whether y is above 1, equal to 1 or 0. Each operation lowers Π by
					an amount proportional to the moves it uses, so the total number of moves is O(S), with S
					the sum of all cube coordinates. The paper shows a path of cubes from the origin to the
					opposite corner of a box for which every algorithm needs that many moves, so the bound is
					optimal in the worst case.
				</p>
				<H3>Operations</H3>
				<ul className="list-disc pl-6">
					<li>
						<Op>[a]–[d]</Op> lower cubes of a non-cut <em>pillar</em> (a vertical run of cubes)
						using a neighbouring pillar.
					</li>
					<li>
						<Op>[e]</Op> is a <em>pillar shove</em>: all cubes of the pillar except the top one
						move one column sideways, and the top cube drops to the bottom of the original column.
						Pillars of 9 or more cubes use the paper&apos;s &ldquo;zipper&rdquo;, a constant number
						of moves per level, which keeps the cost linear in the height.
					</li>
					<li>
						<Op>[f]</Op> and <Op>[g]</Op> make any single move that lowers Π and stays in the box,
						first for cubes above the floor, then for cubes of a floor component.
					</li>
					<li>
						<Op>[h]</Op> and <Op>[i]</Op> handle a <em>small</em> floor component L (too few cubes
						to reach the origin), attached to the
						rest by a <em>clearing pillar</em> P: they move the cube under P towards the origin, or
						gather cubes of L around P, shove P, and put the cubes back.
					</li>
					<li>
						A <em>big</em> floor component (enough cubes to reach the origin) is solved by running
						the same algorithm in 2D on the floor, with the cube under P <em>pinned</em> so that L
						stays attached. In that run, <Op>[j]</Op> handles one-dimensional strips.
					</li>
				</ul>
				<p>
					The paper proves that when no operation applies, the configuration is finished (Theorem
					1). Our solver follows that structure directly: it tries the operations in order, replays
					the first one that applies, checks that Π went down, and repeats until the configuration
					is finished.
				</p>
			</Section>

			<Section id="app" title="5. The application">
				<p>
					The application is a static Next.js site written in TypeScript; the 3D board uses React
					Three Fiber. It has no backend: the solvers run in a Web Worker in the browser.
				</p>
				<ul className="list-disc pl-6">
					<li>
						<strong>Rules engine</strong> (<code>src/engine</code>): configurations, move legality
						with a reason for every illegal move, connectivity (articulation points and biconnected
						blocks), goals, and replay of move lists.
					</li>
					<li>
						<strong>Solvers</strong> (<code>src/solvers</code>): Dumitrescu–Pach, Peters et al., and
						breadth-first search for shortest solutions of small levels.
					</li>
					<li>
						<strong>Game</strong>: a tutorial of nine lessons, 11 curated 2D levels and 9 curated 3D
						levels, a seeded random level generator, undo and redo, and a score against the solver.
					</li>
					<li>
						<strong>Hints</strong>: the first move of a complete solution from the current position,
						either the shortest one (up to 7 squares or 6 cubes) or the paper&apos;s solver rerun
						from there, replayed before it is shown.
					</li>
					<li>
						<strong>Solution viewer</strong>: play, pause and step through a solver&apos;s moves,
						with every step labelled by the step or operation of the paper it belongs to.
					</li>
				</ul>
				<p>
					<Link href="/" className="text-sky-700 hover:underline dark:text-sky-400">
						Open the game →
					</Link>
				</p>
			</Section>

			<Section id="verification" title="6. Verification and results">
				<p>
					Because every solver move is checked by the rules engine, a bug in a solver shows up as a
					failed replay or as a state where no operation applies, never as a silently illegal
					solution. The test suite (133 tests) replays the curated levels, seeded random shapes and
					hand-built cases for the more involved operations ([e], [h], [i] and [j]), and checks that every level&apos;s stored move count
					still matches the solver.
				</p>
				<p>
					We also ran larger stress tests. One family of shapes, floor rows hanging from a bridge,
					made the 3D solver stop with no applicable operation. We traced this to two bugs in our
					implementation, not in the paper:
				</p>
				<ul className="list-disc pl-6">
					<li>
						The proof of Lemma 11 uses <Op>[j]</Op> with the pillar through the pinned cube as
						clearing pillar; our solver skipped that pillar.
					</li>
					<li>
						In <Op>[h]</Op>, the gathered cubes could fill the empty cell e chosen beforehand; the
						solver now chooses e again by the paper&apos;s rule.
					</li>
				</ul>
				<p>
					A third failure was in boxes that are only one cube thick. A bridge of two 9-cube legs,
					3 or 4 cubes wide, made the solver stop after its first pillar shove. The second leg
					needs a long pillar shove <Op>[e]</Op>, and the paper&apos;s zipper for that needs a
					free column on a third side of the pillar. The paper only asks that this side is empty,
					but here it lies outside the box (where the in-place rule allows only one cube) or is the
					other leg of the bridge, so the zipper cannot be built. This is a gap in the paper for
					thin boxes rather than a bug in our code. Our solver now falls back to the short pillar
					shove, which is legal and lowers Π but needs quadratically many moves in the
					pillar&apos;s height; the step is labelled &ldquo;not in the paper&rdquo; (Section 7).
				</p>
				<p>
					Finally, the solvers&apos; tie-breaking depended on the order in which the cells happened
					to be stored. After stepping through a solution and back, a hint could report 124 moves
					for a position the solver had just solved in 123. Both solvers now sort the cells first,
					so the same position always gets the same solution.
				</p>
				<p>After all fixes:</p>
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="border-b border-zinc-300 dark:border-zinc-700">
							<tr>
								<th className="py-1 pr-4">Solver</th>
								<th className="py-1 pr-4">Inputs</th>
								<th className="py-1">Result</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
							<tr>
								<td className="py-1 pr-4">3D</td>
								<td className="py-1 pr-4">
									984 shapes up to 30 cubes, incl. flat and one-cube-thick ones
								</td>
								<td className="py-1">all compacted; at most 0.83·S moves</td>
							</tr>
							<tr>
								<td className="py-1 pr-4">3D</td>
								<td className="py-1 pr-4">765 bridges, floor rows and random shapes</td>
								<td className="py-1">all compacted</td>
							</tr>
							<tr>
								<td className="py-1 pr-4">3D</td>
								<td className="py-1 pr-4">
									930 one-cube-thick bridges (some on floor pieces) and random shapes
								</td>
								<td className="py-1">all compacted</td>
							</tr>
							<tr>
								<td className="py-1 pr-4">Both</td>
								<td className="py-1 pr-4">200 generated levels and 400 hints from random mid-game positions</td>
								<td className="py-1">all solved; every hint verified</td>
							</tr>
							<tr>
								<td className="py-1 pr-4">2D</td>
								<td className="py-1 pr-4">650 random start and target pairs up to 30 squares</td>
								<td className="py-1">all solved</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p>
					The 3D solver is close to optimal on small levels: on &ldquo;Tower&rdquo; it uses 11 moves
					where the shortest solution takes 10. The 2D algorithm was designed to prove that a
					solution exists, not to find a short one, and it shows: &ldquo;Snake&rdquo; takes 71 moves
					against a shortest 8, and &ldquo;Staircase&rdquo; 92 against 14.
				</p>
			</Section>

			<Section id="deviations" title="7. Deviations from the papers">
				<p>Our implementation goes beyond the papers in these places:</p>
				<ul className="list-disc pl-6">
					<li>Moving one chain onto another in 2D (the paper leaves it open; see Section 3).</li>
					<li>
						For 3D hints from the middle of a game, a cube left outside the box is first brought
						back in (the solver labels this step &ldquo;not in the paper&rdquo;). The paper only starts from configurations inside the box, and does not
						guarantee compaction from mid-game states in the original box; in our tests it always
						succeeded.
					</li>
					<li>
						A box that is only one cube thick is solved as a 2D instance in its vertical plane.
						There, a pillar of 9 or more cubes against the box wall can have no free column for the
						zipper: the paper only asks for an empty side, but here that side is outside the box,
						where the in-place rule allows one cube. We then use the short shove, which is legal and
						lowers Π but takes quadratically many moves in the pillar&apos;s height (labelled
						&ldquo;not in the paper&rdquo;).
					</li>
					<li>
						Where the paper fixes exact cells for helper cubes, we search for a placement and keep
						the first one that the engine accepts and that lowers Π. In <Op>[i]</Op> we use the
						short shove when L has too few cubes for the zipper, and in <Op>[h]</Op> we rearrange
						the gathered cubes when L runs out.
					</li>
				</ul>
			</Section>

			<Section id="conclusion" title="8. Conclusion and future work">
				<p>
					We implemented both algorithms on one shared rules engine, and every solution they produce
					is verified move by move. Implementing the 3D algorithm showed how much detail its
					operations hide: the precise order of the cases, the choice of helper cells, and the
					pinned-cube recursion all had to be made concrete, and stress testing found two cases our
					first implementation missed.
				</p>
				<p>
					Open points: whether compaction in the original box is always possible from any mid-game
					state, faster planning for very large configurations, and comparing the 2D solver with an algorithm designed to use fewer moves.
				</p>
			</Section>

			<Section id="references" title="References">
				<ol className="flex flex-col gap-2 text-sm">
					<li id="ref-1" className="scroll-mt-6">
						[1] I. Kostitsyna, T. Ophelders, I. Parada, T. Peters, W. Sonke and B. Speckmann.
						Optimal in-place compaction of sliding cubes. <em>Journal of Computational Geometry</em>{" "}
						16(1):800–820, 2025.{" "}
						<a href="https://jocg.org" className="text-sky-700 hover:underline dark:text-sky-400">
							jocg.org
						</a>
					</li>
					<li id="ref-2" className="scroll-mt-6">
						[2] A. Dumitrescu and J. Pach. Pushing squares around. <em>Graphs and Combinatorics</em>{" "}
						22:37–50, 2006.{" "}
						<a
							href="https://doi.org/10.1007/s00373-005-0640-1"
							className="text-sky-700 hover:underline dark:text-sky-400"
						>
							doi:10.1007/s00373-005-0640-1
						</a>
					</li>
					{/* <li id="ref-3" className="scroll-mt-6">
						[3] I. Kostitsyna, T. Ophelders, I. Parada, T. Peters, W. Sonke and B. Speckmann. Optimal in-place compaction
						of sliding cubes. In <em>Proc. 19th Scandinavian Symposium and Workshops on Algorithm Theory (SWAT)</em>, LIPIcs
						294, article 31, 2024.{" "}
						<a href="https://doi.org/10.4230/LIPIcs.SWAT.2024.31" className="text-sky-700 hover:underline dark:text-sky-400">
							doi:10.4230/LIPIcs.SWAT.2024.31
						</a>
					</li> */}
					{/* <li id="ref-4" className="scroll-mt-6">
						[4] H. A. Akitaya, E. D. Demaine, M. Korman, I. Kostitsyna, I. Parada, W. Sonke, B. Speckmann, R. Uehara and
						J. Wulms. Compacting squares: input-sensitive in-place reconfiguration of sliding squares. In{" "}
						<em>Proc. 18th Scandinavian Symposium and Workshops on Algorithm Theory (SWAT)</em>, LIPIcs 227, 4:1–4:19,
						2022.{" "}
						<a href="https://doi.org/10.4230/LIPIcs.SWAT.2022.4" className="text-sky-700 hover:underline dark:text-sky-400">
							doi:10.4230/LIPIcs.SWAT.2022.4
						</a>
					</li> */}
					{/* <li id="ref-5" className="scroll-mt-6">
						[5] Z. Abel, H. A. Akitaya, S. D. Kominers, M. Korman and F. Stock. A universal in-place reconfiguration
						algorithm for sliding cube-shaped robots in quadratic time. In{" "}
						<em>Proc. 40th International Symposium on Computational Geometry (SoCG)</em>, LIPIcs 293, 1:1–1:14, 2024.{" "}
						<a href="https://doi.org/10.4230/LIPIcs.SoCG.2024.1" className="text-sky-700 hover:underline dark:text-sky-400">
							doi:10.4230/LIPIcs.SoCG.2024.1
						</a>
					</li> */}
					<li id="ref-3" className="scroll-mt-6">
						[3] Project source code: M. L. Huygen and I. Jdaoudi. <em>slidingCubes</em>.{" "}
						<a href={GITHUB} className="text-sky-700 hover:underline dark:text-sky-400">
							{GITHUB}
						</a>
					</li>
				</ol>
			</Section>
		</main>
	);
}
