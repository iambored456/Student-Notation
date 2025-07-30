// js/state/initialState/paintState.js
console.log("paintState.js: Module loaded.");

export function getInitialPaintState() {
  return {
    isMicPaintActive: false,
    isDetecting: false,
    detectedPitch: { frequency: 0, clarity: 0, midi: 0, pitchClass: 0 },
    paintHistory: [], // Array of {x, y, color, timestamp, thickness}
    paintSettings: {
      thickness: 6,
      opacity: 80,
      minClarity: 0.8
    }
  };
}