"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

import type { Wall, WallOpening } from "../../lib/configurator";
import {
  computeOpeningFraming,
  mapOpeningsToWall,
  splitHorizontalSpan,
  subtractOpeningsFromRect,
} from "../../lib/configurator/openings";
import { getPineTexture } from "../../lib/woodTexture";
import {
  CAVITY_INSULATION_SHEET_HEIGHT,
  DRYWALL_BOARD_HEIGHT,
  DRYWALL_BOARD_WIDTH,
  INSULATION_SHEET_HEIGHT,
  INSULATION_SHEET_WIDTH,
  MM,
  PLATE_HEIGHT,
  STUD_COLOR,
  VERTICAL_PLATE_HEIGHT,
  VERTICAL_PLATE_THICKNESS,
  type WallLayerEdges,
} from "../../lib/configuratorScene/constants";
import {
  cloneTextureWithLengthwiseOffset,
  createNotchedStudGeometry,
  createRockwoolTexture,
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

function getWallStudDimensions(wall: Wall) {
  const firstStud = wall.studLayout.studs[0];

  return {
    studWidth: firstStud?.width ?? 45,
    studDepth: firstStud?.depth ?? wall.thickness,
  };
}

export function WallFraming({
  wall,
  wallHeight,
  showVerticalTopPlate,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  showVerticalTopPlate: boolean;
  openings: WallOpening[];
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const meshes = useMemo(() => {
    const result: Array<{
      key: string;
      pos: [number, number, number];
      size?: [number, number, number];
      geometry?: THREE.BufferGeometry;
    }> = [];

    const { studWidth: studW, studDepth: studD } = getWallStudDimensions(wall);
    const studWM = studW * MM;
    const studDM = studD * MM;
    const plateH = PLATE_HEIGHT * MM;
    const wallH = wallHeight * MM;
    const effLen = wall.effectiveLength * MM;
    const fullStudH = (wallHeight - 2 * PLATE_HEIGHT) * MM;
    const verticalPlateH = showVerticalTopPlate
      ? VERTICAL_PLATE_HEIGHT * MM
      : 0;
    const verticalPlateD = showVerticalTopPlate
      ? VERTICAL_PLATE_THICKNESS * MM
      : 0;
    const verticalPlateZ = showVerticalTopPlate
      ? -(studDM / 2 - verticalPlateD / 2)
      : 0;
    const notchedStudGeometry =
      verticalPlateH > 0
        ? createNotchedStudGeometry(
            studWM,
            fullStudH,
            studDM,
            verticalPlateH,
            verticalPlateD,
          )
        : null;

    const openingFramings = openings.map((opening) =>
      computeOpeningFraming(
        opening,
        wall.studLayout.studs,
        wall.effectiveLength,
        wallHeight,
        studW,
        studD,
      ),
    );
    const removedIndices = new Set(
      openingFramings.flatMap((framing) => framing.removedStudIndices),
    );

    for (const [si, span] of splitHorizontalSpan(
      0,
      wall.effectiveLength,
      0,
      PLATE_HEIGHT,
      openings,
    ).entries()) {
      const spanW = (span.end - span.start) * MM;
      result.push({
        key: `bp-${si}`,
        pos: [((span.start + span.end) / 2) * MM, plateH / 2, 0],
        size: [spanW, plateH, studDM],
      });
    }

    result.push({
      key: "tp",
      pos: [effLen / 2, wallH - plateH / 2, 0],
      size: [effLen, plateH, studDM],
    });

    if (verticalPlateH > 0) {
      result.push({
        key: "vtp",
        pos: [effLen / 2, wallH - plateH - verticalPlateH / 2, verticalPlateZ],
        size: [effLen, verticalPlateH, verticalPlateD],
      });
    }

    for (let i = 0; i < wall.studLayout.studs.length; i += 1) {
      if (removedIndices.has(i)) continue;
      const stud = wall.studLayout.studs[i];
      const x = stud.centerPosition * MM;
      if (verticalPlateH > 0 && notchedStudGeometry) {
        result.push({
          key: `s-${i}`,
          pos: [x, plateH + fullStudH / 2, 0],
          geometry:
            stud.width === studW && stud.depth === studD
              ? notchedStudGeometry
              : createNotchedStudGeometry(
                  stud.width * MM,
                  fullStudH,
                  stud.depth * MM,
                  verticalPlateH,
                  verticalPlateD,
                ),
        });
      } else {
        result.push({
          key: `s-${i}`,
          pos: [x, plateH + fullStudH / 2, 0],
          size: [stud.width * MM, fullStudH, stud.depth * MM],
        });
      }
    }

    for (const framing of openingFramings) {
      for (const member of framing.members) {
        const key = `of-${framing.opening.id}-${member.type}-${Math.round(member.centerX)}`;
        const widthM = member.width * MM;
        const heightM = member.height * MM;
        const depthM = member.depth * MM;
        const needsNotch =
          verticalPlateH > 0 &&
          notchedStudGeometry &&
          (member.type === "trimmer" || member.type === "cripple-above");

        if (needsNotch) {
          result.push({
            key,
            pos: [member.centerX * MM, member.centerY * MM, 0],
            geometry: createNotchedStudGeometry(
              widthM,
              heightM,
              depthM,
              verticalPlateH,
              verticalPlateD,
            ),
          });
        } else {
          result.push({
            key,
            pos: [member.centerX * MM, member.centerY * MM, 0],
            size: [widthM, heightM, depthM],
          });
        }
      }
    }

    for (let i = 0; i < wall.studLayout.cornerStuds.length; i += 1) {
      const cornerStud = wall.studLayout.cornerStuds[i];
      const x = cornerStud.centerPosition * MM;
      const cornerStudWidth = cornerStud.width * MM;
      const cornerStudDepth = cornerStud.depth * MM;
      const halfDepth = cornerStudDepth / 2;
      const halfStudWidth = cornerStudWidth / 2;
      const zOffset =
        cornerStud.offsetSide === "inner"
          ? halfDepth - halfStudWidth
          : -(halfDepth - halfStudWidth);
      result.push({
        key: `cs-${i}`,
        pos: [x, plateH + fullStudH / 2, zOffset],
        size: [cornerStudDepth, fullStudH, cornerStudWidth],
      });
    }

    return result;
  }, [showVerticalTopPlate, wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {meshes.map((mesh) => (
        <group key={mesh.key} position={mesh.pos}>
          <mesh>
            {mesh.geometry ? (
              <primitive object={mesh.geometry} attach="geometry" />
            ) : (
              <boxGeometry args={mesh.size} />
            )}
            <meshStandardMaterial
              map={pineTexture}
              color={STUD_COLOR}
              roughness={0.85}
            />
          </mesh>
          <lineSegments>
            {mesh.geometry ? (
              <edgesGeometry args={[mesh.geometry]} />
            ) : (
              <edgesGeometry args={[new THREE.BoxGeometry(...mesh.size!)]} />
            )}
            <lineBasicMaterial color="#c8b08a" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallSurface({
  wall,
  wallHeight,
  color,
}: {
  wall: Wall;
  wallHeight: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const h = wallHeight * MM;
    const q = wall.quad;
    const shape = new THREE.Shape();
    shape.moveTo(q.outerStart.x * MM, q.outerStart.y * MM);
    shape.lineTo(q.outerEnd.x * MM, q.outerEnd.y * MM);
    shape.lineTo(q.innerEnd.x * MM, q.innerEnd.y * MM);
    shape.lineTo(q.innerStart.x * MM, q.innerStart.y * MM);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, [wall, wallHeight]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.7}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#b0a080" linewidth={1} />
      </lineSegments>
    </group>
  );
}

export function WallOutsideDrywall({
  wall,
  wallHeight,
  layerEdges,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
}) {
  const boards = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
    }[] = [];

    const edge = layerEdges.outsideDrywall;
    const { coverageStart, coverageEnd, centerZ, depthM } = edge;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const boardHeight = Math.min(DRYWALL_BOARD_HEIGHT, wallHeight - yStart);
      let xStart = coverageStart;
      let colIndex = 0;

      while (xStart < coverageEnd - 0.001) {
        const boardWidth = Math.min(DRYWALL_BOARD_WIDTH, coverageEnd - xStart);
        const pieces = subtractOpeningsFromRect(
          xStart,
          yStart,
          boardWidth,
          boardHeight,
          openings,
        );
        for (let pi = 0; pi < pieces.length; pi += 1) {
          const piece = pieces[pi];
          result.push({
            key: `outside-drywall-${rowIndex}-${colIndex}-${pi}`,
            pos: [
              (piece.x + piece.w / 2) * MM,
              (piece.y + piece.h / 2) * MM,
              centerZ,
            ],
            size: [piece.w * MM, piece.h * MM, depthM],
            color: (rowIndex + colIndex + pi) % 2 === 0 ? "#e8e4da" : "#ddd8cd",
          });
        }

        xStart += DRYWALL_BOARD_WIDTH;
        colIndex += 1;
      }

      yStart += DRYWALL_BOARD_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [layerEdges, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  if (boards.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {boards.map((board) => (
        <group key={board.key} position={board.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={board.size} />
            <meshStandardMaterial
              color={board.color}
              roughness={0.92}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...board.size)]} />
            <lineBasicMaterial color="#b8b2a6" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallInsulationSheets({
  wall,
  wallHeight,
  thickness,
  layerEdges,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  thickness: number;
  layerEdges: WallLayerEdges;
  openings: WallOpening[];
}) {
  const rockwoolTexture = useMemo(() => createRockwoolTexture(), []);

  const sheets = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color: string;
      texture: THREE.Texture;
    }[] = [];

    if (thickness <= 0) return result;

    const edge = layerEdges.outsideInsulation;
    const { coverageStart, coverageEnd, centerZ, depthM } = edge;
    const studWidth = wall.studLayout.studs[0]?.width ?? 45;
    const studSpacing = wall.studLayout.targetSpacing;
    const firstStudGrid =
      Math.ceil(
        (wall.startCorner.retraction + studWidth / 2 + 0.001) / studSpacing,
      ) * studSpacing;
    const studGridOrigin = firstStudGrid - wall.startCorner.retraction;
    const gridAlignedStart =
      Math.floor((coverageStart - studGridOrigin) / INSULATION_SHEET_WIDTH) *
        INSULATION_SHEET_WIDTH +
      studGridOrigin;

    let yStart = 0;
    let rowIndex = 0;
    while (yStart < wallHeight - 0.001) {
      const sheetHeight = Math.min(
        INSULATION_SHEET_HEIGHT,
        wallHeight - yStart,
      );
      let sheetIndex = 0;

      while (true) {
        const rawStart = gridAlignedStart + sheetIndex * INSULATION_SHEET_WIDTH;
        const rawEnd = rawStart + INSULATION_SHEET_WIDTH;
        if (rawStart >= coverageEnd - 0.001) break;

        const clippedStart = Math.max(rawStart, coverageStart);
        const clippedEnd = Math.min(rawEnd, coverageEnd);
        const sheetWidth = clippedEnd - clippedStart;
        if (sheetWidth <= 0.001) {
          sheetIndex += 1;
          continue;
        }

        const pieces = subtractOpeningsFromRect(
          clippedStart,
          yStart,
          sheetWidth,
          sheetHeight,
          openings,
        );
        for (let pi = 0; pi < pieces.length; pi += 1) {
          const piece = pieces[pi];
          result.push({
            key: `ins-${rowIndex}-${sheetIndex}-${pi}`,
            pos: [
              (piece.x + piece.w / 2) * MM,
              (piece.y + piece.h / 2) * MM,
              centerZ,
            ],
            size: [piece.w * MM, piece.h * MM, depthM],
            color:
              (rowIndex + sheetIndex + pi) % 2 === 0 ? "#d3c784" : "#c7ba78",
            texture: cloneTextureWithLengthwiseOffset(
              rockwoolTexture,
              `rockwool-${rowIndex}-${sheetIndex}-${pi}`,
              "y",
            ),
          });
        }

        sheetIndex += 1;
      }

      yStart += INSULATION_SHEET_HEIGHT;
      rowIndex += 1;
    }

    return result;
  }, [openings, layerEdges, rockwoolTexture, thickness, wall, wallHeight]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  if (thickness <= 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {sheets.map((sheet) => (
        <group key={sheet.key} position={sheet.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={sheet.size} />
            <meshStandardMaterial
              map={sheet.texture}
              color={sheet.color}
              roughness={1}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...sheet.size)]} />
            <lineBasicMaterial color="#a29664" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallCavityInsulation({
  wall,
  wallHeight,
  showVerticalTopPlate,
  openings,
}: {
  wall: Wall;
  wallHeight: number;
  showVerticalTopPlate: boolean;
  openings: WallOpening[];
}) {
  const panels = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size?: [number, number, number];
      geometry?: THREE.BufferGeometry;
      color: string;
    }[] = [];

    const studs = wall.studLayout.studs;
    if (studs.length < 2) return result;

    const studWidth = studs[0]?.width ?? 45;
    const studDepth = studs[0]?.depth ?? wall.thickness;
    const studSpacing = wall.studLayout.targetSpacing;
    const plateH = PLATE_HEIGHT;
    const verticalPlateH = showVerticalTopPlate
      ? Math.min(VERTICAL_PLATE_HEIGHT, wallHeight)
      : 0;
    const cavityBottom = plateH;
    const cavityTop = wallHeight - plateH;
    const cavityHeight = cavityTop - cavityBottom;
    if (cavityHeight <= 0.001) return result;

    const panelDepth = studDepth * MM;
    const maxPanelWidth = Math.max(studSpacing - studWidth, 1);
    const verticalPlateZoneStart = wallHeight - plateH - verticalPlateH;
    const expandedOpenings: WallOpening[] = openings.map((opening) => {
      const expandedBottom = Math.max(opening.bottom - studWidth, 0);
      const expandedTop = opening.bottom + opening.height + studWidth;
      return {
        ...opening,
        left: opening.left - studWidth,
        bottom: expandedBottom,
        width: opening.width + studWidth * 2,
        height: expandedTop - expandedBottom,
      };
    });

    for (let i = 0; i < studs.length - 1; i += 1) {
      const leftStud = studs[i];
      const rightStud = studs[i + 1];
      const bayStart = leftStud.centerPosition + leftStud.width / 2;
      const bayEnd = rightStud.centerPosition - rightStud.width / 2;
      const bayWidth = bayEnd - bayStart;

      if (bayWidth <= 1) continue;

      const panelCount = Math.max(1, Math.ceil(bayWidth / maxPanelWidth));
      const panelWidth = bayWidth / panelCount;
      let rowStart = cavityBottom;
      let rowIndex = 0;

      while (rowStart < cavityTop - 0.001) {
        const panelHeight = Math.min(
          CAVITY_INSULATION_SHEET_HEIGHT,
          cavityTop - rowStart,
        );
        const rowEnd = rowStart + panelHeight;
        const notchHeight =
          verticalPlateH > 0
            ? Math.max(
                0,
                Math.min(rowEnd - verticalPlateZoneStart, panelHeight),
              )
            : 0;

        for (let panelIndex = 0; panelIndex < panelCount; panelIndex += 1) {
          const panelStart = bayStart + panelIndex * panelWidth;
          const xCenter = panelStart + panelWidth / 2;
          const pieces = subtractOpeningsFromRect(
            panelStart,
            rowStart,
            panelWidth,
            panelHeight,
            expandedOpenings,
          );

          if (
            pieces.length === 1 &&
            Math.abs(pieces[0].w - panelWidth) < 1 &&
            Math.abs(pieces[0].h - panelHeight) < 1
          ) {
            const panelGeometry =
              notchHeight > 0
                ? createNotchedStudGeometry(
                    panelWidth * MM,
                    panelHeight * MM,
                    panelDepth,
                    notchHeight * MM,
                    VERTICAL_PLATE_THICKNESS * MM,
                  )
                : undefined;

            result.push({
              key: `cavity-${i}-${rowIndex}-${panelIndex}`,
              pos: [xCenter * MM, (rowStart + panelHeight / 2) * MM, 0],
              size: panelGeometry
                ? undefined
                : [panelWidth * MM, panelHeight * MM, panelDepth],
              geometry: panelGeometry,
              color: (rowIndex + panelIndex) % 2 === 0 ? "#d8bf72" : "#ccb165",
            });
          } else {
            for (let pi = 0; pi < pieces.length; pi += 1) {
              const piece = pieces[pi];
              result.push({
                key: `cavity-${i}-${rowIndex}-${panelIndex}-p${pi}`,
                pos: [
                  (piece.x + piece.w / 2) * MM,
                  (piece.y + piece.h / 2) * MM,
                  0,
                ],
                size: [piece.w * MM, piece.h * MM, panelDepth],
                color:
                  (rowIndex + panelIndex + pi) % 2 === 0
                    ? "#d8bf72"
                    : "#ccb165",
              });
            }
          }
        }

        rowStart += CAVITY_INSULATION_SHEET_HEIGHT;
        rowIndex += 1;
      }
    }

    return result;
  }, [showVerticalTopPlate, wall, wallHeight, openings]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  if (panels.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {panels.map((panel) => (
        <group key={panel.key} position={panel.pos}>
          <mesh castShadow receiveShadow>
            {panel.geometry ? (
              <primitive object={panel.geometry} attach="geometry" />
            ) : (
              <boxGeometry args={panel.size} />
            )}
            <meshStandardMaterial
              color={panel.color}
              roughness={0.95}
              metalness={0}
            />
          </mesh>
          <lineSegments>
            {panel.geometry ? (
              <edgesGeometry args={[panel.geometry]} />
            ) : (
              <edgesGeometry args={[new THREE.BoxGeometry(...panel.size!)]} />
            )}
            <lineBasicMaterial color="#8d7341" linewidth={1} />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}

export function WallInstallationLayer({
  wall,
  framingWall,
  wallHeight,
  thickness,
  maxStudLength,
  openings,
}: {
  wall: Wall;
  framingWall: Wall;
  wallHeight: number;
  thickness: number;
  maxStudLength: number;
  openings: WallOpening[];
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const layer = useMemo(() => {
    const result: {
      key: string;
      pos: [number, number, number];
      size: [number, number, number];
      color?: string;
    }[] = [];

    if (thickness <= 0) return result;

    const studWidth = 45;
    const studDepth = thickness;
    const studSpacing = 600;
    const studWidthM = studWidth * MM;
    const studDepthM = studDepth * MM;
    const framingOrigin = {
      x: (framingWall.quad.outerStart.x + framingWall.quad.innerStart.x) / 2,
      y: (framingWall.quad.outerStart.y + framingWall.quad.innerStart.y) / 2,
    };
    const layerOrigin = {
      x: (wall.quad.outerStart.x + wall.quad.innerStart.x) / 2,
      y: (wall.quad.outerStart.y + wall.quad.innerStart.y) / 2,
    };
    const startOffset =
      (layerOrigin.x - framingOrigin.x) * framingWall.direction.x +
      (layerOrigin.y - framingOrigin.y) * framingWall.direction.y;
    const coverageStart = 0;
    const coverageEnd = wall.effectiveLength;
    const segmentLength = Math.max(maxStudLength, 1);
    const segmentBreaks = [coverageStart];
    const jointCandidates = framingWall.studLayout.studs
      .map((stud) => stud.centerPosition - startOffset)
      .filter(
        (centerPosition) =>
          centerPosition > coverageStart + 0.001 &&
          centerPosition < coverageEnd - 0.001,
      );
    const studRowCenters: number[] = [];

    while (segmentBreaks[segmentBreaks.length - 1] < coverageEnd - 0.001) {
      const segmentStart = segmentBreaks[segmentBreaks.length - 1];
      const maxSegmentEnd = Math.min(segmentStart + segmentLength, coverageEnd);
      const alignedJoint = jointCandidates.findLast(
        (centerPosition) =>
          centerPosition > segmentStart + 0.001 &&
          centerPosition <= maxSegmentEnd + 0.001,
      );
      const nextBreak = alignedJoint ?? maxSegmentEnd;

      if (nextBreak <= segmentStart + 0.001) {
        segmentBreaks.push(coverageEnd);
        break;
      }

      segmentBreaks.push(nextBreak);
    }

    for (
      let centerY = studWidth / 2;
      centerY < wallHeight - studWidth / 2 - 0.001;
      centerY += studSpacing
    ) {
      studRowCenters.push(centerY);
    }
    studRowCenters.push(wallHeight - studWidth / 2);

    const mappedOpenings = mapOpeningsToWall(openings, framingWall, wall);
    const expandedOpenings: WallOpening[] = mappedOpenings.map((opening) => {
      const expandedBottom = Math.max(opening.bottom - studWidth, 0);
      const expandedTop = opening.bottom + opening.height + studWidth;
      return {
        ...opening,
        left: opening.left - studWidth,
        bottom: expandedBottom,
        width: opening.width + studWidth * 2,
        height: expandedTop - expandedBottom,
      };
    });

    for (let rowIndex = 0; rowIndex < studRowCenters.length; rowIndex += 1) {
      const rowCenter = studRowCenters[rowIndex];
      const rowBottom = rowCenter - studWidth / 2;

      for (let i = 0; i < segmentBreaks.length - 1; i += 1) {
        const spans = splitHorizontalSpan(
          segmentBreaks[i],
          segmentBreaks[i + 1],
          rowBottom,
          studWidth,
          expandedOpenings,
        );
        for (let si = 0; si < spans.length; si += 1) {
          const span = spans[si];
          const spanWidth = Math.max(span.end - span.start, 0.001);
          result.push({
            key: `install-stud-${rowIndex}-${i}-${si}`,
            pos: [(span.start + spanWidth / 2) * MM, rowCenter * MM, 0],
            size: [spanWidth * MM, studWidthM, studDepthM],
          });
        }
      }
    }

    for (let oi = 0; oi < mappedOpenings.length; oi += 1) {
      const opening = mappedOpenings[oi];
      const leftTrimmerX = opening.left - studWidth / 2;
      if (leftTrimmerX >= -0.1 && leftTrimmerX <= coverageEnd + 0.1) {
        const trimmerHeight = opening.height;
        if (trimmerHeight > 1) {
          result.push({
            key: `install-trimmer-left-${oi}`,
            pos: [
              leftTrimmerX * MM,
              ((opening.bottom + opening.bottom + opening.height) / 2) * MM,
              0,
            ],
            size: [studWidthM, trimmerHeight * MM, studDepthM],
          });
        }
      }

      const rightTrimmerX = opening.left + opening.width + studWidth / 2;
      if (rightTrimmerX >= -0.1 && rightTrimmerX <= coverageEnd + 0.1) {
        const trimmerHeight = opening.height;
        if (trimmerHeight > 1) {
          result.push({
            key: `install-trimmer-right-${oi}`,
            pos: [
              rightTrimmerX * MM,
              ((opening.bottom + opening.bottom + opening.height) / 2) * MM,
              0,
            ],
            size: [studWidthM, trimmerHeight * MM, studDepthM],
          });
        }
      }

      const headerY = opening.bottom + opening.height + studWidth / 2;
      if (headerY <= wallHeight - 0.1) {
        const headerLeft = opening.left - studWidth;
        const headerRight = opening.left + opening.width + studWidth;
        result.push({
          key: `install-header-${oi}`,
          pos: [((headerLeft + headerRight) / 2) * MM, headerY * MM, 0],
          size: [(headerRight - headerLeft) * MM, studWidthM, studDepthM],
        });
      }

      if (opening.bottom > studWidth + 1) {
        const sillLeft = opening.left - studWidth;
        const sillRight = opening.left + opening.width + studWidth;
        result.push({
          key: `install-sill-${oi}`,
          pos: [
            ((sillLeft + sillRight) / 2) * MM,
            (opening.bottom - studWidth / 2) * MM,
            0,
          ],
          size: [(sillRight - sillLeft) * MM, studWidthM, studDepthM],
        });
      }
    }

    for (
      let rowIndex = 0;
      rowIndex < studRowCenters.length - 1;
      rowIndex += 1
    ) {
      const bayBottom = studRowCenters[rowIndex] + studWidth / 2;
      const bayTop = studRowCenters[rowIndex + 1] - studWidth / 2;
      const bayHeight = bayTop - bayBottom;
      if (bayHeight <= 1) continue;

      let xStart = coverageStart;
      let panelIndex = 0;
      while (xStart < coverageEnd - 0.001) {
        const panelWidth = Math.min(
          CAVITY_INSULATION_SHEET_HEIGHT,
          coverageEnd - xStart,
        );
        const pieces = subtractOpeningsFromRect(
          xStart,
          bayBottom,
          panelWidth,
          bayHeight,
          expandedOpenings,
        );
        for (let pi = 0; pi < pieces.length; pi += 1) {
          const piece = pieces[pi];
          result.push({
            key: `install-insulation-${rowIndex}-${panelIndex}-${pi}`,
            pos: [
              (piece.x + piece.w / 2) * MM,
              (piece.y + piece.h / 2) * MM,
              0,
            ],
            size: [piece.w * MM, piece.h * MM, studDepthM],
            color:
              (rowIndex + panelIndex + pi) % 2 === 0 ? "#d8bf72" : "#ccb165",
          });
        }

        xStart += CAVITY_INSULATION_SHEET_HEIGHT;
        panelIndex += 1;
      }
    }

    return result;
  }, [framingWall, maxStudLength, openings, thickness, wall, wallHeight]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  if (thickness <= 0 || layer.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {layer.map((part) => (
        <group key={part.key} position={part.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={part.size} />
            {part.color ? (
              <meshStandardMaterial
                color={part.color}
                roughness={0.95}
                metalness={0}
              />
            ) : (
              <meshStandardMaterial
                map={pineTexture}
                color={STUD_COLOR}
                roughness={0.85}
              />
            )}
          </mesh>
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(...part.size)]} />
            <lineBasicMaterial
              color={part.color ? "#8d7341" : "#c8b08a"}
              linewidth={1}
            />
          </lineSegments>
        </group>
      ))}
    </group>
  );
}
