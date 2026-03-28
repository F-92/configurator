"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { HouseConfig, RoofType } from "../lib/types";

interface RoofProps {
  config: HouseConfig;
}

function createGableRoof(
  width: number,
  depth: number,
  wallHeight: number,
  pitch: number,
  overhang: number,
) {
  const pitchRad = (pitch * Math.PI) / 180;
  const ridgeHeight = (width / 2) * Math.tan(pitchRad);

  const hw = width / 2 + overhang;
  const hd = depth / 2 + overhang;

  // Left slope
  const leftGeo = new THREE.BufferGeometry();
  const slopeLength = hw / Math.cos(pitchRad);
  const leftVertices = new Float32Array([
    -hw,
    wallHeight,
    -hd,
    0,
    wallHeight + ridgeHeight,
    -hd,
    0,
    wallHeight + ridgeHeight,
    hd,
    -hw,
    wallHeight,
    hd,
  ]);
  const leftIndices = [0, 1, 2, 0, 2, 3];
  leftGeo.setAttribute("position", new THREE.BufferAttribute(leftVertices, 3));
  leftGeo.setIndex(leftIndices);
  leftGeo.computeVertexNormals();

  // Right slope
  const rightGeo = new THREE.BufferGeometry();
  const rightVertices = new Float32Array([
    hw,
    wallHeight,
    -hd,
    0,
    wallHeight + ridgeHeight,
    -hd,
    0,
    wallHeight + ridgeHeight,
    hd,
    hw,
    wallHeight,
    hd,
  ]);
  const rightIndices = [0, 2, 1, 0, 3, 2];
  rightGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(rightVertices, 3),
  );
  rightGeo.setIndex(rightIndices);
  rightGeo.computeVertexNormals();

  // Gable end triangles (front and back)
  const frontGeo = new THREE.BufferGeometry();
  const frontVertices = new Float32Array([
    -width / 2,
    wallHeight,
    depth / 2,
    width / 2,
    wallHeight,
    depth / 2,
    0,
    wallHeight + ridgeHeight,
    depth / 2,
  ]);
  frontGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(frontVertices, 3),
  );
  frontGeo.setIndex([0, 1, 2]);
  frontGeo.computeVertexNormals();

  const backGeo = new THREE.BufferGeometry();
  const backVertices = new Float32Array([
    -width / 2,
    wallHeight,
    -depth / 2,
    width / 2,
    wallHeight,
    -depth / 2,
    0,
    wallHeight + ridgeHeight,
    -depth / 2,
  ]);
  backGeo.setAttribute("position", new THREE.BufferAttribute(backVertices, 3));
  backGeo.setIndex([0, 2, 1]);
  backGeo.computeVertexNormals();

  return {
    slopes: [leftGeo, rightGeo],
    gables: [frontGeo, backGeo],
    ridgeHeight,
  };
}

function createHipRoof(
  width: number,
  depth: number,
  wallHeight: number,
  pitch: number,
  overhang: number,
) {
  const pitchRad = (pitch * Math.PI) / 180;
  const ridgeHeight = (width / 2) * Math.tan(pitchRad);
  const hw = width / 2 + overhang;
  const hd = depth / 2 + overhang;
  const ridgeHalfLen = Math.max(0, hd - hw);

  const geometries: THREE.BufferGeometry[] = [];

  // Front face (triangle or trapezoid)
  const front = new THREE.BufferGeometry();
  const fv = new Float32Array([
    -hw,
    wallHeight,
    hd,
    hw,
    wallHeight,
    hd,
    ridgeHalfLen > 0 ? hw - overhang : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? ridgeHalfLen : 0,
    ridgeHalfLen > 0 ? -(hw - overhang) : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? ridgeHalfLen : 0,
  ]);
  front.setAttribute("position", new THREE.BufferAttribute(fv, 3));
  front.setIndex(ridgeHalfLen > 0 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
  front.computeVertexNormals();
  geometries.push(front);

  // Back face
  const back = new THREE.BufferGeometry();
  const bv = new Float32Array([
    hw,
    wallHeight,
    -hd,
    -hw,
    wallHeight,
    -hd,
    ridgeHalfLen > 0 ? -(hw - overhang) : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? -ridgeHalfLen : 0,
    ridgeHalfLen > 0 ? hw - overhang : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? -ridgeHalfLen : 0,
  ]);
  back.setAttribute("position", new THREE.BufferAttribute(bv, 3));
  back.setIndex(ridgeHalfLen > 0 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]);
  back.computeVertexNormals();
  geometries.push(back);

  // Left slope
  const left = new THREE.BufferGeometry();
  const lv = new Float32Array([
    -hw,
    wallHeight,
    -hd,
    -hw,
    wallHeight,
    hd,
    ridgeHalfLen > 0 ? -(hw - overhang) : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? ridgeHalfLen : 0,
    ridgeHalfLen > 0 ? -(hw - overhang) : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? -ridgeHalfLen : 0,
  ]);
  left.setAttribute("position", new THREE.BufferAttribute(lv, 3));
  left.setIndex([0, 1, 2, 0, 2, 3]);
  left.computeVertexNormals();
  geometries.push(left);

  // Right slope
  const right = new THREE.BufferGeometry();
  const rv = new Float32Array([
    hw,
    wallHeight,
    hd,
    hw,
    wallHeight,
    -hd,
    ridgeHalfLen > 0 ? hw - overhang : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? -ridgeHalfLen : 0,
    ridgeHalfLen > 0 ? hw - overhang : 0,
    wallHeight + ridgeHeight,
    ridgeHalfLen > 0 ? ridgeHalfLen : 0,
  ]);
  right.setAttribute("position", new THREE.BufferAttribute(rv, 3));
  right.setIndex([0, 1, 2, 0, 2, 3]);
  right.computeVertexNormals();
  geometries.push(right);

  return { geometries, ridgeHeight };
}

