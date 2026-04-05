// ============================================================
// Parametric Wall System — Type Definitions
// All dimensions in millimeters (mm) unless noted.
// Z depths are in meters (m) relative to framing center.
// ============================================================

import type {
  Point2D,
  PointTuple,
  Stud,
  CornerStud,
  StudLayout,
  WallQuad,
  WallOpening,
  CornerJoint,
} from "../types";

// Re-export types consumers will need
export type {
  Point2D,
  PointTuple,
  Stud,
  CornerStud,
  StudLayout,
  WallQuad,
  WallOpening,
  CornerJoint,
};

// ---- Corner & connection classification ----

/** Physical corner type from the outside perspective */
export type CornerType = "external" | "internal";

/**
 * How a wall connects at a corner:
 * - "continuous": wall runs through to the corner (≡ old "through")
 * - "butt": wall ends into the side of the adjacent wall
 */
export type ConnectionType = "continuous" | "butt";

// ---- Layer definition ----

/** Which side of the framing the layer is on */
export type LayerSide = "exterior" | "interior";

/**
 * Defines a single material layer in the wall assembly.
 *
 * Layers are ordered by `order`:
 *   0 = framing (exactly one required)
 *   1, 2, 3 … = stacking away from framing on the given `side`
 */
export interface LayerDef {
  /** Unique identifier (e.g. "framing", "outsideDrywall", "panel") */
  id: string;
  /** Human-readable name (e.g. "Stomme", "Vindskydd") */
  name: string;
  /** Layer thickness (mm) */
  thickness: number;
  /** Which side of the framing */
  side: LayerSide;
  /**
   * Stacking order: 0 = framing, 1 = closest to framing on this side,
   * 2 = next, etc.
   */
  order: number;
}

// ---- Resolved layer geometry ----

/**
 * Fully resolved geometry for one layer on one wall.
 * All coverage values are in mm relative to the framing outer start corner.
 * All Z values are in meters relative to the framing center (−Z = exterior).
 */
export interface ResolvedLayer {
  /** The layer definition */
  def: LayerDef;
  /** Coverage start along wall (mm, from framing outer start corner) */
  coverageStart: number;
  /** Coverage end along wall (mm) */
  coverageEnd: number;
  /** Z offset to the exterior-facing face of this layer (m) */
  outerFaceZ: number;
  /** Z offset to the interior-facing face of this layer (m) */
  innerFaceZ: number;
  /** Z center of this layer (m) */
  centerZ: number;
  /** Layer thickness (m) */
  depthM: number;
  /** 2D quad of this layer's footprint (mm, world coordinates) */
  quad: WallQuad;
}

// ---- Wall endpoint ----

/**
 * Resolved metadata for one end of a wall.
 */
export interface WallEndpoint {
  /** Framing outer corner point at this junction (mm) */
  outerCorner: Point2D;
  /** Physical corner classification */
  cornerType: CornerType;
  /** How this wall connects here */
  connection: ConnectionType;
  /** Interior angle at this corner (radians) */
  interiorAngle: number;
  /** Index of the adjacent wall */
  adjacentWallIndex: number;
  /**
   * Retraction distance along the wall direction (mm).
   * Positive = wall shortened (butt at convex).
   * Negative = wall extended (butt at reflex).
   */
  retraction: number;
}

// ---- Parametric wall ----

/** A fully resolved wall with all layers */
export interface ParametricWall {
  id: string;
  index: number;

  // ---- Geometry (from framing outer corners) ----
  /** Framing outer start corner (mm) */
  start: Point2D;
  /** Framing outer end corner (mm) */
  end: Point2D;
  /** Length between framing outer corners (mm) */
  centerlineLength: number;
  /** Angle of wall direction from +X (radians) */
  angle: number;
  /** Unit direction vector (start → end) */
  direction: Point2D;
  /** Unit inward normal (toward building interior) */
  inwardNormal: Point2D;

  // ---- Adjacency ----
  prevIndex: number;
  nextIndex: number;

  // ---- Endpoints ----
  startEndpoint: WallEndpoint;
  endEndpoint: WallEndpoint;

  // ---- Framing specifics (for rendering components) ----
  /** Framing thickness (mm) */
  thickness: number;
  /** Framing effective length after retractions (mm) */
  effectiveLength: number;
  /** Framing 2D quad */
  quad: WallQuad;
  /** Stud layout for framing */
  studLayout: StudLayout;

  // ---- Old Wall compatibility ----
  /** CornerJoint at start (derived from startEndpoint, for old component compat) */
  startCorner: CornerJoint;
  /** CornerJoint at end (derived from endEndpoint, for old component compat) */
  endCorner: CornerJoint;

  // ---- Shell ----
  /** Total assembly thickness including all layers (mm) */
  totalThickness: number;
  /** Full-assembly quad (outermost exterior → innermost interior) */
  shellQuad: WallQuad;

  // ---- Layers ----
  /** All resolved layers keyed by layer id */
  layers: Record<string, ResolvedLayer>;
}

// ---- Layout ----

/** The complete parametric wall layout */
export interface ParametricConfiguratorLayout {
  walls: ParametricWall[];
  /** Building outer corners (outermost surface, input points) */
  buildingOuterCorners: Point2D[];
  /** Framing outer corners (offset inward from building corners) */
  framingOuterCorners: Point2D[];
  /** Framing inner corners (offset inward by framing thickness) */
  framingInnerCorners: Point2D[];
  /** Innermost corners (offset inward by total thickness from building corners) */
  innerCorners: Point2D[];
  /** Layer definitions used */
  layerDefs: LayerDef[];
}

// ---- Options ----

export interface ParametricWallOptions {
  /** Layer definitions (must include exactly one with order=0 for framing) */
  layers: LayerDef[];
  /** Target stud spacing c/c (mm, default 600) */
  studSpacing?: number;
  /** Stud width (mm, default 45) */
  studWidth?: number;
  /** Stud depth — typically equals framing thickness (mm) */
  studDepth?: number;
  /** Connection strategy (default "alternating") */
  connectionStrategy?: "alternating" | "custom";
  /** Per-wall connection overrides (wall index → ConnectionType) */
  connectionOverrides?: Record<number, ConnectionType>;
}
