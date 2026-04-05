"use client";

import { HouseConfig } from "../lib/types";

interface WindowMeshesProps {
  config: HouseConfig;
}

function getWallTransform(
  wall: "front" | "back" | "left" | "right",
  width: number,
  depth: number,
): {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
} {
  switch (wall) {
    case "front":
      return {
        position: [0, 0, depth / 2],
        rotation: [0, 0, 0],
        length: width,
      };
    case "back":
      return {
        position: [0, 0, -depth / 2],
        rotation: [0, Math.PI, 0],
        length: width,
      };
    case "left":
      return {
        position: [-width / 2, 0, 0],
        rotation: [0, Math.PI / 2, 0],
        length: depth,
      };
    case "right":
      return {
        position: [width / 2, 0, 0],
        rotation: [0, -Math.PI / 2, 0],
        length: depth,
      };
  }
}

export function WindowMeshes({ config }: WindowMeshesProps) {
  const { width, depth, wallHeight, windows, trimColor } = config;

  return (
    <group>
      {windows.map((win) => {
        const {
          position: wallPos,
          rotation,
          length,
        } = getWallTransform(win.wall, width, depth);
        const x = (win.positionX - 0.5) * length;
        const y = win.positionY + win.height / 2;

        return (
          <group key={win.id} position={wallPos} rotation={rotation}>
            {/* Glass */}
            <mesh position={[x, y, 0.01]}>
              <planeGeometry args={[win.width - 0.06, win.height - 0.06]} />
              <meshPhysicalMaterial
                color="#87CEEB"
                transparent
                opacity={0.4}
                roughness={0.05}
                metalness={0.1}
                transmission={0.6}
              />
            </mesh>
            {/* Frame */}
            {/* Top */}
            <mesh position={[x, y + win.height / 2 - 0.015, 0.02]}>
              <boxGeometry args={[win.width, 0.03, 0.04]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            {/* Bottom */}
            <mesh position={[x, y - win.height / 2 + 0.015, 0.02]}>
              <boxGeometry args={[win.width, 0.03, 0.04]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            {/* Left */}
            <mesh position={[x - win.width / 2 + 0.015, y, 0.02]}>
              <boxGeometry args={[0.03, win.height, 0.04]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            {/* Right */}
            <mesh position={[x + win.width / 2 - 0.015, y, 0.02]}>
              <boxGeometry args={[0.03, win.height, 0.04]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            {/* Cross bars */}
            {win.style === "standard" && (
              <>
                <mesh position={[x, y, 0.025]}>
                  <boxGeometry args={[win.width - 0.06, 0.02, 0.02]} />
                  <meshStandardMaterial color={trimColor} />
                </mesh>
                <mesh position={[x, y, 0.025]}>
                  <boxGeometry args={[0.02, win.height - 0.06, 0.02]} />
                  <meshStandardMaterial color={trimColor} />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

interface DoorMeshesProps {
  config: HouseConfig;
}

export function DoorMeshes({ config }: DoorMeshesProps) {
  const { width, depth, doors, trimColor } = config;

  return (
    <group>
      {doors.map((door) => {
        const {
          position: wallPos,
          rotation,
          length,
        } = getWallTransform(door.wall, width, depth);
        const x = (door.positionX - 0.5) * length;
        const y = door.height / 2;

        return (
          <group key={door.id} position={wallPos} rotation={rotation}>
            {/* Door panel */}
            <mesh position={[x, y, 0.01]}>
              <planeGeometry args={[door.width - 0.06, door.height - 0.02]} />
              <meshStandardMaterial color="#5c3a1e" />
            </mesh>
            {/* Frame */}
            <mesh position={[x, y + door.height / 2, 0.02]}>
              <boxGeometry args={[door.width + 0.06, 0.04, 0.06]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            <mesh position={[x - door.width / 2 - 0.015, y, 0.02]}>
              <boxGeometry args={[0.04, door.height, 0.06]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            <mesh position={[x + door.width / 2 + 0.015, y, 0.02]}>
              <boxGeometry args={[0.04, door.height, 0.06]} />
              <meshStandardMaterial color={trimColor} />
            </mesh>
            {/* Handle */}
            <mesh position={[x + door.width / 2 - 0.15, y, 0.04]}>
              <sphereGeometry args={[0.03, 8, 8]} />
              <meshStandardMaterial
                color="#b8860b"
                metalness={0.8}
                roughness={0.2}
              />
            </mesh>
            {/* Glass for french doors */}
            {door.style === "french" && (
              <>
                <mesh
                  position={[x - door.width / 4, y + door.height / 6, 0.02]}
                >
                  <planeGeometry
                    args={[door.width / 2 - 0.12, door.height / 2 - 0.1]}
                  />
                  <meshPhysicalMaterial
                    color="#87CEEB"
                    transparent
                    opacity={0.4}
                    transmission={0.6}
                  />
                </mesh>
                <mesh
                  position={[x + door.width / 4, y + door.height / 6, 0.02]}
                >
                  <planeGeometry
                    args={[door.width / 2 - 0.12, door.height / 2 - 0.1]}
                  />
                  <meshPhysicalMaterial
                    color="#87CEEB"
                    transparent
                    opacity={0.4}
                    transmission={0.6}
                  />
                </mesh>
              </>
            )}
            {/* Sliding door glass */}
            {door.style === "sliding" && (
              <mesh position={[x, y + 0.1, 0.015]}>
                <planeGeometry args={[door.width - 0.12, door.height - 0.25]} />
                <meshPhysicalMaterial
                  color="#87CEEB"
                  transparent
                  opacity={0.35}
                  transmission={0.7}
                />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
