"use client";

import React, { useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { Wall } from "../../lib/configurator";
import {
  MM,
  type LayoutLike,
  type WallLayerEdges,
} from "../../lib/configuratorScene/constants";
import { createTextTexture } from "../../lib/configuratorScene/helpers";

const LAYER_CORNER_COLORS: Record<string, string> = {
  framing: "#ef4444",
  outsideDrywall: "#f97316",
  outsideInsulation: "#eab308",
  weatherSurface: "#22c55e",
  spiklakt: "#3b82f6",
  panel: "#a855f7",
};

const LAYER_CORNER_LABELS: Record<string, string> = {
  framing: "Framing",
  outsideDrywall: "Exterior sheathing",
  outsideInsulation: "Insulation",
  weatherSurface: "Weather surface",
  spiklakt: "Battens",
  panel: "Cladding",
};

export function FloorSlab({
  corners,
}: {
  corners: { x: number; y: number }[];
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(corners[0].x * MM, corners[0].y * MM);
    for (let i = 1; i < corners.length; i += 1) {
      shape.lineTo(corners[i].x * MM, corners[i].y * MM);
    }
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -0.15, 0);
    return geo;
  }, [corners]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#808080" roughness={0.9} />
    </mesh>
  );
}

export function LayerCornerLabels({
  layout,
  wallHeight,
  layerEdgesMap,
  visibleLayers,
}: {
  layout: LayoutLike;
  wallHeight: number;
  layerEdgesMap: Record<string, WallLayerEdges>;
  visibleLayers: Record<string, boolean>;
}) {
  const markers = useMemo(() => {
    const result: {
      key: string;
      labelPos: [number, number, number];
      targetPos: [number, number, number];
      color: string;
      label: string;
    }[] = [];

    const wallTopY = wallHeight * MM;
    const layerKeys = Object.keys(
      LAYER_CORNER_COLORS,
    ) as (keyof WallLayerEdges)[];

    for (const wall of layout.walls) {
      const edges = layerEdgesMap[wall.id];
      if (!edges) continue;

      const dir = wall.direction;
      const outwardNormal = {
        x: -wall.inwardNormal.x,
        y: -wall.inwardNormal.y,
      };
      const wallHalf = wall.thickness / 2;
      const activeKeys = layerKeys.filter((key) => visibleLayers[key]);

      for (
        let layerIndex = 0;
        layerIndex < activeKeys.length;
        layerIndex += 1
      ) {
        const layerName = activeKeys[layerIndex];
        const edge = edges[layerName];
        const color = LAYER_CORNER_COLORS[layerName];
        const label = LAYER_CORNER_LABELS[layerName];
        const labelY = wallTopY + 0.08 + layerIndex * 0.06;
        const perpendicularOffset = (zFace: number) => -wallHalf - zFace / MM;
        const corners = [
          { suffix: "S↗", alongMm: edge.coverageStart, zFace: edge.outerFaceZ },
          { suffix: "S↙", alongMm: edge.coverageStart, zFace: edge.innerFaceZ },
          { suffix: "E↗", alongMm: edge.coverageEnd, zFace: edge.outerFaceZ },
          { suffix: "E↙", alongMm: edge.coverageEnd, zFace: edge.innerFaceZ },
        ];

        for (const corner of corners) {
          const wx =
            wall.start.x +
            dir.x * corner.alongMm +
            outwardNormal.x * perpendicularOffset(corner.zFace);
          const wy =
            wall.start.y +
            dir.y * corner.alongMm +
            outwardNormal.y * perpendicularOffset(corner.zFace);

          result.push({
            key: `${wall.id}-${layerName}-${corner.suffix}`,
            labelPos: [wx * MM, labelY, -wy * MM],
            targetPos: [wx * MM, wallTopY, -wy * MM],
            color,
            label: `${label} ${corner.suffix}`,
          });
        }
      }
    }

    return result;
  }, [layout.walls, wallHeight, layerEdgesMap, visibleLayers]);

  return (
    <group>
      {markers.map((marker) => (
        <group key={marker.key}>
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                args={[
                  new Float32Array([...marker.targetPos, ...marker.labelPos]),
                  3,
                ]}
                count={2}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={marker.color} linewidth={1} />
          </line>
          <Text
            position={marker.labelPos}
            fontSize={0.03}
            color={marker.color}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.002}
            outlineColor="#000000"
          >
            {marker.label}
          </Text>
        </group>
      ))}
    </group>
  );
}

