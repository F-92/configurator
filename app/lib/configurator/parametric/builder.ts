// ============================================================
// Parametric Wall System — Builder
//
// Entry point: buildParametricLayout(buildingOuterCorners, options)
//
// Flow:
//   1. Compute framing outer corners (offset building corners
//      inward by total exterior layer thickness)
//   2. Resolve framing joints, retractions, and angles
//   3. Place studs on framing
//   4. Resolve all layers per wall (coverage, Z depths, quads)
//   5. Package into ParametricConfiguratorLayout
// ============================================================

import type {
  Point2D,
  ParametricWall,
  ParametricConfiguratorLayout,
  ParametricWallOptions,
  WallQuad,
  WallEndpoint,
  CornerJoint,
} from "./types";
import type { CornerStud } from "../types";
import {
  sub,
  add,
  scale,
  normalize,
  distance,
  isClockwise,
  ensureWinding,
  angle as vecAngle,
} from "../geometry";
import {
  assignConnections,
  computeInnerCorners,
  resolveEndpoints,
  resolveWallLayers,
} from "./layers";
import { placeStuds } from "../studs";

// ---- Defaults ----
const DEFAULT_STUD_SPACING = 600;
const DEFAULT_STUD_WIDTH = 45;

// ---- Endpoint → CornerJoint compat ----

function endpointToCornerJoint(ep: WallEndpoint): CornerJoint {
  return {
    joint: ep.connection === "continuous" ? "through" : "butt",
    interiorAngle: ep.interiorAngle,
    adjacentWallIndex: ep.adjacentWallIndex,
    retraction: ep.retraction,
  };
}

// ---- California corner studs ----

function placeCaliforniaStuds(
  startEndpoint: WallEndpoint,
  endEndpoint: WallEndpoint,
  effectiveLength: number,
  studWidth: number,
  studDepth: number,
): CornerStud[] {
  const cs: CornerStud[] = [];

  const startReflex = startEndpoint.cornerType === "internal";
  if (
    (!startReflex && startEndpoint.connection === "continuous") ||
    (startReflex && startEndpoint.connection === "butt")
  ) {
    cs.push({
      end: "start",
      centerPosition: studWidth + studDepth / 2,
      width: studWidth,
      depth: studDepth,
      offsetSide: startReflex ? "outer" : "inner",
    });
  }

  const endReflex = endEndpoint.cornerType === "internal";
  if (
    (!endReflex && endEndpoint.connection === "continuous") ||
    (endReflex && endEndpoint.connection === "butt")
  ) {
    cs.push({
      end: "end",
      centerPosition: effectiveLength - studWidth - studDepth / 2,
      width: studWidth,
      depth: studDepth,
      offsetSide: endReflex ? "outer" : "inner",
    });
  }

  return cs;
}

function findCaliforniaOverlap(
  cornerStuds: CornerStud[],
  studs: { centerPosition: number; width: number }[],
): { cornerStud: CornerStud; studIndex: number } | null {
  for (const cs of cornerStuds) {
    const csMin = cs.centerPosition - cs.depth / 2;
    const csMax = cs.centerPosition + cs.depth / 2;
    for (let i = 1; i < studs.length - 1; i++) {
      const sMin = studs[i].centerPosition - studs[i].width / 2;
      const sMax = studs[i].centerPosition + studs[i].width / 2;
      if (sMin < csMax && sMax > csMin) {
        return { cornerStud: cs, studIndex: i };
      }
    }
  }
  return null;
}

// ---- Framing quad ----

function computeFramingQuad(
  start: Point2D,
  end: Point2D,
  direction: Point2D,
  inwardNormal: Point2D,
  thickness: number,
  startRetraction: number,
  endRetraction: number,
): WallQuad {
  const outerStart = add(start, scale(direction, startRetraction));
  const outerEnd = sub(end, scale(direction, endRetraction));
  const innerStart = add(outerStart, scale(inwardNormal, thickness));
  const innerEnd = add(outerEnd, scale(inwardNormal, thickness));
  return { outerStart, outerEnd, innerEnd, innerStart };
}

// ---- Shell quad (full assembly) ----

function computeShellQuad(
  start: Point2D,
  end: Point2D,
  direction: Point2D,
  outwardNormal: Point2D,
  inwardNormal: Point2D,
  startRetraction: number,
  endRetraction: number,
  exteriorThickness: number,
  framingThickness: number,
  interiorThickness: number,
): WallQuad {
  // Shell outer face: offset outward from framing by exterior layers
  const framingOuterStart = add(start, scale(direction, startRetraction));
  const framingOuterEnd = sub(end, scale(direction, endRetraction));

  const shellOuterStart = add(
    framingOuterStart,
    scale(outwardNormal, exteriorThickness),
  );
  const shellOuterEnd = add(
    framingOuterEnd,
    scale(outwardNormal, exteriorThickness),
  );

  const totalInward = framingThickness + interiorThickness;
  const shellInnerStart = add(
    framingOuterStart,
    scale(inwardNormal, totalInward),
  );
  const shellInnerEnd = add(framingOuterEnd, scale(inwardNormal, totalInward));

  return {
    outerStart: shellOuterStart,
    outerEnd: shellOuterEnd,
    innerEnd: shellInnerEnd,
    innerStart: shellInnerStart,
  };
}

// ---- Main builder ----

