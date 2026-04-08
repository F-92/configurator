import type {
  TrussNode,
  TrussMember,
  TrussGeometry,
  Support,
  PointLoad,
  TrussInput,
} from "./types";

/**
 * Generate a symmetric W-fackverksstol (Fink truss) geometry.
 *
 * 7-node layout per TräGuiden Takstolshandboken §4.2.2:
 *
 *              N5 (L/2, h)  ← ridge
 *             / \
 *            /   \
 *        N4 /     \ N6      ← rafter midpoints
 *          /|\   /|\
 *         / | \ / | \
 *        /  | X   |  \
 *       /   |/ \  |   \
 *      N0---N1----N2---N3
 *      (0) (L/3) (2L/3) (L)
 *
 * Bottom chord: 3 segments (N0→N1→N2→N3)
 * Top chord: 4 segments (N0→N4→N5→N6→N3)
 * Web W-pattern: N4→N1, N1→N5, N5→N2, N2→N6  (\/\/ = W)
 * No king post. No midspan bottom node.
 */
export function generateFinkGeometry(
  span: number,
  pitchDeg: number,
): TrussGeometry {
  const L = span;
  const h = (L / 2) * Math.tan((pitchDeg * Math.PI) / 180);

  // Nodes
  const nodes: TrussNode[] = [
    { id: 0, x: 0, y: 0, label: "A (left support)" },
    { id: 1, x: L / 3, y: 0, label: "B (⅓ span)" },
    { id: 2, x: (2 * L) / 3, y: 0, label: "C (⅔ span)" },
    { id: 3, x: L, y: 0, label: "D (right support)" },
    { id: 4, x: L / 4, y: h / 2, label: "E (left rafter mid)" },
    { id: 5, x: L / 2, y: h, label: "F (ridge)" },
    { id: 6, x: (3 * L) / 4, y: h / 2, label: "G (right rafter mid)" },
  ];

  // Members (11 total)
  const members: TrussMember[] = [
    // Bottom chord (3 segments)
    {
      id: 0,
      startNodeId: 0,
      endNodeId: 1,
      label: "BC-1",
      group: "bottomChord",
    },
    {
      id: 1,
      startNodeId: 1,
      endNodeId: 2,
      label: "BC-2",
      group: "bottomChord",
    },
    {
      id: 2,
      startNodeId: 2,
      endNodeId: 3,
      label: "BC-3",
      group: "bottomChord",
    },
    // Top chord (4 segments: left rafter + right rafter)
    { id: 3, startNodeId: 0, endNodeId: 4, label: "TC-1", group: "topChord" },
    { id: 4, startNodeId: 4, endNodeId: 5, label: "TC-2", group: "topChord" },
    { id: 5, startNodeId: 5, endNodeId: 6, label: "TC-3", group: "topChord" },
    { id: 6, startNodeId: 6, endNodeId: 3, label: "TC-4", group: "topChord" },
    // W-web diagonals (\/\/ pattern — all slanted, no verticals)
    { id: 7, startNodeId: 4, endNodeId: 1, label: "W-1", group: "web" },
    { id: 8, startNodeId: 1, endNodeId: 5, label: "W-2", group: "web" },
    { id: 9, startNodeId: 5, endNodeId: 2, label: "W-3", group: "web" },
    { id: 10, startNodeId: 2, endNodeId: 6, label: "W-4", group: "web" },
  ];

  // Supports: pinned at left, roller at right
  const supports: Support[] = [
    { nodeId: 0, type: "pinned" },
    { nodeId: 3, type: "roller" },
  ];

  return { nodes, members, supports };
}

/**
 * Compute point loads at top chord nodes from distributed area loads.
 * Dead load acts on the slope surface; snow load acts on plan projection.
 * Both are multiplied by truss spacing to get line loads, then distributed to nodes.
 *
 * @param factored - if true, apply ULS factors (1.35G + 1.5Q); if false, use characteristic loads (SLS)
 */
export function computeLoads(
  input: TrussInput,
  factored: boolean,
): PointLoad[] {
  const { span, pitch, spacing, deadLoad, snowLoad } = input;
  const pitchRad = (pitch * Math.PI) / 180;

  // Half-span on slope
  const halfSlopeLength = span / 2 / Math.cos(pitchRad);

  // Dead load is treated on the roof slope.
  const deadLineLoad = deadLoad * spacing; // kN/m along slope
  // Snow load is treated on horizontal projection without cos(pitch) reduction.
  const snowLineLoad = snowLoad * spacing; // kN/m on horizontal projection

  // Apply ULS load factors or use characteristic (SLS)
  const gammaG = factored ? 1.35 : 1.0;
  const gammaQ = factored ? 1.5 : 1.0;

  const slopeSegLen = halfSlopeLength / 2; // one top chord segment length on slope
  const horizontalSegLen = span / 4; // one panel width in horizontal projection

  const loadAtSupport =
    gammaG * deadLineLoad * (slopeSegLen / 2) +
    gammaQ * snowLineLoad * (horizontalSegLen / 2);
  const loadAtMid =
    gammaG * deadLineLoad * slopeSegLen +
    gammaQ * snowLineLoad * horizontalSegLen;

  const loads: PointLoad[] = [
    { nodeId: 0, fx: 0, fy: -loadAtSupport },
    { nodeId: 4, fx: 0, fy: -loadAtMid },
    { nodeId: 5, fx: 0, fy: -loadAtMid },
    { nodeId: 6, fx: 0, fy: -loadAtMid },
    { nodeId: 3, fx: 0, fy: -loadAtSupport },
  ];

  return loads;
}
