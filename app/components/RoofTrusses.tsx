"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { HouseConfig, RoofType } from "../lib/types";
import { getPineTexture } from "../lib/woodTexture";

// Timber dimensions for trusses
const CHORD_W = 0.045; // 45mm
const CHORD_H = 0.195; // 195mm (larger for trusses)
const WEB_W = 0.045;
const WEB_H = 0.095; // 95mm for web members
const TRUSS_SPACING = 1.2; // 1200mm on center (typical Swedish truss spacing)
const RAFTER_DEPTH = 0.145;

interface TrussProfile {
  members: {
    start: [number, number];
    end: [number, number];
    thickness: number;
  }[];
}

function generateGableTruss(
  span: number,
  pitch: number,
  wallHeight: number,
  overhang: number = 0,
): TrussProfile {
  const pitchRad = (pitch * Math.PI) / 180;
  const halfSpan = span / 2;
  const ridgeHeight = halfSpan * Math.tan(pitchRad);
  const eaveDrop = overhang * Math.tan(pitchRad);
  const eaveX = halfSpan + overhang;
  const eaveY = wallHeight - eaveDrop;
  const members: TrussProfile["members"] = [];

  // Bottom chord (horizontal - wall to wall)
  members.push({
    start: [-halfSpan, wallHeight],
    end: [halfSpan, wallHeight],
    thickness: CHORD_H,
  });

  // Left rafter (top chord) - extends to overhang
  members.push({
    start: [-eaveX, eaveY],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });

  // Right rafter (top chord) - extends to overhang
  members.push({
    start: [eaveX, eaveY],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });

  if (ridgeHeight < 0.3) return { members };

  // Determine truss type based on span
  const numPanels = span <= 6 ? 1 : span <= 10 ? 2 : 3;

  // King post (center vertical)
  members.push({
    start: [0, wallHeight],
    end: [0, wallHeight + ridgeHeight],
    thickness: WEB_H,
  });

  for (const side of [-1, 1]) {
    if (numPanels === 1) {
      // Kungstolstakstol - king post with diagonal struts (strävor)
      // Struts from king post at ~40% height out to rafters at ~55%
      if (ridgeHeight > 0.5) {
        const strutBaseY = wallHeight + ridgeHeight * 0.35;
        const rFrac = 0.55;
        const rX = side * halfSpan * (1 - rFrac);
        const rY = wallHeight + ridgeHeight * rFrac;
        members.push({
          start: [0, strutBaseY],
          end: [rX, rY],
          thickness: WEB_H,
        });
      }
    } else {
      // Fackverkstakstol (W-truss / Fink pattern)
      // Verticals at each interior panel point +
      // Diagonals from each rafter panel point inward-down to next bc panel point
      for (let i = 1; i < numPanels; i++) {
        const frac = i / numPanels;
        const x = side * halfSpan * (1 - frac);
        const ry = wallHeight + ridgeHeight * frac;

        // Vertical strut at panel point
        members.push({
          start: [x, wallHeight],
          end: [x, ry],
          thickness: WEB_H,
        });

        // Diagonal from this rafter panel point down toward center
        const nextFrac = (i + 1) / numPanels;
        const nextBcX = side * halfSpan * (1 - nextFrac);
        members.push({
          start: [x, ry],
          end: [nextBcX, wallHeight],
          thickness: WEB_H,
        });
      }
    }
  }

  return { members };
}

