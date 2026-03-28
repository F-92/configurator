"use client";

import { HouseConfig } from "../lib/types";

interface FoundationProps {
  config: HouseConfig;
}

export function Foundation({ config }: FoundationProps) {
  const { width, depth } = config;

  return (
    <group>
      {/* Foundation slab */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[width + 0.3, 0.2, depth + 0.3]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
      {/* Floor */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
    </group>
  );
}

export function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#4a7c3f" />
    </mesh>
  );
}
