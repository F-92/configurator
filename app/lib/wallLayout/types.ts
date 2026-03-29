// ============================================================
// Wall Layout System — Type Definitions
// All dimensions in millimeters (mm)
// ============================================================

/** 2D point in the XY plane (mm) */
export interface Point2D {
  x: number;
  y: number;
}

/** Tuple shorthand for a 2D point: [x, y] */
export type PointTuple = [number, number];

/** How a wall physically connects at a corner */
export type JointType = "through" | "butt";

/** Strategy for assigning through/butt joints around the perimeter */
export type JointStrategy = "alternating" | "custom";

/** Corner joint information for one end of a wall */
export interface CornerJoint {
  /** Whether this wall is through or butt at this end */
  joint: JointType;
  /** Interior angle at this corner (radians, 0 < angle < 2π) */
  interiorAngle: number;
  /** Index of the adjacent wall at this corner */
  adjacentWallIndex: number;
  /**
   * Retraction distance along this wall's direction (mm).
   * Positive = wall is shortened (butt end).
   * Negative = wall is extended (butt end at reflex corner).
   * Zero = wall runs to the outer corner (through end).
   */
  retraction: number;
}

/** A single stud placement within a wall */
export interface Stud {
  /** Distance from the wall's effective start to the stud center (mm) */
  centerPosition: number;
  /** Stud width across the wall face (mm) */
  width: number;
  /** Stud depth into the wall (mm) */
  depth: number;
}

/** A California corner stud — turned 90° at a through-wall end */
export interface CornerStud {
  /** Which end of the wall this stud is at */
  end: "start" | "end";
  /** Distance from effective start to stud center, along wall direction (mm) */
  centerPosition: number;
  /** Stud width (mm) */
  width: number;
  /** Stud depth (mm) */
  depth: number;
  /** Which side the stud is offset toward: inner (convex corner) or outer (reflex corner) */
  offsetSide: "inner" | "outer";
}

/** Stud layout computed for a wall */
export interface StudLayout {
  /** Target center-to-center spacing (mm) */
  targetSpacing: number;
  /** Actual center-to-center spacing used (mm) */
  actualSpacing: number;
  /** Number of stud bays (spaces between studs) */
  bayCount: number;
  /** All studs placed along this wall, including end studs */
  studs: Stud[];
  /** California corner studs — turned 90° at through-wall ends, not part of c/c */
  cornerStuds: CornerStud[];
  /** Effective wall length for stud layout — after corner adjustments (mm) */
  effectiveLength: number;
}

/** The 2D rectangular footprint of a wall, accounting for thickness and corners */
export interface WallQuad {
  /** Outer face, start end (toward the wall's start corner) */
  outerStart: Point2D;
  /** Outer face, end end (toward the wall's end corner) */
  outerEnd: Point2D;
  /** Inner face, end end */
  innerEnd: Point2D;
  /** Inner face, start end */
  innerStart: Point2D;
}

/** A resolved wall segment in the building perimeter */
export interface Wall {
  /** Unique id (auto-assigned: "wall-0", "wall-1", …) */
  id: string;
  /** Index in the perimeter loop */
  index: number;

  // ---- Centerline geometry (outer corner to outer corner) ----
  /** Outer corner at the start of this wall */
  start: Point2D;
  /** Outer corner at the end of this wall */
  end: Point2D;
  /** Centerline length between outer corners (mm) */
  centerlineLength: number;
  /** Wall thickness (mm) */
  thickness: number;
  /** Direction angle from +X axis (radians) */
  angle: number;
  /** Unit direction vector (start → end) */
  direction: Point2D;
  /** Unit inward normal (points toward building interior) */
  inwardNormal: Point2D;

  // ---- Adjacency (indices wrap around the loop) ----
  prevIndex: number;
  nextIndex: number;

  // ---- Corner info ----
  startCorner: CornerJoint;
  endCorner: CornerJoint;

  // ---- Resolved physical geometry ----
  /** Effective length after corner retractions (mm) */
  effectiveLength: number;
  /** 2D quadrilateral of the physical wall footprint */
  quad: WallQuad;

  // ---- Stud layout ----
  studLayout: StudLayout;
}

/** Options for creating a wall layout */
export interface WallLayoutOptions {
  /** Wall thickness in mm (default: 145) */
  thickness?: number;
  /** Target stud spacing center-to-center in mm (default: 600) */
  studSpacing?: number;
  /** Stud width in mm (default: 45) */
  studWidth?: number;
  /** Stud depth in mm — typically equals wall thickness (default: 145) */
  studDepth?: number;
  /**
   * Joint assignment strategy (default: "alternating").
   * "alternating" assigns through/butt in an even-odd pattern.
   * "custom" requires providing jointOverrides.
   */
  jointStrategy?: JointStrategy;
  /**
   * Per-wall joint override. Maps wall index to the JointType
   * for that wall (applied to both ends of the wall).
   * Only used when jointStrategy is "custom".
   */
  jointOverrides?: Record<number, JointType>;
}

/** The complete resolved wall layout */
export interface WallLayoutData {
  /** All walls in perimeter order */
  walls: Wall[];
  /** Outer corner points (the building footprint) */
  outerCorners: Point2D[];
  /** Inner corner points (offset inward by wall thickness) */
  innerCorners: Point2D[];
  /** Whether the outer loop winds clockwise (standard for exterior walls) */
  isClockwise: boolean;
  /** Options used to generate this layout */
  options: Required<
    Omit<WallLayoutOptions, "jointOverrides" | "jointStrategy">
  > & {
    jointStrategy: JointStrategy;
    jointOverrides: Record<number, JointType>;
  };
}
