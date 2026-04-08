import type { MemberResult, DesignCheck, TrussInput } from "./types";

/**
 * C24 timber properties per EN 338:2016
 */
const C24 = {
  fm_k: 24, // MPa - bending
  ft_0_k: 14, // MPa - tension parallel to grain
  fc_0_k: 21, // MPa - compression parallel to grain
  fv_k: 4.0, // MPa - shear
  E0_mean: 11_000, // MPa - mean modulus of elasticity
  E0_05: 7_400, // MPa - 5th percentile modulus
  rho_k: 350, // kg/m³ - characteristic density
};

/**
 * Eurocode 5 design parameters
 */
const EC5 = {
  gamma_M: 1.3, // partial safety factor for solid timber
  kmod: 0.8, // modification factor (medium-term load, service class 1-2)
  ksys: 1.1, // system strength factor (EC5 §6.6, EKS 11) — load-sharing
  // system with ≥3 members at ≤600mm battens/boarding
  beta_c: 0.2, // straightness factor for solid timber
  km: 0.7, // redistribution factor for rectangular sections
};

/** Compute kc (instability factor) for a given relative slenderness */
function computeKc(lambda_rel: number): number {
  if (lambda_rel <= 0.3) return 1.0;
  const k =
    0.5 * (1 + EC5.beta_c * (lambda_rel - 0.3) + lambda_rel * lambda_rel);
  return 1 / (k + Math.sqrt(k * k - lambda_rel * lambda_rel));
}

/** Compute relative slenderness from slenderness ratio */
function relativeSlenderness(lambda: number): number {
  return (lambda / Math.PI) * Math.sqrt(C24.fc_0_k / C24.E0_05);
}

/**
 * Check all members per Eurocode 5.
 * - Bottom chord / web tension: §6.1.2
 * - Web compression: §6.3.2 (axial only)
 * - Chord members: §6.3.2 combined bending + axial force where required
 *
 * @param memberResults - axial forces from ULS structural analysis
 * @param input - design input (for timber sizes and loading info)
 */
