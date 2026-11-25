"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { type Group, Vector3 } from "three";
import { type Box, type Cell, Configuration, type Move, applyMove, cellKey, equals } from "@/engine";

export interface ColorGroup {
	cells: Cell[];
	color: string;
}

export interface MoveSceneProps {
	start: Cell[];
	moves: Move[];
	/** The in-place box to outline; omitted in 2D. */
	box?: Box;
	/** Colours by starting cell. Other cubes are blue. */
	groups?: ColorGroup[];
	/** Milliseconds per move. */
	stepMs: number;
	playing: boolean;
	restart: number;
	onStep: (step: number) => void;
	/** Keep the final position visible until the viewer restarts or seeks. */
	stopAtEnd?: boolean;
	seek?: { step: number };
	/** Top-down orthographic projection for square configurations. */
	flat?: boolean;
}

const CUBE = "#0ea5e9";
const MOVING = "#a855f7";
const HOLD_MS = 1400;

const center = (c: Cell) => new Vector3(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);

/**
 * The path of one move: a straight line for a slide, and two straight
 * segments through the empty corner of the 2×2 square for a convex transition.
 */
function pathOf(config: Configuration, move: Move): Vector3[] {
	const changed = [0, 1, 2].filter((i) => move.from[i] !== move.to[i]);
	if (changed.length < 2) return [center(move.from), center(move.to)];
	const corners = changed.map((axis) => [0, 1, 2].map((i) => (i === axis ? move.to[i] : move.from[i])) as unknown as Cell);
	const clearance = corners.find((c) => !config.has(c)) ?? corners[0];
	return [center(move.from), center(clearance), center(move.to)];
}

function along(points: Vector3[], t: number): Vector3 {
	const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
	const segments = points.length - 1;
	const scaled = Math.min(eased * segments, segments - 1e-9);
	const i = Math.floor(scaled);
	return points[i].clone().lerp(points[i + 1], scaled - i);
}

interface Plan {
	/** Index of the cube that moves in each step. */
	mover: number[];
	paths: Vector3[][];
	/** Where every cube is before each step, and after the last one. */
	frames: Vector3[][];
}

function plan(start: Cell[], moves: Move[]): Plan {
	const config = new Configuration(start);
	const positions = start.map((c): Cell => [...c]);
	const frames: Vector3[][] = [positions.map(center)];
	const mover: number[] = [];
	const paths: Vector3[][] = [];
	for (const m of moves) {
		const i = positions.findIndex((p) => equals(p, m.from));
		mover.push(i);
		paths.push(pathOf(config, m));
		applyMove(config, m);
		positions[i] = [...m.to];
		frames.push(positions.map(center));
	}
	return { mover, paths, frames };
}

function Cubes({ start, moves, groups = [], stepMs, playing, onStep, stopAtEnd, clockRef }: MoveSceneProps & { clockRef: RefObject<number> }) {
	const { mover, paths, frames } = useMemo(() => plan(start, moves), [start, moves]);
	const refs = useRef<(Group | null)[]>([]);
	const lastStep = useRef(-1);

	const colors = useMemo(
		() => start.map((c) => groups.find((g) => g.cells.some((d) => equals(c, d)))?.color ?? CUBE),
		[start, groups],
	);

	useFrame((_, delta) => {
		if (playing) clockRef.current += delta * 1000;
		const total = moves.length * stepMs + HOLD_MS;
		if (stopAtEnd) clockRef.current = Math.min(clockRef.current, moves.length * stepMs);
		else if (clockRef.current >= total) clockRef.current = 0;
		const step = Math.min(Math.floor(clockRef.current / stepMs), moves.length);
		const t = step < moves.length ? (clockRef.current - step * stepMs) / stepMs : 0;
		const frame = frames[step];
		refs.current.forEach((g, i) => {
			if (!g) return;
			const moving = step < moves.length && mover[step] === i;
			g.position.copy(moving ? along(paths[step], t) : frame[i]);
			const mesh = g.children[0] as unknown as { material: { color: { set(c: string): void } } };
			mesh.material.color.set(moving ? MOVING : colors[i]);
		});
		if (step !== lastStep.current) {
			lastStep.current = step;
			onStep(step);
		}
	});

	return (
		<>
			{start.map((c, i) => (
				<group key={cellKey(c)} ref={(g) => { refs.current[i] = g; }} position={center(c)}>
					<mesh>
						<boxGeometry args={[0.94, 0.94, 0.94]} />
						<meshStandardMaterial color={colors[i]} />
						<Edges color="#0c4a6e" />
					</mesh>
				</group>
			))}
		</>
	);
}

export default function MoveScene(props: MoveSceneProps) {
	const { start, moves, box, restart, seek, stepMs, flat = false } = props;
	const clockRef = useRef(0);
	useEffect(() => {
		clockRef.current = (seek?.step ?? 0) * stepMs;
	}, [restart, moves, seek, stepMs]);
	// Frame every cell the animation touches, plus the box.
	const extent = useMemo(() => {
		const cells = [...start, ...moves.map((m) => m.to)];
		if (box) cells.push(box.min, box.max);
		const min = [0, 1, 2].map((i) => Math.min(...cells.map((c) => c[i])));
		const max = [0, 1, 2].map((i) => Math.max(...cells.map((c) => c[i])) + 1);
		return { min, max };
	}, [start, moves, box]);
	const middle = new Vector3(...[0, 1, 2].map((i) => (extent.min[i] + extent.max[i]) / 2) as [number, number, number]);
	const size = Math.max(...[0, 1, 2].map((i) => extent.max[i] - extent.min[i]));
	const distance = size * 0.95 + 2;

	// Release offscreen WebGL contexts while preserving the playback position.
	const holder = useRef<HTMLDivElement>(null);
	const [visible, setVisible] = useState(false);
	useEffect(() => {
		const el = holder.current;
		if (!el) return;
		const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	return (
		<div ref={holder} className="h-64 w-full overflow-hidden rounded-md bg-zinc-50 dark:bg-zinc-900">
			{visible && (
				<Canvas
					orthographic={flat}
					camera={flat
						? { up: [0, 1, 0], position: [middle.x, middle.y, middle.z + distance], zoom: 75 / Math.max(1, size / 2) }
						: { up: [0, 0, 1], fov: 40, position: [middle.x + distance * 0.8, middle.y - distance * 1.3, middle.z + distance * 0.8] }}
				>
					<ambientLight intensity={0.75} />
					<directionalLight position={[middle.x + 6, middle.y - 9, middle.z + 12]} intensity={1.5} />
					<OrbitControls makeDefault target={middle} enableZoom={false} enableRotate={!flat} enablePan={!flat} />
					<gridHelper
						args={[Math.ceil(size) + 6, Math.ceil(size) + 6, "#a1a1aa", "#d4d4d8"]}
						rotation={[Math.PI / 2, 0, 0]}
						position={[Math.round(middle.x), Math.round(middle.y), extent.min[2]]}
					/>
					{box && (
						<mesh
							position={[(box.min[0] + box.max[0] + 1) / 2, (box.min[1] + box.max[1] + 1) / 2, (box.min[2] + box.max[2] + 1) / 2]}
							raycast={() => null}
						>
							<boxGeometry args={[box.max[0] - box.min[0] + 1, box.max[1] - box.min[1] + 1, box.max[2] - box.min[2] + 1]} />
							<meshBasicMaterial transparent opacity={0} depthWrite={false} />
							<Edges color="#10b981" />
						</mesh>
					)}
					<Cubes {...props} clockRef={clockRef} />
				</Canvas>
			)}
		</div>
	);
}