function createShedRoof(
  width: number,
  depth: number,
  wallHeight: number,
  pitch: number,
  overhang: number,
) {
  const pitchRad = (pitch * Math.PI) / 180;
  const rise = width * Math.tan(pitchRad);
  const hw = width / 2 + overhang;
  const hd = depth / 2 + overhang;

  const geo = new THREE.BufferGeometry();
  const verts = new Float32Array([
    -hw,
    wallHeight + rise,
    -hd,
    hw,
    wallHeight,
    -hd,
    hw,
    wallHeight,
    hd,
    -hw,
    wallHeight + rise,
    hd,
  ]);
  geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  geo.setIndex([0, 2, 1, 0, 3, 2]);
  geo.computeVertexNormals();

  // Side triangles
  const leftGeo = new THREE.BufferGeometry();
  const lv = new Float32Array([
    -width / 2,
    wallHeight,
    -depth / 2,
    -width / 2,
    wallHeight + rise,
    -depth / 2,
    -width / 2,
    wallHeight,
    depth / 2,
    -width / 2,
    wallHeight + rise,
    depth / 2,
  ]);
  leftGeo.setAttribute("position", new THREE.BufferAttribute(lv, 3));
  leftGeo.setIndex([0, 1, 3, 0, 3, 2]);
  leftGeo.computeVertexNormals();

  return { main: geo, side: leftGeo, rise };
}

export function Roof({ config }: RoofProps) {
  const {
    width,
    depth,
    wallHeight,
    roofType,
    roofPitch,
    roofOverhang,
    roofColor,
  } = config;

  const roofGeometries = useMemo(() => {
    switch (roofType) {
      case "gable":
        return {
          type: "gable" as const,
          ...createGableRoof(width, depth, wallHeight, roofPitch, roofOverhang),
        };
      case "hip":
        return {
          type: "hip" as const,
          ...createHipRoof(width, depth, wallHeight, roofPitch, roofOverhang),
        };
      case "shed":
        return {
          type: "shed" as const,
          ...createShedRoof(width, depth, wallHeight, roofPitch, roofOverhang),
        };
      case "flat":
      default:
        return { type: "flat" as const };
    }
  }, [width, depth, wallHeight, roofType, roofPitch, roofOverhang]);

  const material = (
    <meshStandardMaterial color={roofColor} side={THREE.DoubleSide} />
  );

  if (roofGeometries.type === "flat") {
    return (
      <mesh
        position={[0, wallHeight + 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry
          args={[width + roofOverhang * 2, depth + roofOverhang * 2]}
        />
        {material}
      </mesh>
    );
  }

  if (roofGeometries.type === "gable") {
    return (
      <group>
        {roofGeometries.slopes.map((geo, i) => (
          <mesh key={`slope-${i}`} geometry={geo}>
            {material}
          </mesh>
        ))}
        {roofGeometries.gables.map((geo, i) => (
          <mesh key={`gable-${i}`} geometry={geo}>
            <meshStandardMaterial
              color={config.wallColor}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (roofGeometries.type === "hip") {
    return (
      <group>
        {roofGeometries.geometries.map((geo, i) => (
          <mesh key={`hip-${i}`} geometry={geo}>
            {material}
          </mesh>
        ))}
      </group>
    );
  }

  if (roofGeometries.type === "shed") {
    return (
      <group>
        <mesh geometry={roofGeometries.main}>{material}</mesh>
        <mesh geometry={roofGeometries.side}>
          <meshStandardMaterial
            color={config.wallColor}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    );
  }

  return null;
}
