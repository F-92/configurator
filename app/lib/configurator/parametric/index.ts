// ============================================================
// Parametric Wall System — Public API
// ============================================================

export { buildParametricLayout } from "./builder";

export {
  assignConnections,
  classifyCorner,
  computeInnerCorners,
  resolveEndpoints,
  resolveWallLayers,
} from "./layers";

export type {
  Point2D,
  PointTuple,
  CornerType,
  ConnectionType,
  LayerSide,
  LayerDef,
  ResolvedLayer,
  WallEndpoint,
  WallQuad,
  WallOpening,
  CornerJoint,
  ParametricWall,
  ParametricConfiguratorLayout,
  ParametricWallOptions,
  Stud,
  CornerStud,
  StudLayout,
} from "./types";
