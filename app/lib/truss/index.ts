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
 * Run the full design pipeline:
 * 1. Generate geometry
 * 2. ULS loads → analysis → design checks (strength + stability)
 * 3. SLS loads → analysis → deflection check (L/300)
 */
export function designTruss(input: TrussInput): TrussDesignResult {
  const geometry = generateFinkGeometry(input.span, input.pitch);

  // Per-member EA based on group-specific timber sizes
  const EA_top = getEA(input.timberWidth, input.topChordHeight);
  const EA_bottom = getEA(input.timberWidth, input.bottomChordHeight);
  const EI_top = getEI(input.timberWidth, input.topChordHeight);
  const memberEAs = geometry.members.map((m) =>
    m.group === "topChord" ? EA_top : EA_bottom,
  );
  const memberEIs = geometry.members.map((m) =>
    m.group === "topChord" ? EI_top : 0,
  );

  // --- ULS: factored loads for strength checks ---
  const ulsLoads = computeLoads(input, true);
  const ulsResult = analyzeTruss(
    geometry,
    ulsLoads,
    memberEAs,
    memberEIs,
    input.jointRotationalStiffness,
  );
  const designChecks = checkMembers(ulsResult.memberResults, input);

  // --- SLS: characteristic loads for deflection check ---
  const slsLoads = computeLoads(input, false);
  const slsResult = analyzeTruss(
    geometry,
    slsLoads,
    memberEAs,
    memberEIs,
    input.jointRotationalStiffness,
  );
  // No bottom chord node at midspan — use max vertical displacement
  // of the two bottom internal nodes (N1 at L/3, N2 at 2L/3).
  // By symmetry they deflect equally; both are ~94% of true midspan value.
  const bottomInternalIds = [1, 2];
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
