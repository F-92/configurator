"use client";

import type { TrussInput, TrussDesignResult } from "../../lib/truss/types";

interface TrussResultsProps {
  input: TrussInput;
  result: TrussDesignResult;
  topChordSize: string;
  bottomChordSize: string;
}

function utilizationBarColor(u: number): string {
  if (u <= 0.5) return "bg-green-500";
  if (u <= 0.75) return "bg-yellow-500";
  if (u <= 1.0) return "bg-orange-500";
  return "bg-red-500";
}

export default function TrussResults({
  input,
  result,
  topChordSize,
  bottomChordSize,
}: TrussResultsProps) {
  const {
    designChecks,
    totalTimberLength,
    maxUtilization,
    allPass,
    midspanDeflection,
    deflectionLimit,
    deflectionPass,
  } = result;

  const pitchRad = (input.pitch * Math.PI) / 180;
  const deadLineLoad = input.deadLoad * input.spacing;
  const snowLineLoad = input.snowLoad * input.spacing;
  const ulsLineLoad = 1.35 * deadLineLoad + 1.5 * snowLineLoad;
  const slsLineLoad = deadLineLoad + snowLineLoad;
  const halfSlopeLength = input.span / 2 / Math.cos(pitchRad);
  const topChordPanelLength = halfSlopeLength / 2;
  const momentCalibration = Math.max(
    0.55,
    Math.min(
      0.85,
      0.85 - 0.06 * (input.span - 5) - 0.15 * (input.snowLoad - 1),
    ),
  );
  const ft_0_d = (1.1 * 0.8 * 14) / 1.3;
  const fc_0_d = (1.1 * 0.8 * 21) / 1.3;
  const fm_d = (1.1 * 0.8 * 24) / 1.3;
  const governingCheck = [...designChecks].sort(
    (left, right) => right.utilization - left.utilization,
  )[0];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="text-xs text-zinc-500">Status</div>
          <div
            className={`text-lg font-bold ${allPass ? "text-green-400" : "text-red-400"}`}
          >
            {allPass ? "✓ OK" : "✗ FAIL"}
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="text-xs text-zinc-500">Max utilization</div>
          <div className="text-lg font-bold text-zinc-200">
            {(maxUtilization * 100).toFixed(0)}%
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="text-xs text-zinc-500">Deflection (SLS)</div>
          <div
            className={`text-lg font-bold ${deflectionPass ? "text-zinc-200" : "text-red-400"}`}
          >
            {midspanDeflection.toFixed(1)} mm
          </div>
          <div className="text-xs text-zinc-600">
            limit {deflectionLimit.toFixed(0)} mm (L/300)
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
          <div className="text-xs text-zinc-500">Timber</div>
          <div className="text-sm font-bold text-zinc-200 mt-0.5">
            Ö {topChordSize}
          </div>
          <div className="text-sm font-bold text-zinc-200">
            U {bottomChordSize}
          </div>
          <div className="text-xs text-zinc-600">
            {totalTimberLength.toFixed(1)} m total
          </div>
        </div>
      </div>

      {/* Member table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-800">
              <th className="pb-2 pr-3">Member</th>
              <th className="pb-2 pr-3">Group</th>
              <th className="pb-2 pr-3 text-right">Length (m)</th>
              <th className="pb-2 pr-3 text-right">Force (kN)</th>
              <th className="pb-2 pr-3 text-right">M (kNm)</th>
              <th className="pb-2 pr-3">Mode</th>
              <th className="pb-2 pr-3">Utilization</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {designChecks.map((c) => (
              <tr
                key={c.memberId}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
              >
                <td className="py-1.5 pr-3 font-mono text-zinc-300">
                  {c.label}
                </td>
                <td className="py-1.5 pr-3 text-zinc-500 text-xs">
                  {c.group === "topChord"
                    ? "Top chord"
                    : c.group === "bottomChord"
                      ? "Bottom chord"
                      : "Web"}
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-400">
                  {result.memberResults
                    .find((m) => m.memberId === c.memberId)
                    ?.length.toFixed(2)}
                </td>
                <td
                  className={`py-1.5 pr-3 text-right font-mono ${
                    c.axialForce >= 0 ? "text-blue-400" : "text-amber-400"
                  }`}
                >
                  {c.axialForce >= 0 ? "+" : ""}
                  {c.axialForce.toFixed(1)}
                </td>
                <td className="py-1.5 pr-3 text-right text-zinc-400 font-mono">
                  {c.bendingMoment > 0 ? c.bendingMoment.toFixed(2) : "—"}
                </td>
                <td className="py-1.5 pr-3 text-xs text-zinc-500">
                  {c.mode === "combined" ? "N+M" : c.mode}
                  {c.buckling ? " ⚠" : ""}
                </td>
                <td className="py-1.5 pr-3 w-32">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${utilizationBarColor(c.utilization)}`}
                        style={{
                          width: `${Math.min(c.utilization * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500 w-8 text-right">
                      {(c.utilization * 100).toFixed(0)}%
                    </span>
                  </div>
                </td>
                <td className="py-1.5 text-center">
                  {c.pass ? (
                    <span className="text-green-500">✓</span>
                  ) : (
                    <span className="text-red-500">✗</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">
        ULS: 1.35G + 1.5Q · SLS: L/300 · EC5 (EN 1995) · C24 (EN 338) · γ_M=1.3
        · k_mod=0.8 (medium-term, SC1/2) · Top chord: N+M combined (§6.3.2) ·
        global analysis assumes pin joints, with top chord bending introduced
        separately by an engineering approximation fitted to TräGuiden tabell
        4.2
      </p>

      <section className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Engineering Calculation Notes
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            This section describes exactly what the current model does so an
            engineer can review the assumptions, reproduce the formulas, and
            challenge any part of the implementation.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              1. Geometry Model
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>Type: symmetric W-fackverksstol / Fink truss.</p>
              <p>Nodes: 7 total, with bottom chord nodes at 0, L/3, 2L/3, L.</p>
              <p>
                Top chord nodes: left rafter midpoint at L/4, ridge at L/2,
                right rafter midpoint at 3L/4.
              </p>
              <p>
                Web system: 4 diagonals, no king post, no vertical web at
                midspan.
              </p>
              <p>Support model: left pinned, right roller.</p>
              <p>
                Truss rise: h = (span / 2) × tan(pitch) ={" "}
                {((input.span / 2) * Math.tan(pitchRad)).toFixed(3)} m.
              </p>
              <p>
                Top chord panel length used for load distribution:{" "}
                {topChordPanelLength.toFixed(3)} m.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              2. Load Conversion
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>Dead load is treated as acting on roof slope surface.</p>
              <p>
                Snow load is treated as acting on horizontal projection and is
                not reduced by cos(pitch).
              </p>
              <p>Pitch = {input.pitch.toFixed(1)}°.</p>
              <p>
                Dead line load on rafter: g = deadLoad × spacing ={" "}
                {input.deadLoad.toFixed(3)} × {input.spacing.toFixed(3)} ={" "}
                {deadLineLoad.toFixed(3)} kN/m.
              </p>
              <p>
                Snow line load: q = snowLoad × spacing ={" "}
                {input.snowLoad.toFixed(3)} × {input.spacing.toFixed(3)} ={" "}
                {snowLineLoad.toFixed(3)} kN/m.
              </p>
              <p>
                ULS line load: 1.35g + 1.5q = {ulsLineLoad.toFixed(3)} kN/m.
              </p>
              <p>SLS line load: g + q = {slsLineLoad.toFixed(3)} kN/m.</p>
              <p>
                Each rafter half-span is discretized into two loaded top chord
                panels, and the distributed load is converted to joint loads at
                support, mid-rafter, ridge, and symmetric right-side nodes.
              </p>
              <p>
                Tributary lengths differ by load type: dead load uses
                slope-based segment lengths ({topChordPanelLength.toFixed(3)}{" "}
                m), while snow load uses horizontal-projection segment lengths (
                {(input.span / 4).toFixed(3)} m). Support nodes receive
                half-tributary; interior top chord nodes receive full tributary
                from adjacent panels.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              3. Structural Analysis
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>Analysis method: 2D direct stiffness method.</p>
              <p>
                Each member is axial-only. No bending stiffness is included in
                the truss solver itself.
              </p>
              <p>
                Global analysis assumes pin joints; bending effects are added
                later as a separate design step for the top chord.
              </p>
              <p>Degrees of freedom: 2 per node (horizontal and vertical).</p>
              <p>
                Boundary conditions are enforced by row and column elimination,
                not a penalty spring.
              </p>
              <p>
                Member stiffness: EA/L, with E = 11 000 MPa (E0,mean).
                Cross-section areas differ by group: top chord uses{" "}
                {input.timberWidth} × {input.topChordHeight} mm, bottom chord
                and web members use {input.timberWidth} ×{" "}
                {input.bottomChordHeight} mm.
              </p>
              <p>
                Member forces reported in the table are ULS axial forces from
                the stiffness analysis.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              4. Material and Design Values
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>Timber class: C24.</p>
              <p>
                Characteristic strengths: fm,k = 24 MPa, ft,0,k = 14 MPa, fc,0,k
                = 21 MPa.
              </p>
              <p>
                Mean modulus: E0,mean = 11 000 MPa. Fifth percentile modulus:
                E0,05 = 7 400 MPa.
              </p>
              <p>Design factors used: γM = 1.3, kmod = 0.8, ksys = 1.1.</p>
              <p>
                Derived design tension strength: ft,0,d = {ft_0_d.toFixed(2)}{" "}
                MPa.
              </p>
              <p>
                Derived design compression strength: fc,0,d ={" "}
                {fc_0_d.toFixed(2)} MPa.
              </p>
              <p>
                Derived design bending strength: fm,d = {fm_d.toFixed(2)} MPa.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              5. Member Checks
            </h3>
            <div className="mt-2 space-y-2 text-xs leading-5 text-zinc-400">
              <p>Tension members: utilization = N / (ft,0,d × A).</p>
              <p>
                Compression members: utilization = N / (kc × fc,0,d × A), where
                kc is the EC5 §6.3.2 instability factor.
              </p>
              <p>
                Relative slenderness: λ_rel = (λ / π) × √(fc,0,k / E0,05), with
                βc = 0.2 (solid timber).
              </p>
              <p>
                Web members use in-plane buckling only (out-of-plane restraint
                assumed from nail-plate connections). Bottom chord compression,
                if it occurs, uses the minimum of in-plane and out-of-plane kc.
              </p>
              <p>
                Top chord members are checked as combined compression + bending
                using EC5 eq. 6.23 and 6.24:
              </p>
              <p className="font-mono text-zinc-300">
                util_6.23 = σc / (kc,y × fc,0,d) + σm / fm,d
              </p>
              <p className="font-mono text-zinc-300">
                util_6.24 = σc / (kc,z × fc,0,d) + km × σm / fm,d
              </p>
              <p>
                Governing top chord utilization = max(util_6.23, util_6.24),
                with km = 0.7 and assumed top chord lateral bracing spacing 0.6
                m.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              6. Top Chord Bending Approximation
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>
                Base panel moment assumption: M = 9wL² / 128 for an ideal
                two-span continuous beam under uniform load.
              </p>
              <p>
                The actual truss model is not that beam system, so this moment
                is not derived directly from the global stiffness analysis.
              </p>
              <p>
                Instead, the tool uses a separate engineering approximation
                fitted to TräGuiden tabell 4.2 to estimate top chord bending for
                nail-plated W-trusses.
              </p>
              <p className="font-mono text-zinc-300">
                calibration = clamp(0.85 - 0.06 × (span - 5) - 0.15 × (snowLoad
                - 1), 0.55, 0.85)
              </p>
              <p>Current calibration factor: {momentCalibration.toFixed(3)}.</p>
              <p className="font-mono text-zinc-300">
                M_top = calibration × 9 × wULS × Lpanel² / 128
              </p>
              <p>
                This term is not code-based and not physically derived from an
                explicit semi-rigid joint model. It is an engineering
                approximation fitted to TräGuiden data.
              </p>
              <p>
                For formal engineering review, a better model would either: use
                beam elements with rotational spring stiffness in the top chord
                joints, or skip moment estimation and rely on axial checks with
                explicit restraint and buckling assumptions.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              7. Deflection Check
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>SLS uses unfactored load combination g + q.</p>
              <p>
                Reported deflection is the maximum of the two bottom internal
                nodes at L/3 and 2L/3.
              </p>
              <p>
                Current result: {midspanDeflection.toFixed(1)} mm against limit{" "}
                {deflectionLimit.toFixed(1)} mm.
              </p>
              <p>
                Acceptance criterion: L/300, so this case is{" "}
                {deflectionPass ? "within" : "outside"} the serviceability
                limit.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              8. Current Limits and Audit Warning
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-amber-100/80">
              <p>
                The tool does not model semi-rigid nail-plate joint stiffness
                explicitly.
              </p>
              <p>
                Geometry is fixed to one 7-node W-truss arrangement and does not
                currently vary panel count with span or timber stock.
              </p>
              <p>
                TräGuiden states the tabulated trusses are approximate and can
                vary with nail-plate size and manufacturer layout.
              </p>
              <p>
                Governing member in this result: {governingCheck.label} (
                {governingCheck.group}) at{" "}
                {(governingCheck.utilization * 100).toFixed(0)}% utilization.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
