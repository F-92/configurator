// ============================================================
// Wall Layout System — Corner Resolution
// Determines joint types (through/butt) and computes retractions,
// inner corners, and physical wall quadrilaterals.
// ============================================================

import type {
  Point2D,
  CornerJoint,
  JointType,
  WallQuad,
  ConfiguratorLayoutOptions,
} from "./types";
import {
  sub,
  add,
  scale,
  normalize,
  interiorAngle,
  isClockwise,
  lineLineIntersection,
} from "./geometry";

// ---- Joint assignment ----

/**
 * Assign joint types (through/butt) around the perimeter.
 *
 * "alternating": even-index walls are through at both ends,
 *   odd-index walls are butt at both ends.
 *
 * For odd wall counts, the last wall gets a through start / butt end
 * to resolve the conflict.
 */
export function assignJoints(
  wallCount: number,
  options: Pick<ConfiguratorLayoutOptions, "jointStrategy" | "jointOverrides">,
): JointType[] {
  const strategy = options.jointStrategy ?? "alternating";
  const overrides = options.jointOverrides ?? {};

  const joints: JointType[] = new Array(wallCount);

  if (strategy === "custom") {
    for (let i = 0; i < wallCount; i++) {
      joints[i] = overrides[i] ?? "through";
    }
    return joints;
  }

  // Alternating: even = through, odd = butt
  for (let i = 0; i < wallCount; i++) {
    joints[i] = overrides[i] ?? (i % 2 === 0 ? "through" : "butt");
  }
  return joints;
}

// ---- Corner geometry ----

/**
 * For each corner (junction of wall[i] and wall[i+1]), compute:
 * - The interior angle
 * - The retraction for the wall that is "butt" at that corner
 *
 * @param corners  Outer corner points (the building footprint)
 * @param joints   Per-wall joint types from assignJoints()
 * @param thickness Per-wall thickness (mm); if a single number, all walls get the same
 * @returns { startCorner, endCorner } arrays indexed by wall index
 */
export function resolveCorners(
  corners: Point2D[],
  joints: JointType[],
  thickness: number | number[],
): { startCorners: CornerJoint[]; endCorners: CornerJoint[] } {
  const n = corners.length;
  const cw = isClockwise(corners);
  const isCCW = !cw;

  const getThickness = (i: number) =>
    typeof thickness === "number" ? thickness : thickness[i];

  const startCorners: CornerJoint[] = [];
  const endCorners: CornerJoint[] = [];

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;

    // Corner at the START of wall[i] = junction of wall[prev] and wall[i]
    const prevCorner = corners[prev];
    const thisCorner = corners[i];
    const nextCorner = corners[next];

    // Interior angle at thisCorner (between wall[prev] ending and wall[i] starting)
    const intAngle = interiorAngle(prevCorner, thisCorner, nextCorner, isCCW);

    // Retraction for wall[i] at its START (butt at start)
    // and for wall[prev] at its END
    const jointPrev = joints[prev];
    const jointThis = joints[i];

    // At this corner: wall[prev].endCorner and wall[i].startCorner
    // One should be through, the other butt.
    // If both are the same type, we treat the first as through.
    let prevEndJoint: JointType;
    let thisStartJoint: JointType;

    if (jointPrev !== jointThis) {
      prevEndJoint = jointPrev;
      thisStartJoint = jointThis;
    } else {
      // Conflict: both same type. Resolve by making prev through, this butt.
      prevEndJoint = "through";
      thisStartJoint = "butt";
    }

    // Compute retractions
    const sin = Math.sin(intAngle);
    const safeSin = Math.abs(sin) < 1e-9 ? 1e-9 : sin;

    let prevEndRetraction = 0;
    let thisStartRetraction = 0;

    if (prevEndJoint === "butt") {
      // wall[prev] is butt at its end → retracted by wall[i]'s thickness
      prevEndRetraction = getThickness(i) / safeSin;
    }
    if (thisStartJoint === "butt") {
      // wall[i] is butt at its start → retracted by wall[prev]'s thickness
      thisStartRetraction = getThickness(prev) / safeSin;
    }

    // Store wall[i]'s startCorner
    startCorners.push({
      joint: thisStartJoint,
      interiorAngle: intAngle,
      adjacentWallIndex: prev,
      retraction: thisStartRetraction,
    });

    // Store wall[prev]'s endCorner (we'll fill it by index below)
    // We accumulate end corners separately keyed by prev
    endCorners[prev] = {
      joint: prevEndJoint,
      interiorAngle: intAngle,
      adjacentWallIndex: i,
      retraction: prevEndRetraction,
    };
  }

  return { startCorners, endCorners };
}

// ---- Inner corners ----

/**
 * Compute the inner polygon by offsetting each wall inward by its thickness.
 * Each inner corner is the intersection of two adjacent inner-face lines.
 */
export function computeInnerCorners(
  corners: Point2D[],
  thickness: number | number[],
): Point2D[] {
  const n = corners.length;
  const cw = isClockwise(corners);
  const isCCW = !cw;

  const getThickness = (i: number) =>
    typeof thickness === "number" ? thickness : thickness[i];

  // For each wall, compute its inner face line (point + direction)
  const innerLines: { point: Point2D; dir: Point2D }[] = [];
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n;
    const dir = normalize(sub(corners[next], corners[i]));
    const inwardNormal = isCCW
      ? { x: -dir.y, y: dir.x }
      : { x: dir.y, y: -dir.x };
    const innerPoint = add(corners[i], scale(inwardNormal, getThickness(i)));
    innerLines.push({ point: innerPoint, dir });
  }

  // Each inner corner is the intersection of wall[prev]'s inner line and wall[i]'s inner line
  const innerCorners: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const intersection = lineLineIntersection(
      innerLines[prev].point,
      innerLines[prev].dir,
      innerLines[i].point,
      innerLines[i].dir,
    );
    // If parallel walls (e.g., 180° angle), use the midpoint
    innerCorners.push(
      intersection ?? add(corners[i], scale(innerLines[i].dir, 0)),
    );
  }

  return innerCorners;
}

// ---- Wall quad geometry ----

/**
 * Compute the physical 2D quadrilateral for a wall, accounting for
 * corner retractions.
 *
 * The wall's outer face runs between `start` and `end` (outer corners).
 * Retractions shorten the wall at butt ends.
 * The quad's inner edge is offset inward by thickness.
 */
export function computeWallQuad(
  start: Point2D,
  end: Point2D,
  direction: Point2D,
  inwardNormal: Point2D,
  thickness: number,
  startRetraction: number,
  endRetraction: number,
): WallQuad {
  // Physical start/end on the outer face
  const outerStart = add(start, scale(direction, startRetraction));
  const outerEnd = sub(end, scale(direction, endRetraction));

  // Inner face (offset inward)
  const innerStart = add(outerStart, scale(inwardNormal, thickness));
  const innerEnd = add(outerEnd, scale(inwardNormal, thickness));

  return { outerStart, outerEnd, innerEnd, innerStart };
}

/**
 * Compute the effective wall length after corner retractions.
 */
export function effectiveWallLength(
  centerlineLength: number,
  startRetraction: number,
  endRetraction: number,
): number {
  return centerlineLength - startRetraction - endRetraction;
}
