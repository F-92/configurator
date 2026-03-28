import { HouseConfig, PriceBreakdown } from "./types";

// Base prices per square meter (SEK)
const BASE_PRICES = {
  foundation: 2500,
  wall: {
    wood: 3200,
    brick: 4800,
    stucco: 3800,
    "fiber-cement": 4200,
  },
  roof: {
    tiles: 1800,
    metal: 1500,
    shingles: 1200,
  },
  window: {
    standard: 8500,
    picture: 12000,
    bay: 18000,
  },
  door: {
    standard: 12000,
    french: 18000,
    sliding: 22000,
  },
} as const;

// Roof type multipliers for complexity
const ROOF_MULTIPLIERS: Record<string, number> = {
  flat: 0.8,
  shed: 0.9,
  gable: 1.0,
  hip: 1.3,
};

export function calculatePrice(config: HouseConfig): PriceBreakdown {
  const floorArea = config.width * config.depth;
  const perimeter = 2 * (config.width + config.depth);
  const wallArea = perimeter * config.wallHeight;

  // Foundation: based on floor area
  const foundation = Math.round(floorArea * BASE_PRICES.foundation);

  // Walls: based on wall area and material
  const wallPricePerSqm = BASE_PRICES.wall[config.wallMaterial];
  const walls = Math.round(wallArea * wallPricePerSqm);

  // Roof: based on projected area * pitch factor * material * complexity
  const pitchRadians = (config.roofPitch * Math.PI) / 180;
  const roofAreaFactor =
    config.roofType === "flat" ? 1 : 1 / Math.cos(pitchRadians);
  const roofArea = config.width * config.depth * roofAreaFactor;
  const roofMaterialPrice = BASE_PRICES.roof[config.roofMaterial];
  const roofMultiplier = ROOF_MULTIPLIERS[config.roofType] ?? 1;
  const roof = Math.round(roofArea * roofMaterialPrice * roofMultiplier);

  // Windows: per-window price based on size and style
  const windows = config.windows.reduce((sum, w) => {
    const basePrice = BASE_PRICES.window[w.style];
    const sizeFactor = (w.width * w.height) / (1.2 * 1.2); // normalized to standard 1.2x1.2
    return sum + Math.round(basePrice * sizeFactor);
  }, 0);

  // Doors: per-door price based on style
  const doors = config.doors.reduce((sum, d) => {
    const basePrice = BASE_PRICES.door[d.style];
    const sizeFactor = (d.width * d.height) / (1.0 * 2.1); // normalized to standard door
    return sum + Math.round(basePrice * sizeFactor);
  }, 0);

  // Materials surcharge (transport, assembly overhead)
  const materials = Math.round((foundation + walls + roof) * 0.08);

  const total = foundation + walls + roof + windows + doors + materials;

  return { foundation, walls, roof, windows, doors, materials, total };
}

export function formatSEK(amount: number): string {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}
