"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line, Html } from "@react-three/drei";
import { HouseConfig } from "../lib/types";

// ══════════════════════════════════════════════════════════════
// Benders Palema 2-kupig betongpanna — full accessory system
// Based on Benders Monteringsanvisning BETONG 1&2-kupig 2023
// ══════════════════════════════════════════════════════════════

// ── Tile dimensions (product: 330 × 420 mm) ──
const TILE_TOTAL_W = 0.33;
const TILE_TOTAL_L = 0.42; // full tile length incl head lap
const TILE_COVER_W = 0.3; // täckbredd (fals 300 mm)
const TILE_COVER_L = 0.34; // läktavstånd default (min 310 max 375)
const LAKT_MIN = 0.31; // min läktavstånd
const LAKT_MAX = 0.375; // max läktavstånd
const TILE_PROFILE_H = 0.03; // kupor peak above base slab
const TILE_THICKNESS = 0.012; // flat base slab

// ── Bärläkt 25 × 48 mm (manual: "25 x 48 mm (±2 mm)") ──
const LAKT_H = 0.025;
const LAKT_W = 0.048;

// ── Ströläkt 25 × 48 mm, max cc 600 mm ──
const STROLAKT_H = 0.025;
const STROLAKT_W = 0.048;

// ── Takfotsläkt is 20 mm higher than regular bärläkt ──
const FOTLAKT_EXTRA_H = 0.02;

// ── Nockbräda 45 × 45 mm ──
const NOCKBRADA_SIZE = 0.045;

// ── Nockpanna (ridge tile) — half-round, cover length 300mm ──
const NOCK_HALF_W = 0.165;
const NOCK_H = 0.06;
const NOCK_COVER_L = 0.3;

// ── Drip overhang: tile overhangs ~50 mm past the eave edge ──
const DRIP_OVERHANG = 0.05;
// ── Nockbräda clearance: ~30mm from ridge peak ──
const NOCK_CLEARANCE = 0.03;

interface RoofTilesProps {
  config: HouseConfig;
  showTiles: boolean;
  showDimensions: boolean;
}

// ────────────────────────────────────────────────────────────
// Tile profile (XY cross-section, extruded along Z = length)
// ────────────────────────────────────────────────────────────
function createTileShape(): THREE.Shape {
  const s = new THREE.Shape();
  const w = TILE_TOTAL_W;
  const t = TILE_THICKNESS;
  const h = TILE_PROFILE_H;

  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w, t);
  s.lineTo(w * 0.82, t);
  s.quadraticCurveTo(w * 0.7, t + h, w * 0.58, t);
  s.lineTo(w * 0.42, t);
  s.quadraticCurveTo(w * 0.3, t + h, w * 0.18, t);
  s.lineTo(0, t);
  s.lineTo(0, 0);

  return s;
}

function createTileGeometry(): THREE.ExtrudeGeometry {
  // Extrude full tile length (420mm) — the 80mm head overlap
  // creates the visual layering where upper rows sit on lower rows
  return new THREE.ExtrudeGeometry(createTileShape(), {
    depth: TILE_TOTAL_L,
    bevelEnabled: false,
  });
}

