// ============================================================
// Wall Layout System — Main WallLayout Class
// Ties together geometry, corner resolution, and stud placement.
// Supports dynamic recalculation when parameters change.
// ============================================================

import type {
  CornerStud,
  Point2D,
  Wall,
  WallLayoutData,
  WallLayoutOptions,
} from "./types";
import {
  sub,
  normalize,
  distance,
  angle as vecAngle,
  ensureWinding,
} from "./geometry";
import {
  assignJoints,
  resolveCorners,
  computeInnerCorners,
  computeWallQuad,
  effectiveWallLength,
} from "./corners";
import { placeStuds } from "./studs";

// ---- Defaults (Swedish standard timber framing) ----
const DEFAULT_THICKNESS = 145; // mm
const DEFAULT_STUD_SPACING = 600; // mm c/c
const DEFAULT_STUD_WIDTH = 45; // mm
const DEFAULT_STUD_DEPTH = 145; // mm

/**
 * Represents a complete building perimeter wall layout.
 *
 * Create via the builder helpers (`fromPoints`, `traceLayout`,
 * `rectangleLayout`) or directly with `new WallLayout(corners, options)`.
 *
 * The layout is immutable after construction. To change parameters,
 * call one of the `with*` methods which return a new WallLayout.
 */
export class WallLayout {
  /** The resolved layout data: walls, corners, studs */
  readonly data: WallLayoutData;

  private _corners: Point2D[];
  private _options: WallLayoutOptions;

  constructor(corners: Point2D[], options?: WallLayoutOptions) {
    if (corners.length < 3) {
      throw new Error("Need at least 3 corner points.");
    }
    this._corners = corners;
    this._options = options ?? {};
    this.data = this.compute();
  }

  // ---- Public accessors ----

  get walls(): Wall[] {
    return this.data.walls;
  }

  get outerCorners(): Point2D[] {
    return this.data.outerCorners;
  }

  get innerCorners(): Point2D[] {
    return this.data.innerCorners;
  }

  /** Get a wall by index */
  wall(index: number): Wall {
    const w = this.data.walls[index];
    if (!w) throw new Error(`No wall at index ${index}`);
    return w;
  }

  /** Get a wall by id (e.g. "wall-0") */
  wallById(id: string): Wall | undefined {
    return this.data.walls.find((w) => w.id === id);
  }

  /** Total number of walls */
  get count(): number {
    return this.data.walls.length;
  }

  // ---- Immutable updates (return a new WallLayout) ----

  /** Return a new layout with different corner points */
  withCorners(corners: Point2D[]): WallLayout {
    return new WallLayout(corners, this._options);
  }

  /** Return a new layout with a single corner moved */
  withCornerMoved(index: number, newPosition: Point2D): WallLayout {
    const corners = [...this._corners];
    corners[index] = newPosition;
    return new WallLayout(corners, this._options);
  }

  /** Return a new layout with different wall thickness */
  withThickness(thickness: number): WallLayout {
    return new WallLayout(this._corners, { ...this._options, thickness });
  }

  /** Return a new layout with different stud spacing */
  withStudSpacing(spacing: number): WallLayout {
    return new WallLayout(this._corners, {
      ...this._options,
      studSpacing: spacing,
    });
  }

  /** Return a new layout with different options */
  withOptions(options: WallLayoutOptions): WallLayout {
    return new WallLayout(this._corners, { ...this._options, ...options });
  }

  // ---- Traversal helpers ----

  /** Iterate over walls in perimeter order */
  [Symbol.iterator](): Iterator<Wall> {
    return this.data.walls[Symbol.iterator]();
  }

  /** Walk the perimeter, calling fn for each wall */
  forEach(fn: (wall: Wall, index: number) => void): void {
    this.data.walls.forEach(fn);
  }

  /** Map over walls */
  map<T>(fn: (wall: Wall, index: number) => T): T[] {
    return this.data.walls.map(fn);
  }

  // ---- Core computation ----

