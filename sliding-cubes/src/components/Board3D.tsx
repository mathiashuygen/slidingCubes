"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CanvasTexture, DoubleSide, type Mesh, SRGBColorSpace, Vector3 } from "three";
import { type Box, type Cell, type Configuration, type Move, type MoveCheck, add, cellKey, equals, sub, unit } from "@/engine";
import type { Feedback } from "@/game/gameState";

const STEP_MS = 260;
/** Pointer travel (px) above which a click counts as an orbit drag. */
const DRAG_THRESHOLD = 4;

const COLORS = {
	cube: "#0ea5e9",
	cubeEdge: "#075985",
	selected: "#fbbf24",
	slide: "#0ea5e9",
	convex: "#8b5cf6",
	illegal: "#a1a1aa",
	support: "#f59e0b",
	problem: "#f43f5e",
	box: "#10b981",
};

export interface Candidate {
	to: Cell;
	check: MoveCheck;
}

interface Board3DProps {
	config: Configuration;
	box: Box;
	selected: Cell | null;
	/** Empty cells the selected cube could reach locally, legal or not. */
	candidates: Candidate[];
	feedback: Feedback | null;
	lastStep: { move: Move; id: number } | null;
	onCellClick: (cell: Cell) => void;
	onDeselect: () => void;
}

