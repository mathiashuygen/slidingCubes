"use client";

import { Edges, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { Vector3 } from "three";
import { type Cell, Configuration, add, cellKey, equals } from "@/engine";

export type EditTool = "add" | "remove";

interface SandboxEditor3DProps {
	cells: Cell[];
	tool: EditTool;
	onAdd: (cell: Cell) => void;
	onRemove: (cell: Cell) => void;
}

/** Pointer travel (px) above which a click counts as an orbit drag. */
const DRAG_THRESHOLD = 4;

const center = (c: Cell) => new Vector3(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);

/** The cell next to `cell` across the face that was hit. */
function neighbourAcross(cell: Cell, e: ThreeEvent<PointerEvent | MouseEvent>): Cell | null {
	const n = e.face?.normal;
	if (!n) return null;
	const dir: Cell = [Math.round(n.x), Math.round(n.y), Math.round(n.z)];
	return add(cell, dir);
}

/**
 * Builds a 3D configuration by clicking: in add mode a click on a cube face
 * puts a new cube against that face, in remove mode a click removes the cube.
 * New cubes always touch an existing one, so the shape stays connected.
 */
export default function SandboxEditor3D({ cells, tool, onAdd, onRemove }: SandboxEditor3DProps) {
	const [hover, setHover] = useState<{ cube: Cell; target: Cell | null } | null>(null);
	const box = useMemo(() => new Configuration(cells).boundingBox(), [cells]);
	const size = [0, 1, 2].map((i) => box.max[i] - box.min[i] + 1);
	// The camera keeps the target it was given at mount, so building does not make the view jump.
	const [initial] = useState(() => center(box.min));
	const distance = 11;

	function cubeEvents(c: Cell) {
		return {
			onPointerMove(e: ThreeEvent<PointerEvent>) {
				e.stopPropagation();
				setHover({ cube: c, target: tool === "add" ? neighbourAcross(c, e) : null });
			},
			onPointerOut() {
				setHover((h) => (h && equals(h.cube, c) ? null : h));
			},
			onClick(e: ThreeEvent<MouseEvent>) {
				e.stopPropagation();
				if (e.delta > DRAG_THRESHOLD) return;
				// The preview would otherwise sit on the new cube until the pointer moves.
				setHover(null);
				if (tool === "remove") onRemove(c);
				else {
					const target = neighbourAcross(c, e);
					if (target) onAdd(target);
				}
			},
		};
	}

	const removing = tool === "remove" && hover ? hover.cube : null;

	return (
		<Canvas camera={{ up: [0, 0, 1], fov: 45, position: [initial.x + distance * 0.8, initial.y - distance * 1.2, initial.z + distance * 0.9] }}>
			<ambientLight intensity={0.7} />
			<directionalLight position={[initial.x + 6, initial.y - 9, initial.z + 12]} intensity={1.6} />
			<OrbitControls makeDefault target={initial} />
			<gridHelper
				args={[24, 24, "#a1a1aa", "#d4d4d8"]}
				rotation={[Math.PI / 2, 0, 0]}
				position={[Math.round(initial.x), Math.round(initial.y), box.min[2]]}
			/>

			{/* The bounding box: the solver must compact the cubes inside it. */}
			<mesh position={[box.min[0] + size[0] / 2, box.min[1] + size[1] / 2, box.min[2] + size[2] / 2]} raycast={() => null}>
				<boxGeometry args={[size[0], size[1], size[2]]} />
				<meshBasicMaterial transparent opacity={0} depthWrite={false} />
				<Edges color="#10b981" />
			</mesh>

			{cells.map((c) => (
				<mesh key={cellKey(c)} position={center(c)} {...cubeEvents(c)}>
					<boxGeometry args={[0.96, 0.96, 0.96]} />
					<meshStandardMaterial color={removing && equals(removing, c) ? "#f43f5e" : "#0ea5e9"} />
					<Edges color="#075985" />
				</mesh>
			))}

			{hover?.target && (
				<mesh position={center(hover.target)} raycast={() => null}>
					<boxGeometry args={[0.96, 0.96, 0.96]} />
					<meshStandardMaterial color="#22c55e" transparent opacity={0.45} />
				</mesh>
			)}
		</Canvas>
	);
}
