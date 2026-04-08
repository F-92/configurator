import { designTruss } from "../app/lib/truss";
import type { TrussInput } from "../app/lib/truss";

type TableCase = {
  snowLoad: number;
  span: number;
  topChordHeight: number;
  bottomChordHeight: number;
};

const TABLE_42_CASES: TableCase[] = [
  { snowLoad: 1.0, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowLoad: 1.0, span: 6, topChordHeight: 120, bottomChordHeight: 120 },
  { snowLoad: 1.0, span: 7, topChordHeight: 145, bottomChordHeight: 120 },
  { snowLoad: 1.0, span: 8, topChordHeight: 145, bottomChordHeight: 145 },
  { snowLoad: 1.0, span: 9, topChordHeight: 170, bottomChordHeight: 145 },
  { snowLoad: 1.0, span: 10, topChordHeight: 195, bottomChordHeight: 170 },
  { snowLoad: 1.0, span: 11, topChordHeight: 195, bottomChordHeight: 195 },
  { snowLoad: 1.0, span: 12, topChordHeight: 195, bottomChordHeight: 195 },
  { snowLoad: 1.5, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowLoad: 1.5, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowLoad: 1.5, span: 7, topChordHeight: 145, bottomChordHeight: 120 },
  { snowLoad: 1.5, span: 8, topChordHeight: 170, bottomChordHeight: 145 },
  { snowLoad: 1.5, span: 9, topChordHeight: 170, bottomChordHeight: 195 },
  { snowLoad: 1.5, span: 10, topChordHeight: 220, bottomChordHeight: 195 },
  { snowLoad: 1.5, span: 11, topChordHeight: 220, bottomChordHeight: 195 },
  { snowLoad: 1.5, span: 12, topChordHeight: 220, bottomChordHeight: 195 },
  { snowLoad: 2.0, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowLoad: 2.0, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowLoad: 2.0, span: 7, topChordHeight: 170, bottomChordHeight: 120 },
  { snowLoad: 2.0, span: 8, topChordHeight: 170, bottomChordHeight: 170 },
  { snowLoad: 2.0, span: 9, topChordHeight: 195, bottomChordHeight: 170 },
  { snowLoad: 2.0, span: 10, topChordHeight: 220, bottomChordHeight: 195 },
  { snowLoad: 2.0, span: 11, topChordHeight: 220, bottomChordHeight: 195 },
  { snowLoad: 2.5, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowLoad: 2.5, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowLoad: 2.5, span: 7, topChordHeight: 170, bottomChordHeight: 120 },
  { snowLoad: 2.5, span: 8, topChordHeight: 170, bottomChordHeight: 170 },
  { snowLoad: 2.5, span: 9, topChordHeight: 195, bottomChordHeight: 170 },
  { snowLoad: 2.5, span: 10, topChordHeight: 220, bottomChordHeight: 220 },
  { snowLoad: 3.0, span: 5, topChordHeight: 145, bottomChordHeight: 120 },
  { snowLoad: 3.0, span: 6, topChordHeight: 170, bottomChordHeight: 120 },
  { snowLoad: 3.0, span: 7, topChordHeight: 170, bottomChordHeight: 170 },
  { snowLoad: 3.0, span: 8, topChordHeight: 195, bottomChordHeight: 195 },
  { snowLoad: 3.0, span: 9, topChordHeight: 220, bottomChordHeight: 220 },
  { snowLoad: 3.5, span: 5, topChordHeight: 145, bottomChordHeight: 145 },
  { snowLoad: 3.5, span: 6, topChordHeight: 170, bottomChordHeight: 145 },
  { snowLoad: 3.5, span: 7, topChordHeight: 195, bottomChordHeight: 145 },
  { snowLoad: 3.5, span: 8, topChordHeight: 220, bottomChordHeight: 220 },
];

type CaseResult = {
  tableCase: TableCase;
  passes: boolean;
  maxUtilization: number;
  deflectionRatio: number;
  governingMember: string;
  governingMode: string;
  governingAxialForce: number;
  governingMoment: number;
};

type SweepResult = {
  jointRotationalStiffness: number;
  passCount: number;
  maxUtilizationError: number;
  worstUtilization: number;
  averageUtilization: number;
};

const BASE_INPUT: Omit<
  TrussInput,
  | "span"
  | "snowLoad"
  | "topChordHeight"
  | "bottomChordHeight"
  | "jointRotationalStiffness"
> = {
  pitch: 14,
  spacing: 1.2,
  deadLoad: 0.9,
  timberWidth: 45,
};

