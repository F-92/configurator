// ============================================================
// Parametric Wall System — Layer Resolution
//
// Computes coverage ranges, Z depths, and 2D quads for every
// layer on every wall.  Uses the framing wall as the reference
// coordinate system so rendering components can work in the
// same local space they always have.
// ============================================================

import type {
  Point2D,
  ConnectionType,
  CornerType,
  LayerDef,
  ResolvedLayer,
  WallEndpoint,
  WallQuad,
} from "./types";
import {
  add,
  sub,
  scale,
  normalize,
  interiorAngle,
  isClockwise,
  lineLineIntersection,
} from "../geometry";

const MM = 0.001; // mm → meters

// ---- Connection assignment ----

export function assignConnections(
  wallCount: number,
  strategy: "alternating" | "custom" = "alternating",
  overrides: Record<number, ConnectionType> = {},
): ConnectionType[] {
  const connections: ConnectionType[] = new Array(wallCount);
  if (strategy === "custom") {
    for (let i = 0; i < wallCount; i++) {
      connections[i] = overrides[i] ?? "continuous";
    }
    return connections;
  }
  for (let i = 0; i < wallCount; i++) {
    connections[i] = overrides[i] ?? (i % 2 === 0 ? "continuous" : "butt");
  }
  return connections;
}

// ---- Corner classification ----

export function classifyCorner(
  prev: Point2D,
  curr: Point2D,
  next: Point2D,
  isCCW: boolean,
): { cornerType: CornerType; angle: number } {
  const angle = interiorAngle(prev, curr, next, isCCW);
  return {
    cornerType: angle <= Math.PI ? "external" : "internal",
    angle,
  };
}

// ---- Inner corners (offset polygon) ----

export function computeInnerCorners(
  outerCorners: Point2D[],
  thickness: number,
): Point2D[] {
  const n = outerCorners.length;
  const cw = isClockwise(outerCorners);
  const isCCW = !cw;

  const innerLines: { point: Point2D; dir: Point2D }[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dir = normalize(sub(outerCorners[next], outerCorners[i]));
    const inwardNormal = isCCW
      ? { x: -dir.y, y: dir.x }
      : { x: dir.y, y: -dir.x };
    const innerPoint = add(outerCorners[i], scale(inwardNormal, thickness));
    innerLines.push({ point: innerPoint, dir });
  }

  const result: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const intersection = lineLineIntersection(
      innerLines[prev].point,
      innerLines[prev].dir,
      innerLines[i].point,
      innerLines[i].dir,
    );
    result.push(intersection ?? outerCorners[i]);
  }
  return result;
}

// ---- Endpoint resolution ----

export function resolveEndpoints(
  framingOuterCorners: Point2D[],
  connections: ConnectionType[],
  framingThickness: number,
): { startEndpoints: WallEndpoint[]; endEndpoints: WallEndpoint[] } {
  const n = framingOuterCorners.length;
  const cw = isClockwise(framingOuterCorners);
  const isCCW = !cw;

  const startEndpoints: WallEndpoint[] = [];
  const endEndpoints: WallEndpoint[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    const intAngle = interiorAngle(
      framingOuterCorners[prev],
      framingOuterCorners[i],
      framingOuterCorners[next],
      isCCW,
    );

    const cornerType: CornerType =
      intAngle <= Math.PI ? "external" : "internal";

    // Resolve who is continuous and who is butt at this corner
    const connPrev = connections[prev];
    const connThis = connections[i];
    let prevEndConn: ConnectionType;
    let thisStartConn: ConnectionType;
    if (connPrev !== connThis) {
      prevEndConn = connPrev;
      thisStartConn = connThis;
    } else {
      prevEndConn = "continuous";
      thisStartConn = "butt";
    }

    const sin = Math.sin(intAngle);
    const safeSin = Math.abs(sin) < 1e-9 ? 1e-9 : sin;

    const prevEndRetraction =
      prevEndConn === "butt" ? framingThickness / safeSin : 0;
    const thisStartRetraction =
      thisStartConn === "butt" ? framingThickness / safeSin : 0;

    startEndpoints.push({
      outerCorner: framingOuterCorners[i],
      cornerType,
      connection: thisStartConn,
      interiorAngle: intAngle,
      adjacentWallIndex: prev,
      retraction: thisStartRetraction,
    });

    endEndpoints[prev] = {
      outerCorner: framingOuterCorners[i],
      cornerType,
      connection: prevEndConn,
      interiorAngle: intAngle,
      adjacentWallIndex: i,
      retraction: prevEndRetraction,
    };
  }

  return { startEndpoints, endEndpoints };
}

