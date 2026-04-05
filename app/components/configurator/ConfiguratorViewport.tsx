import type React from "react";
import { Canvas } from "@react-three/fiber";
import { Grid, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { ConfiguratorViewportProps } from "./types";

export function ConfiguratorViewport({
  cameraTarget,
  cameraView,
  onCenterCamera,
  controlsRef,
  children,
}: ConfiguratorViewportProps) {
  return (
    <main className="flex-1 relative min-h-100">
      <Canvas shadows={{ type: THREE.PCFShadowMap }} className="w-full h-full">
        <color attach="background" args={["#ffffff"]} />
        <PerspectiveCamera
          key={`camera-${cameraView.key}`}
          makeDefault
          position={cameraView.position}
          fov={50}
        />
        <OrbitControls
          ref={controlsRef}
          key={`controls-${cameraView.key}`}
          enableDamping
          dampingFactor={0.1}
          enablePan
          minDistance={3}
          maxDistance={60}
          maxPolarAngle={Math.PI / 2 - 0.05}
          target={cameraView.target}
          zoomToCursor
        />

        <ambientLight intensity={0.7} />
        <directionalLight
          position={[20, 20, 10]}
          intensity={1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-10, 15, -10]} intensity={0.5} />
        <directionalLight position={[5, 8, -15]} intensity={0.3} />
        <hemisphereLight args={["#f0f0ff", "#d4c9a8", 0.4]} />

        {children}

        <Grid
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.5}
          cellColor="#d4d4d4"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#a3a3a3"
          position={[0, -0.16, 0]}
          fadeDistance={50}
          fadeStrength={1}
          infiniteGrid
        />
      </Canvas>

      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="text-xs text-zinc-500 bg-white/70 backdrop-blur rounded px-2 py-1">
          Dra for att rotera · Scrolla for att zooma · Hogerklick for att
          panorera
        </div>
        <button
          onClick={onCenterCamera}
          className="rounded bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur transition-colors hover:bg-white/90"
        >
          Centrera
        </button>
      </div>

      <div className="sr-only">Camera target: {cameraTarget.join(",")}</div>
    </main>
  );
}
