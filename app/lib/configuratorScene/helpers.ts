import * as THREE from "three";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import type { Wall, WallOpening } from "../configurator";
import type { ParametricWall, ResolvedLayer } from "../configurator/parametric";
import {
  MM,
  STUD_COLOR,
  PRIMED_PANEL_COLOR,
  COMB_STRIP_TOOTH_WIDTH,
  COMB_STRIP_GAP_WIDTH,
  PANEL_MIN_REMAINDER,
  PANEL_CUTOUT_BLEED,
  EXTERIOR_PANEL_REBATE_DEPTH,
  WallLayerEdges,
  type LayerEdge,
} from "./constants";

export function createNotchedStudGeometry(
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

export function resolvedLayerToEdge(layer: ResolvedLayer): LayerEdge {
  return {
    coverageStart: layer.coverageStart,
    coverageEnd: layer.coverageEnd,
    outerFaceZ: layer.outerFaceZ,
    innerFaceZ: layer.innerFaceZ,
    centerZ: layer.centerZ,
    depthM: layer.depthM,
  };
}

export function wallLayerEdgesFromParametric(
  wall: ParametricWall,
): WallLayerEdges {
  const get = (id: string): LayerEdge => {
    const layer = wall.layers[id];
    if (layer) return resolvedLayerToEdge(layer);
    const framingLayer = wall.layers.framing;
    return {
      coverageStart: framingLayer?.coverageStart ?? 0,
      coverageEnd: framingLayer?.coverageEnd ?? 0,
      outerFaceZ: framingLayer?.outerFaceZ ?? 0,
      innerFaceZ: framingLayer?.outerFaceZ ?? 0,
      centerZ: framingLayer?.outerFaceZ ?? 0,
      depthM: 0,
    };
  };

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

export function getExteriorCoverageRange(wall: Wall, layerThicknessMm: number) {
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

// Swedish: createMusbandTeeth
export function createCombStripTeeth(length: number) {
  const toothWidth = COMB_STRIP_TOOTH_WIDTH * MM;
  const preferredGap = COMB_STRIP_GAP_WIDTH * MM;

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

export function cloneTextureWithLengthwiseOffset(
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

export function getSubtleWoodColor(seed: string) {
  const color = new THREE.Color(STUD_COLOR);
  const lightnessOffset =
    (getDeterministicUnitValue(`${seed}-lightness`) - 0.5) * 0.1;
  color.offsetHSL(0, 0, lightnessOffset);
  return `#${color.getHexString()}`;
}

export function getSubtleWoodRoughness(seed: string) {
  return 0.78 + getDeterministicUnitValue(`${seed}-roughness`) * 0.14;
}

export function getSubtlePaintColor(seed: string) {
  const color = new THREE.Color(PRIMED_PANEL_COLOR);
  const saturationOffset =
    (getDeterministicUnitValue(`${seed}-paint-saturation`) - 0.5) * 0.006;
  const lightnessOffset =
    (getDeterministicUnitValue(`${seed}-paint-lightness`) - 0.5) * 0.02;
  color.offsetHSL(0, saturationOffset, lightnessOffset);
  return `#${color.getHexString()}`;
}

export function getSubtlePaintOpacity(seed: string) {
  return 0.9 + getDeterministicUnitValue(`${seed}-paint-opacity`) * 0.06;
}

type PanelBoardEdgeStyle = "lap" | "face" | "cut";

const panelCsgEvaluator = new Evaluator();
panelCsgEvaluator.useGroups = false;

// Swedish: createYtterpanelBoardGeometry
export function createVerticalExteriorPanelBoardGeometry({
  boardWidth,
  wallHeight,
  thickness,
  leftLapWidth,
  rightLapWidth,
  leftEdgeStyle = leftLapWidth > 0 ? "lap" : "face",
  rightEdgeStyle = rightLapWidth > 0 ? "lap" : "face",
  rabbetDepth = EXTERIOR_PANEL_REBATE_DEPTH * MM,
  falseFaceAngle,
  faceChamfer,
}: {
  boardWidth: number;
  wallHeight: number;
  thickness: number;
  leftLapWidth: number;
  rightLapWidth: number;
  leftEdgeStyle?: PanelBoardEdgeStyle;
  rightEdgeStyle?: PanelBoardEdgeStyle;
  rabbetDepth?: number;
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

  if (leftEdgeStyle === "lap" && clampedLeftLap > 0) {
    profile.moveTo(0, clampedRabbetDepth);
    profile.lineTo(leftSlopeTopX, chamferBaseY);
    profile.lineTo(leftFaceStartX, clampedThickness);
  } else if (leftEdgeStyle === "cut") {
    profile.moveTo(0, 0);
    profile.lineTo(0, clampedThickness);
  } else {
    profile.moveTo(0, 0);
    profile.lineTo(0, chamferBaseY);
    profile.lineTo(clampedFaceChamfer, clampedThickness);
  }

  if (rightEdgeStyle === "lap" && clampedRightLap > 0) {
    profile.lineTo(rightFaceEndX, clampedThickness);
    profile.lineTo(rightSlopeTopX, chamferBaseY);
    profile.lineTo(frontRightX, clampedRabbetDepth);
    profile.lineTo(clampedWidth, clampedRabbetDepth);
    profile.lineTo(clampedWidth, 0);
  } else if (rightEdgeStyle === "cut") {
    profile.lineTo(clampedWidth, clampedThickness);
    profile.lineTo(clampedWidth, 0);
  } else {
    profile.lineTo(clampedWidth - clampedFaceChamfer, clampedThickness);
    profile.lineTo(clampedWidth, chamferBaseY);
    profile.lineTo(clampedWidth, 0);
  }

  if (leftEdgeStyle === "lap" && clampedLeftLap > 0) {
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

// Swedish: createLiggandeYtterpanelBoardGeometry
export function createHorizontalExteriorPanelBoardGeometry({
  boardHeight,
  wallLength,
  thickness,
  leftLapWidth,
  rightLapWidth,
  leftEdgeStyle,
  rightEdgeStyle,
  rabbetDepth,
  falseFaceAngle,
  faceChamfer,
}: {
  boardHeight: number;
  wallLength: number;
  thickness: number;
  leftLapWidth: number;
  rightLapWidth: number;
  leftEdgeStyle?: PanelBoardEdgeStyle;
  rightEdgeStyle?: PanelBoardEdgeStyle;
  rabbetDepth: number;
  falseFaceAngle: number;
  faceChamfer: number;
}) {
  const geometry = createVerticalExteriorPanelBoardGeometry({
    boardWidth: boardHeight,
    wallHeight: wallLength,
    thickness,
    leftLapWidth,
    rightLapWidth,
    leftEdgeStyle,
    rightEdgeStyle,
    rabbetDepth,
    falseFaceAngle,
    faceChamfer,
  });

  geometry.rotateZ(Math.PI / 2);
  geometry.translate(wallLength, 0, 0);

  return geometry;
}

export function getBoardOpeningCutouts(
  boardLeft: number,
  boardBottom: number,
  boardWidth: number,
  boardHeight: number,
  openings: WallOpening[],
) {
  const cutouts: { x: number; y: number; width: number; height: number }[] = [];
  const boardRight = boardLeft + boardWidth;
  const boardTop = boardBottom + boardHeight;

  for (const opening of openings) {
    let cutLeft = Math.max(boardLeft, opening.left);
    let cutRight = Math.min(boardRight, opening.left + opening.width);
    let cutBottom = Math.max(boardBottom, opening.bottom);
    let cutTop = Math.min(boardTop, opening.bottom + opening.height);

    if (cutRight - cutLeft <= 0.5 || cutTop - cutBottom <= 0.5) continue;

    if (cutLeft - boardLeft < PANEL_MIN_REMAINDER) {
      cutLeft = boardLeft;
    }
    if (boardRight - cutRight < PANEL_MIN_REMAINDER) {
      cutRight = boardRight;
    }
    if (cutBottom - boardBottom < PANEL_MIN_REMAINDER) {
      cutBottom = boardBottom;
    }
    if (boardTop - cutTop < PANEL_MIN_REMAINDER) {
      cutTop = boardTop;
    }

    if (cutLeft <= boardLeft + 0.5) {
      cutLeft -= PANEL_CUTOUT_BLEED;
    }
    if (cutRight >= boardRight - 0.5) {
      cutRight += PANEL_CUTOUT_BLEED;
    }
    if (cutBottom <= boardBottom + 0.5) {
      cutBottom -= PANEL_CUTOUT_BLEED;
    }
    if (cutTop >= boardTop - 0.5) {
      cutTop += PANEL_CUTOUT_BLEED;
    }

    cutouts.push({
      x: (cutLeft - boardLeft) * MM,
      y: (cutBottom - boardBottom) * MM,
      width: (cutRight - cutLeft) * MM,
      height: (cutTop - cutBottom) * MM,
    });
  }

  return cutouts;
}

export function createBoardGeometryWithCutouts(
  geometry: THREE.BufferGeometry,
  thickness: number,
  cutouts: { x: number; y: number; width: number; height: number }[],
) {
  if (cutouts.length === 0) return geometry;

  geometry.clearGroups();

  let result = new Brush(geometry);
  result.updateMatrixWorld();

  for (let index = 0; index < cutouts.length; index += 1) {
    const cutout = cutouts[index];
    const cutterGeometry = new THREE.BoxGeometry(
      Math.max(cutout.width, 0.001),
      Math.max(cutout.height, 0.001),
      thickness + 2 * MM,
    );
    cutterGeometry.translate(
      cutout.x + cutout.width / 2,
      cutout.y + cutout.height / 2,
      -thickness / 2,
    );
    cutterGeometry.clearGroups();

    const cutter = new Brush(cutterGeometry);
    cutter.updateMatrixWorld();
    result = panelCsgEvaluator.evaluate(result, cutter, SUBTRACTION);
    result.updateMatrixWorld();
  }

  result.geometry.computeVertexNormals();
  return result.geometry;
}

export function getSupportAlignedBoardSegments(
  totalLength: number,
  boardLength: number,
  staggerOffset: number,
  jointSupports: number[],
) {
  if (totalLength <= 0.001) return [] as { start: number; length: number }[];

  const segments: { start: number; length: number }[] = [];
  const clampedBoardLength = Math.max(boardLength, 1);
  const clampedOffset = Math.max(
    0,
    Math.min(staggerOffset, clampedBoardLength - 1),
  );

  const supports = jointSupports
    .filter(
      (support) =>
        support > PANEL_MIN_REMAINDER &&
        support < totalLength - PANEL_MIN_REMAINDER,
    )
    .sort((a, b) => a - b);

  let cursor = 0;
  let useStaggerOffset = clampedOffset > PANEL_MIN_REMAINDER;

  while (cursor < totalLength - 0.001) {
    const remaining = totalLength - cursor;
    if (remaining <= clampedBoardLength + PANEL_MIN_REMAINDER) {
      segments.push({ start: cursor, length: remaining });
      break;
    }

    const desiredBreak =
      cursor + (useStaggerOffset ? clampedOffset : clampedBoardLength);
    const candidates = supports.filter(
      (support) =>
        support > cursor + PANEL_MIN_REMAINDER &&
        support < totalLength - PANEL_MIN_REMAINDER,
    );

    if (candidates.length === 0) {
      segments.push({ start: cursor, length: remaining });
      break;
    }

    let nextBreak = candidates[0];
    let bestDistance = Math.abs(candidates[0] - desiredBreak);
    for (let index = 1; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const distance = Math.abs(candidate - desiredBreak);
      if (
        distance < bestDistance - 0.001 ||
        (Math.abs(distance - bestDistance) <= 0.001 && candidate > nextBreak)
      ) {
        nextBreak = candidate;
        bestDistance = distance;
      }
    }

    if (nextBreak <= cursor + PANEL_MIN_REMAINDER) {
      segments.push({ start: cursor, length: remaining });
      break;
    }

    segments.push({ start: cursor, length: nextBreak - cursor });
    cursor = nextBreak;
    useStaggerOffset = false;
  }

  return segments;
}

export function createTextTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create text canvas context");
  }
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 256, 64);
  return new THREE.CanvasTexture(canvas);
}

export function createRockwoolTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create rockwool texture canvas context");
  }

  ctx.fillStyle = "#d0bc83";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 2600; i += 1) {
    const x = (i * 67) % canvas.width;
    const y = (i * 97) % canvas.height;
    const length = 4 + (i % 9);
    const angle = ((i * 29) % 180) * (Math.PI / 180);
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length * 0.45;
    const lightness = 58 + ((i * 11) % 12);
    const alpha = 0.08 + (i % 5) * 0.018;

    ctx.strokeStyle = `hsla(46, 26%, ${lightness}%, ${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }

  for (let i = 0; i < 1200; i += 1) {
    const x = (i * 131) % canvas.width;
    const y = (i * 53) % canvas.height;
    const radius = 0.6 + (i % 3) * 0.35;
    const alpha = 0.02 + (i % 6) * 0.008;
    ctx.fillStyle = `rgba(128, 117, 72, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 500; i += 1) {
    const x = (i * 41) % canvas.width;
    const y = (i * 149) % canvas.height;
    const width = 8 + (i % 6);
    const height = 2 + (i % 2);
    const alpha = 0.03 + (i % 4) * 0.012;
    ctx.fillStyle = `rgba(244, 80, 188, ${alpha})`;
    ctx.fillRect(x, y, width, height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.8, 2.8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
