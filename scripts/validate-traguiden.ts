/**
 * Validate truss calculations against TräGuiden Takstolshandboken §4.2.2 tables.
 *
 * Key reference parameters from the tables:
 * - W-takstol (Fink truss)
 * - C24 timber, 45 mm width
 * - 1200 mm c/c spacing
 * - "tungt yttertak" (heavy roof) = 0.9 kN/m² on slope
 * - Snözon = s_k (ground snow load characteristic value)
 *   → Roof snow: s = μ₁ · Ce · Ct · s_k
 *   → μ₁ = 0.8 for pitch ≤30°, Ce = Ct = 1.0
 * - Deflection limit L/300
 */

import { designTruss } from "../app/lib/truss";
import type { TrussInput, TrussDesignResult } from "../app/lib/truss";

// ─── Table data from TräGuiden ───────────────────────────────────────────────

type TableEntry = {
  snowZone: number; // s_k (kN/m² ground)
  span: number; // metres
  topChordHeight: number; // mm (Ö)
  bottomChordHeight: number; // mm (U)
};

// Table 4.2: pitch 1:4 (14°), tungt yttertak 0.9 kN/m²
const TABLE_42: TableEntry[] = [
  // snow zone 1.0
  { snowZone: 1.0, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 6, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 7, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 8, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 1.0, span: 9, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 1.0, span: 10, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 1.0, span: 11, topChordHeight: 195, bottomChordHeight: 195 },
  { snowZone: 1.0, span: 12, topChordHeight: 195, bottomChordHeight: 195 },
  // snow zone 1.5
  { snowZone: 1.5, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 7, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 8, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 1.5, span: 9, topChordHeight: 170, bottomChordHeight: 195 },
  { snowZone: 1.5, span: 10, topChordHeight: 220, bottomChordHeight: 195 },
  { snowZone: 1.5, span: 11, topChordHeight: 220, bottomChordHeight: 195 },
  { snowZone: 1.5, span: 12, topChordHeight: 220, bottomChordHeight: 195 },
  // snow zone 2.0
  { snowZone: 2.0, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 2.0, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 2.0, span: 7, topChordHeight: 170, bottomChordHeight: 120 },
  { snowZone: 2.0, span: 8, topChordHeight: 170, bottomChordHeight: 170 },
  { snowZone: 2.0, span: 9, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 2.0, span: 10, topChordHeight: 220, bottomChordHeight: 195 },
  { snowZone: 2.0, span: 11, topChordHeight: 220, bottomChordHeight: 195 },
  // snow zone 2.5
  { snowZone: 2.5, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 2.5, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 2.5, span: 7, topChordHeight: 170, bottomChordHeight: 120 },
  { snowZone: 2.5, span: 8, topChordHeight: 170, bottomChordHeight: 170 },
  { snowZone: 2.5, span: 9, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 2.5, span: 10, topChordHeight: 220, bottomChordHeight: 220 },
  // snow zone 3.0
  { snowZone: 3.0, span: 5, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 3.0, span: 6, topChordHeight: 170, bottomChordHeight: 120 },
  { snowZone: 3.0, span: 7, topChordHeight: 170, bottomChordHeight: 170 },
  { snowZone: 3.0, span: 8, topChordHeight: 195, bottomChordHeight: 195 },
  { snowZone: 3.0, span: 9, topChordHeight: 220, bottomChordHeight: 220 },
  // snow zone 3.5
  { snowZone: 3.5, span: 5, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 3.5, span: 6, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 3.5, span: 7, topChordHeight: 195, bottomChordHeight: 145 },
  { snowZone: 3.5, span: 8, topChordHeight: 220, bottomChordHeight: 220 },
];

