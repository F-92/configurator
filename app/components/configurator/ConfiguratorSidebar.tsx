import type { ConfiguratorSidebarProps } from "./types";
import {
  BATTEN_THICKNESS,
  COMB_STRIP_PROJECTION,
  EXTERIOR_PANEL_BOARD_WIDTH,
  EXTERIOR_PANEL_FACE_CHAMFER,
  EXTERIOR_PANEL_OVERLAP_WIDTH,
  EXTERIOR_PANEL_REBATE_FACE_ANGLE,
  EXTERIOR_PANEL_REBATE_WIDTH,
  EXTERIOR_PANEL_VISIBLE_WIDTH,
  FACADE_AIR_GAP,
  INSTALLATION_LAYER_OPTIONS,
  INSTALLATION_LAYER_STUD_LENGTH_OPTIONS,
  OUTSIDE_INSULATION_OPTIONS,
  PANEL_BOARD_LENGTH_OPTIONS,
  PRESETS,
} from "../../lib/configuratorScene/constants";

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-amber-400"
      />
      {label}
    </label>
  );
}

export function ConfiguratorSidebar({
  geometry: {
    presetIndex,
    onPresetChange,
    thickness,
    onThicknessChange,
    studSpacing,
    onStudSpacingChange,
    wallHeight,
    onWallHeightChange,
  },
  layers: {
    outsideInsulationIndex,
    outsideInsulation,
    onOutsideInsulationIndexChange,
    installationLayerIndex,
    installationLayer,
    onInstallationLayerIndexChange,
    installationLayerStudLengthIndex,
    installationLayerStudLength,
    onInstallationLayerStudLengthIndexChange,
    panelBoardLengthIndex,
    panelBoardLength,
    onPanelBoardLengthIndexChange,
  },
  visibility: {
    showFraming,
    setShowFraming,
    showVerticalTopPlate,
    setShowVerticalTopPlate,
    showCavityInsulation,
    setShowCavityInsulation,
    showHouseWrap,
    setShowHouseWrap,
    showOutsideDrywall,
    setShowOutsideDrywall,
    showCombStrip,
    setShowCombStrip,
    showStandingExteriorPanel,
    setShowStandingExteriorPanel,
    showHorizontalExteriorPanel,
    setShowHorizontalExteriorPanel,
    showPrimedWhiteExteriorPanel,
    setShowPrimedWhiteExteriorPanel,
    showVaporBarrier,
    setShowVaporBarrier,
    showOsb,
    setShowOsb,
    showDrywall,
    setShowDrywall,
    showLabels,
    setShowLabels,
    showCorners,
    setShowCorners,
    showLayerCorners,
    setShowLayerCorners,
    showStudDimensions,
    setShowStudDimensions,
  },
  openings: {
    showOpenings,
    setShowOpenings,
    newOpeningKind,
    setNewOpeningKind,
    newOpeningWidthDm,
    setNewOpeningWidthDm,
    newOpeningHeightDm,
    setNewOpeningHeightDm,
    selectedOpeningId,
    wallOpenings,
    windowOpeningIds,
    onOpeningRemove,
    onOpeningSelect,
  },
  layout,
}: ConfiguratorSidebarProps) {
  return (
    <aside className="w-full lg:w-80 xl:w-96 shrink-0 bg-zinc-800/60 backdrop-blur border-b lg:border-b-0 lg:border-r border-zinc-700 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-zinc-700">
        <h1 className="text-lg font-bold text-white">Wall Configurator</h1>
        <p className="text-xs text-zinc-400">Parametric wall layout system</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Building shape
          </label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((preset, index) => (
              <button
                key={preset.name}
                onClick={() => onPresetChange(index)}
                className={`text-left px-3 py-2 rounded-lg text-xs transition-colors ${
                  index === presetIndex
                    ? "bg-amber-400/90 text-zinc-900 font-medium"
                    : "bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                }`}
              >
                <div className="font-medium">{preset.name}</div>
                <div
                  className={
                    index === presetIndex ? "text-zinc-700" : "text-zinc-500"
                  }
                >
                  {preset.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Stud width: {thickness} mm
          </label>
          <input
            type="range"
            min={95}
            max={220}
            step={25}
            value={thickness}
            onChange={(event) => onThicknessChange(Number(event.target.value))}
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>95mm</span>
            <span>120mm</span>
            <span>145mm</span>
            <span>195mm</span>
            <span>220mm</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Stud spacing (c/c): {studSpacing} mm
          </label>
          <input
            type="range"
            min={300}
            max={900}
            step={50}
            value={studSpacing}
            onChange={(event) =>
              onStudSpacingChange(Number(event.target.value))
            }
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>300</span>
            <span>450</span>
            <span>600</span>
            <span>900</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Outside insulation: {outsideInsulation} mm
          </label>
          <input
            type="range"
            min={0}
            max={OUTSIDE_INSULATION_OPTIONS.length - 1}
            step={1}
            value={outsideInsulationIndex}
            onChange={(event) =>
              onOutsideInsulationIndexChange(Number(event.target.value))
            }
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            {OUTSIDE_INSULATION_OPTIONS.map((value) => (
              <span key={value}>{value}mm</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Installation layer: {installationLayer} mm
          </label>
          <input
            type="range"
            min={0}
            max={INSTALLATION_LAYER_OPTIONS.length - 1}
            step={1}
            value={installationLayerIndex}
            onChange={(event) =>
              onInstallationLayerIndexChange(Number(event.target.value))
            }
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            {INSTALLATION_LAYER_OPTIONS.map((value) => (
              <span key={value}>{value}mm</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Service cavity stud length: {installationLayerStudLength} mm
          </label>
          <input
            type="range"
            min={0}
            max={INSTALLATION_LAYER_STUD_LENGTH_OPTIONS.length - 1}
            step={1}
            value={installationLayerStudLengthIndex}
            onChange={(event) =>
              onInstallationLayerStudLengthIndexChange(
                Number(event.target.value),
              )
            }
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            {INSTALLATION_LAYER_STUD_LENGTH_OPTIONS.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Cladding board length: {panelBoardLength} mm
          </label>
          <input
            type="range"
            min={0}
            max={PANEL_BOARD_LENGTH_OPTIONS.length - 1}
            step={1}
            value={panelBoardLengthIndex}
            onChange={(event) =>
              onPanelBoardLengthIndexChange(Number(event.target.value))
            }
            className="w-full accent-amber-400"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            {PANEL_BOARD_LENGTH_OPTIONS.map((value) => (
              <span key={value}>{value}</span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1">
            Wall height: {(wallHeight / 1000).toFixed(1)} m
          </label>
          <input
            type="range"
            min={2400}
            max={4000}
            step={100}
            value={wallHeight}
            onChange={(event) => onWallHeightChange(Number(event.target.value))}
            className="w-full accent-amber-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Visibility
          </label>
          <div className="space-y-2">
            <ToggleRow
              label="Framing"
              checked={showFraming}
              onChange={setShowFraming}
            />
            <ToggleRow
              label="Vertical top plate"
              checked={showVerticalTopPlate}
              onChange={setShowVerticalTopPlate}
            />
            <ToggleRow
              label="Cavity insulation"
              checked={showCavityInsulation}
              onChange={setShowCavityInsulation}
            />
            <ToggleRow
              label="House wrap"
              checked={showHouseWrap}
              onChange={setShowHouseWrap}
            />
            <ToggleRow
              label="Exterior sheathing"
              checked={showOutsideDrywall}
              onChange={setShowOutsideDrywall}
            />
            <ToggleRow
              label="Comb strip"
              checked={showCombStrip}
              onChange={setShowCombStrip}
            />
            <ToggleRow
              label="Vertical cladding"
              checked={showStandingExteriorPanel}
              onChange={(value) => {
                setShowStandingExteriorPanel(value);
                if (value) setShowHorizontalExteriorPanel(false);
              }}
            />
            <ToggleRow
              label="Horizontal cladding"
              checked={showHorizontalExteriorPanel}
              onChange={(value) => {
                setShowHorizontalExteriorPanel(value);
                if (value) setShowStandingExteriorPanel(false);
              }}
            />
            <ToggleRow
              label="Primed white cladding"
              checked={showPrimedWhiteExteriorPanel}
              onChange={setShowPrimedWhiteExteriorPanel}
            />
            <ToggleRow
              label="Vapor barrier"
              checked={showVaporBarrier}
              onChange={setShowVaporBarrier}
            />
            <ToggleRow label="OSB" checked={showOsb} onChange={setShowOsb} />
            <ToggleRow
              label="Drywall"
              checked={showDrywall}
              onChange={setShowDrywall}
            />
            <ToggleRow
              label="Wall labels"
              checked={showLabels}
              onChange={setShowLabels}
            />
            <ToggleRow
              label="Corner markers"
              checked={showCorners}
              onChange={setShowCorners}
            />
            <ToggleRow
              label="Layer corner markers"
              checked={showLayerCorners}
              onChange={setShowLayerCorners}
            />
            <ToggleRow
              label="Stud dimensions"
              checked={showStudDimensions}
              onChange={setShowStudDimensions}
            />
            <ToggleRow
              label="Openings"
              checked={showOpenings}
              onChange={setShowOpenings}
            />
          </div>
        </div>

        {showOpenings && (
          <div className="p-3 bg-zinc-700/30 rounded-lg space-y-3">
            <h3 className="text-sm font-medium text-zinc-300">Openings</h3>
            <p className="text-xs text-zinc-500">
              Choose whether the next wall click creates a plain opening or a
              window opening. Drag to reposition it.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setNewOpeningKind("opening")}
                className={`px-3 py-2 rounded text-xs transition-colors ${
                  newOpeningKind === "opening"
                    ? "bg-amber-400/90 text-zinc-900 font-medium"
                    : "bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                }`}
              >
                Plain opening
              </button>
              <button
                onClick={() => setNewOpeningKind("window")}
                className={`px-3 py-2 rounded text-xs transition-colors ${
                  newOpeningKind === "window"
                    ? "bg-cyan-400/90 text-zinc-900 font-medium"
                    : "bg-zinc-700/50 text-zinc-300 hover:bg-zinc-600/50"
                }`}
              >
                Window
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">
                  Width (dm)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={newOpeningWidthDm}
                  onChange={(event) =>
                    setNewOpeningWidthDm(
                      Math.max(1, Math.min(50, Number(event.target.value))),
                    )
                  }
                  className="w-full px-2 py-1 bg-zinc-700 text-zinc-200 text-sm rounded border border-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-zinc-400 mb-1">
                  Height (dm)
                </label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={newOpeningHeightDm}
                  onChange={(event) =>
                    setNewOpeningHeightDm(
                      Math.max(1, Math.min(40, Number(event.target.value))),
                    )
                  }
                  className="w-full px-2 py-1 bg-zinc-700 text-zinc-200 text-sm rounded border border-zinc-600 focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
            <div className="text-xs text-zinc-500">
              = {newOpeningWidthDm * 100} x {newOpeningHeightDm * 100} mm
            </div>

            {selectedOpeningId && (
              <button
                onClick={onOpeningRemove}
                className="w-full px-3 py-1.5 text-xs font-medium rounded bg-red-600/80 text-white hover:bg-red-500 transition-colors"
              >
                Remove selected opening
              </button>
            )}

            {Object.keys(wallOpenings).length > 0 && (
              <div className="space-y-1 pt-1 border-t border-zinc-600">
                {Object.entries(wallOpenings).map(([wallId, openings]) =>
                  openings.map((opening) => (
                    <button
                      key={opening.id}
                      onClick={() => onOpeningSelect(opening.id)}
                      className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                        opening.id === selectedOpeningId
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-600/50"
                      }`}
                    >
                      <span
                        className={`inline-block mr-1 rounded px-1 py-0.5 text-[10px] font-medium ${
                          windowOpeningIds[opening.id]
                            ? "bg-cyan-500/20 text-cyan-300"
                            : "bg-zinc-600/60 text-zinc-300"
                        }`}
                      >
                        {windowOpeningIds[opening.id] ? "window" : "opening"}
                      </span>
                      {wallId}: {Math.round(opening.width / 100)}x
                      {Math.round(opening.height / 100)} dm @{" "}
                      {Math.round(opening.left)} mm
                    </button>
                  )),
                )}
              </div>
            )}
          </div>
        )}

        <div className="p-3 bg-zinc-700/30 rounded-lg space-y-1">
          <h3 className="text-sm font-medium text-zinc-300">Layout summary</h3>
          <div className="text-xs text-zinc-400 space-y-0.5">
            <div>Wall count: {layout.walls.length}</div>
            <div>Outside insulation: {outsideInsulation} mm</div>
            <div>Ventilated facade air gap: {FACADE_AIR_GAP} mm</div>
            <div>
              Cladding profile: 22x{EXTERIOR_PANEL_BOARD_WIDTH} mm with{" "}
              {EXTERIOR_PANEL_OVERLAP_WIDTH}
              mm overlap, a {EXTERIOR_PANEL_REBATE_WIDTH} mm rebate, visible
              width {EXTERIOR_PANEL_VISIBLE_WIDTH}
              mm, rebate face angle {EXTERIOR_PANEL_REBATE_FACE_ANGLE} degrees,
              and {EXTERIOR_PANEL_FACE_CHAMFER}
              mm chamfered edges on{" "}
              {(showHorizontalExteriorPanel ? "vertical" : "horizontal") +
                " battens "}
              {BATTEN_THICKNESS} mm. Selected board length {panelBoardLength} mm
            </div>
            <div>
              Cladding orientation:{" "}
              {showStandingExteriorPanel
                ? "vertical"
                : showHorizontalExteriorPanel
                  ? "horizontal"
                  : "none selected"}
            </div>
            <div>
              Cladding finish:{" "}
              {showPrimedWhiteExteriorPanel ? "primed white" : "natural wood"}
            </div>
            <div>
              Comb strip: bent comb profile, projection {COMB_STRIP_PROJECTION}{" "}
              mm
            </div>
            <div>
              Outer perimeter:{" "}
              {(
                layout.walls.reduce(
                  (sum, wall) => sum + wall.centerlineLength,
                  0,
                ) / 1000
              ).toFixed(2)}{" "}
              m
            </div>
            <div>
              Effective wall length:{" "}
              {(
                layout.walls.reduce(
                  (sum, wall) => sum + wall.effectiveLength,
                  0,
                ) / 1000
              ).toFixed(2)}{" "}
              m
            </div>
            <div>
              Total stud count:{" "}
              {layout.walls.reduce(
                (sum, wall) => sum + wall.studLayout.studs.length,
                0,
              )}
            </div>
          </div>

          <div className="mt-2 pt-2 border-t border-zinc-600">
            <h4 className="text-xs font-medium text-zinc-400 mb-1">Per wall</h4>
            {layout.walls.map((wall) => (
              <div
                key={wall.id}
                className="text-xs text-zinc-500 flex justify-between"
              >
                <span>
                  {wall.id}{" "}
                  <span className="text-zinc-600">
                    [{wall.startCorner.joint[0].toUpperCase()}/
                    {wall.endCorner.joint[0].toUpperCase()}]
                  </span>
                </span>
                <span>
                  {(wall.effectiveLength / 1000).toFixed(2)}m ·{" "}
                  {wall.studLayout.studs.length} studs · c/c{" "}
                  {wall.studLayout.actualSpacing.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
