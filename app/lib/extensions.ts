import {
  HouseConfig,
  HouseExtension,
  WallName,
  WindowConfig,
  DoorConfig,
} from "./types";
import { WallCut } from "../components/Walls";

export interface BodyTransform {
  position: [number, number, number];
  rotationY: number;
}

/** Compute the local transform for an extension relative to its parent body */
function getExtensionLocalTransform(
  parentWidth: number,
  parentDepth: number,
  parentWall: WallName,
  position: number,
  extDepth: number,
): BodyTransform {
  const parentWallLength =
    parentWall === "front" || parentWall === "back" ? parentWidth : parentDepth;
  const offset = (position - 0.5) * parentWallLength;

  // Wall rotations remap local X: back (π) mirrors to world -X,
  // left (π/2) maps local X to world -Z, right (-π/2) maps local X to world +Z.
  // Negate offset where needed so the extension body aligns with its wall-cut hole.
  switch (parentWall) {
    case "front":
      return {
        position: [offset, 0, parentDepth / 2 + extDepth / 2],
        rotationY: 0,
      };
    case "back":
      return {
        position: [-offset, 0, -(parentDepth / 2 + extDepth / 2)],
        rotationY: Math.PI,
      };
    case "right":
      return {
        position: [parentWidth / 2 + extDepth / 2, 0, offset],
        rotationY: Math.PI / 2,
      };
    case "left":
      return {
        position: [-(parentWidth / 2 + extDepth / 2), 0, -offset],
        rotationY: -Math.PI / 2,
      };
  }
}

/** Compute the world-space transform for any body (main or extension) */
export function computeBodyWorldTransform(
  bodyId: string,
  config: HouseConfig,
): BodyTransform & { width: number; depth: number } {
  if (bodyId === "main") {
    return {
      position: [0, 0, 0],
      rotationY: 0,
      width: config.width,
      depth: config.depth,
    };
  }

  const ext = config.extensions.find((e) => e.id === bodyId);
  if (!ext) {
    return { position: [0, 0, 0], rotationY: 0, width: 4, depth: 3 };
  }

  const parent = computeBodyWorldTransform(ext.parentId, config);
  const local = getExtensionLocalTransform(
    parent.width,
    parent.depth,
    ext.parentWall,
    ext.position,
    ext.depth,
  );

  // Transform local position by parent's rotation
  const cos = Math.cos(parent.rotationY);
  const sin = Math.sin(parent.rotationY);
  const worldX =
    parent.position[0] + local.position[0] * cos - local.position[2] * sin;
  const worldZ =
    parent.position[2] + local.position[0] * sin + local.position[2] * cos;

  return {
    position: [worldX, 0, worldZ],
    rotationY: parent.rotationY + local.rotationY,
    width: ext.width,
    depth: ext.depth,
  };
}

/** Build a HouseConfig-like object for rendering an extension body */
export function makeExtensionConfig(
  ext: HouseExtension,
  mainConfig: HouseConfig,
): HouseConfig {
  return {
    width: ext.width,
    depth: ext.depth,
    wallHeight: ext.wallHeight,
    roofType: ext.roofType,
    roofPitch: ext.roofPitch,
    roofOverhang: ext.roofOverhang,
    roofMaterial: mainConfig.roofMaterial,
    wallMaterial: mainConfig.wallMaterial,
    windows: ext.windows,
    doors: ext.doors,
    extensions: [],
    wallColor: mainConfig.wallColor,
    roofColor: mainConfig.roofColor,
    trimColor: mainConfig.trimColor,
  };
}

/** Compute wall cuts for a body based on extensions that attach to it */
export function getWallCuts(bodyId: string, config: HouseConfig): WallCut[] {
  return config.extensions
    .filter((ext) => ext.parentId === bodyId)
    .map((ext) => ({
      wall: ext.parentWall,
      positionX: ext.position,
      width: ext.width,
      height: ext.wallHeight,
    }));
}

// Timber constants (must match WallStuds.tsx)
const STUD_WIDTH = 0.045;
const STUD_DEPTH = 0.145;
const PLATE_HEIGHT = 0.045;

