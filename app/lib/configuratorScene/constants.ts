import {
  ConfiguratorLayout,
  rectangleLayout,
  fromPoints,
  traceLayout,
} from "../configurator";
import type { Wall } from "../configurator";

export const MM = 0.001;
export const WALL_HEIGHT = 2700;
export const PLATE_HEIGHT = 45;
export const VERTICAL_PLATE_THICKNESS = 45;
export const VERTICAL_PLATE_HEIGHT = 195;
export const STUD_COLOR = "#f5e6c8";
export const PRIMED_PANEL_COLOR = "#f4f3ee";
export const PRIMED_PANEL_BASE_COLOR = "#ebe9e0";
export const WALL_SURFACE_COLOR = "#dfc4a0";
export const OUTSIDE_INSULATION_OPTIONS = [0, 30, 50, 80, 95] as const;
export const INSTALLATION_LAYER_OPTIONS = [0, 45, 70] as const;
export const INSTALLATION_LAYER_STUD_LENGTH_OPTIONS = [
  2400, 3000, 3600, 4200,
] as const;
export const PANEL_BOARD_LENGTH_OPTIONS = [
  3000, 3300, 3600, 3900, 4200, 4500, 4800, 5100, 5400,
] as const;
export const OSB_BOARD_WIDTH = 1200;
export const OSB_BOARD_HEIGHT = 2700;
export const OSB_BOARD_THICKNESS = 11;
export const DRYWALL_BOARD_WIDTH = 1200;
export const DRYWALL_BOARD_HEIGHT = 2700;
export const DRYWALL_BOARD_THICKNESS = 13;
export const INSULATION_SHEET_WIDTH = 1200;
export const INSULATION_SHEET_HEIGHT = 2700;
export const CAVITY_INSULATION_SHEET_HEIGHT = 1170;
export const OUTSIDE_DRYWALL_THICKNESS = 9;
export const HOUSE_WRAP_THICKNESS = 2;
export const FACADE_AIR_GAP = 25;
// Swedish: SPIKLAKT_THICKNESS
export const BATTEN_THICKNESS = 25;
// Swedish: SPIKLAKT_HEIGHT
export const BATTEN_HEIGHT = 48;
// Swedish: SPIKLAKT_SPACING
export const BATTEN_SPACING = 600;
// Swedish: YTTERPANEL_THICKNESS
export const EXTERIOR_PANEL_THICKNESS = 22;
// Swedish: YTTERPANEL_BOARD_WIDTH
export const EXTERIOR_PANEL_BOARD_WIDTH = 145;
// Swedish: YTTERPANEL_VISIBLE_WIDTH
export const EXTERIOR_PANEL_VISIBLE_WIDTH = 127;
// Swedish: YTTERPANEL_OVERLAP_WIDTH
export const EXTERIOR_PANEL_OVERLAP_WIDTH = 18;
// Swedish: YTTERPANEL_FALSE_WIDTH
export const EXTERIOR_PANEL_REBATE_WIDTH = 28;
// Swedish: YTTERPANEL_RABBET_DEPTH
export const EXTERIOR_PANEL_REBATE_DEPTH = 11;
// Swedish: YTTERPANEL_FALSE_FACE_ANGLE
export const EXTERIOR_PANEL_REBATE_FACE_ANGLE = 25;
// Swedish: YTTERPANEL_FACE_CHAMFER
export const EXTERIOR_PANEL_FACE_CHAMFER = 2;
// Swedish: YTTERPANEL_SEAM_SHADOW_WIDTH
export const EXTERIOR_PANEL_SEAM_SHADOW_WIDTH = 3;
// Swedish: YTTERPANEL_SEAM_SHADOW_DEPTH
export const EXTERIOR_PANEL_SEAM_SHADOW_DEPTH = 0.8;
export const PANEL_MIN_REMAINDER = 70;
export const PANEL_CUTOUT_BLEED = 2;
// Swedish: MUSBAND_HEIGHT
export const COMB_STRIP_HEIGHT = 20;
// Swedish: MUSBAND_THICKNESS
export const COMB_STRIP_THICKNESS = 1;
// Swedish: MUSBAND_PROJECTION
export const COMB_STRIP_PROJECTION = 50;
// Swedish: MUSBAND_COMB_TOOTH_WIDTH
export const COMB_STRIP_TOOTH_WIDTH = 4;
// Swedish: MUSBAND_COMB_GAP_WIDTH
export const COMB_STRIP_GAP_WIDTH = 4;
// Swedish: MUSBAND_FLANGE_TILT
export const COMB_STRIP_FLANGE_TILT = (-15 * Math.PI) / 180;

