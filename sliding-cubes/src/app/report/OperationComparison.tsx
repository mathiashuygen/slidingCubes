const SOLVER_SOURCE =
	"https://github.com/mathiashuygen/slidingCubes/blob/5f75b113e978fee729d5243f16e808c4b370b873/sliding-cubes/src/solvers/peters.ts";

type Snippet = { start: number; end: number; code: string };

// Excerpts from the linked solver revision, with common leading indentation removed.
const operations = [
	{
		id: "a",
		title: "Lower the head",
		paper: "p. 804, Figure 2",
		definition: "Use the highest adjacent pillar P′ on a side of the non-cut subpillar P. If the top of P′ lies at least two levels below the head of P, rotate the head around the cube below it into the adjoining column, one level down.",
		notes: "The code selects the highest adjacent pillar and submits the diagonal move to the shared legality and potential check.",
		snippets: [
			{ start: 257, end: 258, code: `const top = s.adjacent.reduce((p, q) => (q.zt > p.zt ? q : p));
const bottom = s.adjacent.reduce((p, q) => (q.zb < p.zb ? q : p));` },
			{ start: 261, end: 263, code: `if (letter === "a" && top.zt <= t - 2) {
	moves = tryMoves(config, [{ from: cell(a, b, t), to: cell(s.a, s.b, t - 1) }], frame);
}` },
		],
	},
	{
		id: "b",
		title: "Open a gap and lower a cube",
		paper: "p. 804, Figure 2",
		definition: "Let the neighboring pillar P′ start above the base of P. The cube of P just below P′ must be non-cut. Slide it sideways beneath P′, then slide the cube immediately above it down into the vacancy if that cube is non-cut. The paper also gives an unlock case when this second cube is cut, sits just below the head, and the head is locked. Slide the head sideways first.",
		notes: "The branch builds the same two slides. It delegates connectivity to replay and uses a shared unlock helper that can also return or lower the parked head to achieve a strict potential decrease.",
		snippets: [
			{ start: 264, end: 273, code: `if (letter === "b") {
	for (const q of s.adjacent) {
		if (q.zb <= zb) continue;
		moves = withUnlock(s, [
			{ from: cell(a, b, q.zb - 1), to: cell(s.a, s.b, q.zb - 1) },
			{ from: cell(a, b, q.zb), to: cell(a, b, q.zb - 1) },
		]);
		if (moves) break;
	}
}` },
			{ start: 237, end: 248, code: `// Unlocking slides the head of P sideways first.
const withUnlock = (s: Side, moves: Move[]) => {
	const direct = tryMoves(config, moves, frame);
	if (direct) return direct;
	const head = cell(a, b, t), parking = cell(s.a, s.b, t);
	const unlocked = [{ from: head, to: parking }, ...moves];
	// At equal weights the sideways unlock can use the entire potential
	// drop. Bring its head back, or down into the newly cleared cell.
	return tryMoves(config, unlocked, frame) ??
		tryMoves(config, [...unlocked, { from: parking, to: head }], frame) ??
		tryMoves(config, [...unlocked, { from: parking, to: cell(a, b, t - 1) }], frame);
};` },
		],
	},
	{
		id: "c",
		title: "Slide the base down",
		paper: "p. 804, Figure 2",
		definition: "If P is based and an adjacent pillar starts below it, slide the base of P straight down one level along that neighboring pillar. Unlock P first if necessary.",
		notes: "The dispatcher restricts [c] to based subpillars. It tests the lowest adjacent pillar on each side and passes the downward slide to the unlock helper.",
		snippets: [
			{ start: 228, end: 231, code: `const cell = frame.toCell;
for (const letter of ["a", "b", "c", "d", "e"] as const) {
	for (const { a, b, zb, t, based } of subpillars) {
		if (!based && letter !== "a" && letter !== "b") continue;` },
			{ start: 274, end: 276, code: `if (letter === "c" && bottom.zb < zb) {
	moves = withUnlock(s, [{ from: cell(a, b, zb), to: cell(a, b, zb - 1) }]);
}` },
		],
	},
	{
		id: "d",
		title: "Rotate the base down",
		paper: "p. 804, Figure 2",
		definition: "If P is based and the lowest adjacent pillar P′ starts at the same positive height, rotate the base of P about the base of P′. The destination lies one level down in P′’s column. Unlock P first if necessary.",
		notes: "The test against frame.floor is the code’s version of the positive-height condition. The destination changes both the column and the height.",
		snippets: [
			{ start: 228, end: 231, code: `const cell = frame.toCell;
for (const letter of ["a", "b", "c", "d", "e"] as const) {
	for (const { a, b, zb, t, based } of subpillars) {
		if (!based && letter !== "a" && letter !== "b") continue;` },
			{ start: 277, end: 279, code: `if (letter === "d" && bottom.zb === zb && zb > frame.floor) {
	moves = withUnlock(s, [{ from: cell(a, b, zb), to: cell(s.a, s.b, zb - 1) }]);
}` },
		],
	},
	{
		id: "e",
		title: "Shove a pillar",
		paper: "pp. 805–806, Figure 3",
		definition: "After [a]–[d] are exhausted, choose an adjacent pillar with the lowest base above the base of P. A second side must be free at the base. Shove the part of P up to the neighbor’s base. Its support shifts into the neighboring column and its head ends at the original base. Use the short construction below nine cubes and the zipper from nine cubes onward.",
		notes: "The code searches for legal helper placements and tries reflected zipper orientations. If the long zipper cannot be built, it tries the short construction even on a long pillar. That fallback can take quadratically many moves in the height, so the paper’s move bound does not transfer directly.",
		snippets: [
			{ start: 397, end: 405, code: `function pillarShove(config: Configuration, frame: Frame, a: number, b: number, base: number, t: number, sides: Side[]): Operation | null {
	if (sides.some((s) => s.adjacent.length > 1)) return null;
	const higher = sides.filter((s) => s.adjacent.length && s.adjacent[0].zb > base);
	const top = Math.min(...higher.map((s) => s.adjacent[0].zb));
	const height = top - base + 1;
	const src = (z: number) => frame.toCell(a, b, z);
	for (const target of higher.filter((s) => s.adjacent[0].zb === top)) {
		const dst = (z: number) => frame.toCell(target.a, target.b, z);
		if (!sides.some((s) => s !== target && !config.has(frame.toCell(s.a, s.b, base)))) continue;` },
			{ start: 424, end: 438, code: `// Figure 3 [e']: fill the side from above using the lowest available source cube.
const short = (work: Configuration, goal: Configuration) => place(work, column(frame, a, b, base, top),
	column(frame, target.a, target.b, base, top - 1).reverse(), frame, (stage) => restore(stage, goal, frame));
if (height < 9) {
	const moves = attempt(short);
	if (moves) return { name: \`[e] short pillar shove\${frame.label}\`, moves };
	continue;
}
for (const side of shoveSides(a, b, target, frame)) {
	if (config.has(frame.toCell(side.a, side.b, base))) continue;
	const spare = (z: number) => frame.toCell(side.a, side.b, z);
	const moves = attempt((work, goal) =>
		zipper(work, goal, column(frame, a, b, base, base + 4), base + 5, top, src, dst, spare, frame, side.mirrored));
	if (moves) return { name: \`[e] long zipper shove\${frame.label}\`, moves };
}` },
			{ start: 439, end: 443, code: `// The zipper needs a free third column. Against a wall of a one-cube-thick
// box that column is outside the box, where the in-place rule allows only
// one cube. The short shove still works, with quadratically many moves.
const moves = attempt(short);
if (moves) return { name: \`[e] short pillar shove on a long pillar (not in the paper: no room for the zipper)\${frame.label}\`, moves };` },
			{ start: 368, end: 371, code: `for (let z = k; z < top - 3; z++) {
	if (!advanceZipper(stage, z, src, dst, spare, frame, mirrored)) return null;
}
return restore(stage, goal, frame);` },
		],
	},
	{
		id: "f",
		title: "Reduce potential above the floor",
		paper: "p. 806",
		definition: "A cube above the floor may make any legal elementary move that decreases Π and ends inside the original bounding box.",
		notes: "The solver chooses the largest available decrease over the candidate cubes by reusing bestReducingMove.",
		snippets: [
			{ start: 496, end: 515, code: `function localPotentialReduction(config: Configuration, frame: Frame): Operation | null {
	const high = config.toArray().filter((c) => frame.fromCell(c)[2] > frame.floor);
	const move = bestReducingMove(config, frame, high);
	return move && { name: \`[f] local potential reduction\${frame.label}\`, moves: [move] };
}

function bestReducingMove(config: Configuration, frame: Frame, cubes: Cell[]): Move | null {
	let best: Move | null = null;
	let bestGain = 0;
	for (const c of cubes) {
		for (const m of legalMovesFrom(config, c, frame.rules)) {
			if (!inBox(m.to, frame.box)) continue;
			const gain = cubePotential(c, frame.box) - cubePotential(m.to, frame.box);
			if (gain > bestGain) {
				bestGain = gain;
				best = { from: m.from, to: m.to };
			}
		}
	}
	return best;` },
		],
	},
	{
		id: "g",
		title: "Reduce potential in a clear floor component",
		paper: "pp. 808–809, Lemma 6",
		definition: "Choose a non-root clear floor component L. Make any legal elementary move of a cube in L that decreases Π and ends inside the original bounding box.",
		notes: "The code checks floor components and clearing pillars directly. It scans non-root candidates first, uses the same largest-gain helper as [f], and includes special handling for the pinned planar subproblem.",
		snippets: [
			{ start: 574, end: 591, code: `// Try non-root components first. A sole origin-free strip can itself be
// clear (Lemma 11); the pin and its pillar remain protected throughout.
for (const low of [...lows.filter((l) => l !== root), root]) {
	if (low === atOrigin || (pin && low.some((c) => equals(c, pin))) || !connectedWithout(config, low)) continue;
	const rest = config.clone();
	for (const c of low) rest.delete(c);
	const footprint = new Configuration(low);
	for (const p of pillars(rest, frame)) {
		const base = frame.toCell(p.a, p.b, frame.floor);
		if (p.zb !== frame.floor + 1 || !footprint.has(base)) continue;
		const cells = column(frame, p.a, p.b, p.zb, p.zt);
		if (pin && cells.some((c) => equals(c, pin))) {
			pinnedStrips.push({ low, p });
			continue;
		}
		if (connectedWithout(rest, cells)) clear.push({ low, p, base });
	}
}` },
			{ start: 593, end: 596, code: `for (const { low } of clear) {
	const move = bestReducingMove(config, frame, low);
	if (move) return { name: \`[g] low component move\${frame.label}\`, moves: [move] };
}` },
		],
	},
	{
		id: "h",
		title: "Move the cube under the clearing pillar",
		paper: "pp. 810–811, Figure 5",
		definition: "For a small clear component, consider the in-box neighbors beside the first cube of its clearing pillar. They must all be occupied, or at least one must be occupied and the pillar must have height one. Move the cube under the pillar toward an empty floor cell at or below both its horizontal coordinates, maximizing y and then x. If that cube is cut, gather floor cubes into a 3×3 square first and lower the pillar head after moving the cube underneath it.",
		notes: "The code searches legal single-cube routes. If helpers fill the intended destination, it looks for a new destination and can try other empty cells in the gathering square. It can also rearrange donors within that square when gathering alone does not free the base.",
		snippets: [
			{ start: 702, end: 709, code: `function underPillarOperation(config: Configuration, frame: Frame, low: Cell[], p: Pillar): Operation | null {
	const { a, b } = p;
	const floor = frame.floor;
	const base = frame.toCell(a, b, floor);
	const head = frame.toCell(a, b, floor + 1);
	const sides = frame.sides.map(([da, db]) => frame.toCell(a + da, b + db, floor + 1)).filter((c) => inBox(c, frame.box));
	const count = sides.filter((c) => config.has(c)).length;
	if (!count || (count !== sides.length && p.zt !== floor + 1)) return null;` },
			{ start: 712, end: 735, code: `// The paper's e: an empty floor cell with e ≤ c in both coordinates, highest y, then highest x.
const emptyCell = (state: Configuration): Cell | undefined => {
	for (let y = b; y >= minB; y--) {
		for (let x = a; x >= minA; x--) {
			const c = frame.toCell(x, y, floor);
			if (!state.has(c)) return c;
		}
	}
};
const e = emptyCell(config);
if (!e) return null;
function finish(state: Configuration, gathered: Move[]): Operation | null {
	if (!isConnected(state, base)) return null;
	// Gathering can fill e when it lies in the 3×3 square. Then choose e
	// again by the same rule, or else a free cell of the square.
	const again = emptyCell(state);
	const destinations = state.has(e!) ? [...(again ? [again] : []), ...floorSquare(frame, a, b)] : [e!];
	for (const dest of destinations) {
		if (state.has(dest)) continue;
		const work = state.clone();
		const moves = gathered.slice();
		if (!relocate(work, moves, base, dest, frame)) continue;
		if (cut && !relocate(work, moves, head, base, frame)) continue;
		if (tryMoves(config, moves, frame)) return { name: \`[h] move the cube under the clearing pillar\${frame.label}\`, moves };` },
			{ start: 739, end: 749, code: `if (!cut) return finish(config, []);
const footprint = new Configuration(floorSquare(frame, a, b));
const work = config.clone();
const moves: Move[] = [];
gatherFloor(work, moves, low, footprint, frame);
const result = finish(work, moves);
if (result) return result;

// An exhausted L may have fewer cubes than the footprint. Reposition the
// remaining donors within that footprint until the base is free to leave.
const movable = footprint.toArray().filter((c) => !equals(c, base) && (!config.has(c) || low.some((q) => equals(c, q))));` },
		],
	},
	{
		id: "i",
		title: "Shove a clearing pillar with borrowed cubes",
		paper: "pp. 811–812, Figure 6",
		definition: "For a small clear component with no horizontal neighbors at the first level of its clearing pillar, find the first level where that pillar meets an adjacent pillar. Shove the lower part toward that neighbor. Gather helpers from L through two 3×3 floor patches and restore them afterward. The paper fills the destination directly when the first contact is below level five, and allows borrowing from the pillar if floor donors run out.",
		notes: "The implementation also attempts the short construction when the combined donor count is too small for the zipper. The long branch gathers patches, tries different numbers of borrowed cubes, and reuses zipper, which restores the target occupancy at the end.",
		snippets: [
			{ start: 449, end: 457, code: `function clearingShove(config: Configuration, frame: Frame, low: Cell[], p: Pillar): Operation | null {
	const src = (z: number) => frame.toCell(p.a, p.b, z);
	const sides = frame.sides.map(([da, db]) => ({ a: p.a + da, b: p.b + db }));
	const at = (s: SidePosition): Column => (z) => frame.toCell(s.a, s.b, z);
	const base = p.zb;
	if (sides.some((s) => config.has(at(s)(base)))) return null;
	let top = base + 1;
	while (top <= p.zt && !sides.some((s) => config.has(at(s)(top)))) top++;
	if (top > p.zt) return null;` },
			{ start: 460, end: 469, code: `for (const target of sides.filter((s) => config.has(at(s)(top)))) {
	const dst = at(target);
	const goal = shoveGoal(config, src, dst, base, top);
	if (top - frame.floor < 5 || low.length + top - base + 1 < 9) {
		const destinations = column(frame, target.a, target.b, base, top - 1).reverse();
		const donors = [...floorDonors, ...column(frame, p.a, p.b, base, top)];
		// A floor cube under the new column can keep L attached during the transfer.
		for (const holes of [destinations, [dst(frame.floor), ...destinations]]) {
			const built = place(config, donors, holes, frame, (stage) => restore(stage, goal, frame));
			if (built && tryMoves(config, built.moves, frame)) return { name: \`[i] short clearing-pillar shove\${frame.label}\`, moves: built.moves };` },
			{ start: 473, end: 488, code: `for (const side of shoveSides(p.a, p.b, target, frame)) {
	const spare = at(side);
	const work = config.clone();
	const setup: Move[] = [];
	const patches = new Configuration([...floorSquare(frame, target.a, target.b), ...floorSquare(frame, side.a, side.b)]);
	gatherFloor(work, setup, low, patches, frame);
	const floor = work.toArray()
		.filter((c) => originalLow.has(c) || (patches.has(c) && !config.has(c)))
		.sort((a, b) => b[1] - a[1] || b[0] - a[0]);
	// If L is exhausted, use the bottom of P to complete the gadget.
	for (let borrowed = 0; borrowed <= 5 && base + borrowed + 3 <= top; borrowed++) {
		const sources = [...column(frame, p.a, p.b, base, base + borrowed - 1), ...floor];
		const built = zipper(work, goal, sources, base + borrowed, top, src, dst, spare, frame, side.mirrored);
		if (!built) continue;
		const moves = setup.concat(built.moves);
		if (tryMoves(config, moves, frame)) return { name: \`[i] clearing-pillar zipper shove\${frame.label}\`, moves };` },
			{ start: 368, end: 371, code: `for (let z = k; z < top - 3; z++) {
	if (!advanceZipper(stage, z, src, dst, spare, frame, mirrored)) return null;
}
return restore(stage, goal, frame);` },
		],
	},
	{
		id: "j",
		title: "Clear a strip in the planar subproblem",
		paper: "pp. 813–815, Figure 7 and Lemma 11",
		definition: "Take a clear, origin-free strip and find its leftmost cube with a neighbor above it. If this attachment is before the right endpoint, carry the rightmost cube around the strip to the empty cell on the left. If the attachment is at the right endpoint, use [h] for a taller clearing pillar. For a one-cube pillar, move the left endpoint to the right end and lower the pillar into the vacancy on the left.",
		notes: "The three branches are in stripOperation. The dispatcher also handles the two pinned cases from Lemma 11. Pinned moves are rejected by the planar frame’s rules.",
		snippets: [
			{ start: 642, end: 662, code: `const x = (c: Cell) => frame.fromCell(c)[0];
const strip = low.slice().sort((a, b) => x(a) - x(b));
const left = strip[0], right = strip[strip.length - 1];
const above = (c: Cell) => frame.toCell(x(c), p.b, frame.floor + 1);
const attachment = strip.find((c) => config.has(above(c)));
if (!attachment) return null;
const work = config.clone();
const moves: Move[] = [];
if (shiftOnly && equals(attachment, right)) return null;
if (!equals(attachment, right)) {
	const dest = frame.toCell(x(left) - 1, p.b, frame.floor);
	if (!relocate(work, moves, right, dest, frame)) return null;
} else if (p.zt > frame.floor + 1) {
	const op = underPillarOperation(config, frame, low, p);
	if (!op) return null;
	moves.push(...op.moves);
} else {
	if (!relocate(work, moves, left, frame.toCell(x(right) + 1, p.b, frame.floor), frame)) return null;
	if (!relocate(work, moves, above(right), left, frame)) return null;
}
return tryMoves(config, moves, frame) && { name: \`[j] clear a low strip\${frame.label}\`, moves };` },
			{ start: 613, end: 630, code: `// Lemma 11: if the only high component is the pinned cube's pillar, the
// paper applies [j] with that pillar as P. Only [j]'s first case is used,
// which moves the rightmost cube of the strip and never touches P.
for (const { low, p } of pinnedStrips) {
	const op = stripOperation(config, frame, low, p, true);
	if (op) return op;
}
// Lemma 11, last case: the entire pinned component is already a
// one-dimensional strip. Its attachment is the parent's pin; there is
// no second clearing pillar inside the strip.
if (pin && lows.length === 1 && lows[0].length === config.size && !atOrigin) {
	const strip = lows[0].slice().sort((a, b) => a[0] - b[0]);
	const left = strip[0], right = strip[strip.length - 1];
	if (right[0] > pin[0]) {
		const target: Cell = [left[0] - 1, left[1], left[2]];
		const path = modulePath(config, right, target, frame.rules);
		if (path && tryMoves(config, path, frame)) return { name: \`[j] shift a pinned low strip\${frame.label}\`, moves: path };
	}` },
		],
	},
] as const;