export interface JunctionBacker {
  position: [number, number, number];
  size: [number, number, number]; // [w, h, d]
}

/**
 * Compute California corner backing studs at the junction where an extension
 * meets its parent wall. Returns positions in world space.
 *
 * At each side of the extension opening, a flat backer stud is nailed to the
 * inside face of the parent wall's king stud, providing an interior nailing
 * surface for the perpendicular extension wall's drywall.
 */
export function getJunctionBackers(
  ext: HouseExtension,
  config: HouseConfig,
): JunctionBacker[] {
  const parent = computeBodyWorldTransform(ext.parentId, config);
  const wallHeight = Math.min(
    ext.wallHeight,
    ext.parentId === "main" ? config.wallHeight : ext.wallHeight,
  );
  const plateTop = wallHeight - PLATE_HEIGHT;
  const fullH = plateTop - PLATE_HEIGHT;
  const backerY = PLATE_HEIGHT + fullH / 2;

  const parentWallLength =
    ext.parentWall === "front" || ext.parentWall === "back"
      ? parent.width
      : parent.depth;

  // Position of extension center along parent wall (in parent local coords)
  const extCenterLocal = (ext.position - 0.5) * parentWallLength;
  const halfExtW = ext.width / 2;

  // Left and right edges of extension opening along parent wall
  const leftEdge = extCenterLocal - halfExtW;
  const rightEdge = extCenterLocal + halfExtW;

  const backers: JunctionBacker[] = [];

  // For each side of the opening, place a flat backer just inside the king stud
  for (const edgeX of [leftEdge, rightEdge]) {
    // Local position in parent's wall coordinate system
    // The backer sits inward from the wall face, turned 90° (flat)
    let worldX: number, worldZ: number;
    const cos = Math.cos(parent.rotationY);
    const sin = Math.sin(parent.rotationY);

    // Parent wall normal direction (outward) and along-wall direction
    switch (ext.parentWall) {
      case "front": {
        const lx = edgeX;
        const lz = parent.depth / 2 - STUD_DEPTH + STUD_WIDTH / 2;
        worldX = parent.position[0] + lx * cos - lz * sin;
        worldZ = parent.position[2] + lx * sin + lz * cos;
        break;
      }
      case "back": {
        // Back wall is rotated π, so local X is negated
        const lx = -edgeX;
        const lz = -(parent.depth / 2 - STUD_DEPTH + STUD_WIDTH / 2);
        worldX = parent.position[0] + lx * cos - lz * sin;
        worldZ = parent.position[2] + lx * sin + lz * cos;
        break;
      }
      case "right": {
        // Right wall rotated π/2
        const lx = parent.width / 2 - STUD_DEPTH + STUD_WIDTH / 2;
        const lz = edgeX;
        worldX = parent.position[0] + lx * cos - lz * sin;
        worldZ = parent.position[2] + lx * sin + lz * cos;
        break;
      }
      case "left": {
        // Left wall rotated -π/2, local X negated
        const lx = -(parent.width / 2 - STUD_DEPTH + STUD_WIDTH / 2);
        const lz = -edgeX;
        worldX = parent.position[0] + lx * cos - lz * sin;
        worldZ = parent.position[2] + lx * sin + lz * cos;
        break;
      }
    }

    // Backer is turned 90° relative to parent wall
    // Size: STUD_DEPTH wide (parallel to parent wall) × fullH × STUD_WIDTH deep
    const isHorizontalWall =
      ext.parentWall === "front" || ext.parentWall === "back";

    backers.push({
      position: [worldX, backerY, worldZ],
      size: isHorizontalWall
        ? [STUD_DEPTH, fullH, STUD_WIDTH]
        : [STUD_WIDTH, fullH, STUD_DEPTH],
    });
  }

  return backers;
}

// ---------- Collinear wall merging ----------

export interface MergedWall {
  /** Which body's wall to skip */
  parentBodyId: string;
  parentWallToSkip: WallName;
  extensionId: string;
  extensionWallToSkip: WallName;
  /** World-space position for rendering the merged wall (WallStuds-style origin) */
  position: [number, number, number];
  /** Rotation for the merged wall group */
  rotationY: number;
  /** Total length of the merged wall (shortened for butt joints at each end) */
  totalLength: number;
  wallHeight: number;
  /** Whether the extension section is at the start (x=0) of the merged wall */
  extAddsAtStart: boolean;
  /** X position in merged wall local coords where parent and extension sections meet */
  junctionX: number;
  /** Merged config with openings mapped to the merged wall */
  mergedConfig: HouseConfig;
}