export interface LayoutPreset {
  name: string;
  description: string;
  create: (thickness: number, studSpacing: number) => ConfiguratorLayout;
}

export interface LayerEdge {
  coverageStart: number;
  coverageEnd: number;
  outerFaceZ: number;
  innerFaceZ: number;
  centerZ: number;
  depthM: number;
}

export interface WallLayerEdges {
  framing: LayerEdge;
  outsideDrywall: LayerEdge;
  outsideInsulation: LayerEdge;
  weatherSurface: LayerEdge;
  spiklakt: LayerEdge;
  panel: LayerEdge;
}

export interface LayoutLike {
  walls: Wall[];
  outerCorners: { x: number; y: number }[];
  innerCorners: { x: number; y: number }[];
}

export const PRESETS: LayoutPreset[] = [
  {
    name: "Rectangle 10x8m",
    description: "Simple rectangular building",
    create: (t, s) =>
      rectangleLayout(10_000, 8_000, { thickness: t, studSpacing: s }),
  },
  {
    name: "Rectangle 12x10m",
    description: "Larger rectangular building",
    create: (t, s) =>
      rectangleLayout(12_000, 10_000, { thickness: t, studSpacing: s }),
  },
  {
    name: "L-form",
    description: "L-shaped building with internal corners",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [6_000, 0],
          [6_000, 4_000],
          [10_000, 4_000],
          [10_000, 8_000],
          [0, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "T-form",
    description: "T-shaped building",
    create: (t, s) =>
      fromPoints(
        [
          [3_000, 0],
          [9_000, 0],
          [9_000, 5_000],
          [12_000, 5_000],
          [12_000, 8_000],
          [0, 8_000],
          [0, 5_000],
          [3_000, 5_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Trapezoid",
    description: "Angled side walls",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [12_000, 0],
          [10_000, 8_000],
          [2_000, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Hexagon",
    description: "Hexagonal form",
    create: (t, s) => {
      const r = 5_000;
      const points: [number, number][] = [];
      for (let index = 0; index < 6; index += 1) {
        const angle = (Math.PI / 3) * index - Math.PI / 2;
        points.push([
          Math.round(r * Math.cos(angle) + r),
          Math.round(r * Math.sin(angle) + r),
        ]);
      }
      return fromPoints(points, { thickness: t, studSpacing: s });
    },
  },
  {
    name: "U-form",
    description: "U-shaped building",
    create: (t, s) =>
      fromPoints(
        [
          [0, 0],
          [3_000, 0],
          [3_000, 5_000],
          [7_000, 5_000],
          [7_000, 0],
          [10_000, 0],
          [10_000, 8_000],
          [0, 8_000],
        ],
        { thickness: t, studSpacing: s },
      ),
  },
  {
    name: "Trace: Angled form",
    description: "Built with the trace builder",
    create: (t, s) =>
      traceLayout({ thickness: t, studSpacing: s })
        .wall(8_000)
        .turn(90)
        .wall(4_000)
        .turn(-90)
        .wall(4_000)
        .turn(90)
        .wall(6_000)
        .turn(90)
        .wall(12_000)
        .close(),
  },
];
