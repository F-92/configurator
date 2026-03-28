"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { HouseConfig, WindowConfig, DoorConfig } from "../lib/types";
import { getPineTexture } from "../lib/woodTexture";

// Swedish standard timber dimensions (meters)
const STUD_WIDTH = 0.045; // 45mm
const STUD_DEPTH = 0.145; // 145mm (common wall stud)
const PLATE_HEIGHT = 0.045; // top/bottom plate thickness

interface Opening {
  centerX: number; // position along wall in meters from left edge
  width: number;
  height: number;
  bottomY: number; // from floor
}

function getOpeningsForWall(
  wallName: "front" | "back" | "left" | "right",
  wallLength: number,
  config: HouseConfig,
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

  return openings.sort((a, b) => a.centerX - b.centerX);
}

function generateWallStuds(
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

  // Bottom plate (syll)
  studs.push({
    x: wallLength / 2,
    y: PLATE_HEIGHT / 2,
    z: zOff,
    w: wallLength,
    h: PLATE_HEIGHT,
    d: STUD_DEPTH,
  });

  // Top plate (hammarband)
  studs.push({
    x: wallLength / 2,
    y: plateTop + PLATE_HEIGHT / 2,
    z: zOff,
    w: wallLength,
    h: PLATE_HEIGHT,
    d: STUD_DEPTH,
  });

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

    // King studs (full height, flanking the opening)
    for (const kx of [opLeft - STUD_WIDTH / 2, opRight + STUD_WIDTH / 2]) {
      if (kx > 0 && kx < wallLength) {
        addStud(kx, PLATE_HEIGHT, fullStudHeight);
      }
    }

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
const VERTICAL_PLATE_THICKNESS = 0.045; // 45mm
const VERTICAL_PLATE_HEIGHT = 0.195; // 195mm on edge

function generateVerticalTopPlate(wallLength: number, wallHeight: number) {
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
}

export function WallStuds({
  config,
  showVerticalTopPlate = false,
}: WallStudsProps) {
  const { width, depth, wallHeight } = config;

  // California corner framing: front/back walls run full width (through walls),
  // left/right walls are shortened to fit between them (butt walls).
  // A flat backing stud at each corner provides interior nailing surface.
  const { walls, cornerBackers } = useMemo(() => {
    const sideLength = depth - 2 * STUD_DEPTH;
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
        position: [-width / 2, 0, -depth / 2 + STUD_DEPTH],
        rotationY: -Math.PI / 2,
      },
      {
        wallName: "right",
        length: sideLength,
        position: [width / 2, 0, depth / 2 - STUD_DEPTH],
        rotationY: Math.PI / 2,
      },
    ];

    const wallResults = wallDefs.map((wd) => {
      const openings = getOpeningsForWall(wd.wallName, wd.length, config);
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

    // California corner backing studs — flat studs (turned 90°) nailed to
    // the inside face of each through-wall corner stud, providing an
    // interior nailing surface for the perpendicular wall's drywall.
    const plateTop = wallHeight - PLATE_HEIGHT;
    const fullH = plateTop - PLATE_HEIGHT;
    const backerY = PLATE_HEIGHT + fullH / 2;
    const hw = width / 2;
    const hd = depth / 2;
    const backers = [
      // Front-right — inside front wall cavity, nailed to corner stud side
      {
        x: hw - STUD_WIDTH - STUD_DEPTH / 2,
        y: backerY,
        z: hd - STUD_DEPTH + STUD_WIDTH / 2,
        h: fullH,
      },
      // Front-left
      {
        x: -hw + STUD_WIDTH + STUD_DEPTH / 2,
        y: backerY,
        z: hd - STUD_DEPTH + STUD_WIDTH / 2,
        h: fullH,
      },
      // Back-right
      {
        x: hw - STUD_WIDTH - STUD_DEPTH / 2,
        y: backerY,
        z: -hd + STUD_DEPTH - STUD_WIDTH / 2,
        h: fullH,
      },
      // Back-left
      {
        x: -hw + STUD_WIDTH + STUD_DEPTH / 2,
        y: backerY,
        z: -hd + STUD_DEPTH - STUD_WIDTH / 2,
        h: fullH,
      },
    ];

    return { walls: wallResults, cornerBackers: backers };
  }, [width, depth, wallHeight, config, showVerticalTopPlate]);

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
          <boxGeometry args={[STUD_DEPTH, b.h, STUD_WIDTH]} />
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
