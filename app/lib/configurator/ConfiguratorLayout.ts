// ============================================================
// Configurator Layout System — Main ConfiguratorLayout Class
// Ties together geometry, corner resolution, and stud placement.
// Supports dynamic recalculation when parameters change.
// ============================================================

import type {
  CornerStud,
  JointType,
  Point2D,
  Wall,
  ConfiguratorLayoutData,
  ConfiguratorLayoutOptions,
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

// ---- California corner stud helpers ----

/** Place California corner studs for a single wall based on joint types and corner angles. */
function placeCaliforniaStudsForWall(
  wall: Wall,
  studWidth: number,
  studDepth: number,
): void {
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

/**
 * Check if a California corner stud overlaps any interior grid stud on the same wall.
 * Returns the first overlap found, or null.
 */
function findCaliforniaOverlap(
  wall: Wall,
): { cornerStud: CornerStud; studIndex: number } | null {
  for (const cs of wall.studLayout.cornerStuds) {
    const csMin = cs.centerPosition - cs.depth / 2;
    const csMax = cs.centerPosition + cs.depth / 2;
    const studs = wall.studLayout.studs;
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

/**
 * Represents a complete building perimeter wall layout.
 *
 * Create via the builder helpers (`fromPoints`, `traceLayout`,
 * `rectangleLayout`) or directly with `new ConfiguratorLayout(corners, options)`.
 *
 * The layout is immutable after construction. To change parameters,
 * call one of the `with*` methods which return a new ConfiguratorLayout.
 */
export class ConfiguratorLayout {
  /** The resolved layout data: walls, corners, studs */
  readonly data: ConfiguratorLayoutData;

  private _corners: Point2D[];
  private _options: ConfiguratorLayoutOptions;

  constructor(corners: Point2D[], options?: ConfiguratorLayoutOptions) {
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

  // ---- Immutable updates (return a new ConfiguratorLayout) ----

  /** Return a new layout with different corner points */
  withCorners(corners: Point2D[]): ConfiguratorLayout {
    return new ConfiguratorLayout(corners, this._options);
  }

  /** Return a new layout with a single corner moved */
  withCornerMoved(index: number, newPosition: Point2D): ConfiguratorLayout {
    const corners = [...this._corners];
    corners[index] = newPosition;
    return new ConfiguratorLayout(corners, this._options);
  }

  /** Return a new layout with different wall thickness */
  withThickness(thickness: number): ConfiguratorLayout {
    return new ConfiguratorLayout(this._corners, {
      ...this._options,
      thickness,
    });
  }

  /** Return a new layout with different stud spacing */
  withStudSpacing(spacing: number): ConfiguratorLayout {
    return new ConfiguratorLayout(this._corners, {
      ...this._options,
      studSpacing: spacing,
    });
  }

  /** Return a new layout with different options */
  withOptions(options: ConfiguratorLayoutOptions): ConfiguratorLayout {
    return new ConfiguratorLayout(this._corners, {
      ...this._options,
      ...options,
    });
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

  private compute(): ConfiguratorLayoutData {
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
      placeCaliforniaStudsForWall(wall, studWidth, studDepth);
    }

    // 6. Resolve California corner stud vs regular stud overlaps.
    //    When a California stud's footprint along the wall overlaps a grid stud:
    //    (a) Try swapping which wall extends past the other at that corner.
    //        If the California stud on the other wall has no overlap, apply the swap.
    //    (b) Otherwise, remove the interfering regular stud (the pocket becomes > 600 c/c).
    for (const wall of walls) {
      const overlap = findCaliforniaOverlap(wall);
      if (!overlap) continue;

      const { cornerStud, studIndex } = overlap;
      const isEnd = cornerStud.end === "end";
      const corner = isEnd ? wall.endCorner : wall.startCorner;
      const adjIdx = corner.adjacentWallIndex;
      const otherWall = walls[adjIdx];
      const otherCornerEnd: "start" | "end" = isEnd ? "start" : "end";

      const sin = Math.sin(corner.interiorAngle);
      const safeSin = Math.abs(sin) < 1e-9 ? 1e-9 : sin;
      const isReflex = corner.interiorAngle > Math.PI;

      // Trial: compute the other wall's layout after swapping joints at this corner.
      // At convex corners the California stud sits on the through wall;
      // at reflex corners it sits on the butt wall.
      // After swap, the other wall takes that role, so compute its new retraction.
      const otherNewRet = isReflex ? wall.thickness / safeSin : 0;
      const otherTrialStartRet =
        otherCornerEnd === "start"
          ? otherNewRet
          : otherWall.startCorner.retraction;
      const otherTrialEndRet =
        otherCornerEnd === "end" ? otherNewRet : otherWall.endCorner.retraction;
      const otherEffLen = effectiveWallLength(
        otherWall.centerlineLength,
        otherTrialStartRet,
        otherTrialEndRet,
      );

      // Where the California stud would land on the other wall
      const csCenter =
        otherCornerEnd === "start"
          ? studWidth + studDepth / 2
          : otherEffLen - studWidth - studDepth / 2;
      const csMin = csCenter - studDepth / 2;
      const csMax = csCenter + studDepth / 2;

      const trialStuds = placeStuds(
        otherEffLen,
        studSpacing,
        studWidth,
        studDepth,
        otherTrialStartRet,
      );

      const swapHasOverlap = trialStuds.studs.some((s, i) => {
        if (i === 0 || i === trialStuds.studs.length - 1) return false;
        const sMin = s.centerPosition - s.width / 2;
        const sMax = s.centerPosition + s.width / 2;
        return sMin < csMax && sMax > csMin;
      });

      if (!swapHasOverlap) {
        // Swap works — flip joint types at this corner for both walls.
        const thisBecomesButt = corner.joint === "through";
        const thisNewRet = thisBecomesButt ? otherWall.thickness / safeSin : 0;
        const newThisJoint: JointType = thisBecomesButt ? "butt" : "through";

        if (isEnd) {
          wall.endCorner = {
            ...wall.endCorner,
            joint: newThisJoint,
            retraction: thisNewRet,
          };
        } else {
          wall.startCorner = {
            ...wall.startCorner,
            joint: newThisJoint,
            retraction: thisNewRet,
          };
        }

        const otherCorner =
          otherCornerEnd === "start"
            ? otherWall.startCorner
            : otherWall.endCorner;
        const newOtherJoint: JointType =
          otherCorner.joint === "through" ? "butt" : "through";
        const otherRetraction =
          newOtherJoint === "butt" ? wall.thickness / safeSin : 0;

        if (otherCornerEnd === "start") {
          otherWall.startCorner = {
            ...otherWall.startCorner,
            joint: newOtherJoint,
            retraction: otherRetraction,
          };
        } else {
          otherWall.endCorner = {
            ...otherWall.endCorner,
            joint: newOtherJoint,
            retraction: otherRetraction,
          };
        }

        // Recompute effective lengths
        wall.effectiveLength = effectiveWallLength(
          wall.centerlineLength,
          wall.startCorner.retraction,
          wall.endCorner.retraction,
        );
        otherWall.effectiveLength = effectiveWallLength(
          otherWall.centerlineLength,
          otherWall.startCorner.retraction,
          otherWall.endCorner.retraction,
        );

        // Recompute quads
        wall.quad = computeWallQuad(
          wall.start,
          wall.end,
          wall.direction,
          wall.inwardNormal,
          wall.thickness,
          wall.startCorner.retraction,
          wall.endCorner.retraction,
        );
        otherWall.quad = computeWallQuad(
          otherWall.start,
          otherWall.end,
          otherWall.direction,
          otherWall.inwardNormal,
          otherWall.thickness,
          otherWall.startCorner.retraction,
          otherWall.endCorner.retraction,
        );

        // Recompute stud layouts and California studs for both walls
        wall.studLayout = placeStuds(
          wall.effectiveLength,
          studSpacing,
          studWidth,
          studDepth,
          wall.startCorner.retraction,
        );
        otherWall.studLayout = placeStuds(
          otherWall.effectiveLength,
          studSpacing,
          studWidth,
          studDepth,
          otherWall.startCorner.retraction,
        );

        placeCaliforniaStudsForWall(wall, studWidth, studDepth);
        placeCaliforniaStudsForWall(otherWall, studWidth, studDepth);
      } else {
        // Swap doesn't help — remove the interfering regular stud.
        wall.studLayout.studs.splice(studIndex, 1);
        wall.studLayout.bayCount = wall.studLayout.studs.length - 1;
      }
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
      `ConfiguratorLayout: ${this.count} walls, thickness=${this.data.options.thickness}mm`,
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
