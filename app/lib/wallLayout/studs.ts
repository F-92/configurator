// ============================================================
// Wall Layout System — Stud Placement
// Places studs on a fixed module grid (e.g. 600 mm c/c)
// measured from the building's outer corner.
// ============================================================

import type { Stud, StudLayout } from "./types";

/**
 * Place studs along a wall of the given effective length.
 *
 * The 600mm module grid is measured from the outer corner.
 * For a butt wall retracted by `startRetraction` mm:
 *   - First stud flush at wall start (center at halfW)
 *   - Grid studs at (600 − retraction), (1200 − retraction), …
 *   - First c/c = targetSpacing − startRetraction − halfW
 *   - Middle c/c = targetSpacing
 *   - Last stud flush at wall end
 */
export function placeStuds(
  effectiveLength: number,
  targetSpacing: number,
  studWidth: number,
  studDepth: number,
  startRetraction: number = 0,
): StudLayout {
  if (effectiveLength <= 0) {
    return {
      targetSpacing,
      actualSpacing: 0,
      bayCount: 0,
      studs: [],
      cornerStuds: [],
      effectiveLength,
    };
  }

  const halfW = studWidth / 2;

  // If the wall is shorter than one bay, just place end studs
  if (effectiveLength <= targetSpacing) {
    const studs: Stud[] = [
      { centerPosition: halfW, width: studWidth, depth: studDepth },
    ];
    if (effectiveLength > studWidth) {
      studs.push({
        centerPosition: effectiveLength - halfW,
        width: studWidth,
        depth: studDepth,
      });
    }
    return {
      targetSpacing,
      actualSpacing: effectiveLength - studWidth,
      bayCount: studs.length > 1 ? 1 : 0,
      studs,
      cornerStuds: [],
      effectiveLength,
    };
  }

  const studs: Stud[] = [];

  // First stud flush at wall start
  studs.push({ centerPosition: halfW, width: studWidth, depth: studDepth });

  // Grid from outer corner: positions 600, 1200, 1800, …
  // In local wall coords: gridPos − startRetraction
  const endStudCenter = effectiveLength - halfW;
  const firstGrid =
    Math.ceil((startRetraction + halfW + 0.001) / targetSpacing) *
    targetSpacing;
  let cornerPos = firstGrid;
  // Only place grid stud if it leaves at least one stud width to the end stud
  while (cornerPos - startRetraction <= endStudCenter - studWidth) {
    studs.push({
      centerPosition: cornerPos - startRetraction,
      width: studWidth,
      depth: studDepth,
    });
    cornerPos += targetSpacing;
  }

  // Last stud flush at wall end
  studs.push({
    centerPosition: endStudCenter,
    width: studWidth,
    depth: studDepth,
  });

  const bayCount = studs.length - 1;

  return {
    targetSpacing,
    actualSpacing: targetSpacing,
    bayCount,
    studs,
    cornerStuds: [],
    effectiveLength,
  };
}
