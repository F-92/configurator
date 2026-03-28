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
): TrussProfile {
  const pitchRad = (pitch * Math.PI) / 180;
  const halfSpan = span / 2;
  const ridgeHeight = halfSpan * Math.tan(pitchRad);
  const members: TrussProfile["members"] = [];

  // Bottom chord (horizontal)
  members.push({
    start: [-halfSpan, wallHeight],
    end: [halfSpan, wallHeight],
    thickness: CHORD_H,
  });

  // Left rafter (top chord)
  members.push({
    start: [-halfSpan, wallHeight],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });

  // Right rafter (top chord)
  members.push({
    start: [halfSpan, wallHeight],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });

  // King post (vertical center)
  if (ridgeHeight > 0.5) {
    members.push({
      start: [0, wallHeight],
      end: [0, wallHeight + ridgeHeight],
      thickness: WEB_H,
    });
  }

  // Web members (diagonals) for wider spans
  if (span > 6) {
    const quarterSpan = halfSpan / 2;
    const quarterHeight = quarterSpan * Math.tan(pitchRad);

    // Left diagonal web
    members.push({
      start: [-quarterSpan, wallHeight],
      end: [-quarterSpan, wallHeight + quarterHeight],
      thickness: WEB_H,
    });

    // Right diagonal web
    members.push({
      start: [quarterSpan, wallHeight],
      end: [quarterSpan, wallHeight + quarterHeight],
      thickness: WEB_H,
    });

    // Left diagonal brace
    members.push({
      start: [-quarterSpan, wallHeight],
      end: [0, wallHeight + ridgeHeight * 0.6],
      thickness: WEB_H,
    });

    // Right diagonal brace
    members.push({
      start: [quarterSpan, wallHeight],
      end: [0, wallHeight + ridgeHeight * 0.6],
      thickness: WEB_H,
    });
  }

  // Extra webs for very wide spans
  if (span > 10) {
    const thirdSpan = (halfSpan * 2) / 3;
    const thirdHeight = thirdSpan * Math.tan(pitchRad) * 0.5;

    members.push({
      start: [-thirdSpan, wallHeight],
      end: [-halfSpan / 3, wallHeight + ridgeHeight * 0.4],
      thickness: WEB_H,
    });

    members.push({
      start: [thirdSpan, wallHeight],
      end: [halfSpan / 3, wallHeight + ridgeHeight * 0.4],
      thickness: WEB_H,
    });
  }

  return { members };
}

function generateHipTrussAtPosition(
  span: number,
  depth: number,
  pitch: number,
  wallHeight: number,
  zPos: number,
): TrussProfile {
  const pitchRad = (pitch * Math.PI) / 180;
  const halfSpan = span / 2;
  const fullRidgeHeight = halfSpan * Math.tan(pitchRad);
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

  // Rafters
  members.push({
    start: [-halfSpan, wallHeight],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });
  members.push({
    start: [halfSpan, wallHeight],
    end: [0, wallHeight + ridgeHeight],
    thickness: CHORD_H,
  });

  // King post
  if (ridgeHeight > 0.3) {
    members.push({
      start: [0, wallHeight],
      end: [0, wallHeight + ridgeHeight],
      thickness: WEB_H,
    });
  }

  // Webs for wider spans
  if (span > 6 && ridgeHeight > 0.5) {
    const qSpan = halfSpan / 2;
    const qHeight = ridgeHeight / 2;

    members.push({
      start: [-qSpan, wallHeight],
      end: [0, wallHeight + qHeight],
      thickness: WEB_H,
    });
    members.push({
      start: [qSpan, wallHeight],
      end: [0, wallHeight + qHeight],
      thickness: WEB_H,
    });
  }

  return { members };
}

function generateShedTruss(
  span: number,
  pitch: number,
  wallHeight: number,
): TrussProfile {
  const pitchRad = (pitch * Math.PI) / 180;
  const rise = span * Math.tan(pitchRad);
  const halfSpan = span / 2;
  const members: TrussProfile["members"] = [];

  // Bottom chord
  members.push({
    start: [-halfSpan, wallHeight],
    end: [halfSpan, wallHeight],
    thickness: CHORD_H,
  });

  // Single rafter (top chord)
  members.push({
    start: [-halfSpan, wallHeight + rise],
    end: [halfSpan, wallHeight],
    thickness: CHORD_H,
  });

  // Vertical at high side
  members.push({
    start: [-halfSpan, wallHeight],
    end: [-halfSpan, wallHeight + rise],
    thickness: WEB_H,
  });

  // Intermediate verticals
  if (span > 5) {
    const numIntermediates = Math.floor(span / 2.5);
    for (let i = 1; i <= numIntermediates; i++) {
      const t = i / (numIntermediates + 1);
      const x = -halfSpan + t * span;
      const h = rise * (1 - t);
      if (h > 0.15) {
        members.push({
          start: [x, wallHeight],
          end: [x, wallHeight + h],
          thickness: WEB_H,
        });
      }
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
  const { width, depth, wallHeight, roofType, roofPitch } = config;

  const trusses = useMemo(() => {
    if (roofType === "flat") return [];

    const trussPositions: number[] = [];
    const halfDepth = depth / 2;
    let z = -halfDepth;
    while (z <= halfDepth + 0.01) {
      trussPositions.push(z);
      z += TRUSS_SPACING;
    }
    // Ensure end trusses
    if (trussPositions[trussPositions.length - 1] < halfDepth - 0.1) {
      trussPositions.push(halfDepth);
    }

    return trussPositions.map((zPos) => {
      let profile: TrussProfile;
      // Trusses sit on top of the wall framing top plate
      const trussBaseY = wallHeight + CHORD_H / 2;

      switch (roofType) {
        case "gable":
          profile = generateGableTruss(width, roofPitch, trussBaseY);
          break;
        case "hip":
          profile = generateHipTrussAtPosition(
            width,
            depth,
            roofPitch,
            trussBaseY,
            zPos,
          );
          break;
        case "shed":
          profile = generateShedTruss(width, roofPitch, trussBaseY);
          break;
        default:
          profile = { members: [] };
      }

      return { zPos, profile };
    });
  }, [width, depth, wallHeight, roofType, roofPitch]);

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
                color="#e8c88a"
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
            color="#e8c88a"
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
            color="#e8c88a"
            roughness={0.85}
          />
        </mesh>
      ))}
    </group>
  );
}
