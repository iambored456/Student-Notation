/**
 * Color utility functions for the Student Notation application.
 * Provides hex to rgba conversion and color shading operations.
 */
import {
  DEFAULT_GRAY_COLOR,
  HEX_BLUE_END_INDEX,
  HEX_COLOR_START_INDEX,
  HEX_GREEN_END_INDEX,
  HEX_RADIX,
  HEX_RED_END_INDEX,
  SHADE_BLACK_VALUE,
  SHADE_WHITE_VALUE
} from '@/core/constants.ts';

export function hexToRgba(hex: string, alpha: number): string {
  if (!hex) {
    return `rgba(204, 204, 204, ${alpha})`;
  }
  const r = parseInt(hex.slice(HEX_COLOR_START_INDEX, HEX_RED_END_INDEX), HEX_RADIX);
  const g = parseInt(hex.slice(HEX_RED_END_INDEX, HEX_GREEN_END_INDEX), HEX_RADIX);
  const b = parseInt(hex.slice(HEX_GREEN_END_INDEX, HEX_BLUE_END_INDEX), HEX_RADIX);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Shades a hex color by a percentage (lighter or darker).
 */
export function shadeHexColor(hex: string, percent: number): string {
  if (!hex || typeof hex !== 'string') {
    return DEFAULT_GRAY_COLOR;
  }
  const f = parseInt(hex.slice(HEX_COLOR_START_INDEX), HEX_RADIX);
  const t = percent < 0 ? SHADE_BLACK_VALUE : SHADE_WHITE_VALUE;
  const p = percent < 0 ? percent * -1 : percent;
  const R = f >> 16;
  const G = (f >> 8) & 0x00FF;
  const B = f & 0x0000FF;
  return (
    '#' +
    (
      0x1000000 +
      (Math.round((t - R) * p) + R) * 0x10000 +
      (Math.round((t - G) * p) + G) * 0x100 +
      (Math.round((t - B) * p) + B)
    )
      .toString(16)
      .slice(1)
  );
}
