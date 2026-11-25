import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { CaseAnimation, TransitionAnimations } from "./animations";
import { Math } from "./Math";
import { OperationComparison } from "./OperationComparison";
import { ChainRelocationFigure } from "./figures";

export const metadata: Metadata = {
	title: "Report · Sliding Cubes",
	description:
		"Project report: reconfiguring sliding squares and sliding cubes, the two algorithms we implemented, and how we verified them.",
};

const GITHUB = "https://github.com/mathiashuygen/slidingCubes";

const TEST_REVISION = `${GITHUB}/commit/c4e784b8d5f6fb949d64fb0316f19f7aa7471960`;

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
					both solvers reach the required goal on all 28 curated levels. They are based on these two algorithms:
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
					A configuration is a set of <Math tex="n" /> grid cells, each occupied by one module: squares in{" "}
					<Math tex="\mathbb{Z}^2" /> or cubes in <Math tex="\mathbb{Z}^3" />. Two modules are adjacent when they share a side (2D) or a face (3D);
					touching at a corner or edge does not count. One module moves at a time, inside a <Math tex="2\times2" />{" "}
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
				<TransitionAnimations />
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
				<p>
					Many shapes count as finished, and the paper notes that the one its algorithm produces
					depends on the input. The solver stops at the first finished shape it reaches, which need
					not be the lowest one: the &ldquo;Zipper&rdquo; level, for example, ends as a staircase of
					columns 9, 7, 5 and 1 cubes high, although its 23 cubes would fit in three layers.
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
					A base cell <Math tex="s" /> is chosen in the rightmost column, and a chain <Math tex="Z" /> grows
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
						and the top module <Math tex="a" /> of its highest vertical edge in the rightmost column (or the
						leftmost column, if the connector lies on that edge). If <Math tex="a" /> is on the
						outer boundary it joins the chain (<Op>2.A</Op>); otherwise it moves into the hole it
						borders, next to a <em>critical pair</em> (<Op>2.B</Op>).
					</li>
				</ul>
				<p>
					The measure <Math tex="\Phi = q - y" /> (the number of distinct modules on or inside at least one maximal cycle minus
					the number of maximal cycles) strictly increases in every step 2.B, and every step 1.B adds
					an edge, so each iteration ends after fewer than <Math tex="2n" /> steps of type 1.B or 2.B.
					Dumitrescu and Pach bound one shape-to-chain conversion by fewer than <Math tex="2n^3" /> moves.
					Our solver performs two such conversions and translates one chain to the other&apos;s position.
					The translation cost depends on the distance between the chains.
				</p>
				<H3>Our implementation</H3>
				<p>
					We compute maximal cycles from the biconnected blocks of the adjacency graph: the outer
					cycle of a block encloses a region, and a cycle is maximal when no other block&apos;s
					region contains it. In step 2.B we try the cells next to critical pairs and keep the first
					move that strictly increases <Math tex="\Phi" />, which the paper&apos;s Claim guarantees to exist. The
					paper says moving a chain to another position is easy but does not give the moves, so we
					designed them: the chain shifts one row at a time (squares move into the next row from the
					far end) and one column at a time (the end square is carried over the top).
				</p>
				<p>
					The solver computes physical holes and cycle regions separately. Diagonally touching squares
					can seal a physical hole, while their centers share no edge in the adjacency graph. A 65-square
					regression test checks that this distinction leads the solver to select Step 2.B.
				</p>
			</Section>

			<Section id="3d" title="4. 3D: in-place compaction">
				<p>
					The algorithm of <Cite n={1} /> repeatedly applies a local <em>operation</em> that lowers the potential
				</p>
				<Math display tex="\Pi(C) = \sum_{c\in C} w_c\,(x_c + 2y_c + 4z_c)" />
				<p>
					The weight depends on the cube’s height and, for floor cubes, on its row.
				</p>
				<Math display tex={String.raw`w_c =
					\begin{cases}
					17 & z_c > 1 \\
					16 & z_c = 1 \\
					3 & z_c = 0,\ y_c > 1 \\
					2 & z_c = 0,\ y_c = 1 \\
					1 & z_c = 0,\ y_c = 0
					\end{cases}`} />
				<p>
					In the paper&apos;s construction, the move count of each operation is bounded by a constant
					times its potential decrease. This gives an <Math tex="O(S)" /> bound on elementary moves,
					where <Math tex="S = \sum_{c\in C}(x_c + y_c + z_c)" /> uses coordinates measured from the
					minimum corner of the original box. The paper gives
					a matching worst-case lower bound. The same upper bound has yet to be established for our
					implementation, which uses the alternative move sequences described in Section 7.
				</p>
				<OperationComparison />
				<p>
					The paper proves that when no operation applies, the configuration is finished (Theorem
					1). Our solver tries operations in order, checks the legality of every accepted move sequence,
					and requires each accepted operation to decrease <Math tex="\Pi" />. It stops when it has compacted the shape
					or reports an error if its search finds no applicable operation.
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
						<strong>Game</strong>: a tutorial of nine lessons, 11 curated 2D levels and 17 curated 3D
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
					<li>
						<strong>3D sandbox</strong>: build your own shape of up to 40 cubes by clicking cube
						faces, remove cubes as long as the shape stays connected, and let the Peters et al.
						solver compact it in the normal 3D board.
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
					All 164 checked-in tests pass. Solver tests replay the moves through the rules engine
					and check the exact 2D target or the 3D compaction goal. The table lists representative
					cases from the suite.
				</p>
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead className="border-b border-zinc-300 dark:border-zinc-700">
							<tr>
								<th scope="col" className="py-2 pr-4">Test cases</th>
								<th scope="col" className="py-2">Checks</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
							<tr>
								<td className="py-2 pr-4">Rules engine</td>
								<td className="py-2">Legal slides and turns preserve connectivity and can be reversed. Blocked corners, moves that disconnect the fixed cubes, and a second cube outside the box are rejected.</td>
							</tr>
							<tr>
								<td className="py-2 pr-4">28 curated levels</td>
								<td className="py-2">All 11 square levels and 17 cube levels reach their goals. The solver’s move count matches the stored par, and breadth-first search checks the shortest counts where recorded.</td>
							</tr>
							<tr>
								<td className="py-2 pr-4">Seeded solver inputs</td>
								<td className="py-2">48 pairs of 2D shapes reach their exact translated targets. 34 3D shapes compact inside their original boxes.</td>
							</tr>
							<tr>
								<td className="py-2 pr-4">Pillars, floor components, and thin boxes</td>
								<td className="py-2">A tall bridge uses the zipper in <Op>[e]</Op>. The <Op>[h]</Op> cases cover gathering and a covered destination. The <Op>[i]</Op> cases check that the floor is restored. The <Op>[j]</Op> cases cover strips that must keep a cube pinned. Three thin bridges compact using a short shove when the zipper has no room.</td>
							</tr>
							<tr>
								<td className="py-2 pr-4">14 operation demonstrations</td>
								<td className="py-2">The examples select the intended operation, replay legally, and lower the potential. The cases cover <Op>[a]–[j]</Op>, the three unlock variants, and both forms of <Op>[i]</Op>.</td>
							</tr>
							<tr>
								<td className="py-2 pr-4">Hints and cell order</td>
								<td className="py-2">The suite checks hints from mid-game states, including a cube outside the original box, and compares solutions and hint lengths when the same cells are supplied in a different order.</td>
							</tr>
						</tbody>
					</table>
				</div>
				<p>
					The curated tests give solver and shortest move counts of 11 and 10 for Tower, 71 and 8
					for Snake, and 92 and 14 for Staircase.
				</p>
				<p>
					To reproduce the checks, run <code>npm ci</code> and <code>npm test</code> from
					<code> sliding-cubes/</code> at the{" "}
					<a href={TEST_REVISION} className="text-sky-700 hover:underline dark:text-sky-400">tested revision</a>.
				</p>
			</Section>

			<Section id="deviations" title="7. Deviations from the papers">
				<p>Our implementation goes beyond the papers in these places:</p>
				<ul className="list-disc pl-6">
					<li>Moving one chain onto another in 2D (the paper leaves it open; see Section 3 and Figure 2).</li>
					<li>
						For 3D hints from the middle of a game, a cube left outside the box is first brought
						back in (the solver labels this step &ldquo;not in the paper&rdquo;). The paper only starts from configurations inside the box, and does not
						guarantee compaction from mid-game states in the original box; in our tests it always
						succeeded.
					</li>
					<li>
						<strong>Long shoves in thin boxes.</strong> The implementation restricts a vertical
						one-cube-thick box to its occupied plane. The long <Op>[e]</Op> zipper needs a third
						column for simultaneous helpers. In the thin-bridge test cases, that column is
						occupied or outside the box, where only one cube may be at a time. The solver tries
						the short shove to reach the same final occupancy with legal moves. On a long
						pillar, that construction can take quadratically many moves in its height, so the
						paper’s linear cost for a long shove does not follow for this fallback.
					</li>
					<li>
						<strong>Helper placement in [h] and [i].</strong> The solver specifies target cells
						and searches for a legal order to fill them. A cube that is blocked or would
						disconnect the configuration can become movable after another helper is placed.
						In <Op>[i]</Op>, the paper already uses direct filling for a short shove and allows
						borrowing from the pillar when L runs out of helpers. The code additionally uses
						direct filling when the available pieces fall below its zipper setup threshold.
						In <Op>[h]</Op>, the paper permits gathering to stop when L is exhausted. Our
						solver can try other arrangements within the gathering square if the base still
						cannot move, and recomputes the destination when a helper occupies it. These
						searches are checked for legality and a decrease in <Math tex="\Pi" /> on the accepted sequence.
						Those checks establish neither that a sequence will always be found nor that
						its length is proportional to the decrease.
					</li>
				</ul>
				<ChainRelocationFigure />
				<CaseAnimation
					name="chain"
					caption="Animation of Figure 2: a chain of four squares moves one row up (each square in turn, starting with the west end), then one column right (the west end is carried over the top)."
				/>
			</Section>

			<Section id="conclusion" title="8. Conclusion and future work">
				<p>
					We implemented both algorithms on one shared rules engine, and every solution they produce
					is verified move by move. Implementing the 3D algorithm showed how much detail its
					operations hide: the precise order of the cases, the choice of helper cells, and the
					pinned-cube recursion all had to be made concrete, and stress testing found several cases our
					first implementation missed.
				</p>
				<p>
					Open points: whether compaction in the original box is always possible from any mid-game
					state, establishing a move bound for our 3D implementation, faster planning for very large
					configurations, and comparing the 2D solver with an algorithm designed to use fewer moves.
				</p>
			</Section>

			<Section id="references" title="References">
				<ol className="flex flex-col gap-2 text-sm">
					<li id="ref-1" className="scroll-mt-6">
						[1] I. Kostitsyna, T. Ophelders, I. Parada, T. Peters, W. Sonke and B. Speckmann.
						Optimal in-place compaction of sliding cubes. <em>Journal of Computational Geometry</em>{" "}
						16(1):800–820, 2025.{" "}
						<a href="https://doi.org/10.20382/jocgv16i1a22" className="text-sky-700 hover:underline dark:text-sky-400">
							doi:10.20382/jocgv16i1a22
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
