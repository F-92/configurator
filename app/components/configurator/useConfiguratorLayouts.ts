"use client";

import { useMemo } from "react";
import { ConfiguratorLayout } from "../../lib/configurator";
import type { Wall } from "../../lib/configurator";
import {
  buildParametricLayout,
  computeInnerCorners,
} from "../../lib/configurator/parametric";
import type { LayerDef } from "../../lib/configurator/parametric";
import {
  BATTEN_THICKNESS,
  DRYWALL_BOARD_THICKNESS,
  EXTERIOR_PANEL_THICKNESS,
  INSTALLATION_LAYER_OPTIONS,
  INSTALLATION_LAYER_STUD_LENGTH_OPTIONS,
  MM,
  OSB_BOARD_THICKNESS,
  OUTSIDE_DRYWALL_THICKNESS,
  OUTSIDE_INSULATION_OPTIONS,
  PANEL_BOARD_LENGTH_OPTIONS,
  PRESETS,
  type LayoutLike,
} from "../../lib/configuratorScene/constants";

function buildLayerDefs({
  thickness,
  outsideDrywall,
  outsideInsulation,
  showStandingExteriorPanel,
}: {
  thickness: number;
  outsideDrywall: number;
  outsideInsulation: number;
  showStandingExteriorPanel: boolean;
}): LayerDef[] {
  const defs: LayerDef[] = [
    { id: "framing", name: "Framing", thickness, side: "exterior", order: 0 },
  ];

  let exteriorOrder = 1;

  if (outsideDrywall > 0) {
    defs.push({
      id: "outsideDrywall",
      name: "Exterior sheathing",
      thickness: outsideDrywall,
      side: "exterior",
      order: exteriorOrder++,
    });
  }

  if (outsideInsulation > 0) {
    defs.push({
      id: "outsideInsulation",
      name: "Insulation",
      thickness: outsideInsulation,
      side: "exterior",
      order: exteriorOrder++,
    });
  }

  const battenThickness = showStandingExteriorPanel
    ? BATTEN_THICKNESS * 2
    : BATTEN_THICKNESS;

  defs.push({
    id: "spiklakt",
    name: "Battens",
    thickness: battenThickness,
    side: "exterior",
    order: exteriorOrder++,
  });

  defs.push({
    id: "panel",
    name: "Cladding",
    thickness: EXTERIOR_PANEL_THICKNESS,
    side: "exterior",
    order: exteriorOrder++,
  });

  return defs;
}

export function useConfiguratorLayouts({
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
}: {
  presetIndex: number;
  thickness: number;
  studSpacing: number;
  outsideInsulationIndex: number;
  installationLayerIndex: number;
  installationLayerStudLengthIndex: number;
  panelBoardLengthIndex: number;
  showStandingExteriorPanel: boolean;
  showOsb: boolean;
  showOutsideDrywall: boolean;
}) {
  const outsideInsulation = OUTSIDE_INSULATION_OPTIONS[outsideInsulationIndex];
  const installationLayer = INSTALLATION_LAYER_OPTIONS[installationLayerIndex];
  const installationLayerStudLength =
    INSTALLATION_LAYER_STUD_LENGTH_OPTIONS[installationLayerStudLengthIndex];
  const panelBoardLength = PANEL_BOARD_LENGTH_OPTIONS[panelBoardLengthIndex];
  const outsideDrywall = showOutsideDrywall ? OUTSIDE_DRYWALL_THICKNESS : 0;

  const baseOuterCorners = useMemo(() => {
    return PRESETS[presetIndex].create(thickness, studSpacing).outerCorners;
  }, [presetIndex, thickness, studSpacing]);

  const layerDefs = useMemo(
    () =>
      buildLayerDefs({
        thickness,
        outsideDrywall,
        outsideInsulation,
        showStandingExteriorPanel,
      }),
    [thickness, outsideDrywall, outsideInsulation, showStandingExteriorPanel],
  );

  const parametricLayout = useMemo(() => {
    return buildParametricLayout(baseOuterCorners, {
      layers: layerDefs,
      studSpacing,
      studWidth: 45,
      studDepth: thickness,
    });
  }, [baseOuterCorners, layerDefs, studSpacing, thickness]);

  const layout: LayoutLike = useMemo(
    () => ({
      walls: parametricLayout.walls as unknown as Wall[],
      outerCorners: parametricLayout.framingOuterCorners,
      innerCorners: parametricLayout.framingInnerCorners,
    }),
    [parametricLayout],
  );

  const slabCorners = useMemo(() => {
    const slabOffset = outsideDrywall + outsideInsulation;
    if (slabOffset <= 0) return parametricLayout.framingOuterCorners;
    return computeInnerCorners(
      parametricLayout.framingOuterCorners,
      -slabOffset,
    );
  }, [parametricLayout.framingOuterCorners, outsideDrywall, outsideInsulation]);

  const shellLayout = useMemo(() => {
    return new ConfiguratorLayout(baseOuterCorners, {
      thickness: thickness + outsideDrywall + outsideInsulation,
      studSpacing,
      studDepth: thickness,
    });
  }, [
    baseOuterCorners,
    outsideDrywall,
    outsideInsulation,
    studSpacing,
    thickness,
  ]);

  const installationLayout = useMemo(() => {
    if (installationLayer === 0) return null;

    return new ConfiguratorLayout(parametricLayout.framingInnerCorners, {
      thickness: installationLayer,
      studSpacing,
      studWidth: 45,
      studDepth: installationLayer,
    });
  }, [installationLayer, parametricLayout.framingInnerCorners, studSpacing]);

  const osbLayout = useMemo(() => {
    const osbOuterCorners = installationLayout
      ? installationLayout.innerCorners
      : parametricLayout.framingInnerCorners;

    return new ConfiguratorLayout(osbOuterCorners, {
      thickness: OSB_BOARD_THICKNESS,
      studSpacing,
      studDepth: OSB_BOARD_THICKNESS,
    });
  }, [installationLayout, parametricLayout.framingInnerCorners, studSpacing]);

  const drywallLayout = useMemo(() => {
    const drywallOuterCorners =
      showOsb && osbLayout
        ? osbLayout.innerCorners
        : installationLayout
          ? installationLayout.innerCorners
          : parametricLayout.framingInnerCorners;

    return new ConfiguratorLayout(drywallOuterCorners, {
      thickness: DRYWALL_BOARD_THICKNESS,
      studSpacing,
      studDepth: DRYWALL_BOARD_THICKNESS,
    });
  }, [
    showOsb,
    osbLayout,
    installationLayout,
    parametricLayout.framingInnerCorners,
    studSpacing,
  ]);

  const cameraTarget = useMemo(() => {
    const corners = layout.outerCorners;
    let cx = 0;
    let cy = 0;

    for (const corner of corners) {
      cx += corner.x;
      cy += corner.y;
    }

    cx = (cx / corners.length) * MM;
    cy = (cy / corners.length) * MM;

    return [cx, 1, -cy] as [number, number, number];
  }, [layout]);

  return {
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
  };
}
