import type React from "react";
import type { WallOpening } from "../../lib/configurator";
import type { LayoutLike } from "../../lib/configuratorScene/constants";

export type OpeningsByWall = Record<string, WallOpening[]>;
export type OpeningKind = "opening" | "window";
export type WindowOpeningIds = Record<string, true>;

export interface SidebarGeometryControls {
  presetIndex: number;
  onPresetChange: (index: number) => void;
  thickness: number;
  onThicknessChange: (value: number) => void;
  studSpacing: number;
  onStudSpacingChange: (value: number) => void;
  wallHeight: number;
  onWallHeightChange: (value: number) => void;
}

export interface SidebarLayerControls {
  outsideInsulationIndex: number;
  outsideInsulation: number;
  onOutsideInsulationIndexChange: (value: number) => void;
  installationLayerIndex: number;
  installationLayer: number;
  onInstallationLayerIndexChange: (value: number) => void;
  installationLayerStudLengthIndex: number;
  installationLayerStudLength: number;
  onInstallationLayerStudLengthIndexChange: (value: number) => void;
  panelBoardLengthIndex: number;
  panelBoardLength: number;
  onPanelBoardLengthIndexChange: (value: number) => void;
}

export interface SidebarVisibilityControls {
  showFraming: boolean;
  setShowFraming: (value: boolean) => void;
  showVerticalTopPlate: boolean;
  setShowVerticalTopPlate: (value: boolean) => void;
  showCavityInsulation: boolean;
  setShowCavityInsulation: (value: boolean) => void;
  showHouseWrap: boolean;
  setShowHouseWrap: (value: boolean) => void;
  showOutsideDrywall: boolean;
  setShowOutsideDrywall: (value: boolean) => void;
  showCombStrip: boolean;
  setShowCombStrip: (value: boolean) => void;
  showStandingExteriorPanel: boolean;
  setShowStandingExteriorPanel: (value: boolean) => void;
  showHorizontalExteriorPanel: boolean;
  setShowHorizontalExteriorPanel: (value: boolean) => void;
  showPrimedWhiteExteriorPanel: boolean;
  setShowPrimedWhiteExteriorPanel: (value: boolean) => void;
  showVaporBarrier: boolean;
  setShowVaporBarrier: (value: boolean) => void;
  showOsb: boolean;
  setShowOsb: (value: boolean) => void;
  showDrywall: boolean;
  setShowDrywall: (value: boolean) => void;
  showLabels: boolean;
  setShowLabels: (value: boolean) => void;
  showCorners: boolean;
  setShowCorners: (value: boolean) => void;
  showLayerCorners: boolean;
  setShowLayerCorners: (value: boolean) => void;
  showStudDimensions: boolean;
  setShowStudDimensions: (value: boolean) => void;
}

export interface SidebarOpeningControls {
  showOpenings: boolean;
  setShowOpenings: (value: boolean) => void;
  newOpeningKind: OpeningKind;
  setNewOpeningKind: (value: OpeningKind) => void;
  newOpeningWidthDm: number;
  setNewOpeningWidthDm: (value: number) => void;
  newOpeningHeightDm: number;
  setNewOpeningHeightDm: (value: number) => void;
  selectedOpeningId: string | null;
  wallOpenings: OpeningsByWall;
  windowOpeningIds: WindowOpeningIds;
  onOpeningRemove: () => void;
  onOpeningSelect: (id: string | null) => void;
}

export interface ConfiguratorSidebarProps {
  geometry: SidebarGeometryControls;
  layers: SidebarLayerControls;
  visibility: SidebarVisibilityControls;
  openings: SidebarOpeningControls;
  layout: LayoutLike;
}

export interface SceneLayouts {
  framingLayout: LayoutLike;
  installationLayout: LayoutLike | null;
  osbLayout: LayoutLike | null;
  drywallLayout: LayoutLike | null;
  shellLayout: LayoutLike;
  slabCorners: { x: number; y: number }[];
}

export interface SceneOptions {
  wallHeight: number;
  outsideInsulation: number;
  installationLayer: number;
  installationLayerStudLength: number;
  panelBoardLength: number;
}

export interface SceneVisibility {
  showOsb: boolean;
  showDrywall: boolean;
  showOutsideDrywall: boolean;
  showCavityInsulation: boolean;
  showHouseWrap: boolean;
  showCombStrip: boolean;
  showStandingExteriorPanel: boolean;
  showHorizontalExteriorPanel: boolean;
  showPrimedWhiteExteriorPanel: boolean;
  showVaporBarrier: boolean;
  showFraming: boolean;
  showVerticalTopPlate: boolean;
  showLabels: boolean;
  showCorners: boolean;
  showLayerCorners: boolean;
  showStudDimensions: boolean;
}

export interface SceneOpeningState {
  wallOpenings: OpeningsByWall;
  windowOpeningIds: WindowOpeningIds;
  selectedOpeningId: string | null;
  showOpenings: boolean;
  onOpeningDrag: (openingId: string, left: number, bottom: number) => void;
  onOpeningAdd: (wallId: string, x: number, y: number) => void;
  onOpeningSelect: (openingId: string | null) => void;
}

export interface ConfiguratorSceneProps {
  layouts: SceneLayouts;
  options: SceneOptions;
  visibility: SceneVisibility;
  openings: SceneOpeningState;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
}

export interface CameraView {
  key: number;
  position: [number, number, number];
  target: [number, number, number];
}

export interface ConfiguratorViewportShellProps {
  cameraTarget: [number, number, number];
  cameraView: CameraView;
  onCenterCamera: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
}

export interface ConfiguratorViewportProps extends ConfiguratorViewportShellProps {
  children: React.ReactNode;
}