export function CornerMarkers({
  layout,
  showInner,
}: {
  layout: LayoutLike;
  showInner: boolean;
}) {
  return (
    <group>
      {layout.outerCorners.map((corner, index) => (
        <mesh key={`oc-${index}`} position={[corner.x * MM, 0, -corner.y * MM]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      ))}
      {showInner &&
        layout.innerCorners.map((corner, index) => (
          <mesh
            key={`ic-${index}`}
            position={[corner.x * MM, 0, -corner.y * MM]}
          >
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#3b82f6" />
          </mesh>
        ))}
    </group>
  );
}

export function WallLabels({
  layout,
  wallHeight,
}: {
  layout: LayoutLike;
  wallHeight: number;
}) {
  return (
    <group>
      {layout.walls.map((wall) => {
        const midX = ((wall.quad.outerStart.x + wall.quad.outerEnd.x) / 2) * MM;
        const midZ =
          -((wall.quad.outerStart.y + wall.quad.outerEnd.y) / 2) * MM;
        const y = wallHeight * MM + 0.3;
        const offX = -wall.inwardNormal.x * 0.3;
        const offZ = wall.inwardNormal.y * 0.3;

        return (
          <group key={wall.id} position={[midX + offX, y, midZ + offZ]}>
            <sprite scale={[1.2, 0.3, 1]}>
              <spriteMaterial
                map={createTextTexture(
                  `${wall.id} [${wall.startCorner.joint[0].toUpperCase()}/${wall.endCorner.joint[0].toUpperCase()}] ${(wall.effectiveLength / 1000).toFixed(2)}m`,
                )}
                transparent
              />
            </sprite>
          </group>
        );
      })}
    </group>
  );
}

function WallStudDimensions({ wall }: { wall: Wall }) {
  const groupRef = useRef<THREE.Group>(null);
  const outwardNormal = useMemo(
    () => new THREE.Vector3(-wall.inwardNormal.x, 0, wall.inwardNormal.y),
    [wall],
  );
  const wallCenter = useMemo(() => {
    const quad = wall.quad;
    return new THREE.Vector3(
      ((quad.outerStart.x + quad.outerEnd.x) / 2) * MM,
      0,
      -((quad.outerStart.y + quad.outerEnd.y) / 2) * MM,
    );
  }, [wall]);
  const labelQuat = useMemo(() => {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const textUp = outwardNormal.clone().normalize();
    const textRight = new THREE.Vector3()
      .crossVectors(textUp, worldUp)
      .normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(textRight, textUp, worldUp),
    );
  }, [outwardNormal]);

  const dims = useMemo(() => {
    const result: {
      startPos: THREE.Vector3;
      endPos: THREE.Vector3;
      midPos: THREE.Vector3;
      label: string;
    }[] = [];

    if (wall.studLayout.studs.length < 2) return result;
    const wdx = (wall.end.x - wall.start.x) * MM;
    const wdz = -(wall.end.y - wall.start.y) * MM;
    const wallLength = Math.sqrt(wdx * wdx + wdz * wdz);
    if (wallLength < 0.001) return result;
    const ux = wdx / wallLength;
    const uz = wdz / wallLength;
    const offset = 0.25;
    const ox = wall.start.x * MM + outwardNormal.x * offset;
    const oz = -(wall.start.y * MM) + outwardNormal.z * offset;
    const retract = wall.startCorner.retraction;

    for (let index = 0; index < wall.studLayout.studs.length - 1; index += 1) {
      const start = retract + wall.studLayout.studs[index].centerPosition;
      const end = retract + wall.studLayout.studs[index + 1].centerPosition;
      const startM = start * MM;
      const endM = end * MM;
      const sx = ox + ux * startM;
      const sz = oz + uz * startM;
      const ex = ox + ux * endM;
      const ez = oz + uz * endM;

      result.push({
        startPos: new THREE.Vector3(sx, 0.05, sz),
        endPos: new THREE.Vector3(ex, 0.05, ez),
        midPos: new THREE.Vector3((sx + ex) / 2, 0.05, (sz + ez) / 2),
        label: `${Math.round(end - start)}`,
      });
    }

    return result;
  }, [wall, outwardNormal]);

  const dashMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#000000" }),
    [],
  );

  useFrame(({ camera }) => {
    if (!groupRef.current) return;
    const toCamera = new THREE.Vector3().subVectors(
      camera.position,
      wallCenter,
    );
    toCamera.y = 0;
    groupRef.current.visible = toCamera.dot(outwardNormal) > 0;
  });

  return (
    <group ref={groupRef}>
      {dims.map((dim, index) => {
        const dimDir = dim.endPos.clone().sub(dim.startPos);
        const dimLen = dimDir.length();
        if (dimLen < 0.001) return null;

        dimDir.normalize();
        const gapHalf = Math.min(0.12, dimLen * 0.3);
        const gapStart = dim.midPos.clone().addScaledVector(dimDir, -gapHalf);
        const gapEnd = dim.midPos.clone().addScaledVector(dimDir, gapHalf);
        const dashGeo = new THREE.BufferGeometry().setFromPoints([
          dim.startPos,
          gapStart,
          gapEnd,
          dim.endPos,
        ]);
        const t1Start = dim.startPos
          .clone()
          .addScaledVector(outwardNormal, -0.08);
        const t1End = dim.startPos.clone().addScaledVector(outwardNormal, 0.08);
        const t2Start = dim.endPos
          .clone()
          .addScaledVector(outwardNormal, -0.08);
        const t2End = dim.endPos.clone().addScaledVector(outwardNormal, 0.08);
        const tick1 = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([t1Start, t1End]),
          new THREE.LineBasicMaterial({ color: "#000000" }),
        );
        const tick2 = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([t2Start, t2End]),
          new THREE.LineBasicMaterial({ color: "#000000" }),
        );

        return (
          <group key={index}>
            <lineSegments geometry={dashGeo} material={dashMat} />
            <primitive object={tick1} />
            <primitive object={tick2} />
            <group
              position={[
                dim.midPos.x + outwardNormal.x * 0.02,
                dim.midPos.y + 0.01,
                dim.midPos.z + outwardNormal.z * 0.02,
              ]}
              quaternion={labelQuat}
            >
              <Text
                position={[0, 0, 0.001]}
                fontSize={0.085}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                renderOrder={2}
                material-toneMapped={false}
                material-depthTest={false}
                material-depthWrite={false}
                rotation={[0, 0, Math.PI]}
              >
                {dim.label}
              </Text>
            </group>
          </group>
        );
      })}
    </group>
  );
}

export function StudDimensions({ layout }: { layout: LayoutLike }) {
  return (
    <group>
      {layout.walls.map((wall) => (
        <WallStudDimensions key={wall.id} wall={wall} />
      ))}
    </group>
  );
}
