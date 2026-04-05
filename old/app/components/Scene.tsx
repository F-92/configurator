"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Grid } from "@react-three/drei";
import * as THREE from "three";
import { useHouseStore } from "../lib/store";
import { HouseConfig, WallName } from "../lib/types";
import {
  computeBodyWorldTransform,
  makeExtensionConfig,
  getWallCuts,
  getJunctionBackers,
  getCollinearWalls,
  MergedWall,
} from "../lib/extensions";
import { Walls, WallCut } from "./Walls";
import { Roof } from "./Roof";
import { WindowMeshes, DoorMeshes } from "./Openings";
import { Foundation, Ground } from "./Foundation";
import {
  WallStuds,
  generateWallStuds,
  generateVerticalTopPlate,
  getOpeningsForWall,
  STUD_WIDTH,
  STUD_DEPTH,
  PLATE_HEIGHT,
  VERTICAL_PLATE_HEIGHT,
} from "./WallStuds";
import { RoofTrusses } from "./RoofTrusses";
import { RoofTiles } from "./RoofTiles";
import { Dimensions, FramingDimensions } from "./Dimensions";
import { getPineTexture } from "../lib/woodTexture";

/** Renders a single house body (main or extension) */
function HouseBody({
  config,
  showFraming,
  showVerticalTopPlate,
  showTiles,
  showDimensions,
  wallCuts,
  skipWalls,
  hideWalls,
}: {
  config: HouseConfig;
  showFraming: boolean;
  showVerticalTopPlate: boolean;
  showTiles: boolean;
  showDimensions: boolean;
  wallCuts?: WallCut[];
  skipWalls?: WallName[];
  hideWalls?: WallName[];
}) {
  return (
    <group>
      <Foundation config={config} />
      {showFraming ? (
        <>
          <WallStuds
            config={config}
            showVerticalTopPlate={showVerticalTopPlate}
            wallCuts={wallCuts}
            skipWalls={skipWalls}
            hideWalls={hideWalls}
          />
          <RoofTrusses config={config} />
        </>
      ) : (
        <>
          <Walls
            config={config}
            wallCuts={wallCuts}
            skipWalls={skipWalls}
            hideWalls={hideWalls}
          />
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
      {showDimensions && showFraming && <FramingDimensions config={config} />}
    </group>
  );
}

/** Renders merged wall framing (WallStuds) for collinear walls */
function MergedWallFraming({
  mw,
  showVerticalTopPlate,
}: {
  mw: MergedWall;
  showVerticalTopPlate: boolean;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const { studs, verticalPlate, cornerBackers } = useMemo(() => {
    const openings = getOpeningsForWall(
      "front",
      mw.totalLength,
      mw.mergedConfig,
    );
    const vpHeight = showVerticalTopPlate ? VERTICAL_PLATE_HEIGHT : 0;
    const s = generateWallStuds(
      mw.totalLength,
      mw.wallHeight,
      openings,
      vpHeight,
    );
    const vp = showVerticalTopPlate
      ? generateVerticalTopPlate(mw.totalLength, mw.wallHeight)
      : null;

    // California corner backers: only at the parent's far end where the
    // merged through-wall extends past a perpendicular butt wall.
    // The extension's far end butts into the extension's own through-wall,
    // so no backer there. Butt-wall merges (left/right) get no backers.
    const isThroughWall =
      mw.parentWallToSkip === "front" || mw.parentWallToSkip === "back";
    const plateTop = mw.wallHeight - PLATE_HEIGHT;
    const fullH = plateTop - PLATE_HEIGHT;
    const backerY = PLATE_HEIGHT + fullH / 2;
    const backerZ = -STUD_DEPTH + STUD_WIDTH / 2;
    const backers: { x: number; y: number; z: number; h: number }[] = [];
    if (isThroughWall) {
      // Only at the parent's far end where a perpendicular butt wall meets
      // the merged through-wall. No backer at junction (wall continues straight)
      // or at extension's far end (extension's own through-wall covers that).
      if (mw.extAddsAtStart) {
        // Parent is at end (high x)
        backers.push({
          x: mw.totalLength - STUD_WIDTH - STUD_DEPTH / 2,
          y: backerY,
          z: backerZ,
          h: fullH,
        });
      } else {
        // Parent is at start (low x)
        backers.push({
          x: STUD_WIDTH + STUD_DEPTH / 2,
          y: backerY,
          z: backerZ,
          h: fullH,
        });
      }
    }

    return { studs: s, verticalPlate: vp, cornerBackers: backers };
  }, [mw, showVerticalTopPlate]);

  return (
    <group position={mw.position} rotation={[0, mw.rotationY, 0]}>
      {studs.map((stud, i) => (
        <mesh key={i} position={[stud.x, stud.y, stud.z]}>
          <boxGeometry args={[stud.w, stud.h, stud.d]} />
          <meshStandardMaterial
            map={pineTexture}
            color="#f5e6c8"
            roughness={0.85}
          />
        </mesh>
      ))}
      {verticalPlate && (
        <mesh position={[verticalPlate.x, verticalPlate.y, verticalPlate.z]}>
          <boxGeometry
            args={[verticalPlate.w, verticalPlate.h, verticalPlate.d]}
          />
          <meshStandardMaterial
            map={pineTexture}
            color="#f5e6c8"
            roughness={0.85}
          />
        </mesh>
      )}
      {/* California corner backers at each end */}
      {cornerBackers.map((b, i) => (
        <mesh key={`cb-${i}`} position={[b.x, b.y, b.z]}>
          <boxGeometry args={[STUD_DEPTH, b.h, STUD_WIDTH]} />
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

/** Renders merged wall surface (solid wall) for collinear walls */
function MergedWallSurface({ mw }: { mw: MergedWall }) {
  const geometry = useMemo(() => {
    const { totalLength, wallHeight, mergedConfig } = mw;

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(totalLength, 0);
    shape.lineTo(totalLength, wallHeight);
    shape.lineTo(0, wallHeight);
    shape.closePath();

    // Cut window holes
    for (const win of mergedConfig.windows.filter((w) => w.wall === "front")) {
      const cx = win.positionX * totalLength;
      const cy = win.positionY + win.height / 2;
      const hole = new THREE.Path();
      hole.moveTo(cx - win.width / 2, cy - win.height / 2);
      hole.lineTo(cx + win.width / 2, cy - win.height / 2);
      hole.lineTo(cx + win.width / 2, cy + win.height / 2);
      hole.lineTo(cx - win.width / 2, cy + win.height / 2);
      hole.closePath();
      shape.holes.push(hole);
    }

    // Cut door holes
    for (const door of mergedConfig.doors.filter((d) => d.wall === "front")) {
      const cx = door.positionX * totalLength;
      const hole = new THREE.Path();
      hole.moveTo(cx - door.width / 2, 0);
      hole.lineTo(cx + door.width / 2, 0);
      hole.lineTo(cx + door.width / 2, door.height);
      hole.lineTo(cx - door.width / 2, door.height);
      hole.closePath();
      shape.holes.push(hole);
    }

    return new THREE.ShapeGeometry(shape);
  }, [mw]);

  return (
    <group position={mw.position} rotation={[0, mw.rotationY, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={mw.mergedConfig.wallColor}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function HouseModel() {
  const config = useHouseStore((s) => s.config);
  const showFraming = useHouseStore((s) => s.showFraming);
  const showVerticalTopPlate = useHouseStore((s) => s.showVerticalTopPlate);
  const showTiles = useHouseStore((s) => s.showTiles);
  const showDimensions = useHouseStore((s) => s.showDimensions);
  const pineTexture = useMemo(() => getPineTexture(), []);

  // Detect collinear walls that should be merged
  const mergedWalls = useMemo(() => {
    return getCollinearWalls(config);
  }, [config]);

  // Compute which walls to hide per body due to merging.
  // hideWalls: walls that should not render but still affect butt wall length
  // (the perpendicular walls still need to be shortened as if the hidden wall exists).
  const hideWallsPerBody = useMemo(() => {
    const map = new Map<string, Set<WallName>>();
    for (const mw of mergedWalls) {
      if (!map.has(mw.parentBodyId)) map.set(mw.parentBodyId, new Set());
      map.get(mw.parentBodyId)!.add(mw.parentWallToSkip);
      if (!map.has(mw.extensionId)) map.set(mw.extensionId, new Set());
      map.get(mw.extensionId)!.add(mw.extensionWallToSkip);
    }
    return map;
  }, [mergedWalls]);

  // Set of extension IDs that have a collinear connection on each side,
  // used to suppress junction backers for the collinear side
  const collinearExtSides = useMemo(() => {
    const map = new Map<string, Set<"left" | "right">>();
    for (const mw of mergedWalls) {
      if (!map.has(mw.extensionId)) map.set(mw.extensionId, new Set());
      map.get(mw.extensionId)!.add(mw.extensionWallToSkip as "left" | "right");
    }
    return map;
  }, [mergedWalls]);

  // Wall cuts for main body (where extensions connect)
  const mainWallCuts = useMemo(() => getWallCuts("main", config), [config]);

  // Main body hide walls from merging
  const mainHideWalls = useMemo(() => {
    const s = hideWallsPerBody.get("main");
    return s ? Array.from(s) : [];
  }, [hideWallsPerBody]);

  // Extension bodies with transforms and junction backers
  const extensionBodies = useMemo(
    () =>
      config.extensions.map((ext) => {
        const transform = computeBodyWorldTransform(ext.id, config);
        const extConfig = makeExtensionConfig(ext, config);
        const extWallCuts = getWallCuts(ext.id, config);

        // Filter junction backers: skip backers on collinear sides.
        // Backers are ordered [lowEdge, highEdge] in position-space along the parent wall.
        // Map position-space index to extension local side based on parent wall orientation:
        //   front/back: index 0 (low) = ext "left", index 1 (high) = ext "right"
        //   right/left: index 0 (low) = ext "right", index 1 (high) = ext "left"
        const allBackers = getJunctionBackers(ext, config);
        const collinearSides = collinearExtSides.get(ext.id);
        const isReversed =
          ext.parentWall === "right" || ext.parentWall === "left";
        const junctionBackers = collinearSides
          ? allBackers.filter((_, i) => {
              const side: "left" | "right" = isReversed
                ? i === 0
                  ? "right"
                  : "left"
                : i === 0
                  ? "left"
                  : "right";
              return !collinearSides.has(side);
            })
          : allBackers;

        // Hide walls: collinear walls that are rendered as merged walls
        const extraHides = hideWallsPerBody.get(ext.id);
        const hideWalls: WallName[] = [];
        if (extraHides) {
          for (const w of extraHides) {
            hideWalls.push(w);
          }
        }

        return {
          ext,
          transform,
          extConfig,
          extWallCuts,
          junctionBackers,
          skipWalls: ["back"] as WallName[],
          hideWalls,
        };
      }),
    [config, hideWallsPerBody, collinearExtSides],
  );

  return (
    <group>
      {/* Main body */}
      <HouseBody
        config={config}
        showFraming={showFraming}
        showVerticalTopPlate={showVerticalTopPlate}
        showTiles={showTiles}
        showDimensions={showDimensions}
        wallCuts={mainWallCuts}
        hideWalls={mainHideWalls}
      />

      {/* Extension bodies */}
      {extensionBodies.map(
        ({
          ext,
          transform,
          extConfig,
          extWallCuts,
          junctionBackers,
          skipWalls,
          hideWalls,
        }) => (
          <group key={ext.id}>
            <group
              position={transform.position}
              rotation={[0, transform.rotationY, 0]}
            >
              <HouseBody
                config={extConfig}
                showFraming={showFraming}
                showVerticalTopPlate={showVerticalTopPlate}
                showTiles={showTiles}
                showDimensions={showDimensions}
                wallCuts={extWallCuts}
                skipWalls={skipWalls}
                hideWalls={hideWalls}
              />
            </group>

            {/* California corner backing studs at junction (world space) */}
            {showFraming &&
              junctionBackers.map((backer, i) => (
                <mesh key={`jb-${ext.id}-${i}`} position={backer.position}>
                  <boxGeometry args={backer.size} />
                  <meshStandardMaterial
                    map={pineTexture}
                    color="#f5e6c8"
                    roughness={0.85}
                  />
                </mesh>
              ))}
          </group>
        ),
      )}

      {/* Merged collinear walls */}
      {mergedWalls.map((mw, i) =>
        showFraming ? (
          <MergedWallFraming
            key={`mw-${i}`}
            mw={mw}
            showVerticalTopPlate={showVerticalTopPlate}
          />
        ) : (
          <MergedWallSurface key={`mw-${i}`} mw={mw} />
        ),
      )}
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
