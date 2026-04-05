"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { HouseConfig, WallName } from "../lib/types";
import { STUD_DEPTH } from "./WallStuds";

export interface WallCut {
  wall: WallName;
  positionX: number; // 0-1 along wall
  width: number; // meters
  height: number; // meters
}

interface WallsProps {
  config: HouseConfig;
  wallCuts?: WallCut[];
  skipWalls?: WallName[];
  /** Walls to hide from rendering without affecting geometry calculations */
  hideWalls?: WallName[];
}

export function Walls({
  config,
  wallCuts = [],
  skipWalls = [],
  hideWalls = [],
}: WallsProps) {
  const { width, depth, wallHeight, wallColor, windows, doors } = config;

  const wallMeshes = useMemo(() => {
    const walls: {
      key: string;
      position: [number, number, number];
      rotation: [number, number, number];
      geometry: THREE.BufferGeometry;
    }[] = [];

    // Extension butt walls extend through parent's wall thickness at junctions
    const skipBack = skipWalls.includes("back");
    const skipFront = skipWalls.includes("front");
    const sideExtension =
      (skipBack ? STUD_DEPTH : 0) + (skipFront ? STUD_DEPTH : 0);
    const sideLength = depth + sideExtension;
    const sideZShift =
      ((skipFront ? STUD_DEPTH : 0) - (skipBack ? STUD_DEPTH : 0)) / 2;

    const wallDefs: {
      key: string;
      wallName: "front" | "back" | "left" | "right";
      length: number;
      position: [number, number, number];
      rotation: [number, number, number];
    }[] = [
      {
        key: "front",
        wallName: "front",
        length: width,
        position: [0, wallHeight / 2, depth / 2],
        rotation: [0, 0, 0],
      },
      {
        key: "back",
        wallName: "back",
        length: width,
        position: [0, wallHeight / 2, -depth / 2],
        rotation: [0, Math.PI, 0],
      },
      {
        key: "left",
        wallName: "left",
        length: sideLength,
        position: [-width / 2, wallHeight / 2, sideZShift],
        rotation: [0, Math.PI / 2, 0],
      },
      {
        key: "right",
        wallName: "right",
        length: sideLength,
        position: [width / 2, wallHeight / 2, sideZShift],
        rotation: [0, -Math.PI / 2, 0],
      },
    ];

    for (const wd of wallDefs) {
      if (skipWalls.includes(wd.wallName) || hideWalls.includes(wd.wallName))
        continue;

      const wallWindows = windows.filter((w) => w.wall === wd.wallName);
      const wallDoors = doors.filter((d) => d.wall === wd.wallName);
      const cuts = wallCuts.filter((c) => c.wall === wd.wallName);

      if (
        wallWindows.length === 0 &&
        wallDoors.length === 0 &&
        cuts.length === 0
      ) {
        const geo = new THREE.PlaneGeometry(wd.length, wallHeight);
        walls.push({
          key: wd.key,
          position: wd.position,
          rotation: wd.rotation,
          geometry: geo,
        });
      } else {
        // Create wall with holes using Shape
        const shape = new THREE.Shape();
        const hw = wd.length / 2;
        const hh = wallHeight / 2;
        shape.moveTo(-hw, -hh);
        shape.lineTo(hw, -hh);
        shape.lineTo(hw, hh);
        shape.lineTo(-hw, hh);
        shape.closePath();

        // Cut window holes
        for (const win of wallWindows) {
          const cx = (win.positionX - 0.5) * wd.length;
          const cy = win.positionY - wallHeight / 2 + win.height / 2;
          const hole = new THREE.Path();
          hole.moveTo(cx - win.width / 2, cy - win.height / 2);
          hole.lineTo(cx + win.width / 2, cy - win.height / 2);
          hole.lineTo(cx + win.width / 2, cy + win.height / 2);
          hole.lineTo(cx - win.width / 2, cy + win.height / 2);
          hole.closePath();
          shape.holes.push(hole);
        }

        // Cut door holes
        for (const door of wallDoors) {
          const cx = (door.positionX - 0.5) * wd.length;
          const cy = -hh + door.height / 2;
          const hole = new THREE.Path();
          hole.moveTo(cx - door.width / 2, cy - door.height / 2);
          hole.lineTo(cx + door.width / 2, cy - door.height / 2);
          hole.lineTo(cx + door.width / 2, cy + door.height / 2);
          hole.lineTo(cx - door.width / 2, cy + door.height / 2);
          hole.closePath();
          shape.holes.push(hole);
        }

        // Cut extension connection holes
        for (const cut of cuts) {
          const cx = (cut.positionX - 0.5) * wd.length;
          const cutH = Math.min(cut.height, wallHeight);
          const cy = -hh + cutH / 2;
          const hole = new THREE.Path();
          hole.moveTo(cx - cut.width / 2, cy - cutH / 2);
          hole.lineTo(cx + cut.width / 2, cy - cutH / 2);
          hole.lineTo(cx + cut.width / 2, cy + cutH / 2);
          hole.lineTo(cx - cut.width / 2, cy + cutH / 2);
          hole.closePath();
          shape.holes.push(hole);
        }

        const geo = new THREE.ShapeGeometry(shape);
        walls.push({
          key: wd.key,
          position: wd.position,
          rotation: wd.rotation,
          geometry: geo,
        });
      }
    }

    return walls;
  }, [
    width,
    depth,
    wallHeight,
    windows,
    doors,
    wallCuts,
    skipWalls,
    hideWalls,
  ]);

  return (
    <group>
      {wallMeshes.map((wall) => (
        <mesh
          key={wall.key}
          position={wall.position}
          rotation={wall.rotation}
          geometry={wall.geometry}
        >
          <meshStandardMaterial color={wallColor} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
