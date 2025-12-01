// js/services/columnMap.ts
/**
 * Utilities to convert between visual column indices (including legends/tonics)
 * and time-bearing column indices (microbeats). Tonic columns occupy visual
 * space but no transport time; legends are also zero-time.
 */
import { getPlacedTonicSigns } from '@state/selectors.ts';
import type { AppState, TonicSign } from '../../types/state.js';

interface ColumnEntry {
  visualIndex: number;
  type: 'legend-left' | 'legend-right' | 'tonic' | 'time';
  timeIndex: number | null;
}

interface BuildResult {
  entries: ColumnEntry[];
  totalTimeColumns: number;
}

function getTonicUuid(tonic: TonicSign | undefined): string | undefined {
  if (!tonic) {return undefined;}
  return (tonic as Record<string, unknown>)['uuid'] as string | undefined;
}

function buildEntries(state: AppState, macrobeatGroupingsOverride: number[] | null = null): BuildResult {
  const macrobeatGroupings = Array.isArray(macrobeatGroupingsOverride)
    ? macrobeatGroupingsOverride
    : (state.macrobeatGroupings || []);
  const tonicSigns = getPlacedTonicSigns(state);
  const sortedTonics = [...tonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);

  let tonicCursor = 0;
  const entries: ColumnEntry[] = [];
  let timeIndex = 0;

  const addLegend = (side: 'left' | 'right'): void => {
    entries.push({ visualIndex: entries.length, type: `legend-${side}`, timeIndex: null });
  };

  const addTonicFor = (preMacrobeatIndex: number): void => {
    while (tonicCursor < sortedTonics.length) {
      const tonic = sortedTonics[tonicCursor];
      if (tonic?.preMacrobeatIndex !== preMacrobeatIndex) {
        break;
      }

      // Two visual columns, zero time
      entries.push({ visualIndex: entries.length, type: 'tonic', timeIndex: null });
      entries.push({ visualIndex: entries.length, type: 'tonic', timeIndex: null });

      const currentUuid = getTonicUuid(tonic);
      if (currentUuid) {
        do {
          tonicCursor++;
        } while (tonicCursor < sortedTonics.length && getTonicUuid(sortedTonics[tonicCursor]) === currentUuid);
      } else {
        tonicCursor++;
      }
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

export function visualToTimeIndex(state: AppState, visualIndex: number, macrobeatGroupingsOverride: number[] | null = null): number | null {
  const { entries } = buildEntries(state, macrobeatGroupingsOverride);
  const entry = entries[visualIndex];
  return entry ? entry.timeIndex : null;
}

export function timeIndexToVisualColumn(state: AppState, timeIndex: number, macrobeatGroupingsOverride: number[] | null = null): number | null {
  const { entries, totalTimeColumns } = buildEntries(state, macrobeatGroupingsOverride);
  if (timeIndex === null || timeIndex === undefined) {return null;}
  if (timeIndex < 0 || timeIndex >= totalTimeColumns) {return null;}

  const match = entries.find(e => e.timeIndex === timeIndex);
  return match ? match.visualIndex : null;
}

export function getTimeBoundaryAfterMacrobeat(state: AppState, macrobeatIndex: number, macrobeatGroupingsOverride: number[] | null = null): number {
  const macrobeatGroupings = Array.isArray(macrobeatGroupingsOverride)
    ? macrobeatGroupingsOverride
    : (state.macrobeatGroupings || []);
  if (macrobeatIndex === undefined || macrobeatIndex === null) {return 0;}
  let time = 0;
  for (let i = 0; i <= macrobeatIndex && i < macrobeatGroupings.length; i++) {
    const grouping = macrobeatGroupings[i];
    if (typeof grouping === 'number') {
      time += grouping;
    }
  }
  return time;
}
