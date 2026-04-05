"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

import type { Wall, WallOpening } from "../../lib/configurator";
import {
  mapOpeningsToWall,
  splitHorizontalSpan,
  splitVerticalSpan,
  subtractOpeningsFromRect,
} from "../../lib/configurator/openings";
import { getOsbTexture, getPineTexture } from "../../lib/woodTexture";
import {
  BATTEN_HEIGHT,
  BATTEN_SPACING,
  BATTEN_THICKNESS,
  COMB_STRIP_FLANGE_TILT,
  COMB_STRIP_HEIGHT,
  COMB_STRIP_PROJECTION,
  COMB_STRIP_THICKNESS,
  DRYWALL_BOARD_HEIGHT,
  DRYWALL_BOARD_THICKNESS,
  DRYWALL_BOARD_WIDTH,
  EXTERIOR_PANEL_BOARD_WIDTH,
  EXTERIOR_PANEL_FACE_CHAMFER,
  EXTERIOR_PANEL_OVERLAP_WIDTH,
  EXTERIOR_PANEL_REBATE_DEPTH,
  EXTERIOR_PANEL_REBATE_FACE_ANGLE,
  EXTERIOR_PANEL_REBATE_WIDTH,
  EXTERIOR_PANEL_SEAM_SHADOW_DEPTH,
  EXTERIOR_PANEL_SEAM_SHADOW_WIDTH,
  EXTERIOR_PANEL_THICKNESS,
  EXTERIOR_PANEL_VISIBLE_WIDTH,
  HOUSE_WRAP_THICKNESS,
  MM,
  OSB_BOARD_HEIGHT,
  OSB_BOARD_THICKNESS,
  OSB_BOARD_WIDTH,
  PRIMED_PANEL_BASE_COLOR,
  type WallLayerEdges,
} from "../../lib/configuratorScene/constants";
import {
  cloneTextureWithLengthwiseOffset,
  createCombStripTeeth,
  createBoardGeometryWithCutouts,
  createHorizontalExteriorPanelBoardGeometry,
  createVerticalExteriorPanelBoardGeometry,
  getBoardOpeningCutouts,
  getExteriorCoverageRange,
  getSubtlePaintColor,
  getSubtlePaintOpacity,
  getSubtleWoodColor,
  getSubtleWoodRoughness,
  getSupportAlignedBoardSegments,
} from "../../lib/configuratorScene/helpers";

function getWallGroupTransform(wall: Wall) {
  const quad = wall.quad;
  return {
    position: [
      ((quad.outerStart.x + quad.innerStart.x) / 2) * MM,
      0,
      -((quad.outerStart.y + quad.innerStart.y) / 2) * MM,
    ] as [number, number, number],
    rotationY: wall.angle,
  };
}