// Table 4.3: pitch 1:2 (27°), tungt yttertak 0.9 kN/m²
const TABLE_43: TableEntry[] = [
  // snow zone 1.0
  { snowZone: 1.0, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 6, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 7, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 8, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 9, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.0, span: 10, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 1.0, span: 11, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 1.0, span: 12, topChordHeight: 170, bottomChordHeight: 145 },
  // snow zone 1.5
  { snowZone: 1.5, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 6, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 7, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 8, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 1.5, span: 9, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 1.5, span: 10, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 1.5, span: 11, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 1.5, span: 12, topChordHeight: 170, bottomChordHeight: 145 },
  // snow zone 2.0
  { snowZone: 2.0, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 2.0, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 2.0, span: 7, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 2.0, span: 8, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 2.0, span: 9, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 2.0, span: 10, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 2.0, span: 11, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 2.0, span: 12, topChordHeight: 195, bottomChordHeight: 170 },
  // snow zone 2.5
  { snowZone: 2.5, span: 5, topChordHeight: 120, bottomChordHeight: 120 },
  { snowZone: 2.5, span: 6, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 2.5, span: 7, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 2.5, span: 8, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 2.5, span: 9, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 2.5, span: 10, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 2.5, span: 11, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 2.5, span: 12, topChordHeight: 195, bottomChordHeight: 170 },
  // snow zone 3.0
  { snowZone: 3.0, span: 5, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 3.0, span: 6, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 3.0, span: 7, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 3.0, span: 8, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 3.0, span: 9, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 3.0, span: 10, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 3.0, span: 11, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 3.0, span: 12, topChordHeight: 220, bottomChordHeight: 220 },
  // snow zone 3.5
  { snowZone: 3.5, span: 5, topChordHeight: 145, bottomChordHeight: 120 },
  { snowZone: 3.5, span: 6, topChordHeight: 145, bottomChordHeight: 145 },
  { snowZone: 3.5, span: 7, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 3.5, span: 8, topChordHeight: 170, bottomChordHeight: 145 },
  { snowZone: 3.5, span: 9, topChordHeight: 170, bottomChordHeight: 170 },
  { snowZone: 3.5, span: 10, topChordHeight: 195, bottomChordHeight: 170 },
  { snowZone: 3.5, span: 11, topChordHeight: 220, bottomChordHeight: 195 },
  { snowZone: 3.5, span: 12, topChordHeight: 245, bottomChordHeight: 245 },
];

// ─── Snow load shape coefficient ─────────────────────────────────────────────

/** EC1991-1-3 shape coefficient μ₁ */
function snowShapeFactor(pitchDeg: number): number {
  if (pitchDeg <= 30) return 0.8;
  if (pitchDeg >= 60) return 0.0;
  return (0.8 * (60 - pitchDeg)) / 30;
}

// ─── Run one case ────────────────────────────────────────────────────────────

type CaseResult = {
  entry: TableEntry;
  pitchDeg: number;
  roofSnowLoad: number;
  result: TrussDesignResult;
  maxUtil: number;
  deflMm: number;
  deflLimit: number;
  pass: boolean;
  governingLabel: string;
  governingMode: string;
  governingN: number;
  governingM: number;
};

