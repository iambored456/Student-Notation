// Chromatic color palette adapted from Pitch Visualizer
export const CHROMATIC_COLORS: string[] = [
  '#ef8aab', // C
  '#f48e7d', // C#/Db
  '#e89955', // D
  '#cdaa42', // D#/Eb
  '#a4ba57', // E
  '#6ec482', // F
  '#2dc8b1', // F#/Gb
  '#16c3da', // G
  '#58b8f6', // G#/Ab
  '#8fa9ff', // A
  '#ba9bf2', // A#/Bb
  '#db8fd4'  // B
];

export function getPitchColor(midiValue: number | null | undefined): string {
  if (midiValue === 0 || !midiValue) {
    return '#888888'; // Neutral color for no pitch
  }
  const pitchClass = ((Math.round(midiValue) % 12) + 12) % 12;
  return CHROMATIC_COLORS[pitchClass] ?? '#888888';
}

export function getInterpolatedColor(midiValue: number | null | undefined): [number, number, number] {
  if (midiValue === 0 || !midiValue) {
    return hexToRgb('#888888');
  }

  const midiFloor = Math.floor(midiValue);
  const fraction = midiValue - midiFloor;

  if (fraction < 0 || fraction >= 1) {
    return hexToRgb(getPitchColor(midiValue));
  }

  const currentPC = ((midiFloor % 12) + 12) % 12;
  const nextPC = (currentPC + 1) % 12;

  const currentColor = hexToRgb(CHROMATIC_COLORS[currentPC] ?? '#888888');
  const nextColor = hexToRgb(CHROMATIC_COLORS[nextPC] ?? '#888888');

  return interpolateRgb(currentColor, nextColor, fraction);
}

function hexToRgb(hex: string): [number, number, number] {
  const bigint = parseInt(hex.slice(1), 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function interpolateRgb(c1: [number, number, number], c2: [number, number, number], factor: number): [number, number, number] {
  const [r1, g1, b1] = c1;
  const [r2, g2, b2] = c2;
  return [
    Math.round(r1 + factor * (r2 - r1)),
    Math.round(g1 + factor * (g2 - g1)),
    Math.round(b1 + factor * (b2 - b1))
  ];
}
