export type RoofType = "gable" | "hip" | "flat" | "shed";

export type WallMaterial = "wood" | "brick" | "stucco" | "fiber-cement";

export type RoofMaterial = "tiles" | "metal" | "shingles";

export type WindowStyle = "standard" | "picture" | "bay";

export type DoorStyle = "standard" | "french" | "sliding";

export interface WindowConfig {
  id: string;
  wall: "front" | "back" | "left" | "right";
  positionX: number; // 0-1 along wall
  positionY: number; // height from floor
  width: number; // meters
  height: number; // meters
  style: WindowStyle;
}

export interface DoorConfig {
  id: string;
  wall: "front" | "back" | "left" | "right";
  positionX: number;
  width: number;
  height: number;
  style: DoorStyle;
}

export interface HouseConfig {
  // Building dimensions (meters)
  width: number;
  depth: number;
  wallHeight: number;

  // Roof
  roofType: RoofType;
  roofPitch: number; // degrees
  roofOverhang: number; // meters
  roofMaterial: RoofMaterial;

  // Walls
  wallMaterial: WallMaterial;

  // Openings
  windows: WindowConfig[];
  doors: DoorConfig[];

  // Colors
  wallColor: string;
  roofColor: string;
  trimColor: string;
}

export interface PriceBreakdown {
  foundation: number;
  walls: number;
  roof: number;
  windows: number;
  doors: number;
  materials: number;
  total: number;
}

export interface ConstraintViolation {
  field: string;
  message: string;
  correctedValue?: number;
}

export const LIMITS = {
  width: { min: 4, max: 20 },
  depth: { min: 4, max: 20 },
  wallHeight: { min: 2.4, max: 4.0 },
  roofPitch: { min: 0, max: 45 },
  roofOverhang: { min: 0, max: 1.5 },
  windowWidth: { min: 0.4, max: 3.0 },
  windowHeight: { min: 0.4, max: 2.4 },
  doorWidth: { min: 0.8, max: 2.4 },
  doorHeight: { min: 2.0, max: 2.8 },
} as const;

export const MATERIAL_COLORS: Record<WallMaterial, string> = {
  wood: "#c4956a",
  brick: "#8b4513",
  stucco: "#f5f0e1",
  "fiber-cement": "#9e9e9e",
};

export const ROOF_COLORS: Record<RoofMaterial, string> = {
  tiles: "#8b0000",
  metal: "#4a4a4a",
  shingles: "#3d3d3d",
};
