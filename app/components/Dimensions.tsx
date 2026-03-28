"use client";

import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { HouseConfig } from "../lib/types";

const OFFSET = 0.8; // distance from building for dimension lines
const TICK = 0.15; // length of end ticks
const LABEL_STYLE: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#fbbf24",
  background: "rgba(24,24,27,0.85)",
  padding: "2px 6px",
  borderRadius: "4px",
  whiteSpace: "nowrap",
  pointerEvents: "none",
  userSelect: "none",
};

function fmt(m: number): string {
  if (m >= 1) return `${(m * 1000).toFixed(0)} mm`;
  return `${(m * 1000).toFixed(0)} mm`;
}

function fmtDeg(deg: number): string {
  return `${deg}°`;
}

/** A single dimension line with two ticks and a centered label */
function DimLine({
  start,
  end,
  label,
  tickDir,
}: {
  start: THREE.Vector3Tuple;
  end: THREE.Vector3Tuple;
  label: string;
  tickDir: THREE.Vector3Tuple;
}) {
  const mid: THREE.Vector3Tuple = [
    (start[0] + end[0]) / 2,
    (start[1] + end[1]) / 2,
    (start[2] + end[2]) / 2,
  ];

  const t1a: THREE.Vector3Tuple = [
    start[0] - tickDir[0] * TICK,
    start[1] - tickDir[1] * TICK,
    start[2] - tickDir[2] * TICK,
  ];
  const t1b: THREE.Vector3Tuple = [
    start[0] + tickDir[0] * TICK,
    start[1] + tickDir[1] * TICK,
    start[2] + tickDir[2] * TICK,
  ];
  const t2a: THREE.Vector3Tuple = [
    end[0] - tickDir[0] * TICK,
    end[1] - tickDir[1] * TICK,
    end[2] - tickDir[2] * TICK,
  ];
  const t2b: THREE.Vector3Tuple = [
    end[0] + tickDir[0] * TICK,
    end[1] + tickDir[1] * TICK,
    end[2] + tickDir[2] * TICK,
  ];

  return (
    <group>
      {/* Main line */}
      <Line
        points={[start, end]}
        color="#fbbf24"
        lineWidth={1.5}
        depthTest={false}
        renderOrder={999}
      />
      {/* Start tick */}
      <Line
        points={[t1a, t1b]}
        color="#fbbf24"
        lineWidth={1.5}
        depthTest={false}
        renderOrder={999}
      />
      {/* End tick */}
      <Line
        points={[t2a, t2b]}
        color="#fbbf24"
        lineWidth={1.5}
        depthTest={false}
        renderOrder={999}
      />
      {/* Label */}
      <Html position={mid} center style={{ pointerEvents: "none" }}>
        <div style={LABEL_STYLE}>{label}</div>
      </Html>
    </group>
  );
}