export function buildParametricLayout(
  buildingOuterCorners: Point2D[],
  options: ParametricWallOptions,
): ParametricConfiguratorLayout {
  const { layers, connectionStrategy, connectionOverrides } = options;

  const studSpacing = options.studSpacing ?? DEFAULT_STUD_SPACING;
  const studWidth = options.studWidth ?? DEFAULT_STUD_WIDTH;

  // 1. Find framing layer and compute thickness sums
  const framingDef = layers.find((l) => l.order === 0);
  if (!framingDef) {
    throw new Error(
      "Layer definitions must include exactly one layer with order=0 (framing)",
    );
  }
  const framingThickness = framingDef.thickness;
  const studDepth = options.studDepth ?? framingThickness;

  const exteriorLayers = layers
    .filter((l) => l.side === "exterior" && l.order > 0)
    .sort((a, b) => a.order - b.order);
  const interiorLayers = layers
    .filter((l) => l.side === "interior" && l.order > 0)
    .sort((a, b) => a.order - b.order);

  const exteriorThickness = exteriorLayers.reduce((s, l) => s + l.thickness, 0);
  const interiorThickness = interiorLayers.reduce((s, l) => s + l.thickness, 0);
  const totalThickness =
    exteriorThickness + framingThickness + interiorThickness;

  // 2. Normalise building corners to CW
  const buildingCorners = ensureWinding(buildingOuterCorners, true);

  // 3. Compute framing outer corners (offset inward by exterior layers)
  const framingOuterCorners =
    exteriorThickness > 0
      ? computeInnerCorners(buildingCorners, exteriorThickness)
      : [...buildingCorners];

  // 4. Compute framing inner corners (offset from framing outer by framing thickness)
  const framingInnerCorners = computeInnerCorners(
    framingOuterCorners,
    framingThickness,
  );

  // 4b. Compute innermost corners (offset from building corners by total thickness)
  const innerCorners = computeInnerCorners(buildingCorners, totalThickness);

  // 5. Assign connections
  const n = framingOuterCorners.length;
  const connections = assignConnections(
    n,
    connectionStrategy,
    connectionOverrides,
  );

  // 6. Resolve framing endpoints (joints, retractions, angles)
  const { startEndpoints, endEndpoints } = resolveEndpoints(
    framingOuterCorners,
    connections,
    framingThickness,
  );

  // 7. Determine winding direction
  const cw = isClockwise(framingOuterCorners);
  const isCCW = !cw;

  // 8. Build walls
  const walls: ParametricWall[] = [];

  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const start = framingOuterCorners[i];
    const end = framingOuterCorners[next];

    const diff = sub(end, start);
    const centerlineLength = distance(start, end);
    const direction = normalize(diff);
    const wallAngle = vecAngle(direction);

    const inwardNormal = isCCW
      ? { x: -direction.y, y: direction.x }
      : { x: direction.y, y: -direction.x };
    const outwardNormal = { x: -inwardNormal.x, y: -inwardNormal.y };

    const startEp = startEndpoints[i];
    const endEp = endEndpoints[i];

    // Framing effective length
    const effectiveLength =
      centerlineLength - startEp.retraction - endEp.retraction;

    // Framing quad
    const quad = computeFramingQuad(
      start,
      end,
      direction,
      inwardNormal,
      framingThickness,
      startEp.retraction,
      endEp.retraction,
    );

    // Shell quad
    const shellQuad = computeShellQuad(
      start,
      end,
      direction,
      outwardNormal,
      inwardNormal,
      startEp.retraction,
      endEp.retraction,
      exteriorThickness,
      framingThickness,
      interiorThickness,
    );

    // Studs
    const studLayout = placeStuds(
      effectiveLength,
      studSpacing,
      studWidth,
      studDepth,
      startEp.retraction,
    );

    // California corner studs
    const cornerStuds = placeCaliforniaStuds(
      startEp,
      endEp,
      effectiveLength,
      studWidth,
      studDepth,
    );
    studLayout.cornerStuds = cornerStuds;

    // Resolve California overlaps (remove interfering regular stud)
    const overlap = findCaliforniaOverlap(cornerStuds, studLayout.studs);
    if (overlap) {
      studLayout.studs.splice(overlap.studIndex, 1);
    }

    // Resolve all layers
    const resolvedLayers = resolveWallLayers(
      layers,
      start,
      direction,
      inwardNormal,
      centerlineLength,
      startEp,
      endEp,
    );

    walls.push({
      id: `wall-${i}`,
      index: i,
      start,
      end,
      centerlineLength,
      angle: wallAngle,
      direction,
      inwardNormal,
      prevIndex: (i - 1 + n) % n,
      nextIndex: next,
      startEndpoint: startEp,
      endEndpoint: endEp,
      thickness: framingThickness,
      effectiveLength,
      quad,
      studLayout,
      startCorner: endpointToCornerJoint(startEp),
      endCorner: endpointToCornerJoint(endEp),
      totalThickness,
      shellQuad,
      layers: resolvedLayers,
    });
  }

  // Cross-wall California overlap resolution:
  // Try swapping joints at corners where California studs overlap.
  // This is a simplified version — for the full swap logic, see
  // the old ConfiguratorLayout class. Here we just remove overlapping studs.
  for (const wall of walls) {
    const overlap2 = findCaliforniaOverlap(
      wall.studLayout.cornerStuds,
      wall.studLayout.studs,
    );
    if (overlap2) {
      wall.studLayout.studs.splice(overlap2.studIndex, 1);
    }
  }

  return {
    walls,
    buildingOuterCorners: buildingCorners,
    framingOuterCorners,
    framingInnerCorners,
    innerCorners,
    layerDefs: layers,
  };
}
