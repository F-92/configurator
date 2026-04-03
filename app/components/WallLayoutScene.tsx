"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
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
import type { Wall, WallOpening } from "../lib/wallLayout";
import {
  computeOpeningFraming,
  subtractOpeningsFromRect,
  mapOpeningsToWall,
  splitHorizontalSpan,
  splitVerticalSpan,
} from "../lib/wallLayout/openings";
import { getOsbTexture, getPineTexture } from "../lib/woodTexture";
import { buildParametricLayout } from "../lib/wallLayout/parametric";
import type {
  ParametricWall,
  LayerDef,
  ResolvedLayer,
} from "../lib/wallLayout/parametric";

// ---- Constants ----
const MM = 0.001; // mm → meters for Three.js
const WALL_HEIGHT = 2700; // mm
const PLATE_HEIGHT = 45; // mm
const VERTICAL_PLATE_THICKNESS = 45; // mm
const VERTICAL_PLATE_HEIGHT = 195; // mm
const STUD_COLOR = "#f5e6c8";
const PRIMED_PANEL_COLOR = "#f4f3ee";
const PRIMED_PANEL_BASE_COLOR = "#ebe9e0";
const WALL_SURFACE_COLOR = "#dfc4a0";
const OUTSIDE_INSULATION_OPTIONS = [0, 30, 50, 80, 95] as const;
const INSTALLATION_LAYER_OPTIONS = [0, 45, 70] as const;
const INSTALLATION_LAYER_STUD_LENGTH_OPTIONS = [
  2400, 3000, 3600, 4200,
] as const;
const OSB_BOARD_WIDTH = 1200; // mm
const OSB_BOARD_HEIGHT = 2700; // mm
const OSB_BOARD_THICKNESS = 11; // mm
const DRYWALL_BOARD_WIDTH = 1200; // mm
const DRYWALL_BOARD_HEIGHT = 2700; // mm
const DRYWALL_BOARD_THICKNESS = 13; // mm
const INSULATION_SHEET_WIDTH = 1200; // mm
const INSULATION_SHEET_HEIGHT = 2700; // mm
const CAVITY_INSULATION_SHEET_HEIGHT = 1170; // mm
const OUTSIDE_DRYWALL_THICKNESS = 9; // mm vindskyddsskiva
const HOUSE_WRAP_THICKNESS = 2; // mm visual membrane thickness
const FACADE_AIR_GAP = 25; // mm ventilated cavity behind cladding
const SPIKLAKT_THICKNESS = 25; // mm horizontal battens creating the air gap
const SPIKLAKT_HEIGHT = 48; // mm batten face height
const SPIKLAKT_SPACING = 600; // mm vertical spacing between horizontal battens
const YTTERPANEL_THICKNESS = 22; // mm timber cladding thickness
const YTTERPANEL_BOARD_WIDTH = 145; // mm total board width
const YTTERPANEL_VISIBLE_WIDTH = 127; // mm mounted cover width for 22x145 falsad sparpanel
const YTTERPANEL_OVERLAP_WIDTH = 18; // mm front lip covering the next board joint
const YTTERPANEL_FALSE_WIDTH = 28; // mm relieved false on the opposite edge
const YTTERPANEL_RABBET_DEPTH = 11; // mm complementary half-lap depth per edge
const YTTERPANEL_FALSE_FACE_ANGLE = 25; // degrees from the front face on both profile shoulders
const YTTERPANEL_FACE_CHAMFER = 2; // mm visible chamfer on both front board edges
const YTTERPANEL_SEAM_SHADOW_WIDTH = 3; // mm subtle visible reveal between boards
const YTTERPANEL_SEAM_SHADOW_DEPTH = 0.8; // mm thin shadow strip kept flush to the face
const MUSBAND_HEIGHT = 20; // mm starter leg height against the wall
const MUSBAND_THICKNESS = 1; // mm sheet metal thickness
const MUSBAND_PROJECTION = 50; // mm outward projection from the wall via the comb teeth
const MUSBAND_COMB_TOOTH_WIDTH = 4; // mm
const MUSBAND_COMB_GAP_WIDTH = 4; // mm
const MUSBAND_FLANGE_TILT = (-15 * Math.PI) / 180; // slight tilt from a perfect 90-degree bend

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

// ---- Layer Edge Compatibility ----
// The parametric system computes all layer data.  These types provide
// backward-compatible access so existing rendering components don't
// need to change their internal data access patterns.

interface LayerEdge {
  coverageStart: number;
  coverageEnd: number;
  outerFaceZ: number;
  innerFaceZ: number;
  centerZ: number;
  depthM: number;
}

interface WallLayerEdges {
  framing: LayerEdge;
  outsideDrywall: LayerEdge;
  outsideInsulation: LayerEdge;
  weatherSurface: LayerEdge;
  spiklakt: LayerEdge;
  panel: LayerEdge;
}

/**
 * Minimal interface matching the `WallLayout` class shape.
 * Components only use `.walls`, `.outerCorners`, `.innerCorners`.
 */
interface LayoutLike {
  walls: Wall[];
  outerCorners: { x: number; y: number }[];
  innerCorners: { x: number; y: number }[];
}

function resolvedLayerToEdge(layer: ResolvedLayer): LayerEdge {
  return {
    coverageStart: layer.coverageStart,
    coverageEnd: layer.coverageEnd,
    outerFaceZ: layer.outerFaceZ,
    innerFaceZ: layer.innerFaceZ,
    centerZ: layer.centerZ,
    depthM: layer.depthM,
  };
}

function wallLayerEdgesFromParametric(wall: ParametricWall): WallLayerEdges {
  const get = (id: string): LayerEdge => {
    const layer = wall.layers[id];
    if (layer) return resolvedLayerToEdge(layer);
    // Fallback: zero-size edge at framing outer face
    const framingLayer = wall.layers["framing"];
    return {
      coverageStart: framingLayer?.coverageStart ?? 0,
      coverageEnd: framingLayer?.coverageEnd ?? 0,
      outerFaceZ: framingLayer?.outerFaceZ ?? 0,
      innerFaceZ: framingLayer?.outerFaceZ ?? 0,
      centerZ: framingLayer?.outerFaceZ ?? 0,
      depthM: 0,
    };
  };

  // weatherSurface is a virtual combined layer spanning outsideDrywall + outsideInsulation
  const drywall = get("outsideDrywall");
  const insulation = get("outsideInsulation");
  const hasWeather = drywall.depthM > 0 || insulation.depthM > 0;
  const weatherSurface: LayerEdge = hasWeather
    ? {
        coverageStart: Math.min(
          drywall.coverageStart,
          insulation.coverageStart,
        ),
        coverageEnd: Math.max(drywall.coverageEnd, insulation.coverageEnd),
        outerFaceZ: Math.min(drywall.outerFaceZ, insulation.outerFaceZ),
        innerFaceZ: Math.max(drywall.innerFaceZ, insulation.innerFaceZ),
        centerZ:
          (Math.min(drywall.outerFaceZ, insulation.outerFaceZ) +
            Math.max(drywall.innerFaceZ, insulation.innerFaceZ)) /
          2,
        depthM: Math.abs(
          Math.min(drywall.outerFaceZ, insulation.outerFaceZ) -
            Math.max(drywall.innerFaceZ, insulation.innerFaceZ),
        ),
      }
    : drywall;

  return {
    framing: get("framing"),
    outsideDrywall: drywall,
    outsideInsulation: insulation,
    weatherSurface,
    spiklakt: get("spiklakt"),
    panel: get("panel"),
  };
}

/**
 * Compute horizontal coverage range for an exterior layer at the given
 * thickness.  Uses the wall's corner-joint data so components that don't
 * receive pre-computed layer edges can still determine their own coverage.
 */
function getExteriorCoverageRange(wall: Wall, layerThicknessMm: number) {
  const startOuterCornerOffset = -wall.startCorner.retraction;
  const startConvexExtension =
    wall.startCorner.interiorAngle <= Math.PI &&
    wall.startCorner.joint === "butt"
      ? layerThicknessMm
      : 0;
  const endConvexExtension =
    wall.endCorner.interiorAngle <= Math.PI && wall.endCorner.joint === "butt"
      ? layerThicknessMm
      : 0;
  const startReflexInset =
    wall.startCorner.interiorAngle > Math.PI &&
    wall.startCorner.joint === "butt"
      ? layerThicknessMm
      : 0;
  const endReflexInset =
    wall.endCorner.interiorAngle > Math.PI && wall.endCorner.joint === "butt"
      ? layerThicknessMm
      : 0;

  return {
    coverageStart:
      startOuterCornerOffset - startConvexExtension + startReflexInset,
    coverageEnd:
      startOuterCornerOffset +
      wall.centerlineLength +
      endConvexExtension -
      endReflexInset,
  };
}

function createMusbandTeeth(length: number) {
  const toothWidth = MUSBAND_COMB_TOOTH_WIDTH * MM;
  const preferredGap = MUSBAND_COMB_GAP_WIDTH * MM;

  if (length <= toothWidth + 0.001) {
    return [
      { key: "tooth-0", centerX: 0, width: Math.min(length, toothWidth) },
    ];
  }

  const toothCount = Math.max(
    2,
    Math.floor((length + preferredGap) / (toothWidth + preferredGap)),
  );
  const totalToothWidth = toothCount * toothWidth;
  const gapCount = toothCount - 1;
  const distributedGap =
    gapCount > 0 ? (length - totalToothWidth) / gapCount : 0;
  const startCenter = -length / 2 + toothWidth / 2;

  return Array.from({ length: toothCount }, (_, index) => ({
    key: `tooth-${index}`,
    centerX: startCenter + index * (toothWidth + distributedGap),
    width: toothWidth,
  }));
}

function hashSeed(seed: string) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getDeterministicUnitValue(seed: string) {
  return hashSeed(seed) / 4294967295;
}

function cloneTextureWithLengthwiseOffset(
  texture: THREE.Texture,
  seed: string,
  axis: "x" | "y",
) {
  const clone = texture.clone();
  const offset = getDeterministicUnitValue(`${seed}-offset`);

  clone.wrapS = texture.wrapS;
  clone.wrapT = texture.wrapT;
  clone.repeat.copy(texture.repeat);
  clone.offset.copy(texture.offset);
  clone.center.copy(texture.center);
  clone.rotation = texture.rotation;
  clone.flipY = texture.flipY;
  clone.colorSpace = texture.colorSpace;

  if (axis === "x") {
    clone.offset.x = THREE.MathUtils.euclideanModulo(
      clone.offset.x + offset,
      1,
    );
  } else {
    clone.offset.y = THREE.MathUtils.euclideanModulo(
      clone.offset.y + offset,
      1,
    );
  }

  clone.needsUpdate = true;
  return clone;
}

function getSubtleWoodColor(seed: string) {
  const color = new THREE.Color(STUD_COLOR);
  const lightnessOffset =
    (getDeterministicUnitValue(`${seed}-lightness`) - 0.5) * 0.1;
  color.offsetHSL(0, 0, lightnessOffset);
  return `#${color.getHexString()}`;
}

function getSubtleWoodRoughness(seed: string) {
  return 0.78 + getDeterministicUnitValue(`${seed}-roughness`) * 0.14;
}

function getSubtlePaintColor(seed: string) {
  const color = new THREE.Color(PRIMED_PANEL_COLOR);
  const saturationOffset =
    (getDeterministicUnitValue(`${seed}-paint-saturation`) - 0.5) * 0.006;
  const lightnessOffset =
    (getDeterministicUnitValue(`${seed}-paint-lightness`) - 0.5) * 0.02;
  color.offsetHSL(0, saturationOffset, lightnessOffset);
  return `#${color.getHexString()}`;
}

