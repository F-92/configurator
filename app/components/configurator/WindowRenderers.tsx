"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

import type { Wall, WallOpening } from "../../lib/configurator";
import {
  MM,
  PRIMED_PANEL_BASE_COLOR,
  type WallLayerEdges,
} from "../../lib/configuratorScene/constants";
import { getPineTexture } from "../../lib/woodTexture";

const WINDOW_FRAME_FACE = 44;
const WINDOW_FRAME_DEPTH = 116;
const WINDOW_SASH_FACE = 53;
const WINDOW_SASH_DEPTH = 56;
const WINDOW_SASH_INSET = 28;
const WINDOW_OUTER_BUCK_WIDTH = 45;
const WINDOW_GLAZING_BEAD_FACE = 10;
const WINDOW_GLAZING_BEAD_DEPTH = 12;
const WINDOW_GLASS_DEPTH = 15;
const EXTERIOR_TRIM_WIDTH = 95;
const EXTERIOR_TRIM_DEPTH = 22;
const HEAD_FLASHING_HEIGHT = 22;
const HEAD_FLASHING_PROJECTION = 55;
const FLASHING_SIDE_OVERHANG = 20;
const SILL_FLASHING_SHEET_THICKNESS = 1;
const SILL_FLASHING_SLOT_DEPTH = 4;
const SILL_FLASHING_VISIBLE_TOP = 6;
const SILL_FLASHING_FRONT_DROP = 10;
const SILL_FLASHING_SLOPE_DEGREES = 14;
const SILL_FLASHING_SLOPE_LENGTH = 60;
const SILL_FLASHING_DRIP_EDGE = 20;
const SILL_FLASHING_SLOT_HEIGHT = 2;
const WINDOW_SILL_TOP_SLOPE_DEGREES = 12;
const WINDOW_SILL_NOTCH_DEPTH = 12;
const WINDOW_SILL_NOTCH_HEIGHT = 12;

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

function createSillProfileGeometry({
  depth,
  height,
  notchDepth,
  notchHeight,
  slopeDegrees,
  width,
}: {
  depth: number;
  height: number;
  notchDepth: number;
  notchHeight: number;
  slopeDegrees: number;
  width: number;
}) {
  const slopeDrop = Math.min(
    Math.tan(THREE.MathUtils.degToRad(slopeDegrees)) * depth,
    height - notchHeight - 8 * MM,
  );
  const frontTop = Math.max(height - slopeDrop, notchHeight + 8 * MM);
  const shape = new THREE.Shape();

  shape.moveTo(0, 0);
  shape.lineTo(0, frontTop);
  shape.lineTo(depth, height);
  shape.lineTo(depth, notchHeight);
  shape.lineTo(notchDepth, notchHeight);
  shape.lineTo(notchDepth, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: width,
    steps: 1,
  });

  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  geometry.computeVertexNormals();

  return {
    edges: new THREE.EdgesGeometry(geometry),
    frontTop,
    geometry,
    slopeDrop,
  };
}

