"use client";

import { useHouseStore } from "../lib/store";
import {
  LIMITS,
  RoofType,
  WallMaterial,
  RoofMaterial,
  MATERIAL_COLORS,
  ROOF_COLORS,
} from "../lib/types";

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-zinc-300">{label}</span>
        <span className="text-white font-mono">
          {value.toFixed(step < 1 ? 1 : 0)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-400 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
      />
    </div>
  );
}

function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-3">
      <label className="text-sm text-zinc-300 mb-1 block">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full bg-zinc-700 text-white rounded px-2 py-1.5 text-sm border border-zinc-600 focus:border-amber-400 focus:outline-none"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <label className="text-sm text-zinc-300 flex-1">{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded border border-zinc-600 cursor-pointer bg-transparent"
      />
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-3 mt-4 first:mt-0">
      {title}
    </h3>
  );
}

export function DimensionsPanel() {
  const config = useHouseStore((s) => s.config);
  const setConfig = useHouseStore((s) => s.setConfig);

  return (
    <div>
      <SectionHeader title="Mått" />
      <SliderControl
        label="Bredd"
        value={config.width}
        min={LIMITS.width.min}
        max={LIMITS.width.max}
        step={0.5}
        unit="m"
        onChange={(v) => setConfig({ width: v })}
      />
      <SliderControl
        label="Längd"
        value={config.depth}
        min={LIMITS.depth.min}
        max={LIMITS.depth.max}
        step={0.5}
        unit="m"
        onChange={(v) => setConfig({ depth: v })}
      />
      <SliderControl
        label="Vägghöjd"
        value={config.wallHeight}
        min={LIMITS.wallHeight.min}
        max={LIMITS.wallHeight.max}
        step={0.1}
        unit="m"
        onChange={(v) => setConfig({ wallHeight: v })}
      />
    </div>
  );
}

export function RoofPanel() {
  const config = useHouseStore((s) => s.config);
  const setRoofType = useHouseStore((s) => s.setRoofType);
  const setRoofMaterial = useHouseStore((s) => s.setRoofMaterial);
  const setConfig = useHouseStore((s) => s.setConfig);

  return (
    <div>
      <SectionHeader title="Tak" />
      <SelectControl<RoofType>
        label="Taktyp"
        value={config.roofType}
        options={[
          { value: "gable", label: "Sadeltak" },
          { value: "hip", label: "Valmat tak" },
          { value: "flat", label: "Platt tak" },
          { value: "shed", label: "Pulpettak" },
        ]}
        onChange={setRoofType}
      />
      {config.roofType !== "flat" && (
        <SliderControl
          label="Taklutning"
          value={config.roofPitch}
          min={5}
          max={LIMITS.roofPitch.max}
          step={1}
          unit="°"
          onChange={(v) => setConfig({ roofPitch: v })}
        />
      )}
      <SliderControl
        label="Taksprång"
        value={config.roofOverhang}
        min={LIMITS.roofOverhang.min}
        max={LIMITS.roofOverhang.max}
        step={0.1}
        unit="m"
        onChange={(v) => setConfig({ roofOverhang: v })}
      />
      <SelectControl<RoofMaterial>
        label="Takmaterial"
        value={config.roofMaterial}
        options={[
          { value: "tiles", label: "Tegelpannor" },
          { value: "metal", label: "Plåt" },
          { value: "shingles", label: "Shingel" },
        ]}
        onChange={(v) => {
          setRoofMaterial(v);
          setConfig({ roofColor: ROOF_COLORS[v] });
        }}
      />
      <ColorControl
        label="Takfärg"
        value={config.roofColor}
        onChange={(v) => setConfig({ roofColor: v })}
      />
    </div>
  );
}

export function WallsPanel() {
  const config = useHouseStore((s) => s.config);
  const setWallMaterial = useHouseStore((s) => s.setWallMaterial);
  const setConfig = useHouseStore((s) => s.setConfig);

  return (
    <div>
      <SectionHeader title="Väggar & Fasad" />
      <SelectControl<WallMaterial>
        label="Fasadmaterial"
        value={config.wallMaterial}
        options={[
          { value: "wood", label: "Trä" },
          { value: "brick", label: "Tegel" },
          { value: "stucco", label: "Puts" },
          { value: "fiber-cement", label: "Fibercement" },
        ]}
        onChange={(v) => {
          setWallMaterial(v);
          setConfig({ wallColor: MATERIAL_COLORS[v] });
        }}
      />
      <ColorControl
        label="Väggfärg"
        value={config.wallColor}
        onChange={(v) => setConfig({ wallColor: v })}
      />
      <ColorControl
        label="Listfärg"
        value={config.trimColor}
        onChange={(v) => setConfig({ trimColor: v })}
      />
    </div>
  );
}