export function Dimensions({ config }: { config: HouseConfig }) {
  const { width, depth, wallHeight, roofType, roofPitch, roofOverhang } =
    config;

  const pitchRad = (roofPitch * Math.PI) / 180;
  const ridgeHeight =
    roofType !== "flat" ? (width / 2) * Math.tan(pitchRad) : 0;
  const totalHeight = wallHeight + ridgeHeight;

  const hw = width / 2;
  const hd = depth / 2;
  const oh = roofOverhang;

  // Extension lines (dashed) connecting building to dimension lines
  const extColor = "#fbf24880";

  return (
    <group>
      {/* ── Width (along X, front face) ── */}
      <DimLine
        start={[-hw, 0, hd + OFFSET]}
        end={[hw, 0, hd + OFFSET]}
        label={fmt(width)}
        tickDir={[0, 0, 1]}
      />
      {/* Extension lines */}
      <Line
        points={[
          [-hw, 0, hd],
          [-hw, 0, hd + OFFSET + TICK],
        ]}
        color={extColor}
        lineWidth={1}
        depthTest={false}
        renderOrder={998}
      />
      <Line
        points={[
          [hw, 0, hd],
          [hw, 0, hd + OFFSET + TICK],
        ]}
        color={extColor}
        lineWidth={1}
        depthTest={false}
        renderOrder={998}
      />

      {/* ── Depth (along Z, right face) ── */}
      <DimLine
        start={[hw + OFFSET, 0, hd]}
        end={[hw + OFFSET, 0, -hd]}
        label={fmt(depth)}
        tickDir={[1, 0, 0]}
      />
      <Line
        points={[
          [hw, 0, hd],
          [hw + OFFSET + TICK, 0, hd],
        ]}
        color={extColor}
        lineWidth={1}
        depthTest={false}
        renderOrder={998}
      />
      <Line
        points={[
          [hw, 0, -hd],
          [hw + OFFSET + TICK, 0, -hd],
        ]}
        color={extColor}
        lineWidth={1}
        depthTest={false}
        renderOrder={998}
      />

      {/* ── Wall height (along Y, front-right corner) ── */}
      <DimLine
        start={[hw + OFFSET, 0, hd + OFFSET]}
        end={[hw + OFFSET, wallHeight, hd + OFFSET]}
        label={fmt(wallHeight)}
        tickDir={[1, 0, 1]}
      />
      <Line
        points={[
          [hw, 0, hd],
          [hw + OFFSET + TICK, 0, hd + OFFSET + TICK],
        ]}
        color={extColor}
        lineWidth={1}
        depthTest={false}
        renderOrder={998}
      />
      <Line
        points={[
          [hw, wallHeight, hd],
          [hw + OFFSET + TICK, wallHeight, hd + OFFSET + TICK],
        ]}
        color={extColor}
        lineWidth={1}
        depthTest={false}
        renderOrder={998}
      />

      {/* ── Total height (wall + ridge) ── */}
      {roofType !== "flat" && (
        <>
          <DimLine
            start={[-hw - OFFSET, 0, hd + OFFSET]}
            end={[-hw - OFFSET, totalHeight, hd + OFFSET]}
            label={fmt(totalHeight)}
            tickDir={[-1, 0, 1]}
          />
          <Line
            points={[
              [-hw, 0, hd],
              [-hw - OFFSET - TICK, 0, hd + OFFSET + TICK],
            ]}
            color={extColor}
            lineWidth={1}
            depthTest={false}
            renderOrder={998}
          />
        </>
      )}

      {/* ── Ridge height (from wall top to ridge) ── */}
      {roofType !== "flat" && ridgeHeight > 0.01 && (
        <DimLine
          start={[-hw - OFFSET * 1.8, wallHeight, hd + OFFSET]}
          end={[-hw - OFFSET * 1.8, totalHeight, hd + OFFSET]}
          label={fmt(ridgeHeight)}
          tickDir={[-1, 0, 1]}
        />
      )}

      {/* ── Roof overhang ── */}
      {oh > 0 && (
        <DimLine
          start={[hw, wallHeight - 0.3, hd]}
          end={[hw, wallHeight - 0.3, hd + oh]}
          label={fmt(oh)}
          tickDir={[0, 1, 0]}
        />
      )}

      {/* ── Roof pitch label ── */}
      {roofType !== "flat" && (
        <Html
          position={[0, totalHeight + 0.4, hd + OFFSET]}
          center
          style={{ pointerEvents: "none" }}
        >
          <div style={LABEL_STYLE}>Takvinkel {fmtDeg(roofPitch)}</div>
        </Html>
      )}
    </group>
  );
}

// ════════════════════════════════════════════════════════════
// Framing dimensions — stud cc (600mm) along front wall,
// truss cc (1200mm) along the depth
// ════════════════════════════════════════════════════════════

const STUD_CC = 0.6;
const STUD_WIDTH = 0.045;
const TRUSS_CC = 1.2;
const TRUSS_CHORD_W = 0.045;

