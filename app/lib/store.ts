import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  HouseConfig,
  PriceBreakdown,
  ConstraintViolation,
  WindowConfig,
  DoorConfig,
  RoofType,
  WallMaterial,
  RoofMaterial,
} from "./types";
import { applyConstraints } from "./constraints";
import { calculatePrice } from "./pricing";

let nextWindowId = 1;
let nextDoorId = 1;

function makeWindowId() {
  return `w-${nextWindowId++}`;
}
function makeDoorId() {
  return `d-${nextDoorId++}`;
}

const DEFAULT_CONFIG: HouseConfig = {
  width: 10,
  depth: 8,
  wallHeight: 2.7,
  roofType: "gable",
  roofPitch: 25,
  roofOverhang: 0.4,
  roofMaterial: "tiles",
  wallMaterial: "wood",
  windows: [
    {
      id: "w-init-1",
      wall: "front",
      positionX: 0.25,
      positionY: 0.9,
      width: 1.2,
      height: 1.2,
      style: "standard",
    },
    {
      id: "w-init-2",
      wall: "front",
      positionX: 0.75,
      positionY: 0.9,
      width: 1.2,
      height: 1.2,
      style: "standard",
    },
    {
      id: "w-init-3",
      wall: "back",
      positionX: 0.5,
      positionY: 0.9,
      width: 1.6,
      height: 1.4,
      style: "picture",
    },
    {
      id: "w-init-4",
      wall: "left",
      positionX: 0.5,
      positionY: 0.9,
      width: 1.0,
      height: 1.0,
      style: "standard",
    },
    {
      id: "w-init-5",
      wall: "right",
      positionX: 0.5,
      positionY: 0.9,
      width: 1.0,
      height: 1.0,
      style: "standard",
    },
  ],
  doors: [
    {
      id: "d-init-1",
      wall: "front",
      positionX: 0.5,
      width: 1.0,
      height: 2.1,
      style: "standard",
    },
  ],
  wallColor: "#c4956a",
  roofColor: "#8b0000",
  trimColor: "#ffffff",
};

interface HouseStore {
  config: HouseConfig;
  price: PriceBreakdown;
  violations: ConstraintViolation[];
  activeStep: number;
  showFraming: boolean;
  showVerticalTopPlate: boolean;
  showTiles: boolean;
  showDimensions: boolean;

  setConfig: (partial: Partial<HouseConfig>) => void;
  setRoofType: (type: RoofType) => void;
  setWallMaterial: (material: WallMaterial) => void;
  setRoofMaterial: (material: RoofMaterial) => void;
  addWindow: (wall: WindowConfig["wall"]) => void;
  removeWindow: (id: string) => void;
  updateWindow: (id: string, update: Partial<WindowConfig>) => void;
  addDoor: (wall: DoorConfig["wall"]) => void;
  removeDoor: (id: string) => void;
  updateDoor: (id: string, update: Partial<DoorConfig>) => void;
  setActiveStep: (step: number) => void;
  toggleFraming: () => void;
  toggleVerticalTopPlate: () => void;
  toggleTiles: () => void;
  toggleDimensions: () => void;
  resetConfig: () => void;
}

function reconcile(config: HouseConfig) {
  const { config: constrained, violations } = applyConstraints(config);
  const price = calculatePrice(constrained);
  return { config: constrained, price, violations };
}

export const useHouseStore = create<HouseStore>()(
  persist(
    (set) => {
      const initial = reconcile(DEFAULT_CONFIG);
      return {
        config: initial.config,
        price: initial.price,
        violations: initial.violations,
        activeStep: 0,
        showFraming: false,
        showVerticalTopPlate: false,
        showTiles: true,
        showDimensions: false,

        setConfig: (partial) =>
          set((state) => {
            const merged = { ...state.config, ...partial };
            return reconcile(merged);
          }),

        setRoofType: (type) =>
          set((state) => {
            const merged = { ...state.config, roofType: type };
            if (type === "flat") merged.roofPitch = 0;
            else if (merged.roofPitch === 0) merged.roofPitch = 20;
            return reconcile(merged);
          }),

        setWallMaterial: (material) =>
          set((state) =>
            reconcile({ ...state.config, wallMaterial: material }),
          ),

        setRoofMaterial: (material) =>
          set((state) =>
            reconcile({ ...state.config, roofMaterial: material }),
          ),

        addWindow: (wall) =>
          set((state) => {
            const w: WindowConfig = {
              id: makeWindowId(),
              wall,
              positionX: 0.5,
              positionY: 0.9,
              width: 1.2,
              height: 1.2,
              style: "standard",
            };
            return reconcile({
              ...state.config,
              windows: [...state.config.windows, w],
            });
          }),

        removeWindow: (id) =>
          set((state) =>
            reconcile({
              ...state.config,
              windows: state.config.windows.filter((w) => w.id !== id),
            }),
          ),

        updateWindow: (id, update) =>
          set((state) =>
            reconcile({
              ...state.config,
              windows: state.config.windows.map((w) =>
                w.id === id ? { ...w, ...update } : w,
              ),
            }),
          ),

        addDoor: (wall) =>
          set((state) => {
            const d: DoorConfig = {
              id: makeDoorId(),
              wall,
              positionX: 0.5,
              width: 1.0,
              height: 2.1,
              style: "standard",
            };
            return reconcile({
              ...state.config,
              doors: [...state.config.doors, d],
            });
          }),

        removeDoor: (id) =>
          set((state) =>
            reconcile({
              ...state.config,
              doors: state.config.doors.filter((d) => d.id !== id),
            }),
          ),

        updateDoor: (id, update) =>
          set((state) =>
            reconcile({
              ...state.config,
              doors: state.config.doors.map((d) =>
                d.id === id ? { ...d, ...update } : d,
              ),
            }),
          ),

        setActiveStep: (step) => set({ activeStep: step }),

        toggleFraming: () =>
          set((state) => ({ showFraming: !state.showFraming })),

        toggleVerticalTopPlate: () =>
          set((state) => ({
            showVerticalTopPlate: !state.showVerticalTopPlate,
          })),

        toggleTiles: () => set((state) => ({ showTiles: !state.showTiles })),

        toggleDimensions: () =>
          set((state) => ({ showDimensions: !state.showDimensions })),

        resetConfig: () =>
          set({
            ...reconcile(DEFAULT_CONFIG),
            showFraming: false,
            showVerticalTopPlate: false,
            showTiles: true,
            showDimensions: false,
          }),
      };
    },
    {
      name: "house-configurator",
      partialize: (state) => ({
        config: state.config,
        activeStep: state.activeStep,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const result = reconcile(state.config);
          state.config = result.config;
          state.price = result.price;
          state.violations = result.violations;
        }
      },
    },
  ),
);