export function checkMembers(
  memberResults: MemberResult[],
  input: TrussInput,
): DesignCheck[] {
  const { timberWidth, topChordHeight, bottomChordHeight } = input;

  // Design strengths (including ksys for load-sharing systems, EC5 §6.6)
  const ft_0_d = (EC5.ksys * EC5.kmod * C24.ft_0_k) / EC5.gamma_M; // MPa
  const fc_0_d = (EC5.ksys * EC5.kmod * C24.fc_0_k) / EC5.gamma_M; // MPa
  const fm_d = (EC5.ksys * EC5.kmod * C24.fm_k) / EC5.gamma_M; // MPa

  // Top chord lateral bracing: assume battens at ~600mm spacing
  const battenSpacing = 0.6; // metres

  return memberResults.map((mr) => {
    const isTopChord = mr.group === "topChord";
    const heightMm = isTopChord ? topChordHeight : bottomChordHeight;
    const b = timberWidth; // mm
    const h = heightMm; // mm
    const A_mm2 = b * h;
    const W_mm3 = (b * h * h) / 6;
    const N = mr.axialForce; // kN
    const isTension = N >= 0;
    const M_bend = Math.abs(mr.maxAbsMoment);
    const sigma_m = W_mm3 > 0 ? (M_bend * 1e6) / W_mm3 : 0;
    const hasBending = M_bend > 1e-6;

    if (isTension && !hasBending) {
      // Pure tension check: §6.1.2
      const capacity_kN = (ft_0_d * A_mm2) / 1000;
      const utilization = Math.abs(N) / capacity_kN;
      return {
        memberId: mr.memberId,
        label: mr.label,
        group: mr.group,
        axialForce: N,
        bendingMoment: 0,
        capacity: capacity_kN,
        utilization,
        mode: "tension" as const,
        buckling: false,
        pass: utilization <= 1.0,
      };
    }

    // --- Compression (with or without bending) ---
    const N_abs = Math.abs(N);

    // Radii of gyration
    const i_strong = h / 1000 / Math.sqrt(12); // metres (in-plane, strong axis)
    const i_weak = b / 1000 / Math.sqrt(12); // metres (out-of-plane, weak axis)

    // Buckling lengths
    const L_inPlane = mr.length; // full member length between panel points
    // Out-of-plane: top chord braced by battens, others use full length
    const L_outOfPlane = isTopChord ? battenSpacing : mr.length;

    // Slenderness and kc for each axis
    const lambda_y = L_inPlane / i_strong;
    const lambda_z = L_outOfPlane / i_weak;
    const lambda_rel_y = relativeSlenderness(lambda_y);
    const lambda_rel_z = relativeSlenderness(lambda_z);
    const kc_y = computeKc(lambda_rel_y);
    const kc_z = computeKc(lambda_rel_z);
    const bucklingGoverns = lambda_rel_y > 0.3 || lambda_rel_z > 0.3;

    // Axial compression stress
    const sigma_c = (N_abs * 1000) / A_mm2; // MPa

    if (isTension) {
      const utilization = (N_abs * 1000) / (ft_0_d * A_mm2) + sigma_m / fm_d;
      const capacity_kN = utilization > 0 ? N_abs / utilization : 0;
      return {
        memberId: mr.memberId,
        label: mr.label,
        group: mr.group,
        axialForce: N,
        bendingMoment: M_bend,
        capacity: capacity_kN,
        utilization,
        mode: "combined" as const,
        buckling: false,
        pass: utilization <= 1.0,
      };
    }

    if (!isTopChord && !hasBending) {
      // Pure compression check for web/bottom chord
      // Web members in nail-plated trusses are restrained out-of-plane
      // by the nail plates and chord connections → use in-plane kc only
      const isWeb = mr.group === "web";
      const kc_governing = isWeb ? kc_y : Math.min(kc_y, kc_z);
      const capacity_kN = (kc_governing * fc_0_d * A_mm2) / 1000;
      const utilization = N_abs / capacity_kN;
      return {
        memberId: mr.memberId,
        label: mr.label,
        group: mr.group,
        axialForce: N,
        bendingMoment: 0,
        capacity: capacity_kN,
        utilization,
        mode: "compression" as const,
        buckling: bucklingGoverns,
        pass: utilization <= 1.0,
      };
    }

    // --- Chord compression with bending (EC5 §6.3.2) ---
    const util_623 = sigma_c / (kc_y * fc_0_d) + sigma_m / fm_d;
    const util_624 = sigma_c / (kc_z * fc_0_d) + (EC5.km * sigma_m) / fm_d;

    const utilization = Math.max(util_623, util_624);
    // Capacity expressed as equivalent axial capacity for display
    const capacity_kN = N_abs / utilization;

    return {
      memberId: mr.memberId,
      label: mr.label,
      group: mr.group,
      axialForce: N,
      bendingMoment: M_bend,
      capacity: capacity_kN,
      utilization,
      mode: "combined" as const,
      buckling: bucklingGoverns,
      pass: utilization <= 1.0,
    };
  });
}

/**
 * Return C24 axial stiffness EA in kN for a given cross-section.
 */
export function getEA(widthMm: number, heightMm: number): number {
  const A_m2 = (widthMm / 1000) * (heightMm / 1000); // m²
  const E_kPa = C24.E0_mean * 1000; // MPa → kN/m²
  return E_kPa * A_m2; // kN
}

/**
 * Return C24 flexural stiffness EI in kNm² for a given cross-section.
 */
export function getEI(widthMm: number, heightMm: number): number {
  const b = widthMm / 1000;
  const h = heightMm / 1000;
  const I_m4 = (b * h * h * h) / 12;
  const E_kNm2 = C24.E0_mean * 1000;
  return E_kNm2 * I_m4;
}
