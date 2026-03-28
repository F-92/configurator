"use client";

import { useHouseStore } from "../lib/store";

const STEPS = [
  { label: "Mått", icon: "📐" },
  { label: "Tak", icon: "🏠" },
  { label: "Fasad", icon: "🧱" },
  { label: "Fönster & Dörrar", icon: "🪟" },
];

export function StepNav() {
  const activeStep = useHouseStore((s) => s.activeStep);
  const setActiveStep = useHouseStore((s) => s.setActiveStep);

  return (
    <div className="flex gap-1 mb-4">
      {STEPS.map((step, i) => (
        <button
          key={i}
          onClick={() => setActiveStep(i)}
          className={`flex-1 text-xs py-2 px-1 rounded transition-colors ${
            activeStep === i
              ? "bg-amber-400/20 text-amber-400 border border-amber-400/40"
              : "bg-zinc-700/50 text-zinc-400 border border-transparent hover:bg-zinc-700 hover:text-zinc-300"
          }`}
        >
          <span className="block text-base">{step.icon}</span>
          {step.label}
        </button>
      ))}
    </div>
  );
}
