// ============================================================
// Wall Layout System — Opening Utilities
// Framing computation and geometry ops for wall openings.
// All dimensions in millimeters (mm).
// ============================================================

import type { WallOpening, Wall } from "./types";

const PLATE_HEIGHT = 45; // mm

/** A framing member generated around an opening */
export interface OpeningFramingMember {
  /** Center position along wall (mm) */
  centerX: number;
  /** Center height from floor (mm) */
  centerY: number;
  /** Width along wall direction (mm) */
  width: number;
  /** Vertical height (mm) */
  height: number;
  /** Depth into wall (mm) */
  depth: number;
  /** Type of framing member */
  type: "trimmer" | "header" | "sill" | "cripple-above" | "cripple-below";
}

/** Result of computing framing around a single opening */
export interface OpeningFramingResult {
  opening: WallOpening;
  members: OpeningFramingMember[];
  /** Indices of regular studs to remove */
  removedStudIndices: number[];
}

/**
 * Compute the framing members needed around a wall opening.
 * Returns trimmer studs, header, sill (for windows), and cripple studs
 * that maintain the original grid spacing.
 */
export function computeOpeningFraming(
  opening: WallOpening,
  studs: { centerPosition: number; width: number }[],
  effectiveLength: number,
  wallHeight: number,
  studWidth: number,
  studDepth: number,
): OpeningFramingResult {
  const members: OpeningFramingMember[] = [];
  const removedStudIndices: number[] = [];

  const oLeft = opening.left;
  const oRight = opening.left + opening.width;
  const oBottom = opening.bottom;
  const oTop = opening.bottom + opening.height;

  // Find studs overlapping the opening (to remove)
  for (let i = 0; i < studs.length; i++) {
    const stud = studs[i];
    const sLeft = stud.centerPosition - stud.width / 2;
    const sRight = stud.centerPosition + stud.width / 2;
    if (sRight > oLeft + 0.1 && sLeft < oRight - 0.1) {
      removedStudIndices.push(i);
    }
  }

  const fullStudHeight = wallHeight - 2 * PLATE_HEIGHT;

  // Trimmer studs at opening edges (full height)
  const leftTrimmerX = oLeft - studWidth / 2;
  const rightTrimmerX = oRight + studWidth / 2;

  if (leftTrimmerX >= studWidth / 2 - 0.1) {
    members.push({
      centerX: leftTrimmerX,
      centerY: PLATE_HEIGHT + fullStudHeight / 2,
      width: studWidth,
      height: fullStudHeight,
      depth: studDepth,
      type: "trimmer",
    });
  }

  if (rightTrimmerX <= effectiveLength - studWidth / 2 + 0.1) {
    members.push({
      centerX: rightTrimmerX,
      centerY: PLATE_HEIGHT + fullStudHeight / 2,
      width: studWidth,
      height: fullStudHeight,
      depth: studDepth,
      type: "trimmer",
    });
  }

  // Header: horizontal beam fitting between the inner faces of the trimmers
  const headerHeight = studWidth;
  const headerBottom = oTop;
  const headerCenterX = (oLeft + oRight) / 2;
  const headerSpan = oRight - oLeft;

  if (headerBottom + headerHeight <= wallHeight - PLATE_HEIGHT + 0.1) {
    members.push({
      centerX: headerCenterX,
      centerY: headerBottom + headerHeight / 2,
      width: headerSpan,
      height: headerHeight,
      depth: studDepth,
      type: "header",
    });
  }

  // Sill for non-door openings (bottom > plate height)
  const hasSill = oBottom > PLATE_HEIGHT + 1;
  if (hasSill) {
    const sillHeight = studWidth;
    members.push({
      centerX: headerCenterX,
      centerY: oBottom - sillHeight / 2,
      width: headerSpan,
      height: sillHeight,
      depth: studDepth,
      type: "sill",
    });
  }

  // Cripple studs above header (maintain grid positions)
  const crippleAboveBottom = headerBottom + headerHeight;
  const crippleAboveTop = wallHeight - PLATE_HEIGHT;
  const crippleAboveH = crippleAboveTop - crippleAboveBottom;

  if (crippleAboveH > studWidth) {
    for (const stud of studs) {
      if (
        stud.centerPosition > oLeft + 0.1 &&
        stud.centerPosition < oRight - 0.1
      ) {
        members.push({
          centerX: stud.centerPosition,
          centerY: crippleAboveBottom + crippleAboveH / 2,
          width: studWidth,
          height: crippleAboveH,
          depth: studDepth,
          type: "cripple-above",
        });
      }
    }
  }

  // Cripple studs below sill
  if (hasSill) {
    const crippleBelowBottom = PLATE_HEIGHT;
    const crippleBelowTop = oBottom - studWidth;
    const crippleBelowH = crippleBelowTop - crippleBelowBottom;

    if (crippleBelowH > studWidth) {
      for (const stud of studs) {
        if (
          stud.centerPosition > oLeft + 0.1 &&
          stud.centerPosition < oRight - 0.1
        ) {
          members.push({
            centerX: stud.centerPosition,
            centerY: crippleBelowBottom + crippleBelowH / 2,
            width: studWidth,
            height: crippleBelowH,
            depth: studDepth,
            type: "cripple-below",
          });
        }
      }
    }
  }

  return { opening, members, removedStudIndices };
}

// ---- Rectangle subtraction utilities ----