// ── Ridge tile geometry: half cylinder ──
function createRidgeGeo(): THREE.BufferGeometry {
  const segs = 12;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let ring = 0; ring <= 1; ring++) {
    const z = ring * NOCK_COVER_L;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI;
      positions.push(Math.cos(a) * NOCK_HALF_W, Math.sin(a) * NOCK_H, z);
    }
  }
  const vpr = segs + 1;
  for (let i = 0; i < segs; i++) {
    indices.push(i, i + vpr, i + 1, i + 1, i + vpr, i + 1 + vpr);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// ── Layout computation ──────────────────────────────────────
interface TileLayout {
  tiles: { x: number; z: number; row: number }[];
  battens: { z: number; isFot: boolean }[];
  stroBattens: number[];
  numCols: number;
  numRows: number;
  laktAvstand: number; // actual computed spacing
}

function computeLayout(
  slopeWidth: number,
  slopeLength: number,
  roofOverhang: number,
  flipStro: boolean,
): TileLayout {
  const numCols = Math.max(1, Math.floor(slopeWidth / TILE_COVER_W));
  const totalW = numCols * TILE_COVER_W;
  const xOff = (slopeWidth - totalW) / 2;

  // Tile placement model:
  //   Each tile extends UPSLOPE (+Z) for TILE_TOTAL_L (420mm).
  //   Row r tile starts at: r * laktAvstand - DRIP_OVERHANG
  //   Overlap between rows: TILE_TOTAL_L - laktAvstand = 80mm at default
  //   Row 0 overhangs 50mm past eave (z < 0).
  //   Last tile head should reach slopeLength - NOCK_CLEARANCE.
  //
  // Solve for spacing:
  //   last tile head = (numRows-1) * lakt - DRIP + TILE_TOTAL_L = slopeLength - NOCK_CLEARANCE
  //   (numRows-1) * lakt = slopeLength - NOCK_CLEARANCE + DRIP - TILE_TOTAL_L

  const spanForGaps =
    slopeLength - NOCK_CLEARANCE + DRIP_OVERHANG - TILE_TOTAL_L;
  let numGaps = Math.max(1, Math.round(spanForGaps / TILE_COVER_L));
  let laktAvstand = spanForGaps / numGaps;

  // Clamp to Benders spec range (310–375mm)
  if (laktAvstand < LAKT_MIN) {
    numGaps = Math.max(1, Math.floor(spanForGaps / LAKT_MIN));
    laktAvstand = spanForGaps / numGaps;
  } else if (laktAvstand > LAKT_MAX) {
    numGaps = Math.ceil(spanForGaps / LAKT_MAX);
    laktAvstand = spanForGaps / numGaps;
  }

  const numRows = numGaps + 1;

  // Bärläkt: first at z=LAKT_W/2 (flush with eave edge), then every laktAvstand upslope
  // Plus a top batten 40mm from the ridge end of the slope
  const battens: { z: number; isFot: boolean }[] = [];
  for (let r = 0; r < numRows; r++) {
    battens.push({ z: LAKT_W / 2 + r * laktAvstand, isFot: r === 0 });
  }
  // Top batten (nockläkt) — 40mm from ridge
  const topBattenZ = slopeLength - 0.04;
  battens.push({ z: topBattenZ, isFot: false });

  // Ströläkt (vertical counter-battens, eave → ridge)
  // Aligned with roof trusses (1200mm cc) + midpoint between each pair (600mm cc)
  // Edge battens at slope edges (shorter span than 600mm)
  const TRUSS_CC = 1.2;
  const TRUSS_CHORD_W = 0.045;
  const trussInset = roofOverhang + TRUSS_CHORD_W / 2; // first truss in slope-local X
  const stroSet = new Set<number>();

  // Edge battens (flush with slope edges)
  stroSet.add(STROLAKT_W / 2);
  stroSet.add(slopeWidth - STROLAKT_W / 2);

  // Truss-aligned ströläkt + midpoints
  let tx = trussInset;
  const trussPositions: number[] = [];
  while (tx <= slopeWidth - trussInset + 0.01) {
    trussPositions.push(tx);
    tx += TRUSS_CC;
  }
  // Ensure last truss position at far wall
  const lastTruss = slopeWidth - trussInset;
  if (
    trussPositions.length === 0 ||
    lastTruss - trussPositions[trussPositions.length - 1] > 0.1
  ) {
    trussPositions.push(lastTruss);
  }

  for (let i = 0; i < trussPositions.length; i++) {
    stroSet.add(trussPositions[i]);
    if (i < trussPositions.length - 1) {
      // Midpoint between adjacent trusses
      stroSet.add((trussPositions[i] + trussPositions[i + 1]) / 2);
    }
  }

  // When flipStro is true (left slope), mirror positions so ströläkt
  // align with the same world-Z truss positions as the right slope
  const stroRaw = Array.from(stroSet).sort((a, b) => a - b);
  const stroBattens = flipStro
    ? stroRaw.map((x) => slopeWidth - x).sort((a, b) => a - b)
    : stroRaw;

  // Tiles: each tile extends UPSLOPE (+Z) from its start position.
  // z = row * laktAvstand - DRIP_OVERHANG  →  tile occupies [z, z + TILE_TOTAL_L]
  // Row 0: [-0.05, 0.37]  Row 1: [lakt-0.05, lakt+0.37]
  // Overlap = (r*lakt + 0.37) - ((r+1)*lakt - 0.05) = 0.42 - lakt ≈ 80mm ✓
  const tiles: { x: number; z: number; row: number }[] = [];
  for (let r = 0; r < numRows; r++) {
    const tz = r * laktAvstand - DRIP_OVERHANG;
    for (let c = 0; c < numCols; c++) {
      tiles.push({
        x: xOff + c * TILE_COVER_W,
        z: tz,
        row: r,
      });
    }
  }

  return { tiles, battens, stroBattens, numCols, numRows, laktAvstand };
}

// ── Quaternion from basis vectors ────────────────────────────
function quatFromBasis(
  localX: THREE.Vector3,
  localY: THREE.Vector3,
  localZ: THREE.Vector3,
): THREE.Quaternion {
  const m = new THREE.Matrix4();
  m.makeBasis(localX, localY, localZ);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// ── Dimension label style ──
const DIM_LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 600,
  color: "#22d3ee",
  background: "rgba(24,24,27,0.85)",
  padding: "1px 5px",
  borderRadius: "3px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
};

const DIM_COLOR = "#22d3ee";

function fmtMm(m: number): string {
  return `${Math.round(m * 1000)}`;
}

/** Renders cc dimension annotations for bärläkt and ströläkt on a slope */
function SlopeDimensions({
  battens,
  stroBattens,
}: {
  battens: { z: number; isFot: boolean }[];
  stroBattens: number[];
}) {
  const dimY = STROLAKT_H + LAKT_H + 0.08; // float above battens

  return (
    <group>
      {/* ── Bärläkt cc (along Z at x = -0.3 outside left edge) ── */}
      {battens.length >= 2 &&
        (() => {
          // Show first two cc gaps and the spacing label
          const dimX = -0.25;
          const elements: React.ReactNode[] = [];
          // Show up to 3 representative gaps
          const maxShow = Math.min(3, battens.length - 1);
          for (let i = 0; i < maxShow; i++) {
            const z0 = battens[i].z;
            const z1 = battens[i + 1].z;
            const cc = z1 - z0;
            const midZ = (z0 + z1) / 2;
            elements.push(
              <group key={`blakt-${i}`}>
                <Line
                  points={[
                    [dimX, dimY, z0],
                    [dimX, dimY, z1],
                  ]}
                  color={DIM_COLOR}
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                {/* Ticks */}
                <Line
                  points={[
                    [dimX - 0.06, dimY, z0],
                    [dimX + 0.06, dimY, z0],
                  ]}
                  color={DIM_COLOR}
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Line
                  points={[
                    [dimX - 0.06, dimY, z1],
                    [dimX + 0.06, dimY, z1],
                  ]}
                  color={DIM_COLOR}
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Html
                  position={[dimX, dimY, midZ]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <div style={DIM_LABEL}>{fmtMm(cc)}</div>
                </Html>
              </group>,
            );
          }
          return <>{elements}</>;
        })()}

      {/* ── Ströläkt cc (along X at z = -0.3 outside bottom edge) ── */}
      {stroBattens.length >= 2 &&
        (() => {
          const dimZ = -0.25;
          const elements: React.ReactNode[] = [];
          // Show up to 3 representative gaps
          const maxShow = Math.min(3, stroBattens.length - 1);
          for (let i = 0; i < maxShow; i++) {
            const x0 = stroBattens[i];
            const x1 = stroBattens[i + 1];
            const cc = x1 - x0;
            const midX = (x0 + x1) / 2;
            elements.push(
              <group key={`stro-${i}`}>
                <Line
                  points={[
                    [x0, dimY, dimZ],
                    [x1, dimY, dimZ],
                  ]}
                  color={DIM_COLOR}
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                {/* Ticks */}
                <Line
                  points={[
                    [x0, dimY, dimZ - 0.06],
                    [x0, dimY, dimZ + 0.06],
                  ]}
                  color={DIM_COLOR}
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Line
                  points={[
                    [x1, dimY, dimZ - 0.06],
                    [x1, dimY, dimZ + 0.06],
                  ]}
                  color={DIM_COLOR}
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Html
                  position={[midX, dimY, dimZ]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <div style={DIM_LABEL}>{fmtMm(cc)}</div>
                </Html>
              </group>,
            );
          }
          return <>{elements}</>;
        })()}
    </group>
  );
}

// ── Single slope with tiles, bärläkt, ströläkt ──────────────
function SlopeWithTiles({
  slopeWidth,
  slopeLength,
  roofOverhang,
  flipStro,
  position,
  quaternion,
  tileColor,
  showTiles,
  showDimensions,
}: {
  slopeWidth: number;
  slopeLength: number;
  roofOverhang: number;
  flipStro: boolean;
  position: [number, number, number];
  quaternion: THREE.Quaternion;
  tileColor: string;
  showTiles: boolean;
  showDimensions: boolean;
}) {
  const tileGeo = useMemo(() => createTileGeometry(), []);
  const layout = useMemo(
    () => computeLayout(slopeWidth, slopeLength, roofOverhang, flipStro),
    [slopeWidth, slopeLength, roofOverhang, flipStro],
  );

  const { tiles, battens, stroBattens } = layout;
  const tileRef = useRef<THREE.InstancedMesh>(null);
  const battenRef = useRef<THREE.InstancedMesh>(null);
  const stroRef = useRef<THREE.InstancedMesh>(null);

  const tileYBase = STROLAKT_H + LAKT_H;

  // Hook position in tile-local Z (distance from drip edge to batten centre)
  const hookLocalZ = DRIP_OVERHANG + LAKT_W / 2;

  // Tile tilt — drip edge rises, head end dips (saw-tooth profile)
  // ~3 ° gives a clearly visible overlap step without being excessive
  const TILT = 3 * (Math.PI / 180);

  // ── Tile matrices ──
  // Each tile pivots around its batten hook point so the drip edge
  // tilts upward — just like real tiles resting on the row below.
  // Row 0 uses the thicker takfotsläkt (+20 mm) for the same effect.
  useEffect(() => {
    if (!tileRef.current || tiles.length === 0) return;

    const geoOff = new THREE.Matrix4().makeTranslation(0, 0, -hookLocalZ);
    const rot = new THREE.Matrix4().makeRotationX(TILT);
    const pos = new THREE.Matrix4();
    const m = new THREE.Matrix4();

    tiles.forEach((t, i) => {
      // Y at the batten hook point
      const y =
        t.row === 0
          ? tileYBase + FOTLAKT_EXTRA_H // takfotsläkt is 20 mm taller
          : tileYBase + t.row * 0.002; // 2 mm per row overlap stacking

      // Hook world-position in slope-local coords
      const hookZ = t.z + hookLocalZ;

      pos.makeTranslation(t.x, y, hookZ);
      m.copy(pos).multiply(rot).multiply(geoOff);
      tileRef.current!.setMatrixAt(i, m);
    });
    tileRef.current.instanceMatrix.needsUpdate = true;
  }, [tiles, tileYBase, showTiles, TILT, hookLocalZ]);

  // ── Bärläkt matrices ──
  useEffect(() => {
    if (!battenRef.current || battens.length === 0) return;
    const o = new THREE.Object3D();
    battens.forEach((b, i) => {
      const h = b.isFot ? LAKT_H + FOTLAKT_EXTRA_H : LAKT_H;
      o.position.set(slopeWidth / 2, STROLAKT_H + h / 2, b.z);
      o.scale.set(1, b.isFot ? (LAKT_H + FOTLAKT_EXTRA_H) / LAKT_H : 1, 1);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      battenRef.current!.setMatrixAt(i, o.matrix);
    });
    battenRef.current.instanceMatrix.needsUpdate = true;
  }, [battens, slopeWidth]);

  // ── Ströläkt matrices ──
  useEffect(() => {
    if (!stroRef.current || stroBattens.length === 0) return;
    const o = new THREE.Object3D();
    stroBattens.forEach((sx, i) => {
      o.position.set(sx, STROLAKT_H / 2, slopeLength / 2);
      o.scale.set(1, 1, 1);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      stroRef.current!.setMatrixAt(i, o.matrix);
    });
    stroRef.current.instanceMatrix.needsUpdate = true;
  }, [stroBattens, slopeLength]);

  return (
    <group position={position} quaternion={quaternion}>
      {/* Ströläkt (counter-battens, runs eave→ridge, under bärläkt) */}
      {stroBattens.length > 0 && (
        <instancedMesh
          ref={stroRef}
          args={[undefined, undefined, stroBattens.length]}
          frustumCulled={false}
        >
          <boxGeometry args={[STROLAKT_W, STROLAKT_H, slopeLength]} />
          <meshStandardMaterial color="#b89860" roughness={0.9} />
        </instancedMesh>
      )}

      {/* Bärläkt (horizontal battens, on top of ströläkt) */}
      {battens.length > 0 && (
        <instancedMesh
          ref={battenRef}
          args={[undefined, undefined, battens.length]}
          frustumCulled={false}
        >
          <boxGeometry args={[slopeWidth, LAKT_H, LAKT_W]} />
          <meshStandardMaterial color="#c4a46c" roughness={0.9} />
        </instancedMesh>
      )}

      {/* Tegelpannor (tiles) */}
      {showTiles && tiles.length > 0 && (
        <instancedMesh
          ref={tileRef}
          args={[tileGeo, undefined, tiles.length]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color={tileColor}
            roughness={0.8}
            metalness={0.05}
          />
        </instancedMesh>
      )}

      {/* ── CC Dimension annotations ── */}
      {showDimensions && (
        <SlopeDimensions battens={battens} stroBattens={stroBattens} />
      )}
    </group>
  );
}

// ── Ridge tiles (nockpannor) along the ridge ────────────────
function RidgeTiles({
  ridgeLength,
  position,
  tileColor,
}: {
  ridgeLength: number;
  position: [number, number, number];
  tileColor: string;
}) {
  const ridgeGeo = useMemo(() => createRidgeGeo(), []);
  const count = Math.max(1, Math.ceil(ridgeLength / NOCK_COVER_L));
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, -ridgeLength / 2 + i * NOCK_COVER_L);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count, ridgeLength]);

  return (
    <group position={position}>
      {/* Nockbräda (ridge board) */}
      <mesh>
        <boxGeometry args={[NOCKBRADA_SIZE, NOCKBRADA_SIZE, ridgeLength]} />
        <meshStandardMaterial color="#b89860" roughness={0.9} />
      </mesh>
      {/* Nockpannor (ridge tiles) */}
      <group position={[0, NOCKBRADA_SIZE / 2, 0]}>
        <instancedMesh
          ref={ref}
          args={[ridgeGeo, undefined, count]}
          frustumCulled={false}
        >
          <meshStandardMaterial
            color={tileColor}
            roughness={0.75}
            metalness={0.05}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      </group>
    </group>
  );
}

// ── Pultpanna (shed ridge edge) ─────────────────────────────
function PultRidgeTiles({
  ridgeLength,
  position,
  tileColor,
}: {
  ridgeLength: number;
  position: [number, number, number];
  tileColor: string;
}) {
  const count = Math.max(1, Math.ceil(ridgeLength / NOCK_COVER_L));
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    if (!ref.current) return;
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      o.position.set(0, 0, -ridgeLength / 2 + i * NOCK_COVER_L);
      o.rotation.set(0, 0, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, [count, ridgeLength]);

  return (
    <group position={position}>
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.12, 0.04, NOCK_COVER_L]} />
        <meshStandardMaterial
          color={tileColor}
          roughness={0.75}
          metalness={0.05}
        />
      </instancedMesh>
    </group>
  );
}