function generateHipTrussAtPosition(
  span: number,
  depth: number,
  pitch: number,
  wallHeight: number,
  zPos: number,
  overhang: number = 0,
): TrussProfile {
  const pitchRad = (pitch * Math.PI) / 180;
  const halfSpan = span / 2;
  const fullRidgeHeight = halfSpan * Math.tan(pitchRad);
  const eaveDrop = overhang * Math.tan(pitchRad);
  const eaveX = halfSpan + overhang;
  const eaveY = wallHeight - eaveDrop;
  const halfDepth = depth / 2;

  // Hip trusses get shorter as they approach the ends
  const distFromCenter = Math.abs(zPos);
  const hipStart = halfDepth - halfSpan; // where hip starts reducing height
  let ridgeHeight = fullRidgeHeight;

  if (hipStart > 0 && distFromCenter > hipStart) {
    const ratio = 1 - (distFromCenter - hipStart) / halfSpan;
    ridgeHeight = fullRidgeHeight * Math.max(0, ratio);
  }

  if (ridgeHeight < 0.1) {
    return { members: [] };
  }

  const members: TrussProfile["members"] = [];

  // Bottom chord
  members.push({
    start: [-halfSpan, wallHeight],
    end: [halfSpan, wallHeight],
    thickness: CHORD_H,
  });

  // Rafters - extend to overhang
  members.push({
    start: [-eaveX, eaveY],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });
  members.push({
    start: [eaveX, eaveY],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });

  if (ridgeHeight < 0.3) return { members };

  // Choose panel count based on span and available ridge height
  const numPanels = ridgeHeight < 1.0 || span <= 6 ? 1 : span <= 10 ? 2 : 3;

  // King post
  members.push({
    start: [0, wallHeight],
    end: [0, wallHeight + ridgeHeight],
    thickness: WEB_H,
  });

  for (const side of [-1, 1]) {
    if (numPanels === 1) {
      // Simple struts (strävor) for small/reduced-height trusses
      if (ridgeHeight > 0.5) {
        const strutBaseY = wallHeight + ridgeHeight * 0.35;
        const rFrac = 0.55;
        const rX = side * halfSpan * (1 - rFrac);
        const rY = wallHeight + ridgeHeight * rFrac;
        members.push({
          start: [0, strutBaseY],
          end: [rX, rY],
          thickness: WEB_H,
        });
      }
    } else {
      // Fackverkstakstol W-pattern (same as gable)
      for (let i = 1; i < numPanels; i++) {
        const frac = i / numPanels;
        const x = side * halfSpan * (1 - frac);
        const ry = wallHeight + ridgeHeight * frac;

        members.push({
          start: [x, wallHeight],
          end: [x, ry],
          thickness: WEB_H,
        });

        const nextFrac = (i + 1) / numPanels;
        const nextBcX = side * halfSpan * (1 - nextFrac);
        members.push({
          start: [x, ry],
          end: [nextBcX, wallHeight],
          thickness: WEB_H,
        });
      }
    }
  }

  return { members };
}

function generateShedTruss(
  span: number,
  pitch: number,
  wallHeight: number,
  overhang: number = 0,
): TrussProfile {
  const pitchRad = (pitch * Math.PI) / 180;
  const rise = span * Math.tan(pitchRad);
  const eaveDrop = overhang * Math.tan(pitchRad);
  const halfSpan = span / 2;
  const eaveXHigh = halfSpan + overhang;
  const eaveXLow = halfSpan + overhang;
  const highY = wallHeight + rise + eaveDrop;
  const lowY = wallHeight - eaveDrop;
  const members: TrussProfile["members"] = [];

  // Bottom chord (wall to wall)
  members.push({
    start: [-halfSpan, wallHeight],
    end: [halfSpan, wallHeight],
    thickness: CHORD_H,
  });

  // Single rafter (top chord) - extends to overhang
  members.push({
    start: [-eaveXHigh, highY],
    end: [eaveXLow, lowY],
    thickness: CHORD_H,
  });

  // Panel count based on span
  const numPanels = Math.max(2, Math.ceil(span / 2.0));

  // Verticals at each panel point (wall line to rafter)
  for (let i = 0; i <= numPanels; i++) {
    const t = i / numPanels;
    const x = -halfSpan + t * span;
    const rY = wallHeight + rise * (1 - t);

    if (rY - wallHeight > 0.15) {
      members.push({
        start: [x, wallHeight],
        end: [x, rY],
        thickness: WEB_H,
      });
    }
  }

  // Diagonal braces between panel points
  // Each diagonal goes from top of a vertical down to bottom of the next
  for (let i = 0; i < numPanels; i++) {
    const t1 = i / numPanels;
    const t2 = (i + 1) / numPanels;
    const x1 = -halfSpan + t1 * span;
    const x2 = -halfSpan + t2 * span;
    const rY1 = wallHeight + rise * (1 - t1);

    // Only add diagonal if the vertical height is meaningful
    if (rY1 - wallHeight > 0.3) {
      members.push({
        start: [x1, rY1],
        end: [x2, wallHeight],
        thickness: WEB_H,
      });
    }
  }

  return { members };
}

function createMemberGeometry(
  start: [number, number],
  end: [number, number],
  thickness: number,
): { position: [number, number, number]; rotation: number; length: number } {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const cx = (start[0] + end[0]) / 2;
  const cy = (start[1] + end[1]) / 2;

  return {
    position: [cx, cy, 0],
    rotation: angle,
    length,
  };
}

interface RoofTrussesProps {
  config: HouseConfig;
}

