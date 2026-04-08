"use client";

import { useState, useMemo } from "react";
import type { TrussInput } from "../../lib/truss/types";
import { designTruss } from "../../lib/truss";
import TrussInputForm from "./TrussInputForm";
import TrussSVG from "./TrussSVG";
import TrussResults from "./TrussResults";

const DEFAULT_INPUT: TrussInput = {
  span: 10,
  pitch: 14,
  spacing: 1.2,
  deadLoad: 0.9,
  snowLoad: 1.5,
  timberWidth: 45,
  topChordHeight: 195,
  bottomChordHeight: 170,
};

export default function TrussDesigner() {
  const [input, setInput] = useState<TrussInput>(DEFAULT_INPUT);

  const result = useMemo(() => designTruss(input), [input]);

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 xl:w-96 bg-zinc-950 border-b lg:border-b-0 lg:border-r border-zinc-800 overflow-y-auto p-5 shrink-0">
        <div className="mb-6">
          <h1 className="text-lg font-bold text-zinc-100">
            Fink Truss Designer
          </h1>
          <p className="text-xs text-zinc-500 mt-1">C24 timber · Eurocode 5</p>
        </div>
        <TrussInputForm input={input} onChange={setInput} />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Status banner */}
        <div
          className={`rounded-lg px-4 py-2 text-sm font-medium border ${
            result.allPass
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {result.allPass
            ? `All checks pass — max utilization ${(result.maxUtilization * 100).toFixed(0)}%, deflection ${result.midspanDeflection.toFixed(1)} mm`
            : `Design fails — ${result.designChecks.filter((c) => !c.pass).length} member(s) over capacity (max ${(result.maxUtilization * 100).toFixed(0)}%)${!result.deflectionPass ? `, deflection ${result.midspanDeflection.toFixed(1)} mm > ${result.deflectionLimit.toFixed(0)} mm` : ""}`}
        </div>

        {/* Truss drawing */}
        <TrussSVG result={result} />

        {/* Results table */}
        <TrussResults
          result={result}
          topChordSize={`${input.timberWidth}×${input.topChordHeight}`}
          bottomChordSize={`${input.timberWidth}×${input.bottomChordHeight}`}
        />
      </main>
    </div>
  );
}
