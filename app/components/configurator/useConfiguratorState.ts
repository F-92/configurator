"use client";

import { useState } from "react";
import {
  INSTALLATION_LAYER_STUD_LENGTH_OPTIONS,
  WALL_HEIGHT,
} from "../../lib/configuratorScene/constants";
import type {
  ConfiguratorSceneProps,
  ConfiguratorSidebarProps,
  ConfiguratorViewportShellProps,
} from "./types";
import { useCameraState } from "./useCameraState";
import { useConfiguratorLayouts } from "./useConfiguratorLayouts";
import { useOpeningState } from "./useOpeningState";
import type { OpeningKind } from "./types";

export function useConfiguratorState() {
  const [presetIndex, setPresetIndex] = useState(0);
  const [thickness, setThickness] = useState(145);
  const [studSpacing, setStudSpacing] = useState(600);
  const [outsideInsulationIndex, setOutsideInsulationIndex] = useState(0);
  const [installationLayerIndex, setInstallationLayerIndex] = useState(0);
  const [
    installationLayerStudLengthIndex,
    setInstallationLayerStudLengthIndex,
  ] = useState(INSTALLATION_LAYER_STUD_LENGTH_OPTIONS.length - 1);
  const [panelBoardLengthIndex, setPanelBoardLengthIndex] = useState(0);
  const [wallHeight, setWallHeight] = useState(WALL_HEIGHT);
  const [showFraming, setShowFraming] = useState(true);
  const [showHouseWrap, setShowHouseWrap] = useState(false);
  const [showCombStrip, setShowCombStrip] = useState(false);
  const [showStandingExteriorPanel, setShowStandingExteriorPanel] =
    useState(false);
  const [showHorizontalExteriorPanel, setShowHorizontalExteriorPanel] =
    useState(false);
  const [showPrimedWhiteExteriorPanel, setShowPrimedWhiteExteriorPanel] =
    useState(false);
  const [showVaporBarrier, setShowVaporBarrier] = useState(false);
  const [showOsb, setShowOsb] = useState(false);
  const [showDrywall, setShowDrywall] = useState(false);
  const [showOutsideDrywall, setShowOutsideDrywall] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showCorners, setShowCorners] = useState(false);
  const [showLayerCorners, setShowLayerCorners] = useState(false);
  const [showStudDimensions, setShowStudDimensions] = useState(true);
  const [showVerticalTopPlate, setShowVerticalTopPlate] = useState(false);
  const [showCavityInsulation, setShowCavityInsulation] = useState(false);
  const [showOpenings, setShowOpenings] = useState(false);
  const [newOpeningKind, setNewOpeningKind] = useState<OpeningKind>("opening");
  const [newOpeningWidthDm, setNewOpeningWidthDm] = useState(9);
  const [newOpeningHeightDm, setNewOpeningHeightDm] = useState(21);
  const {
    outsideInsulation,
    installationLayer,
    installationLayerStudLength,
    panelBoardLength,
    layout,
    slabCorners,
    shellLayout,
    installationLayout,
    osbLayout,
    drywallLayout,
    cameraTarget,
  } = useConfiguratorLayouts({
    presetIndex,
    thickness,
    studSpacing,
    outsideInsulationIndex,
    installationLayerIndex,
    installationLayerStudLengthIndex,
    panelBoardLengthIndex,
    showStandingExteriorPanel,
    showOsb,
    showOutsideDrywall,
  });

  const {
    wallOpenings,
    windowOpeningIds,
    selectedOpeningId,
    handleOpeningAdd,
    handleOpeningDrag,
    handleOpeningSelect,
    handleOpeningRemove,
  } = useOpeningState({
    layout,
    wallHeight,
    newOpeningKind,
    newOpeningWidthDm,
    newOpeningHeightDm,
  });

  const { controlsRef, cameraView, handleCenterCamera } = useCameraState({
    cameraTarget,
  });

  const sidebarProps: ConfiguratorSidebarProps = {
    geometry: {
      presetIndex,
      onPresetChange: setPresetIndex,
      thickness,
      onThicknessChange: setThickness,
      studSpacing,
      onStudSpacingChange: setStudSpacing,
      wallHeight,
      onWallHeightChange: setWallHeight,
    },
    layers: {
      outsideInsulationIndex,
      outsideInsulation,
      onOutsideInsulationIndexChange: setOutsideInsulationIndex,
      installationLayerIndex,
      installationLayer,
      onInstallationLayerIndexChange: setInstallationLayerIndex,
      installationLayerStudLengthIndex,
      installationLayerStudLength,
      onInstallationLayerStudLengthIndexChange:
        setInstallationLayerStudLengthIndex,
      panelBoardLengthIndex,
      panelBoardLength,
      onPanelBoardLengthIndexChange: setPanelBoardLengthIndex,
    },
    visibility: {
      showFraming,
      setShowFraming,
      showVerticalTopPlate,
      setShowVerticalTopPlate,
      showCavityInsulation,
      setShowCavityInsulation,
      showHouseWrap,
      setShowHouseWrap,
      showOutsideDrywall,
      setShowOutsideDrywall,
      showCombStrip,
      setShowCombStrip,
      showStandingExteriorPanel,
      setShowStandingExteriorPanel,
      showHorizontalExteriorPanel,
      setShowHorizontalExteriorPanel,
      showPrimedWhiteExteriorPanel,
      setShowPrimedWhiteExteriorPanel,
      showVaporBarrier,
      setShowVaporBarrier,
      showOsb,
      setShowOsb,
      showDrywall,
      setShowDrywall,
      showLabels,
      setShowLabels,
      showCorners,
      setShowCorners,
      showLayerCorners,
      setShowLayerCorners,
      showStudDimensions,
      setShowStudDimensions,
    },
    openings: {
      showOpenings,
      setShowOpenings,
      newOpeningKind,
      setNewOpeningKind,
      newOpeningWidthDm,
      setNewOpeningWidthDm,
      newOpeningHeightDm,
      setNewOpeningHeightDm,
      selectedOpeningId,
      wallOpenings,
      windowOpeningIds,
      onOpeningRemove: handleOpeningRemove,
      onOpeningSelect: handleOpeningSelect,
    },
    layout,
  };

  const viewportProps: ConfiguratorViewportShellProps = {
    cameraTarget,
    cameraView,
    onCenterCamera: handleCenterCamera,
    controlsRef,
  };

  const sceneProps: ConfiguratorSceneProps = {
    layouts: {
      framingLayout: layout,
      installationLayout,
      osbLayout,
      drywallLayout,
      shellLayout,
      slabCorners,
    },
    options: {
      wallHeight,
      outsideInsulation,
      installationLayer,
      installationLayerStudLength,
      panelBoardLength,
    },
    visibility: {
      showOsb,
      showDrywall,
      showOutsideDrywall,
      showCavityInsulation,
      showHouseWrap,
      showCombStrip,
      showStandingExteriorPanel,
      showHorizontalExteriorPanel,
      showPrimedWhiteExteriorPanel,
      showVaporBarrier,
      showFraming,
      showVerticalTopPlate,
      showLabels,
      showCorners,
      showLayerCorners,
      showStudDimensions,
    },
    openings: {
      wallOpenings,
      windowOpeningIds,
      selectedOpeningId,
      onOpeningDrag: handleOpeningDrag,
      onOpeningAdd: handleOpeningAdd,
      onOpeningSelect: handleOpeningSelect,
      showOpenings,
    },
    controlsRef,
  };

  return {
    sidebarProps,
    viewportProps,
    sceneProps,
  };
}