/** Centre of a unit cell. The engine's z axis points up, and so does the camera. */
function center(c: Cell): Vector3 {
	return new Vector3(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
}

function isClick(e: ThreeEvent<MouseEvent>): boolean {
	e.stopPropagation();
	return e.delta <= DRAG_THRESHOLD;
}

export default function Board3D(props: Board3DProps) {
	const { box } = props;
	const size = sub(box.max, box.min).map((d) => d + 1);
	const middle = new Vector3(box.min[0] + size[0] / 2, box.min[1] + size[1] / 2, box.min[2] + size[2] / 2);
	const distance = Math.max(...size) + 4;

	return (
		<Canvas
			camera={{
				up: [0, 0, 1],
				fov: 45,
				position: [middle.x + distance * 0.9, middle.y - distance * 1.4, middle.z + distance * 1.1],
			}}
			onPointerMissed={(e) => {
				if (e.type === "click") props.onDeselect();
			}}
		>
			<ambientLight intensity={0.7} />
			<directionalLight position={[middle.x + 6, middle.y - 9, middle.z + 12]} intensity={1.6} />
			<OrbitControls makeDefault target={middle} />
			<Scene {...props} middle={middle} size={size} />
		</Canvas>
	);
}

function Scene({
	config,
	box,
	selected,
	candidates,
	feedback,
	lastStep,
	onCellClick,
	middle,
	size,
}: Board3DProps & { middle: Vector3; size: number[] }) {
	const [hovered, setHovered] = useState<Cell | null>(null);
	const hoveredCheck = hovered ? candidates.find((c) => equals(c.to, hovered))?.check : undefined;
	const gridSize = 2 * Math.ceil(Math.max(size[0], size[1]) / 2) + 6;
	const problemCells = feedback?.tone === "error" ? feedback.cells : [];

	return (
		<>
			{/* Floor grid in the plane z = box.min.z, lined up with integer cells. */}
			<gridHelper
				args={[gridSize, gridSize, "#a1a1aa", "#d4d4d8"]}
				rotation={[Math.PI / 2, 0, 0]}
				position={[Math.round(middle.x), Math.round(middle.y), box.min[2]]}
			/>
			<OriginGuide box={box} size={size} />

			{/* The in-place box. */}
			<mesh position={middle}>
				<boxGeometry args={[size[0], size[1], size[2]]} />
				<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				<Edges color={COLORS.box} />
			</mesh>

			{[...config].map((c) => (
				<Cube
					key={cellKey(c)}
					cell={c}
					selected={selected !== null && equals(selected, c)}
					step={lastStep && equals(lastStep.move.to, c) ? lastStep : null}
					config={config}
					onClick={(e) => isClick(e) && onCellClick(c)}
					onHover={(on) => setHovered((h) => (on ? c : h && equals(h, c) ? null : h))}
				/>
			))}

			{candidates.map(({ to, check }) => {
				const color = !check.legal ? COLORS.illegal : check.type === "slide" ? COLORS.slide : COLORS.convex;
				const scale = !check.legal ? 0.25 : hovered && equals(hovered, to) ? 0.6 : 0.45;
				return (
					<mesh
						key={cellKey(to)}
						position={center(to)}
						onClick={(e) => isClick(e) && onCellClick(to)}
						onPointerOver={(e) => {
							e.stopPropagation();
							setHovered(to);
						}}
						onPointerOut={() => setHovered((h) => (h && equals(h, to) ? null : h))}
					>
						<boxGeometry args={[scale, scale, scale]} />
						<meshStandardMaterial color={color} transparent opacity={check.legal ? 0.75 : 0.35} />
					</mesh>
				);
			})}

			{/* Coordinates of the hovered cube or destination, as used in move lists. */}
			{hovered && (
				<Label
					position={center(hovered).setZ(hovered[2] + 1.2)}
					text={`(${hovered[0]}, ${hovered[1]}, ${hovered[2]})`}
					background="rgba(24, 24, 27, 0.85)"
				/>
			)}

			{hoveredCheck?.legal && (
				<>
					{hoveredCheck.support.map((c) => (
						<Outline key={`s${cellKey(c)}`} cell={c} color={COLORS.support} scale={1.06} />
					))}
					{hoveredCheck.clearance.map((c) => (
						<Outline key={`c${cellKey(c)}`} cell={c} color={COLORS.illegal} scale={0.9} />
					))}
				</>
			)}

			{problemCells.map((c) => (
				<Outline key={`p${cellKey(c)}`} cell={c} color={COLORS.problem} scale={1.1} />
			))}
		</>
	);
}

const AXES = [
	{ dir: new Vector3(1, 0, 0), color: "#ef4444", label: "x" },
	{ dir: new Vector3(0, 1, 0), color: "#22c55e", label: "y" },
	{ dir: new Vector3(0, 0, 1), color: "#3b82f6", label: "z" },
];

/**
 * Marks the origin (the box's minimum corner) that cubes are compacted
 * towards: a labelled point, the three box walls that meet there, and
 * labelled axes running along the box edges from it.
 */
function OriginGuide({ box, size }: { box: Box; size: number[] }) {
	const [ox, oy, oz] = box.min;
	const origin = useMemo(() => new Vector3(ox, oy, oz), [ox, oy, oz]);
	const wall = <meshBasicMaterial color={COLORS.box} transparent opacity={0.12} side={DoubleSide} depthWrite={false} />;

	return (
		<>
			{/* Floor, back and left walls of the box: the corner to fill. Raised slightly above the grid. */}
			<mesh position={[ox + size[0] / 2, oy + size[1] / 2, oz + 0.002]} raycast={() => null}>
				<planeGeometry args={[size[0], size[1]]} />
				{wall}
			</mesh>
			<mesh position={[ox + size[0] / 2, oy, oz + size[2] / 2]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
				<planeGeometry args={[size[0], size[2]]} />
				{wall}
			</mesh>
			<mesh position={[ox, oy + size[1] / 2, oz + size[2] / 2]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
				<planeGeometry args={[size[2], size[1]]} />
				{wall}
			</mesh>

			<mesh position={origin} raycast={() => null}>
				<sphereGeometry args={[0.12]} />
				<meshBasicMaterial color={COLORS.box} />
			</mesh>
			<Label position={origin.clone().add(new Vector3(-0.3, -0.3, -0.35))} text={`origin (${ox}, ${oy}, ${oz})`} background="#059669" />

			{AXES.map(({ dir, color, label: name }, i) => {
				const length = size[i] + 1;
				return (
					<group key={name}>
						<arrowHelper args={[dir, origin, length, color, 0.3, 0.18]} />
						<Label position={origin.clone().addScaledVector(dir, length + 0.35)} text={name} color={color} background="rgba(255, 255, 255, 0.9)" />
					</group>
				);
			})}
		</>
	);
}

/**
 * Text drawn on a canvas and shown as a sprite, so it always faces the camera
 * and stays readable in front of cubes.
 */
function Label({ position, text, color = "#ffffff", background }: { position: Vector3; text: string; color?: string; background?: string }) {
	const texture = useMemo(() => {
		const scale = 4;
		const font = `600 ${16 * scale}px ui-sans-serif, system-ui, sans-serif`;
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d")!;
		ctx.font = font;
		const padding = background ? 7 * scale : 0;
		canvas.width = Math.ceil(ctx.measureText(text).width) + 2 * padding;
		canvas.height = 26 * scale;
		if (background) {
			ctx.fillStyle = background;
			ctx.beginPath();
			ctx.roundRect(0, 0, canvas.width, canvas.height, 6 * scale);
			ctx.fill();
		}
		// Resizing the canvas resets its state, so set the font again.
		ctx.font = font;
		ctx.fillStyle = color;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(text, canvas.width / 2, canvas.height / 2);
		const result = new CanvasTexture(canvas);
		result.colorSpace = SRGBColorSpace;
		return result;
	}, [text, color, background]);
	useEffect(() => () => texture.dispose(), [texture]);

	const height = 0.4;
	const aspect = texture.image.width / texture.image.height;
	return (
		<sprite position={position} scale={[height * aspect, height, 1]} renderOrder={10} raycast={() => null}>
			<spriteMaterial map={texture} depthTest={false} transparent toneMapped={false} />
		</sprite>
	);
}

/** Wireframe cube around a cell, for highlighting. */
function Outline({ cell, color, scale }: { cell: Cell; color: string; scale: number }) {
	return (
		<mesh position={center(cell)} raycast={() => null}>
			<boxGeometry args={[scale, scale, scale]} />
			<meshBasicMaterial transparent opacity={0} depthWrite={false} />
			<Edges color={color} lineWidth={2} />
		</mesh>
	);
}

interface CubeProps {
	cell: Cell;
	selected: boolean;
	/** Set when this cube just arrived here, to animate the move. */
	step: { move: Move; id: number } | null;
	config: Configuration;
	onClick: (e: ThreeEvent<MouseEvent>) => void;
	onHover: (hovered: boolean) => void;
}

function Cube({ cell, selected, step, config, onClick, onHover }: CubeProps) {
	const ref = useRef<Mesh>(null);
	const animation = useRef<{ start: number; path: Vector3[] } | null>(null);
	const position = useMemo(() => center(cell), [cell]);

	useLayoutEffect(() => {
		if (!step || !ref.current) return;
		const { from, to } = step.move;
		const path = [center(from)];
		// A convex transition sweeps through the empty corner of its 2×2 square.
		const changed = ([0, 1, 2] as const).filter((a) => from[a] !== to[a]);
		if (changed.length === 2) {
			const corners = changed.map((a) => add(from, unit(a, to[a] > from[a] ? 1 : -1)));
			const clearance = corners.find((c) => !config.has(c));
			if (clearance) path.push(center(clearance));
		}
		path.push(center(to));
		animation.current = { start: performance.now(), path };
		ref.current.position.copy(path[0]);
		// Only a new step should animate, not other re-renders.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [step?.id]);

	useFrame(() => {
		const a = animation.current;
		const mesh = ref.current;
		if (!a || !mesh) return;
		const t = Math.min(1, (performance.now() - a.start) / STEP_MS);
		const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
		const segments = a.path.length - 1;
		const s = eased * segments;
		const i = Math.min(Math.floor(s), segments - 1);
		mesh.position.lerpVectors(a.path[i], a.path[i + 1], s - i);
		if (t === 1) animation.current = null;
	});

	return (
		<mesh
			ref={ref}
			position={position}
			onClick={onClick}
			onPointerOver={(e) => {
				e.stopPropagation();
				onHover(true);
			}}
			onPointerOut={() => onHover(false)}
		>
			<boxGeometry args={[0.92, 0.92, 0.92]} />
			<meshStandardMaterial color={selected ? COLORS.selected : COLORS.cube} />
			<Edges color={selected ? "#b45309" : COLORS.cubeEdge} />
		</mesh>
	);
}
