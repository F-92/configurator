// ============================================================
// Wall Layout System — Public API
// ============================================================

// Core class
export { WallLayout } from "./WallLayout";

// Builder / input helpers
export {
  fromPoints,
  traceLayout,
  rectangleLayout,
  TraceBuilder,
} from "./builder";

// Types
export type {
  Point2D,
  PointTuple,
  JointType,
  JointStrategy,
  CornerJoint,
  CornerStud,
  Stud,
  StudLayout,
  WallQuad,
  Wall,
  WallLayoutOptions,
  WallLayoutData,
  WallOpening,
} from "./types";

// Opening utilities
export {
  computeOpeningFraming,
  subtractOpeningsFromRect,
  mapOpeningsToWall,
  splitHorizontalSpan,
  splitVerticalSpan,
} from "./openings";
export type { OpeningFramingMember, OpeningFramingResult } from "./openings";

// Geometry utilities (for advanced users)
export {
  pt,
  add,
  sub,
  scale,
  dot,
  cross,
  length,
  normalize,
  distance,
  perpCCW,
  perpCW,
  rotate,
  angle,
  signedArea,
  isClockwise,
  ensureWinding,
  lineLineIntersection,
  interiorAngle,
  degToRad,
  radToDeg,
  round,
} from "./geometry";