// ---- Layer coverage computation ----

/**
 * Compute the coverage range for a layer along the wall.
 *
 * Coverage is measured from the framing outer start corner (wall.start).
 *
 * Rules:
 * - Butt + external: extend by cumulative depth (wraps around corner)
 * - Butt + internal: inset by cumulative depth
 * - Continuous + external (exterior layers): extend by depth of all
 *   more-interior exterior layers (fills gap behind adjacent butt wall)
 * - Otherwise: no adjustment
 *
 * @param cumulativeDepth  Total distance from framing outer face to this
 *                         layer's outer face (mm).  For exterior layers
 *                         this equals the sum of all exterior layers
 *                         between framing and this layer (inclusive).
 * @param innerLayersDepth Sum of exterior layer thicknesses between
 *                         framing and this layer (exclusive of this layer).
 */
function computeLayerCoverage(
  startEndpoint: WallEndpoint,
  endEndpoint: WallEndpoint,
  centerlineLength: number,
  cumulativeDepth: number,
  innerLayersDepth: number,
  side: "exterior" | "interior",
): { coverageStart: number; coverageEnd: number } {
  const startOffset = -startEndpoint.retraction;

  let startAdj = 0;
  let endAdj = 0;

  if (side === "exterior") {
    // Butt adjustments
    if (startEndpoint.connection === "butt") {
      if (startEndpoint.cornerType === "external") {
        startAdj = cumulativeDepth;
      } else {
        startAdj = -cumulativeDepth;
      }
    }
    if (endEndpoint.connection === "butt") {
      if (endEndpoint.cornerType === "external") {
        endAdj = cumulativeDepth;
      } else {
        endAdj = -cumulativeDepth;
      }
    }

    // Continuous + external: fill gap behind adjacent butt wall's layers
    if (
      startEndpoint.connection === "continuous" &&
      startEndpoint.cornerType === "external" &&
      innerLayersDepth > 0
    ) {
      startAdj = innerLayersDepth;
    }
    if (
      endEndpoint.connection === "continuous" &&
      endEndpoint.cornerType === "external" &&
      innerLayersDepth > 0
    ) {
      endAdj = innerLayersDepth;
    }
  } else {
    // Interior layers: opposite corner behavior
    if (startEndpoint.connection === "butt") {
      if (startEndpoint.cornerType === "external") {
        startAdj = -cumulativeDepth; // shorter at convex
      } else {
        startAdj = cumulativeDepth; // longer at reflex
      }
    }
    if (endEndpoint.connection === "butt") {
      if (endEndpoint.cornerType === "external") {
        endAdj = -cumulativeDepth;
      } else {
        endAdj = cumulativeDepth;
      }
    }
  }

  return {
    coverageStart: startOffset - startAdj,
    coverageEnd: startOffset + centerlineLength + endAdj,
  };
}

// ---- Resolve all layers for one wall ----

