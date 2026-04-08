import type {
  TrussGeometry,
  PointLoad,
  MemberResult,
  AnalysisResult,
  NodeDisplacement,
} from "./types";

/**
 * 2D truss analysis using the Direct Stiffness Method.
 *
 * Each node has 2 DOFs (dx, dy).
 * Each bar element has axial stiffness only (EA/L).
 * We assemble the global stiffness matrix, apply BCs, solve Ku=F,
 * then recover member axial forces.
 *
 * Sign convention: positive axial force = tension, negative = compression.
 */

/** Solve a system of linear equations Ax = b using Gaussian elimination with partial pivoting */
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;

  // Augmented matrix
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) {
      throw new Error(`Singular matrix at column ${col}`);
    }
    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    // Eliminate below
    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let sum = aug[row][n];
    for (let j = row + 1; j < n; j++) {
      sum -= aug[row][j] * x[j];
    }
    x[row] = sum / aug[row][row];
  }

  return x;
}

/**
 * Run the 2D truss analysis.
 * @param memberEAs - axial stiffness (E * A in kN) per member, in member-index order
 */
export function analyzeTruss(
  geometry: TrussGeometry,
  loads: PointLoad[],
  memberEAs: number[],
): AnalysisResult {
  const { nodes, members, supports } = geometry;
  const nNodes = nodes.length;
  const nDof = nNodes * 2;

  // Initialize global stiffness matrix and force vector
  const K: number[][] = Array.from({ length: nDof }, () =>
    new Array(nDof).fill(0),
  );
  const F: number[] = new Array(nDof).fill(0);

  // Assemble global stiffness matrix
  for (let mi = 0; mi < members.length; mi++) {
    const member = members[mi];
    const EA = memberEAs[mi];
    const n1 = nodes[member.startNodeId];
    const n2 = nodes[member.endNodeId];
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    const c = dx / L; // cos
    const s = dy / L; // sin

    const k = EA / L;

    // Local-to-global DOF mapping
    const dofs = [
      member.startNodeId * 2,
      member.startNodeId * 2 + 1,
      member.endNodeId * 2,
      member.endNodeId * 2 + 1,
    ];

    // Element stiffness in global coordinates (4x4)
    const ke = [
      [c * c, c * s, -c * c, -c * s],
      [c * s, s * s, -c * s, -s * s],
      [-c * c, -c * s, c * c, c * s],
      [-c * s, -s * s, c * s, s * s],
    ];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        K[dofs[i]][dofs[j]] += k * ke[i][j];
      }
    }
  }

  // Apply external loads
  for (const load of loads) {
    F[load.nodeId * 2] += load.fx;
    F[load.nodeId * 2 + 1] += load.fy;
  }

  // Apply boundary conditions using row/column elimination
  // (zero out constrained rows/columns, set diagonal to 1, RHS to 0)
  // This preserves numerical accuracy unlike the penalty method.
  const constrainedDofs: number[] = [];
  for (const support of supports) {
    constrainedDofs.push(support.nodeId * 2 + 1); // vertical always
    if (support.type === "pinned") {
      constrainedDofs.push(support.nodeId * 2); // horizontal for pinned
    }
  }
  for (const dof of constrainedDofs) {
    for (let j = 0; j < nDof; j++) {
      K[dof][j] = 0;
      K[j][dof] = 0;
    }
    K[dof][dof] = 1;
    F[dof] = 0;
  }

  // Solve for displacements
  const U = solveLinearSystem(K, F);

  // Recover member forces
  const memberResults: MemberResult[] = members.map((member, mi) => {
    const EA = memberEAs[mi];
    const n1 = nodes[member.startNodeId];
    const n2 = nodes[member.endNodeId];
    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const L = Math.sqrt(dx * dx + dy * dy);
    const c = dx / L;
    const s = dy / L;

    // Displacement components
    const u1 = U[member.startNodeId * 2];
    const v1 = U[member.startNodeId * 2 + 1];
    const u2 = U[member.endNodeId * 2];
    const v2 = U[member.endNodeId * 2 + 1];

    // Axial deformation: elongation along member axis
    const delta = c * (u2 - u1) + s * (v2 - v1);

    // Axial force: positive = tension, negative = compression
    const axialForce = (EA / L) * delta;

    return {
      memberId: member.id,
      label: member.label,
      group: member.group,
      length: L,
      axialForce,
    };
  });

  // Extract node displacements
  const displacements: NodeDisplacement[] = nodes.map((node) => ({
    nodeId: node.id,
    dx: U[node.id * 2],
    dy: U[node.id * 2 + 1],
  }));

  return { memberResults, displacements };
}
