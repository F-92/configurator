"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { HouseConfig, WindowConfig, DoorConfig, WallName } from "../lib/types";
import { getPineTexture } from "../lib/woodTexture";
import { WallCut } from "./Walls";

// Swedish standard timber dimensions (meters)
export const STUD_WIDTH = 0.045; // 45mm
export const STUD_DEPTH = 0.145; // 145mm (common wall stud)
export const PLATE_HEIGHT = 0.045; // top/bottom plate thickness

export interface Opening {
  centerX: number; // position along wall in meters from left edge
  width: number;
  height: number;
  bottomY: number; // from floor
  isWallCut?: boolean; // full-height pass-through (no header/sill/trimmers)
}

export function getOpeningsForWall(
  wallName: "front" | "back" | "left" | "right",
  wallLength: number,
  config: HouseConfig,
  wallCuts: WallCut[] = [],
): Opening[] {
  const openings: Opening[] = [];

  for (const win of config.windows.filter((w) => w.wall === wallName)) {
    openings.push({
      centerX: win.positionX * wallLength,
      width: win.width,
      height: win.height,
      bottomY: win.positionY,
    });
  }

  for (const door of config.doors.filter((d) => d.wall === wallName)) {
    openings.push({
      centerX: door.positionX * wallLength,
      width: door.width,
      height: door.height,
      bottomY: 0,
    });
  }

  // Add extension connection cuts as openings (full pass-throughs)
  // Left/right stud walls have reversed local X relative to the Walls component
  // (WallStuds uses -π/2 for left, π/2 for right; Walls uses the opposite).
  // Map positionX from Walls coordinate space to WallStuds local space.
  for (const cut of wallCuts.filter((c) => c.wall === wallName)) {
    let centerX: number;
    if (wallName === "left" || wallName === "right") {
      const fullDepth = config.depth;
      centerX = fullDepth * (1 - cut.positionX) - STUD_DEPTH;
    } else {
      centerX = cut.positionX * wallLength;
    }
    openings.push({
      centerX,
      width: cut.width,
      height: Math.min(cut.height, config.wallHeight),
      bottomY: 0,
      isWallCut: true,
    });
  }

  return openings.sort((a, b) => a.centerX - b.centerX);
}