// ════════════════════════════════════════════════════════════
export function RoofTiles({
  config,
  showTiles,
  showDimensions,
}: RoofTilesProps) {
  const {
    width,
    depth,
    wallHeight,
    roofType,
    roofPitch,
    roofOverhang,
    roofColor,
  } = config;

  const pitchRad = (roofPitch * Math.PI) / 180;
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);
  const eaveDrop = roofOverhang * Math.tan(pitchRad);
  const ridgeHeight = (width / 2) * Math.tan(pitchRad);

  const hw = width / 2 + roofOverhang;
  const hd = depth / 2 + roofOverhang;
  const eaveY = wallHeight - eaveDrop;

  const slopeWidth = 2 * hd;
  const slopeLength = hw / cosP;

  // ── Slope quaternions ──
  const leftQ = useMemo(
    () =>
      quatFromBasis(
        new THREE.Vector3(0, 0, -1),
        new THREE.Vector3(-sinP, cosP, 0),
        new THREE.Vector3(cosP, sinP, 0),
      ),
    [sinP, cosP],
  );

  const rightQ = useMemo(
    () =>
      quatFromBasis(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(sinP, cosP, 0),
        new THREE.Vector3(-cosP, sinP, 0),
      ),
    [sinP, cosP],
  );

  if (roofType === "flat") return null;

  // ── Gable roof ──
  if (roofType === "gable") {
    const ridgeY = wallHeight + ridgeHeight;
    const ridgeLen = depth + 2 * roofOverhang;

    return (
      <group>
        <SlopeWithTiles
          slopeWidth={slopeWidth}
          slopeLength={slopeLength}
          roofOverhang={roofOverhang}
          flipStro={true}
          position={[-hw, eaveY, hd]}
          quaternion={leftQ}
          tileColor={roofColor}
          showTiles={showTiles}
          showDimensions={showDimensions}
        />
        <SlopeWithTiles
          slopeWidth={slopeWidth}
          slopeLength={slopeLength}
          roofOverhang={roofOverhang}
          flipStro={false}
          position={[hw, eaveY, -hd]}
          quaternion={rightQ}
          tileColor={roofColor}
          showTiles={showTiles}
          showDimensions={showDimensions}
        />
        <RidgeTiles
          ridgeLength={ridgeLen}
          position={[0, ridgeY, 0]}
          tileColor={roofColor}
        />
      </group>
    );
  }

  // ── Hip roof ──
  if (roofType === "hip") {
    const ridgeHalfLen = Math.max(0, hd - hw);
    const ridgeLen = ridgeHalfLen * 2;
    const ridgeY = wallHeight + ridgeHeight;

    return (
      <group>
        <SlopeWithTiles
          slopeWidth={slopeWidth}
          slopeLength={slopeLength}
          roofOverhang={roofOverhang}
          flipStro={true}
          position={[-hw, eaveY, hd]}
          quaternion={leftQ}
          tileColor={roofColor}
          showTiles={showTiles}
          showDimensions={showDimensions}
        />
        <SlopeWithTiles
          slopeWidth={slopeWidth}
          slopeLength={slopeLength}
          roofOverhang={roofOverhang}
          flipStro={false}
          position={[hw, eaveY, -hd]}
          quaternion={rightQ}
          tileColor={roofColor}
          showTiles={showTiles}
          showDimensions={showDimensions}
        />
        {ridgeLen > 0.1 && (
          <RidgeTiles
            ridgeLength={ridgeLen}
            position={[0, ridgeY, 0]}
            tileColor={roofColor}
          />
        )}
      </group>
    );
  }

  // ── Shed (pulpet) roof ──
  if (roofType === "shed") {
    const shedLen = (width + 2 * roofOverhang) / cosP;
    const lowY = wallHeight - eaveDrop;
    const highY = wallHeight + width * Math.tan(pitchRad);
    const ridgeLen = depth + 2 * roofOverhang;

    return (
      <group>
        <SlopeWithTiles
          slopeWidth={slopeWidth}
          slopeLength={shedLen}
          roofOverhang={roofOverhang}
          flipStro={false}
          position={[hw, lowY, -hd]}
          quaternion={rightQ}
          tileColor={roofColor}
          showTiles={showTiles}
          showDimensions={showDimensions}
        />
        <PultRidgeTiles
          ridgeLength={ridgeLen}
          position={[-hw - roofOverhang, highY, 0]}
          tileColor={roofColor}
        />
      </group>
    );
  }

  return null;
}
