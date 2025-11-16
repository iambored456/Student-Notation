// js/services/columnMap.js
/**
 * Utilities to convert between visual column indices (including legends/tonics)
 * and time-bearing column indices (microbeats). Tonic columns occupy visual
 * space but no transport time; legends are also zero-time.
 */
import { getPlacedTonicSigns } from '@state/selectors.js';

function buildEntries(state, macrobeatGroupingsOverride = null) {
  const macrobeatGroupings = Array.isArray(macrobeatGroupingsOverride)
    ? macrobeatGroupingsOverride
    : (state.macrobeatGroupings || []);
  const tonicSigns = getPlacedTonicSigns(state);
  const sortedTonics = [...tonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);

  let tonicCursor = 0;
  const entries = [];
  let timeIndex = 0;

  const addLegend = (side) => {
    entries.push({ visualIndex: entries.length, type: `legend-${side}`, timeIndex: null });
  };

  const addTonicFor = (preMacrobeatIndex) => {
    let uuid = sortedTonics[tonicCursor]?.uuid;
    while (sortedTonics[tonicCursor] && sortedTonics[tonicCursor].preMacrobeatIndex === preMacrobeatIndex) {
      // Two visual columns, zero time
      entries.push({ visualIndex: entries.length, type: 'tonic', timeIndex: null });
      entries.push({ visualIndex: entries.length, type: 'tonic', timeIndex: null });
      while (sortedTonics[tonicCursor] && sortedTonics[tonicCursor].uuid === uuid) {
        tonicCursor++;
      }
      uuid = sortedTonics[tonicCursor]?.uuid;
    }
  };

  // Left legends (2 columns)
  addLegend('left');
  addLegend('left');

  // Tonics before first macrobeat
  addTonicFor(-1);

  macrobeatGroupings.forEach((beats, mbIdx) => {
    for (let i = 0; i < beats; i++) {
      entries.push({ visualIndex: entries.length, type: 'time', timeIndex: timeIndex++ });
    }
    addTonicFor(mbIdx);
  });

  // Right legends (2 columns)
  addLegend('right');
  addLegend('right');

  return { entries, totalTimeColumns: timeIndex };
}

export function visualToTimeIndex(state, visualIndex, macrobeatGroupingsOverride = null) {
  const { entries } = buildEntries(state, macrobeatGroupingsOverride);
  const entry = entries[visualIndex];
  return entry ? entry.timeIndex : null;
}

export function timeIndexToVisualColumn(state, timeIndex, macrobeatGroupingsOverride = null) {
  const { entries, totalTimeColumns } = buildEntries(state, macrobeatGroupingsOverride);
  if (timeIndex === null || timeIndex === undefined) {return null;}
  if (timeIndex < 0 || timeIndex >= totalTimeColumns) {return null;}

  const match = entries.find(e => e.timeIndex === timeIndex);
  return match ? match.visualIndex : null;
}

export function getTimeBoundaryAfterMacrobeat(state, macrobeatIndex, macrobeatGroupingsOverride = null) {
  const macrobeatGroupings = Array.isArray(macrobeatGroupingsOverride)
    ? macrobeatGroupingsOverride
    : (state.macrobeatGroupings || []);
  if (macrobeatIndex === undefined || macrobeatIndex === null) {return 0;}
  let time = 0;
  for (let i = 0; i <= macrobeatIndex && i < macrobeatGroupings.length; i++) {
    time += macrobeatGroupings[i];
  }
  return time;
}
