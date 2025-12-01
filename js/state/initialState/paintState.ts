// js/state/initialState/paintState.ts
import type { PaintState } from '../../../types/state.js';

export function getInitialPaintState(): PaintState {
  return {
    isMicPaintActive: false,
    isDetecting: false,
    detectedPitch: { frequency: 0, clarity: 0, midi: 0, pitchClass: 0 },
    paintHistory: [], // Array of {x, y, color, timestamp, thickness}
    paintSettings: {
      thickness: 6,
      opacity: 80,
      minClarity: 0.1,  // Very low threshold for sensitive detection
      colorMode: 'chromatic',  // 'chromatic' or 'shapenote'
      playbackEnabled: true  // Whether paint is played back during transport
    }
  };
}
