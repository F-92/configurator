"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid } from "@react-three/drei";
import * as THREE from "three";
import {
  WallLayout,
  rectangleLayout,
  fromPoints,
  traceLayout,
} from "../lib/wallLayout";
import type { Wall } from "../lib/wallLayout";
import { getPineTexture } from "../lib/woodTexture";

// ---- Constants ----
const MM = 0.001; // mm → meters for Three.js
const WALL_HEIGHT = 2700; // mm
const PLATE_HEIGHT = 45; // mm
const STUD_COLOR = "#f5e6c8";
const WALL_SURFACE_COLOR = "#dfc4a0";

// ---- Preset Layouts ----

interface LayoutPreset {
  name: string;
  description: string;
  create: (thickness: number, studSpacing: number) => WallLayout;
}

const PRESETS: LayoutPreset[] = [
  {
    name: "Rektangel 10×8m",
    description: "Enkel rektangulär byggnad",
    create: (t, s) =>
      rectangleLayout(10_000, 8_000, { thickness: t, studSpacing: s }),
  },
  {
    name: "Rektangel 12×10m",
    description: "Större rektangulär byggnad",
    create: (t, s) =>
      rectangleLayout(12_000, 10_000, { thickness: t, studSpacing: s }),
  },
  {
    name: "L-form",
    description: "L-formad byggnad med innerhörn",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [6_000, 0],
          [6_000, 4_000],
          [10_000, 4_000],
          [10_000, 8_000],
          [0, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "T-form",
    description: "T-formad byggnad",
    create: (t, s) =>
      fromPoints(
        [
          [3_000, 0],
          [9_000, 0],
          [9_000, 5_000],
          [12_000, 5_000],
          [12_000, 8_000],
          [0, 8_000],
          [0, 5_000],
          [3_000, 5_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Trapets",
    description: "Snedvinklade sidor",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [12_000, 0],
          [10_000, 8_000],
          [2_000, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Sexhörning",
    description: "Hexagonal form",
    create: (t, s) => {
      const r = 5_000;
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push([
          Math.round(r * Math.cos(a) + r),
          Math.round(r * Math.sin(a) + r),
        ]);
      }
      return fromPoints(pts, { thickness: t, studSpacing: s });
    },
  },
  {
    name: "U-form",
    description: "U-formad byggnad",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [3_000, 0],
          [3_000, 5_000],
          [7_000, 5_000],
          [7_000, 0],
          [10_000, 0],
          [10_000, 8_000],
          [0, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Trace: Vinkelform",
    description: "Byggd via trace-byggare",
    create: (t, s) =>
      traceLayout({ thickness: t, studSpacing: s })
        .wall(8_000)
        .turn(90)
        .wall(4_000)
        .turn(-90)
        .wall(4_000)
        .turn(90)
        .wall(6_000)
        .turn(90)
        .wall(12_000)
        .close(),
  },
];

// ---- 3D Wall Components ----

/** Renders a single wall's stud framing in 3D */
function WallFraming({ wall, wallHeight }: { wall: Wall; wallHeight: number }) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const meshes = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    const effLen = wall.effectiveLength * MM;
    const wallH = wallHeight * MM;
    const studW = wall.studLayout.studs[0]?.width ?? 45;
    const studD = wall.studLayout.studs[0]?.depth ?? 145;
    const studWM = studW * MM;
    const studDM = studD * MM;
    const plateH = PLATE_HEIGHT * MM;
    const fullStudH = wallH - 2 * plateH;

    // Bottom plate
    result.push({
      key: "bp",
      pos: [effLen / 2, plateH / 2, 0],
      size: [effLen, plateH, studDM],
    });

    // Top plate
    result.push({
      key: "tp",
      pos: [effLen / 2, wallH - plateH / 2, 0],
      size: [effLen, plateH, studDM],
    });

    // Studs
    for (let i = 0; i < wall.studLayout.studs.length; i++) {
      const stud = wall.studLayout.studs[i];
      const x = stud.centerPosition * MM;
      result.push({
        key: `s-${i}`,
        pos: [x, plateH + fullStudH / 2, 0],
        size: [studWM, fullStudH, studDM],
      });
    }

    // California corner studs — turned 90°, offset toward inner or outer face
    for (let i = 0; i < wall.studLayout.cornerStuds.length; i++) {
      const cs = wall.studLayout.cornerStuds[i];
      const x = cs.centerPosition * MM;
      const halfDepth = (studD / 2) * MM;
      const halfStudW = (studW / 2) * MM;
      // Inner: offset +Z (toward interior), Outer: offset -Z (toward exterior)
      const zOffset =
        cs.offsetSide === "inner"
          ? halfDepth - halfStudW
          : -(halfDepth - halfStudW);
      result.push({
        key: `cs-${i}`,
        pos: [x, plateH + fullStudH / 2, zOffset],
        size: [studDM, fullStudH, studWM], // swapped width/depth (rotated 90°)
      });
    }

    return result;
  }, [wall, wallHeight]);

  // Position the group at the wall's physical start, rotated to face the correct direction
  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    // Position at outer start, midway to inner start for centering on wall thickness
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM; // flip Y→Z
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle, // Three.js Y rotation maps local +X to (cosθ, 0, -sinθ), matching 2D→3D coord flip
    };
  }, [wall]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {meshes.map((m) => (
        <group key={m.key} position={m.pos}>
          <mesh>
            <boxGeometry args={m.size} />
            <meshStandardMaterial
              map={pineTexture}
              color={STUD_COLOR}
              roughness={0.85}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...m.size)]} />
            <lineBasicMaterial color="#c8b08a" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Renders a single wall as a solid surface in 3D */
function WallSurface({
  wall,
  wallHeight,
  color,
}: {
  wall: Wall;
  wallHeight: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const h = wallHeight * MM;
    const q = wall.quad;

    // Build a quadrilateral shape from the wall's physical quad, extruded to wall height
    const shape = new THREE.Shape();
    shape.moveTo(q.outerStart.x * MM, q.outerStart.y * MM);
    shape.lineTo(q.outerEnd.x * MM, q.outerEnd.y * MM);
    shape.lineTo(q.innerEnd.x * MM, q.innerEnd.y * MM);
    shape.lineTo(q.innerStart.x * MM, q.innerStart.y * MM);
    shape.closePath();

    const extrudeSettings = { depth: h, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so the extrusion goes up (Y axis) instead of Z
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [wall, wallHeight]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.7}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#b0a080" linewidth={1} />
      </lineSegments>
    </group>
  );
}

/** Floor slab visualisation */
function FloorSlab({ layout }: { layout: WallLayout }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const corners = layout.outerCorners;
    shape.moveTo(corners[0].x * MM, corners[0].y * MM);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i].x * MM, corners[i].y * MM);
    }
    shape.closePath();

    const extrudeSettings = { depth: 0.15, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.15, 0);
    return geo;
  }, [layout]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#808080" roughness={0.9} />
    </mesh>
  );
}