/**
 * Map parent wall → which parent walls are perpendicular on each side.
 * [lowEdgeSide, highEdgeSide]: looking at the parent wall from outside,
 * "low" = left end of wall, "high" = right end.
 *
 * For front wall (runs left to right): low = left wall, high = right wall
 * For back wall (rotated π, local X goes right→left in world): low = right wall, high = left wall
 * For right wall (rotated -π/2 in Walls, runs front→back looking from outside): low = front, high = back
 * For left wall (rotated π/2 in Walls, runs back→front looking from outside): low = back, high = front
 */
function getAdjacentWalls(parentWall: WallName): [WallName, WallName] {
  switch (parentWall) {
    case "front":
      return ["left", "right"];
    case "back":
      return ["right", "left"];
    case "right":
      return ["back", "front"];
    case "left":
      return ["front", "back"];
  }
}

/**
 * For an extension, check which of its side walls ("left"/"right")
 * is at the low or high edge of the parent wall and build a merged wall.
 *
 * The extension body rotation determines which local side (-X or +X) maps
 * to which world direction:
 *   front (rot 0): left=-X, right=+X  → low=left, high=right
 *   back  (rot π): left=+X, right=-X  → low=left, high=right
 *   right (rot π/2): left=+Z, right=-Z → low=right, high=left
 *   left  (rot -π/2): left=-Z, right=+Z → low=right, high=left
 */
export function getCollinearWalls(config: HouseConfig): MergedWall[] {
  const EPSILON = 0.01;
  const merged: MergedWall[] = [];

  // Extension side at low-position edge and high-position edge
  // depends on parent wall orientation.
  function getExtSides(parentWall: WallName): {
    lowSide: "left" | "right";
    highSide: "left" | "right";
  } {
    if (parentWall === "front" || parentWall === "back") {
      return { lowSide: "left", highSide: "right" };
    }
    // right/left walls: reversed
    return { lowSide: "right", highSide: "left" };
  }

  for (const ext of config.extensions) {
    const parent = computeBodyWorldTransform(ext.parentId, config);
    const parentWallLength =
      ext.parentWall === "front" || ext.parentWall === "back"
        ? parent.width
        : parent.depth;

    const extCenter = ext.position * parentWallLength;
    const extLeftEdge = extCenter - ext.width / 2;
    const extRightEdge = extCenter + ext.width / 2;

    const [lowWall, highWall] = getAdjacentWalls(ext.parentWall);
    const { lowSide, highSide } = getExtSides(ext.parentWall);

    // Extension side at the low-position edge of the parent wall
    if (Math.abs(extLeftEdge) < EPSILON) {
      const mw = buildMergedWall(ext, config, parent, lowSide, lowWall);
      if (mw) merged.push(mw);
    }

    // Extension side at the high-position edge of the parent wall
    if (Math.abs(extRightEdge - parentWallLength) < EPSILON) {
      const mw = buildMergedWall(ext, config, parent, highSide, highWall);
      if (mw) merged.push(mw);
    }
  }

  return merged;
}

/**
 * Build a merged wall descriptor. The merged wall combines a parent's
 * perpendicular wall with an extension's collinear side wall.
 *
 * The merged wall uses the same position/rotation conventions as WallStuds.tsx:
 * - "right": origin = [W/2, 0, D/2 - STUD_DEPTH], rotation π/2
 * - "left":  origin = [-W/2, 0, -D/2 + STUD_DEPTH], rotation -π/2
 * - "front": origin = [-W/2, 0, D/2], rotation 0
 * - "back":  origin = [W/2, 0, -D/2], rotation π
 *
 * For Walls.tsx, rotations differ for left/right:
 * - "right": rotation -π/2, "left": rotation π/2
 * - "front"/"back" same as WallStuds
 */
