import type {
  TrussGeometry,
  LoadCase,
  MemberResult,
  AnalysisResult,
  NodeDisplacement,
} from "./types";

type Matrix = number[][];
type Vector = number[];

type FrameEndDofs = {
  start: number;
  end: number;
};

function zeros(length: number): number[] {
  return new Array(length).fill(0);
}

function zeroMatrix(size: number): Matrix {
  return Array.from({ length: size }, () => zeros(size));
}

function transpose(matrix: Matrix): Matrix {
  return matrix[0].map((_, col) => matrix.map((row) => row[col]));
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  return left.map((row) =>
    right[0].map((_, col) =>
      row.reduce((sum, value, index) => sum + value * right[index][col], 0),
    ),
  );
}

function multiplyMatrixVector(matrix: Matrix, vector: Vector): Vector {
  return matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0),
  );
}

function addVectorInPlace(
  target: Vector,
  indices: number[],
  values: Vector,
): void {
  for (let i = 0; i < indices.length; i++) {
    target[indices[i]] += values[i];
  }
}

function addMatrixInPlace(
  target: Matrix,
  indices: number[],
  values: Matrix,
): void {
  for (let i = 0; i < indices.length; i++) {
    for (let j = 0; j < indices.length; j++) {
      target[indices[i]][indices[j]] += values[i][j];
    }
  }
}

function addRotationalSpring(
  matrix: Matrix,
  dofA: number,
  dofB: number,
  stiffness: number,
): void {
  matrix[dofA][dofA] += stiffness;
  matrix[dofA][dofB] -= stiffness;
  matrix[dofB][dofA] -= stiffness;
  matrix[dofB][dofB] += stiffness;
}

function buildFrameTransformationMatrix(c: number, s: number): Matrix {
  return [
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1],
  ];
}

function buildFrameLocalStiffness(
  EA: number,
  EI: number,
  length: number,
): Matrix {
  const l2 = length * length;
  const l3 = l2 * length;
  return [
    [EA / length, 0, 0, -EA / length, 0, 0],
    [0, (12 * EI) / l3, (6 * EI) / l2, 0, (-12 * EI) / l3, (6 * EI) / l2],
    [0, (6 * EI) / l2, (4 * EI) / length, 0, (-6 * EI) / l2, (2 * EI) / length],
    [-EA / length, 0, 0, EA / length, 0, 0],
    [0, (-12 * EI) / l3, (-6 * EI) / l2, 0, (12 * EI) / l3, (-6 * EI) / l2],
    [0, (6 * EI) / l2, (2 * EI) / length, 0, (-6 * EI) / l2, (4 * EI) / length],
  ];
}

function buildFrameUniformLoadVector(
  length: number,
  qx: number,
  qy: number,
): Vector {
  return [
    (qx * length) / 2,
    (qy * length) / 2,
    (qy * length * length) / 12,
    (qx * length) / 2,
    (qy * length) / 2,
    (-qy * length * length) / 12,
  ];
}

function buildTrussGlobalStiffness(
  EA: number,
  length: number,
  c: number,
  s: number,
): Matrix {
  const k = EA / length;
  return [
    [k * c * c, k * c * s, -k * c * c, -k * c * s],
    [k * c * s, k * s * s, -k * c * s, -k * s * s],
    [-k * c * c, -k * c * s, k * c * c, k * c * s],
    [-k * c * s, -k * s * s, k * c * s, k * s * s],
  ];
}

function getNodeTranslationalDofs(nodeId: number): [number, number] {
  return [nodeId * 2, nodeId * 2 + 1];
}

function getFrameElementDofs(
  startNodeId: number,
  endNodeId: number,
  frameEndDofs: FrameEndDofs,
): number[] {
  return [
    startNodeId * 2,
    startNodeId * 2 + 1,
    frameEndDofs.start,
    endNodeId * 2,
    endNodeId * 2 + 1,
    frameEndDofs.end,
  ];
}