export function resolveWallLayers(
  layerDefs: LayerDef[],
  wallStart: Point2D,
  wallDirection: Point2D,
  wallInwardNormal: Point2D,
  centerlineLength: number,
  startEndpoint: WallEndpoint,
  endEndpoint: WallEndpoint,
): Record<string, ResolvedLayer> {
  const result: Record<string, ResolvedLayer> = {};
  const outN = { x: -wallInwardNormal.x, y: -wallInwardNormal.y };

  const framingDef = layerDefs.find((l) => l.order === 0);
  const framingThickness = framingDef?.thickness ?? 0;
  const framingHalf = framingThickness / 2;

  // Sort: framing first, then exterior by order, then interior by order
  const sorted = [...layerDefs].sort((a, b) => {
    if (a.order === 0) return -1;
    if (b.order === 0) return 1;
    if (a.side !== b.side) return a.side === "exterior" ? -1 : 1;
    return a.order - b.order;
  });

  // Compute cumulative depth info for all layers
  // Exterior layers stack outward from framing outer face
  // Interior layers stack inward from framing inner face
  let extCursor = 0; // mm, cumulative exterior depth from framing outer face
  let intCursor = 0; // mm, cumulative interior depth from framing inner face

  for (const def of sorted) {
    let outerFaceZ: number;
    let innerFaceZ: number;
    let cumulativeDepth: number;
    let innerLayersDepth: number;
    let coverage: { coverageStart: number; coverageEnd: number };

    if (def.order === 0) {
      // Framing
      outerFaceZ = -framingHalf * MM;
      innerFaceZ = framingHalf * MM;
      cumulativeDepth = 0;
      innerLayersDepth = 0;
      coverage = computeLayerCoverage(
        startEndpoint,
        endEndpoint,
        centerlineLength,
        0,
        0,
        "exterior",
      );
    } else if (def.side === "exterior") {
      innerLayersDepth = extCursor;
      extCursor += def.thickness;
      cumulativeDepth = extCursor;
      innerFaceZ = -(framingHalf + innerLayersDepth) * MM;
      outerFaceZ = -(framingHalf + cumulativeDepth) * MM;
      coverage = computeLayerCoverage(
        startEndpoint,
        endEndpoint,
        centerlineLength,
        cumulativeDepth,
        innerLayersDepth,
        "exterior",
      );
    } else {
      innerLayersDepth = intCursor;
      intCursor += def.thickness;
      cumulativeDepth = intCursor;
      outerFaceZ = (framingHalf + innerLayersDepth) * MM;
      innerFaceZ = (framingHalf + cumulativeDepth) * MM;
      coverage = computeLayerCoverage(
        startEndpoint,
        endEndpoint,
        centerlineLength,
        cumulativeDepth,
        innerLayersDepth,
        "interior",
      );
    }

    const depthM = Math.abs(innerFaceZ - outerFaceZ);
    const centerZ = (outerFaceZ + innerFaceZ) / 2;

    // Compute 2D quad corner points in world coordinates (mm)
    // The perpendicular offset from wall.start (framing outer corner)
    // is measured along the outward normal.
    // Z = 0 is framing center.  outerFaceZ is in meters.
    // Perpendicular mm from framing outer face = -outerFaceZ / MM - framingHalf
    // (because outerFaceZ of framing outer face = -framingHalf * MM)
    const perpOuter = -outerFaceZ / MM - framingHalf;
    const perpInner = -innerFaceZ / MM - framingHalf;

    const computePoint = (alongMm: number, perpMm: number): Point2D => ({
      x: wallStart.x + wallDirection.x * alongMm + outN.x * perpMm,
      y: wallStart.y + wallDirection.y * alongMm + outN.y * perpMm,
    });

    const quad: WallQuad = {
      outerStart: computePoint(coverage.coverageStart, perpOuter),
      outerEnd: computePoint(coverage.coverageEnd, perpOuter),
      innerEnd: computePoint(coverage.coverageEnd, perpInner),
      innerStart: computePoint(coverage.coverageStart, perpInner),
    };

    result[def.id] = {
      def,
      coverageStart: coverage.coverageStart,
      coverageEnd: coverage.coverageEnd,
      outerFaceZ,
      innerFaceZ,
      centerZ,
      depthM,
      quad,
    };
  }

  return result;
}
