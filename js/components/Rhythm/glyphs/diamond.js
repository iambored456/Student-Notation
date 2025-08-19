// js/ui/glyphs/diamond.js

export function diamondPath(cx, cy, w, totalH) {
  // Build elongated hexagon points (top, UL, LL, bottom, LR, UR)
  const triH = (Math.sqrt(3) / 2) * w;
  const rectH = Math.max(1, totalH - 2 * triH);

  const yTop    = cy - (rectH / 2 + triH);
  const yUpper  = yTop + triH;
  const yLower  = yUpper + rectH;
  const yBottom = yLower + triH;
  const xL = cx - w / 2;
  const xR = cx + w / 2;

  const pts = [
    `${cx},${yTop}`,
    `${xL},${yUpper}`,
    `${xL},${yLower}`,
    `${cx},${yBottom}`,
    `${xR},${yLower}`,
    `${xR},${yUpper}`
  ].join(" ");

  return `M ${pts} Z`.replace(/,/g, " ");
}