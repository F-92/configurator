import type {
  TrussNode,
  TrussMember,
  TrussGeometry,
  Support,
  LoadCase,
  TrussInput,
} from "./types";

/**
 * Generate a symmetric W-fackverksstol (Fink truss) geometry with a dynamic
 * number of top-chord panels.
 *
 * Node layout for nPanels = 4 (the classic 7-node case):
 *
 *              N5 (L/2, h)  ← ridge
 *             / \
 *            /   \
 *        N4 /     \ N6      ← rafter panel points
 *          /|\   /|\
 *         / | \ / | \
 *        /  | X   |  \
 *       /   |/ \  |   \
 *      N0---N1----N2---N3
 *      (0) (L/3) (2L/3) (L)
 *
 * For N panels: 2N − 1 nodes, N − 1 bottom-chord segments, N top-chord
 * segments, 2N − 4 web diagonals in the W pattern.
 *
 * @param nPanels - total top-chord panels (must be even, ≥ 4). Default 4.
 */
export function generateFinkGeometry(
  span: number,
  pitchDeg: number,
  nPanels: number = 4,
): TrussGeometry {
  if (nPanels < 4 || nPanels % 2 !== 0) {
    throw new Error("nPanels must be even and ≥ 4");
  }

  const L = span;
  const h = (L / 2) * Math.tan((pitchDeg * Math.PI) / 180);
  const k = nPanels / 2; // panels per rafter side
  const nBC = nPanels; // bottom chord node count (incl. supports)

  // ── Nodes ──────────────────────────────────────────────────────────────────

  const nodes: TrussNode[] = [];

  // Bottom chord: nBC nodes evenly spaced along the span
  for (let i = 0; i < nBC; i++) {
    const x = (i * L) / (nBC - 1);
    nodes.push({
      id: i,
      x,
      y: 0,
      label:
        i === 0
          ? "A (left support)"
          : i === nBC - 1
            ? "D (right support)"
            : `BC-${i}`,
    });
  }

  // Left rafter interior nodes (j = 1 … k−1)
  for (let j = 1; j < k; j++) {
    const frac = j / k;
    nodes.push({
      id: nBC + j - 1,
      x: (frac * L) / 2,
      y: frac * h,
      label: `TC-L${j}`,
    });
  }

  // Ridge
  const ridgeId = nBC + k - 1;
  nodes.push({ id: ridgeId, x: L / 2, y: h, label: "Ridge" });

  // Right rafter interior nodes (mirror of left, j = 1 … k−1)
  for (let j = 1; j < k; j++) {
    nodes.push({
      id: ridgeId + j,
      x: L / 2 + (j * L) / (2 * k),
      y: (h * (k - j)) / k,
      label: `TC-R${j}`,
    });
  }

  // ── Members ────────────────────────────────────────────────────────────────

  const members: TrussMember[] = [];
  let mid = 0;

  // Bottom chord segments (nBC − 1)
  for (let i = 0; i < nBC - 1; i++) {
    members.push({
      id: mid++,
      startNodeId: i,
      endNodeId: i + 1,
      label: `BC-${i + 1}`,
      group: "bottomChord",
    });
  }

  // Top chord sequence: support → left interior → ridge → right interior → support
  const tcSeq: number[] = [0];
  for (let j = 1; j < k; j++) tcSeq.push(nBC + j - 1);
  tcSeq.push(ridgeId);
  for (let j = 1; j < k; j++) tcSeq.push(ridgeId + j);
  tcSeq.push(nBC - 1);

  for (let i = 0; i < tcSeq.length - 1; i++) {
    members.push({
      id: mid++,
      startNodeId: tcSeq[i],
      endNodeId: tcSeq[i + 1],
      label: `TC-${i + 1}`,
      group: "topChord",
    });
  }

  // Web diagonals — W pattern
  // Left half: alternate TC-interior↘BC-interior, BC-interior↗(next TC or ridge)
  const leftTC: number[] = [];
  for (let j = 1; j < k; j++) leftTC.push(nBC + j - 1);
  const leftBC: number[] = [];
  for (let j = 1; j < k; j++) leftBC.push(j);

  let webNum = 1;
  for (let i = 0; i < k - 1; i++) {
    // Down diagonal: TC interior → BC interior
    members.push({
      id: mid++,
      startNodeId: leftTC[i],
      endNodeId: leftBC[i],
      label: `W-${webNum++}`,
      group: "web",
    });
    // Up diagonal: BC interior → next TC interior or ridge
    members.push({
      id: mid++,
      startNodeId: leftBC[i],
      endNodeId: i < k - 2 ? leftTC[i + 1] : ridgeId,
      label: `W-${webNum++}`,
      group: "web",
    });
  }

  // Right half (mirror): ridge↘BC, BC↗TC-interior, TC-interior↘BC, …
  const rightTC: number[] = [];
  for (let j = 1; j < k; j++) rightTC.push(ridgeId + j);
  const rightBC: number[] = [];
  for (let j = 0; j < k - 1; j++) rightBC.push(k + j);

  for (let i = 0; i < k - 1; i++) {
    // Down diagonal: ridge/TC-interior → BC interior
    members.push({
      id: mid++,
      startNodeId: i === 0 ? ridgeId : rightTC[i - 1],
      endNodeId: rightBC[i],
      label: `W-${webNum++}`,
      group: "web",
    });
    // Up diagonal: BC interior → TC interior
    members.push({
      id: mid++,
      startNodeId: rightBC[i],
      endNodeId: rightTC[i],
      label: `W-${webNum++}`,
      group: "web",
    });
  }

  // ── Supports ───────────────────────────────────────────────────────────────

  const supports: Support[] = [
    { nodeId: 0, type: "pinned" },
    { nodeId: nBC - 1, type: "roller" },
  ];

  return { nodes, members, supports };
}