function buildMergedWall(
  ext: HouseExtension,
  config: HouseConfig,
  parent: BodyTransform & { width: number; depth: number },
  extSide: "left" | "right",
  parentPerpendicularWall: WallName,
): MergedWall | null {
  const isSideWall =
    parentPerpendicularWall === "left" || parentPerpendicularWall === "right";

  // Parent perpendicular wall length and extension side wall length
  const parentPerpLength = isSideWall ? parent.depth : parent.width;
  const extSideLength = ext.depth;

  // Total merged wall length:
  // - Side walls (butt walls): shortened by SD at each far end, no shortening at junction
  //   total = parentPerpLength + extSideLength - 2*SD
  // - Through walls (front/back): parent section full length, ext section shortened by SD at far end
  //   total = parentPerpLength + extSideLength - SD
  const totalLength = isSideWall
    ? parentPerpLength + extSideLength - 2 * STUD_DEPTH
    : parentPerpLength + extSideLength - STUD_DEPTH;

  const parentWH =
    ext.parentId === "main"
      ? config.wallHeight
      : (() => {
          const pExt = config.extensions.find((e) => e.id === ext.parentId);
          return pExt ? pExt.wallHeight : config.wallHeight;
        })();
  const wallHeight = Math.min(ext.wallHeight, parentWH);

  const hw = parent.width / 2;
  const hd = parent.depth / 2;
  const cos = Math.cos(parent.rotationY);
  const sin = Math.sin(parent.rotationY);

  // Determine whether the extension adds length at the "start" (local x=0 end)
  // or the "end" (local x=wallLength end) of the parent perpendicular wall.
  //
  // WallStuds convention: wall origin at local x=0, runs toward +x.
  // - "right" (rot π/2): local +x → world -Z. Start at +Z (front). End at -Z (back).
  // - "left" (rot -π/2): local +x → world +Z. Start at -Z (back). End at +Z (front).
  // - "front" (rot 0): local +x → world +X. Start at -X (left). End at +X (right).
  // - "back" (rot π): local +x → world -X. Start at +X (right). End at -X (left).
  //
  // The extension is on parentWall and flush at the edge near parentPerpendicularWall.
  // We need to know if the extension adds length at the start or end of that perp wall.

  let extAddsAtStart: boolean;
  switch (parentPerpendicularWall) {
    case "right":
      // Right wall start is at front (+Z). Extension on front wall adds at start.
      extAddsAtStart = ext.parentWall === "front";
      break;
    case "left":
      // Left wall start is at back (-Z). Extension on back wall adds at start.
      extAddsAtStart = ext.parentWall === "back";
      break;
    case "front":
      // Front wall start is at left (-X). Extension on left wall adds at start.
      extAddsAtStart = ext.parentWall === "left";
      break;
    case "back":
      // Back wall start is at right (+X). Extension on right wall adds at start.
      extAddsAtStart = ext.parentWall === "right";
      break;
  }

  // Compute origin in parent local space using WallStuds conventions
  // but shifted to account for the extension adding length at start or end.
  let localX: number, localZ: number;
  let localRotY: number;

  switch (parentPerpendicularWall) {
    case "right":
      localX = hw;
      localRotY = Math.PI / 2;
      if (extAddsAtStart) {
        // Extension adds before the normal start → push origin further in +Z
        localZ = hd + extSideLength - STUD_DEPTH;
      } else {
        localZ = hd - STUD_DEPTH;
      }
      break;
    case "left":
      localX = -hw;
      localRotY = -Math.PI / 2;
      if (extAddsAtStart) {
        // Extension adds before the normal start → push origin further in -Z
        localZ = -hd - extSideLength + STUD_DEPTH;
      } else {
        localZ = -hd + STUD_DEPTH;
      }
      break;
    case "front":
      localZ = hd;
      localRotY = 0;
      if (extAddsAtStart) {
        // Extension adds before the normal start → push origin further in -X
        localX = -hw - extSideLength + STUD_DEPTH;
      } else {
        localX = -hw;
      }
      break;
    case "back":
      localZ = -hd;
      localRotY = Math.PI;
      if (extAddsAtStart) {
        // Extension adds before the normal start → push origin further in +X
        localX = hw + extSideLength - STUD_DEPTH;
      } else {
        localX = hw;
      }
      break;
  }

  // Transform to world space
  const worldX = parent.position[0] + localX * cos - localZ * sin;
  const worldZ = parent.position[2] + localX * sin + localZ * cos;

  // Map openings from both bodies onto the merged wall.
  //
  // Parent standalone wall lengths:
  // - Side walls (butt): parentPerpLength - 2*SD
  // - Through walls (front/back): parentPerpLength (no shortening)
  //
  // Extension standalone side wall length: extSideLength - SD (butt at front end, back skipped)
  //
  // In the merged wall, each section is longer than standalone because there's
  // no shortening at the junction. The extra zone at the junction shifts openings.
  const parentStandaloneLen = isSideWall
    ? parentPerpLength - 2 * STUD_DEPTH
    : parentPerpLength;

  // Parent section length within merged wall
  const parentMergedSection = isSideWall
    ? parentPerpLength - STUD_DEPTH // one SD at far end, none at junction
    : parentPerpLength; // through wall, full length
  const extMergedSection = extSideLength - STUD_DEPTH; // SD at far end only
  const extStandaloneLen = extSideLength - STUD_DEPTH;

  const parentOffset = extAddsAtStart ? extMergedSection : 0;
  const extOffset = extAddsAtStart ? 0 : parentMergedSection;

  // Shift for parent openings: in standalone butt wall, openings start after SD.
  // In merged wall, the junction end has no SD, so openings shift by SD.
  // For through walls, no shift needed (standalone has no SD at either end).
  const parentOpeningShift = isSideWall ? STUD_DEPTH : 0;

  // Get parent body openings on the perpendicular wall
  const parentBodyConfig =
    ext.parentId === "main"
      ? config
      : (() => {
          const pExt = config.extensions.find((e) => e.id === ext.parentId);
          return pExt ? makeExtensionConfig(pExt, config) : config;
        })();

  const windows: WindowConfig[] = [
    ...parentBodyConfig.windows
      .filter((w) => w.wall === parentPerpendicularWall)
      .map((w) => ({
        ...w,
        wall: "front" as WallName,
        positionX:
          (parentOffset +
            parentOpeningShift +
            w.positionX * parentStandaloneLen) /
          totalLength,
      })),
    ...ext.windows
      .filter((w) => w.wall === extSide)
      .map((w) => ({
        ...w,
        wall: "front" as WallName,
        positionX: (extOffset + w.positionX * extStandaloneLen) / totalLength,
      })),
  ];

  const doors: DoorConfig[] = [
    ...parentBodyConfig.doors
      .filter((d) => d.wall === parentPerpendicularWall)
      .map((d) => ({
        ...d,
        wall: "front" as WallName,
        positionX:
          (parentOffset +
            parentOpeningShift +
            d.positionX * parentStandaloneLen) /
          totalLength,
      })),
    ...ext.doors
      .filter((d) => d.wall === extSide)
      .map((d) => ({
        ...d,
        wall: "front" as WallName,
        positionX: (extOffset + d.positionX * extStandaloneLen) / totalLength,
      })),
  ];

  // Build a minimal config representing the merged wall as a single "front" wall
  const mergedConfig: HouseConfig = {
    width: totalLength,
    depth: STUD_DEPTH * 2,
    wallHeight,
    roofType: "flat",
    roofPitch: 0,
    roofOverhang: 0,
    roofMaterial: config.roofMaterial,
    wallMaterial: config.wallMaterial,
    windows,
    doors,
    extensions: [],
    wallColor: config.wallColor,
    roofColor: config.roofColor,
    trimColor: config.trimColor,
  };

  return {
    parentBodyId: ext.parentId,
    parentWallToSkip: parentPerpendicularWall,
    extensionId: ext.id,
    extensionWallToSkip: extSide,
    position: [worldX, 0, worldZ],
    rotationY: parent.rotationY + localRotY,
    totalLength,
    wallHeight,
    extAddsAtStart,
    junctionX: extAddsAtStart ? extMergedSection : parentMergedSection,
    mergedConfig,
  };
}