  private compute(): WallLayoutData {
    const thickness = this._options.thickness ?? DEFAULT_THICKNESS;
    const studSpacing = this._options.studSpacing ?? DEFAULT_STUD_SPACING;
    const studWidth = this._options.studWidth ?? DEFAULT_STUD_WIDTH;
    const studDepth = this._options.studDepth ?? thickness;
    const jointStrategy = this._options.jointStrategy ?? "alternating";
    const jointOverrides = this._options.jointOverrides ?? {};

    // Normalise to CW winding (standard for exterior walls viewed top-down
    // with Y-up: the interior is to the left of the walking direction)
    const outerCorners = ensureWinding(this._corners, true);
    const clockwise = true;
    const n = outerCorners.length;

    // 1. Assign through/butt joints
    const joints = assignJoints(n, { jointStrategy, jointOverrides });

    // 2. Resolve corners (retractions)
    const { startCorners, endCorners } = resolveCorners(
      outerCorners,
      joints,
      thickness,
    );

    // 3. Compute inner corners
    const innerCorners = computeInnerCorners(outerCorners, thickness);

    // 4. Build wall objects
    const walls: Wall[] = [];
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      const start = outerCorners[i];
      const end = outerCorners[next];

      const diff = sub(end, start);
      const centerlineLength = distance(start, end);
      const direction = normalize(diff);
      const wallAngle = vecAngle(direction);

      // Inward normal for CW winding: interior is to the RIGHT of direction
      // Right of (dx, dy) = (dy, -dx)
      const inwardNormal = { x: direction.y, y: -direction.x };

      const startCorner = startCorners[i];
      const endCorner = endCorners[i];

      const effLength = effectiveWallLength(
        centerlineLength,
        startCorner.retraction,
        endCorner.retraction,
      );

      const quad = computeWallQuad(
        start,
        end,
        direction,
        inwardNormal,
        thickness,
        startCorner.retraction,
        endCorner.retraction,
      );

      const studLayout = placeStuds(
        effLength,
        studSpacing,
        studWidth,
        studDepth,
        startCorner.retraction,
      );

      walls.push({
        id: `wall-${i}`,
        index: i,
        start,
        end,
        centerlineLength,
        thickness,
        angle: wallAngle,
        direction,
        inwardNormal,
        prevIndex: (i - 1 + n) % n,
        nextIndex: next,
        startCorner,
        endCorner,
        effectiveLength: effLength,
        quad,
        studLayout,
      });
    }

    // 5. Add California corner studs.
    //    - Convex corner (≤180°): stud on the THROUGH wall, inner side
    //    - Reflex corner (>180°): stud on the BUTT wall, outer side
    for (const wall of walls) {
      const cs: CornerStud[] = [];

      const startReflex = wall.startCorner.interiorAngle > Math.PI;
      if (
        (!startReflex && wall.startCorner.joint === "through") ||
        (startReflex && wall.startCorner.joint === "butt")
      ) {
        cs.push({
          end: "start",
          centerPosition: studWidth + studDepth / 2,
          width: studWidth,
          depth: studDepth,
          offsetSide: startReflex ? "outer" : "inner",
        });
      }

      const endReflex = wall.endCorner.interiorAngle > Math.PI;
      if (
        (!endReflex && wall.endCorner.joint === "through") ||
        (endReflex && wall.endCorner.joint === "butt")
      ) {
        cs.push({
          end: "end",
          centerPosition: wall.effectiveLength - studWidth - studDepth / 2,
          width: studWidth,
          depth: studDepth,
          offsetSide: endReflex ? "outer" : "inner",
        });
      }

      wall.studLayout.cornerStuds = cs;
    }

    return {
      walls,
      outerCorners,
      innerCorners,
      isClockwise: clockwise,
      options: {
        thickness,
        studSpacing,
        studWidth,
        studDepth,
        jointStrategy,
        jointOverrides,
      },
    };
  }

  // ---- Debug / inspection ----

  /** Return a human-readable summary of the layout */
  summary(): string {
    const lines: string[] = [
      `WallLayout: ${this.count} walls, thickness=${this.data.options.thickness}mm`,
      `  Stud spacing: target=${this.data.options.studSpacing}mm`,
      "",
    ];
    for (const w of this.data.walls) {
      const joint = `${w.startCorner.joint[0].toUpperCase()}/${w.endCorner.joint[0].toUpperCase()}`;
      lines.push(
        `  ${w.id}: ` +
          `centerline=${w.centerlineLength.toFixed(0)}mm, ` +
          `effective=${w.effectiveLength.toFixed(0)}mm, ` +
          `joints=${joint}, ` +
          `studs=${w.studLayout.studs.length} ` +
          `(c/c ${w.studLayout.actualSpacing.toFixed(1)}mm)`,
      );
    }
    return lines.join("\n");
  }
}
