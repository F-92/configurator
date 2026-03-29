// ============================================================
// Wall Layout System — 2D Geometry Utilities
// Pure functions for points, vectors, and line math.
// ============================================================

import type { Point2D, PointTuple } from "./types";

/** Convert a [x, y] tuple to a Point2D */
export function pt(x: number, y: number): Point2D;
export function pt(tuple: PointTuple): Point2D;
export function pt(xOrTuple: number | PointTuple, y?: number): Point2D {
  if (Array.isArray(xOrTuple)) return { x: xOrTuple[0], y: xOrTuple[1] };
  return { x: xOrTuple, y: y! };
}

// ---- Vector arithmetic ----

export function add(a: Point2D, b: Point2D): Point2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point2D, b: Point2D): Point2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Point2D, s: number): Point2D {
  return { x: v.x * s, y: v.y * s };
}

export function dot(a: Point2D, b: Point2D): number {
  return a.x * b.x + a.y * b.y;
}

/** 2D cross product (scalar): positive when b is CCW from a */
export function cross(a: Point2D, b: Point2D): number {
  return a.x * b.y - a.y * b.x;
}

export function length(v: Point2D): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Point2D): Point2D {
  const len = length(v);
  if (len < 1e-12) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function distance(a: Point2D, b: Point2D): number {
  return length(sub(b, a));
}

/** Rotate vector 90° CCW: (x, y) → (−y, x) */
export function perpCCW(v: Point2D): Point2D {
  return { x: -v.y, y: v.x };
}

/** Rotate vector 90° CW: (x, y) → (y, −x) */
export function perpCW(v: Point2D): Point2D {
  return { x: v.y, y: -v.x };
}

/** Rotate vector by angle (radians) */
export function rotate(v: Point2D, angle: number): Point2D {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

/** Angle of vector from +X axis (radians, in [−π, π]) */
export function angle(v: Point2D): number {
  return Math.atan2(v.y, v.x);
}

// ---- Polygon utilities ----

/**
 * Signed area of a simple polygon (positive = CCW, negative = CW).
 * Uses the shoelace formula.
 */
export function signedArea(points: Point2D[]): number {
  const n = points.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return area / 2;
}

/** Returns true if the polygon vertices wind clockwise */
export function isClockwise(points: Point2D[]): boolean {
  return signedArea(points) < 0;
}

/**
 * Ensure the polygon winds in the requested direction.
 * Returns the original array (or a reversed copy).
 */
export function ensureWinding(
  points: Point2D[],
  clockwise: boolean,
): Point2D[] {
  const cw = isClockwise(points);
  if (cw === clockwise) return points;
  return [...points].reverse();
}

// ---- Line intersection ----

/**
 * Intersect two infinite lines, each defined by a point and a direction.
 * Returns the intersection point, or null if lines are parallel.
 *
 * Line 1: P1 + t * d1
 * Line 2: P2 + s * d2
 */
export function lineLineIntersection(
  p1: Point2D,
  d1: Point2D,
  p2: Point2D,
  d2: Point2D,
): Point2D | null {
  const denom = cross(d1, d2);
  if (Math.abs(denom) < 1e-12) return null; // parallel
  const diff = sub(p2, p1);
  const t = cross(diff, d2) / denom;
  return add(p1, scale(d1, t));
}

/**
 * Compute the interior angle at vertex B of the triangle A → B → C,
 * measured on the interior side (left side for CCW winding).
 *
 * For a CCW polygon traversal, the interior angle is the angle you
 * turn through when walking from edge (A→B) to edge (B→C).
 *
 * Returns angle in radians (0, 2π). Convex corners < π, reflex corners > π.
 */
export function interiorAngle(
  a: Point2D,
  b: Point2D,
  c: Point2D,
  isCCW: boolean,
): number {
  const ba = normalize(sub(a, b));
  const bc = normalize(sub(c, b));
  const dotVal = dot(ba, bc);
  const crossVal = cross(ba, bc);
  // Angle between the two edges (0, π)
  let ang = Math.acos(Math.max(-1, Math.min(1, dotVal)));
  // For CCW winding: cross(ba,bc) < 0 at convex vertex → interior angle = θ
  //                   cross(ba,bc) > 0 at reflex vertex → interior angle = 2π - θ
  // For CW winding:  cross(ba,bc) > 0 at convex vertex → interior angle = θ
  //                   cross(ba,bc) < 0 at reflex vertex → interior angle = 2π - θ
  if (isCCW) {
    if (crossVal > 0) ang = 2 * Math.PI - ang;
  } else {
    if (crossVal < 0) ang = 2 * Math.PI - ang;
  }
  return ang;
}

/** Degrees to radians */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Radians to degrees */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Round a number to n decimal places (default 6) */
export function round(value: number, decimals = 6): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}