export function WindowsDoorsPanel() {
  const config = useHouseStore((s) => s.config);
  const addWindow = useHouseStore((s) => s.addWindow);
  const removeWindow = useHouseStore((s) => s.removeWindow);
  const updateWindow = useHouseStore((s) => s.updateWindow);
  const addDoor = useHouseStore((s) => s.addDoor);
  const removeDoor = useHouseStore((s) => s.removeDoor);
  const updateDoor = useHouseStore((s) => s.updateDoor);

  const wallLabels = {
    front: "Fram",
    back: "Bak",
    left: "Vänster",
    right: "Höger",
  } as const;

  return (
    <div>
      <SectionHeader title="Fönster" />
      <div className="space-y-2 mb-3">
        {config.windows.map((win) => (
          <div key={win.id} className="bg-zinc-700/50 rounded p-2 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-zinc-300">
                {wallLabels[win.wall]} – {win.width.toFixed(1)}×
                {win.height.toFixed(1)}m
              </span>
              <button
                onClick={() => removeWindow(win.id)}
                className="text-red-400 hover:text-red-300 text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={win.wall}
                onChange={(e) =>
                  updateWindow(win.id, {
                    wall: e.target.value as "front" | "back" | "left" | "right",
                  })
                }
                className="bg-zinc-600 text-white rounded px-1 py-0.5 text-xs"
              >
                {Object.entries(wallLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={win.style}
                onChange={(e) =>
                  updateWindow(win.id, {
                    style: e.target.value as "standard" | "picture" | "bay",
                  })
                }
                className="bg-zinc-600 text-white rounded px-1 py-0.5 text-xs"
              >
                <option value="standard">Standard</option>
                <option value="picture">Panorama</option>
                <option value="bay">Burspråk</option>
              </select>
            </div>
            <div className="mt-1">
              <label className="text-zinc-400 text-xs">Position</label>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={win.positionX}
                onChange={(e) =>
                  updateWindow(win.id, {
                    positionX: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-amber-400 h-1 bg-zinc-600 rounded appearance-none cursor-pointer"
              />
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <div>
                <label className="text-zinc-400 text-xs">Bredd</label>
                <input
                  type="range"
                  min={LIMITS.windowWidth.min}
                  max={LIMITS.windowWidth.max}
                  step={0.1}
                  value={win.width}
                  onChange={(e) =>
                    updateWindow(win.id, { width: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400 h-1 bg-zinc-600 rounded appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-xs">Höjd</label>
                <input
                  type="range"
                  min={LIMITS.windowHeight.min}
                  max={LIMITS.windowHeight.max}
                  step={0.1}
                  value={win.height}
                  onChange={(e) =>
                    updateWindow(win.id, { height: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-400 h-1 bg-zinc-600 rounded appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 flex-wrap">
        {(["front", "back", "left", "right"] as const).map((wall) => (
          <button
            key={wall}
            onClick={() => addWindow(wall)}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded"
          >
            + {wallLabels[wall]}
          </button>
        ))}
      </div>

      <SectionHeader title="Dörrar" />
      <div className="space-y-2 mb-3">
        {config.doors.map((door) => (
          <div key={door.id} className="bg-zinc-700/50 rounded p-2 text-xs">
            <div className="flex justify-between items-center mb-1">
              <span className="text-zinc-300">
                {wallLabels[door.wall]} – {door.style}
              </span>
              <button
                onClick={() => removeDoor(door.id)}
                className="text-red-400 hover:text-red-300 text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <select
                value={door.wall}
                onChange={(e) =>
                  updateDoor(door.id, {
                    wall: e.target.value as "front" | "back" | "left" | "right",
                  })
                }
                className="bg-zinc-600 text-white rounded px-1 py-0.5 text-xs"
              >
                {Object.entries(wallLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <select
                value={door.style}
                onChange={(e) =>
                  updateDoor(door.id, {
                    style: e.target.value as "standard" | "french" | "sliding",
                  })
                }
                className="bg-zinc-600 text-white rounded px-1 py-0.5 text-xs"
              >
                <option value="standard">Standard</option>
                <option value="french">Pardörr</option>
                <option value="sliding">Skjutdörr</option>
              </select>
            </div>
            <div className="mt-1">
              <label className="text-zinc-400 text-xs">Position</label>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={door.positionX}
                onChange={(e) =>
                  updateDoor(door.id, { positionX: parseFloat(e.target.value) })
                }
                className="w-full accent-amber-400 h-1 bg-zinc-600 rounded appearance-none cursor-pointer"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 flex-wrap">
        {(["front", "back", "left", "right"] as const).map((wall) => (
          <button
            key={wall}
            onClick={() => addDoor(wall)}
            className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded"
          >
            + {wallLabels[wall]}
          </button>
        ))}
      </div>
    </div>
  );
}
