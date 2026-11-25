import { Math } from "./Math";
import { OperationAnimation } from "./animations";

const operations = [
	{ id: "a", title: "Lower the head", paper: "p. 804, Figure 2",
		definition: "Use the highest adjacent pillar $P'$ on a side of the non-cut subpillar $P$. If the top of $P'$ lies at least two levels below the head of $P$, rotate the head around the cube below it into the adjoining column, one level down.",
		watch: "The tall pillar is on the right in this mirrored example. Watch its head turn into the left column and drop one level." },
	{ id: "b", title: "Open a gap and lower a cube", paper: "p. 804, Figure 2",
		definition: "Let the neighboring pillar $P'$ start above the base of $P$. The cube of $P$ just below $P'$ must be non-cut. Slide it sideways beneath $P'$, then slide the cube immediately above it down into the vacancy if that cube is non-cut. The paper also gives an unlock case when this second cube is cut, sits just below the head, and the head is locked. Slide the head sideways first.",
		watch: "Watch one cube open a gap so the cube above can slide down. The unlock variant first parks the head on the neighboring pillar.", alternate: "b-unlock" },
	{ id: "c", title: "Slide the base down", paper: "p. 804, Figure 2",
		definition: "If $P$ is based and an adjacent pillar starts below it, slide the base of $P$ straight down one level along that neighboring pillar. Unlock $P$ first if necessary.",
		watch: "Watch the base slide straight down along the neighboring pillar. In the unlock variant, the head must slide sideways first.", alternate: "c-unlock" },
	{ id: "d", title: "Rotate the base down", paper: "p. 804, Figure 2",
		definition: "If $P$ is based and the lowest adjacent pillar $P'$ starts at the same positive height, rotate the base of $P$ about the base of $P'$. The destination lies one level down in $P'$’s column. Unlock $P$ first if necessary.",
		watch: "Watch the base turn into the empty cell underneath the neighboring pillar. The unlock variant begins with a sideways slide of the head.", alternate: "d-unlock" },
	{ id: "e", title: "Shove a pillar", paper: "pp. 805–806, Figure 3",
		definition: "After [a]–[d] are exhausted, choose an adjacent pillar with the lowest base above the base of $P$. A second side must be free at the base. Shove the part of $P$ up to the neighbor’s base. Its support shifts into the neighboring column and its head ends at the original base. Use the short construction below nine cubes and the zipper from nine cubes onward.",
		watch: "Follow the amber pillar as the solver builds the zipper and shifts its support into the next column. Use the move slider to inspect the setup and final position." },
	{ id: "f", title: "Reduce potential above the floor", paper: "p. 806",
		definition: "A cube above the floor may make any legal elementary move that decreases $\\Pi$ and ends inside the original bounding box.",
		watch: "The elevated cube moves one column toward the origin at the same height. Watch the horizontal move reduce the potential." },
	{ id: "g", title: "Reduce potential in a clear floor component", paper: "pp. 808–809, Lemma 6",
		definition: "Choose a non-root clear floor component $L$. Make any legal elementary move of a cube in $L$ that decreases $\\Pi$ and ends inside the original bounding box.",
		watch: "Watch an amber cube move from the clear floor component toward the origin while staying on the floor." },
	{ id: "h", title: "Move the cube under the clearing pillar", paper: "pp. 810–811, Figure 5",
		definition: "For a small clear component, consider the in-box neighbors beside the first cube of its clearing pillar. They must all be occupied, or at least one must be occupied and the pillar must have height one. Move the cube under the pillar toward an empty floor cell at or below both its horizontal coordinates, maximizing $y$ and then $x$. If that cube is cut, gather floor cubes into a $3\\times 3$ square first and lower the pillar head after moving the cube underneath it.",
		watch: "Watch floor cubes gather around the cube supporting the pillar. The support cube moves away and the pillar head fills the gap." },
	{ id: "i", title: "Shove a clearing pillar with borrowed cubes", paper: "pp. 811–812, Figure 6",
		definition: "For a small clear component with no horizontal neighbors at the first level of its clearing pillar, find the first level where that pillar meets an adjacent pillar. Shove the lower part toward that neighbor. Gather helpers from $L$ through two $3\\times 3$ floor patches and restore them afterward. The paper fills the destination directly when the first contact is below level five, and allows borrowing from the pillar if floor donors run out.",
		watch: "The short example fills the destination directly. In the long example, watch the solver borrow helpers, shove the pillar, then restore the floor occupancy.", alternate: "i-zipper" },
	{ id: "j", title: "Clear a strip in the planar subproblem", paper: "pp. 813–815, Figure 7 and Lemma 11",
		definition: "Take a clear, origin-free strip and find its leftmost cube with a neighbor above it. If this attachment is before the right endpoint, carry the rightmost cube around the strip to the empty cell on the left. If the attachment is at the right endpoint, use [h] for a taller clearing pillar. For a one-cube pillar, move the left endpoint to the right end and lower the pillar into the vacancy on the left.",
		watch: "Watch the rightmost cube of the amber strip travel around its edge to the left. The pinned cube is marked red." },
] as const;

export function OperationComparison() {
	return (
		<div className="flex min-w-0 flex-col gap-4">
			<h3 className="font-semibold">Operations [a]–[j]</h3>
			<nav aria-label="3D operations" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
				{operations.map(({ id }) => (
					<a key={id} href={`#operation-${id}`} className="font-mono text-sky-700 hover:underline dark:text-sky-400">[{id}]</a>
				))}
			</nav>
			<p>
				A subpillar is a vertical run of cubes. It is <em>based</em> if the cell below its base is empty
				and <em>non-cut</em> if removing it leaves the rest connected or empty.
				A clear floor component excludes the origin, leaves the rest connected when removed,
				and touches a non-cut pillar in the remainder. This is its <em>clearing pillar</em>.
			</p>
			<p>
				Each example starts from a configuration chosen to trigger the indicated operation in the
				solver’s usual order. The animation stops after that operation. Use the move controls to
				compare the starting configuration, intermediate moves and final position with the paper’s description.
				These examples demonstrate behavior on specific inputs.
			</p>
			{operations.map((operation) => (
				<article key={operation.id} id={`operation-${operation.id}`} className="min-w-0 scroll-mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-800">
					<h4 className="mb-3 font-semibold"><code>[{operation.id}]</code> {operation.title}</h4>
					<div className="grid min-w-0 gap-4 md:grid-cols-2 md:gap-6">
						<div className="space-y-2 text-sm">
							<a href="#ref-1" className="block text-xs text-sky-700 hover:underline dark:text-sky-400">{operation.paper}</a>
							<p>{operation.definition.split("$").map((part, index) => (
								index % 2 ? <Math key={index} tex={part} /> : part
							))}</p>
						</div>
						<div className="min-w-0 space-y-2 text-sm">
							<p>{operation.watch}</p>
							<OperationAnimation name={operation.id} label={"alternate" in operation && operation.id === "i" ? "Short shove" : undefined} />
							{"alternate" in operation && <OperationAnimation name={operation.alternate} label={operation.id === "i" ? "Zipper" : "Unlock variant"} />}
						</div>
					</div>
				</article>
			))}
		</div>
	);
}
