"use client";

import { useHouseStore } from "../lib/store";
import { formatSEK } from "../lib/pricing";

export function PricePanel() {
  const price = useHouseStore((s) => s.price);
  const config = useHouseStore((s) => s.config);

  const floorArea = config.width * config.depth;
  const pricePerSqm = floorArea > 0 ? Math.round(price.total / floorArea) : 0;

  const rows = [
    { label: "Grund", value: price.foundation },
    { label: "Väggar", value: price.walls },
    { label: "Tak", value: price.roof },
    { label: "Fönster", value: price.windows },
    { label: "Dörrar", value: price.doors },
    { label: "Material & transport", value: price.materials },
  ];

  return (
    <div className="bg-zinc-800/80 backdrop-blur border border-zinc-700 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3">
        Prisuppskattning
      </h3>

      <div className="space-y-1.5 mb-3">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between text-xs">
            <span className="text-zinc-400">{row.label}</span>
            <span className="text-zinc-200 font-mono">
              {formatSEK(row.value)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-zinc-600 pt-2 mt-2">
        <div className="flex justify-between text-sm font-bold">
          <span className="text-white">Totalt</span>
          <span className="text-amber-400 font-mono">
            {formatSEK(price.total)}
          </span>
        </div>
        <div className="flex justify-between text-xs mt-1">
          <span className="text-zinc-500">Yta: {floorArea.toFixed(0)} m²</span>
          <span className="text-zinc-500">{formatSEK(pricePerSqm)}/m²</span>
        </div>
      </div>
    </div>
  );
}