function evaluateCase(
  tableCase: TableCase,
  jointRotationalStiffness: number,
): CaseResult {
  const result = designTruss({
    ...BASE_INPUT,
    ...tableCase,
    jointRotationalStiffness,
  });

  return {
    tableCase,
    passes: result.allPass,
    maxUtilization: result.maxUtilization,
    deflectionRatio: result.midspanDeflection / result.deflectionLimit,
    governingMember:
      result.designChecks.find(
        (check) => check.utilization === result.maxUtilization,
      )?.label ?? "?",
    governingMode:
      result.designChecks.find(
        (check) => check.utilization === result.maxUtilization,
      )?.mode ?? "?",
    governingAxialForce:
      result.designChecks.find(
        (check) => check.utilization === result.maxUtilization,
      )?.axialForce ?? 0,
    governingMoment:
      result.designChecks.find(
        (check) => check.utilization === result.maxUtilization,
      )?.bendingMoment ?? 0,
  };
}

function evaluateSweep(jointRotationalStiffness: number): SweepResult {
  const results = TABLE_42_CASES.map((tableCase) =>
    evaluateCase(tableCase, jointRotationalStiffness),
  );

  const passCount = results.filter((result) => result.passes).length;
  const maxUtilizationError = results.reduce(
    (sum, result) => sum + Math.max(result.maxUtilization - 1, 0),
    0,
  );
  const worstUtilization = Math.max(
    ...results.map((result) => result.maxUtilization),
  );
  const averageUtilization =
    results.reduce((sum, result) => sum + result.maxUtilization, 0) /
    results.length;

  return {
    jointRotationalStiffness,
    passCount,
    maxUtilizationError,
    worstUtilization,
    averageUtilization,
  };
}

function sortSweepResults(left: SweepResult, right: SweepResult): number {
  if (left.passCount !== right.passCount) {
    return right.passCount - left.passCount;
  }
  if (left.maxUtilizationError !== right.maxUtilizationError) {
    return left.maxUtilizationError - right.maxUtilizationError;
  }
  return left.averageUtilization - right.averageUtilization;
}

function formatCase(result: CaseResult): string {
  const { tableCase } = result;
  return [
    `snow=${tableCase.snowLoad.toFixed(1)}`,
    `span=${tableCase.span.toFixed(0)}`,
    `table=${tableCase.topChordHeight}/${tableCase.bottomChordHeight}`,
    `util=${result.maxUtilization.toFixed(3)}`,
    `member=${result.governingMember}`,
    `mode=${result.governingMode}`,
    `N=${result.governingAxialForce.toFixed(1)}kN`,
    `M=${result.governingMoment.toFixed(2)}kNm`,
    `defl=${result.deflectionRatio.toFixed(3)}L/300`,
    result.passes ? "PASS" : "FAIL",
  ].join("  ");
}

const sweepValues: number[] = [];
for (let stiffness = 0; stiffness <= 1000; stiffness += 25) {
  sweepValues.push(stiffness);
}

const ranked = sweepValues.map(evaluateSweep).sort(sortSweepResults);
const best = ranked[0];
const worstCases = TABLE_42_CASES.map((tableCase) =>
  evaluateCase(tableCase, best.jointRotationalStiffness),
)
  .filter((result) => !result.passes)
  .sort((left, right) => right.maxUtilization - left.maxUtilization)
  .slice(0, 10);

console.log("TräGuiden Tabell 4.2 calibration sweep");
console.log("-----------------------------------");
console.log(`cases: ${TABLE_42_CASES.length}`);
console.log();
console.log("Top 10 spring stiffness values:");
for (const entry of ranked.slice(0, 10)) {
  console.log(
    [
      `kθ=${entry.jointRotationalStiffness.toFixed(0)} kNm/rad`,
      `pass=${entry.passCount}/${TABLE_42_CASES.length}`,
      `excess=${entry.maxUtilizationError.toFixed(3)}`,
      `avgUtil=${entry.averageUtilization.toFixed(3)}`,
      `worstUtil=${entry.worstUtilization.toFixed(3)}`,
    ].join("  "),
  );
}

console.log();
console.log(
  `Best tested kθ in the current model = ${best.jointRotationalStiffness.toFixed(0)} kNm/rad`,
);
if (best.passCount < TABLE_42_CASES.length / 2) {
  console.log(
    "Note: the low pass rate indicates the remaining mismatch is dominated by geometry/detail assumptions, not just joint stiffness.",
  );
}
console.log();
console.log("Worst failing cases at recommended stiffness:");
for (const result of worstCases) {
  console.log(formatCase(result));
}