export function RoofTrusses({ config }: RoofTrussesProps) {
  const { width, depth, wallHeight, roofType, roofPitch, roofOverhang } =
    config;

  const trusses = useMemo(() => {
    if (roofType === "flat") return [];

    const trussPositions: number[] = [];
    const halfDepth = depth / 2;
    const inset = CHORD_W / 2; // keep end trusses inside wall face
    let z = -halfDepth + inset;
    while (z <= halfDepth - inset + 0.01) {
      trussPositions.push(z);
      z += TRUSS_SPACING;
    }
    // Ensure end trusses
    if (trussPositions[trussPositions.length - 1] < halfDepth - inset - 0.1) {
      trussPositions.push(halfDepth - inset);
    }

    return trussPositions.map((zPos) => {
      let profile: TrussProfile;
      // Trusses sit on top of the wall framing top plate
      const trussBaseY = wallHeight + CHORD_H / 2;

      switch (roofType) {
        case "gable":
          profile = generateGableTruss(
            width,
            roofPitch,
            trussBaseY,
            roofOverhang,
          );
          break;
        case "hip":
          profile = generateHipTrussAtPosition(
            width,
            depth,
            roofPitch,
            trussBaseY,
            zPos,
            roofOverhang,
          );
          break;
        case "shed":
          profile = generateShedTruss(
            width,
            roofPitch,
            trussBaseY,
            roofOverhang,
          );
          break;
        default:
          profile = { members: [] };
      }

      return { zPos, profile };
    });
  }, [width, depth, wallHeight, roofType, roofPitch, roofOverhang]);

  const pineTexture = useMemo(() => getPineTexture(), []);

  return (
    <group>
      {trusses.map((truss, ti) =>
        truss.profile.members.map((member, mi) => {
          const { position, rotation, length } = createMemberGeometry(
            member.start,
            member.end,
            member.thickness,
          );

          return (
            <mesh
              key={`${ti}-${mi}`}
              position={[position[0], position[1], truss.zPos]}
              rotation={[0, 0, rotation]}
            >
              <boxGeometry args={[length, member.thickness, CHORD_W]} />
              <meshStandardMaterial
                map={pineTexture}
                color="#f5e6c8"
                roughness={0.85}
              />
            </mesh>
          );
        }),
      )}

      {/* Ridge beam for gable and hip roofs */}
      {(roofType === "gable" || roofType === "hip") && roofPitch > 0 && (
        <mesh
          position={[
            0,
            wallHeight +
              CHORD_H / 2 +
              (width / 2) * Math.tan((roofPitch * Math.PI) / 180),
            0,
          ]}
        >
          <boxGeometry args={[CHORD_W * 2, CHORD_H, depth]} />
          <meshStandardMaterial
            map={pineTexture}
            color="#f5e6c8"
            roughness={0.85}
          />
        </mesh>
      )}

      {/* Purlins (åsar) - horizontal members along rafters */}
      {roofType !== "flat" && <Purlins config={config} />}
    </group>
  );
}

function Purlins({ config }: { config: HouseConfig }) {
  const { width, depth, wallHeight, roofPitch, roofType } = config;

  const purlins = useMemo(() => {
    if (roofType === "flat") return [];

    const pitchRad = (roofPitch * Math.PI) / 180;
    const halfSpan = width / 2;
    const ridgeHeight = halfSpan * Math.tan(pitchRad);
    const baseY = wallHeight + CHORD_H / 2;
    const result: { x: number; y: number; z: number; len: number }[] = [];

    if (roofType === "gable" || roofType === "hip") {
      // Purlins at 1/3 and 2/3 up each rafter
      for (const side of [-1, 1]) {
        for (const fraction of [0.33, 0.66]) {
          const x = side * halfSpan * (1 - fraction);
          const y = baseY + ridgeHeight * fraction;
          result.push({ x, y, z: 0, len: depth });
        }
      }
    } else if (roofType === "shed") {
      const rise = width * Math.tan(pitchRad);
      for (const fraction of [0.33, 0.66]) {
        const x = -halfSpan + width * fraction;
        const y = baseY + rise * (1 - fraction);
        result.push({ x, y, z: 0, len: depth });
      }
    }

    return result;
  }, [width, depth, wallHeight, roofPitch, roofType]);

  const pineTexture = useMemo(() => getPineTexture(), []);

  return (
    <group>
      {purlins.map((purlin, i) => (
        <mesh key={i} position={[purlin.x, purlin.y, purlin.z]}>
          <boxGeometry args={[CHORD_W, WEB_H, purlin.len]} />
          <meshStandardMaterial
            map={pineTexture}
            color="#f5e6c8"
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}
