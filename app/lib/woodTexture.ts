import * as THREE from "three";

let cachedTexture: THREE.CanvasTexture | null = null;

/** Procedural pine wood grain texture via CanvasTexture */
export function getPineTexture(): THREE.CanvasTexture {
  if (cachedTexture) return cachedTexture;

  const w = 256;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  // Base pine color
  ctx.fillStyle = "#d4a76a";
  ctx.fillRect(0, 0, w, h);

  // Draw grain lines along the length (vertical on canvas)
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * w;
    const lineW = 0.5 + Math.random() * 2;
    const alpha = 0.06 + Math.random() * 0.12;
    const dark = Math.random() > 0.3;
    ctx.strokeStyle = dark
      ? `rgba(139, 90, 40, ${alpha})`
      : `rgba(210, 180, 130, ${alpha})`;
    ctx.lineWidth = lineW;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    // Slight waviness
    const segments = 8 + Math.floor(Math.random() * 8);
    for (let s = 1; s <= segments; s++) {
      const sy = (s / segments) * h;
      const sx = x + (Math.random() - 0.5) * 6;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();
  }

  // Knots — small darker ellipses
  for (let i = 0; i < 3; i++) {
    const kx = 20 + Math.random() * (w - 40);
    const ky = 40 + Math.random() * (h - 80);
    const rx = 4 + Math.random() * 8;
    const ry = 6 + Math.random() * 12;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, Math.max(rx, ry));
    grad.addColorStop(0, "rgba(100, 60, 25, 0.4)");
    grad.addColorStop(0.5, "rgba(120, 75, 35, 0.2)");
    grad.addColorStop(1, "rgba(180, 140, 80, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(kx, ky, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    // Rings around knot
    for (let r = 0; r < 3; r++) {
      const ringR = rx + 2 + r * 3;
      ctx.strokeStyle = `rgba(120, 75, 35, ${0.08 - r * 0.02})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(kx, ky, ringR, ringR * (ry / rx), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Annual ring bands (horizontal bands of slightly varying color)
  for (let i = 0; i < 15; i++) {
    const y = Math.random() * h;
    const bandH = 2 + Math.random() * 6;
    ctx.fillStyle = `rgba(180, 130, 70, ${0.04 + Math.random() * 0.06})`;
    ctx.fillRect(0, y, w, bandH);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  cachedTexture = texture;
  return texture;
}