export function generateWallStuds(
  wallLength: number,
  wallHeight: number,
  openings: Opening[],
  verticalPlateHeight: number = 0,
) {
  const studs: {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
  }[] = [];

  const studSpacing = 0.6; // 600mm on center (Swedish standard c/c 600)
  // Studs are always full height between plates
  const plateTop = wallHeight - PLATE_HEIGHT;
  const fullStudHeight = plateTop - PLATE_HEIGHT;

  // Offset so outer face of framing aligns with wall plane (studs go inward)
  const zOff = -STUD_DEPTH / 2;

  // Notch dimensions: when stående hammarband is used, top of each stud
  // has a notch on the outer face (45mm deep × verticalPlateHeight tall)
  const notchDepth = VERTICAL_PLATE_THICKNESS; // 45mm
  const notchedStudDepth = STUD_DEPTH - notchDepth; // 100mm remaining
  // Notched portion sits behind the vertical plate: outer face at -notchDepth
  const notchedZOff = -notchDepth - notchedStudDepth / 2;

  // Helper to add a stud that may have a notch at the top
  function addStud(x: number, bottomY: number, height: number) {
    if (verticalPlateHeight > 0 && height > verticalPlateHeight) {
      // Lower portion: full depth
      const lowerH = height - verticalPlateHeight;
      studs.push({
        x,
        y: bottomY + lowerH / 2,
        z: zOff,
        w: STUD_WIDTH,
        h: lowerH,
        d: STUD_DEPTH,
      });
      // Upper portion: notched (reduced depth, shifted inward)
      studs.push({
        x,
        y: bottomY + lowerH + verticalPlateHeight / 2,
        z: notchedZOff,
        w: STUD_WIDTH,
        h: verticalPlateHeight,
        d: notchedStudDepth,
      });
    } else {
      // No notch or stud shorter than notch area — render at full depth
      studs.push({
        x,
        y: bottomY + height / 2,
        z: zOff,
        w: STUD_WIDTH,
        h: height,
        d: STUD_DEPTH,
      });
    }
  }

  // Collect wall-cut ranges so we can break plates around them
  const wallCuts = openings.filter((op) => op.isWallCut);
  const cutRanges = wallCuts.map((c) => ({
    left: c.centerX - c.width / 2,
    right: c.centerX + c.width / 2,
  }));

  // Helper: generate plate segments that skip over wall-cut regions
  function addPlateSegments(y: number) {
    if (cutRanges.length === 0) {
      studs.push({
        x: wallLength / 2,
        y,
        z: zOff,
        w: wallLength,
        h: PLATE_HEIGHT,
        d: STUD_DEPTH,
      });
      return;
    }
    // Sort cuts left-to-right
    const sorted = [...cutRanges].sort((a, b) => a.left - b.left);
    let cursor = 0;
    for (const range of sorted) {
      const segLen = range.left - cursor;
      if (segLen > 0.01) {
        studs.push({
          x: cursor + segLen / 2,
          y,
          z: zOff,
          w: segLen,
          h: PLATE_HEIGHT,
          d: STUD_DEPTH,
        });
      }
      cursor = range.right;
    }
    const tailLen = wallLength - cursor;
    if (tailLen > 0.01) {
      studs.push({
        x: cursor + tailLen / 2,
        y,
        z: zOff,
        w: tailLen,
        h: PLATE_HEIGHT,
        d: STUD_DEPTH,
      });
    }
  }

  // Bottom plate (syll) — broken at wall cuts
  addPlateSegments(PLATE_HEIGHT / 2);

  // Top plate (hammarband) — broken at wall cuts
  addPlateSegments(plateTop + PLATE_HEIGHT / 2);

  // Generate stud positions at c/c 600
  const studPositions: number[] = [];
  // End studs at each wall extremity
  studPositions.push(STUD_WIDTH / 2);
  studPositions.push(wallLength - STUD_WIDTH / 2);

  // Intermediate studs at 600mm centers
  let pos = studSpacing;
  while (pos < wallLength - STUD_WIDTH) {
    studPositions.push(pos);
    pos += studSpacing;
  }

  // For each stud position, check if it intersects an opening
  for (const sx of studPositions) {
    let blocked = false;
    for (const op of openings) {
      const opLeft = op.centerX - op.width / 2;
      const opRight = op.centerX + op.width / 2;
      if (sx > opLeft + STUD_WIDTH / 2 && sx < opRight - STUD_WIDTH / 2) {
        blocked = true;
        if (!op.isWallCut) {
          // Add cripple stud below window (if not a door)
          if (op.bottomY > PLATE_HEIGHT + 0.1) {
            const crippleH = op.bottomY - PLATE_HEIGHT;
            studs.push({
              x: sx,
              y: PLATE_HEIGHT + crippleH / 2,
              z: zOff,
              w: STUD_WIDTH,
              h: crippleH,
              d: STUD_DEPTH,
            });
          }
          // Add cripple stud above opening
          const topOfOpening = op.bottomY + op.height;
          if (topOfOpening < plateTop - 0.1) {
            const crippleH = plateTop - topOfOpening - PLATE_HEIGHT;
            if (crippleH > 0.05) {
              addStud(sx, topOfOpening + PLATE_HEIGHT, crippleH);
            }
          }
        }
        // Wall cuts: no cripple studs — fully open pass-through
        break;
      }
    }

    if (!blocked) {
      // Full-height stud (with notch at top if vertical plate is on)
      addStud(sx, PLATE_HEIGHT, fullStudHeight);
    }
  }

  // Add king studs and headers for each opening
  for (const op of openings) {
    const opLeft = op.centerX - op.width / 2;
    const opRight = op.centerX + op.width / 2;

    // King studs (full height, flanking the opening) — for all opening types
    for (const kx of [opLeft - STUD_WIDTH / 2, opRight + STUD_WIDTH / 2]) {
      if (kx > 0 && kx < wallLength) {
        addStud(kx, PLATE_HEIGHT, fullStudHeight);
      }
    }

    // Wall cuts get only king studs — no trimmers, headers, or sills
    if (op.isWallCut) continue;

    // Trimmer/jack studs (support header, height = top of opening)
    const trimmerH = op.bottomY + op.height;
    for (const tx of [opLeft + STUD_WIDTH / 2, opRight - STUD_WIDTH / 2]) {
      if (tx > 0 && tx < wallLength) {
        studs.push({
          x: tx,
          y: trimmerH / 2,
          z: zOff,
          w: STUD_WIDTH,
          h: trimmerH,
          d: STUD_DEPTH,
        });
      }
    }

    // Header (överliggare) above opening
    const headerY = op.bottomY + op.height;
    const headerWidth = op.width + STUD_WIDTH * 2;
    studs.push({
      x: op.centerX,
      y: headerY + PLATE_HEIGHT / 2,
      z: zOff,
      w: headerWidth,
      h: PLATE_HEIGHT,
      d: STUD_DEPTH,
    });

    // Sill plate under window (fönsterbänk/underkarm)
    if (op.bottomY > PLATE_HEIGHT + 0.05) {
      studs.push({
        x: op.centerX,
        y: op.bottomY - PLATE_HEIGHT / 2,
        z: zOff,
        w: op.width + STUD_WIDTH * 2,
        h: PLATE_HEIGHT,
        d: STUD_DEPTH,
      });
    }
  }

  return studs;
}

