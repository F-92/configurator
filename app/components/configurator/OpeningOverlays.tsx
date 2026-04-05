"use client";

import React, { useCallback, useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { Wall, WallOpening } from "../../lib/configurator";
import { MM } from "../../lib/configuratorScene/constants";

function getWallGroupTransform(wall: Wall) {
  const q = wall.quad;
  const px = ((q.outerStart.x + q.innerStart.x) / 2) * MM;
  const pz = -((q.outerStart.y + q.innerStart.y) / 2) * MM;
  return {
    position: [px, 0, pz] as [number, number, number],
    rotationY: wall.angle,
  };
}

export function WallOpeningVisual({
  wall,
  wallHeight,
  opening,
  isSelected,
}: {
  wall: Wall;
  wallHeight: number;
  opening: WallOpening;
  isSelected: boolean;
}) {
  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  const outlineColor = isSelected ? "#22d3ee" : "#f59e0b";
  const oX = opening.left * MM;
  const oY = opening.bottom * MM;
  const oW = opening.width * MM;
  const oH = opening.height * MM;
  const zOffset = -(wall.thickness * MM) / 2 - 0.015;

  const leftDist = opening.left;
  const rightDist = wall.effectiveLength - opening.left - opening.width;
  const bottomDist = opening.bottom;
  const topDist = wallHeight - opening.bottom - opening.height;

  const outlineGeo = useMemo(() => {
    const points = [
      new THREE.Vector3(oX, oY, zOffset),
      new THREE.Vector3(oX + oW, oY, zOffset),
      new THREE.Vector3(oX + oW, oY + oH, zOffset),
      new THREE.Vector3(oX, oY + oH, zOffset),
      new THREE.Vector3(oX, oY, zOffset),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [oX, oY, oW, oH, zOffset]);

  const labelZ = zOffset - 0.01;
  const labelFontSize = 0.055;

  const outlineLine = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({
      color: outlineColor,
      linewidth: 2,
    });
    return new THREE.Line(outlineGeo, mat);
  }, [outlineGeo, outlineColor]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <primitive object={outlineLine} />

      <mesh position={[oX + oW / 2, oY + oH / 2, zOffset + 0.001]}>
        <planeGeometry args={[oW, oH]} />
        <meshBasicMaterial
          color={isSelected ? "#22d3ee" : "#f59e0b"}
          transparent
          opacity={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>

      <Text
        position={[oX + oW / 2, oY + oH / 2, labelZ]}
        fontSize={0.06}
        color={outlineColor}
        anchorX="center"
        anchorY="middle"
        depthOffset={-1}
        rotation={[0, Math.PI, 0]}
      >
        {`${Math.round(opening.width / 100)}×${Math.round(opening.height / 100)} dm`}
      </Text>

      {leftDist > 10 && (
        <Text
          position={[oX / 2, oY + oH / 2, labelZ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`← ${Math.round(leftDist)}`}
        </Text>
      )}

      {rightDist > 10 && (
        <Text
          position={[
            ((opening.left + opening.width + wall.effectiveLength) / 2) * MM,
            oY + oH / 2,
            labelZ,
          ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`${Math.round(rightDist)} →`}
        </Text>
      )}

      {bottomDist > 10 && (
        <Text
          position={[oX + oW / 2, (opening.bottom / 2) * MM, labelZ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`↓ ${Math.round(bottomDist)}`}
        </Text>
      )}

      {topDist > 10 && (
        <Text
          position={[
            oX + oW / 2,
            ((opening.bottom + opening.height + wallHeight) / 2) * MM,
            labelZ,
          ]}
          fontSize={labelFontSize}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          depthOffset={-1}
          rotation={[0, Math.PI, 0]}
        >
          {`${Math.round(topDist)} ↑`}
        </Text>
      )}
    </group>
  );
}

export function WallOpeningDragLayer({
  wall,
  wallHeight,
  openings,
  onOpeningDrag,
  onOpeningAdd,
  onOpeningSelect,
  controlsRef,
}: {
  wall: Wall;
  wallHeight: number;
  openings: WallOpening[];
  onOpeningDrag: (openingId: string, left: number, bottom: number) => void;
  onOpeningAdd: (wallId: string, x: number, y: number) => void;
  onOpeningSelect: (openingId: string | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const { position, rotationY } = useMemo(
    () => getWallGroupTransform(wall),
    [wall],
  );

  const handlePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      if (!groupRef.current) return;
      const local = groupRef.current.worldToLocal(e.point.clone());
      const wallX = local.x / MM;
      const wallY = local.y / MM;

      for (const opening of openings) {
        if (
          wallX >= opening.left &&
          wallX <= opening.left + opening.width &&
          wallY >= opening.bottom &&
          wallY <= opening.bottom + opening.height
        ) {
          dragRef.current = {
            id: opening.id,
            offsetX: wallX - opening.left,
            offsetY: wallY - opening.bottom,
          };
          onOpeningSelect(opening.id);
          if (controlsRef.current) controlsRef.current.enabled = false;
          (e.nativeEvent.target as Element | null)?.setPointerCapture?.(
            e.pointerId,
          );
          return;
        }
      }
      onOpeningAdd(wall.id, wallX, wallY);
    },
    [openings, onOpeningSelect, onOpeningAdd, wall.id, controlsRef],
  );

  const handlePointerMove = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!dragRef.current || !groupRef.current) return;
      e.stopPropagation();
      const local = groupRef.current.worldToLocal(e.point.clone());
      const wallX = local.x / MM;
      const wallY = local.y / MM;
      const opening = openings.find(
        (candidate) => candidate.id === dragRef.current!.id,
      );
      if (!opening) return;

      const newLeft = Math.max(
        0,
        Math.min(
          wallX - dragRef.current.offsetX,
          wall.effectiveLength - opening.width,
        ),
      );
      const newBottom = Math.max(
        0,
        Math.min(wallY - dragRef.current.offsetY, wallHeight - opening.height),
      );
      onOpeningDrag(dragRef.current.id, newLeft, newBottom);
    },
    [openings, wall.effectiveLength, wallHeight, onOpeningDrag],
  );

  const handlePointerUp = useCallback(() => {
    dragRef.current = null;
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, [controlsRef]);

  const zPos = -(wall.thickness * MM) / 2 - 0.012;

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      <mesh
        position={[
          (wall.effectiveLength * MM) / 2,
          (wallHeight * MM) / 2,
          zPos,
        ]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <planeGeometry args={[wall.effectiveLength * MM, wallHeight * MM]} />
        <meshBasicMaterial transparent opacity={0} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}
