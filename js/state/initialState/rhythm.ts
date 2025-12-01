import type { AppState, MacrobeatBoundaryStyle, MacrobeatGrouping } from '../../../types/state.js';
// js/state/initialState/rhythm.ts

export const ANACRUSIS_ON_GROUPINGS: MacrobeatGrouping[] = new Array<MacrobeatGrouping>(19).fill(2);
export const ANACRUSIS_ON_STYLES: MacrobeatBoundaryStyle[] = ['anacrusis','anacrusis','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid'];
export const ANACRUSIS_OFF_GROUPINGS: MacrobeatGrouping[] = new Array<MacrobeatGrouping>(16).fill(2);
export const ANACRUSIS_OFF_STYLES: MacrobeatBoundaryStyle[] = [
  'dashed', 'dashed', 'dashed', 'solid',
  'dashed', 'dashed', 'dashed', 'solid',
  'dashed', 'dashed', 'dashed', 'solid',
  'dashed', 'dashed', 'dashed' // The last measure is completed by the "isLastBeat" logic
];

export function getInitialRhythmState(): Pick<AppState, 'hasAnacrusis' | 'macrobeatGroupings' | 'macrobeatBoundaryStyles' | 'baseMicrobeatPx' | 'modulationMarkers'> {
  return {
    hasAnacrusis: false,
    macrobeatGroupings: [...ANACRUSIS_OFF_GROUPINGS],
    macrobeatBoundaryStyles: [...ANACRUSIS_OFF_STYLES],
    baseMicrobeatPx: 40, // Base pixels per microbeat (will be calculated from cellWidth)
    modulationMarkers: [] // Array of ModulationMarker objects
  };
}
