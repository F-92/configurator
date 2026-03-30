"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Grid,
  Text,
} from "@react-three/drei";
import * as THREE from "three";
import {
  WallLayout,
  rectangleLayout,
  fromPoints,
  traceLayout,
} from "../lib/wallLayout";
import type { Wall } from "../lib/wallLayout";
import { getPineTexture } from "../lib/woodTexture";

// ---- Constants ----
const MM = 0.001; // mm → meters for Three.js
const WALL_HEIGHT = 2700; // mm
const PLATE_HEIGHT = 45; // mm
const VERTICAL_PLATE_THICKNESS = 45; // mm
const VERTICAL_PLATE_HEIGHT = 195; // mm
const STUD_COLOR = "#f5e6c8";
const WALL_SURFACE_COLOR = "#dfc4a0";
const OUTSIDE_INSULATION_OPTIONS = [0, 30, 50, 80, 95] as const;
const INSTALLATION_LAYER_OPTIONS = [0, 45, 70] as const;
const INSTALLATION_LAYER_STUD_LENGTH_OPTIONS = [
  2400, 3000, 3600, 4200,
] as const;
const INSULATION_SHEET_WIDTH = 1200; // mm
const INSULATION_SHEET_HEIGHT = 2700; // mm
const CAVITY_INSULATION_SHEET_HEIGHT = 1170; // mm
const HOUSE_WRAP_THICKNESS = 2; // mm visual membrane thickness

// ---- Preset Layouts ----

interface LayoutPreset {
  name: string;
  description: string;
  create: (thickness: number, studSpacing: number) => WallLayout;
}

function createNotchedStudGeometry(
  studWidth: number,
  studHeight: number,
  studDepth: number,
  notchHeight: number,
  notchDepth: number,
): THREE.ExtrudeGeometry {
  const halfDepth = studDepth / 2;
  const halfHeight = studHeight / 2;
  const notchBottom = halfHeight - notchHeight;
  const notchFace = -halfDepth + notchDepth;

  const shape = new THREE.Shape();
  shape.moveTo(-halfDepth, -halfHeight);
  shape.lineTo(halfDepth, -halfHeight);
  shape.lineTo(halfDepth, halfHeight);
  shape.lineTo(notchFace, halfHeight);
  shape.lineTo(notchFace, notchBottom);
  shape.lineTo(-halfDepth, notchBottom);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: studWidth,
    bevelEnabled: false,
  });

  geometry.rotateY(-Math.PI / 2);
  geometry.translate(studWidth / 2, 0, 0);

  return geometry;
}