/**
 * Subtract rectangular openings from a rectangle, returning the remaining
 * pieces. Handles multiple openings via iterative subtraction.
 */
export function subtractOpeningsFromRect(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  openings: WallOpening[],
): { x: number; y: number; w: number; h: number }[] {
  let rects = [{ x: rx, y: ry, w: rw, h: rh }];

  for (const o of openings) {
    const next: typeof rects = [];
    for (const r of rects) {
      next.push(
        ...subtractRect(
          r.x,
          r.y,
          r.w,
          r.h,
          o.left,
          o.bottom,
          o.width,
          o.height,
        ),
      );
    }
    rects = next;
  }

  return rects.filter((r) => r.w > 0.5 && r.h > 0.5);
}

function subtractRect(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
): { x: number; y: number; w: number; h: number }[] {
  const overlapLeft = Math.max(rx, ox);
  const overlapBottom = Math.max(ry, oy);
  const overlapRight = Math.min(rx + rw, ox + ow);
  const overlapTop = Math.min(ry + rh, oy + oh);

  if (overlapLeft >= overlapRight || overlapBottom >= overlapTop) {
    return [{ x: rx, y: ry, w: rw, h: rh }];
  }

  const pieces: { x: number; y: number; w: number; h: number }[] = [];

  // Left strip (full height)
  if (overlapLeft > rx + 0.5) {
    pieces.push({ x: rx, y: ry, w: overlapLeft - rx, h: rh });
  }
  // Right strip (full height)
  if (overlapRight < rx + rw - 0.5) {
    pieces.push({ x: overlapRight, y: ry, w: rx + rw - overlapRight, h: rh });
  }
  // Bottom strip (between left and right)
  if (overlapBottom > ry + 0.5) {
    pieces.push({
      x: overlapLeft,
      y: ry,
      w: overlapRight - overlapLeft,
      h: overlapBottom - ry,
    });
  }
  // Top strip (between left and right)
  if (overlapTop < ry + rh - 0.5) {
    pieces.push({
      x: overlapLeft,
      y: overlapTop,
      w: overlapRight - overlapLeft,
      h: ry + rh - overlapTop,
    });
  }

  return pieces;
}

// ---- Coordinate mapping ----

/**
 * Map openings from framing wall coordinates to another layer wall's
 * coordinates. The X position is shifted by the offset between the two
 * walls' effective start points along the wall direction.
 */
export function mapOpeningsToWall(
  openings: WallOpening[],
  framingWall: Wall,
  layerWall: Wall,
): WallOpening[] {
  if (openings.length === 0) return openings;

  const framingMidStartX =
    (framingWall.quad.outerStart.x + framingWall.quad.innerStart.x) / 2;
  const framingMidStartY =
    (framingWall.quad.outerStart.y + framingWall.quad.innerStart.y) / 2;
  const layerMidStartX =
    (layerWall.quad.outerStart.x + layerWall.quad.innerStart.x) / 2;
  const layerMidStartY =
    (layerWall.quad.outerStart.y + layerWall.quad.innerStart.y) / 2;

  const offset =
    (layerMidStartX - framingMidStartX) * framingWall.direction.x +
    (layerMidStartY - framingMidStartY) * framingWall.direction.y;

  return openings.map((o) => ({
    ...o,
    left: o.left - offset,
  }));
}

// ---- Span splitting helpers ----

/**
 * Split a horizontal span [start, end] around openings that overlap
 * the given vertical range [y, y+h]. Returns non-overlapping sub-spans.
 */
export function splitHorizontalSpan(
  start: number,
  end: number,
  y: number,
  h: number,
  openings: WallOpening[],
): { start: number; end: number }[] {
  const cuts: { left: number; right: number }[] = [];
  for (const o of openings) {
    if (y + h > o.bottom + 0.1 && y < o.bottom + o.height - 0.1) {
      cuts.push({ left: o.left, right: o.left + o.width });
    }
  }

  if (cuts.length === 0) return [{ start, end }];
  cuts.sort((a, b) => a.left - b.left);

  const spans: { start: number; end: number }[] = [];
  let current = start;

  for (const cut of cuts) {
    if (cut.left > current + 0.5) {
      spans.push({ start: current, end: Math.min(cut.left, end) });
    }
    current = Math.max(current, cut.right);
  }

  if (current < end - 0.5) {
    spans.push({ start: current, end });
  }

  return spans;
}

/**
 * Split a vertical span around openings that overlap
 * the given horizontal range [x, x+w].
 */
export function splitVerticalSpan(
  start: number,
  end: number,
  x: number,
  w: number,
  openings: WallOpening[],
): { start: number; end: number }[] {
  const cuts: { bottom: number; top: number }[] = [];
  for (const o of openings) {
    if (x + w > o.left + 0.1 && x < o.left + o.width - 0.1) {
      cuts.push({ bottom: o.bottom, top: o.bottom + o.height });
    }
  }

  if (cuts.length === 0) return [{ start, end }];
  cuts.sort((a, b) => a.bottom - b.bottom);

  const spans: { start: number; end: number }[] = [];
  let current = start;

  for (const cut of cuts) {
    if (cut.bottom > current + 0.5) {
      spans.push({ start: current, end: Math.min(cut.bottom, end) });
    }
    current = Math.max(current, cut.top);
  }

  if (current < end - 0.5) {
    spans.push({ start: current, end });
  }

  return spans;
}
