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
    memberResults,
  } = result;

  const pitchRad = (input.pitch * Math.PI) / 180;
  const deadLineLoad = input.deadLoad * input.spacing;
  const snowLineLoad = input.snowLoad * input.spacing;
  const ulsVerticalLineLoad =
    1.35 * deadLineLoad + 1.5 * snowLineLoad * Math.cos(pitchRad);
  const slsVerticalLineLoad = deadLineLoad + snowLineLoad * Math.cos(pitchRad);
  const halfSlopeLength = input.span / 2 / Math.cos(pitchRad);
  const topChordPanelLength = halfSlopeLength / 2;
  const localAxialLoad = -ulsVerticalLineLoad * Math.sin(pitchRad);
  const localTransverseLoad = -ulsVerticalLineLoad * Math.cos(pitchRad);
  const ft_0_d = (1.1 * 0.8 * 14) / 1.3;
  const fc_0_d = (1.1 * 0.8 * 21) / 1.3;
  const fm_d = (1.1 * 0.8 * 24) / 1.3;
  const governingCheck = [...designChecks].sort(
    (left, right) => right.utilization - left.utilization,
  )[0];
  const governingMomentMember = [...memberResults].sort(
    (left, right) => right.maxAbsMoment - left.maxAbsMoment,
  )[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
          <div className="text-xs text-zinc-500">Status</div>
          <div
            className={`text-lg font-bold ${allPass ? "text-green-400" : "text-red-400"}`}
          >
            {allPass ? "✓ OK" : "✗ FAIL"}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
          <div className="text-xs text-zinc-500">Max utilization</div>
          <div className="text-lg font-bold text-zinc-200">
            {(maxUtilization * 100).toFixed(0)}%
          </div>
        </div>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
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
        <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3">
          <div className="text-xs text-zinc-500">Timber</div>
          <div className="mt-0.5 text-sm font-bold text-zinc-200">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
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
            {designChecks.map((check) => {
              const member = memberResults.find(
                (candidate) => candidate.memberId === check.memberId,
              );

              return (
                <tr
                  key={check.memberId}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30"
                >
                  <td className="py-1.5 pr-3 font-mono text-zinc-300">
                    {check.label}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-zinc-500">
                    {check.group === "topChord"
                      ? "Top chord"
                      : check.group === "bottomChord"
                        ? "Bottom chord"
                        : "Web"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-zinc-400">
                    {member?.length.toFixed(2)}
                  </td>
                  <td
                    className={`py-1.5 pr-3 text-right font-mono ${
                      check.axialForce >= 0 ? "text-blue-400" : "text-amber-400"
                    }`}
                  >
                    {check.axialForce >= 0 ? "+" : ""}
                    {check.axialForce.toFixed(1)}
                  </td>
                  <td className="py-1.5 pr-3 text-right font-mono text-zinc-400">
                    {check.bendingMoment > 0
                      ? check.bendingMoment.toFixed(2)
                      : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-xs text-zinc-500">
                    {check.mode === "combined" ? "N+M" : check.mode}
                    {check.buckling ? " ⚠" : ""}
                  </td>
                  <td className="py-1.5 pr-3 w-32">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${utilizationBarColor(check.utilization)}`}
                          style={{
                            width: `${Math.min(check.utilization * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs text-zinc-500">
                        {(check.utilization * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-1.5 text-center">
                    {check.pass ? (
                      <span className="text-green-500">✓</span>
                    ) : (
                      <span className="text-red-500">✗</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-600">
        ULS: 1.35G + 1.5Q · SLS: L/300 · EC5 (EN 1995) · C24 (EN 338) · γ_M=1.3
        · k_mod=0.8 (medium-term, SC1/2) · top chord analyzed as 2D frame
        elements · bottom chord and webs analyzed as axial-only bars · internal
        joints use rotational springs of{" "}
        {input.jointRotationalStiffness.toFixed(0)} kNm/rad
      </p>

      <section className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-900/80 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Engineering Calculation Notes
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">
            This section describes the current frame-truss model so an engineer
            can review the assumptions, reproduce the formulas, and challenge
            any part of the implementation.
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
                Top chord is modeled with frame elements; bottom chord and web
                members remain axial-only bars.
              </p>
              <p>
                Truss rise: h = (span / 2) × tan(pitch) ={" "}
                {((input.span / 2) * Math.tan(pitchRad)).toFixed(3)} m.
              </p>
              <p>Top chord panel length: {topChordPanelLength.toFixed(3)} m.</p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              2. Load Conversion
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>Dead load is treated on the roof slope surface.</p>
              <p>
                Snow load is treated on horizontal projection and converted to a
                sloped-member load by multiplying with cos(pitch).
              </p>
              <p>Pitch = {input.pitch.toFixed(1)}°.</p>
              <p>
                Dead line load on top chord: g = deadLoad × spacing ={" "}
                {input.deadLoad.toFixed(3)} × {input.spacing.toFixed(3)} ={" "}
                {deadLineLoad.toFixed(3)} kN/m.
              </p>
              <p>
                Snow line load on plan projection: q = snowLoad × spacing ={" "}
                {input.snowLoad.toFixed(3)} × {input.spacing.toFixed(3)} ={" "}
                {snowLineLoad.toFixed(3)} kN/m.
              </p>
              <p>
                ULS vertical load on each top chord frame member: 1.35g + 1.5q ×
                cos(pitch) = {ulsVerticalLineLoad.toFixed(3)} kN/m.
              </p>
              <p>
                SLS vertical load on each top chord frame member: g + q ×
                cos(pitch) = {slsVerticalLineLoad.toFixed(3)} kN/m.
              </p>
              <p>
                ULS local beam load components used by the solver: qx ={" "}
                {localAxialLoad.toFixed(3)} kN/m, qy ={" "}
                {localTransverseLoad.toFixed(3)} kN/m.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              3. Structural Analysis
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>Analysis method: 2D direct stiffness method.</p>
              <p>Shared node DOFs: ux and uy.</p>
              <p>
                Top chord members use Euler-Bernoulli frame elements with axial
                and bending stiffness.
              </p>
              <p>
                Bottom chord and web members remain axial-only truss elements
                embedded in the same global DOF system.
              </p>
              <p>
                Each top chord member end has its own rotational DOF. Adjacent
                top chord member ends at the same joint are connected by a
                rotational spring kθ ={" "}
                {input.jointRotationalStiffness.toFixed(0)} kNm/rad.
              </p>
              <p>
                Support conditions: left support fixes ux and uy, right support
                fixes uy. Top chord end rotations at the supports remain free.
              </p>
              <p>
                Boundary conditions are enforced by row and column elimination,
                not a penalty spring.
              </p>
              <p>
                Member stiffness uses E = 11 000 MPa (E0,mean). Top chord uses{" "}
                {input.timberWidth} × {input.topChordHeight} mm; bottom chord
                and web members use {input.timberWidth} ×{" "}
                {input.bottomChordHeight} mm.
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
              <p>Pure tension members: utilization = N / (ft,0,d × A).</p>
              <p>
                Tension + bending members: utilization = σt / ft,0,d + σm /
                fm,d.
              </p>
              <p>
                Pure compression members: utilization = N / (kc × fc,0,d × A),
                where kc is the EC5 §6.3.2 instability factor.
              </p>
              <p>
                Relative slenderness: λ_rel = (λ / π) × √(fc,0,k / E0,05), with
                βc = 0.2.
              </p>
              <p>
                Web members use in-plane buckling only. Top chord out-of-plane
                buckling assumes 0.6 m lateral bracing spacing. Bottom chord
                compression uses the minimum of in-plane and out-of-plane kc.
              </p>
              <p>
                Compression + bending members use EC5 eq. 6.23 and 6.24 with
                moments taken directly from the frame analysis:
              </p>
              <p className="font-mono text-zinc-300">
                util_6.23 = σc / (kc,y × fc,0,d) + σm / fm,d
              </p>
              <p className="font-mono text-zinc-300">
                util_6.24 = σc / (kc,z × fc,0,d) + km × σm / fm,d
              </p>
              <p>
                Governing compression+bending utilization = max(util_6.23,
                util_6.24), with km = 0.7.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              6. Semi-Rigid Joint Model
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>
                Bending is solved directly in the global analysis because chord
                members carry EI and adjacent top chord member ends are coupled
                by rotational springs.
              </p>
              <p>
                The spring relation is ΔM = kθ × Δθ between the connected
                member-end rotations at a joint.
              </p>
              <p className="font-mono text-zinc-300">
                kθ = {input.jointRotationalStiffness.toFixed(0)} kNm/rad
              </p>
              <p>
                This is now a true member-end spring model for the top chord. A
                zero spring gives a pin between adjacent top chord panels, while
                a very large spring approaches rigid continuity.
              </p>
              <p>
                This is a lumped joint approximation, not an explicit nail-plate
                plate-and-fastener model.
              </p>
              <p>
                Governing member moment from the current ULS analysis:{" "}
                {governingMomentMember.label} ={" "}
                {governingMomentMember.maxAbsMoment.toFixed(2)} kNm.
              </p>
              <p>
                There is no empirical top-chord calibration factor in the
                current solver. Current mismatch against TräGuiden tabell 4.2 is
                therefore more likely to come from geometry/detail assumptions
                than from the absence of a joint-flexibility mechanism.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-zinc-800 bg-zinc-950/70 p-3 lg:col-span-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-300">
              7. Deflection Check
            </h3>
            <div className="mt-2 space-y-1 text-xs leading-5 text-zinc-400">
              <p>
                SLS uses the unfactored distributed beam load combination g + q
                × cos(pitch) on the top chord members.
              </p>
              <p>
                Reported deflection is the maximum of the two bottom internal
                nodes at L/3 and 2L/3.
              </p>
              <p>
                This deflection comes from the full frame-truss analysis, so it
                includes axial and bending deformation together.
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
                Joint stiffness is represented by a single lumped rotational
                spring per internal node, not by a detailed nail-plate model.
              </p>
              <p>
                Geometry is fixed to one 7-node W-truss arrangement and does not
                vary panel count with span or timber stock.
              </p>
              <p>
                Web members remain axial-only, so local web bending and
                eccentric nail-plate behavior are excluded.
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
