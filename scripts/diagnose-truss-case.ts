import {
  analyzeTruss,
  checkMembers,
  computeLoads,
  getEA,
  getEI,
} from "../app/lib/truss";
import type { TrussGeometry, TrussInput } from "../app/lib/truss";

type ScenarioResult = {
  label: string;
  maxUtilization: number;
  governingLabel: string;
  governingMode: string;
  governingAxialForce: number;
  governingMoment: number;
};

const BASE_CASE: TrussInput = {
  mode: "full_frame",
  span: 8,
  pitch: 14,
  spacing: 1.2,
  deadLoad: 0.9,
  snowLoad: 2.5,
  jointRotationalStiffness: 0,
  timberWidth: 45,
  topChordHeight: 170,
  bottomChordHeight: 170,
};

function buildParameterizedGeometry(
  span: number,
  pitchDeg: number,
  topJointFactor: number,
): TrussGeometry {
  const pitchRad = (pitchDeg * Math.PI) / 180;
  const heightAt = (x: number) => {
    const halfSpan = span / 2;
    return x <= halfSpan
      ? x * Math.tan(pitchRad)
      : (span - x) * Math.tan(pitchRad);
  };

  const leftTopX = span * topJointFactor;
  const rightTopX = span * (1 - topJointFactor);

  return {
    nodes: [
      { id: 0, x: 0, y: 0, label: "A (left support)" },
      { id: 1, x: span / 3, y: 0, label: "B (⅓ span)" },
      { id: 2, x: (2 * span) / 3, y: 0, label: "C (⅔ span)" },
      { id: 3, x: span, y: 0, label: "D (right support)" },
      {
        id: 4,
        x: leftTopX,
        y: heightAt(leftTopX),
        label: "E (left top joint)",
      },
      { id: 5, x: span / 2, y: heightAt(span / 2), label: "F (ridge)" },
      {
        id: 6,
        x: rightTopX,
        y: heightAt(rightTopX),
        label: "G (right top joint)",
      },
    ],
    members: [
      {
        id: 0,
        startNodeId: 0,
        endNodeId: 1,
        label: "BC-1",
        group: "bottomChord",
      },
      {
        id: 1,
        startNodeId: 1,
        endNodeId: 2,
        label: "BC-2",
        group: "bottomChord",
      },
      {
        id: 2,
        startNodeId: 2,
        endNodeId: 3,
        label: "BC-3",
        group: "bottomChord",
      },
      { id: 3, startNodeId: 0, endNodeId: 4, label: "TC-1", group: "topChord" },
      { id: 4, startNodeId: 4, endNodeId: 5, label: "TC-2", group: "topChord" },
      { id: 5, startNodeId: 5, endNodeId: 6, label: "TC-3", group: "topChord" },
      { id: 6, startNodeId: 6, endNodeId: 3, label: "TC-4", group: "topChord" },
      { id: 7, startNodeId: 4, endNodeId: 1, label: "W-1", group: "web" },
      { id: 8, startNodeId: 1, endNodeId: 5, label: "W-2", group: "web" },
      { id: 9, startNodeId: 5, endNodeId: 2, label: "W-3", group: "web" },
      { id: 10, startNodeId: 2, endNodeId: 6, label: "W-4", group: "web" },
    ],
    supports: [
      { nodeId: 0, type: "pinned" },
      { nodeId: 3, type: "roller" },
    ],
  };
}

function runScenario(
  input: TrussInput,
  geometry: TrussGeometry,
  label: string,
): ScenarioResult {
  const EA_top = getEA(input.timberWidth, input.topChordHeight);
  const EA_bottom = getEA(input.timberWidth, input.bottomChordHeight);
  const EI_top = getEI(input.timberWidth, input.topChordHeight);
  const memberEAs = geometry.members.map((member) =>
    member.group === "topChord" ? EA_top : EA_bottom,
  );
  const memberEIs = geometry.members.map((member) =>
    member.group === "topChord" ? EI_top : 0,
  );

  const ulsLoads = computeLoads(input, geometry, true);
  const analysis = analyzeTruss(
    geometry,
    ulsLoads,
    memberEAs,
    memberEIs,
    input.jointRotationalStiffness,
  );
  const checks = checkMembers(analysis.memberResults, input);
  const governing = checks.reduce((worst, check) =>
    check.utilization > worst.utilization ? check : worst,
  );

  return {
    label,
    maxUtilization: governing.utilization,
    governingLabel: governing.label,
    governingMode: governing.mode,
    governingAxialForce: governing.axialForce,
    governingMoment: governing.bendingMoment,
  };
}

function formatScenario(result: ScenarioResult): string {
  return [
    result.label,
    `util=${result.maxUtilization.toFixed(3)}`,
    `member=${result.governingLabel}`,
    `mode=${result.governingMode}`,
    `N=${result.governingAxialForce.toFixed(1)}kN`,
    `M=${result.governingMoment.toFixed(2)}kNm`,
  ].join("  ");
}

function summarizeRange(results: ScenarioResult[]): string {
  const values = results.map((result) => result.maxUtilization);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return `range=${min.toFixed(3)}..${max.toFixed(3)}  spread=${(max - min).toFixed(3)}`;
}

const baseGeometry = buildParameterizedGeometry(
  BASE_CASE.span,
  BASE_CASE.pitch,
  0.25,
);
const stiffnessScenarios = [0, 50, 200, 1000].map((stiffness) =>
  runScenario(
    { ...BASE_CASE, jointRotationalStiffness: stiffness },
    baseGeometry,
    `kθ=${stiffness.toFixed(0)} with topJointFactor=0.25`,
  ),
);

const geometryScenarios = [0.22, 0.25, 0.28, 1 / 3].map((topJointFactor) =>
  runScenario(
    { ...BASE_CASE, jointRotationalStiffness: 0 },
    buildParameterizedGeometry(BASE_CASE.span, BASE_CASE.pitch, topJointFactor),
    `topJointFactor=${topJointFactor.toFixed(3)} with kθ=0`,
  ),
);

console.log("Representative failing case diagnostic");
console.log("------------------------------------");
console.log(
  "Case: TräGuiden Tabell 4.2, snow 2.5 kN/m², span 8 m, table size 170/170, pitch 14°, spacing 1.2 m, C24, 45 mm width.",
);
console.log();
console.log("Joint-stiffness sensitivity with fixed current geometry:");
for (const result of stiffnessScenarios) {
  console.log(formatScenario(result));
}
console.log(summarizeRange(stiffnessScenarios));
console.log();
console.log(
  "Top-panel geometry sensitivity with pinned top-chord joints (kθ=0):",
);
for (const result of geometryScenarios) {
  console.log(formatScenario(result));
}
console.log(summarizeRange(geometryScenarios));
console.log();

const stiffnessSpread =
  Math.max(...stiffnessScenarios.map((result) => result.maxUtilization)) -
  Math.min(...stiffnessScenarios.map((result) => result.maxUtilization));
const geometrySpread =
  Math.max(...geometryScenarios.map((result) => result.maxUtilization)) -
  Math.min(...geometryScenarios.map((result) => result.maxUtilization));

console.log(
  geometrySpread > stiffnessSpread
    ? "Conclusion: this case is more sensitive to top-panel geometry than to the tested joint-stiffness range."
    : "Conclusion: this case is more sensitive to joint stiffness than to the tested top-panel geometry range.",
);