export function WallWindows({
  wall,
  openings,
  layerEdges,
  showPrimedWhite,
}: {
  wall: Wall;
  openings: WallOpening[];
  layerEdges: WallLayerEdges;
  showPrimedWhite: boolean;
}) {
  const pineTexture = useMemo(() => getPineTexture(), []);

  const assemblies = useMemo(() => {
    return openings
      .filter((opening) => opening.width > 120 && opening.height > 120)
      .map((opening) => {
        const frameFace = Math.min(
          WINDOW_FRAME_FACE,
          Math.max(Math.min(opening.width, opening.height) / 4, 30),
        );
        const frameDepth = Math.min(
          WINDOW_FRAME_DEPTH,
          Math.max(wall.thickness - 12, 90),
        );
        const outsideInsulationM = layerEdges.outsideInsulation.depthM;
        const frameDepthM = frameDepth * MM;
        const frameFaceM = frameFace * MM;
        const outerBuckWidthM =
          Math.min(
            WINDOW_OUTER_BUCK_WIDTH,
            wall.studLayout.studs[0]?.width ?? WINDOW_OUTER_BUCK_WIDTH,
          ) * MM;
        const sashFaceM =
          Math.min(WINDOW_SASH_FACE, opening.width / 3, opening.height / 3) *
          MM;
        const sashDepthM = Math.min(WINDOW_SASH_DEPTH, frameDepth - 24) * MM;
        const sashInsetM =
          Math.min(
            WINDOW_SASH_INSET,
            Math.max(frameDepth - sashDepthM / MM, 18),
          ) * MM;
        const glazingBeadFaceM =
          Math.min(WINDOW_GLAZING_BEAD_FACE, Math.max(sashFaceM / 4 / MM, 8)) *
          MM;
        const glazingBeadDepthM =
          Math.min(WINDOW_GLAZING_BEAD_DEPTH, sashDepthM / 2 / MM) * MM;
        const left = opening.left * MM;
        const bottom = opening.bottom * MM;
        const width = opening.width * MM;
        const height = opening.height * MM;
        const frameFrontZ = layerEdges.framing.outerFaceZ - outsideInsulationM;
        const frameCenterZ = frameFrontZ + frameDepthM / 2;
        const outerBuckCenterZ =
          layerEdges.framing.outerFaceZ - outsideInsulationM / 2;
        const sillFrameWidth = Math.max(width - 2 * frameFaceM, 0.04);
        const sillNotchDepthM = Math.min(
          15 * MM,
          Math.max(10 * MM, WINDOW_SILL_NOTCH_DEPTH * MM),
        );
        const sillNotchHeightM = Math.min(
          15 * MM,
          Math.max(10 * MM, WINDOW_SILL_NOTCH_HEIGHT * MM),
        );
        const sillProfile = createSillProfileGeometry({
          depth: frameDepthM,
          height: frameFaceM,
          notchDepth: sillNotchDepthM,
          notchHeight: sillNotchHeightM,
          slopeDegrees: WINDOW_SILL_TOP_SLOPE_DEGREES,
          width: sillFrameWidth,
        });
        const sashOuterWidth = Math.max(
          width - 2 * frameFaceM + 2 * 8 * MM,
          0.12,
        );
        const sashOuterHeight = Math.max(
          height - 2 * frameFaceM + 2 * 8 * MM,
          0.12,
        );
        const sashCenterZ = frameFrontZ + sashInsetM + sashDepthM / 2;
        const glassWidth = Math.max(sashOuterWidth - 2 * sashFaceM, 0.06);
        const glassHeight = Math.max(sashOuterHeight - 2 * sashFaceM, 0.06);
        const glassCenterZ = sashCenterZ;
        const beadWidth = Math.max(glassWidth - 2 * glazingBeadFaceM, 0.04);
        const beadHeight = Math.max(glassHeight - 2 * glazingBeadFaceM, 0.04);
        const trimWidthM = EXTERIOR_TRIM_WIDTH * MM;
        const trimDepthM = EXTERIOR_TRIM_DEPTH * MM;
        const trimCenterZ = layerEdges.panel.outerFaceZ + trimDepthM / 2;
        const flashingColor = "#8b96a1";
        const sillWidth = (opening.width + 2 * FLASHING_SIDE_OVERHANG) * MM;
        const sillSlotWidth = Math.max(width - 2 * frameFaceM, 0.06);
        const headWidth =
          (opening.width + 2 * (EXTERIOR_TRIM_WIDTH + FLASHING_SIDE_OVERHANG)) *
          MM;
        const headFlashingDepthM = HEAD_FLASHING_PROJECTION * MM;
        const sillSlotDepthM = SILL_FLASHING_SLOT_DEPTH * MM;
        const sillSheetThicknessM = SILL_FLASHING_SHEET_THICKNESS * MM;
        const sillVisibleTopM = SILL_FLASHING_VISIBLE_TOP * MM;
        const sillFrontDropM = SILL_FLASHING_FRONT_DROP * MM;
        const sillSlopeLengthM = SILL_FLASHING_SLOPE_LENGTH * MM;
        const sillDripEdgeM = SILL_FLASHING_DRIP_EDGE * MM;
        const sillSlotHeightM = SILL_FLASHING_SLOT_HEIGHT * MM;
        const sillSlopeAngle = THREE.MathUtils.degToRad(
          SILL_FLASHING_SLOPE_DEGREES,
        );
        const slotFaceZ = frameFrontZ + sillNotchDepthM;
        const slotLevelY = bottom + sillNotchHeightM + sillSlotHeightM / 2;
        const topLegCenterZ =
          slotFaceZ + (sillSlotDepthM - sillVisibleTopM) / 2;
        const topLegOuterZ = slotFaceZ - sillVisibleTopM;
        const slopeStartY = slotLevelY - sillFrontDropM;
        const slopeStartZ = topLegOuterZ - sillSheetThicknessM / 2;
        const slopeEndY =
          slopeStartY - Math.sin(sillSlopeAngle) * sillSlopeLengthM;
        const slopeEndZ =
          slopeStartZ - Math.cos(sillSlopeAngle) * sillSlopeLengthM;
        const sillFlashingLowestY = slopeEndY - sillDripEdgeM;
        const apronTrimBottomY = sillFlashingLowestY + 15 * MM - trimWidthM / 2;

        return {
          key: opening.id,
          glass: {
            pos: [left + width / 2, bottom + height / 2, glassCenterZ] as [
              number,
              number,
              number,
            ],
            size: [glassWidth, glassHeight, WINDOW_GLASS_DEPTH * MM] as [
              number,
              number,
              number,
            ],
          },
          outerFrame: [
            {
              key: "left-jamb",
              pos: [
                left + frameFaceM / 2,
                bottom + height / 2,
                frameCenterZ,
              ] as [number, number, number],
              size: [frameFaceM, height, frameDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "right-jamb",
              pos: [
                left + width - frameFaceM / 2,
                bottom + height / 2,
                frameCenterZ,
              ] as [number, number, number],
              size: [frameFaceM, height, frameDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "head",
              pos: [
                left + width / 2,
                bottom + height - frameFaceM / 2,
                frameCenterZ,
              ] as [number, number, number],
              size: [width - 2 * frameFaceM, frameFaceM, frameDepthM] as [
                number,
                number,
                number,
              ],
            },
          ],
          sillFrame: {
            edges: sillProfile.edges,
            geometry: sillProfile.geometry,
            pos: [left + width / 2, bottom, frameFrontZ] as [
              number,
              number,
              number,
            ],
          },
          outerBuck:
            outsideInsulationM > 0
              ? [
                  {
                    key: "left-buck",
                    pos: [
                      left - outerBuckWidthM / 2,
                      bottom + height / 2,
                      outerBuckCenterZ,
                    ] as [number, number, number],
                    size: [
                      outerBuckWidthM,
                      height + 2 * outerBuckWidthM,
                      outsideInsulationM,
                    ] as [number, number, number],
                  },
                  {
                    key: "right-buck",
                    pos: [
                      left + width + outerBuckWidthM / 2,
                      bottom + height / 2,
                      outerBuckCenterZ,
                    ] as [number, number, number],
                    size: [
                      outerBuckWidthM,
                      height + 2 * outerBuckWidthM,
                      outsideInsulationM,
                    ] as [number, number, number],
                  },
                  {
                    key: "top-buck",
                    pos: [
                      left + width / 2,
                      bottom + height + outerBuckWidthM / 2,
                      outerBuckCenterZ,
                    ] as [number, number, number],
                    size: [width, outerBuckWidthM, outsideInsulationM] as [
                      number,
                      number,
                      number,
                    ],
                  },
                  {
                    key: "bottom-buck",
                    pos: [
                      left + width / 2,
                      bottom - outerBuckWidthM / 2,
                      outerBuckCenterZ,
                    ] as [number, number, number],
                    size: [width, outerBuckWidthM, outsideInsulationM] as [
                      number,
                      number,
                      number,
                    ],
                  },
                ]
              : [],
          sash: [
            {
              key: "left-sash",
              pos: [
                left + frameFaceM + sashFaceM / 2 - 8 * MM,
                bottom + height / 2,
                sashCenterZ,
              ] as [number, number, number],
              size: [sashFaceM, sashOuterHeight, sashDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "right-sash",
              pos: [
                left + width - frameFaceM - sashFaceM / 2 + 8 * MM,
                bottom + height / 2,
                sashCenterZ,
              ] as [number, number, number],
              size: [sashFaceM, sashOuterHeight, sashDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "top-sash",
              pos: [
                left + width / 2,
                bottom + height - frameFaceM - sashFaceM / 2 + 8 * MM,
                sashCenterZ,
              ] as [number, number, number],
              size: [sashOuterWidth - 2 * sashFaceM, sashFaceM, sashDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "bottom-sash",
              pos: [
                left + width / 2,
                bottom + frameFaceM + sashFaceM / 2 - 8 * MM,
                sashCenterZ,
              ] as [number, number, number],
              size: [sashOuterWidth - 2 * sashFaceM, sashFaceM, sashDepthM] as [
                number,
                number,
                number,
              ],
            },
          ],
          glazingBeads: [
            {
              key: "left-bead",
              pos: [
                left + width / 2 - glassWidth / 2 - glazingBeadFaceM / 2,
                bottom + height / 2,
                sashCenterZ + sashDepthM / 2 - glazingBeadDepthM / 2,
              ] as [number, number, number],
              size: [glazingBeadFaceM, beadHeight, glazingBeadDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "right-bead",
              pos: [
                left + width / 2 + glassWidth / 2 + glazingBeadFaceM / 2,
                bottom + height / 2,
                sashCenterZ + sashDepthM / 2 - glazingBeadDepthM / 2,
              ] as [number, number, number],
              size: [glazingBeadFaceM, beadHeight, glazingBeadDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "top-bead",
              pos: [
                left + width / 2,
                bottom + height / 2 + glassHeight / 2 + glazingBeadFaceM / 2,
                sashCenterZ + sashDepthM / 2 - glazingBeadDepthM / 2,
              ] as [number, number, number],
              size: [beadWidth, glazingBeadFaceM, glazingBeadDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "bottom-bead",
              pos: [
                left + width / 2,
                bottom + height / 2 - glassHeight / 2 - glazingBeadFaceM / 2,
                sashCenterZ + sashDepthM / 2 - glazingBeadDepthM / 2,
              ] as [number, number, number],
              size: [beadWidth, glazingBeadFaceM, glazingBeadDepthM] as [
                number,
                number,
                number,
              ],
            },
          ],
          trim: [
            {
              key: "left-trim",
              pos: [
                left - trimWidthM / 2,
                bottom + height / 2,
                trimCenterZ,
              ] as [number, number, number],
              size: [trimWidthM, height + trimWidthM * 2, trimDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "right-trim",
              pos: [
                left + width + trimWidthM / 2,
                bottom + height / 2,
                trimCenterZ,
              ] as [number, number, number],
              size: [trimWidthM, height + trimWidthM * 2, trimDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "head-trim",
              pos: [
                left + width / 2,
                bottom + height + trimWidthM / 2,
                trimCenterZ,
              ] as [number, number, number],
              size: [width + trimWidthM * 2, trimWidthM, trimDepthM] as [
                number,
                number,
                number,
              ],
            },
            {
              key: "apron-trim",
              pos: [left + width / 2, apronTrimBottomY, trimCenterZ] as [
                number,
                number,
                number,
              ],
              size: [width + trimWidthM * 2, trimWidthM, trimDepthM] as [
                number,
                number,
                number,
              ],
            },
          ],
          headFlashing: {
            pos: [
              left + width / 2,
              bottom + height + trimWidthM + (HEAD_FLASHING_HEIGHT * MM) / 2,
              layerEdges.panel.outerFaceZ - headFlashingDepthM / 2 + 5 * MM,
            ] as [number, number, number],
            size: [
              headWidth,
              HEAD_FLASHING_HEIGHT * MM,
              headFlashingDepthM,
            ] as [number, number, number],
            color: flashingColor,
          },
          sillSlot: {
            pos: [
              left + width / 2,
              slotLevelY,
              slotFaceZ + sillSlotDepthM / 2,
            ] as [number, number, number],
            size: [sillSlotWidth, sillSlotHeightM, sillSlotDepthM] as [
              number,
              number,
              number,
            ],
          },
          sillFlashingSegments: [
            {
              key: "top-leg",
              pos: [left + width / 2, slotLevelY, topLegCenterZ] as [
                number,
                number,
                number,
              ],
              size: [
                sillWidth,
                sillSheetThicknessM,
                sillSlotDepthM + sillVisibleTopM,
              ] as [number, number, number],
              rotation: [0, 0, 0] as [number, number, number],
            },
            {
              key: "front-drop",
              pos: [
                left + width / 2,
                slotLevelY - sillFrontDropM / 2,
                topLegOuterZ - sillSheetThicknessM / 2,
              ] as [number, number, number],
              size: [sillWidth, sillFrontDropM, sillSheetThicknessM] as [
                number,
                number,
                number,
              ],
              rotation: [0, 0, 0] as [number, number, number],
            },
            {
              key: "slope-run",
              pos: [
                left + width / 2,
                slopeStartY - (Math.sin(sillSlopeAngle) * sillSlopeLengthM) / 2,
                slopeStartZ - (Math.cos(sillSlopeAngle) * sillSlopeLengthM) / 2,
              ] as [number, number, number],
              size: [sillWidth, sillSheetThicknessM, sillSlopeLengthM] as [
                number,
                number,
                number,
              ],
              rotation: [-sillSlopeAngle, 0, 0] as [number, number, number],
            },
            {
              key: "drip-edge",
              pos: [
                left + width / 2,
                slopeEndY - sillDripEdgeM / 2,
                slopeEndZ - sillSheetThicknessM / 2,
              ] as [number, number, number],
              size: [sillWidth, sillDripEdgeM, sillSheetThicknessM] as [
                number,
                number,
                number,
              ],
              rotation: [0, 0, 0] as [number, number, number],
            },
          ],
          sillFlashing: {
            color: flashingColor,
          },
        };
      });
  }, [layerEdges, openings, wall.studLayout.studs, wall.thickness]);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  if (assemblies.length === 0) return null;

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {assemblies.map((assembly) => (
        <group key={assembly.key}>
          {assembly.outerFrame.map((part) => (
            <group key={part.key} position={part.pos}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial
                  color="#f3f1eb"
                  roughness={0.72}
                  metalness={0.02}
                />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...part.size)]} />
                <lineBasicMaterial color="#d4cec4" linewidth={1} />
              </lineSegments>
            </group>
          ))}

          <group position={assembly.sillFrame.pos}>
            <mesh castShadow receiveShadow>
              <primitive
                attach="geometry"
                object={assembly.sillFrame.geometry}
              />
              <meshStandardMaterial
                color="#f3f1eb"
                roughness={0.72}
                metalness={0.02}
              />
            </mesh>
            <lineSegments>
              <primitive attach="geometry" object={assembly.sillFrame.edges} />
              <lineBasicMaterial color="#d4cec4" linewidth={1} />
            </lineSegments>
          </group>

          {assembly.outerBuck.map((part) => (
            <group key={part.key} position={part.pos}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial
                  map={showPrimedWhite ? null : pineTexture}
                  color={showPrimedWhite ? PRIMED_PANEL_BASE_COLOR : "#d7c29a"}
                  roughness={showPrimedWhite ? 0.88 : 0.82}
                  metalness={0}
                />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...part.size)]} />
                <lineBasicMaterial color="#8f744c" linewidth={1} />
              </lineSegments>
            </group>
          ))}

          {assembly.sash.map((part) => (
            <group key={part.key} position={part.pos}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial
                  color="#f7f5ef"
                  roughness={0.68}
                  metalness={0.02}
                />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...part.size)]} />
                <lineBasicMaterial color="#d9d2c6" linewidth={1} />
              </lineSegments>
            </group>
          ))}

          <group position={assembly.glass.pos}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={assembly.glass.size} />
              <meshPhysicalMaterial
                color="#b9d6e6"
                roughness={0.08}
                metalness={0}
                transmission={0.72}
                transparent
                opacity={0.55}
                ior={1.45}
              />
            </mesh>
          </group>

          {assembly.glazingBeads.map((part) => (
            <group key={part.key} position={part.pos}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial
                  color="#fbfaf6"
                  roughness={0.62}
                  metalness={0.02}
                />
              </mesh>
            </group>
          ))}

          {assembly.trim.map((part) => (
            <group key={part.key} position={part.pos}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial
                  map={showPrimedWhite ? null : pineTexture}
                  color={showPrimedWhite ? PRIMED_PANEL_BASE_COLOR : "#d7c29a"}
                  roughness={showPrimedWhite ? 0.9 : 0.82}
                  metalness={0}
                />
              </mesh>
              <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...part.size)]} />
                <lineBasicMaterial color="#8f744c" linewidth={1} />
              </lineSegments>
            </group>
          ))}

          <group position={assembly.headFlashing.pos}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={assembly.headFlashing.size} />
              <meshStandardMaterial
                color={assembly.headFlashing.color}
                roughness={0.38}
                metalness={0.9}
              />
            </mesh>
          </group>

          <group position={assembly.sillSlot.pos}>
            <mesh castShadow receiveShadow>
              <boxGeometry args={assembly.sillSlot.size} />
              <meshStandardMaterial
                color="#2f3338"
                roughness={0.95}
                metalness={0.05}
              />
            </mesh>
          </group>

          {assembly.sillFlashingSegments.map((part) => (
            <group key={part.key} position={part.pos} rotation={part.rotation}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial
                  color={assembly.sillFlashing.color}
                  roughness={0.34}
                  metalness={0.92}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