const PRESETS: LayoutPreset[] = [
  {
    name: "Rektangel 10×8m",
    description: "Enkel rektangulär byggnad",
    create: (t, s) =>
      rectangleLayout(10_000, 8_000, { thickness: t, studSpacing: s }),
  },
  {
    name: "Rektangel 12×10m",
    description: "Större rektangulär byggnad",
    create: (t, s) =>
      rectangleLayout(12_000, 10_000, { thickness: t, studSpacing: s }),
  },
  {
    name: "L-form",
    description: "L-formad byggnad med innerhörn",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [6_000, 0],
          [6_000, 4_000],
          [10_000, 4_000],
          [10_000, 8_000],
          [0, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "T-form",
    description: "T-formad byggnad",
    create: (t, s) =>
      fromPoints(
        [
          [3_000, 0],
          [9_000, 0],
          [9_000, 5_000],
          [12_000, 5_000],
          [12_000, 8_000],
          [0, 8_000],
          [0, 5_000],
          [3_000, 5_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Trapets",
    description: "Snedvinklade sidor",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [12_000, 0],
          [10_000, 8_000],
          [2_000, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Sexhörning",
    description: "Hexagonal form",
    create: (t, s) => {
      const r = 5_000;
      const pts: [number, number][] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push([
          Math.round(r * Math.cos(a) + r),
          Math.round(r * Math.sin(a) + r),
        ]);
      }
      return fromPoints(pts, { thickness: t, studSpacing: s });
    },
  },
  {
    name: "U-form",
    description: "U-formad byggnad",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [3_000, 0],
          [3_000, 5_000],
          [7_000, 5_000],
          [7_000, 0],
          [10_000, 0],
          [10_000, 8_000],
          [0, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Trace: Vinkelform",
    description: "Byggd via trace-byggare",
    create: (t, s) =>
      traceLayout({ thickness: t, studSpacing: s })
        .wall(8_000)
        .turn(90)
        .wall(4_000)
        .turn(-90)
        .wall(4_000)
        .turn(90)
        .wall(6_000)
        .turn(90)
        .wall(12_000)
        .close(),
  },
];

// ---- 3D Wall Components ----

/** Renders a single wall's stud framing in 3D */
function WallFraming({
  wall,
  wallHeight,
  showVerticalTopPlate,
}: {
  wall: Wall;
  wallHeight: number;
  showVerticalTopPlate: boolean;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const meshes = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      geometry?: THREE.BufferGeometry;
      size?: [number, number, number];
    }[] = [];

    const effLen = wall.effectiveLength * MM;
    const wallH = wallHeight * MM;
    const studW = wall.studLayout.studs[0]?.width ?? 45;
    const studD = wall.studLayout.studs[0]?.depth ?? 145;
    const studWM = studW * MM;
    const studDM = studD * MM;
    const plateH = PLATE_HEIGHT * MM;
    const fullStudH = wallH - 2 * plateH;
    const verticalPlateH =
      showVerticalTopPlate && fullStudH > VERTICAL_PLATE_HEIGHT * MM
        ? VERTICAL_PLATE_HEIGHT * MM
        : 0;
    const verticalPlateD = VERTICAL_PLATE_THICKNESS * MM;
    const outerFaceZ = -studDM / 2;
    const verticalPlateZ = outerFaceZ + verticalPlateD / 2;
    const notchedStudGeometry =
      verticalPlateH > 0
        ? createNotchedStudGeometry(
            studWM,
            fullStudH,
            studDM,
            verticalPlateH,
            verticalPlateD,
          )
        : null;

    // Bottom plate
    result.push({
      key: "bp",
      pos: [effLen / 2, plateH / 2, 0],
      size: [effLen, plateH, studDM],
    });

    // Top plate
    result.push({
      key: "tp",
      pos: [effLen / 2, wallH - plateH / 2, 0],
      size: [effLen, plateH, studDM],
    });

    if (verticalPlateH > 0) {
      result.push({
        key: "vtp",
        pos: [effLen / 2, wallH - plateH - verticalPlateH / 2, verticalPlateZ],
        size: [effLen, verticalPlateH, verticalPlateD],
      });
    }

    // Studs
    for (let i = 0; i < wall.studLayout.studs.length; i++) {
      const stud = wall.studLayout.studs[i];
      const x = stud.centerPosition * MM;
      if (verticalPlateH > 0 && notchedStudGeometry) {
        result.push({
          key: `s-${i}`,
          pos: [x, plateH + fullStudH / 2, 0],
          geometry: notchedStudGeometry,
        });
      } else {
        result.push({
          key: `s-${i}`,
          pos: [x, plateH + fullStudH / 2, 0],
          size: [studWM, fullStudH, studDM],
        });
      }
    }

    // California corner studs stay full height; only the regular studs are
    // notched for the vertical top plate in the main framing implementation.
    for (let i = 0; i < wall.studLayout.cornerStuds.length; i++) {
      const cs = wall.studLayout.cornerStuds[i];
      const x = cs.centerPosition * MM;
      const halfDepth = (studD / 2) * MM;
      const halfStudW = (studW / 2) * MM;
      // Inner: offset +Z (toward interior), Outer: offset -Z (toward exterior)
      const zOffset =
        cs.offsetSide === "inner"
          ? halfDepth - halfStudW
          : -(halfDepth - halfStudW);
      result.push({
        key: `cs-${i}`,
        pos: [x, plateH + fullStudH / 2, zOffset],
        size: [studDM, fullStudH, studWM], // swapped width/depth (rotated 90°)
      });
    }

    return result;
  }, [showVerticalTopPlate, wall, wallHeight]);

  // Position the group at the wall's physical start, rotated to face the correct direction
  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    // Position at outer start, midway to inner start for centering on wall thickness
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM; // flip Y→Z
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle, // Three.js Y rotation maps local +X to (cosθ, 0, -sinθ), matching 2D→3D coord flip
    };
  }, [wall]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {meshes.map((m) => (
        <group key={m.key} position={m.pos}>
          <mesh>
            {m.geometry ? (
              <primitive object={m.geometry} attach="geometry" />
            ) : (
              <boxGeometry args={m.size} />
            )}
            <meshStandardMaterial
              map={pineTexture}
              color={STUD_COLOR}
              roughness={0.85}
            />
          </mesh>
          <lineSegments>
            {m.geometry ? (
              <edgesGeometry args={[m.geometry]} />
            ) : (
              <edgesGeometry args={[new THREE.BoxGeometry(...m.size!)]} />
            )}
            <lineBasicMaterial color="#c8b08a" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Renders a single wall as a solid surface in 3D */
function WallSurface({
  wall,
  wallHeight,
  color,
}: {
  wall: Wall;
  wallHeight: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const h = wallHeight * MM;
    const q = wall.quad;

    // Build a quadrilateral shape from the wall's physical quad, extruded to wall height
    const shape = new THREE.Shape();
    shape.moveTo(q.outerStart.x * MM, q.outerStart.y * MM);
    shape.lineTo(q.outerEnd.x * MM, q.outerEnd.y * MM);
    shape.lineTo(q.innerEnd.x * MM, q.innerEnd.y * MM);
    shape.lineTo(q.innerStart.x * MM, q.innerStart.y * MM);
    shape.closePath();

    const extrudeSettings = { depth: h, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Rotate so the extrusion goes up (Y axis) instead of Z
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [wall, wallHeight]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.7}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#b0a080" linewidth={1} />
      </lineSegments>
    </group>
  );
}

/** Exterior insulation rendered as ROCKWOOL-like sheets, projected outward from the framing wall */
function WallInsulationSheets({
  wall,
  wallHeight,
  thickness,
}: {
  wall: Wall;
  wallHeight: number;
  thickness: number;
}) {
  const sheets = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];

    if (thickness <= 0) return result;

    const centerlineLength = wall.centerlineLength;
    const wallHeightMm = wallHeight;
    const depthM = thickness * MM;
    const wallThicknessM = wall.thickness * MM;
    const zCenter = -(wallThicknessM / 2 + depthM / 2) - 0.001;
    const startOuterCornerOffset = -wall.startCorner.retraction;
    const startConvexExtension =
      wall.startCorner.interiorAngle <= Math.PI &&
      wall.startCorner.joint === "butt"
        ? thickness
        : 0;
    const endConvexExtension =
      wall.endCorner.interiorAngle <= Math.PI && wall.endCorner.joint === "butt"
        ? thickness
        : 0;
    const startReflexInset =
      wall.startCorner.interiorAngle > Math.PI &&
      wall.startCorner.joint === "butt"
        ? thickness
        : 0;
    const endReflexInset =
      wall.endCorner.interiorAngle > Math.PI && wall.endCorner.joint === "butt"
        ? thickness
        : 0;
    const coverageStart =
      startOuterCornerOffset - startConvexExtension + startReflexInset;
    const coverageEnd =
      startOuterCornerOffset +
      centerlineLength +
      endConvexExtension -
      endReflexInset;
    const studWidth = wall.studLayout.studs[0]?.width ?? 45;
    const studHalfWidth = studWidth / 2;
    const studSpacing = wall.studLayout.targetSpacing;
    const firstStudGrid =
      Math.ceil(
        (wall.startCorner.retraction + studHalfWidth + 0.001) / studSpacing,
      ) * studSpacing;
    const studGridOrigin = firstStudGrid - wall.startCorner.retraction;
    const sheetGridOrigin =
      wall.startCorner.joint === "butt" &&
      wall.startCorner.interiorAngle <= Math.PI
        ? studGridOrigin
        : studGridOrigin - studSpacing;
    const firstSheetStart =
      Math.floor((coverageStart - sheetGridOrigin) / INSULATION_SHEET_WIDTH) *
        INSULATION_SHEET_WIDTH +
      sheetGridOrigin;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeightMm - 0.001) {
      const sheetHeight = Math.min(
        INSULATION_SHEET_HEIGHT,
        wallHeightMm - yStart,
      );
      let sheetIndex = 0;

      while (true) {
        const rawStart = firstSheetStart + sheetIndex * INSULATION_SHEET_WIDTH;
        const rawEnd = rawStart + INSULATION_SHEET_WIDTH;

        if (rawStart >= coverageEnd - 0.001) break;

        const clippedStart = Math.max(rawStart, coverageStart);
        const clippedEnd = Math.min(rawEnd, coverageEnd);
        const sheetWidth = clippedEnd - clippedStart;
        const tone = (rowIndex + sheetIndex) % 2 === 0 ? "#8f7650" : "#9b8159";

        if (sheetWidth <= 0.001) {
          sheetIndex += 1;
          continue;
        }

        result.push({
          key: `ins-${rowIndex}-${sheetIndex}`,
          pos: [
            (clippedStart + sheetWidth / 2) * MM,
            (yStart + sheetHeight / 2) * MM,
            zCenter,
          ],
          size: [sheetWidth * MM, sheetHeight * MM, depthM],
          color: tone,
        });

        sheetIndex += 1;
      }

      yStart += INSULATION_SHEET_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [thickness, wall, wallHeight]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  if (thickness <= 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {sheets.map((sheet) => (
        <group key={sheet.key} position={sheet.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={sheet.size} />
            <meshStandardMaterial
              color={sheet.color}
              roughness={0.95}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...sheet.size)]} />
            <lineBasicMaterial color="#5a452d" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Interior cavity insulation placed between studs */
function WallCavityInsulation({
  wall,
  wallHeight,
  showVerticalTopPlate,
}: {
  wall: Wall;
  wallHeight: number;
  showVerticalTopPlate: boolean;
}) {
  const panels = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size?: [number, number, number];
      geometry?: THREE.BufferGeometry;
      color: string;
    }[] = [];

    const studs = wall.studLayout.studs;
    if (studs.length < 2) return result;

    const studWidth = studs[0]?.width ?? 45;
    const studDepth = studs[0]?.depth ?? wall.thickness;
    const studSpacing = wall.studLayout.targetSpacing;
    const plateH = PLATE_HEIGHT;
    const verticalPlateH = showVerticalTopPlate
      ? Math.min(VERTICAL_PLATE_HEIGHT, wallHeight)
      : 0;
    const cavityBottom = plateH;
    const cavityTop = wallHeight - plateH;
    const cavityHeight = cavityTop - cavityBottom;
    if (cavityHeight <= 0.001) return result;

    const panelDepth = studDepth * MM;
    const maxPanelWidth = Math.max(studSpacing - studWidth, 1);
    const zCenter = 0;
    const verticalPlateZoneStart = wallHeight - plateH - verticalPlateH;

    for (let i = 0; i < studs.length - 1; i++) {
      const leftStud = studs[i];
      const rightStud = studs[i + 1];
      const bayStart = leftStud.centerPosition + leftStud.width / 2;
      const bayEnd = rightStud.centerPosition - rightStud.width / 2;
      const bayWidth = bayEnd - bayStart;

      if (bayWidth <= 1) continue;

      const panelCount = Math.max(1, Math.ceil(bayWidth / maxPanelWidth));
      const panelWidth = bayWidth / panelCount;
      let rowStart = cavityBottom;
      let rowIndex = 0;

      while (rowStart < cavityTop - 0.001) {
        const panelHeight = Math.min(
          CAVITY_INSULATION_SHEET_HEIGHT,
          cavityTop - rowStart,
        );
        const rowEnd = rowStart + panelHeight;
        const notchHeight =
          verticalPlateH > 0
            ? Math.max(
                0,
                Math.min(rowEnd - verticalPlateZoneStart, panelHeight),
              )
            : 0;

        for (let panelIndex = 0; panelIndex < panelCount; panelIndex++) {
          const panelStart = bayStart + panelIndex * panelWidth;
          const xCenter = panelStart + panelWidth / 2;
          const panelGeometry =
            notchHeight > 0
              ? createNotchedStudGeometry(
                  panelWidth * MM,
                  panelHeight * MM,
                  panelDepth,
                  notchHeight * MM,
                  VERTICAL_PLATE_THICKNESS * MM,
                )
              : undefined;

          result.push({
            key: `cavity-${i}-${rowIndex}-${panelIndex}`,
            pos: [xCenter * MM, (rowStart + panelHeight / 2) * MM, zCenter],
            size: panelGeometry
              ? undefined
              : [panelWidth * MM, panelHeight * MM, panelDepth],
            geometry: panelGeometry,
            color: (rowIndex + panelIndex) % 2 === 0 ? "#d8bf72" : "#ccb165",
          });
        }

        rowStart += CAVITY_INSULATION_SHEET_HEIGHT;
        rowIndex += 1;
      }
    }

    return result;
  }, [showVerticalTopPlate, wall, wallHeight]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  if (panels.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {panels.map((panel) => (
        <group key={panel.key} position={panel.pos}>
          <mesh castShadow receiveShadow>
            {panel.geometry ? (
              <primitive object={panel.geometry} attach="geometry" />
            ) : (
              <boxGeometry args={panel.size} />
            )}
            <meshStandardMaterial
              color={panel.color}
              roughness={0.95}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            {panel.geometry ? (
              <edgesGeometry args={[panel.geometry]} />
            ) : (
              <edgesGeometry args={[new THREE.BoxGeometry(...panel.size!)]} />
            )}
            <lineBasicMaterial color="#8d7341" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Interior installation layer studs placed inside the vapor barrier */
function WallInstallationLayer({
  wall,
  wallHeight,
  thickness,
  maxStudLength,
}: {
  wall: Wall;
  wallHeight: number;
  thickness: number;
  maxStudLength: number;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const layer = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color?: string;
    }[] = [];

    if (thickness <= 0) return result;

    const studWidth = 45;
    const studDepth = thickness;
    const studSpacing = 600;
    const studWidthM = studWidth * MM;
    const studDepthM = studDepth * MM;
    const layerCenterZ =
      (wall.thickness * MM) / 2 + HOUSE_WRAP_THICKNESS * MM + studDepthM / 2;
    const startOuterInset =
      wall.startCorner.joint === "through" &&
      wall.startCorner.interiorAngle <= Math.PI
        ? wall.thickness
        : 0;
    const endOuterInset =
      wall.endCorner.joint === "through" &&
      wall.endCorner.interiorAngle <= Math.PI
        ? wall.thickness
        : 0;
    const startInnerExtension =
      wall.startCorner.joint === "through" &&
      wall.startCorner.interiorAngle > Math.PI
        ? wall.thickness
        : 0;
    const endInnerExtension =
      wall.endCorner.joint === "through" &&
      wall.endCorner.interiorAngle > Math.PI
        ? wall.thickness
        : 0;
    const startConvexInset =
      wall.startCorner.joint === "butt" &&
      wall.startCorner.interiorAngle <= Math.PI
        ? thickness
        : 0;
    const endConvexInset =
      wall.endCorner.joint === "butt" && wall.endCorner.interiorAngle <= Math.PI
        ? thickness
        : 0;
    const startReflexExtension =
      wall.startCorner.joint === "butt" &&
      wall.startCorner.interiorAngle > Math.PI
        ? thickness
        : 0;
    const endReflexExtension =
      wall.endCorner.joint === "butt" && wall.endCorner.interiorAngle > Math.PI
        ? thickness
        : 0;
    const coverageStart =
      startOuterInset -
      startInnerExtension +
      startConvexInset -
      startReflexExtension;
    const coverageEnd =
      wall.effectiveLength -
      endOuterInset +
      endInnerExtension -
      endConvexInset +
      endReflexExtension;
    const segmentLength = Math.max(maxStudLength, 1);
    const segmentBreaks = [coverageStart];
    const jointCandidates = wall.studLayout.studs
      .map((stud) => stud.centerPosition)
      .filter(
        (centerPosition) =>
          centerPosition > coverageStart + 0.001 &&
          centerPosition < coverageEnd - 0.001,
      );
    const studRowCenters: number[] = [];

    while (segmentBreaks[segmentBreaks.length - 1] < coverageEnd - 0.001) {
      const segmentStart = segmentBreaks[segmentBreaks.length - 1];
      const maxSegmentEnd = Math.min(segmentStart + segmentLength, coverageEnd);
      const alignedJoint = jointCandidates.findLast(
        (centerPosition) =>
          centerPosition > segmentStart + 0.001 &&
          centerPosition <= maxSegmentEnd + 0.001,
      );
      const nextBreak = alignedJoint ?? maxSegmentEnd;

      if (nextBreak <= segmentStart + 0.001) {
        segmentBreaks.push(coverageEnd);
        break;
      }

      segmentBreaks.push(nextBreak);
    }

    for (
      let centerY = studWidth / 2;
      centerY < wallHeight - studWidth / 2 - 0.001;
      centerY += studSpacing
    ) {
      studRowCenters.push(centerY);
    }
    studRowCenters.push(wallHeight - studWidth / 2);

    for (let rowIndex = 0; rowIndex < studRowCenters.length; rowIndex++) {
      const rowCenter = studRowCenters[rowIndex];

      for (let i = 0; i < segmentBreaks.length - 1; i++) {
        const segmentStart = segmentBreaks[i];
        const segmentEnd = segmentBreaks[i + 1];
        const segmentWidth = Math.max(segmentEnd - segmentStart, 0.001);
        const segmentCenter = segmentStart + segmentWidth / 2;

        result.push({
          key: `install-stud-${rowIndex}-${i}`,
          pos: [segmentCenter * MM, rowCenter * MM, layerCenterZ],
          size: [segmentWidth * MM, studWidthM, studDepthM],
        });
      }
    }

    for (let rowIndex = 0; rowIndex < studRowCenters.length - 1; rowIndex++) {
      const lowerStudCenter = studRowCenters[rowIndex];
      const upperStudCenter = studRowCenters[rowIndex + 1];
      const bayBottom = lowerStudCenter + studWidth / 2;
      const bayTop = upperStudCenter - studWidth / 2;
      const bayHeight = bayTop - bayBottom;

      if (bayHeight <= 1) {
        continue;
      }

      let xStart = coverageStart;
      let panelIndex = 0;
      while (xStart < coverageEnd - 0.001) {
        const panelWidth = Math.min(
          CAVITY_INSULATION_SHEET_HEIGHT,
          coverageEnd - xStart,
        );

        const yCenter = bayBottom + bayHeight / 2;
        result.push({
          key: `install-insulation-${rowIndex}-${panelIndex}`,
          pos: [(xStart + panelWidth / 2) * MM, yCenter * MM, layerCenterZ],
          size: [panelWidth * MM, bayHeight * MM, studDepthM],
          color: (rowIndex + panelIndex) % 2 === 0 ? "#d8bf72" : "#ccb165",
        });

        xStart += CAVITY_INSULATION_SHEET_HEIGHT;
        panelIndex += 1;
      }
    }

    return result;
  }, [maxStudLength, thickness, wall, wallHeight]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  if (thickness <= 0 || layer.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {layer.map((part) => (
        <group key={part.key} position={part.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={part.size} />
            {part.color ? (
              <meshStandardMaterial
                color={part.color}
                roughness={0.95}
                metalness={0}
              />
            ) : (
              <meshStandardMaterial
                map={pineTexture}
                color={STUD_COLOR}
                roughness={0.85}
              />
            )}
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...part.size)]} />
            <lineBasicMaterial
              color={part.color ? "#8d7341" : "#c8b08a"}
              linewidth={1}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Thin breathable membrane wrapped around the framing exterior */
function WallHouseWrap({
  wall,
  wallHeight,
}: {
  wall: Wall;
  wallHeight: number;
}) {
  const wrapMesh = useMemo(() => {
    const wrapLen = wall.centerlineLength * MM;
    const wrapThickness = HOUSE_WRAP_THICKNESS * MM;
    const framingDepth = wall.thickness * MM;
    const wallH = wallHeight * MM;
    const wrapStart = -wall.startCorner.retraction * MM;

    return {
      pos: [
        wrapStart + wrapLen / 2,
        wallH / 2,
        -(framingDepth / 2 + wrapThickness / 2),
      ] as [number, number, number],
      size: [wrapLen, wallH, wrapThickness] as [number, number, number],
    };
  }, [wall, wallHeight]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={wrapMesh.pos}>
        <mesh renderOrder={1}>
          <boxGeometry args={wrapMesh.size} />
          <meshStandardMaterial
            color="#e1e1e1"
            transparent
            opacity={0.85}
            roughness={0.9}
            metalness={0}
          />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(...wrapMesh.size)]} />
          <lineBasicMaterial color="#e1e1e1" linewidth={1} />
        </lineSegments>
      </group>
    </group>
  );
}

/** Thin vapor barrier on the interior face of the framing */
function WallVaporBarrier({
  wall,
  wallHeight,
}: {
  wall: Wall;
  wallHeight: number;
}) {
  const barrierMesh = useMemo(() => {
    const studThickness = wall.thickness * MM;
    const startOuterInset =
      wall.startCorner.joint === "through" &&
      wall.startCorner.interiorAngle <= Math.PI
        ? studThickness
        : 0;
    const endOuterInset =
      wall.endCorner.joint === "through" &&
      wall.endCorner.interiorAngle <= Math.PI
        ? studThickness
        : 0;
    const startInnerExtension =
      wall.startCorner.joint === "through" &&
      wall.startCorner.interiorAngle > Math.PI
        ? studThickness
        : 0;
    const endInnerExtension =
      wall.endCorner.joint === "through" &&
      wall.endCorner.interiorAngle > Math.PI
        ? studThickness
        : 0;
    const coverageStart = startOuterInset - startInnerExtension;
    const coverageEnd =
      wall.effectiveLength * MM - endOuterInset + endInnerExtension;
    const barrierLen = Math.max(coverageEnd - coverageStart, 0.001);
    const barrierThickness = HOUSE_WRAP_THICKNESS * MM;
    const framingDepth = wall.thickness * MM;
    const wallH = wallHeight * MM;

    return {
      pos: [
        coverageStart + barrierLen / 2,
        wallH / 2,
        framingDepth / 2 + barrierThickness / 2,
      ] as [number, number, number],
      size: [barrierLen, wallH, barrierThickness] as [number, number, number],
    };
  }, [wall, wallHeight]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={barrierMesh.pos}>
        <mesh renderOrder={1}>
          <boxGeometry args={barrierMesh.size} />
          <meshStandardMaterial
            color="#72c2ff"
            transparent
            opacity={0.4}
            roughness={0.9}
            metalness={0}
          />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(...barrierMesh.size)]} />
          <lineBasicMaterial color="#72c2ff" linewidth={1} />
        </lineSegments>
      </group>
    </group>
  );
}

/** Floor slab visualisation */
function FloorSlab({ layout }: { layout: WallLayout }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const corners = layout.outerCorners;
    shape.moveTo(corners[0].x * MM, corners[0].y * MM);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i].x * MM, corners[i].y * MM);
    }
    shape.closePath();

    const extrudeSettings = { depth: 0.15, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.15, 0);
    return geo;
  }, [layout]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#808080" roughness={0.9} />
    </mesh>
  );
}

/** Corner marker spheres (for visual debugging) */
function CornerMarkers({
  layout,
  showInner,
}: {
  layout: WallLayout;
  showInner: boolean;
}) {
  return (
    <group>
      {layout.outerCorners.map((c, i) => (
        <mesh key={`oc-${i}`} position={[c.x * MM, 0, -c.y * MM]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))}
      {showInner &&
        layout.innerCorners.map((c, i) => (
          <mesh key={`ic-${i}`} position={[c.x * MM, 0, -c.y * MM]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
        ))}
    </group>
  );
}

/** Wall label showing wall index, joint type, and effective length */
function WallLabels({
  layout,
  wallHeight,
}: {
  layout: WallLayout;
  wallHeight: number;
}) {
  return (
    <group>
      {layout.walls.map((w) => {
        const midX = ((w.quad.outerStart.x + w.quad.outerEnd.x) / 2) * MM;
        const midZ = -(((w.quad.outerStart.y + w.quad.outerEnd.y) / 2) * MM);
        const y = wallHeight * MM + 0.3;
        // Offset label slightly outward from the wall
        const offX = -w.inwardNormal.x * 0.3;
        const offZ = w.inwardNormal.y * 0.3; // flip Y→Z

        return (
          <group key={w.id} position={[midX + offX, y, midZ + offZ]}>
            <sprite scale={[1.2, 0.3, 1]}>
              <spriteMaterial
                map={createTextTexture(
                  `${w.id} [${w.startCorner.joint[0].toUpperCase()}/${w.endCorner.joint[0].toUpperCase()}] ${(w.effectiveLength / 1000).toFixed(2)}m`,
                )}
                transparent
              />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}

/** Create a text texture for sprite labels */
function createTextTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/** Dimension lines for a single wall — hidden when the wall doesn't face the camera */
function WallStudDimensions({ wall }: { wall: Wall }) {
  const groupRef = useRef<THREE.Group>(null);

  // Outward normal in 3D (opposite of inwardNormal)
  const outNormal = useMemo(
    () => new THREE.Vector3(-wall.inwardNormal.x, 0, wall.inwardNormal.y),
    [wall],
  );

  // Wall center on the floor plane (for dot-product test)
  const wallCenter = useMemo(() => {
    const q = wall.quad;
    const cx = ((q.outerStart.x + q.outerEnd.x) / 2) * MM;
    const cz = -(((q.outerStart.y + q.outerEnd.y) / 2) * MM);
    return new THREE.Vector3(cx, 0, cz);
  }, [wall]);

  const labelQuat = useMemo(() => {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const textUp = outNormal.clone().normalize();
    const textRight = new THREE.Vector3()
      .crossVectors(textUp, worldUp)
      .normalize();
    const basis = new THREE.Matrix4().makeBasis(textRight, textUp, worldUp);
    return new THREE.Quaternion().setFromRotationMatrix(basis);
  }, [outNormal]);

  const dims = useMemo(() => {
    const result: {
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      midPos: THREE.Vector3;
      label: string;
    }[] = [];

    if (wall.studLayout.studs.length < 2) return result;
    // Direction from wall.start (outer corner) to wall.end
    const wdx = (wall.end.x - wall.start.x) * MM;
    const wdz = -(wall.end.y - wall.start.y) * MM;
    const wlen = Math.sqrt(wdx * wdx + wdz * wdz);
    if (wlen < 0.001) return result;
    const ux = wdx / wlen;
    const uz = wdz / wlen;

    // Offset outward from the outer face
    const offset = 0.25;
    const offX = outNormal.x * offset;
    const offZ = outNormal.z * offset;

    // Origin = outer corner (wall.start) for positioning
    const ox = wall.start.x * MM + offX;
    const oz = -(wall.start.y * MM) + offZ;
    const retract = wall.startCorner.retraction;
    const y = 0.05;

    // c/c between consecutive studs (positions from outer corner)
    for (let si = 0; si < wall.studLayout.studs.length - 1; si++) {
      const s0 = retract + wall.studLayout.studs[si].centerPosition;
      const s1 = retract + wall.studLayout.studs[si + 1].centerPosition;
      const cc = Math.round(s1 - s0);

      const p0 = s0 * MM;
      const p1 = s1 * MM;

      const sx = ox + ux * p0;
      const sz = oz + uz * p0;
      const ex = ox + ux * p1;
      const ez = oz + uz * p1;

      result.push({
        startPos: new THREE.Vector3(sx, y, sz),
        endPos: new THREE.Vector3(ex, y, ez),
        midPos: new THREE.Vector3((sx + ex) / 2, y, (sz + ez) / 2),
        label: `${cc}`,
      });
    }
    return result;
  }, [wall, outNormal]);

  // Dashed line material (shared)
  const dashMat = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: "#000000" });
    return mat;
  }, []);

  // Each frame: show only when camera is on the outer side of the wall
  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const toCamera = new THREE.Vector3().subVectors(
      camera.position,
      wallCenter,
    );
    toCamera.y = 0;
    groupRef.current.visible = toCamera.dot(outNormal) > 0;
  });

  // Tick mark length (perpendicular to wall)
  const tickLen = 0.08;
  const labelGap = 0.24;

  return (
    <group ref={groupRef}>
      {dims.map((d, i) => {
        // Split the dimension line around the label so it stays readable.
        const dimDir = d.endPos.clone().sub(d.startPos);
        const dimLen = dimDir.length();
        if (dimLen < 0.001) return null;

        dimDir.normalize();
        const gapHalf = Math.min(labelGap / 2, dimLen * 0.3);
        const gapStart = d.midPos.clone().addScaledVector(dimDir, -gapHalf);
        const gapEnd = d.midPos.clone().addScaledVector(dimDir, gapHalf);

        const dashGeo = new THREE.BufferGeometry().setFromPoints([
          d.startPos,
          gapStart,
          gapEnd,
          d.endPos,
        ]);

        // Tick marks at start and end (perpendicular to wall along outward normal)
        const t1Start = d.startPos.clone().addScaledVector(outNormal, -tickLen);
        const t1End = d.startPos.clone().addScaledVector(outNormal, tickLen);
        const t2Start = d.endPos.clone().addScaledVector(outNormal, -tickLen);
        const t2End = d.endPos.clone().addScaledVector(outNormal, tickLen);

        const tick1Geo = new THREE.BufferGeometry().setFromPoints([
          t1Start,
          t1End,
        ]);
        const tick2Geo = new THREE.BufferGeometry().setFromPoints([
          t2Start,
          t2End,
        ]);

        const tickMat = new THREE.LineBasicMaterial({ color: "#000000" });
        const tick1 = new THREE.Line(tick1Geo, tickMat);
        const tick2 = new THREE.Line(tick2Geo, tickMat);

        return (
          <group key={i}>
            {/* Dimension line with label gap */}
            <lineSegments geometry={dashGeo} material={dashMat} />
            {/* Tick at start */}
            <primitive object={tick1} />
            {/* Tick at end */}
            <primitive object={tick2} />
            {/* Text label aligned with wall */}
            <group
              position={[
                d.midPos.x + outNormal.x * 0.02,
                d.midPos.y + 0.01,
                d.midPos.z + outNormal.z * 0.02,
              ]}
              quaternion={labelQuat}
            >
              {/* <mesh>
                <planeGeometry args={[0.4, 0.12]} />
                <meshBasicMaterial
                  color="#ffffff"
                  depthTest={false}
                  depthWrite={false}
                  side={THREE.DoubleSide}
                  toneMapped={false}
                  transparent
                  opacity={0.96}
                />
              </mesh> */}
              <Text
                position={[0, 0, 0.001]}
                fontSize={0.085}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                renderOrder={2}
                material-toneMapped={false}
                material-depthTest={false}
                material-depthWrite={false}
                rotation={[0, 0, Math.PI]}
              >
                {d.label}
              </Text>
            </group>
          </group>
        );
      })}
    </group>
  );
}

/** Stud spacing dimension lines — only visible for camera-facing walls */
function StudDimensions({ layout }: { layout: WallLayout }) {
  return (
    <group>
      {layout.walls.map((w) => (
        <WallStudDimensions key={w.id} wall={w} />
      ))}
    </group>
  );
}

/** The complete 3D model of a WallLayout */
function WallLayoutModel({
  framingLayout,
  shellLayout,
  wallHeight,
  outsideInsulation,
  installationLayer,
  installationLayerStudLength,
  showCavityInsulation,
  showHouseWrap,
  showVaporBarrier,
  showFraming,
  showVerticalTopPlate,
  showLabels,
  showCorners,
  showStudDimensions,
}: {
  framingLayout: WallLayout;
  shellLayout: WallLayout;
  wallHeight: number;
  outsideInsulation: number;
  installationLayer: number;
  installationLayerStudLength: number;
  showCavityInsulation: boolean;
  showHouseWrap: boolean;
  showVaporBarrier: boolean;
  showFraming: boolean;
  showVerticalTopPlate: boolean;
  showLabels: boolean;
  showCorners: boolean;
  showStudDimensions: boolean;
}) {
  return (
    <group>
      <FloorSlab layout={shellLayout} />

      {(showFraming ? framingLayout.walls : shellLayout.walls).map((w) =>
        showFraming ? (
          <WallFraming
            key={w.id}
            wall={w}
            wallHeight={wallHeight}
            showVerticalTopPlate={showVerticalTopPlate}
          />
        ) : (
          <WallSurface
            key={w.id}
            wall={w}
            wallHeight={wallHeight}
            color={WALL_SURFACE_COLOR}
          />
        ),
      )}

      {showFraming &&
        showCavityInsulation &&
        framingLayout.walls.map((w) => (
          <WallCavityInsulation
            key={`cavity-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            showVerticalTopPlate={showVerticalTopPlate}
          />
        ))}

      {showFraming &&
        showHouseWrap &&
        framingLayout.walls.map((w) => (
          <WallHouseWrap
            key={`wrap-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
          />
        ))}

      {showFraming &&
        showVaporBarrier &&
        framingLayout.walls.map((w) => (
          <WallVaporBarrier
            key={`vapor-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
          />
        ))}

      {showFraming &&
        installationLayer > 0 &&
        framingLayout.walls.map((w) => (
          <WallInstallationLayer
            key={`installation-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            thickness={installationLayer}
            maxStudLength={installationLayerStudLength}
          />
        ))}

      {outsideInsulation > 0 &&
        framingLayout.walls.map((w) => (
          <WallInsulationSheets
            key={`insulation-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            thickness={outsideInsulation}
          />
        ))}

      {showLabels && (
        <WallLabels
          layout={showFraming ? framingLayout : shellLayout}
          wallHeight={wallHeight}
        />
      )}
      {showCorners && (
        <CornerMarkers
          layout={showFraming ? framingLayout : shellLayout}
          showInner={showFraming}
        />
      )}
      {showStudDimensions && showFraming && (
        <StudDimensions layout={framingLayout} />
      )}
    </group>
  );
}

// ---- Main Scene Component ----

export default function WallLayoutScene() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [thickness, setThickness] = useState(145);
  const [studSpacing, setStudSpacing] = useState(600);
  const [outsideInsulationIndex, setOutsideInsulationIndex] = useState(0);
  const [installationLayerIndex, setInstallationLayerIndex] = useState(0);
  const [
    installationLayerStudLengthIndex,
    setInstallationLayerStudLengthIndex,
  ] = useState(INSTALLATION_LAYER_STUD_LENGTH_OPTIONS.length - 1);
  const [wallHeight, setWallHeight] = useState(WALL_HEIGHT);
  const [showFraming, setShowFraming] = useState(true);
  const [showHouseWrap, setShowHouseWrap] = useState(false);
  const [showVaporBarrier, setShowVaporBarrier] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showCorners, setShowCorners] = useState(false);
  const [showStudDimensions, setShowStudDimensions] = useState(true);
  const [showVerticalTopPlate, setShowVerticalTopPlate] = useState(false);
  const [showCavityInsulation, setShowCavityInsulation] = useState(false);
  const [cameraView, setCameraView] = useState<{
    key: number;
    position: [number, number, number];
    target: [number, number, number];
  }>({
    key: 0,
    position: [15, 10, 15],
    target: [0, 0, 0],
  });
  const outsideInsulation = OUTSIDE_INSULATION_OPTIONS[outsideInsulationIndex];
  const installationLayer = INSTALLATION_LAYER_OPTIONS[installationLayerIndex];
  const installationLayerStudLength =
    INSTALLATION_LAYER_STUD_LENGTH_OPTIONS[installationLayerStudLengthIndex];

  const baseOuterCorners = useMemo(() => {
    return PRESETS[presetIndex].create(thickness, studSpacing).outerCorners;
  }, [presetIndex, thickness, studSpacing]);

  const shellLayout = useMemo(() => {
    return new WallLayout(baseOuterCorners, {
      thickness: thickness + outsideInsulation,
      studSpacing,
      studDepth: thickness,
    });
  }, [baseOuterCorners, outsideInsulation, studSpacing, thickness]);

  const framingOuterCorners = useMemo(() => {
    if (outsideInsulation === 0) return baseOuterCorners;
    return new WallLayout(baseOuterCorners, {
      thickness: outsideInsulation,
      studSpacing,
    }).innerCorners;
  }, [baseOuterCorners, outsideInsulation, studSpacing]);

  const layout = useMemo(() => {
    return new WallLayout(framingOuterCorners, {
      thickness,
      studSpacing,
      studDepth: thickness,
    });
  }, [framingOuterCorners, studSpacing, thickness]);

  // Camera target: center of the building footprint
  const cameraTarget = useMemo(() => {
    const corners = layout.outerCorners;
    let cx = 0,
      cy = 0;
    for (const c of corners) {
      cx += c.x;
      cy += c.y;
    }
    cx = (cx / corners.length) * MM;
    cy = (cy / corners.length) * MM;
    return [cx, 1, -cy] as [number, number, number];
  }, [layout]);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-900">
      {/* Sidebar controls */}
      <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-zinc-800/60 backdrop-blur border-b lg:border-b-0 lg:border-r border-zinc-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700">
          <h1 className="text-lg font-bold text-white">Väggplanering</h1>
          <p className="text-xs text-zinc-400">Nytt vägglayout-system</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Preset selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Byggnadsform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setPresetIndex(i)}
                  className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                    i === presetIndex
                      ? "bg-amber-400/90 text-zinc-900 font-medium"
                      : "bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div
                    className={
                      i === presetIndex ? "text-zinc-700" : "text-zinc-500"
                    }
                  >
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Stud width */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Stud width: {thickness} mm
            </label>
            <input
              type="range"
              min={95}
              max={220}
              step={25}
              value={thickness}
              onChange={(e) => setThickness(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>95mm</span>
              <span>120mm</span>
              <span>145mm</span>
              <span>195mm</span>
              <span>220mm</span>
            </div>
          </div>

          {/* Stud spacing */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Regelavstånd (c/c): {studSpacing} mm
            </label>
            <input
              type="range"
              min={300}
              max={900}
              step={50}
              value={studSpacing}
              onChange={(e) => setStudSpacing(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>300</span>
              <span>450</span>
              <span>600</span>
              <span>900</span>
            </div>
          </div>

          {/* Outside insulation */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Outside insulation: {outsideInsulation} mm
            </label>
            <input
              type="range"
              min={0}
              max={OUTSIDE_INSULATION_OPTIONS.length - 1}
              step={1}
              value={outsideInsulationIndex}
              onChange={(e) =>
                setOutsideInsulationIndex(Number(e.target.value))
              }
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              {OUTSIDE_INSULATION_OPTIONS.map((value) => (
                <span key={value}>{value}mm</span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Installationsskikt: {installationLayer} mm
            </label>
            <input
              type="range"
              min={0}
              max={INSTALLATION_LAYER_OPTIONS.length - 1}
              step={1}
              value={installationLayerIndex}
              onChange={(e) =>
                setInstallationLayerIndex(Number(e.target.value))
              }
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              {INSTALLATION_LAYER_OPTIONS.map((value) => (
                <span key={value}>{value}mm</span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Längd reglar för installationsskikt: {installationLayerStudLength}{" "}
              mm
            </label>
            <input
              type="range"
              min={0}
              max={INSTALLATION_LAYER_STUD_LENGTH_OPTIONS.length - 1}
              step={1}
              value={installationLayerStudLengthIndex}
              onChange={(e) =>
                setInstallationLayerStudLengthIndex(Number(e.target.value))
              }
              className="w-full accent-amber-400"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              {INSTALLATION_LAYER_STUD_LENGTH_OPTIONS.map((value) => (
                <span key={value}>{value}</span>
              ))}
            </div>
          </div>

          {/* Wall height */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Vägghöjd: {(wallHeight / 1000).toFixed(1)} m
            </label>
            <input
              type="range"
              min={2400}
              max={4000}
              step={100}
              value={wallHeight}
              onChange={(e) => setWallHeight(Number(e.target.value))}
              className="w-full accent-amber-400"
            />
          </div>

          {/* View toggles */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Visning
            </label>
            <div className="space-y-2">
              {[
                {
                  label: "Stomme",
                  checked: showFraming,
                  toggle: () => setShowFraming((v) => !v),
                },
                {
                  label: "Stående hammarband",
                  checked: showVerticalTopPlate,
                  toggle: () => setShowVerticalTopPlate((v) => !v),
                },
                {
                  label: "Isolering mellan reglar",
                  checked: showCavityInsulation,
                  toggle: () => setShowCavityInsulation((v) => !v),
                },
                {
                  label: "House wrap",
                  checked: showHouseWrap,
                  toggle: () => setShowHouseWrap((v) => !v),
                },
                {
                  label: "Vapor barrier",
                  checked: showVaporBarrier,
                  toggle: () => setShowVaporBarrier((v) => !v),
                },
                {
                  label: "Väggetiketter",
                  checked: showLabels,
                  toggle: () => setShowLabels((v) => !v),
                },
                {
                  label: "Hörnpunkter",
                  checked: showCorners,
                  toggle: () => setShowCorners((v) => !v),
                },
                {
                  label: "Regelmått",
                  checked: showStudDimensions,
                  toggle: () => setShowStudDimensions((v) => !v),
                },
              ].map((opt) => (
                <label
                  key={opt.label}
                  className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={opt.checked}
                    onChange={opt.toggle}
                    className="accent-amber-400"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          {/* Layout info */}
          <div className="p-3 bg-zinc-700/30 rounded-lg space-y-1">
            <h3 className="text-sm font-medium text-zinc-300">Layoutinfo</h3>
            <div className="text-xs text-zinc-400 space-y-0.5">
              <div>Antal väggar: {layout.count}</div>
              <div>Outside insulation: {outsideInsulation} mm</div>
              <div>
                Ytterperimeter:{" "}
                {(
                  layout.walls.reduce((sum, w) => sum + w.centerlineLength, 0) /
                  1000
                ).toFixed(2)}{" "}
                m
              </div>
              <div>
                Effektiv vägglängd:{" "}
                {(
                  layout.walls.reduce((sum, w) => sum + w.effectiveLength, 0) /
                  1000
                ).toFixed(2)}{" "}
                m
              </div>
              <div>
                Totalt antal reglar:{" "}
                {layout.walls.reduce(
                  (sum, w) => sum + w.studLayout.studs.length,
                  0,
                )}
              </div>
            </div>

            {/* Per-wall breakdown */}
            <div className="mt-2 pt-2 border-t border-zinc-600">
              <h4 className="text-xs font-medium text-zinc-400 mb-1">
                Per vägg
              </h4>
              {layout.walls.map((w) => (
                <div
                  key={w.id}
                  className="text-xs text-zinc-500 flex justify-between"
                >
                  <span>
                    {w.id}{" "}
                    <span className="text-zinc-600">
                      [{w.startCorner.joint[0].toUpperCase()}/
                      {w.endCorner.joint[0].toUpperCase()}]
                    </span>
                  </span>
                  <span>
                    {(w.effectiveLength / 1000).toFixed(2)}m ·{" "}
                    {w.studLayout.studs.length} st · c/c{" "}
                    {w.studLayout.actualSpacing.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* 3D Viewport */}
      <main className="flex-1 relative min-h-100">
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          className="w-full h-full"
        >
          <color attach="background" args={["#ffffff"]} />
          <PerspectiveCamera
            key={`camera-${cameraView.key}`}
            makeDefault
            position={cameraView.position}
            fov={50}
          />
          <OrbitControls
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

          {/* Lighting */}
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

          <WallLayoutModel
            framingLayout={layout}
            shellLayout={shellLayout}
            wallHeight={wallHeight}
            outsideInsulation={outsideInsulation}
            installationLayer={installationLayer}
            installationLayerStudLength={installationLayerStudLength}
            showCavityInsulation={showCavityInsulation}
            showHouseWrap={showHouseWrap}
            showVaporBarrier={showVaporBarrier}
            showFraming={showFraming}
            showVerticalTopPlate={showVerticalTopPlate}
            showLabels={showLabels}
            showCorners={showCorners}
            showStudDimensions={showStudDimensions}
          />

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

        {/* Viewport help */}
        <div className="absolute bottom-4 left-4 flex items-center gap-2">
          <div className="text-xs text-zinc-500 bg-white/70 backdrop-blur rounded px-2 py-1">
            Dra för att rotera · Scrolla för att zooma · Högerklick för att
            panorera
          </div>
          <button
            onClick={() =>
              setCameraView((view) => ({
                key: view.key + 1,
                position: [
                  cameraTarget[0] + 15,
                  cameraTarget[1] + 9,
                  cameraTarget[2] + 15,
                ],
                target: cameraTarget,
              }))
            }
            className="rounded bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur transition-colors hover:bg-white/90"
          >
            Centrera
          </button>
        </div>
      </main>
    </div>
  );
}
