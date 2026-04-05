// ============================================================
// Configurator Layout System — Builder / Input System
// Provides intuitive ways to define a building footprint:
//   1. fromPoints()     — from corner coordinates
//   2. traceLayout()    — turtle-graphics sequential walls
//   3. rectangleLayout()— shorthand for rectangles
// ============================================================

import type { Point2D, PointTuple, ConfiguratorLayoutOptions } from "./types";
import { pt, add, scale, degToRad, distance } from "./geometry";
import { ConfiguratorLayout } from "./ConfiguratorLayout";

// ---- 1. From corner points ----

/**
 * Create a configurator layout from an array of outer corner coordinates.
 *
 * Points define the building footprint in order (CW or CCW — the
 * system normalises to CW automatically). The loop is closed
 * implicitly (last point connects back to first).
 *
 * Accepts Point2D objects or [x, y] tuples for convenience.
 *
 * @example
 * ```ts
 * const house = fromPoints([
 *   [0, 0],
 *   [10000, 0],
 *   [10000, 8000],
 *   [0, 8000],
 * ]);
 * ```
 */
export function fromPoints(
  points: (Point2D | PointTuple)[],
  options?: ConfiguratorLayoutOptions,
): ConfiguratorLayout {
  if (points.length < 3) {
    throw new Error("A configurator layout requires at least 3 corner points.");
  }
  const corners = points.map((p) => (Array.isArray(p) ? pt(p) : p));
  return new ConfiguratorLayout(corners, options);
}

// ---- 2. Turtle-graphics trace builder ----

/**
 * Fluent builder for defining a layout by walking the perimeter:
 * specify wall lengths and turning angles sequentially.
 *
 * Convention:
 *   - Positive turn = left (CCW)
 *   - Negative turn = right (CW)
 *   - Default start: origin (0, 0), heading east (+X)
 *
 * The builder collects corner points and creates a ConfiguratorLayout
 * when you call `.close()`.
 *
 * @example
 * ```ts
 * // Simple rectangle
 * const house = traceLayout()
 *   .wall(10000)
 *   .turn(90)
 *   .wall(8000)
 *   .turn(90)
 *   .wall(10000)
 *   .close();
 *
 * // L-shaped house (has a reflex corner)
 * const lHouse = traceLayout()
 *   .wall(10000).turn(90)
 *   .wall(5000).turn(90)
 *   .wall(4000).turn(-90)  // right turn = reflex corner
 *   .wall(3000).turn(90)
 *   .wall(6000)
 *   .close();
 * ```
 */
export function traceLayout(
  options?: ConfiguratorLayoutOptions & {
    /** Starting point (default: { x: 0, y: 0 }) */
    start?: Point2D;
    /** Initial heading in degrees from +X axis (default: 0 = east) */
    startAngle?: number;
  },
): TraceBuilder {
  return new TraceBuilder(options);
}

export class TraceBuilder {
  private corners: Point2D[] = [];
  private currentPos: Point2D;
  private currentAngleRad: number;
  private options: ConfiguratorLayoutOptions;

  constructor(
    options?: ConfiguratorLayoutOptions & {
      start?: Point2D;
      startAngle?: number;
    },
  ) {
    this.currentPos = options?.start ?? { x: 0, y: 0 };
    this.currentAngleRad = degToRad(options?.startAngle ?? 0);
    this.options = options ?? {};
    // Record the starting corner
    this.corners.push({ ...this.currentPos });
  }

  /**
   * Add a wall of the given length (mm) in the current heading direction.
   * Records the end point as a new corner.
   */
  wall(length: number): this {
    if (length <= 0) throw new Error("Wall length must be positive.");
    const dir = {
      x: Math.cos(this.currentAngleRad),
      y: Math.sin(this.currentAngleRad),
    };
    this.currentPos = add(this.currentPos, scale(dir, length));
    this.corners.push({ ...this.currentPos });
    return this;
  }

  /**
   * Turn the heading by the given angle in degrees.
   * Positive = left (CCW), negative = right (CW).
   */
  turn(angleDegrees: number): this {
    this.currentAngleRad += degToRad(angleDegrees);
    return this;
  }

  /**
  * Close the loop back to the starting point and build the ConfiguratorLayout.
   *
   * If the last recorded corner is not the starting point, an
   * implicit closing wall is added.
   */
  close(): ConfiguratorLayout {
    const start = this.corners[0];
    const last = this.corners[this.corners.length - 1];

    // Remove the last point if it coincides with the start (already closed)
    const dist = distance(last, start);
    if (dist < 0.5) {
      // Within 0.5mm — treat as closed
      this.corners.pop();
    }
    // Otherwise the closing wall is implicit (last corner → first corner)

    if (this.corners.length < 3) {
      throw new Error("Cannot close layout: need at least 3 distinct corners.");
    }

    return new ConfiguratorLayout(this.corners, this.options);
  }
}

// ---- 3. Rectangle shorthand ----

/**
 * Create a rectangular configurator layout.
 *
 * @param width  Building width along X axis (mm)
 * @param depth  Building depth along Y axis (mm)
 * @param options Wall layout options
 *
 * Corner order (CW when viewed in standard X-right, Y-up):
 *   (0,0) → (width,0) → (width,depth) → (0,depth)
 *
 * @example
 * ```ts
 * const house = rectangleLayout(10000, 8000, { thickness: 145 });
 * ```
 */
export function rectangleLayout(
  width: number,
  depth: number,
  options?: ConfiguratorLayoutOptions,
): ConfiguratorLayout {
  if (width <= 0 || depth <= 0) {
    throw new Error("Width and depth must be positive.");
  }
  return fromPoints(
    [
      [0, 0],
      [width, 0],
      [width, depth],
      [0, depth],
    ],
    options,
  );
}
