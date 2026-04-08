"use client";

import type { TrussInput } from "../../lib/truss/types";

interface TrussInputFormProps {
  input: TrussInput;
  onChange: (input: TrussInput) => void;
}

interface FieldProps {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function Field({ label, unit, value, min, max, step, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="text-sm text-zinc-400">
        {label} <span className="text-zinc-600">({unit})</span>
      </span>
      <div className="flex items-center gap-3 mt-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-amber-500"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-right text-zinc-200"
        />
      </div>
    </label>
  );
}

const TIMBER_HEIGHTS = [95, 120, 145, 170, 195, 220];

export default function TrussInputForm({
  input,
  onChange,
}: TrussInputFormProps) {
  const set = (key: keyof TrussInput, value: number) =>
    onChange({ ...input, [key]: value });

  return (
    <div className="space-y-5">
      <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Geometry
      </h3>
      <Field
        label="Span"
        unit="m"
        value={input.span}
        min={4}
        max={20}
        step={0.5}
        onChange={(v) => set("span", v)}
      />
      <Field
        label="Roof pitch"
        unit="°"
        value={input.pitch}
        min={10}
        max={45}
        step={1}
        onChange={(v) => set("pitch", v)}
      />

      <hr className="border-zinc-800" />

      <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Loads
      </h3>
      <Field
        label="Dead load"
        unit="kN/m²"
        value={input.deadLoad}
        min={0.2}
        max={1.5}
        step={0.05}
        onChange={(v) => set("deadLoad", v)}
      />
      <Field
        label="Snow load"
        unit="kN/m²"
        value={input.snowLoad}
        min={0}
        max={5}
        step={0.1}
        onChange={(v) => set("snowLoad", v)}
      />
      <Field
        label="Truss spacing"
        unit="m"
        value={input.spacing}
        min={0.6}
        max={2.4}
        step={0.1}
        onChange={(v) => set("spacing", v)}
      />

      <hr className="border-zinc-800" />

      <h3 className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">
        Timber C24 — {input.timberWidth} mm width
      </h3>
      <div>
        <span className="text-sm text-zinc-400">Top chord / Ö (mm)</span>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {TIMBER_HEIGHTS.map((h) => (
            <button
              key={`tc-${h}`}
              onClick={() => set("topChordHeight", h)}
              className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                input.topChordHeight === h
                  ? "bg-amber-500/20 border-amber-500 text-amber-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {input.timberWidth}×{h}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-sm text-zinc-400">Bottom chord / U (mm)</span>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {TIMBER_HEIGHTS.map((h) => (
            <button
              key={`bc-${h}`}
              onClick={() => set("bottomChordHeight", h)}
              className={`text-xs px-2 py-1.5 rounded border transition-colors ${
                input.bottomChordHeight === h
                  ? "bg-amber-500/20 border-amber-500 text-amber-400"
                  : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              {input.timberWidth}×{h}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