// Vertical top plate (stående hammarband) dimensions
export const VERTICAL_PLATE_THICKNESS = 0.045; // 45mm
export const VERTICAL_PLATE_HEIGHT = 0.195; // 195mm on edge

export function generateVerticalTopPlate(
  wallLength: number,
  wallHeight: number,
) {
  // Sits between studs and horizontal top plate, within wallHeight
  // Stack: syll | studs | stående hammarband | liggande hammarband (top plate)
  const topOfVerticalPlate = wallHeight - PLATE_HEIGHT;
  const bottomOfVerticalPlate = topOfVerticalPlate - VERTICAL_PLATE_HEIGHT;
  // Outer face flush with studs' outer face (z=0), plate extends inward
  const zOff = -VERTICAL_PLATE_THICKNESS / 2;
  return {
    x: wallLength / 2,
    y: bottomOfVerticalPlate + VERTICAL_PLATE_HEIGHT / 2,
    z: zOff,
    w: wallLength,
    h: VERTICAL_PLATE_HEIGHT,
    d: VERTICAL_PLATE_THICKNESS,
  };
}

interface WallStudsProps {
  config: HouseConfig;
  showVerticalTopPlate?: boolean;
  wallCuts?: WallCut[];
  skipWalls?: WallName[];
  /** Walls to hide from rendering without affecting butt wall length calculations */
  hideWalls?: WallName[];
}