function getSubtlePaintOpacity(seed: string) {
  return 0.9 + getDeterministicUnitValue(`${seed}-paint-opacity`) * 0.06;
}

function createYtterpanelBoardGeometry({
  boardWidth,
  wallHeight,
  thickness,
  leftLapWidth,
  rightLapWidth,
  rabbetDepth,
  falseFaceAngle,
  faceChamfer,
}: {
  boardWidth: number;
  wallHeight: number;
  thickness: number;
  leftLapWidth: number;
  rightLapWidth: number;
  rabbetDepth: number;
  falseFaceAngle: number;
  faceChamfer: number;
}) {
  const clampedWidth = Math.max(boardWidth, 0.001);
  const clampedThickness = Math.max(thickness, 0.001);
  const clampedRabbetDepth = Math.min(rabbetDepth, clampedThickness);
  const clampedLeftLap = Math.min(leftLapWidth, clampedWidth);
  const clampedRightLap = Math.min(
    rightLapWidth,
    Math.max(clampedWidth - clampedLeftLap, 0),
  );
  const frontRightX = clampedWidth - clampedRightLap;
  const falseFaceAngleRadians = THREE.MathUtils.degToRad(
    Math.max(falseFaceAngle, 0.001),
  );
  const clampedFaceChamfer = Math.min(
    faceChamfer,
    clampedThickness / 2,
    clampedWidth / 4,
  );
  const profileHeightDelta = Math.max(
    clampedThickness - clampedRabbetDepth - clampedFaceChamfer,
    0,
  );
  const slopeRunFromFace = profileHeightDelta * Math.tan(falseFaceAngleRadians);
  const leftSlopeTopX = Math.min(slopeRunFromFace, frontRightX);
  const rightSlopeTopX = Math.max(
    frontRightX - Math.min(slopeRunFromFace, frontRightX),
    leftSlopeTopX,
  );
  const leftFaceStartX = Math.min(
    leftSlopeTopX + clampedFaceChamfer,
    rightSlopeTopX,
  );
  const rightFaceEndX = Math.max(
    rightSlopeTopX - clampedFaceChamfer,
    leftFaceStartX,
  );
  const chamferBaseY = Math.max(clampedThickness - clampedFaceChamfer, 0);

  const profile = new THREE.Shape();

  if (clampedLeftLap > 0) {
    profile.moveTo(0, clampedRabbetDepth);
    profile.lineTo(leftSlopeTopX, chamferBaseY);
    profile.lineTo(leftFaceStartX, clampedThickness);
  } else {
    profile.moveTo(0, 0);
    profile.lineTo(0, chamferBaseY);
    profile.lineTo(clampedFaceChamfer, clampedThickness);
  }

  if (clampedRightLap > 0) {
    profile.lineTo(rightFaceEndX, clampedThickness);
    profile.lineTo(rightSlopeTopX, chamferBaseY);
    profile.lineTo(frontRightX, clampedRabbetDepth);
    profile.lineTo(clampedWidth, clampedRabbetDepth);
    profile.lineTo(clampedWidth, 0);
  } else {
    profile.lineTo(clampedWidth - clampedFaceChamfer, clampedThickness);
    profile.lineTo(clampedWidth, chamferBaseY);
    profile.lineTo(clampedWidth, 0);
  }

  if (clampedLeftLap > 0) {
    profile.lineTo(clampedLeftLap, 0);
    profile.lineTo(clampedLeftLap, clampedThickness - clampedRabbetDepth);
  } else {
    profile.lineTo(0, 0);
  }

  profile.closePath();

  const geometry = new THREE.ExtrudeGeometry(profile, {
    depth: wallHeight,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);

  return geometry;
}

function createLiggandeYtterpanelBoardGeometry({
  boardHeight,
  wallLength,
  thickness,
  leftLapWidth,
  rightLapWidth,
  rabbetDepth,
  falseFaceAngle,
  faceChamfer,
}: {
  boardHeight: number;
  wallLength: number;
  thickness: number;
  leftLapWidth: number;
  rightLapWidth: number;
  rabbetDepth: number;
  falseFaceAngle: number;
  faceChamfer: number;
}) {
  const geometry = createYtterpanelBoardGeometry({
    boardWidth: boardHeight,
    wallHeight: wallLength,
    thickness,
    leftLapWidth,
    rightLapWidth,
    rabbetDepth,
    falseFaceAngle,
    faceChamfer,
  });

  geometry.rotateZ(Math.PI / 2);
  geometry.translate(wallLength, 0, 0);

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
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  showVerticalTopPlate: boolean;
  openings: WallOpening[];
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

    // Compute opening framing
    const openingFramings = openings.map((o) =>
      computeOpeningFraming(
        o,
        wall.studLayout.studs,
        wall.effectiveLength,
        wallHeight,
        studW,
        studD,
      ),
    );
    const removedIndices = new Set(
      openingFramings.flatMap((f) => f.removedStudIndices),
    );

    // Bottom plate — split around door openings (bottom ≈ 0)
    const doorOpenings = openings.filter((o) => o.bottom < PLATE_HEIGHT + 1);
    if (doorOpenings.length === 0) {
      result.push({
        key: "bp",
        pos: [effLen / 2, plateH / 2, 0],
        size: [effLen, plateH, studDM],
      });
    } else {
      const plateSpans = splitHorizontalSpan(
        0,
        wall.effectiveLength,
        0,
        PLATE_HEIGHT,
        doorOpenings,
      );
      for (let si = 0; si < plateSpans.length; si++) {
        const span = plateSpans[si];
        const spanW = (span.end - span.start) * MM;
        result.push({
          key: `bp-${si}`,
          pos: [((span.start + span.end) / 2) * MM, plateH / 2, 0],
          size: [spanW, plateH, studDM],
        });
      }
    }

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

    // Studs — skip removed ones
    for (let i = 0; i < wall.studLayout.studs.length; i++) {
      if (removedIndices.has(i)) continue;
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

    // Opening framing members (trimmers, headers, sills, cripples)
    for (const framing of openingFramings) {
      for (const member of framing.members) {
        const k = `of-${framing.opening.id}-${member.type}-${Math.round(member.centerX)}`;
        const wM = member.width * MM;
        const hM = member.height * MM;
        const dM = member.depth * MM;

        // Trimmers and cripple-above studs touch the top plate and need
        // the notch when stående hammarband is active.
        const needsNotch =
          verticalPlateH > 0 &&
          notchedStudGeometry &&
          (member.type === "trimmer" || member.type === "cripple-above");

        if (needsNotch) {
          const geo = createNotchedStudGeometry(
            wM,
            hM,
            dM,
            verticalPlateH,
            verticalPlateD,
          );
          result.push({
            key: k,
            pos: [member.centerX * MM, member.centerY * MM, 0],
            geometry: geo,
          });
        } else {
          result.push({
            key: k,
            pos: [member.centerX * MM, member.centerY * MM, 0],
            size: [wM, hM, dM],
          });
        }
      }
    }

    // California corner studs stay full height
    for (let i = 0; i < wall.studLayout.cornerStuds.length; i++) {
      const cs = wall.studLayout.cornerStuds[i];
      const x = cs.centerPosition * MM;
      const halfDepth = (studD / 2) * MM;
      const halfStudW = (studW / 2) * MM;
      const zOffset =
        cs.offsetSide === "inner"
          ? halfDepth - halfStudW
          : -(halfDepth - halfStudW);
      result.push({
        key: `cs-${i}`,
        pos: [x, plateH + fullStudH / 2, zOffset],
        size: [studDM, fullStudH, studWM],
      });
    }

    return result;
  }, [showVerticalTopPlate, wall, wallHeight, openings]);

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

/** Outside drywall (vindskyddsskiva) – sits flush against the exterior face of the framing */
function WallOutsideDrywall({
  wall,
  wallHeight,
  layerEdges,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
}) {
  const boards = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];

    const edge = layerEdges.outsideDrywall;
    const { coverageStart, coverageEnd, centerZ, depthM } = edge;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const boardHeight = Math.min(DRYWALL_BOARD_HEIGHT, wallHeight - yStart);
      let xStart = coverageStart;
      let colIndex = 0;

      while (xStart < coverageEnd - 0.001) {
        const boardWidth = Math.min(DRYWALL_BOARD_WIDTH, coverageEnd - xStart);

        const pieces = subtractOpeningsFromRect(
          xStart,
          yStart,
          boardWidth,
          boardHeight,
          openings,
        );
        for (let pi = 0; pi < pieces.length; pi++) {
          const p = pieces[pi];
          result.push({
            key: `outside-drywall-${rowIndex}-${colIndex}-${pi}`,
            pos: [(p.x + p.w / 2) * MM, (p.y + p.h / 2) * MM, centerZ],
            size: [p.w * MM, p.h * MM, depthM],
            color: (rowIndex + colIndex + pi) % 2 === 0 ? "#e8e4da" : "#ddd8cd",
          });
        }

        xStart += DRYWALL_BOARD_WIDTH;
        colIndex += 1;
      }

      yStart += DRYWALL_BOARD_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [layerEdges, wallHeight, openings]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  if (boards.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {boards.map((board) => (
        <group key={board.key} position={board.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={board.size} />
            <meshStandardMaterial
              color={board.color}
              roughness={0.92}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...board.size)]} />
            <lineBasicMaterial color="#b8b2a6" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Exterior insulation rendered as ROCKWOOL-like sheets, projected outward from the framing wall */
function WallInsulationSheets({
  wall,
  wallHeight,
  thickness,
  layerEdges,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  thickness: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
}) {
  const sheets = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];

    if (thickness <= 0) return result;

    const wallHeightMm = wallHeight;
    const edge = layerEdges.outsideInsulation;
    const { coverageStart, coverageEnd, centerZ: zCenter, depthM } = edge;

    // Align insulation sheet joints to the stud grid so joints land on
    // stud centers.  The first sheet is cut shorter if coverageStart
    // doesn't fall on a grid line.
    const studWidth = wall.studLayout.studs[0]?.width ?? 45;
    const studSpacing = wall.studLayout.targetSpacing;
    const firstStudGrid =
      Math.ceil(
        (wall.startCorner.retraction + studWidth / 2 + 0.001) / studSpacing,
      ) * studSpacing;
    const studGridOrigin = firstStudGrid - wall.startCorner.retraction;

    // Find the first grid-aligned sheet edge at or before coverageStart
    const gridAlignedStart =
      Math.floor((coverageStart - studGridOrigin) / INSULATION_SHEET_WIDTH) *
        INSULATION_SHEET_WIDTH +
      studGridOrigin;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeightMm - 0.001) {
      const sheetHeight = Math.min(
        INSULATION_SHEET_HEIGHT,
        wallHeightMm - yStart,
      );
      let sheetIndex = 0;

      while (true) {
        const rawStart = gridAlignedStart + sheetIndex * INSULATION_SHEET_WIDTH;
        const rawEnd = rawStart + INSULATION_SHEET_WIDTH;

        if (rawStart >= coverageEnd - 0.001) break;

        const clippedStart = Math.max(rawStart, coverageStart);
        const clippedEnd = Math.min(rawEnd, coverageEnd);
        const sheetWidth = clippedEnd - clippedStart;

        if (sheetWidth <= 0.001) {
          sheetIndex += 1;
          continue;
        }

        const pieces = subtractOpeningsFromRect(
          clippedStart,
          yStart,
          sheetWidth,
          sheetHeight,
          openings,
        );
        for (let pi = 0; pi < pieces.length; pi++) {
          const p = pieces[pi];
          result.push({
            key: `ins-${rowIndex}-${sheetIndex}-${pi}`,
            pos: [(p.x + p.w / 2) * MM, (p.y + p.h / 2) * MM, zCenter],
            size: [p.w * MM, p.h * MM, depthM],
            color:
              (rowIndex + sheetIndex + pi) % 2 === 0 ? "#8f7650" : "#9b8159",
          });
        }

        sheetIndex += 1;
      }

      yStart += INSULATION_SHEET_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [openings, layerEdges, thickness, wall, wallHeight]);

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
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  showVerticalTopPlate: boolean;
  openings: WallOpening[];
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

    // Expand openings to include trimmers, header, and sill so insulation
    // doesn't overlap framing members around the opening
    const expandedOpenings: WallOpening[] = openings.map((o) => {
      const expandedBottom = Math.max(o.bottom - studWidth, 0);
      const expandedTop = o.bottom + o.height + studWidth;
      return {
        ...o,
        left: o.left - studWidth,
        bottom: expandedBottom,
        width: o.width + studWidth * 2,
        height: expandedTop - expandedBottom,
      };
    });

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

          // Skip panels that overlap an opening (expanded to include framing)
          const pieces = subtractOpeningsFromRect(
            panelStart,
            rowStart,
            panelWidth,
            panelHeight,
            expandedOpenings,
          );
          if (
            pieces.length === 1 &&
            Math.abs(pieces[0].w - panelWidth) < 1 &&
            Math.abs(pieces[0].h - panelHeight) < 1
          ) {
            // No overlap — render full panel
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
          } else {
            // Partial overlap — render remaining pieces as simple boxes
            for (let pi = 0; pi < pieces.length; pi++) {
              const p = pieces[pi];
              result.push({
                key: `cavity-${i}-${rowIndex}-${panelIndex}-p${pi}`,
                pos: [(p.x + p.w / 2) * MM, (p.y + p.h / 2) * MM, zCenter],
                size: [p.w * MM, p.h * MM, panelDepth],
                geometry: undefined,
                color:
                  (rowIndex + panelIndex + pi) % 2 === 0
                    ? "#d8bf72"
                    : "#ccb165",
              });
            }
          }
        }

        rowStart += CAVITY_INSULATION_SHEET_HEIGHT;
        rowIndex += 1;
      }
    }

    return result;
  }, [showVerticalTopPlate, wall, wallHeight, openings]);

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
  framingWall,
  wallHeight,
  thickness,
  maxStudLength,
  openings,
}: {
  wall: Wall;
  framingWall: Wall;
  wallHeight: number;
  thickness: number;
  maxStudLength: number;
  openings: WallOpening[];
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
    const layerCenterZ = 0;
    const framingOrigin = {
      x: (framingWall.quad.outerStart.x + framingWall.quad.innerStart.x) / 2,
      y: (framingWall.quad.outerStart.y + framingWall.quad.innerStart.y) / 2,
    };
    const layerOrigin = {
      x: (wall.quad.outerStart.x + wall.quad.innerStart.x) / 2,
      y: (wall.quad.outerStart.y + wall.quad.innerStart.y) / 2,
    };
    const startOffset =
      (layerOrigin.x - framingOrigin.x) * framingWall.direction.x +
      (layerOrigin.y - framingOrigin.y) * framingWall.direction.y;
    const coverageStart = 0;
    const coverageEnd = wall.effectiveLength;
    const segmentLength = Math.max(maxStudLength, 1);
    const segmentBreaks = [coverageStart];
    const jointCandidates = framingWall.studLayout.studs
      .map((stud) => stud.centerPosition - startOffset)
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

    // Map framing-wall openings into installation-wall coordinates
    const mappedOpenings = mapOpeningsToWall(openings, framingWall, wall);

    // Expand openings to include vertical trimmers and horizontal header/sill
    // so horizontal studs are cut around the entire opening frame
    const expandedOpenings: WallOpening[] = mappedOpenings.map((o) => {
      const expandedBottom = Math.max(o.bottom - studWidth, 0);
      const expandedTop = o.bottom + o.height + studWidth;
      return {
        ...o,
        left: o.left - studWidth,
        bottom: expandedBottom,
        width: o.width + studWidth * 2,
        height: expandedTop - expandedBottom,
      };
    });

    // Horizontal studs — split around openings (including trimmer zones)
    for (let rowIndex = 0; rowIndex < studRowCenters.length; rowIndex++) {
      const rowCenter = studRowCenters[rowIndex];
      const rowTop = rowCenter + studWidth / 2;
      const rowBottom = rowCenter - studWidth / 2;

      for (let i = 0; i < segmentBreaks.length - 1; i++) {
        const segmentStart = segmentBreaks[i];
        const segmentEnd = segmentBreaks[i + 1];

        // Split this stud segment around expanded openings
        const spans = splitHorizontalSpan(
          segmentStart,
          segmentEnd,
          rowBottom,
          studWidth,
          expandedOpenings,
        );
        for (let si = 0; si < spans.length; si++) {
          const span = spans[si];
          const spanWidth = Math.max(span.end - span.start, 0.001);
          const spanCenter = span.start + spanWidth / 2;
          result.push({
            key: `install-stud-${rowIndex}-${i}-${si}`,
            pos: [spanCenter * MM, rowCenter * MM, layerCenterZ],
            size: [spanWidth * MM, studWidthM, studDepthM],
          });
        }
      }
    }

    // Opening framing: vertical trimmers and horizontal header/sill
    for (let oi = 0; oi < mappedOpenings.length; oi++) {
      const o = mappedOpenings[oi];
      const oLeft = o.left;
      const oRight = o.left + o.width;
      const oBottom = o.bottom;
      const oTop = o.bottom + o.height;

      // Vertical trimmer at left edge
      const leftTrimmerX = oLeft - studWidth / 2;
      if (leftTrimmerX >= -0.1 && leftTrimmerX <= coverageEnd + 0.1) {
        // Find which stud rows the opening spans
        const trimmerBottom = oBottom;
        const trimmerTop = oTop;
        const trimmerHeight = trimmerTop - trimmerBottom;
        if (trimmerHeight > 1) {
          result.push({
            key: `install-trimmer-left-${oi}`,
            pos: [
              leftTrimmerX * MM,
              ((trimmerBottom + trimmerTop) / 2) * MM,
              layerCenterZ,
            ],
            size: [studWidthM, trimmerHeight * MM, studDepthM],
          });
        }
      }

      // Vertical trimmer at right edge
      const rightTrimmerX = oRight + studWidth / 2;
      if (rightTrimmerX >= -0.1 && rightTrimmerX <= coverageEnd + 0.1) {
        const trimmerBottom = oBottom;
        const trimmerTop = oTop;
        const trimmerHeight = trimmerTop - trimmerBottom;
        if (trimmerHeight > 1) {
          result.push({
            key: `install-trimmer-right-${oi}`,
            pos: [
              rightTrimmerX * MM,
              ((trimmerBottom + trimmerTop) / 2) * MM,
              layerCenterZ,
            ],
            size: [studWidthM, trimmerHeight * MM, studDepthM],
          });
        }
      }

      // Horizontal header above opening — extends over the trimmers
      const headerY = oTop + studWidth / 2;
      if (headerY <= wallHeight - 0.1) {
        const headerLeft = oLeft - studWidth;
        const headerRight = oRight + studWidth;
        const headerSpan = headerRight - headerLeft;
        result.push({
          key: `install-header-${oi}`,
          pos: [
            ((headerLeft + headerRight) / 2) * MM,
            headerY * MM,
            layerCenterZ,
          ],
          size: [headerSpan * MM, studWidthM, studDepthM],
        });
      }

      // Horizontal sill below opening — extends over the trimmers
      if (oBottom > studWidth + 1) {
        const sillY = oBottom - studWidth / 2;
        const sillLeft = oLeft - studWidth;
        const sillRight = oRight + studWidth;
        const sillSpan = sillRight - sillLeft;
        result.push({
          key: `install-sill-${oi}`,
          pos: [((sillLeft + sillRight) / 2) * MM, sillY * MM, layerCenterZ],
          size: [sillSpan * MM, studWidthM, studDepthM],
        });
      }
    }

    // Insulation panels between stud rows — split around openings

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

        // Skip insulation panels that overlap an opening (use expandedOpenings
        // so insulation is also cut around trimmers, headers, and sills)
        const pieces = subtractOpeningsFromRect(
          xStart,
          bayBottom,
          panelWidth,
          bayHeight,
          expandedOpenings,
        );
        for (let pi = 0; pi < pieces.length; pi++) {
          const p = pieces[pi];
          result.push({
            key: `install-insulation-${rowIndex}-${panelIndex}-${pi}`,
            pos: [(p.x + p.w / 2) * MM, (p.y + p.h / 2) * MM, layerCenterZ],
            size: [p.w * MM, p.h * MM, studDepthM],
            color:
              (rowIndex + panelIndex + pi) % 2 === 0 ? "#d8bf72" : "#ccb165",
          });
        }

        xStart += CAVITY_INSULATION_SHEET_HEIGHT;
        panelIndex += 1;
      }
    }

    return result;
  }, [framingWall, maxStudLength, openings, thickness, wall, wallHeight]);

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
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const wrapPieces = useMemo(() => {
    const wrapThicknessMm = HOUSE_WRAP_THICKNESS;
    const wrapThickness = wrapThicknessMm * MM;
    const framingDepth = wall.thickness * MM;
    const { coverageStart, coverageEnd } = getExteriorCoverageRange(
      wall,
      wrapThicknessMm,
    );
    const zPos = -(framingDepth / 2 + wrapThickness / 2);

    const rects = subtractOpeningsFromRect(
      coverageStart,
      0,
      coverageEnd - coverageStart,
      wallHeight,
      openings,
    );

    return rects.map((r, i) => ({
      key: `wrap-piece-${i}`,
      pos: [(r.x + r.w / 2) * MM, (r.y + r.h / 2) * MM, zPos] as [
        number,
        number,
        number,
      ],
      size: [r.w * MM, r.h * MM, wrapThickness] as [number, number, number],
    }));
  }, [wall, wallHeight, openings]);

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
      {wrapPieces.map((piece) => (
        <group key={piece.key} position={piece.pos}>
          <mesh renderOrder={1}>
            <boxGeometry args={piece.size} />
            <meshStandardMaterial
              color="#e1e1e1"
              transparent
              opacity={0.85}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...piece.size)]} />
            <lineBasicMaterial color="#e1e1e1" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Bent metal comb profile at the base of the ventilated facade cavity */
