# Configurator Structure

This folder contains the scene-specific pieces used by the main configurator page.

## Main flow

- `Configurator.tsx`: top-level composition. It wires the sidebar, viewport, and scene together.
- `useConfiguratorState.ts`: owns UI state, derived layouts, camera state, and opening handlers.
- `ConfiguratorViewport.tsx`: owns the React Three Fiber canvas shell, camera controls, lights, and viewport actions.
- `ConfiguratorScene.tsx`: builds the 3D scene from the current state and layout data.

## UI

- `ConfiguratorSidebar.tsx`: control panel for presets, wall settings, layers, labels, and openings.

## Scene renderers

- `StructuralRenderers.tsx`: framing, base wall surfaces, insulation, installation layer, and outside drywall.
- `FinishRenderers.tsx`: house wrap, comb strip, battens, facade panels, vapor barrier, OSB, and drywall boards.
- `OpeningOverlays.tsx`: opening outlines, measurements, and drag/add interaction surfaces.
- `SceneOverlays.tsx`: slab, wall labels, corner markers, layer corner markers, and stud dimensions.

## Supporting scene logic

- `../../lib/configuratorScene/constants.ts`: scene-facing constants, preset definitions, and shared types.
- `../../lib/configuratorScene/helpers.ts`: reusable geometry and material helpers used by the renderers.

## Practical rule of thumb

- Put React state and orchestration in `useConfiguratorState.ts`.
- Put scene composition in `ConfiguratorScene.tsx`.
- Put renderer families in the matching renderer module.
- Put pure geometry, texture, and numeric helpers in `app/lib`.
