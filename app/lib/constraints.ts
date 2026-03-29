import {
  HouseConfig,
  ConstraintViolation,
  LIMITS,
  WindowConfig,
  DoorConfig,
  HouseExtension,
} from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getWallLength(
  config: HouseConfig,
  wall: WindowConfig["wall"],
): number {
  return wall === "front" || wall === "back" ? config.width : config.depth;
}

function validateWindow(
  window: WindowConfig,
  config: HouseConfig,
): { window: WindowConfig; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = [];
  const corrected = { ...window };
  const wallLength = getWallLength(config, window.wall);

  // Clamp window dimensions
  corrected.width = clamp(
    window.width,
    LIMITS.windowWidth.min,
    Math.min(LIMITS.windowWidth.max, wallLength - 0.4),
  );
  corrected.height = clamp(
    window.height,
    LIMITS.windowHeight.min,
    Math.min(LIMITS.windowHeight.max, config.wallHeight - 0.4),
  );

  if (corrected.width !== window.width) {
    violations.push({
      field: `window.${window.id}.width`,
      message: `Window width adjusted to fit wall`,
      correctedValue: corrected.width,
    });
  }
  if (corrected.height !== window.height) {
    violations.push({
      field: `window.${window.id}.height`,
      message: `Window height adjusted to fit wall`,
      correctedValue: corrected.height,
    });
  }

  // Ensure window fits on wall
  const maxPosX = 1 - corrected.width / wallLength;
  corrected.positionX = clamp(
    window.positionX,
    corrected.width / wallLength / 2,
    maxPosX + corrected.width / wallLength / 2,
  );

  // Ensure window doesn't go above wall
  const maxPosY = config.wallHeight - corrected.height;
  corrected.positionY = clamp(window.positionY, 0.2, maxPosY);

  return { window: corrected, violations };
}

function validateDoor(
  door: DoorConfig,
  config: HouseConfig,
): { door: DoorConfig; violations: ConstraintViolation[] } {
  const violations: ConstraintViolation[] = [];
  const corrected = { ...door };
  const wallLength = getWallLength(config, door.wall);

  corrected.width = clamp(
    door.width,
    LIMITS.doorWidth.min,
    Math.min(LIMITS.doorWidth.max, wallLength - 0.4),
  );
  corrected.height = clamp(
    door.height,
    LIMITS.doorHeight.min,
    Math.min(LIMITS.doorHeight.max, config.wallHeight),
  );

  if (corrected.width !== door.width) {
    violations.push({
      field: `door.${door.id}.width`,
      message: `Door width adjusted`,
      correctedValue: corrected.width,
    });
  }

  const maxPosX = 1 - corrected.width / wallLength;
  corrected.positionX = clamp(
    door.positionX,
    corrected.width / wallLength / 2,
    maxPosX + corrected.width / wallLength / 2,
  );

  return { door: corrected, violations };
}

export function applyConstraints(config: HouseConfig): {
  config: HouseConfig;
  violations: ConstraintViolation[];
} {
  const violations: ConstraintViolation[] = [];
  const corrected = { ...config };

  // Clamp building dimensions
  corrected.width = clamp(config.width, LIMITS.width.min, LIMITS.width.max);
  corrected.depth = clamp(config.depth, LIMITS.depth.min, LIMITS.depth.max);
  corrected.wallHeight = clamp(
    config.wallHeight,
    LIMITS.wallHeight.min,
    LIMITS.wallHeight.max,
  );

  if (corrected.width !== config.width) {
    violations.push({
      field: "width",
      message: `Width clamped to ${corrected.width}m`,
      correctedValue: corrected.width,
    });
  }
  if (corrected.depth !== config.depth) {
    violations.push({
      field: "depth",
      message: `Depth clamped to ${corrected.depth}m`,
      correctedValue: corrected.depth,
    });
  }

  // Roof constraints
  if (corrected.roofType === "flat") {
    corrected.roofPitch = 0;
  } else {
    corrected.roofPitch = clamp(config.roofPitch, 10, LIMITS.roofPitch.max);
  }
  corrected.roofOverhang = clamp(
    config.roofOverhang,
    LIMITS.roofOverhang.min,
    LIMITS.roofOverhang.max,
  );

  // Structural constraint: wide spans with steep roofs need limits
  if (
    corrected.width > 12 &&
    corrected.roofType === "gable" &&
    corrected.roofPitch > 35
  ) {
    corrected.roofPitch = 35;
    violations.push({
      field: "roofPitch",
      message: "Pitch reduced for wide span",
      correctedValue: 35,
    });
  }

  // Validate windows
  corrected.windows = config.windows.map((w) => {
    const result = validateWindow(w, corrected);
    violations.push(...result.violations);
    return result.window;
  });

  // Validate doors
  corrected.doors = config.doors.map((d) => {
    const result = validateDoor(d, corrected);
    violations.push(...result.violations);
    return result.door;
  });

  // Validate extensions
  corrected.extensions = (config.extensions ?? []).map((ext) => {
    const corrExt = { ...ext };

    // Get parent dimensions
    const parentWidth =
      ext.parentId === "main"
        ? corrected.width
        : ((corrected.extensions ?? []).find((e) => e.id === ext.parentId)
            ?.width ?? corrected.width);
    const parentDepth =
      ext.parentId === "main"
        ? corrected.depth
        : ((corrected.extensions ?? []).find((e) => e.id === ext.parentId)
            ?.depth ?? corrected.depth);
    const parentWallLength =
      ext.parentWall === "front" || ext.parentWall === "back"
        ? parentWidth
        : parentDepth;

    // Clamp extension dimensions
    corrExt.width = clamp(ext.width, 2, Math.min(parentWallLength, 20));
    corrExt.depth = clamp(ext.depth, 2, 20);
    corrExt.wallHeight = clamp(
      ext.wallHeight,
      LIMITS.wallHeight.min,
      LIMITS.wallHeight.max,
    );

    // Ensure extension fits on parent wall
    const halfExtW = corrExt.width / parentWallLength / 2;
    corrExt.position = clamp(ext.position, halfExtW, 1 - halfExtW);

    // Roof constraints
    if (corrExt.roofType === "flat") {
      corrExt.roofPitch = 0;
    } else {
      corrExt.roofPitch = clamp(ext.roofPitch, 5, LIMITS.roofPitch.max);
    }
    corrExt.roofOverhang = clamp(ext.roofOverhang, 0, LIMITS.roofOverhang.max);

    // Validate extension windows
    const extConfig: HouseConfig = {
      ...corrected,
      width: corrExt.width,
      depth: corrExt.depth,
      wallHeight: corrExt.wallHeight,
    };
    corrExt.windows = ext.windows.map((w) => {
      const result = validateWindow(w, extConfig);
      violations.push(...result.violations);
      return result.window;
    });
    corrExt.doors = ext.doors.map((d) => {
      const result = validateDoor(d, extConfig);
      violations.push(...result.violations);
      return result.door;
    });

    return corrExt;
  });

  return { config: corrected, violations };
}
