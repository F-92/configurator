import * as THREE from "three";

let cachedTexture: THREE.CanvasTexture | null = null;

/** Seeded PRNG for deterministic textures */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Procedural pine wood grain texture — light Scandinavian pine */
export function getPineTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;

  const rand = mulberry32(42);
  const w = 512;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Light pine base
  ctx.fillStyle = "#f0dbb8";
  ctx.fillRect(0, 0, w, h);

  // Warm color variation patches across the surface
  for (let i = 0; i < 12; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const gr = 40 + rand() * 100;
    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    grad.addColorStop(0, `rgba(215, 180, 120, ${0.2 + rand() * 0.15})`);
    grad.addColorStop(1, "rgba(215, 180, 120, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Main grain lines — visible wood grain strokes along the length
  for (let i = 0; i < 120; i++) {
    const x = rand() * w;
    const lineW = 0.5 + rand() * 2.5;
    const alpha = 0.08 + rand() * 0.18;
    const dark = rand() > 0.35;
    ctx.strokeStyle = dark
      ? `rgba(155, 110, 55, ${alpha})`
      : `rgba(200, 170, 115, ${alpha + 0.04})`;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    const segments = 12 + Math.floor(rand() * 12);
    for (let s = 1; s <= segments; s++) {
      const sy = (s / segments) * h;
      const sx = x + (rand() - 0.5) * 5;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Earlywood / latewood annual ring bands — visible contrast
  for (let i = 0; i < 30; i++) {
    const y = rand() * h;
    const bandH = 2 + rand() * 8;
    const isLate = rand() > 0.5;
    ctx.fillStyle = isLate
      ? `rgba(170, 130, 70, ${0.12 + rand() * 0.1})`
      : `rgba(235, 210, 165, ${0.08 + rand() * 0.08})`;
    ctx.fillRect(0, y, w, bandH);
  }

  // Knots — clearly visible darker spots
  const knotCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < knotCount; i++) {
    const kx = 30 + rand() * (w - 60);
    const ky = 60 + rand() * (h - 120);
    const rx = 5 + rand() * 10;
    const ry = 8 + rand() * 14;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.max(rx, ry));
    grad.addColorStop(0, "rgba(120, 75, 30, 0.5)");
    grad.addColorStop(0.5, "rgba(145, 100, 50, 0.25)");
    grad.addColorStop(1, "rgba(200, 170, 120, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rings around knot
    for (let r = 0; r < 4; r++) {
      const ringR = rx + 3 + r * 4;
      ctx.strokeStyle = `rgba(140, 95, 45, ${0.12 - r * 0.025})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.ellipse(kx, ky, ringR, ringR * (ry / rx), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Very fine noise pass for micro-detail
  const imgData = ctx.getImageData(0, 0, w, h);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const noise = (rand() - 0.5) * 8;
    px[i] = Math.min(255, Math.max(0, px[i] + noise));
    px[i + 1] = Math.min(255, Math.max(0, px[i + 1] + noise));
    px[i + 2] = Math.min(255, Math.max(0, px[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cachedTexture = texture;
  return texture;
}