function runCase(
  entry: TableEntry,
  pitchDeg: number,
  jointStiffness: number,
  applyMu1: boolean,
  mode: "full_frame" | "traguiden" = "full_frame",
): CaseResult {
  const mu1 = applyMu1 ? snowShapeFactor(pitchDeg) : 1.0;
  const roofSnowLoad = mu1 * entry.snowZone;

  const input: TrussInput = {
    mode,
    span: entry.span,
    pitch: pitchDeg,
    spacing: 1.2,
    deadLoad: 0.9,
    snowLoad: roofSnowLoad,
    jointRotationalStiffness: jointStiffness,
    timberWidth: 45,
    topChordHeight: entry.topChordHeight,
    bottomChordHeight: entry.bottomChordHeight,
  };

  const result = designTruss(input);
  const governing = result.designChecks.reduce((worst, c) =>
    c.utilization > worst.utilization ? c : worst,
  );

  return {
    entry,
    pitchDeg,
    roofSnowLoad,
    result,
    maxUtil: result.maxUtilization,
    deflMm: result.midspanDeflection,
    deflLimit: result.deflectionLimit,
    pass: result.allPass,
    governingLabel: governing.label,
    governingMode: governing.mode,
    governingN: governing.axialForce,
    governingM: governing.bendingMoment,
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function pad(s: string, n: number): string {
  return s.padEnd(n);
}
function rpad(s: string, n: number): string {
  return s.padStart(n);
}

function formatCaseRow(c: CaseResult): string {
  return [
    rpad(c.entry.snowZone.toFixed(1), 4),
    rpad(c.entry.span.toString(), 3),
    rpad(`${c.entry.topChordHeight}/${c.entry.bottomChordHeight}`, 7),
    rpad(c.roofSnowLoad.toFixed(2), 5),
    rpad(c.maxUtil.toFixed(3), 6),
    pad(c.governingLabel, 5),
    pad(c.governingMode, 11),
    rpad(c.governingN.toFixed(1), 7),
    rpad(c.governingM.toFixed(2), 6),
    rpad(c.deflMm.toFixed(1), 6),
    rpad(c.deflLimit.toFixed(1), 6),
    c.pass ? "PASS" : "FAIL",
  ].join("  ");
}

function printHeader(): void {
  const hdr = [
    rpad("s_k", 4),
    rpad("L", 3),
    rpad("Ö/U", 7),
    rpad("s_r", 5),
    rpad("util", 6),
    pad("memb", 5),
    pad("mode", 11),
    rpad("N(kN)", 7),
    rpad("M(kNm)", 6),
    rpad("δ(mm)", 6),
    rpad("δ_lim", 6),
    "status",
  ].join("  ");
  console.log(hdr);
  console.log("-".repeat(hdr.length));
}

// ─── Main ────────────────────────────────────────────────────────────────────

function analyzeTable(
  label: string,
  table: TableEntry[],
  pitchDeg: number,
  jointStiffness: number,
  applyMu1: boolean,
  mode: "full_frame" | "traguiden" = "full_frame",
): CaseResult[] {
  console.log(`\n${"=".repeat(80)}`);
  console.log(
    `${label} — pitch ${pitchDeg}°, kθ=${jointStiffness} kNm/rad, μ₁=${applyMu1 ? snowShapeFactor(pitchDeg).toFixed(1) : "1.0 (off)"}`,
  );
  console.log("=".repeat(80));
  printHeader();

  const results = table.map((entry) =>
    runCase(entry, pitchDeg, jointStiffness, applyMu1, mode),
  );
  for (const r of results) {
    console.log(formatCaseRow(r));
  }

  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  const avgUtil = results.reduce((s, r) => s + r.maxUtil, 0) / results.length;
  const maxUtil = Math.max(...results.map((r) => r.maxUtil));

  console.log();
  console.log(
    `Summary: ${passCount}/${results.length} pass, ${failCount} fail, avg util=${avgUtil.toFixed(3)}, max util=${maxUtil.toFixed(3)}`,
  );

  return results;
}

// ─── Run all scenarios ───────────────────────────────────────────────────────

console.log("TräGuiden §4.2.2 validation — comparing model vs table data");
console.log("============================================================");

// Scenario 1: Current model (no μ₁, kθ=0)
analyzeTable("Table 4.2 — CURRENT MODEL (no μ₁, kθ=0)", TABLE_42, 14, 0, false);

// Scenario 2: With μ₁ applied (kθ=0)
analyzeTable("Table 4.2 — WITH μ₁=0.8, kθ=0", TABLE_42, 14, 0, true);

// Scenario 3: With μ₁ and high joint stiffness
analyzeTable("Table 4.2 — WITH μ₁=0.8, kθ=5000", TABLE_42, 14, 5000, true);

// Scenario 4: With μ₁ and very high joint stiffness (near-rigid)
analyzeTable("Table 4.2 — WITH μ₁=0.8, kθ=50000", TABLE_42, 14, 50000, true);

// Scenario 5: Table 4.3 (27° pitch) with μ₁ and high stiffness
analyzeTable("Table 4.3 — WITH μ₁=0.8, kθ=50000", TABLE_43, 27, 50000, true);

// Scenario 6: TräGuiden mode (pure truss, no bending, kθ=0, 4 panels)
analyzeTable(
  "Table 4.2 — TRAGUIDEN MODE, μ₁=0.8",
  TABLE_42,
  14,
  0,
  true,
  "traguiden",
);

// Scenario 7: TräGuiden mode for Table 4.3
analyzeTable(
  "Table 4.3 — TRAGUIDEN MODE, μ₁=0.8",
  TABLE_43,
  27,
  0,
  true,
  "traguiden",
);

// ─── Stiffness sensitivity for a target case ─────────────────────────────────

console.log("\n" + "=".repeat(80));
console.log(
  "Joint stiffness sensitivity — Table 4.2, snow 2.5, span 8m, 170/170",
);
console.log("=".repeat(80));

const targetEntry = TABLE_42.find((e) => e.snowZone === 2.5 && e.span === 8)!;

for (const kTheta of [
  0, 100, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000,
]) {
  const r = runCase(targetEntry, 14, kTheta, true);
  console.log(
    `kθ=${rpad(kTheta.toString(), 6)}  util=${r.maxUtil.toFixed(3)}  ${r.governingLabel}  ${r.governingMode}  N=${r.governingN.toFixed(1)}kN  M=${r.governingM.toFixed(2)}kNm  δ=${r.deflMm.toFixed(1)}mm  ${r.pass ? "PASS" : "FAIL"}`,
  );
}