export function WallStuds({
  config,
  showVerticalTopPlate = false,
  wallCuts = [],
  skipWalls = [],
  hideWalls = [],
}: WallStudsProps) {
  const { width, depth, wallHeight } = config;

  // California corner framing: front/back walls run full width (through walls),
  // left/right walls are shortened to fit between them (butt walls).
  // A flat backing stud at each corner provides interior nailing surface.
  const { walls, cornerBackers } = useMemo(() => {
    const skipBack = skipWalls.includes("back");
    const skipFront = skipWalls.includes("front");
    // When a through-wall is skipped (junction face), butt walls extend SD
    // past the body edge into the parent's wall thickness.
    // When present or hidden (merged), normal California corner shortening.
    const sideLength =
      depth -
      (skipFront ? -STUD_DEPTH : STUD_DEPTH) -
      (skipBack ? -STUD_DEPTH : STUD_DEPTH);
    const wallDefs: {
      wallName: "front" | "back" | "left" | "right";
      length: number;
      position: [number, number, number];
      rotationY: number;
    }[] = [
      {
        wallName: "front",
        length: width,
        position: [-width / 2, 0, depth / 2],
        rotationY: 0,
      },
      {
        wallName: "back",
        length: width,
        position: [width / 2, 0, -depth / 2],
        rotationY: Math.PI,
      },
      {
        wallName: "left",
        length: sideLength,
        position: [
          -width / 2,
          0,
          -depth / 2 + (skipBack ? -STUD_DEPTH : STUD_DEPTH),
        ],
        rotationY: -Math.PI / 2,
      },
      {
        wallName: "right",
        length: sideLength,
        position: [
          width / 2,
          0,
          depth / 2 - (skipFront ? -STUD_DEPTH : STUD_DEPTH),
        ],
        rotationY: Math.PI / 2,
      },
    ];

    const wallResults = wallDefs
      .filter(
        (wd) =>
          !skipWalls.includes(wd.wallName) && !hideWalls.includes(wd.wallName),
      )
      .map((wd) => {
        const openings = getOpeningsForWall(
          wd.wallName,
          wd.length,
          config,
          wallCuts,
        );
        const vpHeight = showVerticalTopPlate ? VERTICAL_PLATE_HEIGHT : 0;
        const studs = generateWallStuds(
          wd.length,
          wallHeight,
          openings,
          vpHeight,
        );
        const verticalPlate = showVerticalTopPlate
          ? generateVerticalTopPlate(wd.length, wallHeight)
          : null;
        return { ...wd, studs, verticalPlate };
      });

    // California corner backing studs — only where both adjacent walls exist
    const plateTop = wallHeight - PLATE_HEIGHT;
    const fullH = plateTop - PLATE_HEIGHT;
    const backerY = PLATE_HEIGHT + fullH / 2;
    const hw = width / 2;
    const hd = depth / 2;
    const backers: {
      x: number;
      y: number;
      z: number;
      h: number;
      size: [number, number, number];
    }[] = [];

    // Corner backer sits ON the through-wall (front/back), providing nailing
    // surface for the perpendicular butt-wall's drywall.
    // - Through wall must be visible (not skipped/hidden) since backer sits on it
    // - Butt wall must exist (not skipped) but CAN be hidden (a merged wall replaces it)
    const frontVisible =
      !skipWalls.includes("front") && !hideWalls.includes("front");
    const backVisible =
      !skipWalls.includes("back") && !hideWalls.includes("back");
    const leftExists = !skipWalls.includes("left");
    const rightExists = !skipWalls.includes("right");

    if (frontVisible && rightExists) {
      backers.push({
        x: hw - STUD_WIDTH - STUD_DEPTH / 2,
        y: backerY,
        z: hd - STUD_DEPTH + STUD_WIDTH / 2,
        h: fullH,
        size: [STUD_DEPTH, fullH, STUD_WIDTH],
      });
    }
    if (frontVisible && leftExists) {
      backers.push({
        x: -hw + STUD_WIDTH + STUD_DEPTH / 2,
        y: backerY,
        z: hd - STUD_DEPTH + STUD_WIDTH / 2,
        h: fullH,
        size: [STUD_DEPTH, fullH, STUD_WIDTH],
      });
    }
    if (backVisible && rightExists) {
      backers.push({
        x: hw - STUD_WIDTH - STUD_DEPTH / 2,
        y: backerY,
        z: -hd + STUD_DEPTH - STUD_WIDTH / 2,
        h: fullH,
        size: [STUD_DEPTH, fullH, STUD_WIDTH],
      });
    }
    if (backVisible && leftExists) {
      backers.push({
        x: -hw + STUD_WIDTH + STUD_DEPTH / 2,
        y: backerY,
        z: -hd + STUD_DEPTH - STUD_WIDTH / 2,
        h: fullH,
        size: [STUD_DEPTH, fullH, STUD_WIDTH],
      });
    }

    // When back is skipped (extension junction), butt walls extend SD into
    // the parent. Add backers at that end, rotated 90° (sits on butt wall).
    const backSkipped = skipWalls.includes("back");
    const leftVisible = leftExists && !hideWalls.includes("left");
    const rightVisible = rightExists && !hideWalls.includes("right");
    if (backSkipped && rightVisible) {
      backers.push({
        x: hw - STUD_DEPTH + STUD_WIDTH / 2,
        y: backerY,
        z: -hd - STUD_WIDTH - STUD_DEPTH / 2,
        h: fullH,
        size: [STUD_WIDTH, fullH, STUD_DEPTH],
      });
    }
    if (backSkipped && leftVisible) {
      backers.push({
        x: -hw + STUD_DEPTH - STUD_WIDTH / 2,
        y: backerY,
        z: -hd - STUD_WIDTH - STUD_DEPTH / 2,
        h: fullH,
        size: [STUD_WIDTH, fullH, STUD_DEPTH],
      });
    }

    return { walls: wallResults, cornerBackers: backers };
  }, [
    width,
    depth,
    wallHeight,
    config,
    showVerticalTopPlate,
    wallCuts,
    skipWalls,
    hideWalls,
  ]);

  const pineTexture = useMemo(() => getPineTexture(), []);

  return (
    <group>
      {walls.map((wall) => (
        <group
          key={wall.wallName}
          position={wall.position}
          rotation={[0, wall.rotationY, 0]}
        >
          {wall.studs.map((stud, i) => (
            <mesh key={i} position={[stud.x, stud.y, stud.z]}>
              <boxGeometry args={[stud.w, stud.h, stud.d]} />
              <meshStandardMaterial
                map={pineTexture}
                color="#e8c88a"
                roughness={0.85}
              />
            </mesh>
          ))}
          {wall.verticalPlate && (
            <mesh
              position={[
                wall.verticalPlate.x,
                wall.verticalPlate.y,
                wall.verticalPlate.z,
              ]}
            >
              <boxGeometry
                args={[
                  wall.verticalPlate.w,
                  wall.verticalPlate.h,
                  wall.verticalPlate.d,
                ]}
              />
              <meshStandardMaterial
                map={pineTexture}
                color="#e8c88a"
                roughness={0.85}
              />
            </mesh>
          )}
        </group>
      ))}
      {/* California corner backing studs (flat, turned 90°) */}
      {cornerBackers.map((b, i) => (
        <mesh key={`corner-backer-${i}`} position={[b.x, b.y, b.z]}>
          <boxGeometry args={b.size} />
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
