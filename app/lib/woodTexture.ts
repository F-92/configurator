import * as THREE from "three";

let cachedTexture: THREE.CanvasTexture | null = null;
let cachedOsbTexture: THREE.CanvasTexture | null = null;
let cachedLightPineTexture: THREE.CanvasTexture | null = null;
let cachedFacadePineTexture: THREE.CanvasTexture | null = null;

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

/** Lighter and cleaner pine texture tuned for visible facade cladding */
export function getLightPineTexture(): THREE.CanvasTexture {
  if (cachedLightPineTexture) return cachedLightPineTexture;

  const rand = mulberry32(31415);
  const w = 512;
  const h = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const baseGradient = ctx.createLinearGradient(0, 0, 0, h);
  baseGradient.addColorStop(0, "#f6e7cb");
  baseGradient.addColorStop(0.5, "#f1ddb8");
  baseGradient.addColorStop(1, "#ead2a8");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 16; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const radius = 70 + rand() * 150;
    const gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
    gradient.addColorStop(0, `rgba(255, 245, 220, ${0.1 + rand() * 0.06})`);
    gradient.addColorStop(0.65, `rgba(226, 194, 142, ${0.08 + rand() * 0.08})`);
    gradient.addColorStop(1, "rgba(226, 194, 142, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  for (let i = 0; i < 170; i++) {
    const x = rand() * w;
    const lineW = 0.5 + rand() * 2.2;
    const alpha = 0.06 + rand() * 0.12;
    ctx.strokeStyle =
      rand() > 0.25
        ? `rgba(178, 135, 77, ${alpha})`
        : `rgba(232, 204, 160, ${alpha + 0.03})`;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    const segments = 14 + Math.floor(rand() * 12);
    for (let s = 1; s <= segments; s++) {
      const sy = (s / segments) * h;
      const sway = Math.sin(s * 0.8 + x * 0.04) * (1 + rand() * 1.2);
      const sx = x + sway + (rand() - 0.5) * 2;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 36; i++) {
    const y = rand() * h;
    const bandH = 2 + rand() * 6;
    ctx.fillStyle =
      rand() > 0.5
        ? `rgba(171, 128, 73, ${0.07 + rand() * 0.06})`
        : `rgba(247, 228, 191, ${0.05 + rand() * 0.04})`;
    ctx.fillRect(0, y, w, bandH);
  }

  const knotCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < knotCount; i++) {
    const kx = 60 + rand() * (w - 120);
    const ky = 100 + rand() * (h - 200);
    const rx = 5 + rand() * 8;
    const ry = 10 + rand() * 16;
    const gradient = ctx.createRadialGradient(
      kx,
      ky,
      0,
      kx,
      ky,
      Math.max(rx, ry) * 1.8,
    );
    gradient.addColorStop(0, "rgba(147, 102, 48, 0.34)");
    gradient.addColorStop(0.45, "rgba(182, 135, 78, 0.18)");
    gradient.addColorStop(1, "rgba(236, 208, 166, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    const noise = (rand() - 0.5) * 6 + 5;
    px[i] = Math.min(255, Math.max(0, px[i] + noise));
    px[i + 1] = Math.min(255, Math.max(0, px[i + 1] + noise));
    px[i + 2] = Math.min(255, Math.max(0, px[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  cachedLightPineTexture = texture;
  return texture;
}

/** Subtle planed pine texture tuned for painted or freshly milled facade boards */
export function getFacadePineTexture(): THREE.CanvasTexture {
  if (cachedFacadePineTexture) return cachedFacadePineTexture;

  const rand = mulberry32(271828);
  const w = 768;
  const h = 1536;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  const baseGradient = ctx.createLinearGradient(0, 0, 0, h);
  baseGradient.addColorStop(0, "#f6e9cf");
  baseGradient.addColorStop(0.45, "#f1e0c0");
  baseGradient.addColorStop(1, "#e8d0ab");
  ctx.fillStyle = baseGradient;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 10; i++) {
    const gx = rand() * w;
    const gy = rand() * h;
    const radius = 140 + rand() * 220;
    const gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
    gradient.addColorStop(0, `rgba(255, 247, 229, ${0.08 + rand() * 0.04})`);
    gradient.addColorStop(0.6, `rgba(225, 196, 148, ${0.04 + rand() * 0.04})`);
    gradient.addColorStop(1, "rgba(225, 196, 148, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }

  for (let i = 0; i < 220; i++) {
    const x = rand() * w;
    const alpha = 0.035 + rand() * 0.05;
    const width = 0.4 + rand() * 1.3;
    ctx.strokeStyle =
      rand() > 0.3
        ? `rgba(164, 123, 72, ${alpha})`
        : `rgba(241, 226, 195, ${alpha + 0.02})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    const segments = 20 + Math.floor(rand() * 12);
    for (let s = 1; s <= segments; s++) {
      const sy = (s / segments) * h;
      const sway = Math.sin(s * 0.7 + x * 0.018) * (0.5 + rand() * 1.1);
      ctx.lineTo(x + sway, sy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 50; i++) {
    const y = rand() * h;
    const bandH = 1 + rand() * 4;
    ctx.fillStyle =
      rand() > 0.5
        ? `rgba(173, 132, 80, ${0.03 + rand() * 0.03})`
        : `rgba(250, 240, 217, ${0.02 + rand() * 0.03})`;
    ctx.fillRect(0, y, w, bandH);
  }

  const knotCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < knotCount; i++) {
    const kx = 120 + rand() * (w - 240);
    const ky = 180 + rand() * (h - 360);
    const rx = 4 + rand() * 7;
    const ry = 9 + rand() * 12;
    const gradient = ctx.createRadialGradient(
      kx,
      ky,
      0,
      kx,
      ky,
      Math.max(rx, ry) * 2,
    );
    gradient.addColorStop(0, "rgba(150, 103, 54, 0.18)");
    gradient.addColorStop(0.45, "rgba(182, 136, 84, 0.1)");
    gradient.addColorStop(1, "rgba(238, 215, 177, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const imageData = ctx.getImageData(0, 0, w, h);
  const px = imageData.data;
  for (let i = 0; i < px.length; i += 4) {
    const noise = (rand() - 0.5) * 4 + 2;
    px[i] = Math.min(255, Math.max(0, px[i] + noise));
    px[i + 1] = Math.min(255, Math.max(0, px[i + 1] + noise));
    px[i + 2] = Math.min(255, Math.max(0, px[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  cachedFacadePineTexture = texture;
  return texture;
}

/** Procedural OSB board texture with layered wood flakes */
export function getOsbTexture(): THREE.CanvasTexture {
  if (cachedOsbTexture) return cachedOsbTexture;

  const rand = mulberry32(1337);
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ead2ad";
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 18; i++) {
    const gx = rand() * size;
    const gy = rand() * size;
    const radius = 80 + rand() * 180;
    const gradient = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
    gradient.addColorStop(0, `rgba(184, 145, 92, ${0.05 + rand() * 0.06})`);
    gradient.addColorStop(1, "rgba(184, 145, 92, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }

  const flakeColors = [
    "rgba(214, 180, 129, 0.5)",
    "rgba(198, 161, 110, 0.46)",
    "rgba(181, 139, 86, 0.4)",
    "rgba(232, 204, 157, 0.34)",
  ];

  for (let i = 0; i < 2200; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const width = 18 + rand() * 72;
    const height = 4 + rand() * 12;
    const angle = rand() * Math.PI * 2;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = flakeColors[Math.floor(rand() * flakeColors.length)];
    ctx.beginPath();
    ctx.moveTo(-width / 2, -height / 2);
    ctx.lineTo(width / 2, -height * (0.3 + rand() * 0.4));
    ctx.lineTo(width / 2, height / 2);
    ctx.lineTo(-width / 2, height * (0.3 + rand() * 0.4));
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = `rgba(125, 88, 48, ${0.025 + rand() * 0.04})`;
    ctx.lineWidth = 0.6 + rand() * 0.8;
    ctx.stroke();

    if (rand() > 0.6) {
      ctx.strokeStyle = `rgba(248, 228, 188, ${0.04 + rand() * 0.04})`;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(-width * 0.35, 0);
      ctx.lineTo(width * 0.35, 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(126, 91, 52, ${0.015 + rand() * 0.025})`;
    ctx.fillRect(rand() * size, rand() * size, 8 + rand() * 26, 1 + rand() * 3);
  }

  const imgData = ctx.getImageData(0, 0, size, size);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const noise = (rand() - 0.5) * 8 + 8;
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
  cachedOsbTexture = texture;
  return texture;
}
