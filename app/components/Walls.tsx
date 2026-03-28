"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { HouseConfig } from "../lib/types";

interface WallsProps {
  config: HouseConfig;
}

export function Walls({ config }: WallsProps) {
  const { width, depth, wallHeight, wallColor, windows, doors } = config;

  const wallMeshes = useMemo(() => {
    const walls: {
      key: string;
      position: [number, number, number];
      rotation: [number, number, number];
      geometry: THREE.BufferGeometry;
    }[] = [];

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
        length: depth,
        position: [-width / 2, wallHeight / 2, 0],
        rotation: [0, Math.PI / 2, 0],
      },
      {
        key: "right",
        wallName: "right",
        length: depth,
        position: [width / 2, wallHeight / 2, 0],
        rotation: [0, -Math.PI / 2, 0],
      },
    ];

    for (const wd of wallDefs) {
      const wallWindows = windows.filter((w) => w.wall === wd.wallName);
      const wallDoors = doors.filter((d) => d.wall === wd.wallName);

      if (wallWindows.length === 0 && wallDoors.length === 0) {
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
  }, [width, depth, wallHeight, windows, doors]);

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
