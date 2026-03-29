"use client";

import { useHouseStore } from "../lib/store";
import {
  LIMITS,
  RoofType,
  WallMaterial,
  RoofMaterial,
  MATERIAL_COLORS,
  ROOF_COLORS,
  WallName,
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

export function ExtensionsPanel() {
  const config = useHouseStore((s) => s.config);
  const addExtension = useHouseStore((s) => s.addExtension);
  const removeExtension = useHouseStore((s) => s.removeExtension);
  const updateExtension = useHouseStore((s) => s.updateExtension);
  const addExtensionWindow = useHouseStore((s) => s.addExtensionWindow);
  const removeExtensionWindow = useHouseStore((s) => s.removeExtensionWindow);
  const addExtensionDoor = useHouseStore((s) => s.addExtensionDoor);
  const removeExtensionDoor = useHouseStore((s) => s.removeExtensionDoor);

  const wallLabels: Record<WallName, string> = {
    front: "Fram",
    back: "Bak",
    left: "Vänster",
    right: "Höger",
  };

  // Available walls to add an extension to (on the main body)
  const availableWalls: WallName[] = ["front", "back", "left", "right"];

  return (
    <div>
      <SectionHeader title="Tillbyggnader" />
      <p className="text-xs text-zinc-500 mb-3">
        Lägg till huskroppar på valfri vägg för att skapa L-, T- och U-former.
      </p>

      {/* Add extension buttons */}
      <div className="mb-4">
        <label className="text-xs text-zinc-400 mb-1 block">
          Lägg till på huvudbyggnadens vägg:
        </label>
        <div className="flex gap-1 flex-wrap">
          {availableWalls.map((wall) => (
            <button
              key={wall}
              onClick={() => addExtension(wall)}
              className="text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded"
            >
              + {wallLabels[wall]}
            </button>
          ))}
        </div>
      </div>

      {/* Extension list */}
      <div className="space-y-3">
        {config.extensions.map((ext, idx) => (
          <div
            key={ext.id}
            className="bg-zinc-700/50 rounded p-3 border border-zinc-600"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-zinc-200">
                Tillbyggnad {idx + 1} – {wallLabels[ext.parentWall]}
              </span>
              <button
                onClick={() => removeExtension(ext.id)}
                className="text-red-400 hover:text-red-300 text-xs px-1"
              >
                ✕
              </button>
            </div>

            {/* Parent wall select */}
            <div className="mb-2">
              <label className="text-xs text-zinc-400">Placering</label>
              <select
                value={ext.parentWall}
                onChange={(e) =>
                  updateExtension(ext.id, {
                    parentWall: e.target.value as WallName,
                  })
                }
                className="w-full bg-zinc-600 text-white rounded px-2 py-1 text-xs mt-0.5"
              >
                {availableWalls.map((w) => (
                  <option key={w} value={w}>
                    {wallLabels[w]} vägg
                  </option>
                ))}
              </select>
            </div>

            {/* Position along wall */}
            <div className="mb-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Position längs vägg</span>
                <span className="text-white font-mono">
                  {(ext.position * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={ext.position}
                onChange={(e) =>
                  updateExtension(ext.id, {
                    position: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-amber-400 h-1 bg-zinc-600 rounded appearance-none cursor-pointer"
              />
            </div>

            {/* Dimensions */}
            <SliderControl
              label="Bredd"
              value={ext.width}
              min={2}
              max={12}
              step={0.5}
              unit="m"
              onChange={(v) => updateExtension(ext.id, { width: v })}
            />
            <SliderControl
              label="Djup"
              value={ext.depth}
              min={2}
              max={12}
              step={0.5}
              unit="m"
              onChange={(v) => updateExtension(ext.id, { depth: v })}
            />
            <SliderControl
              label="Vägghöjd"
              value={ext.wallHeight}
              min={LIMITS.wallHeight.min}
              max={LIMITS.wallHeight.max}
              step={0.1}
              unit="m"
              onChange={(v) => updateExtension(ext.id, { wallHeight: v })}
            />

            {/* Roof settings */}
            <SelectControl<RoofType>
              label="Taktyp"
              value={ext.roofType}
              options={[
                { value: "gable", label: "Sadeltak" },
                { value: "hip", label: "Valmat tak" },
                { value: "flat", label: "Platt tak" },
                { value: "shed", label: "Pulpettak" },
              ]}
              onChange={(v) => {
                const update: Partial<typeof ext> = { roofType: v };
                if (v === "flat") update.roofPitch = 0;
                else if (ext.roofPitch === 0) update.roofPitch = 15;
                updateExtension(ext.id, update);
              }}
            />
            {ext.roofType !== "flat" && (
              <SliderControl
                label="Taklutning"
                value={ext.roofPitch}
                min={5}
                max={LIMITS.roofPitch.max}
                step={1}
                unit="°"
                onChange={(v) => updateExtension(ext.id, { roofPitch: v })}
              />
            )}
            <SliderControl
              label="Taksprång"
              value={ext.roofOverhang}
              min={0}
              max={LIMITS.roofOverhang.max}
              step={0.1}
              unit="m"
              onChange={(v) => updateExtension(ext.id, { roofOverhang: v })}
            />

            {/* Extension windows */}
            <div className="mt-2 border-t border-zinc-600 pt-2">
              <label className="text-xs text-zinc-400 font-medium">
                Fönster
              </label>
              {ext.windows.map((win) => (
                <div
                  key={win.id}
                  className="bg-zinc-600/50 rounded p-1.5 mt-1 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300">
                      {wallLabels[win.wall]} – {win.width.toFixed(1)}×
                      {win.height.toFixed(1)}m
                    </span>
                    <button
                      onClick={() => removeExtensionWindow(ext.id, win.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-1 flex-wrap mt-1">
                {(["front", "left", "right"] as const).map((wall) => (
                  <button
                    key={wall}
                    onClick={() => addExtensionWindow(ext.id, wall)}
                    className="text-xs bg-zinc-600 hover:bg-zinc-500 text-zinc-300 px-1.5 py-0.5 rounded"
                  >
                    + {wallLabels[wall]}
                  </button>
                ))}
              </div>
            </div>

            {/* Extension doors */}
            <div className="mt-2 border-t border-zinc-600 pt-2">
              <label className="text-xs text-zinc-400 font-medium">
                Dörrar
              </label>
              {ext.doors.map((door) => (
                <div
                  key={door.id}
                  className="bg-zinc-600/50 rounded p-1.5 mt-1 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300">
                      {wallLabels[door.wall]} – {door.style}
                    </span>
                    <button
                      onClick={() => removeExtensionDoor(ext.id, door.id)}
                      className="text-red-400 hover:text-red-300 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-1 flex-wrap mt-1">
                {(["front", "left", "right"] as const).map((wall) => (
                  <button
                    key={wall}
                    onClick={() => addExtensionDoor(ext.id, wall)}
                    className="text-xs bg-zinc-600 hover:bg-zinc-500 text-zinc-300 px-1.5 py-0.5 rounded"
                  >
                    + {wallLabels[wall]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {config.extensions.length === 0 && (
        <div className="text-center text-zinc-500 text-xs py-4 bg-zinc-800/50 rounded">
          Inga tillbyggnader ännu. Klicka på en vägg ovan för att lägga till.
        </div>
      )}
    </div>
  );
}