function WallMusband({
  wall,
  layerEdges,
}: {
  wall: Wall;
  layerEdges: WallLayerEdges;
}) {
  const strip = useMemo(() => {
    const edge = layerEdges.weatherSurface;
    const { coverageStart, coverageEnd, outerFaceZ } = edge;
    const length = Math.max(coverageEnd - coverageStart, 0.001) * MM;
    const height = MUSBAND_HEIGHT * MM;
    const projection = MUSBAND_PROJECTION * MM;
    const thickness = MUSBAND_THICKNESS * MM;

    return {
      rootPos: [coverageStart * MM + length / 2, 0, outerFaceZ] as [
        number,
        number,
        number,
      ],
      backStripSize: [length, height, thickness] as [number, number, number],
      backStripPos: [0, height / 2, -thickness / 2] as [number, number, number],
      teeth: createMusbandTeeth(length).map((tooth) => ({
        key: tooth.key,
        pos: [tooth.centerX, thickness / 2, -thickness / 2] as [
          number,
          number,
          number,
        ],
        size: [tooth.width, thickness, projection] as [number, number, number],
      })),
    };
  }, [layerEdges, wall]);

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
      <group position={strip.rootPos}>
        <group position={strip.backStripPos}>
          <mesh castShadow receiveShadow renderOrder={2}>
            <boxGeometry args={strip.backStripSize} />
            <meshStandardMaterial
              color="#9ca3af"
              roughness={0.45}
              metalness={0.9}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry
              args={[new THREE.BoxGeometry(...strip.backStripSize)]}
            />
            <lineBasicMaterial color="#6b7280" linewidth={1} />
          </lineSegments>
        </group>

        {strip.teeth.map((tooth) => (
          <group
            key={tooth.key}
            position={tooth.pos}
            rotation={[MUSBAND_FLANGE_TILT, 0, 0]}
          >
            <group position={[0, 0, -tooth.size[2] / 2]}>
              <mesh castShadow receiveShadow renderOrder={2}>
                <boxGeometry args={tooth.size} />
                <meshStandardMaterial
                  color="#9ca3af"
                  roughness={0.45}
                  metalness={0.9}
                />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...tooth.size)]} />
                <lineBasicMaterial color="#6b7280" linewidth={1} />
              </lineSegments>
            </group>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Horizontal spikläkt creating the ventilated cavity behind standing cladding */
function WallSpiklakt({
  wall,
  wallHeight,
  layerEdges,
  openings,
  zOverride,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
  zOverride?: number;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const battens = useMemo(() => {
    const edge = layerEdges.spiklakt;
    const { coverageStart, coverageEnd } = edge;
    const zPos = zOverride ?? edge.centerZ;
    const thickness = SPIKLAKT_THICKNESS * MM;
    const height = SPIKLAKT_HEIGHT * MM;
    const heightMm = SPIKLAKT_HEIGHT;
    const wallHeightM = wallHeight * MM;

    const rows: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];
    let centerY = height / 2;
    let rowIndex = 0;

    const addBattensAtY = (y: number, idx: number) => {
      const yMm = y / MM;
      const battenYBottom = yMm - heightMm / 2;
      // Split batten around openings
      const spans = splitHorizontalSpan(
        coverageStart,
        coverageEnd,
        battenYBottom,
        heightMm,
        openings,
      );
      for (let si = 0; si < spans.length; si++) {
        const span = spans[si];
        const spanLen = (span.end - span.start) * MM;
        rows.push({
          key: `spiklakt-${idx}-${si}`,
          pos: [(span.start + (span.end - span.start) / 2) * MM, y, zPos],
          size: [spanLen, height, thickness],
        });
      }
    };

    while (centerY < wallHeightM - height / 2 - 0.001) {
      addBattensAtY(centerY, rowIndex);
      centerY += SPIKLAKT_SPACING * MM;
      rowIndex += 1;
    }

    const topRowY = Math.max(height / 2, wallHeightM - height / 2);
    if (rowIndex === 0 || centerY - SPIKLAKT_SPACING * MM < topRowY - 0.001) {
      addBattensAtY(topRowY, rowIndex);
    }

    return {
      rows: rows.map((row) => ({
        ...row,
        color: getSubtleWoodColor(row.key),
        roughness: getSubtleWoodRoughness(row.key),
        texture: cloneTextureWithLengthwiseOffset(pineTexture, row.key, "x"),
      })),
    };
  }, [layerEdges, pineTexture, wall, wallHeight, openings, zOverride]);

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
      {battens.rows.map((batten) => (
        <group key={batten.key} position={batten.pos}>
          <mesh castShadow receiveShadow renderOrder={2}>
            <boxGeometry args={batten.size} />
            <meshStandardMaterial
              map={batten.texture}
              color={batten.color}
              roughness={batten.roughness}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...batten.size)]} />
            <lineBasicMaterial color="#7f5a38" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Vertical spikläkt creating the ventilated cavity behind horizontal cladding */
function WallVerticalSpiklakt({
  wall,
  wallHeight,
  layerEdges,
  openings,
  zOverride,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
  zOverride?: number;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const battens = useMemo(() => {
    const edge = layerEdges.spiklakt;
    const { coverageStart, coverageEnd } = edge;
    const zPos = zOverride ?? edge.centerZ;
    const thickness = SPIKLAKT_THICKNESS * MM;
    const widthM = SPIKLAKT_HEIGHT * MM;
    const widthMm = SPIKLAKT_HEIGHT;

    const columns: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    const addColumnAtX = (xM: number, idx: number) => {
      const xMm = xM / MM;
      // Split vertically around openings
      const spans = splitVerticalSpan(
        0,
        wallHeight,
        xMm - widthMm / 2,
        widthMm,
        openings,
      );
      for (let si = 0; si < spans.length; si++) {
        const span = spans[si];
        const spanH = (span.end - span.start) * MM;
        columns.push({
          key: `vertical-spiklakt-${idx}-${si}`,
          pos: [xM, ((span.start + span.end) / 2) * MM, zPos],
          size: [widthM, spanH, thickness],
        });
      }
    };

    // Place vertical battens at stud positions so they align with the framing
    const retraction = wall.startCorner.retraction;
    const studs = wall.studLayout.studs;
    for (let i = 0; i < studs.length; i++) {
      const studXMm = retraction + studs[i].centerPosition;
      // Only place batten if the stud falls within the layer coverage
      if (studXMm >= coverageStart && studXMm <= coverageEnd) {
        addColumnAtX(studXMm * MM, i);
      }
    }

    return {
      columns: columns.map((column) => ({
        ...column,
        color: getSubtleWoodColor(column.key),
        roughness: getSubtleWoodRoughness(column.key),
        texture: cloneTextureWithLengthwiseOffset(pineTexture, column.key, "y"),
      })),
    };
  }, [layerEdges, pineTexture, wall, wallHeight, openings, zOverride]);

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
      {battens.columns.map((batten) => (
        <group key={batten.key} position={batten.pos}>
          <mesh castShadow receiveShadow renderOrder={2}>
            <boxGeometry args={batten.size} />
            <meshStandardMaterial
              map={batten.texture}
              color={batten.color}
              roughness={batten.roughness}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...batten.size)]} />
            <lineBasicMaterial color="#7f5a38" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Overlapping falsad sparpanel mounted on horizontal spikläkt */
function WallStandingExteriorPanel({
  wall,
  wallHeight,
  layerEdges,
  showPrimedWhite,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  showPrimedWhite: boolean;
  openings: WallOpening[];
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const panelData = useMemo(() => {
    const edge = layerEdges.panel;
    const { coverageStart, coverageEnd } = edge;
    const wallHeightM = wallHeight * MM;
    const panelThickness = YTTERPANEL_THICKNESS * MM;
    const boardWidth = YTTERPANEL_BOARD_WIDTH * MM;
    const visibleWidth = YTTERPANEL_VISIBLE_WIDTH * MM;
    const overlapWidth = Math.min(YTTERPANEL_OVERLAP_WIDTH * MM, boardWidth);
    const falseWidth = Math.min(YTTERPANEL_FALSE_WIDTH * MM, boardWidth);
    const rabbetDepth = Math.min(YTTERPANEL_RABBET_DEPTH * MM, panelThickness);
    const seamShadowWidth = YTTERPANEL_SEAM_SHADOW_WIDTH * MM;
    const seamShadowDepth = YTTERPANEL_SEAM_SHADOW_DEPTH * MM;
    const totalLength = Math.max(coverageEnd - coverageStart, 0.001) * MM;
    const panelBackZ = edge.innerFaceZ;

    const boards: {
      key: string;
      pos: [number, number, number];
      geometry?: THREE.ExtrudeGeometry;
      size?: [number, number, number];
      color: string;
      roughness: number;
      texture: THREE.Texture;
      paintColor: string;
      paintOpacity: number;
    }[] = [];
    const seamShadows: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    let boardStart = 0;
    let index = 0;
    while (boardStart < totalLength - 0.001) {
      const remainingWidth = totalLength - boardStart;
      const actualBoardWidth = Math.max(
        Math.min(boardWidth, remainingWidth),
        0.001,
      );

      const isFirst = index === 0;
      const isLast = boardStart + boardWidth >= totalLength - 0.001;
      const leftLapWidth = isFirst
        ? 0
        : Math.min(overlapWidth, actualBoardWidth);
      const rightLapWidth = isLast
        ? 0
        : Math.min(falseWidth, Math.max(actualBoardWidth - leftLapWidth, 0));
      const centerWidth = Math.max(
        actualBoardWidth - leftLapWidth - rightLapWidth,
        0,
      );
      if (
        actualBoardWidth > 0 &&
        (centerWidth > 0 || leftLapWidth > 0 || rightLapWidth > 0)
      ) {
        // 2D-subtract openings from this board's rectangle
        const boardLeftMm = coverageStart + boardStart / MM;
        const boardWidthMm = actualBoardWidth / MM;
        const pieces = subtractOpeningsFromRect(
          boardLeftMm,
          0,
          boardWidthMm,
          wallHeight,
          openings,
        );

        for (let pi = 0; pi < pieces.length; pi++) {
          const piece = pieces[pi];
          const pieceWidthMm = piece.w;
          const pieceHeightMm = piece.h;
          const pieceHeight = pieceHeightMm * MM;
          const pieceY = piece.y * MM;
          const pieceXOffset = (piece.x - boardLeftMm) * MM;
          const boardSeed = `panel-${wall.id}-${index}-${pi}`;

          // Full-width piece → use profiled spårpanel geometry
          if (Math.abs(pieceWidthMm - boardWidthMm) < 1) {
            boards.push({
              key: `panel-${index}-${pi}`,
              pos: [boardStart, pieceY, panelBackZ],
              color: getSubtleWoodColor(boardSeed),
              roughness: getSubtleWoodRoughness(boardSeed),
              geometry: createYtterpanelBoardGeometry({
                boardWidth: actualBoardWidth,
                wallHeight: pieceHeight,
                thickness: panelThickness,
                leftLapWidth,
                rightLapWidth,
                rabbetDepth,
                falseFaceAngle: YTTERPANEL_FALSE_FACE_ANGLE,
                faceChamfer: YTTERPANEL_FACE_CHAMFER * MM,
              }),
              texture: cloneTextureWithLengthwiseOffset(
                pineTexture,
                boardSeed,
                "y",
              ),
              paintColor: getSubtlePaintColor(boardSeed),
              paintOpacity: getSubtlePaintOpacity(boardSeed),
            });
          } else {
            // Partial-width fill piece beside opening → flat panel
            boards.push({
              key: `panel-${index}-${pi}`,
              pos: [
                boardStart + pieceXOffset + (pieceWidthMm * MM) / 2,
                pieceY + pieceHeight / 2,
                panelBackZ - panelThickness / 2,
              ],
              size: [pieceWidthMm * MM, pieceHeight, panelThickness],
              color: getSubtleWoodColor(boardSeed),
              roughness: getSubtleWoodRoughness(boardSeed),
              texture: cloneTextureWithLengthwiseOffset(
                pineTexture,
                boardSeed,
                "y",
              ),
              paintColor: getSubtlePaintColor(boardSeed),
              paintOpacity: getSubtlePaintOpacity(boardSeed),
            });
          }
        }

        if (!isFirst) {
          // Seam shadows also split around openings
          const seamPieces = splitVerticalSpan(
            0,
            wallHeight,
            boardLeftMm,
            Math.min(seamShadowWidth, leftLapWidth) / MM,
            openings,
          );
          for (let si = 0; si < seamPieces.length; si++) {
            const sp = seamPieces[si];
            const spH = (sp.end - sp.start) * MM;
            const spY = ((sp.start + sp.end) / 2) * MM;
            seamShadows.push({
              key: `panel-seam-${index}-${si}`,
              pos: [
                boardStart + leftLapWidth,
                spY,
                panelBackZ - panelThickness + seamShadowDepth / 2,
              ],
              size: [
                Math.min(seamShadowWidth, leftLapWidth),
                spH,
                seamShadowDepth,
              ],
            });
          }
        }
      }

      boardStart += visibleWidth;
      index += 1;
    }

    return {
      rootX: coverageStart * MM,
      boards,
      seamShadows,
    };
  }, [openings, layerEdges, pineTexture, wall, wallHeight]);

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
      <group position={[panelData.rootX, 0, 0]}>
        {panelData.seamShadows.map((seam) => (
          <group key={seam.key} position={seam.pos}>
            <mesh renderOrder={3}>
              <boxGeometry args={seam.size} />
              <meshStandardMaterial
                color="#4a3725"
                roughness={1}
                metalness={0}
                transparent
                opacity={0.18}
              />
            </mesh>
          </group>
        ))}
        {panelData.boards.map((part) => (
          <group key={part.key} position={part.pos}>
            <mesh
              castShadow
              receiveShadow
              renderOrder={2}
              geometry={part.geometry}
            >
              {part.size && <boxGeometry args={part.size} />}
              <meshStandardMaterial
                map={part.texture}
                color={showPrimedWhite ? PRIMED_PANEL_BASE_COLOR : part.color}
                roughness={showPrimedWhite ? 0.9 : part.roughness}
                metalness={0}
              />
            </mesh>
            {showPrimedWhite && (
              <mesh receiveShadow renderOrder={3} geometry={part.geometry}>
                {part.size && <boxGeometry args={part.size} />}
                <meshStandardMaterial
                  color={part.paintColor}
                  roughness={0.97}
                  metalness={0}
                  transparent
                  opacity={part.paintOpacity}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Horizontal falsad sparpanel using the same profile, stacked in rows */
function WallHorizontalExteriorPanel({
  wall,
  wallHeight,
  layerEdges,
  showPrimedWhite,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  showPrimedWhite: boolean;
  openings: WallOpening[];
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const panelData = useMemo(() => {
    const edge = layerEdges.panel;
    const { coverageStart, coverageEnd } = edge;
    const wallHeightM = wallHeight * MM;
    const panelThickness = YTTERPANEL_THICKNESS * MM;
    const boardHeight = YTTERPANEL_BOARD_WIDTH * MM;
    const visibleHeight = YTTERPANEL_VISIBLE_WIDTH * MM;
    const overlapWidth = Math.min(YTTERPANEL_OVERLAP_WIDTH * MM, boardHeight);
    const falseWidth = Math.min(YTTERPANEL_FALSE_WIDTH * MM, boardHeight);
    const rabbetDepth = Math.min(YTTERPANEL_RABBET_DEPTH * MM, panelThickness);
    const seamShadowWidth = YTTERPANEL_SEAM_SHADOW_WIDTH * MM;
    const seamShadowDepth = YTTERPANEL_SEAM_SHADOW_DEPTH * MM;
    const totalLength = Math.max(coverageEnd - coverageStart, 0.001) * MM;
    const panelBackZ = edge.innerFaceZ;

    const boards: {
      key: string;
      pos: [number, number, number];
      geometry: THREE.ExtrudeGeometry;
      color: string;
      roughness: number;
      texture: THREE.Texture;
      paintColor: string;
      paintOpacity: number;
    }[] = [];
    const seamShadows: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    let boardStart = 0;
    let index = 0;
    while (boardStart < wallHeightM - 0.001) {
      const remainingHeight = wallHeightM - boardStart;
      const actualBoardHeight = Math.max(
        Math.min(boardHeight, remainingHeight),
        0.001,
      );

      const isFirst = index === 0;
      const isLast = boardStart + boardHeight >= wallHeightM - 0.001;
      const lowerLapWidth = isFirst
        ? 0
        : Math.min(overlapWidth, actualBoardHeight);
      const upperFalseWidth = isLast
        ? 0
        : Math.min(falseWidth, Math.max(actualBoardHeight - lowerLapWidth, 0));
      const centerWidth = Math.max(
        actualBoardHeight - lowerLapWidth - upperFalseWidth,
        0,
      );

      if (
        actualBoardHeight > 0 &&
        (centerWidth > 0 || lowerLapWidth > 0 || upperFalseWidth > 0)
      ) {
        // Split this board row horizontally around openings
        const boardBottomMm = boardStart / MM;
        const pieces = splitHorizontalSpan(
          coverageStart,
          coverageEnd,
          boardBottomMm,
          actualBoardHeight / MM,
          openings,
        );

        for (let pi = 0; pi < pieces.length; pi++) {
          const piece = pieces[pi];
          const pieceLen = (piece.end - piece.start) * MM;
          const pieceX = (piece.start - coverageStart) * MM;
          const boardSeed = `horizontal-panel-${wall.id}-${index}-${pi}`;
          boards.push({
            key: `horizontal-panel-${index}-${pi}`,
            pos: [pieceX, boardStart, panelBackZ],
            color: getSubtleWoodColor(boardSeed),
            roughness: getSubtleWoodRoughness(boardSeed),
            geometry: createLiggandeYtterpanelBoardGeometry({
              boardHeight: actualBoardHeight,
              wallLength: pieceLen,
              thickness: panelThickness,
              leftLapWidth: lowerLapWidth,
              rightLapWidth: upperFalseWidth,
              rabbetDepth,
              falseFaceAngle: YTTERPANEL_FALSE_FACE_ANGLE,
              faceChamfer: YTTERPANEL_FACE_CHAMFER * MM,
            }),
            texture: cloneTextureWithLengthwiseOffset(
              pineTexture,
              boardSeed,
              "x",
            ),
            paintColor: getSubtlePaintColor(boardSeed),
            paintOpacity: getSubtlePaintOpacity(boardSeed),
          });
        }

        if (!isFirst) {
          // Seam shadows also split around openings
          const seamPieces = splitHorizontalSpan(
            coverageStart,
            coverageEnd,
            boardBottomMm,
            Math.min(seamShadowWidth, lowerLapWidth) / MM,
            openings,
          );
          for (let si = 0; si < seamPieces.length; si++) {
            const sp = seamPieces[si];
            const spLen = (sp.end - sp.start) * MM;
            const spX = ((sp.start + sp.end) / 2 - coverageStart) * MM;
            seamShadows.push({
              key: `horizontal-panel-seam-${index}-${si}`,
              pos: [
                spX,
                boardStart + lowerLapWidth,
                panelBackZ - panelThickness + seamShadowDepth / 2,
              ],
              size: [
                spLen,
                Math.min(seamShadowWidth, lowerLapWidth),
                seamShadowDepth,
              ],
            });
          }
        }
      }

      boardStart += visibleHeight;
      index += 1;
    }

    return {
      rootX: coverageStart * MM,
      boards,
      seamShadows,
    };
  }, [openings, layerEdges, pineTexture, wall, wallHeight]);

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
      <group position={[panelData.rootX, 0, 0]}>
        {panelData.seamShadows.map((seam) => (
          <group key={seam.key} position={seam.pos}>
            <mesh renderOrder={3}>
              <boxGeometry args={seam.size} />
              <meshStandardMaterial
                color="#4a3725"
                roughness={1}
                metalness={0}
                transparent
                opacity={0.18}
              />
            </mesh>
          </group>
        ))}
        {panelData.boards.map((part) => (
          <group key={part.key} position={part.pos}>
            <mesh
              castShadow
              receiveShadow
              renderOrder={2}
              geometry={part.geometry}
            >
              <meshStandardMaterial
                map={part.texture}
                color={showPrimedWhite ? PRIMED_PANEL_BASE_COLOR : part.color}
                roughness={showPrimedWhite ? 0.9 : part.roughness}
                metalness={0}
              />
            </mesh>
            {showPrimedWhite && (
              <mesh receiveShadow renderOrder={3} geometry={part.geometry}>
                <meshStandardMaterial
                  color={part.paintColor}
                  roughness={0.97}
                  metalness={0}
                  transparent
                  opacity={part.paintOpacity}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

/** Thin vapor barrier on the interior face of the framing */
function WallVaporBarrier({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const barrierPieces = useMemo(() => {
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
    const coverageStartM = startOuterInset - startInnerExtension;
    const coverageEndM =
      wall.effectiveLength * MM - endOuterInset + endInnerExtension;
    const coverageStartMm = coverageStartM / MM;
    const coverageEndMm = coverageEndM / MM;
    const barrierThickness = HOUSE_WRAP_THICKNESS * MM;
    const framingDepth = wall.thickness * MM;
    const zPos = framingDepth / 2 + barrierThickness / 2;

    const rects = subtractOpeningsFromRect(
      coverageStartMm,
      0,
      coverageEndMm - coverageStartMm,
      wallHeight,
      openings,
    );

    return rects.map((r, i) => ({
      key: `vapor-piece-${i}`,
      pos: [(r.x + r.w / 2) * MM, (r.y + r.h / 2) * MM, zPos] as [
        number,
        number,
        number,
      ],
      size: [r.w * MM, r.h * MM, barrierThickness] as [number, number, number],
    }));
  }, [wall, wallHeight, openings]);

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
      {barrierPieces.map((piece) => (
        <group key={piece.key} position={piece.pos}>
          <mesh renderOrder={1}>
            <boxGeometry args={piece.size} />
            <meshStandardMaterial
              color="#72c2ff"
              transparent
              opacity={0.4}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...piece.size)]} />
            <lineBasicMaterial color="#72c2ff" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** OSB sheathing on the interior side of the framing */
function WallOsbBoards({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const osbTexture = useMemo(() => getOsbTexture(), []);

  const boards = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];

    const boardThickness = OSB_BOARD_THICKNESS;
    const boardThicknessM = boardThickness * MM;
    const coverageStart = 0;
    const coverageEnd = wall.effectiveLength;
    const zCenter = 0;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const boardHeight = Math.min(OSB_BOARD_HEIGHT, wallHeight - yStart);
      let xStart = coverageStart;
      let colIndex = 0;

      while (xStart < coverageEnd - 0.001) {
        const boardWidth = Math.min(OSB_BOARD_WIDTH, coverageEnd - xStart);

        const pieces = subtractOpeningsFromRect(
          xStart,
          yStart,
          boardWidth,
          boardHeight,
          openings,
        );
        for (let pi = 0; pi < pieces.length; pi++) {
          const p = pieces[pi];
          result.push({
            key: `osb-${rowIndex}-${colIndex}-${pi}`,
            pos: [(p.x + p.w / 2) * MM, (p.y + p.h / 2) * MM, zCenter],
            size: [p.w * MM, p.h * MM, boardThicknessM],
            color: (rowIndex + colIndex + pi) % 2 === 0 ? "#f1dfc2" : "#e7d2b0",
          });
        }

        xStart += OSB_BOARD_WIDTH;
        colIndex += 1;
      }

      yStart += OSB_BOARD_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  if (boards.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {boards.map((board) => (
        <group key={board.key} position={board.pos}>
          <mesh castShadow receiveShadow renderOrder={1}>
            <boxGeometry args={board.size} />
            <meshStandardMaterial
              map={osbTexture}
              color={board.color}
              roughness={0.92}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...board.size)]} />
            <lineBasicMaterial color="#7c5732" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Drywall boards on the interior finish side */
function WallDrywallBoards({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const boards = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];

    const boardThicknessM = DRYWALL_BOARD_THICKNESS * MM;
    const coverageStart = 0;
    const coverageEnd = wall.effectiveLength;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const boardHeight = Math.min(DRYWALL_BOARD_HEIGHT, wallHeight - yStart);
      let xStart = coverageStart;
      let colIndex = 0;

      while (xStart < coverageEnd - 0.001) {
        const boardWidth = Math.min(DRYWALL_BOARD_WIDTH, coverageEnd - xStart);

        const pieces = subtractOpeningsFromRect(
          xStart,
          yStart,
          boardWidth,
          boardHeight,
          openings,
        );
        for (let pi = 0; pi < pieces.length; pi++) {
          const p = pieces[pi];
          result.push({
            key: `drywall-${rowIndex}-${colIndex}-${pi}`,
            pos: [(p.x + p.w / 2) * MM, (p.y + p.h / 2) * MM, 0],
            size: [p.w * MM, p.h * MM, boardThicknessM],
            color: (rowIndex + colIndex + pi) % 2 === 0 ? "#f4f1ea" : "#ece7de",
          });
        }

        xStart += DRYWALL_BOARD_WIDTH;
        colIndex += 1;
      }

      yStart += DRYWALL_BOARD_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  if (boards.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {boards.map((board) => (
        <group key={board.key} position={board.pos}>
          <mesh castShadow receiveShadow renderOrder={1}>
            <boxGeometry args={board.size} />
            <meshStandardMaterial
              color={board.color}
              roughness={0.96}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...board.size)]} />
            <lineBasicMaterial color="#c8c1b6" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

/** Floor slab visualisation */
function FloorSlab({ layout }: { layout: LayoutLike }) {
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

// ---- Layer Corner Labels ----
// Visualises each layer's corner points (start & end, inner & outer face)
// as small colored spheres sitting on top of the wall at each corner.

const LAYER_CORNER_COLORS: Record<string, string> = {
  framing: "#ef4444", // red
  outsideDrywall: "#f97316", // orange
  outsideInsulation: "#eab308", // yellow
  weatherSurface: "#22c55e", // green
  spiklakt: "#3b82f6", // blue
  panel: "#a855f7", // purple
};

const LAYER_CORNER_LABELS: Record<string, string> = {
  framing: "Stomme",
  outsideDrywall: "Vindskydd",
  outsideInsulation: "Isolering",
  weatherSurface: "Väderyta",
  spiklakt: "Spikläkt",
  panel: "Panel",
};

function LayerCornerLabels({
  layout,
  wallHeight,
  layerEdgesMap,
  visibleLayers,
}: {
  layout: LayoutLike;
  wallHeight: number;
  layerEdgesMap: Record<string, WallLayerEdges>;
  visibleLayers: Record<string, boolean>;
}) {
  const markers = useMemo(() => {
    const result: {
      key: string;
      labelPos: [number, number, number];
      targetPos: [number, number, number];
      color: string;
      label: string;
    }[] = [];

    const wallTopY = wallHeight * MM;
    const layerKeys = Object.keys(
      LAYER_CORNER_COLORS,
    ) as (keyof WallLayerEdges)[];

    for (const wall of layout.walls) {
      const edges = layerEdgesMap[wall.id];
      if (!edges) continue;

      const dir = wall.direction;
      const outN = { x: -wall.inwardNormal.x, y: -wall.inwardNormal.y };
      const originX = wall.start.x;
      const originY = wall.start.y;
      // wall.start is at the outer face, but Z values are relative to the
      // wall centerline.  Shift by half the thickness so the perpendicular
      // offset is measured from the outer face instead.
      const wallHalf = wall.thickness / 2;

      // Count visible layers so we can stack labels
      const activeKeys = layerKeys.filter((k) => visibleLayers[k]);

      for (let li = 0; li < activeKeys.length; li++) {
        const layerName = activeKeys[li];
        const edge = edges[layerName];
        const color = LAYER_CORNER_COLORS[layerName];
        const label = LAYER_CORNER_LABELS[layerName];
        const labelY = wallTopY + 0.08 + li * 0.06;

        // Perpendicular offset from wall.start (outer face) in mm:
        // -wallHalf compensates for Z=0 being at the center, not the outer face
        const perpOut = (zFace: number) => -wallHalf - zFace / MM;

        const corners: { suffix: string; alongMm: number; zFace: number }[] = [
          { suffix: "S↗", alongMm: edge.coverageStart, zFace: edge.outerFaceZ },
          { suffix: "S↙", alongMm: edge.coverageStart, zFace: edge.innerFaceZ },
          { suffix: "E↗", alongMm: edge.coverageEnd, zFace: edge.outerFaceZ },
          { suffix: "E↙", alongMm: edge.coverageEnd, zFace: edge.innerFaceZ },
        ];

        for (const c of corners) {
          const wx = originX + dir.x * c.alongMm + outN.x * perpOut(c.zFace);
          const wy = originY + dir.y * c.alongMm + outN.y * perpOut(c.zFace);
          const xWorld = wx * MM;
          const zWorld = -wy * MM;

          result.push({
            key: `${wall.id}-${layerName}-${c.suffix}`,
            labelPos: [xWorld, labelY, zWorld],
            targetPos: [xWorld, wallTopY, zWorld],
            color,
            label: `${label} ${c.suffix}`,
          });
        }
      }
    }

    return result;
  }, [layout.walls, wallHeight, layerEdgesMap, visibleLayers]);

  return (
    <group>
      {markers.map((m) => (
        <group key={m.key}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[new Float32Array([...m.targetPos, ...m.labelPos]), 3]}
                count={2}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={m.color} linewidth={1} />
          </line>
          <Text
            position={m.labelPos}
            fontSize={0.03}
            color={m.color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.002}
            outlineColor="#000000"
          >
            {m.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

/** Corner marker spheres (for visual debugging) */
function CornerMarkers({
  layout,
  showInner,
}: {
  layout: LayoutLike;
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
  layout: LayoutLike;
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
function StudDimensions({ layout }: { layout: LayoutLike }) {
  return (
    <group>
      {layout.walls.map((w) => (
        <WallStudDimensions key={w.id} wall={w} />
      ))}
    </group>
  );
}

/** Visual outline and distance labels for a wall opening */
function WallOpeningVisual({
  wall,
  wallHeight,
  opening,
  isSelected,
}: {
  wall: Wall;
  wallHeight: number;
  opening: WallOpening;
  isSelected: boolean;
}) {
  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  const outlineColor = isSelected ? "#22d3ee" : "#f59e0b";
  const oX = opening.left * MM;
  const oY = opening.bottom * MM;
  const oW = opening.width * MM;
  const oH = opening.height * MM;
  const zOffset = -(wall.thickness * MM) / 2 - 0.015;

  const leftDist = opening.left;
  const rightDist = wall.effectiveLength - opening.left - opening.width;
  const bottomDist = opening.bottom;
  const topDist = wallHeight - opening.bottom - opening.height;

  const outlineGeo = useMemo(() => {
    const points = [
      new THREE.Vector3(oX, oY, zOffset),
      new THREE.Vector3(oX + oW, oY, zOffset),
      new THREE.Vector3(oX + oW, oY + oH, zOffset),
      new THREE.Vector3(oX, oY + oH, zOffset),
      new THREE.Vector3(oX, oY, zOffset),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [oX, oY, oW, oH, zOffset]);

  const labelZ = zOffset - 0.01;
  const labelFontSize = 0.055;

  const outlineLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: outlineColor,
      linewidth: 2,
    });
    return new THREE.Line(outlineGeo, mat);
  }, [outlineGeo, outlineColor]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Opening outline */}
      <primitive object={outlineLine} />

      {/* Semi-transparent fill */}
      <mesh position={[oX + oW / 2, oY + oH / 2, zOffset + 0.001]}>
        <planeGeometry args={[oW, oH]} />
        <meshBasicMaterial
          color={isSelected ? "#22d3ee" : "#f59e0b"}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Size label at center */}
      <Text
        position={[oX + oW / 2, oY + oH / 2, labelZ]}
        fontSize={0.06}
        color={outlineColor}
        anchorX="center"
        anchorY="middle"
        depthOffset={-1}
        rotation={[0, Math.PI, 0]}
      >
        {`${Math.round(opening.width / 100)}×${Math.round(opening.height / 100)} dm`}
      </Text>

      {/* Left distance */}
      {leftDist > 10 && (
        <Text
          position={[oX / 2, oY + oH / 2, labelZ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`← ${Math.round(leftDist)}`}
        </Text>
      )}

      {/* Right distance */}
      {rightDist > 10 && (
        <Text
          position={[
            ((opening.left + opening.width + wall.effectiveLength) / 2) * MM,
            oY + oH / 2,
            labelZ,
          ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`${Math.round(rightDist)} →`}
        </Text>
      )}

      {/* Bottom distance */}
      {bottomDist > 10 && (
        <Text
          position={[oX + oW / 2, (opening.bottom / 2) * MM, labelZ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`↓ ${Math.round(bottomDist)}`}
        </Text>
      )}

      {/* Top distance */}
      {topDist > 10 && (
        <Text
          position={[
            oX + oW / 2,
            ((opening.bottom + opening.height + wallHeight) / 2) * MM,
            labelZ,
          ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`${Math.round(topDist)} ↑`}
        </Text>
      )}
    </group>
  );
}

/** Drag interaction layer for wall openings */
function WallOpeningDragLayer({
  wall,
  wallHeight,
  openings,
  onOpeningDrag,
  onOpeningAdd,
  onOpeningSelect,
  controlsRef,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
  onOpeningDrag: (openingId: string, left: number, bottom: number) => void;
  onOpeningAdd: (wallId: string, x: number, y: number) => void;
  onOpeningSelect: (openingId: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const { position, rotationY } = useMemo(() => {
    const q = wall.quad;
    const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
    const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
    return {
      position: [px, 0, pz] as [number, number, number],
      rotationY: wall.angle,
    };
  }, [wall]);

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (!groupRef.current) return;
      const local = groupRef.current.worldToLocal(e.point.clone());
      const wallX = local.x / MM;
      const wallY = local.y / MM;

      for (const opening of openings) {
        if (
          wallX >= opening.left &&
          wallX <= opening.left + opening.width &&
          wallY >= opening.bottom &&
          wallY <= opening.bottom + opening.height
        ) {
          dragRef.current = {
            id: opening.id,
            offsetX: wallX - opening.left,
            offsetY: wallY - opening.bottom,
          };
          onOpeningSelect(opening.id);
          if (controlsRef.current) controlsRef.current.enabled = false;
          (e.nativeEvent.target as Element | null)?.setPointerCapture?.(
            e.pointerId,
          );
          return;
        }
      }
      onOpeningAdd(wall.id, wallX, wallY);
    },
    [openings, onOpeningSelect, onOpeningAdd, wall.id, controlsRef],
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragRef.current || !groupRef.current) return;
      e.stopPropagation();
      const local = groupRef.current.worldToLocal(e.point.clone());
      const wallX = local.x / MM;
      const wallY = local.y / MM;
      const opening = openings.find((o) => o.id === dragRef.current!.id);
      if (!opening) return;

      const newLeft = Math.max(
        0,
        Math.min(
          wallX - dragRef.current.offsetX,
          wall.effectiveLength - opening.width,
        ),
      );
      const newBottom = Math.max(
        0,
        Math.min(wallY - dragRef.current.offsetY, wallHeight - opening.height),
      );
      onOpeningDrag(dragRef.current.id, newLeft, newBottom);
    },
    [openings, wall.effectiveLength, wallHeight, onOpeningDrag],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, [controlsRef]);

  const zPos = -(wall.thickness * MM) / 2 - 0.012;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      <mesh
        position={[
          (wall.effectiveLength * MM) / 2,
          (wallHeight * MM) / 2,
          zPos,
        ]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[wall.effectiveLength * MM, wallHeight * MM]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/** The complete 3D model of a WallLayout */
function WallLayoutModel({
  framingLayout,
  installationLayout,
  osbLayout,
  drywallLayout,
  shellLayout,
  wallHeight,
  outsideInsulation,
  outsideDrywall,
  installationLayer,
  installationLayerStudLength,
  showOsb,
  showDrywall,
  showOutsideDrywall,
  showCavityInsulation,
  showHouseWrap,
  showMusband,
  showStandingExteriorPanel,
  showHorizontalExteriorPanel,
  showPrimedWhiteExteriorPanel,
  showVaporBarrier,
  showFraming,
  showVerticalTopPlate,
  showLabels,
  showCorners,
  showLayerCorners,
  showStudDimensions,
  wallOpenings,
  selectedOpeningId,
  onOpeningDrag,
  onOpeningAdd,
  onOpeningSelect,
  controlsRef,
  showOpenings,
}: {
  framingLayout: LayoutLike;
  installationLayout: LayoutLike | null;
  osbLayout: LayoutLike | null;
  drywallLayout: LayoutLike | null;
  shellLayout: LayoutLike;
  wallHeight: number;
  outsideInsulation: number;
  outsideDrywall: number;
  installationLayer: number;
  installationLayerStudLength: number;
  showOsb: boolean;
  showDrywall: boolean;
  showOutsideDrywall: boolean;
  showCavityInsulation: boolean;
  showHouseWrap: boolean;
  showMusband: boolean;
  showStandingExteriorPanel: boolean;
  showHorizontalExteriorPanel: boolean;
  showPrimedWhiteExteriorPanel: boolean;
  showVaporBarrier: boolean;
  showFraming: boolean;
  showVerticalTopPlate: boolean;
  showLabels: boolean;
  showCorners: boolean;
  showLayerCorners: boolean;
  showStudDimensions: boolean;
  wallOpenings: Record<string, WallOpening[]>;
  selectedOpeningId: string | null;
  onOpeningDrag: (openingId: string, left: number, bottom: number) => void;
  onOpeningAdd: (wallId: string, x: number, y: number) => void;
  onOpeningSelect: (openingId: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
  showOpenings: boolean;
}) {
  const layerEdgesMap = useMemo(() => {
    const map: Record<string, WallLayerEdges> = {};
    for (const w of framingLayout.walls) {
      // ParametricWall has .layers — use parametric bridge when available
      const pw = w as ParametricWall;
      if (pw.layers) {
        map[w.id] = wallLayerEdgesFromParametric(pw);
      }
    }
    return map;
  }, [framingLayout.walls]);

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
            openings={wallOpenings[w.id] || []}
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
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {showFraming &&
        showHouseWrap &&
        framingLayout.walls.map((w) => (
          <WallHouseWrap
            key={`wrap-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {showMusband &&
        framingLayout.walls.map((w) => (
          <WallMusband
            key={`musband-${w.id}`}
            wall={w}
            layerEdges={layerEdgesMap[w.id]}
          />
        ))}

      {showStandingExteriorPanel &&
        framingLayout.walls.map((w) => {
          const edge = layerEdgesMap[w.id].spiklakt;
          // Double läkt: vertical (inner) + horizontal (outer)
          // Exterior Z goes negative outward, so inner half center is innerFaceZ minus half a batten
          const innerZ = edge.innerFaceZ - (SPIKLAKT_THICKNESS * MM) / 2;
          const outerZ = edge.outerFaceZ + (SPIKLAKT_THICKNESS * MM) / 2;
          return (
            <React.Fragment key={`spiklakt-double-${w.id}`}>
              <WallVerticalSpiklakt
                key={`spiklakt-vertical-${w.id}`}
                wall={w}
                wallHeight={wallHeight}
                layerEdges={layerEdgesMap[w.id]}
                openings={wallOpenings[w.id] || []}
                zOverride={innerZ}
              />
              <WallSpiklakt
                key={`spiklakt-horizontal-${w.id}`}
                wall={w}
                wallHeight={wallHeight}
                layerEdges={layerEdgesMap[w.id]}
                openings={wallOpenings[w.id] || []}
                zOverride={outerZ}
              />
            </React.Fragment>
          );
        })}

      {showHorizontalExteriorPanel &&
        framingLayout.walls.map((w) => (
          <WallVerticalSpiklakt
            key={`vertical-spiklakt-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            layerEdges={layerEdgesMap[w.id]}
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {showStandingExteriorPanel &&
        framingLayout.walls.map((w) => (
          <WallStandingExteriorPanel
            key={`ytterpanel-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            layerEdges={layerEdgesMap[w.id]}
            showPrimedWhite={showPrimedWhiteExteriorPanel}
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {showHorizontalExteriorPanel &&
        framingLayout.walls.map((w) => (
          <WallHorizontalExteriorPanel
            key={`horizontal-ytterpanel-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            layerEdges={layerEdgesMap[w.id]}
            showPrimedWhite={showPrimedWhiteExteriorPanel}
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {showFraming &&
        showVaporBarrier &&
        framingLayout.walls.map((w) => (
          <WallVaporBarrier
            key={`vapor-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {showFraming &&
        installationLayer > 0 &&
        installationLayout &&
        installationLayout.walls.map((w, index) => (
          <WallInstallationLayer
            key={`installation-${w.id}`}
            wall={w}
            framingWall={framingLayout.walls[index]}
            wallHeight={wallHeight}
            thickness={installationLayer}
            maxStudLength={installationLayerStudLength}
            openings={wallOpenings[framingLayout.walls[index]?.id] || []}
          />
        ))}

      {showFraming &&
        showOsb &&
        osbLayout &&
        osbLayout.walls.map((w, index) => {
          const fw = framingLayout.walls[index];
          const raw = fw ? wallOpenings[fw.id] || [] : [];
          return (
            <WallOsbBoards
              key={`osb-${w.id}`}
              wall={w}
              wallHeight={wallHeight}
              openings={fw ? mapOpeningsToWall(raw, fw, w) : raw}
            />
          );
        })}

      {showFraming &&
        showDrywall &&
        drywallLayout &&
        drywallLayout.walls.map((w, index) => {
          const fw = framingLayout.walls[index];
          const raw = fw ? wallOpenings[fw.id] || [] : [];
          return (
            <WallDrywallBoards
              key={`drywall-${w.id}`}
              wall={w}
              wallHeight={wallHeight}
              openings={fw ? mapOpeningsToWall(raw, fw, w) : raw}
            />
          );
        })}

      {showOutsideDrywall &&
        showFraming &&
        framingLayout.walls.map((w) => (
          <WallOutsideDrywall
            key={`outside-drywall-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            layerEdges={layerEdgesMap[w.id]}
            openings={wallOpenings[w.id] || []}
          />
        ))}

      {outsideInsulation > 0 &&
        framingLayout.walls.map((w) => (
          <WallInsulationSheets
            key={`insulation-${w.id}`}
            wall={w}
            wallHeight={wallHeight}
            thickness={outsideInsulation}
            layerEdges={layerEdgesMap[w.id]}
            openings={wallOpenings[w.id] || []}
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
      {showLayerCorners && showFraming && (
        <LayerCornerLabels
          layout={framingLayout}
          wallHeight={wallHeight}
          layerEdgesMap={layerEdgesMap}
          visibleLayers={{
            framing: true,
            outsideDrywall: showOutsideDrywall,
            outsideInsulation: outsideInsulation > 0,
            weatherSurface: outsideInsulation > 0,
            spiklakt: showStandingExteriorPanel || showHorizontalExteriorPanel,
            panel: showStandingExteriorPanel || showHorizontalExteriorPanel,
          }}
        />
      )}
      {showStudDimensions && showFraming && (
        <StudDimensions layout={framingLayout} />
      )}

      {/* Opening visuals and drag layers */}
      {showOpenings &&
        framingLayout.walls.map((w) => (
          <group key={`openings-${w.id}`}>
            {(wallOpenings[w.id] || []).map((opening) => (
              <WallOpeningVisual
                key={opening.id}
                wall={w}
                wallHeight={wallHeight}
                opening={opening}
                isSelected={selectedOpeningId === opening.id}
              />
            ))}
            <WallOpeningDragLayer
              wall={w}
              wallHeight={wallHeight}
              openings={wallOpenings[w.id] || []}
              onOpeningDrag={onOpeningDrag}
              onOpeningAdd={onOpeningAdd}
              onOpeningSelect={onOpeningSelect}
              controlsRef={controlsRef}
            />
          </group>
        ))}
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
  const [showMusband, setShowMusband] = useState(false);
  const [showStandingExteriorPanel, setShowStandingExteriorPanel] =
    useState(false);
  const [showHorizontalExteriorPanel, setShowHorizontalExteriorPanel] =
    useState(false);
  const [showPrimedWhiteExteriorPanel, setShowPrimedWhiteExteriorPanel] =
    useState(false);
  const [showVaporBarrier, setShowVaporBarrier] = useState(false);
  const [showOsb, setShowOsb] = useState(false);
  const [showDrywall, setShowDrywall] = useState(false);
  const [showOutsideDrywall, setShowOutsideDrywall] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showCorners, setShowCorners] = useState(false);
  const [showLayerCorners, setShowLayerCorners] = useState(false);
  const [showStudDimensions, setShowStudDimensions] = useState(true);
  const [showVerticalTopPlate, setShowVerticalTopPlate] = useState(false);
  const [showCavityInsulation, setShowCavityInsulation] = useState(false);
  const [showOpenings, setShowOpenings] = useState(false);
  const [wallOpenings, setWallOpenings] = useState<
    Record<string, WallOpening[]>
  >({});
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(
    null,
  );
  const [newOpeningWidthDm, setNewOpeningWidthDm] = useState(9);
  const [newOpeningHeightDm, setNewOpeningHeightDm] = useState(21);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const openingIdCounter = useRef(0);
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
  const outsideDrywall = showOutsideDrywall ? OUTSIDE_DRYWALL_THICKNESS : 0;

  const baseOuterCorners = useMemo(() => {
    return PRESETS[presetIndex].create(thickness, studSpacing).outerCorners;
  }, [presetIndex, thickness, studSpacing]);

  // Build layer definitions for the parametric system
  const layerDefs = useMemo((): LayerDef[] => {
    const defs: LayerDef[] = [
      { id: "framing", name: "Stomme", thickness, side: "exterior", order: 0 },
    ];
    let extOrder = 1;
    if (outsideDrywall > 0) {
      defs.push({
        id: "outsideDrywall",
        name: "Vindskydd",
        thickness: outsideDrywall,
        side: "exterior",
        order: extOrder++,
      });
    }
    if (outsideInsulation > 0) {
      defs.push({
        id: "outsideInsulation",
        name: "Isolering",
        thickness: outsideInsulation,
        side: "exterior",
        order: extOrder++,
      });
    }
    // Standing panels need double läkt: vertical (inner) + horizontal (outer)
    const spiklaktThickness = showStandingExteriorPanel
      ? SPIKLAKT_THICKNESS * 2
      : SPIKLAKT_THICKNESS;
    defs.push({
      id: "spiklakt",
      name: "Spikläkt",
      thickness: spiklaktThickness,
      side: "exterior",
      order: extOrder++,
    });
    defs.push({
      id: "panel",
      name: "Panel",
      thickness: YTTERPANEL_THICKNESS,
      side: "exterior",
      order: extOrder++,
    });
    return defs;
  }, [thickness, outsideDrywall, outsideInsulation, showStandingExteriorPanel]);

  // Parametric layout: framing + all exterior layers resolved in one pass
  const parametricLayout = useMemo(() => {
    return buildParametricLayout(baseOuterCorners, {
      layers: layerDefs,
      studSpacing,
      studWidth: 45,
      studDepth: thickness,
    });
  }, [baseOuterCorners, layerDefs, studSpacing, thickness]);

  // Framing layout — walls from the parametric system (ParametricWall is Wall-compatible)
  const layout: LayoutLike = useMemo(
    () => ({
      walls: parametricLayout.walls as unknown as Wall[],
      outerCorners: parametricLayout.framingOuterCorners,
      innerCorners: parametricLayout.framingInnerCorners,
    }),
    [parametricLayout],
  );

  // Shell layout — building outer boundary for floor slab and non-framing view
  const shellLayout = useMemo(() => {
    return new WallLayout(baseOuterCorners, {
      thickness: thickness + outsideDrywall + outsideInsulation,
      studSpacing,
      studDepth: thickness,
    });
  }, [
    baseOuterCorners,
    outsideDrywall,
    outsideInsulation,
    studSpacing,
    thickness,
  ]);

  // Interior layouts — constructed from the framing inner corners
  const installationLayout = useMemo(() => {
    if (installationLayer === 0) return null;
    return new WallLayout(parametricLayout.framingInnerCorners, {
      thickness: installationLayer,
      studSpacing,
      studWidth: 45,
      studDepth: installationLayer,
    });
  }, [installationLayer, parametricLayout.framingInnerCorners, studSpacing]);

  const osbLayout = useMemo(() => {
    const osbOuterCorners = installationLayout
      ? installationLayout.innerCorners
      : parametricLayout.framingInnerCorners;
    return new WallLayout(osbOuterCorners, {
      thickness: OSB_BOARD_THICKNESS,
      studSpacing,
      studDepth: OSB_BOARD_THICKNESS,
    });
  }, [installationLayout, parametricLayout.framingInnerCorners, studSpacing]);

  const drywallLayout = useMemo(() => {
    const drywallOuterCorners =
      showOsb && osbLayout
        ? osbLayout.innerCorners
        : installationLayout
          ? installationLayout.innerCorners
          : parametricLayout.framingInnerCorners;
    return new WallLayout(drywallOuterCorners, {
      thickness: DRYWALL_BOARD_THICKNESS,
      studSpacing,
      studDepth: DRYWALL_BOARD_THICKNESS,
    });
  }, [
    showOsb,
    osbLayout,
    installationLayout,
    parametricLayout.framingInnerCorners,
    studSpacing,
  ]);

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

  // Opening callbacks
  const handleOpeningAdd = useCallback(
    (wallId: string, x: number, y: number) => {
      const w = newOpeningWidthDm * 100; // dm → mm
      const h = newOpeningHeightDm * 100;
      const wall = layout.walls.find((wl) => wl.id === wallId);
      if (!wall) return;
      const left = Math.max(0, Math.min(x - w / 2, wall.effectiveLength - w));
      const bottom = Math.max(0, Math.min(y - h / 2, wallHeight - h));
      const id = `op-${++openingIdCounter.current}`;
      setWallOpenings((prev) => ({
        ...prev,
        [wallId]: [
          ...(prev[wallId] || []),
          { id, left, bottom, width: w, height: h },
        ],
      }));
      setSelectedOpeningId(id);
    },
    [newOpeningWidthDm, newOpeningHeightDm, layout.walls, wallHeight],
  );

  const handleOpeningDrag = useCallback(
    (openingId: string, left: number, bottom: number) => {
      setWallOpenings((prev) => {
        const next = { ...prev };
        for (const wallId of Object.keys(next)) {
          next[wallId] = next[wallId].map((o) =>
            o.id === openingId ? { ...o, left, bottom } : o,
          );
        }
        return next;
      });
    },
    [],
  );

  const handleOpeningSelect = useCallback((id: string | null) => {
    setSelectedOpeningId(id);
  }, []);

  const handleOpeningRemove = useCallback(() => {
    if (!selectedOpeningId) return;
    setWallOpenings((prev) => {
      const next = { ...prev };
      for (const wallId of Object.keys(next)) {
        next[wallId] = next[wallId].filter((o) => o.id !== selectedOpeningId);
        if (next[wallId].length === 0) delete next[wallId];
      }
      return next;
    });
    setSelectedOpeningId(null);
  }, [selectedOpeningId]);

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
                  label: "Vindskyddsskiva",
                  checked: showOutsideDrywall,
                  toggle: () => setShowOutsideDrywall((v) => !v),
                },
                {
                  label: "Musband",
                  checked: showMusband,
                  toggle: () => setShowMusband((v) => !v),
                },
                {
                  label: "Falsad spårpanel",
                  checked: showStandingExteriorPanel,
                  toggle: () => {
                    setShowStandingExteriorPanel((v) => {
                      const nextValue = !v;
                      if (nextValue) setShowHorizontalExteriorPanel(false);
                      return nextValue;
                    });
                  },
                },
                {
                  label: "Liggande falsad spårpanel",
                  checked: showHorizontalExteriorPanel,
                  toggle: () => {
                    setShowHorizontalExteriorPanel((v) => {
                      const nextValue = !v;
                      if (nextValue) setShowStandingExteriorPanel(false);
                      return nextValue;
                    });
                  },
                },
                {
                  label: "Grundmålad vit panel",
                  checked: showPrimedWhiteExteriorPanel,
                  toggle: () => setShowPrimedWhiteExteriorPanel((v) => !v),
                },
                {
                  label: "Vapor barrier",
                  checked: showVaporBarrier,
                  toggle: () => setShowVaporBarrier((v) => !v),
                },
                {
                  label: "OSB",
                  checked: showOsb,
                  toggle: () => setShowOsb((v) => !v),
                },
                {
                  label: "Drywall",
                  checked: showDrywall,
                  toggle: () => setShowDrywall((v) => !v),
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
                  label: "Lagerhörnpunkter",
                  checked: showLayerCorners,
                  toggle: () => setShowLayerCorners((v) => !v),
                },
                {
                  label: "Regelmått",
                  checked: showStudDimensions,
                  toggle: () => setShowStudDimensions((v) => !v),
                },
                {
                  label: "Öppningar",
                  checked: showOpenings,
                  toggle: () => setShowOpenings((v) => !v),
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

          {/* Openings controls */}
          {showOpenings && (
            <div className="p-3 bg-zinc-700/30 rounded-lg space-y-3">
              <h3 className="text-sm font-medium text-zinc-300">
                Öppningar (dörrar/fönster)
              </h3>
              <p className="text-xs text-zinc-500">
                Klicka på en vägg i 3D-vyn för att lägga till en öppning. Dra
                för att flytta.
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">
                    Bredd (dm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newOpeningWidthDm}
                    onChange={(e) =>
                      setNewOpeningWidthDm(
                        Math.max(1, Math.min(50, Number(e.target.value))),
                      )
                    }
                    className="w-full px-2 py-1 bg-zinc-700 text-zinc-200 text-sm rounded border border-zinc-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-zinc-400 mb-1">
                    Höjd (dm)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={newOpeningHeightDm}
                    onChange={(e) =>
                      setNewOpeningHeightDm(
                        Math.max(1, Math.min(40, Number(e.target.value))),
                      )
                    }
                    className="w-full px-2 py-1 bg-zinc-700 text-zinc-200 text-sm rounded border border-zinc-600 focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
              <div className="text-xs text-zinc-500">
                = {newOpeningWidthDm * 100} × {newOpeningHeightDm * 100} mm
              </div>

              {selectedOpeningId && (
                <button
                  onClick={handleOpeningRemove}
                  className="w-full px-3 py-1.5 text-xs font-medium rounded bg-red-600/80 text-white hover:bg-red-500 transition-colors"
                >
                  Ta bort vald öppning
                </button>
              )}

              {/* List of all openings per wall */}
              {Object.keys(wallOpenings).length > 0 && (
                <div className="space-y-1 pt-1 border-t border-zinc-600">
                  {Object.entries(wallOpenings).map(([wallId, ops]) =>
                    ops.map((op) => (
                      <button
                        key={op.id}
                        onClick={() => setSelectedOpeningId(op.id)}
                        className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                          op.id === selectedOpeningId
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50"
                        }`}
                      >
                        {wallId}: {Math.round(op.width / 100)}×
                        {Math.round(op.height / 100)} dm @ {Math.round(op.left)}
                        mm
                      </button>
                    )),
                  )}
                </div>
              )}
            </div>
          )}

          {/* Layout info */}
          <div className="p-3 bg-zinc-700/30 rounded-lg space-y-1">
            <h3 className="text-sm font-medium text-zinc-300">Layoutinfo</h3>
            <div className="text-xs text-zinc-400 space-y-0.5">
              <div>Antal väggar: {layout.walls.length}</div>
              <div>Outside insulation: {outsideInsulation} mm</div>
              <div>Ventilerad luftspalt bakom fasad: {FACADE_AIR_GAP} mm</div>
              <div>
                Falsad spårpanel: 22x{YTTERPANEL_BOARD_WIDTH} mm med{" "}
                {YTTERPANEL_OVERLAP_WIDTH}
                mm överlapp och {YTTERPANEL_FALSE_WIDTH} mm fals, täckande bredd{" "}
                {YTTERPANEL_VISIBLE_WIDTH} mm, {YTTERPANEL_FALSE_FACE_ANGLE}°
                falsvinkel, {YTTERPANEL_FACE_CHAMFER} mm fasade kanter och{" "}
                {(showHorizontalExteriorPanel ? "vertikal" : "horisontell") +
                  " spikläkt "}
                {SPIKLAKT_THICKNESS} mm
              </div>
              <div>
                Panelriktning:{" "}
                {showStandingExteriorPanel
                  ? "stående"
                  : showHorizontalExteriorPanel
                    ? "liggande"
                    : "ingen vald"}
              </div>
              <div>
                Ytbehandling panel:{" "}
                {showPrimedWhiteExteriorPanel ? "grundmålad vit" : "trären"}
              </div>
              <div>
                Musband: bockad kamprofil, utstick {MUSBAND_PROJECTION} mm
              </div>
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
            installationLayout={installationLayout}
            osbLayout={osbLayout}
            drywallLayout={drywallLayout}
            shellLayout={shellLayout}
            wallHeight={wallHeight}
            outsideInsulation={outsideInsulation}
            outsideDrywall={outsideDrywall}
            installationLayer={installationLayer}
            installationLayerStudLength={installationLayerStudLength}
            showOsb={showOsb}
            showDrywall={showDrywall}
            showOutsideDrywall={showOutsideDrywall}
            showCavityInsulation={showCavityInsulation}
            showHouseWrap={showHouseWrap}
            showMusband={showMusband}
            showStandingExteriorPanel={showStandingExteriorPanel}
            showHorizontalExteriorPanel={showHorizontalExteriorPanel}
            showPrimedWhiteExteriorPanel={showPrimedWhiteExteriorPanel}
            showVaporBarrier={showVaporBarrier}
            showFraming={showFraming}
            showVerticalTopPlate={showVerticalTopPlate}
            showLabels={showLabels}
            showCorners={showCorners}
            showLayerCorners={showLayerCorners}
            showStudDimensions={showStudDimensions}
            wallOpenings={wallOpenings}
            selectedOpeningId={selectedOpeningId}
            onOpeningDrag={handleOpeningDrag}
            onOpeningAdd={handleOpeningAdd}
            onOpeningSelect={handleOpeningSelect}
            controlsRef={controlsRef}
            showOpenings={showOpenings}
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