export function WallHouseWrap({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const wrapPieces = useMemo(() => {
    const wrapThicknessMm = HOUSE_WRAP_THICKNESS;
    const wrapThickness = wrapThicknessMm * MM;
    const framingDepth = wall.thickness * MM;
    const { coverageStart, coverageEnd } = getExteriorCoverageRange(
      wall,
      wrapThicknessMm,
    );
    const zPos = -(framingDepth / 2 + wrapThickness / 2);

    const rects = subtractOpeningsFromRect(
      coverageStart,
      0,
      coverageEnd - coverageStart,
      wallHeight,
      openings,
    );

    return rects.map((rect, index) => ({
      key: `wrap-piece-${index}`,
      pos: [(rect.x + rect.w / 2) * MM, (rect.y + rect.h / 2) * MM, zPos] as [
        number,
        number,
        number,
      ],
      size: [rect.w * MM, rect.h * MM, wrapThickness] as [
        number,
        number,
        number,
      ],
    }));
  }, [wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {wrapPieces.map((piece) => (
        <group key={piece.key} position={piece.pos}>
          <mesh renderOrder={1}>
            <boxGeometry args={piece.size} />
            <meshStandardMaterial
              color="#e1e1e1"
              transparent
              opacity={0.85}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...piece.size)]} />
            <lineBasicMaterial color="#e1e1e1" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallCombStrip({
  wall,
  slabCorners,
}: {
  wall: Wall;
  slabCorners: { x: number; y: number }[];
}) {
  const strip = useMemo(() => {
    const startCorner = slabCorners[wall.index];
    const endCorner = slabCorners[(wall.index + 1) % slabCorners.length];
    const length =
      Math.hypot(endCorner.x - startCorner.x, endCorner.y - startCorner.y) * MM;
    const height = COMB_STRIP_HEIGHT * MM;
    const projection = COMB_STRIP_PROJECTION * MM;
    const thickness = COMB_STRIP_THICKNESS * MM;

    return {
      position: [
        ((startCorner.x + endCorner.x) / 2) * MM,
        0,
        -((startCorner.y + endCorner.y) / 2) * MM,
      ] as [number, number, number],
      backStripSize: [length, height, thickness] as [number, number, number],
      backStripPos: [0, height / 2, -thickness / 2] as [number, number, number],
      teeth: createCombStripTeeth(length).map((tooth) => ({
        key: tooth.key,
        pos: [tooth.centerX, thickness / 2, -thickness / 2] as [
          number,
          number,
          number,
        ],
        size: [tooth.width, thickness, projection] as [number, number, number],
      })),
    };
  }, [wall, slabCorners]);

  return (
    <group position={strip.position} rotation={[0, wall.angle, 0]}>
      <group position={strip.backStripPos}>
        <mesh castShadow receiveShadow renderOrder={2}>
          <boxGeometry args={strip.backStripSize} />
          <meshStandardMaterial
            color="#9ca3af"
            roughness={0.45}
            metalness={0.9}
          />
        </mesh>
        <lineSegments>
          <edgesGeometry
            args={[new THREE.BoxGeometry(...strip.backStripSize)]}
          />
          <lineBasicMaterial color="#6b7280" linewidth={1} />
        </lineSegments>
      </group>

      {strip.teeth.map((tooth) => (
        <group
          key={tooth.key}
          position={tooth.pos}
          rotation={[COMB_STRIP_FLANGE_TILT, 0, 0]}
        >
          <group position={[0, 0, -tooth.size[2] / 2]}>
            <mesh castShadow receiveShadow renderOrder={2}>
              <boxGeometry args={tooth.size} />
              <meshStandardMaterial
                color="#9ca3af"
                roughness={0.45}
                metalness={0.9}
              />
            </mesh>
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(...tooth.size)]} />
              <lineBasicMaterial color="#6b7280" linewidth={1} />
            </lineSegments>
          </group>
        </group>
      ))}
    </group>
  );
}

export function WallHorizontalBattens({
  wall,
  wallHeight,
  layerEdges,
  openings,
  zOverride,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
  zOverride?: number;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const battens = useMemo(() => {
    const edge = layerEdges.spiklakt;
    const zPos = zOverride ?? edge.centerZ;
    const thickness = BATTEN_THICKNESS * MM;
    const height = BATTEN_HEIGHT * MM;
    const heightMm = BATTEN_HEIGHT;
    const wallHeightM = wallHeight * MM;
    const rows: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    const addBattensAtY = (y: number, index: number) => {
      const spans = splitHorizontalSpan(
        edge.coverageStart,
        edge.coverageEnd,
        y / MM - heightMm / 2,
        heightMm,
        openings,
      );
      for (let spanIndex = 0; spanIndex < spans.length; spanIndex += 1) {
        const span = spans[spanIndex];
        rows.push({
          key: `battens-${index}-${spanIndex}`,
          pos: [((span.start + span.end) / 2) * MM, y, zPos],
          size: [(span.end - span.start) * MM, height, thickness],
        });
      }
    };

    let centerY = height / 2;
    let rowIndex = 0;
    while (centerY < wallHeightM - height / 2 - 0.001) {
      addBattensAtY(centerY, rowIndex);
      centerY += BATTEN_SPACING * MM;
      rowIndex += 1;
    }

    const topRowY = Math.max(height / 2, wallHeightM - height / 2);
    if (rowIndex === 0 || centerY - BATTEN_SPACING * MM < topRowY - 0.001) {
      addBattensAtY(topRowY, rowIndex);
    }

    return rows.map((row) => ({
      ...row,
      color: getSubtleWoodColor(row.key),
      roughness: getSubtleWoodRoughness(row.key),
      texture: cloneTextureWithLengthwiseOffset(pineTexture, row.key, "x"),
    }));
  }, [layerEdges, pineTexture, wallHeight, openings, zOverride]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {battens.map((batten) => (
        <group key={batten.key} position={batten.pos}>
          <mesh castShadow receiveShadow renderOrder={2}>
            <boxGeometry args={batten.size} />
            <meshStandardMaterial
              map={batten.texture}
              color={batten.color}
              roughness={batten.roughness}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...batten.size)]} />
            <lineBasicMaterial color="#7f5a38" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallVerticalBattens({
  wall,
  wallHeight,
  layerEdges,
  openings,
  zOverride,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
  zOverride?: number;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const battens = useMemo(() => {
    const edge = layerEdges.spiklakt;
    const zPos = zOverride ?? edge.centerZ;
    const thickness = BATTEN_THICKNESS * MM;
    const widthM = BATTEN_HEIGHT * MM;
    const widthMm = BATTEN_HEIGHT;
    const columns: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    const addColumnAtX = (xM: number, index: number) => {
      const spans = splitVerticalSpan(
        0,
        wallHeight,
        xM / MM - widthMm / 2,
        widthMm,
        openings,
      );
      for (let spanIndex = 0; spanIndex < spans.length; spanIndex += 1) {
        const span = spans[spanIndex];
        columns.push({
          key: `vertical-battens-${index}-${spanIndex}`,
          pos: [xM, ((span.start + span.end) / 2) * MM, zPos],
          size: [widthM, (span.end - span.start) * MM, thickness],
        });
      }
    };

    for (let index = 0; index < wall.studLayout.studs.length; index += 1) {
      const studXMm = wall.studLayout.studs[index].centerPosition;
      if (studXMm >= edge.coverageStart && studXMm <= edge.coverageEnd) {
        addColumnAtX(studXMm * MM, index);
      }
    }

    return columns.map((column) => ({
      ...column,
      color: getSubtleWoodColor(column.key),
      roughness: getSubtleWoodRoughness(column.key),
      texture: cloneTextureWithLengthwiseOffset(pineTexture, column.key, "y"),
    }));
  }, [layerEdges, pineTexture, wall, wallHeight, openings, zOverride]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {battens.map((batten) => (
        <group key={batten.key} position={batten.pos}>
          <mesh castShadow receiveShadow renderOrder={2}>
            <boxGeometry args={batten.size} />
            <meshStandardMaterial
              map={batten.texture}
              color={batten.color}
              roughness={batten.roughness}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...batten.size)]} />
            <lineBasicMaterial color="#7f5a38" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallStandingExteriorPanel({
  wall,
  wallHeight,
  boardLength,
  layerEdges,
  showPrimedWhite,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  boardLength: number;
  layerEdges: WallLayerEdges;
  showPrimedWhite: boolean;
  openings: WallOpening[];
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const panelData = useMemo(() => {
    const edge = layerEdges.panel;
    const panelThickness = EXTERIOR_PANEL_THICKNESS * MM;
    const boardWidth = EXTERIOR_PANEL_BOARD_WIDTH * MM;
    const visibleWidth = EXTERIOR_PANEL_VISIBLE_WIDTH * MM;
    const overlapWidth = Math.min(
      EXTERIOR_PANEL_OVERLAP_WIDTH * MM,
      boardWidth,
    );
    const falseWidth = Math.min(EXTERIOR_PANEL_REBATE_WIDTH * MM, boardWidth);
    const rabbetDepth = Math.min(
      EXTERIOR_PANEL_REBATE_DEPTH * MM,
      panelThickness,
    );
    const seamShadowWidth = EXTERIOR_PANEL_SEAM_SHADOW_WIDTH * MM;
    const seamShadowDepth = EXTERIOR_PANEL_SEAM_SHADOW_DEPTH * MM;
    const totalLength =
      Math.max(edge.coverageEnd - edge.coverageStart, 0.001) * MM;
    const panelBackZ = edge.innerFaceZ;
    const supports: number[] = [];

    let supportY = BATTEN_HEIGHT / 2;
    let supportIndex = 0;
    while (supportY < wallHeight - BATTEN_HEIGHT / 2 - 0.001) {
      supports.push(supportY);
      supportY += BATTEN_SPACING;
      supportIndex += 1;
    }
    const topSupportY = Math.max(
      BATTEN_HEIGHT / 2,
      wallHeight - BATTEN_HEIGHT / 2,
    );
    if (supportIndex === 0 || supportY - BATTEN_SPACING < topSupportY - 0.001) {
      supports.push(topSupportY);
    }

    const boards: {
      key: string;
      pos: [number, number, number];
      geometry: THREE.BufferGeometry;
      color: string;
      roughness: number;
      texture: THREE.Texture;
      paintColor: string;
      paintOpacity: number;
    }[] = [];
    const seamShadows: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    let boardStart = 0;
    let index = 0;
    while (boardStart < totalLength - 0.001) {
      const remainingWidth = totalLength - boardStart;
      const actualBoardWidth = Math.max(
        Math.min(boardWidth, remainingWidth),
        0.001,
      );
      const isFirst = index === 0;
      const isLast = boardStart + boardWidth >= totalLength - 0.001;
      const leftLapWidth = isFirst
        ? 0
        : Math.min(overlapWidth, actualBoardWidth);
      const rightLapWidth = isLast
        ? 0
        : Math.min(falseWidth, Math.max(actualBoardWidth - leftLapWidth, 0));
      const centerWidth = Math.max(
        actualBoardWidth - leftLapWidth - rightLapWidth,
        0,
      );

      if (
        actualBoardWidth > 0 &&
        (centerWidth > 0 || leftLapWidth > 0 || rightLapWidth > 0)
      ) {
        const boardLeftMm = edge.coverageStart + boardStart / MM;
        const staggerOffset = index % 2 === 1 ? boardLength / 2 : 0;
        const segments = getSupportAlignedBoardSegments(
          wallHeight,
          boardLength,
          staggerOffset,
          supports,
        );

        for (
          let segmentIndex = 0;
          segmentIndex < segments.length;
          segmentIndex += 1
        ) {
          const segment = segments[segmentIndex];
          const seed = `panel-${wall.id}-${index}-${segmentIndex}`;
          const cutouts = getBoardOpeningCutouts(
            boardLeftMm,
            segment.start,
            actualBoardWidth / MM,
            segment.length,
            openings,
          );

          boards.push({
            key: `panel-${index}-${segmentIndex}`,
            pos: [boardStart, segment.start * MM, panelBackZ],
            geometry: createBoardGeometryWithCutouts(
              createVerticalExteriorPanelBoardGeometry({
                boardWidth: actualBoardWidth,
                wallHeight: segment.length * MM,
                thickness: panelThickness,
                leftLapWidth,
                rightLapWidth,
                rabbetDepth,
                falseFaceAngle: EXTERIOR_PANEL_REBATE_FACE_ANGLE,
                faceChamfer: EXTERIOR_PANEL_FACE_CHAMFER * MM,
              }),
              panelThickness,
              cutouts,
            ),
            color: getSubtleWoodColor(seed),
            roughness: getSubtleWoodRoughness(seed),
            texture: cloneTextureWithLengthwiseOffset(pineTexture, seed, "y"),
            paintColor: getSubtlePaintColor(seed),
            paintOpacity: getSubtlePaintOpacity(seed),
          });
        }

        if (!isFirst) {
          const seamPieces = splitVerticalSpan(
            0,
            wallHeight,
            boardLeftMm,
            Math.min(seamShadowWidth, leftLapWidth) / MM,
            openings,
          );
          for (
            let seamIndex = 0;
            seamIndex < seamPieces.length;
            seamIndex += 1
          ) {
            const seamPiece = seamPieces[seamIndex];
            seamShadows.push({
              key: `panel-seam-${index}-${seamIndex}`,
              pos: [
                boardStart + leftLapWidth,
                ((seamPiece.start + seamPiece.end) / 2) * MM,
                panelBackZ - panelThickness + seamShadowDepth / 2,
              ],
              size: [
                Math.min(seamShadowWidth, leftLapWidth),
                (seamPiece.end - seamPiece.start) * MM,
                seamShadowDepth,
              ],
            });
          }
        }
      }

      boardStart += visibleWidth;
      index += 1;
    }

    return { rootX: edge.coverageStart * MM, boards, seamShadows };
  }, [boardLength, openings, layerEdges, pineTexture, wall, wallHeight]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[panelData.rootX, 0, 0]}>
        {panelData.seamShadows.map((seam) => (
          <group key={seam.key} position={seam.pos}>
            <mesh renderOrder={3}>
              <boxGeometry args={seam.size} />
              <meshStandardMaterial
                color="#4a3725"
                roughness={1}
                metalness={0}
                transparent
                opacity={0.18}
              />
            </mesh>
          </group>
        ))}
        {panelData.boards.map((part) => (
          <group key={part.key} position={part.pos}>
            <mesh
              castShadow
              receiveShadow
              renderOrder={2}
              geometry={part.geometry}
            >
              <meshStandardMaterial
                map={part.texture}
                color={showPrimedWhite ? PRIMED_PANEL_BASE_COLOR : part.color}
                roughness={showPrimedWhite ? 0.9 : part.roughness}
                metalness={0}
              />
            </mesh>
            {showPrimedWhite && (
              <mesh receiveShadow renderOrder={3} geometry={part.geometry}>
                <meshStandardMaterial
                  color={part.paintColor}
                  roughness={0.97}
                  metalness={0}
                  transparent
                  opacity={part.paintOpacity}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

export function WallHorizontalExteriorPanel({
  wall,
  wallHeight,
  boardLength,
  layerEdges,
  showPrimedWhite,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  boardLength: number;
  layerEdges: WallLayerEdges;
  showPrimedWhite: boolean;
  openings: WallOpening[];
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const panelData = useMemo(() => {
    const edge = layerEdges.panel;
    const wallHeightM = wallHeight * MM;
    const panelThickness = EXTERIOR_PANEL_THICKNESS * MM;
    const boardHeight = EXTERIOR_PANEL_BOARD_WIDTH * MM;
    const visibleHeight = EXTERIOR_PANEL_VISIBLE_WIDTH * MM;
    const overlapWidth = Math.min(
      EXTERIOR_PANEL_OVERLAP_WIDTH * MM,
      boardHeight,
    );
    const falseWidth = Math.min(EXTERIOR_PANEL_REBATE_WIDTH * MM, boardHeight);
    const rabbetDepth = Math.min(
      EXTERIOR_PANEL_REBATE_DEPTH * MM,
      panelThickness,
    );
    const seamShadowWidth = EXTERIOR_PANEL_SEAM_SHADOW_WIDTH * MM;
    const seamShadowDepth = EXTERIOR_PANEL_SEAM_SHADOW_DEPTH * MM;
    const panelBackZ = edge.innerFaceZ;
    const supports = wall.studLayout.studs
      .map((stud) => stud.centerPosition - edge.coverageStart)
      .filter(
        (support) =>
          support >= 0.001 &&
          support <= edge.coverageEnd - edge.coverageStart - 0.001,
      );

    const boards: {
      key: string;
      pos: [number, number, number];
      geometry: THREE.BufferGeometry;
      color: string;
      roughness: number;
      texture: THREE.Texture;
      paintColor: string;
      paintOpacity: number;
    }[] = [];
    const seamShadows: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
    }[] = [];

    let boardStart = 0;
    let index = 0;
    while (boardStart < wallHeightM - 0.001) {
      const remainingHeight = wallHeightM - boardStart;
      const actualBoardHeight = Math.max(
        Math.min(boardHeight, remainingHeight),
        0.001,
      );
      const isFirst = index === 0;
      const isLast = boardStart + boardHeight >= wallHeightM - 0.001;
      const lowerLapWidth = isFirst
        ? 0
        : Math.min(overlapWidth, actualBoardHeight);
      const upperFalseWidth = isLast
        ? 0
        : Math.min(falseWidth, Math.max(actualBoardHeight - lowerLapWidth, 0));
      const centerWidth = Math.max(
        actualBoardHeight - lowerLapWidth - upperFalseWidth,
        0,
      );

      if (
        actualBoardHeight > 0 &&
        (centerWidth > 0 || lowerLapWidth > 0 || upperFalseWidth > 0)
      ) {
        const boardBottomMm = boardStart / MM;
        const staggerOffset = index % 2 === 1 ? boardLength / 2 : 0;
        const segments = getSupportAlignedBoardSegments(
          edge.coverageEnd - edge.coverageStart,
          boardLength,
          staggerOffset,
          supports,
        );

        for (
          let segmentIndex = 0;
          segmentIndex < segments.length;
          segmentIndex += 1
        ) {
          const segment = segments[segmentIndex];
          const segmentStart = edge.coverageStart + segment.start;
          const seed = `horizontal-panel-${wall.id}-${index}-${segmentIndex}`;
          const cutouts = getBoardOpeningCutouts(
            segmentStart,
            boardBottomMm,
            segment.length,
            actualBoardHeight / MM,
            openings,
          );

          boards.push({
            key: `horizontal-panel-${index}-${segmentIndex}`,
            pos: [
              (segmentStart - edge.coverageStart) * MM,
              boardStart,
              panelBackZ,
            ],
            geometry: createBoardGeometryWithCutouts(
              createHorizontalExteriorPanelBoardGeometry({
                boardHeight: actualBoardHeight,
                wallLength: segment.length * MM,
                thickness: panelThickness,
                leftLapWidth: lowerLapWidth,
                rightLapWidth: upperFalseWidth,
                rabbetDepth,
                falseFaceAngle: EXTERIOR_PANEL_REBATE_FACE_ANGLE,
                faceChamfer: EXTERIOR_PANEL_FACE_CHAMFER * MM,
              }),
              panelThickness,
              cutouts,
            ),
            color: getSubtleWoodColor(seed),
            roughness: getSubtleWoodRoughness(seed),
            texture: cloneTextureWithLengthwiseOffset(pineTexture, seed, "x"),
            paintColor: getSubtlePaintColor(seed),
            paintOpacity: getSubtlePaintOpacity(seed),
          });
        }

        if (!isFirst) {
          const seamPieces = splitHorizontalSpan(
            edge.coverageStart,
            edge.coverageEnd,
            boardBottomMm,
            Math.min(seamShadowWidth, lowerLapWidth) / MM,
            openings,
          );
          for (
            let seamIndex = 0;
            seamIndex < seamPieces.length;
            seamIndex += 1
          ) {
            const seamPiece = seamPieces[seamIndex];
            seamShadows.push({
              key: `horizontal-panel-seam-${index}-${seamIndex}`,
              pos: [
                ((seamPiece.start + seamPiece.end) / 2 - edge.coverageStart) *
                  MM,
                boardStart + lowerLapWidth,
                panelBackZ - panelThickness + seamShadowDepth / 2,
              ],
              size: [
                (seamPiece.end - seamPiece.start) * MM,
                Math.min(seamShadowWidth, lowerLapWidth),
                seamShadowDepth,
              ],
            });
          }
        }
      }

      boardStart += visibleHeight;
      index += 1;
    }

    return { rootX: edge.coverageStart * MM, boards, seamShadows };
  }, [boardLength, openings, layerEdges, pineTexture, wall, wallHeight]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <group position={[panelData.rootX, 0, 0]}>
        {panelData.seamShadows.map((seam) => (
          <group key={seam.key} position={seam.pos}>
            <mesh renderOrder={3}>
              <boxGeometry args={seam.size} />
              <meshStandardMaterial
                color="#4a3725"
                roughness={1}
                metalness={0}
                transparent
                opacity={0.18}
              />
            </mesh>
          </group>
        ))}
        {panelData.boards.map((part) => (
          <group key={part.key} position={part.pos}>
            <mesh
              castShadow
              receiveShadow
              renderOrder={2}
              geometry={part.geometry}
            >
              <meshStandardMaterial
                map={part.texture}
                color={showPrimedWhite ? PRIMED_PANEL_BASE_COLOR : part.color}
                roughness={showPrimedWhite ? 0.9 : part.roughness}
                metalness={0}
              />
            </mesh>
            {showPrimedWhite && (
              <mesh receiveShadow renderOrder={3} geometry={part.geometry}>
                <meshStandardMaterial
                  color={part.paintColor}
                  roughness={0.97}
                  metalness={0}
                  transparent
                  opacity={part.paintOpacity}
                  depthWrite={false}
                  polygonOffset
                  polygonOffsetFactor={-1}
                  polygonOffsetUnits={-1}
                />
              </mesh>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

export function WallVaporBarrier({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const barrierPieces = useMemo(() => {
    const studThickness = wall.thickness * MM;
    const startOuterInset =
      wall.startCorner.joint === "through" &&
      wall.startCorner.interiorAngle <= Math.PI
        ? studThickness
        : 0;
    const endOuterInset =
      wall.endCorner.joint === "through" &&
      wall.endCorner.interiorAngle <= Math.PI
        ? studThickness
        : 0;
    const startInnerExtension =
      wall.startCorner.joint === "through" &&
      wall.startCorner.interiorAngle > Math.PI
        ? studThickness
        : 0;
    const endInnerExtension =
      wall.endCorner.joint === "through" &&
      wall.endCorner.interiorAngle > Math.PI
        ? studThickness
        : 0;
    const coverageStartMm = (startOuterInset - startInnerExtension) / MM;
    const coverageEndMm =
      (wall.effectiveLength * MM - endOuterInset + endInnerExtension) / MM;
    const barrierThickness = HOUSE_WRAP_THICKNESS * MM;
    const zPos = (wall.thickness * MM) / 2 + barrierThickness / 2;

    return subtractOpeningsFromRect(
      coverageStartMm,
      0,
      coverageEndMm - coverageStartMm,
      wallHeight,
      openings,
    ).map((rect, index) => ({
      key: `vapor-piece-${index}`,
      pos: [(rect.x + rect.w / 2) * MM, (rect.y + rect.h / 2) * MM, zPos] as [
        number,
        number,
        number,
      ],
      size: [rect.w * MM, rect.h * MM, barrierThickness] as [
        number,
        number,
        number,
      ],
    }));
  }, [wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {barrierPieces.map((piece) => (
        <group key={piece.key} position={piece.pos}>
          <mesh renderOrder={1}>
            <boxGeometry args={piece.size} />
            <meshStandardMaterial
              color="#72c2ff"
              transparent
              opacity={0.4}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...piece.size)]} />
            <lineBasicMaterial color="#72c2ff" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallOsbBoards({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const osbTexture = useMemo(() => getOsbTexture(), []);

  const boards = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];
    const boardThicknessM = OSB_BOARD_THICKNESS * MM;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const boardHeight = Math.min(OSB_BOARD_HEIGHT, wallHeight - yStart);
      let xStart = 0;
      let colIndex = 0;

      while (xStart < wall.effectiveLength - 0.001) {
        const boardWidth = Math.min(
          OSB_BOARD_WIDTH,
          wall.effectiveLength - xStart,
        );
        const pieces = subtractOpeningsFromRect(
          xStart,
          yStart,
          boardWidth,
          boardHeight,
          openings,
        );
        for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
          const piece = pieces[pieceIndex];
          result.push({
            key: `osb-${rowIndex}-${colIndex}-${pieceIndex}`,
            pos: [
              (piece.x + piece.w / 2) * MM,
              (piece.y + piece.h / 2) * MM,
              0,
            ],
            size: [piece.w * MM, piece.h * MM, boardThicknessM],
            color:
              (rowIndex + colIndex + pieceIndex) % 2 === 0
                ? "#f1dfc2"
                : "#e7d2b0",
          });
        }

        xStart += OSB_BOARD_WIDTH;
        colIndex += 1;
      }

      yStart += OSB_BOARD_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );
  if (boards.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {boards.map((board) => (
        <group key={board.key} position={board.pos}>
          <mesh castShadow receiveShadow renderOrder={1}>
            <boxGeometry args={board.size} />
            <meshStandardMaterial
              map={osbTexture}
              color={board.color}
              roughness={0.92}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...board.size)]} />
            <lineBasicMaterial color="#7c5732" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallDrywallBoards({
  wall,
  wallHeight,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
}) {
  const boards = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];
    const boardThicknessM = DRYWALL_BOARD_THICKNESS * MM;
    const jointOffset =
      wall.effectiveLength > DRYWALL_BOARD_WIDTH
        ? -(DRYWALL_BOARD_WIDTH / 2)
        : 0;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const boardHeight = Math.min(DRYWALL_BOARD_HEIGHT, wallHeight - yStart);
      let xStart = jointOffset;
      let colIndex = 0;

      while (xStart < wall.effectiveLength - 0.001) {
        const rawEnd = xStart + DRYWALL_BOARD_WIDTH;
        const clippedStart = Math.max(xStart, 0);
        const clippedEnd = Math.min(rawEnd, wall.effectiveLength);
        const boardWidth = clippedEnd - clippedStart;

        if (boardWidth <= 0.001) {
          xStart += DRYWALL_BOARD_WIDTH;
          colIndex += 1;
          continue;
        }

        const pieces = subtractOpeningsFromRect(
          clippedStart,
          yStart,
          boardWidth,
          boardHeight,
          openings,
        );
        for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
          const piece = pieces[pieceIndex];
          result.push({
            key: `drywall-${rowIndex}-${colIndex}-${pieceIndex}`,
            pos: [
              (piece.x + piece.w / 2) * MM,
              (piece.y + piece.h / 2) * MM,
              0,
            ],
            size: [piece.w * MM, piece.h * MM, boardThicknessM],
            color:
              (rowIndex + colIndex + pieceIndex) % 2 === 0
                ? "#f4f1ea"
                : "#ece7de",
          });
        }

        xStart += DRYWALL_BOARD_WIDTH;
        colIndex += 1;
      }

      yStart += DRYWALL_BOARD_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );
  if (boards.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {boards.map((board) => (
        <group key={board.key} position={board.pos}>
          <mesh castShadow receiveShadow renderOrder={1}>
            <boxGeometry args={board.size} />
            <meshStandardMaterial
              color={board.color}
              roughness={0.96}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...board.size)]} />
            <lineBasicMaterial color="#c8c1b6" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function mapFinishOpenings(
  openings: WallOpening[],
  framingWall: Wall,
  finishWall: Wall,
) {
  return mapOpeningsToWall(openings, framingWall, finishWall);
}
