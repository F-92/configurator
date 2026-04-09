export { generateFinkGeometry, computeLoads } from "./geometry";
export { analyzeTruss } from "./analysis";
export { checkMembers, getEA, getEI } from "./design";
export type {
  DistributedMemberLoad,
  LoadCase,
  TrussInput,
  TrussNode,
  TrussMember,
  TrussGeometry,
  PointLoad,
  MemberResult,
  DesignCheck,
  TrussDesignResult,
} from "./types";

import type { TrussInput, TrussDesignResult } from "./types";
import { generateFinkGeometry, computeLoads } from "./geometry";
import { analyzeTruss } from "./analysis";
import { checkMembers, getEA, getEI } from "./design";

/**
 * Quick ULS-only evaluation used by the panel-count selector.
 * Returns the maximum member utilization without running SLS.
 */
function quickEvaluate(input: TrussInput, nPanels: number): number {
  const geometry = generateFinkGeometry(input.span, input.pitch, nPanels);
  const EA_top = getEA(input.timberWidth, input.topChordHeight);
  const EA_bottom = getEA(input.timberWidth, input.bottomChordHeight);
  const EI_top = getEI(input.timberWidth, input.topChordHeight);
  const memberEAs = geometry.members.map((m) =>
    m.group === "topChord" ? EA_top : EA_bottom,
  );
  const memberEIs = geometry.members.map((m) =>
    m.group === "topChord" ? EI_top : 0,
  );
  const loads = computeLoads(input, geometry, true);
  const result = analyzeTruss(
    geometry,
    loads,
    memberEAs,
    memberEIs,
    input.jointRotationalStiffness,
  );
  const checks = checkMembers(result.memberResults, input);
  return Math.max(...checks.map((c) => c.utilization));
}

/**
 * Automatically choose the smallest even panel count (≥ 4) whose ULS
 * utilisation does not exceed 1.0.  When no count passes, pick the one
 * with the lowest utilisation (least bad option).
 */
function selectPanelCount(input: TrussInput): number {
  const MIN_PANELS = 4;
  const MAX_PANELS = 16;

  let bestN = MIN_PANELS;
  let bestUtil = Infinity;

  for (let n = MIN_PANELS; n <= MAX_PANELS; n += 2) {
    const util = quickEvaluate(input, n);
    if (util <= 1.0) return n; // first passing count (smallest)
    if (util < bestUtil) {
      bestUtil = util;
      bestN = n;
    }
  }
  return bestN; // no passing count — least bad option
}

/**
 * Run the full design pipeline:
 * - full_frame: auto-select panels, use semi-rigid joints, frame elements
 * - traguiden: fixed 4 panels, pinned joints (kθ=0), axial-only top chord
 */
export function designTruss(input: TrussInput): TrussDesignResult {
  const isTraguiden = input.mode === "traguiden";

  // TräGuiden mode: fixed 4-panel geometry with pure truss assumptions
  const panelCount = isTraguiden ? 4 : selectPanelCount(input);
  const kTheta = isTraguiden ? 0 : input.jointRotationalStiffness;

  const geometry = generateFinkGeometry(input.span, input.pitch, panelCount);

  // Per-member EA based on group-specific timber sizes
  const EA_top = getEA(input.timberWidth, input.topChordHeight);
  const EA_bottom = getEA(input.timberWidth, input.bottomChordHeight);
  // TräGuiden mode: EI=0 makes top chord axial-only (pure truss)
  const EI_top = isTraguiden
    ? 0
    : getEI(input.timberWidth, input.topChordHeight);
  const memberEAs = geometry.members.map((m) =>
    m.group === "topChord" ? EA_top : EA_bottom,
  );
  const memberEIs = geometry.members.map((m) =>
    m.group === "topChord" ? EI_top : 0,
  );

  // --- ULS: factored loads for strength checks ---
  const ulsLoads = computeLoads(input, geometry, true);
  const ulsResult = analyzeTruss(
    geometry,
    ulsLoads,
    memberEAs,
    memberEIs,
    kTheta,
  );
  const designChecks = checkMembers(ulsResult.memberResults, input);

  // --- SLS: characteristic loads for deflection check ---
  const slsLoads = computeLoads(input, geometry, false);
  const slsResult = analyzeTruss(
    geometry,
    slsLoads,
    memberEAs,
    memberEIs,
    kTheta,
  );
  // No bottom chord node at midspan — use max vertical displacement
  // of all bottom chord internal nodes (excluding supports).
  const supportIds = new Set(geometry.supports.map((s) => s.nodeId));
  const bcNodeIds = new Set<number>();
  for (const m of geometry.members) {
    if (m.group === "bottomChord") {
      bcNodeIds.add(m.startNodeId);
      bcNodeIds.add(m.endNodeId);
    }
  }
  const bottomInternalIds = [...bcNodeIds].filter((id) => !supportIds.has(id));
  const midspanDeflection = Math.max(
    ...bottomInternalIds.map((id) => {
      const d = slsResult.displacements.find((d) => d.nodeId === id);
      return d ? Math.abs(d.dy) * 1000 : 0; // m → mm
    }),
  );
  const deflectionLimit = (input.span * 1000) / 300; // mm
  const deflectionPass = midspanDeflection <= deflectionLimit;

  const totalTimberLength = ulsResult.memberResults.reduce(
    (sum, m) => sum + m.length,
    0,
  );
  const maxUtilization = Math.max(...designChecks.map((c) => c.utilization));
  const allPass = designChecks.every((c) => c.pass) && deflectionPass;

  return {
    panelCount,
    geometry,
    loads: ulsLoads,
    memberResults: ulsResult.memberResults,
    designChecks,
    totalTimberLength,
    maxUtilization,
    allPass,
    midspanDeflection,
    deflectionLimit,
    deflectionPass,
  };
}
