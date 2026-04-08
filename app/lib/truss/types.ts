/** 2D node (joint) in the truss */
export interface TrussNode {
  id: number;
  x: number; // metres
  y: number; // metres
  label: string;
}

/** Member connecting two nodes */
export interface TrussMember {
  id: number;
  startNodeId: number;
  endNodeId: number;
  label: string;
  group: "topChord" | "bottomChord" | "web";
}

/** Support condition at a node */
export interface Support {
  nodeId: number;
  type: "pinned" | "roller"; // pinned = fixed x+y, roller = fixed y only
}

/** External point load applied at a node */
export interface PointLoad {
  nodeId: number;
  fx: number; // kN, horizontal
  fy: number; // kN, vertical (negative = downward)
}

/** User inputs for the truss design */
export interface TrussInput {
  span: number; // metres (5–20)
  pitch: number; // degrees (10–45)
  spacing: number; // truss c/c spacing in metres (typically 1.2)
  deadLoad: number; // kN/m² on slope (roofing + self-weight)
  snowLoad: number; // kN/m² on plan projection
  timberWidth: number; // mm (e.g. 45), same for all members
  topChordHeight: number; // mm — top chord (överram)
  bottomChordHeight: number; // mm — bottom chord (underram)
}

/** Result of structural analysis for one member */
export interface MemberResult {
  memberId: number;
  label: string;
  group: "topChord" | "bottomChord" | "web";
  length: number; // metres
  axialForce: number; // kN (positive = tension, negative = compression)
}

/** Node displacement from analysis */
export interface NodeDisplacement {
  nodeId: number;
  dx: number; // metres
  dy: number; // metres
}

/** Full output from the stiffness method */
export interface AnalysisResult {
  memberResults: MemberResult[];
  displacements: NodeDisplacement[];
}

/** Eurocode 5 design check result for one member */
export interface DesignCheck {
  memberId: number;
  label: string;
  group: "topChord" | "bottomChord" | "web";
  axialForce: number; // kN
  bendingMoment: number; // kNm (nonzero for top chord only)
  capacity: number; // kN (axial design capacity)
  utilization: number; // ratio 0–1+ (governing check)
  mode: "tension" | "compression" | "combined"; // combined = bending+axial
  buckling: boolean; // true if buckling governs
  pass: boolean;
}

/** Complete truss geometry */
export interface TrussGeometry {
  nodes: TrussNode[];
  members: TrussMember[];
  supports: Support[];
}

/** Full analysis + design output */
export interface TrussDesignResult {
  geometry: TrussGeometry;
  loads: PointLoad[];
  memberResults: MemberResult[];
  designChecks: DesignCheck[];
  totalTimberLength: number; // metres
  maxUtilization: number;
  allPass: boolean;
  midspanDeflection: number; // mm (instantaneous, SLS)
  deflectionLimit: number; // mm (L/300)
  deflectionPass: boolean;
}