function CodeExcerpt({ start, end, code }: Snippet) {
	return (
		<div className="min-w-0">
			<a href={`${SOLVER_SOURCE}#L${start}-L${end}`} className="text-xs text-sky-700 hover:underline dark:text-sky-400">
				peters.ts · lines {start}–{end}
			</a>
			<pre
				tabIndex={0}
				aria-label={`TypeScript excerpt, lines ${start} to ${end}`}
				className="mt-1 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs leading-relaxed dark:border-zinc-800 dark:bg-zinc-900"
			>
				<code>{code}</code>
			</pre>
		</div>
	);
}

export function OperationComparison() {
	return (
		<div className="flex min-w-0 flex-col gap-4">
			<h3 className="font-semibold">Operations [a]–[j]</h3>
			<nav aria-label="3D operations" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{operations.map(({ id }) => (
					<a key={id} href={`#operation-${id}`} className="font-mono text-sky-700 hover:underline dark:text-sky-400">
						[{id}]
					</a>
				))}
			</nav>
			<p>
				A subpillar P is a vertical run of cubes with base z<sub>b</sub> and head z<sub>t</sub>.
				It is <em>based</em> if the cell directly below its base is empty and <em>non-cut</em> if removing
				it leaves the rest connected or empty. The solver writes its horizontal coordinates as
				<code> a, b</code> and its head height as <code>t</code>.
			</p>
			<p>
				A clear floor component L excludes the origin, leaves the rest connected when removed, and
				touches a non-cut pillar P in the remainder. P is its <em>clearing pillar</em>. With coordinates
				relative to the box minimum, L is small when |L| &lt; p<sub>x</sub> + p<sub>y</sub> + 1.
				For a big component, the solver works in the floor plane with the cube under P pinned.
			</p>
			<p>
				The paper descriptions below are paraphrased. The excerpts link to the exact solver source.
				Operations [a]–[e] reduce the sum of cube heights Z<sub>C</sub>.
				The shared acceptance check replays each candidate, checks its final position against the box,
				and accepts it only when Π decreases. This verifies the accepted sequence. Showing that
				progress is always possible and bounding its move count require separate arguments.
			</p>
			<CodeExcerpt start={145} end={154} code={`function tryMoves(config: Configuration, moves: Move[], frame: Frame): Move[] | null {
	if (moves.length === 0) return null;
	const work = config.clone();
	for (const m of moves) {
		if (!checkMove(work, m, frame.rules).legal) return null;
		applyMove(work, m);
	}
	for (const c of work) if (!inBox(c, frame.box)) return null;
	return potential(work, frame.box) < potential(config, frame.box) ? moves : null;
}`} />
			{operations.map(({ id, title, paper, definition, notes, snippets }) => (
				<article key={id} id={`operation-${id}`} className="min-w-0 scroll-mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
					<h4 className="mb-3 font-semibold"><code>[{id}]</code> {title}</h4>
					<div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-6">
						<div className="min-w-0 space-y-2 text-sm">
							<h5 className="font-semibold">Paper definition</h5>
							<a href="#ref-1" className="block text-xs text-sky-700 hover:underline dark:text-sky-400">
								{paper}
							</a>
							<p>{definition}</p>
							<p><strong>Implementation detail.</strong> {notes}</p>
						</div>
						<div className="min-w-0 space-y-2">
							<h5 className="text-sm font-semibold">Solver code</h5>
							{snippets.map((excerpt) => <CodeExcerpt key={excerpt.start} {...excerpt} />)}
						</div>
					</div>
				</article>
			))}
		</div>
	);
}
