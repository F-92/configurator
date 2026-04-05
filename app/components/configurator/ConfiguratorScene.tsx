"use client";

import React, { useMemo } from "react";
import type { Wall } from "../../lib/configurator";
import type { WallOpening } from "../../lib/configurator";
import { mapOpeningsToWall } from "../../lib/configurator/openings";
import type { ParametricWall } from "../../lib/configurator/parametric";
import type { ConfiguratorSceneProps } from "./types";
import {
  BATTEN_THICKNESS,
  MM,
  WALL_SURFACE_COLOR,
  type WallLayerEdges,
} from "../../lib/configuratorScene/constants";
import { wallLayerEdgesFromParametric } from "../../lib/configuratorScene/helpers";
import {
  WallDrywallBoards,
  WallHorizontalExteriorPanel,
  WallHouseWrap,
  WallCombStrip,
  WallOsbBoards,
  WallHorizontalBattens,
  WallStandingExteriorPanel,
  WallVaporBarrier,
  WallVerticalBattens,
} from "./FinishRenderers";
import { WallOpeningDragLayer, WallOpeningVisual } from "./OpeningOverlays";
import {
  CornerMarkers,
  FloorSlab,
  LayerCornerLabels,
  StudDimensions,
  WallLabels,
} from "./SceneOverlays";
import {
  WallCavityInsulation,
  WallFraming,
  WallInstallationLayer,
  WallInsulationSheets,
  WallOutsideDrywall,
  WallSurface,
} from "./StructuralRenderers";
import { WallWindows } from "./WindowRenderers";

