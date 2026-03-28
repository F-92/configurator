"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useHouseStore } from "../lib/store";
import {
  DimensionsPanel,
  RoofPanel,
  WallsPanel,
  WindowsDoorsPanel,
} from "./ConfigPanel";
import { PricePanel } from "./PricePanel";
import { StepNav } from "./StepNav";

const Scene = dynamic(() => import("./Scene"), { ssr: false });

function ActivePanel() {
  const activeStep = useHouseStore((s) => s.activeStep);

  switch (activeStep) {
    case 0:
      return <DimensionsPanel />;
    case 1:
      return <RoofPanel />;
    case 2:
      return <WallsPanel />;
    case 3:
      return <WindowsDoorsPanel />;
    default:
      return <DimensionsPanel />;
  }
}

export default function Configurator() {
  const resetConfig = useHouseStore((s) => s.resetConfig);
  const config = useHouseStore((s) => s.config);
  const showFraming = useHouseStore((s) => s.showFraming);
  const toggleFraming = useHouseStore((s) => s.toggleFraming);
  const showVerticalTopPlate = useHouseStore((s) => s.showVerticalTopPlate);
  const toggleVerticalTopPlate = useHouseStore((s) => s.toggleVerticalTopPlate);
  const showTiles = useHouseStore((s) => s.showTiles);
  const toggleTiles = useHouseStore((s) => s.toggleTiles);
  const showDimensions = useHouseStore((s) => s.showDimensions);
  const toggleDimensions = useHouseStore((s) => s.toggleDimensions);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-900">
      {/* Sidebar */}
      <aside className="w-full lg:w-80 xl:w-96 flex-shrink-0 bg-zinc-800/60 backdrop-blur border-b lg:border-b-0 lg:border-r border-zinc-700 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Husbyggaren</h1>
              <p className="text-xs text-zinc-400">Rita din byggsats</p>
            </div>
            <button
              onClick={resetConfig}
              className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500 transition-colors"
            >
              Återställ
            </button>
          </div>
          <div className="mt-2 flex gap-3 text-xs text-zinc-500">
            <span>
              {config.width}×{config.depth} m
            </span>
            <span>{(config.width * config.depth).toFixed(0)} m²</span>
          </div>
        </div>

        {/* Step navigation + active panel */}
        <div className="flex-1 overflow-y-auto p-4">
          <StepNav />
          <ActivePanel />
        </div>

        {/* Price panel at bottom */}
        <div className="p-4 border-t border-zinc-700">
          <PricePanel />
        </div>
      </aside>

      {/* 3D Viewport */}
      <main className="flex-1 relative min-h-[400px]">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full bg-zinc-900">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full mx-auto mb-3" />
                <p className="text-zinc-400 text-sm">Laddar 3D-vy...</p>
              </div>
            </div>
          }
        >
          <Scene />
        </Suspense>

        {/* Viewport overlay info */}
        <div className="absolute bottom-4 left-4 text-xs text-zinc-500 bg-zinc-900/70 backdrop-blur rounded px-2 py-1">
          Dra för att rotera • Scrolla för att zooma • Högerklick för att
          panorera
        </div>

        {/* Framing toggle */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
          <button
            onClick={toggleFraming}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors backdrop-blur ${
              showFraming
                ? "bg-amber-400/90 text-zinc-900 hover:bg-amber-300"
                : "bg-zinc-800/80 text-zinc-300 border border-zinc-600 hover:bg-zinc-700"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              {/* Simple frame/structure icon */}
              <rect x="2" y="2" width="12" height="12" />
              <line x1="8" y1="2" x2="8" y2="14" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="5" y1="2" x2="5" y2="14" />
              <line x1="11" y1="2" x2="11" y2="14" />
            </svg>
            {showFraming ? "Stomme" : "Visa stomme"}
          </button>
          {showFraming && (
            <button
              onClick={toggleVerticalTopPlate}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors backdrop-blur ${
                showVerticalTopPlate
                  ? "bg-amber-400/90 text-zinc-900 hover:bg-amber-300"
                  : "bg-zinc-800/80 text-zinc-300 border border-zinc-600 hover:bg-zinc-700"
              }`}
            >
              Stående hammarband
            </button>
          )}
          {!showFraming && (
            <button
              onClick={toggleTiles}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors backdrop-blur ${
                showTiles
                  ? "bg-amber-400/90 text-zinc-900 hover:bg-amber-300"
                  : "bg-zinc-800/80 text-zinc-300 border border-zinc-600 hover:bg-zinc-700"
              }`}
            >
              {showTiles ? "Dölj pannor" : "Visa pannor"}
            </button>
          )}
          <button
            onClick={toggleDimensions}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors backdrop-blur ${
              showDimensions
                ? "bg-amber-400/90 text-zinc-900 hover:bg-amber-300"
                : "bg-zinc-800/80 text-zinc-300 border border-zinc-600 hover:bg-zinc-700"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <line x1="1" y1="13" x2="13" y2="13" />
              <line x1="1" y1="11.5" x2="1" y2="13" />
              <line x1="13" y1="11.5" x2="13" y2="13" />
              <line x1="1" y1="1" x2="1" y2="10" />
              <line x1="0" y1="1" x2="2" y2="1" />
              <line x1="0" y1="10" x2="2" y2="10" />
            </svg>
            {showDimensions ? "Dölj mått" : "Visa mått"}
          </button>
        </div>
      </main>
    </div>
  );
}
