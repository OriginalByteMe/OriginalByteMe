import * as THREE from "three";

interface RingTextureOptions {
  text: string;
  color: string;
  fontFamily?: string;
  fontWeight?: number;
  glow?: number;
  size?: number;
  fontSize?: number;
}

/**
 * Draws text along a full circle onto a canvas and returns it as a texture.
 * Character angles are scaled so the text always fills exactly 360°, which
 * keeps the ring seamless while it spins.
 */
export function createTextRingTexture({
  text,
  color,
  fontFamily = "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontWeight = 600,
  glow = 0,
  size = 1024,
  fontSize = 44,
}: RingTextureOptions): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const radius = size / 2 - fontSize * 1.6;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (glow > 0) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.translate(size / 2, size / 2);

  const chars = text.split("");
  const widths = chars.map((c) => Math.max(ctx.measureText(c).width, fontSize * 0.28));
  const totalWidth = widths.reduce((sum, w) => sum + w, 0);

  let angle = -Math.PI / 2;
  chars.forEach((char, i) => {
    const charAngle = (widths[i] / totalWidth) * Math.PI * 2;
    angle += charAngle / 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(0, -radius);
    ctx.fillText(char, 0, 0);
    ctx.restore();
    angle += charAngle / 2;
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