export function ConfiguratorScene({
  layouts: {
    framingLayout,
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
    onOpeningDrag,
    onOpeningAdd,
    onOpeningSelect,
    showOpenings,
  },
  controlsRef,
}: ConfiguratorSceneProps) {
  const layerEdgesMap = useMemo(() => {
    const map: Record<string, WallLayerEdges> = {};
    for (const wall of framingLayout.walls) {
      const parametricWall = wall as ParametricWall;
      if (parametricWall.layers) {
        map[wall.id] = wallLayerEdgesFromParametric(parametricWall);
      }
    }
    return map;
  }, [framingLayout.walls]);

  const outsideInsulationOpeningsByWall = useMemo(() => {
    const expandedByWall: Record<string, WallOpening[]> = {};

    for (const wall of framingLayout.walls) {
      const studWidth = wall.studLayout.studs[0]?.width ?? 45;
      expandedByWall[wall.id] = (wallOpenings[wall.id] || []).map((opening) => {
        if (!windowOpeningIds[opening.id] || outsideInsulation <= 0) {
          return opening;
        }

        const expandedLeft = Math.max(0, opening.left - studWidth);
        const expandedBottom = Math.max(0, opening.bottom - studWidth);
        const expandedRight = Math.min(
          wall.effectiveLength,
          opening.left + opening.width + studWidth,
        );
        const expandedTop = Math.min(
          wallHeight,
          opening.bottom + opening.height + studWidth,
        );

        return {
          ...opening,
          left: expandedLeft,
          bottom: expandedBottom,
          width: expandedRight - expandedLeft,
          height: expandedTop - expandedBottom,
        };
      });
    }

    return expandedByWall;
  }, [
    framingLayout.walls,
    outsideInsulation,
    wallHeight,
    wallOpenings,
    windowOpeningIds,
  ]);

  return (
    <group>
      <FloorSlab corners={slabCorners} />

      {(showFraming ? framingLayout.walls : shellLayout.walls).map((wall) =>
        showFraming ? (
          <WallFraming
            key={wall.id}
            wall={wall}
            wallHeight={wallHeight}
            showVerticalTopPlate={showVerticalTopPlate}
            openings={wallOpenings[wall.id] || []}
          />
        ) : (
          <WallSurface
            key={wall.id}
            wall={wall}
            wallHeight={wallHeight}
            color={WALL_SURFACE_COLOR}
          />
        ),
      )}

      {showFraming &&
        showCavityInsulation &&
        framingLayout.walls.map((wall) => (
          <WallCavityInsulation
            key={`cavity-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            showVerticalTopPlate={showVerticalTopPlate}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {showFraming &&
        showHouseWrap &&
        framingLayout.walls.map((wall) => (
          <WallHouseWrap
            key={`wrap-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {showCombStrip &&
        framingLayout.walls.map((wall) => (
          <WallCombStrip
            key={`comb-strip-${wall.id}`}
            wall={wall}
            slabCorners={slabCorners}
          />
        ))}

      {showStandingExteriorPanel &&
        framingLayout.walls.map((wall) => {
          const edge = layerEdgesMap[wall.id].spiklakt;
          const innerZ = edge.innerFaceZ - (BATTEN_THICKNESS * MM) / 2;
          const outerZ = edge.outerFaceZ + (BATTEN_THICKNESS * MM) / 2;
          return (
            <React.Fragment key={`double-battens-${wall.id}`}>
              <WallVerticalBattens
                key={`vertical-battens-${wall.id}`}
                wall={wall}
                wallHeight={wallHeight}
                layerEdges={layerEdgesMap[wall.id]}
                openings={wallOpenings[wall.id] || []}
                zOverride={innerZ}
              />
              <WallHorizontalBattens
                key={`horizontal-battens-${wall.id}`}
                wall={wall}
                wallHeight={wallHeight}
                layerEdges={layerEdgesMap[wall.id]}
                openings={wallOpenings[wall.id] || []}
                zOverride={outerZ}
              />
            </React.Fragment>
          );
        })}

      {showHorizontalExteriorPanel &&
        framingLayout.walls.map((wall) => (
          <WallVerticalBattens
            key={`vertical-battens-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            layerEdges={layerEdgesMap[wall.id]}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {showStandingExteriorPanel &&
        framingLayout.walls.map((wall) => (
          <WallStandingExteriorPanel
            key={`exterior-panel-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            boardLength={panelBoardLength}
            layerEdges={layerEdgesMap[wall.id]}
            showPrimedWhite={showPrimedWhiteExteriorPanel}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {showHorizontalExteriorPanel &&
        framingLayout.walls.map((wall) => (
          <WallHorizontalExteriorPanel
            key={`horizontal-exterior-panel-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            boardLength={panelBoardLength}
            layerEdges={layerEdgesMap[wall.id]}
            showPrimedWhite={showPrimedWhiteExteriorPanel}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {showFraming &&
        showVaporBarrier &&
        framingLayout.walls.map((wall) => (
          <WallVaporBarrier
            key={`vapor-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {showFraming &&
        installationLayer > 0 &&
        installationLayout &&
        installationLayout.walls.map((wall, index) => (
          <WallInstallationLayer
            key={`installation-${wall.id}`}
            wall={wall}
            framingWall={framingLayout.walls[index]}
            wallHeight={wallHeight}
            thickness={installationLayer}
            maxStudLength={installationLayerStudLength}
            openings={wallOpenings[framingLayout.walls[index]?.id] || []}
          />
        ))}

      {showFraming &&
        showOsb &&
        osbLayout &&
        osbLayout.walls.map((wall, index) => {
          const framingWall = framingLayout.walls[index];
          const rawOpenings = framingWall
            ? wallOpenings[framingWall.id] || []
            : [];
          return (
            <WallOsbBoards
              key={`osb-${wall.id}`}
              wall={wall}
              wallHeight={wallHeight}
              openings={
                framingWall
                  ? mapOpeningsToWall(
                      rawOpenings,
                      framingWall as Wall,
                      wall as Wall,
                    )
                  : rawOpenings
              }
            />
          );
        })}

      {showFraming &&
        showDrywall &&
        drywallLayout &&
        drywallLayout.walls.map((wall, index) => {
          const framingWall = framingLayout.walls[index];
          const rawOpenings = framingWall
            ? wallOpenings[framingWall.id] || []
            : [];
          return (
            <WallDrywallBoards
              key={`drywall-${wall.id}`}
              wall={wall}
              wallHeight={wallHeight}
              openings={
                framingWall
                  ? mapOpeningsToWall(
                      rawOpenings,
                      framingWall as Wall,
                      wall as Wall,
                    )
                  : rawOpenings
              }
            />
          );
        })}

      {showOutsideDrywall &&
        showFraming &&
        framingLayout.walls.map((wall) => (
          <WallOutsideDrywall
            key={`outside-drywall-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            layerEdges={layerEdgesMap[wall.id]}
            openings={wallOpenings[wall.id] || []}
          />
        ))}

      {outsideInsulation > 0 &&
        framingLayout.walls.map((wall) => (
          <WallInsulationSheets
            key={`insulation-${wall.id}`}
            wall={wall}
            wallHeight={wallHeight}
            thickness={outsideInsulation}
            layerEdges={layerEdgesMap[wall.id]}
            openings={outsideInsulationOpeningsByWall[wall.id] || []}
          />
        ))}

      {framingLayout.walls.map((wall) => (
        <WallWindows
          key={`windows-${wall.id}`}
          wall={wall}
          openings={(wallOpenings[wall.id] || []).filter(
            (opening) => windowOpeningIds[opening.id],
          )}
          layerEdges={layerEdgesMap[wall.id]}
          showPrimedWhite={showPrimedWhiteExteriorPanel}
        />
      ))}

      {showLabels && (
        <WallLabels
          layout={showFraming ? framingLayout : shellLayout}
          wallHeight={wallHeight}
        />
      )}

      {showCorners && (
        <CornerMarkers
          layout={showFraming ? framingLayout : shellLayout}
          showInner={showFraming}
        />
      )}

      {showLayerCorners && showFraming && (
        <LayerCornerLabels
          layout={framingLayout}
          wallHeight={wallHeight}
          layerEdgesMap={layerEdgesMap}
          visibleLayers={{
            framing: true,
            outsideDrywall: showOutsideDrywall,
            outsideInsulation: outsideInsulation > 0,
            weatherSurface: outsideInsulation > 0,
            spiklakt: showStandingExteriorPanel || showHorizontalExteriorPanel,
            panel: showStandingExteriorPanel || showHorizontalExteriorPanel,
          }}
        />
      )}

      {showStudDimensions && showFraming && (
        <StudDimensions layout={framingLayout} />
      )}

      {showOpenings &&
        framingLayout.walls.map((wall) => (
          <group key={`openings-${wall.id}`}>
            {(wallOpenings[wall.id] || []).map((opening) => (
              <WallOpeningVisual
                key={opening.id}
                wall={wall}
                wallHeight={wallHeight}
                opening={opening}
                isSelected={selectedOpeningId === opening.id}
              />
            ))}
            <WallOpeningDragLayer
              wall={wall}
              wallHeight={wallHeight}
              openings={wallOpenings[wall.id] || []}
              onOpeningDrag={onOpeningDrag}
              onOpeningAdd={onOpeningAdd}
              onOpeningSelect={onOpeningSelect}
              controlsRef={controlsRef}
            />
          </group>
        ))}
    </group>
  );
}
