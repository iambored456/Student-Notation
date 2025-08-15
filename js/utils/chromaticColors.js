// js/utils/chromaticColors.js

// Chromatic color palette adapted from Pitch Visualizer
export const CHROMATIC_COLORS = [
  "#ef8aab", // C
  "#f48e7d", // C#/Db  
  "#e89955", // D
  "#cdaa42", // D#/Eb
  "#a4ba57", // E
  "#6ec482", // F
  "#2dc8b1", // F#/Gb
  "#16c3da", // G
  "#58b8f6", // G#/Ab
  "#8fa9ff", // A
  "#ba9bf2", // A#/Bb
  "#db8fd4"  // B
];

export function getPitchColor(midiValue) {
  if (midiValue === 0 || !midiValue) return "#888888"; // Return a neutral color for no pitch
  const pitchClass = Math.round(midiValue) % 12;
  return CHROMATIC_COLORS[pitchClass];
}

export function getInterpolatedColor(midiValue) {
  if (midiValue === 0 || !midiValue) return hexToRgb("#888888");

  const midiFloor = Math.floor(midiValue);
  const fraction = midiValue - midiFloor;
  
  if (fraction < 0 || fraction >= 1) {
    return getPitchColor(midiValue);
  }
  
  const currentPC = midiFloor % 12;
  const nextPC = (currentPC + 1) % 12;
  
  const currentColor = hexToRgb(CHROMATIC_COLORS[currentPC]);
  const nextColor = hexToRgb(CHROMATIC_COLORS[nextPC]);
  
  return interpolateRgb(currentColor, nextColor, fraction);
}

function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function interpolateRgb(c1, c2, factor) {
  return c1.map((v, i) => Math.round(v + factor * (c2[i] - v)));
}