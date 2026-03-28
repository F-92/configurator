"use client";

import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Grid,
} from "@react-three/drei";
import * as THREE from "three";
import { useHouseStore } from "../lib/store";
import { Walls } from "./Walls";
import { Roof } from "./Roof";
import { WindowMeshes, DoorMeshes } from "./Openings";
import { Foundation, Ground } from "./Foundation";
import { WallStuds } from "./WallStuds";
import { RoofTrusses } from "./RoofTrusses";
import { RoofTiles } from "./RoofTiles";
import { Dimensions } from "./Dimensions";

function HouseModel() {
  const config = useHouseStore((s) => s.config);
  const showFraming = useHouseStore((s) => s.showFraming);
  const showVerticalTopPlate = useHouseStore((s) => s.showVerticalTopPlate);
  const showTiles = useHouseStore((s) => s.showTiles);
  const showDimensions = useHouseStore((s) => s.showDimensions);

  return (
    <group>
      <Foundation config={config} />
      {showFraming ? (
        <>
          <WallStuds
            config={config}
            showVerticalTopPlate={showVerticalTopPlate}
          />
          <RoofTrusses config={config} />
        </>
      ) : (
        <>
          <Walls config={config} />
          <Roof config={config} />
          <RoofTiles
            config={config}
            showTiles={showTiles}
            showDimensions={showDimensions}
          />
          <WindowMeshes config={config} />
          <DoorMeshes config={config} />
        </>
      )}
      {showDimensions && <Dimensions config={config} />}
    </group>
  );
}

export default function Scene() {
  return (
    <Canvas shadows={{ type: THREE.PCFShadowMap }} className="w-full h-full">
      <PerspectiveCamera makeDefault position={[15, 10, 15]} fov={50} />
      <OrbitControls
        enableDamping
        dampingFactor={0.1}
        minDistance={5}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 2, 0]}
      />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 20, 10]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      <hemisphereLight args={["#87CEEB", "#4a7c3f", 0.3]} />

      <HouseModel />
      <Ground />

      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9e9e9e"
        position={[0, -0.19, 0]}
        fadeDistance={50}
        fadeStrength={1}
        infiniteGrid
      />
    </Canvas>
  );
}