function getMaxAbsMoment(
  startMoment: number,
  startShear: number,
  qy: number,
  length: number,
  endMoment: number,
): number {
  let maxMoment = Math.max(Math.abs(startMoment), Math.abs(endMoment));

  if (Math.abs(qy) > 1e-12) {
    const criticalX = -startShear / qy;
    if (criticalX > 0 && criticalX < length) {
      const criticalMoment =
        startMoment + startShear * criticalX + (qy * criticalX * criticalX) / 2;
      maxMoment = Math.max(maxMoment, Math.abs(criticalMoment));
    }
  }

  return maxMoment;
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length;
  const aug: number[][] = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
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

    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = aug[row][col] / aug[col][col];
      for (let j = col; j <= n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

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
 * 2D hybrid frame-truss analysis.
 *
 * Shared nodal DOFs: ux, uy.
 * Top chord members receive independent end-rotation DOFs.
 * Semi-rigid joints are modeled by rotational springs between adjacent
 * top-chord member-end rotations at the same joint.
 */
export function analyzeTruss(
  geometry: TrussGeometry,
  loads: LoadCase,
  memberEAs: number[],
  memberEIs: number[],
  jointRotationalStiffness: number,
): AnalysisResult {
  const { nodes, members, supports } = geometry;
  const topChordMembers = members.filter(
    (member) => member.group === "topChord",
  );
  const rotationalDofOffset = nodes.length * 2;
  const frameEndDofMap = new Map<number, FrameEndDofs>();
  const nodeFrameRotationDofs = new Map<number, number[]>();

  topChordMembers.forEach((member, index) => {
    const frameEndDofs = {
      start: rotationalDofOffset + index * 2,
      end: rotationalDofOffset + index * 2 + 1,
    };
    frameEndDofMap.set(member.id, frameEndDofs);

    const startList = nodeFrameRotationDofs.get(member.startNodeId) ?? [];
    startList.push(frameEndDofs.start);
    nodeFrameRotationDofs.set(member.startNodeId, startList);

    const endList = nodeFrameRotationDofs.get(member.endNodeId) ?? [];
    endList.push(frameEndDofs.end);
    nodeFrameRotationDofs.set(member.endNodeId, endList);
  });

  const nDof = nodes.length * 2 + topChordMembers.length * 2;
  const K = zeroMatrix(nDof);
  const F = zeros(nDof);
  const memberLoads = new Map(
    loads.memberLoads.map((load) => [load.memberId, load]),
  );

  for (let mi = 0; mi < members.length; mi++) {
    const member = members[mi];
    const EA = memberEAs[mi];
    const EI = memberEIs[mi];
    const startNode = nodes[member.startNodeId];
    const endNode = nodes[member.endNodeId];
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const c = dx / length;
    const s = dy / length;

    if (member.group === "topChord") {
      const frameEndDofs = frameEndDofMap.get(member.id);
      if (!frameEndDofs) {
        throw new Error(`Missing frame DOFs for member ${member.id}`);
      }

      const dofs = getFrameElementDofs(
        member.startNodeId,
        member.endNodeId,
        frameEndDofs,
      );
      const transformation = buildFrameTransformationMatrix(c, s);
      const localStiffness = buildFrameLocalStiffness(EA, EI, length);
      const globalStiffness = multiplyMatrices(
        transpose(transformation),
        multiplyMatrices(localStiffness, transformation),
      );
      addMatrixInPlace(K, dofs, globalStiffness);

      const memberLoad = memberLoads.get(member.id);
      if (memberLoad) {
        const fixedEndLocal = buildFrameUniformLoadVector(
          length,
          memberLoad.qx,
          memberLoad.qy,
        );
        const fixedEndGlobal = multiplyMatrixVector(
          transpose(transformation),
          fixedEndLocal,
        );
        addVectorInPlace(F, dofs, fixedEndGlobal);
      }
    } else {
      const dofs = [
        ...getNodeTranslationalDofs(member.startNodeId),
        ...getNodeTranslationalDofs(member.endNodeId),
      ];
      const globalStiffness = buildTrussGlobalStiffness(EA, length, c, s);
      addMatrixInPlace(K, dofs, globalStiffness);
    }
  }

  for (const rotationDofs of nodeFrameRotationDofs.values()) {
    if (jointRotationalStiffness > 0 && rotationDofs.length >= 2) {
      const anchor = rotationDofs[0];
      for (let i = 1; i < rotationDofs.length; i++) {
        addRotationalSpring(
          K,
          anchor,
          rotationDofs[i],
          jointRotationalStiffness,
        );
      }
    }
  }

  for (const load of loads.pointLoads) {
    F[load.nodeId * 2] += load.fx;
    F[load.nodeId * 2 + 1] += load.fy;

    const rotationDofs = nodeFrameRotationDofs.get(load.nodeId) ?? [];
    if ((load.mz ?? 0) !== 0 && rotationDofs.length > 0) {
      const share = (load.mz ?? 0) / rotationDofs.length;
      for (const dof of rotationDofs) {
        F[dof] += share;
      }
    }
  }

  const constrainedDofs: number[] = [];
  for (const support of supports) {
    constrainedDofs.push(support.nodeId * 2 + 1);
    if (support.type === "pinned") {
      constrainedDofs.push(support.nodeId * 2);
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

  const U = solveLinearSystem(K, F);

  const memberResults: MemberResult[] = members.map((member, mi) => {
    const EA = memberEAs[mi];
    const EI = memberEIs[mi];
    const startNode = nodes[member.startNodeId];
    const endNode = nodes[member.endNodeId];
    const dx = endNode.x - startNode.x;
    const dy = endNode.y - startNode.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const c = dx / length;
    const s = dy / length;

    if (member.group === "topChord") {
      const frameEndDofs = frameEndDofMap.get(member.id);
      if (!frameEndDofs) {
        throw new Error(`Missing frame DOFs for member ${member.id}`);
      }

      const dofs = getFrameElementDofs(
        member.startNodeId,
        member.endNodeId,
        frameEndDofs,
      );
      const elementDisplacements = dofs.map((dof) => U[dof]);
      const transformation = buildFrameTransformationMatrix(c, s);
      const localDisplacements = multiplyMatrixVector(
        transformation,
        elementDisplacements,
      );
      const localStiffness = buildFrameLocalStiffness(EA, EI, length);
      const memberLoad = memberLoads.get(member.id);
      const fixedEndLocal = memberLoad
        ? buildFrameUniformLoadVector(length, memberLoad.qx, memberLoad.qy)
        : zeros(6);
      const localEndForces = multiplyMatrixVector(
        localStiffness,
        localDisplacements,
      ).map((value, index) => value - fixedEndLocal[index]);

      const startAxialForce = -localEndForces[0];
      const endAxialForce = localEndForces[3];
      const startShearForce = localEndForces[1];
      const endShearForce = -localEndForces[4];
      const startMoment = -localEndForces[2];
      const endMoment = localEndForces[5];
      const maxAbsMoment = getMaxAbsMoment(
        startMoment,
        startShearForce,
        memberLoad?.qy ?? 0,
        length,
        endMoment,
      );
      const axialForce =
        Math.abs(startAxialForce) >= Math.abs(endAxialForce)
          ? startAxialForce
          : endAxialForce;

      return {
        memberId: member.id,
        label: member.label,
        group: member.group,
        length,
        axialForce,
        startAxialForce,
        endAxialForce,
        startShearForce,
        endShearForce,
        startMoment,
        endMoment,
        maxAbsMoment,
      };
    }

    const [startUxDof, startUyDof] = getNodeTranslationalDofs(
      member.startNodeId,
    );
    const [endUxDof, endUyDof] = getNodeTranslationalDofs(member.endNodeId);
    const axialDeformation =
      c * (U[endUxDof] - U[startUxDof]) + s * (U[endUyDof] - U[startUyDof]);
    const axialForce = (EA / length) * axialDeformation;

    return {
      memberId: member.id,
      label: member.label,
      group: member.group,
      length,
      axialForce,
      startAxialForce: axialForce,
      endAxialForce: axialForce,
      startShearForce: 0,
      endShearForce: 0,
      startMoment: 0,
      endMoment: 0,
      maxAbsMoment: 0,
    };
  });

  const displacements: NodeDisplacement[] = nodes.map((node) => {
    const rotationDofs = nodeFrameRotationDofs.get(node.id) ?? [];
    const rotation =
      rotationDofs.length > 0
        ? rotationDofs.reduce((sum, dof) => sum + U[dof], 0) /
          rotationDofs.length
        : 0;

    return {
      nodeId: node.id,
      dx: U[node.id * 2],
      dy: U[node.id * 2 + 1],
      rotation,
    };
  });

  return { memberResults, displacements };
}
