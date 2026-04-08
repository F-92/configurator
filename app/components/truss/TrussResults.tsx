"use client";

import type { TrussDesignResult } from "../../lib/truss/types";

interface TrussResultsProps {
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
        · k_mod=0.8 (medium-term, SC1/2) · Top chord: N+M combined (§6.3.2)
      </p>
    </div>
  );
}