/** Corner marker spheres (for visual debugging) */
function CornerMarkers({
  layout,
  showInner,
}: {
  layout: WallLayout;
  showInner: boolean;
}) {
  return (
    <group>
      {layout.outerCorners.map((c, i) => (
        <mesh key={`oc-${i}`} position={[c.x * MM, 0, -c.y * MM]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))}
      {showInner &&
        layout.innerCorners.map((c, i) => (
          <mesh key={`ic-${i}`} position={[c.x * MM, 0, -c.y * MM]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
        ))}
    </group>
  );
}

/** Wall label showing wall index, joint type, and effective length */
function WallLabels({
  layout,
  wallHeight,
}: {
  layout: WallLayout;
  wallHeight: number;
}) {
  return (
    <group>
      {layout.walls.map((w) => {
        const midX = ((w.quad.outerStart.x + w.quad.outerEnd.x) / 2) * MM;
        const midZ = -(((w.quad.outerStart.y + w.quad.outerEnd.y) / 2) * MM);
        const y = wallHeight * MM + 0.3;
        // Offset label slightly outward from the wall
        const offX = -w.inwardNormal.x * 0.3;
        const offZ = w.inwardNormal.y * 0.3; // flip Y→Z

        return (
          <group key={w.id} position={[midX + offX, y, midZ + offZ]}>
            <sprite scale={[1.2, 0.3, 1]}>
              <spriteMaterial
                map={createTextTexture(
                  `${w.id} [${w.startCorner.joint[0].toUpperCase()}/${w.endCorner.joint[0].toUpperCase()}] ${(w.effectiveLength / 1000).toFixed(2)}m`,
                )}
                transparent
              />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}

/** Create a text texture for sprite labels */
function createTextTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Dimension lines for a single wall — hidden when the wall doesn't face the camera */
function WallStudDimensions({ wall }: { wall: Wall }) {
  const groupRef = useRef<THREE.Group>(null);

  // Outward normal in 3D (opposite of inwardNormal)
  const outNormal = useMemo(
    () => new THREE.Vector3(-wall.inwardNormal.x, 0, wall.inwardNormal.y),
    [wall],
  );

  // Wall center on the floor plane (for dot-product test)
  const wallCenter = useMemo(() => {
    const q = wall.quad;
    const cx = ((q.outerStart.x + q.outerEnd.x) / 2) * MM;
    const cz = -(((q.outerStart.y + q.outerEnd.y) / 2) * MM);
    return new THREE.Vector3(cx, 0, cz);
  }, [wall]);

  // Wall direction unit vector in 3D
  const wallDir = useMemo(
    () => new THREE.Vector3(wall.direction.x, 0, -wall.direction.y).normalize(),
    [wall],
  );

  // Rotation angle around Y to align with wall direction
  const rotY = useMemo(() => Math.atan2(wallDir.x, wallDir.z), [wallDir]);

  const dims = useMemo(() => {
    const result: {
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      midPos: THREE.Vector3;
      label: string;
    }[] = [];

    if (wall.studLayout.studs.length < 2) return result;
    const q = wall.quad;
    // Direction from wall.start (outer corner) to wall.end
    const wdx = (wall.end.x - wall.start.x) * MM;
    const wdz = -(wall.end.y - wall.start.y) * MM;
    const wlen = Math.sqrt(wdx * wdx + wdz * wdz);
    if (wlen < 0.001) return result;
    const ux = wdx / wlen;
    const uz = wdz / wlen;

    // Offset outward from the outer face
    const offset = 0.25;
    const offX = outNormal.x * offset;
    const offZ = outNormal.z * offset;

    // Origin = outer corner (wall.start) for positioning
    const ox = wall.start.x * MM + offX;
    const oz = -(wall.start.y * MM) + offZ;
    const retract = wall.startCorner.retraction;
    const y = 0.05;

    // c/c between consecutive studs (positions from outer corner)
    for (let si = 0; si < wall.studLayout.studs.length - 1; si++) {
      const s0 = retract + wall.studLayout.studs[si].centerPosition;
      const s1 = retract + wall.studLayout.studs[si + 1].centerPosition;
      const cc = Math.round(s1 - s0);

      const p0 = s0 * MM;
      const p1 = s1 * MM;

      const sx = ox + ux * p0;
      const sz = oz + uz * p0;
      const ex = ox + ux * p1;
      const ez = oz + uz * p1;

      result.push({
        startPos: new THREE.Vector3(sx, y, sz),
        endPos: new THREE.Vector3(ex, y, ez),
        midPos: new THREE.Vector3((sx + ex) / 2, y, (sz + ez) / 2),
        label: `${cc}`,
      });
    }
    return result;
  }, [wall, outNormal]);

  // Dashed line material (shared)
  const dashMat = useMemo(() => {
    const mat = new THREE.LineDashedMaterial({
      color: "#fbbf24",
      dashSize: 0.06,
      gapSize: 0.04,
      linewidth: 1,
    });
    return mat;
  }, []);

  // Each frame: show only when camera is on the outer side of the wall
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const toCamera = new THREE.Vector3().subVectors(
      camera.position,
      wallCenter,
    );
    toCamera.y = 0;
    groupRef.current.visible = toCamera.dot(outNormal) > 0;
  });

  // Tick mark length (perpendicular to wall)
  const tickLen = 0.08;

  return (
    <group ref={groupRef}>
      {dims.map((d, i) => {
        // Dashed line between stud positions
        const dashGeo = new THREE.BufferGeometry().setFromPoints([
          d.startPos,
          d.endPos,
        ]);
        dashGeo.computeBoundingSphere();

        // Tick marks at start and end (perpendicular to wall along outward normal)
        const t1Start = d.startPos.clone().addScaledVector(outNormal, -tickLen);
        const t1End = d.startPos.clone().addScaledVector(outNormal, tickLen);
        const t2Start = d.endPos.clone().addScaledVector(outNormal, -tickLen);
        const t2End = d.endPos.clone().addScaledVector(outNormal, tickLen);

        const tick1Geo = new THREE.BufferGeometry().setFromPoints([
          t1Start,
          t1End,
        ]);
        const tick2Geo = new THREE.BufferGeometry().setFromPoints([
          t2Start,
          t2End,
        ]);

        const tickMat = new THREE.LineBasicMaterial({ color: "#fbbf24" });
        const tick1 = new THREE.Line(tick1Geo, tickMat);
        const tick2 = new THREE.Line(tick2Geo, tickMat);

        return (
          <group key={i}>
            {/* Dashed dimension line */}
            <lineSegments
              geometry={dashGeo}
              material={dashMat}
              onUpdate={(self) => self.computeLineDistances()}
            />
            {/* Tick at start */}
            <primitive object={tick1} />
            {/* Tick at end */}
            <primitive object={tick2} />
            {/* Text label aligned with wall */}
            <group
              position={[
                d.midPos.x + outNormal.x * 0.02,
                d.midPos.y + 0.01,
                d.midPos.z + outNormal.z * 0.02,
              ]}
              rotation={[-Math.PI / 2, 0, -rotY + Math.PI / 2]}
            >
              <mesh>
                <planeGeometry args={[0.35, 0.12]} />
                <meshBasicMaterial transparent opacity={0}>
                  {/* invisible backing for text */}
                </meshBasicMaterial>
              </mesh>
              <sprite scale={[0.4, 0.12, 1]}>
                <spriteMaterial
                  map={createDimTextTexture(d.label)}
                  transparent
                  depthTest={false}
                />
              </sprite>
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** Create a text texture with transparent background for dimension labels */
function createDimTextTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 40px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Stud spacing dimension lines — only visible for camera-facing walls */
function StudDimensions({ layout }: { layout: WallLayout }) {
  return (
    <group>
      {layout.walls.map((w) => (
        <WallStudDimensions key={w.id} wall={w} />
      ))}
    </group>
  );
}

/** The complete 3D model of a WallLayout */
function WallLayoutModel({
  layout,
  wallHeight,
  showFraming,
  showLabels,
  showCorners,
  showStudDimensions,
}: {
  layout: WallLayout;
  wallHeight: number;
  showFraming: boolean;
  showLabels: boolean;
  showCorners: boolean;
  showStudDimensions: boolean;
}) {
  return (
    <group>
      <FloorSlab layout={layout} />

      {layout.walls.map((w) =>
        showFraming ? (
          <WallFraming key={w.id} wall={w} wallHeight={wallHeight} />
        ) : (
          <WallSurface
            key={w.id}
            wall={w}
            wallHeight={wallHeight}
            color={WALL_SURFACE_COLOR}
          />
        ),
      )}

      {showLabels && <WallLabels layout={layout} wallHeight={wallHeight} />}
      {showCorners && <CornerMarkers layout={layout} showInner={showFraming} />}
      {showStudDimensions && showFraming && <StudDimensions layout={layout} />}
    </group>
  );
}

// ---- Main Scene Component ----

export default function WallLayoutScene() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [thickness, setThickness] = useState(145);
  const [studSpacing, setStudSpacing] = useState(600);
  const [wallHeight, setWallHeight] = useState(WALL_HEIGHT);
  const [showFraming, setShowFraming] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showCorners, setShowCorners] = useState(false);
  const [showStudDimensions, setShowStudDimensions] = useState(true);

  const layout = useMemo(() => {
    return PRESETS[presetIndex].create(thickness, studSpacing);
  }, [presetIndex, thickness, studSpacing]);

  // Camera target: center of the building footprint
  const cameraTarget = useMemo(() => {
    const corners = layout.outerCorners;
    let cx = 0,
      cy = 0;
    for (const c of corners) {
      cx += c.x;
      cy += c.y;
    }
    cx = (cx / corners.length) * MM;
    cy = (cy / corners.length) * MM;
    return [cx, 1, -cy] as [number, number, number];
  }, [layout]);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-900">
      {/* Sidebar controls */}
      <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-zinc-800/60 backdrop-blur border-b lg:border-b-0 lg:border-r border-zinc-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700">
          <h1 className="text-lg font-bold text-white">Väggplanering</h1>
          <p className="text-xs text-zinc-400">Nytt vägglayout-system</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Preset selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Byggnadsform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPresetIndex(i)}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    i === presetIndex
                      ? "bg-amber-400/90 text-zinc-900 font-medium"
                      : "bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div
                    className={
                      i === presetIndex ? "text-zinc-700" : "text-zinc-500"
                    }
                  >
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Wall thickness */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Väggtjocklek: {thickness} mm
            </label>
            <input
              type="range"
              min={95}
              max={245}
              step={25}
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>95mm</span>
              <span>145mm</span>
              <span>195mm</span>
              <span>245mm</span>
            </div>
          </div>

          {/* Stud spacing */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Regelavstånd (c/c): {studSpacing} mm
            </label>
            <input
              type="range"
              min={300}
              max={900}
              step={50}
              value={studSpacing}
              onChange={(e) => setStudSpacing(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>300</span>
              <span>450</span>
              <span>600</span>
              <span>900</span>
            </div>
          </div>

          {/* Wall height */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Vägghöjd: {(wallHeight / 1000).toFixed(1)} m
            </label>
            <input
              type="range"
              min={2400}
              max={4000}
              step={100}
              value={wallHeight}
              onChange={(e) => setWallHeight(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          {/* View toggles */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Visning
            </label>
            <div className="space-y-2">
              {[
                {
                  label: "Stomme",
                  checked: showFraming,
                  toggle: () => setShowFraming((v) => !v),
                },
                {
                  label: "Väggetiketter",
                  checked: showLabels,
                  toggle: () => setShowLabels((v) => !v),
                },
                {
                  label: "Hörnpunkter",
                  checked: showCorners,
                  toggle: () => setShowCorners((v) => !v),
                },
                {
                  label: "Regelmått",
                  checked: showStudDimensions,
                  toggle: () => setShowStudDimensions((v) => !v),
                },
              ].map((opt) => (
                <label
                  key={opt.label}
                  className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={opt.toggle}
                    className="accent-amber-400"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Layout info */}
          <div className="p-3 bg-zinc-700/30 rounded-lg space-y-1">
            <h3 className="text-sm font-medium text-zinc-300">Layoutinfo</h3>
            <div className="text-xs text-zinc-400 space-y-0.5">
              <div>Antal väggar: {layout.count}</div>
              <div>
                Ytterperimeter:{" "}
                {(
                  layout.walls.reduce((sum, w) => sum + w.centerlineLength, 0) /
                  1000
                ).toFixed(2)}{" "}
                m
              </div>
              <div>
                Effektiv vägglängd:{" "}
                {(
                  layout.walls.reduce((sum, w) => sum + w.effectiveLength, 0) /
                  1000
                ).toFixed(2)}{" "}
                m
              </div>
              <div>
                Totalt antal reglar:{" "}
                {layout.walls.reduce(
                  (sum, w) => sum + w.studLayout.studs.length,
                  0,
                )}
              </div>
            </div>

            {/* Per-wall breakdown */}
            <div className="mt-2 pt-2 border-t border-zinc-600">
              <h4 className="text-xs font-medium text-zinc-400 mb-1">
                Per vägg
              </h4>
              {layout.walls.map((w) => (
                <div
                  key={w.id}
                  className="text-xs text-zinc-500 flex justify-between"
                >
                  <span>
                    {w.id}{" "}
                    <span className="text-zinc-600">
                      [{w.startCorner.joint[0].toUpperCase()}/
                      {w.endCorner.joint[0].toUpperCase()}]
                    </span>
                  </span>
                  <span>
                    {(w.effectiveLength / 1000).toFixed(2)}m ·{" "}
                    {w.studLayout.studs.length} st · c/c{" "}
                    {w.studLayout.actualSpacing.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* 3D Viewport */}
      <main className="flex-1 relative min-h-100">
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          className="w-full h-full"
        >
          <color attach="background" args={["#ffffff"]} />
          <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            enablePan
            minDistance={3}
            maxDistance={60}
            maxPolarAngle={Math.PI / 2 - 0.05}
            zoomToCursor
          />

          {/* Lighting */}
          <ambientLight intensity={0.7} />
          <directionalLight
            position={[20, 20, 10]}
            intensity={1.0}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-10, 15, -10]} intensity={0.5} />
          <directionalLight position={[5, 8, -15]} intensity={0.3} />
          <hemisphereLight args={["#f0f0ff", "#d4c9a8", 0.4]} />

          <WallLayoutModel
            layout={layout}
            wallHeight={wallHeight}
            showFraming={showFraming}
            showLabels={showLabels}
            showCorners={showCorners}
            showStudDimensions={showStudDimensions}
          />

          <Grid
            args={[100, 100]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#d4d4d4"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#a3a3a3"
            position={[0, -0.16, 0]}
            fadeDistance={50}
            fadeStrength={1}
            infiniteGrid
          />
        </Canvas>

        {/* Viewport help */}
        <div className="absolute bottom-4 left-4 text-xs text-zinc-500 bg-white/70 backdrop-blur rounded px-2 py-1">
          Dra för att rotera · Scrolla för att zooma · Högerklick för att
          panorera
        </div>
      </main>
    </div>
  );
}
