/** Integer-grid rules; independent of React and rendering. */
export type Cell = readonly [number, number];
export type Move = {
  from: Cell;
  to: Cell;
  kind: "slide" | "rotation";
  supports: Cell[];
  clearance: Cell[];
};
export const key = ([x, y]: Cell) => `${x},${y}`;
export const same = (a: Cell, b: Cell) => key(a) === key(b);
const add = (a: Cell, b: Cell): Cell => [a[0] + b[0], a[1] + b[1]];
const directions: Cell[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
export function connected(cells: readonly Cell[]): boolean {
  if (!cells.length) return true;
  const occupied = new Set(cells.map(key));
  const seen = new Set([key(cells[0])]);
  const queue = [cells[0]];
  for (let i = 0; i < queue.length; i++)
    for (const d of directions) {
      const next = add(queue[i], d);
      if (occupied.has(key(next)) && !seen.has(key(next))) {
        seen.add(key(next));
        queue.push(next);
      }
    }
  return seen.size === occupied.size;
}
export function legalMoves(cells: readonly Cell[], from: Cell): Move[] {
  const occupied = new Set(cells.map(key));
  if (!occupied.has(key(from))) return [];
  const rest = cells.filter((c) => !same(c, from));
  if (!rest.length || !connected(rest)) return [];
  const moves: Move[] = [];
  for (const d of directions)
    for (const p of directions.filter((p) => p[0] * d[0] + p[1] * d[1] === 0)) {
      const to = add(from, d),
        a = add(from, p),
        b = add(to, p);
      if (
        !occupied.has(key(to)) &&
        occupied.has(key(a)) &&
        occupied.has(key(b))
      )
        moves.push({
          from,
          to,
          kind: "slide",
          supports: [a, b],
          clearance: [],
        });
      const pivot = add(from, d),
        destination = add(pivot, p),
        clearance = add(from, p);
      if (
        occupied.has(key(pivot)) &&
        !occupied.has(key(destination)) &&
        !occupied.has(key(clearance))
      )
        moves.push({
          from,
          to: destination,
          kind: "rotation",
          supports: [pivot],
          clearance: [clearance],
        });
    }
  return moves.filter((m, i) => moves.findIndex((n) => same(n.to, m.to)) === i);
}
export function explainMove(
  cells: readonly Cell[],
  from: Cell,
  to: Cell,
): string {
  if (!cells.some((c) => same(c, from)))
    return "Select an occupied square first.";
  if (cells.some((c) => same(c, to))) return "The destination is occupied.";
  if (!connected(cells.filter((c) => !same(c, from))))
    return "This square is a bridge: removing it disconnects the remaining squares.";
  const move = legalMoves(cells, from).find((m) => same(m.to, to));
  if (move)
    return move.kind === "slide"
      ? "Slide along two stationary neighbours."
      : "Rotate around one neighbour through an empty clearance cell.";
  return "No legal move here. A slide needs two supports; a rotation needs a pivot and an empty clearance cell.";
}
export function applyMove(cells: readonly Cell[], move: Move): Cell[] {
  if (
    !legalMoves(cells, move.from).some(
      (m) => same(m.to, move.to) && m.kind === move.kind,
    )
  )
    throw new Error("Illegal move");
  return cells.map((c) => (same(c, move.from) ? move.to : c));
}
export const matchesTarget = (
  cells: readonly Cell[],
  target: readonly Cell[],
) =>
  cells.length === target.length &&
  cells.every((c) => target.some((t) => same(c, t)));