const CC_LABEL: React.CSSProperties = {
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

function fmtCc(m: number): string {
  return `${Math.round(m * 1000)} cc`;
}

export function FramingDimensions({ config }: { config: HouseConfig }) {
  const { width, depth, wallHeight } = config;

  const hw = width / 2;
  const hd = depth / 2;
  const dimY = -0.15; // just below floor (for studs)
  const trussDimY = wallHeight; // at truss height

  // ── Stud positions along front wall (Z = +hd) ──
  const studPositions: number[] = [];
  studPositions.push(-hw + STUD_WIDTH / 2);
  let sx = -hw + STUD_CC;
  while (sx < hw - STUD_WIDTH / 2 - 0.01) {
    studPositions.push(sx);
    sx += STUD_CC;
  }
  studPositions.push(hw - STUD_WIDTH / 2);

  // ── Truss positions along depth ──
  const trussInset = TRUSS_CHORD_W / 2;
  const trussPositions: number[] = [];
  let tz = -hd + trussInset;
  while (tz <= hd - trussInset + 0.01) {
    trussPositions.push(tz);
    tz += TRUSS_CC;
  }
  const lastTrussTarget = hd - trussInset;
  if (
    trussPositions.length === 0 ||
    lastTrussTarget - trussPositions[trussPositions.length - 1] > 0.1
  ) {
    trussPositions.push(lastTrussTarget);
  }

  const ccTick = 0.08;

  return (
    <group>
      {/* ── Stud cc (along front wall X-axis, at Z = hd + offset) ── */}
      {studPositions.length >= 2 &&
        (() => {
          const dimZ = hd + 0.5;
          const maxShow = Math.min(4, studPositions.length - 1);
          const elements: React.ReactNode[] = [];
          for (let i = 0; i < studPositions.length - 1; i++) {
            const x0 = studPositions[i];
            const x1 = studPositions[i + 1];
            const cc = x1 - x0;
            const midX = (x0 + x1) / 2;
            elements.push(
              <group key={`stud-cc-${i}`}>
                <Line
                  points={[
                    [x0, dimY, dimZ],
                    [x1, dimY, dimZ],
                  ]}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Line
                  points={[
                    [x0, dimY, dimZ - ccTick],
                    [x0, dimY, dimZ + ccTick],
                  ]}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Line
                  points={[
                    [x1, dimY, dimZ - ccTick],
                    [x1, dimY, dimZ + ccTick],
                  ]}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Html
                  position={[midX, dimY, dimZ]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <div style={CC_LABEL}>Regelstomme {fmtCc(cc)}</div>
                </Html>
              </group>,
            );
          }
          // Label for remaining studs
          if (studPositions.length - 1 > maxShow) {
            elements.push(
              <Html
                key="stud-more"
                position={[studPositions[maxShow], dimY, dimZ + 0.25]}
                center
                style={{ pointerEvents: "none" }}
              >
                <div style={CC_LABEL}>
                  …+{studPositions.length - 1 - maxShow} st
                </div>
              </Html>,
            );
          }
          return <>{elements}</>;
        })()}

      {/* ── Truss cc (along depth Z-axis, at X = hw + offset) ── */}
      {trussPositions.length >= 2 &&
        (() => {
          const dimX = hw + 0.5;
          const maxShow = Math.min(3, trussPositions.length - 1);
          const elements: React.ReactNode[] = [];
          for (let i = 0; i < trussPositions.length - 1; i++) {
            const z0 = trussPositions[i];
            const z1 = trussPositions[i + 1];
            const cc = z1 - z0;
            const midZ = (z0 + z1) / 2;
            elements.push(
              <group key={`truss-cc-${i}`}>
                <Line
                  points={[
                    [dimX, trussDimY, z0],
                    [dimX, trussDimY, z1],
                  ]}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Line
                  points={[
                    [dimX - ccTick, trussDimY, z0],
                    [dimX + ccTick, trussDimY, z0],
                  ]}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Line
                  points={[
                    [dimX - ccTick, trussDimY, z1],
                    [dimX + ccTick, trussDimY, z1],
                  ]}
                  color="#22d3ee"
                  lineWidth={1.5}
                  depthTest={false}
                  renderOrder={999}
                />
                <Html
                  position={[dimX, trussDimY, midZ]}
                  center
                  style={{ pointerEvents: "none" }}
                >
                  <div style={CC_LABEL}>Takstol {fmtCc(cc)}</div>
                </Html>
              </group>,
            );
          }
          if (trussPositions.length - 1 > maxShow) {
            elements.push(
              <Html
                key="truss-more"
                position={[dimX + 0.25, trussDimY, trussPositions[maxShow]]}
                center
                style={{ pointerEvents: "none" }}
              >
                <div style={CC_LABEL}>
                  …+{trussPositions.length - 1 - maxShow} st
                </div>
              </Html>,
            );
          }
          return <>{elements}</>;
        })()}

      {/* ── Wall height label ── */}
      <Html
        position={[hw + 0.5, wallHeight / 2, hd + 0.5]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div style={CC_LABEL}>Vägg {fmt(wallHeight)}</div>
      </Html>
    </group>
  );
}
