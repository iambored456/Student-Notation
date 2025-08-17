// js/state/initialState/rhythm.js

export const ANACRUSIS_ON_GROUPINGS = Array(19).fill(2);
export const ANACRUSIS_ON_STYLES = ['anacrusis','anacrusis','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid','dashed','dashed','dashed','solid'];
export const ANACRUSIS_OFF_GROUPINGS = Array(16).fill(2);
export const ANACRUSIS_OFF_STYLES = [
    'dashed', 'dashed', 'dashed', 'solid',
    'dashed', 'dashed', 'dashed', 'solid',
    'dashed', 'dashed', 'dashed', 'solid',
    'dashed', 'dashed', 'dashed' // The last measure is completed by the "isLastBeat" logic
];

export function getInitialRhythmState() {
    return {
        hasAnacrusis: true,
        macrobeatGroupings: [...ANACRUSIS_ON_GROUPINGS],
        macrobeatBoundaryStyles: [...ANACRUSIS_ON_STYLES],
        baseMicrobeatPx: 40, // Base pixels per microbeat (will be calculated from cellWidth)
        modulationMarkers: [], // Array of ModulationMarker objects
    };
}