/**
 * Compute structural loads as nodal vertical forces (truss-style).
 *
 * Dead load acts on the roof slope surface; snow load acts on plan projection.
 * The total vertical line load along the slope is converted to point loads at
 * each top-chord node using tributary lengths: each node receives the load from
 * half of each adjacent top-chord member.
 *
 * @param factored - if true, apply ULS factors (1.35G + 1.5Q); if false, use characteristic loads (SLS)
 */
export function computeLoads(
  input: TrussInput,
  geometry: TrussGeometry,
  factored: boolean,
): LoadCase {
  const { pitch, spacing, deadLoad, snowLoad } = input;
  const pitchRad = (pitch * Math.PI) / 180;
  const isTraguiden = input.mode === "traguiden";

  // Dead load per m² — TräGuiden treats it on plan projection,
  // full_frame treats it on slope surface.
  // Snow load is always on horizontal projection.
  const deadLineLoad = isTraguiden
    ? deadLoad * spacing * Math.cos(pitchRad) // kN/m along slope (from plan)
    : deadLoad * spacing; // kN/m along slope (from slope area)
  const snowLineLoad = snowLoad * spacing; // kN/m on plan projection

  // ULS load factors per EKS 11:
  // - TräGuiden: EKS 6.10a (ξ=0.89 → γG=1.2, γQ=1.5) — governs for snow
  // - Full frame: conservative 6.10 (γG=1.35, γQ=1.5)
  const gammaG = factored ? (isTraguiden ? 1.2 : 1.35) : 1.0;
  const gammaQ = factored ? 1.5 : 1.0;

  // Total vertical load per unit slope length (kN/m along slope, acting downward)
  const totalVerticalLoad =
    gammaG * deadLineLoad + gammaQ * snowLineLoad * Math.cos(pitchRad);

  // Compute tributary slope length at each top-chord node.
  // Each node gets half of the length from each adjacent TC member.
  const topChordMembers = geometry.members.filter(
    (m) => m.group === "topChord",
  );
  const tributaryLength = new Map<number, number>();
  for (const member of topChordMembers) {
    const start = geometry.nodes[member.startNodeId];
    const end = geometry.nodes[member.endNodeId];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const half = length / 2;
    tributaryLength.set(
      member.startNodeId,
      (tributaryLength.get(member.startNodeId) ?? 0) + half,
    );
    tributaryLength.set(
      member.endNodeId,
      (tributaryLength.get(member.endNodeId) ?? 0) + half,
    );
  }

  // Convert to downward vertical point loads at each top-chord node
  const pointLoads = Array.from(tributaryLength.entries()).map(
    ([nodeId, trib]) => ({
      nodeId,
      fx: 0,
      fy: -totalVerticalLoad * trib, // downward = negative
    }),
  );

  return {
    pointLoads,
    memberLoads: [],
  };
}
