export const PALETTE = {
  bg: "#121614",
  surface: "#1b2420",
  felt: "#1f7a52",
  feltDeep: "#145438",
  fg: "#f4efe4",
  muted: "#a8b2a8",
  brass: "#e8b84a",
  ink: "#1a1408",
  line: "#2c3832",
} as const;

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function fitVirtual(cssW: number, cssH: number, vw: number, vh: number) {
  const s = Math.min(cssW / vw, cssH / vh);
  const ox = (cssW - vw * s) / 2;
  const oy = (cssH - vh * s) / 2;
  return { s, ox, oy };
}

export function paintVirtual(
  canvas: HTMLCanvasElement,
  vw: number,
  vh: number,
) {
  const rect = canvas.getBoundingClientRect();
  const cssW = Math.max(1, rect.width);
  const cssH = Math.max(1, rect.height);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pixelW = Math.max(1, Math.round(cssW * dpr));
  const pixelH = Math.max(1, Math.round(cssH * dpr));
  if (canvas.width !== pixelW || canvas.height !== pixelH) {
    canvas.width = pixelW;
    canvas.height = pixelH;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, pixelW, pixelH);
  const { s, ox, oy } = fitVirtual(cssW, cssH, vw, vh);
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oy);
  return { ctx, cssW, cssH, s, ox, oy };
}

export function toVirtual(
  cssX: number,
  cssY: number,
  cssW: number,
  cssH: number,
  vw: number,
  vh: number,
) {
  const { s, ox, oy } = fitVirtual(cssW, cssH, vw, vh);
  return { x: (cssX - ox) / s, y: (cssY - oy) / s };
}
