// js/components/Canvas/PitchGrid/renderers/legend.js
import store from '@state/index.ts'; // <-- UPDATED PATH
import { getColumnX, getRowY } from './rendererUtils.js';
import { Scale, Note } from 'tonal';
import { getPlacedTonicSigns } from '@state/selectors.ts';
import logger from '@utils/logger.ts';
import { SIDE_COLUMN_WIDTH } from '../../../../core/constants.ts';
import type { PitchRowData } from '../../../../../types/state.js';

type ExtendedPitchRow = PitchRowData & { isDummy?: boolean };
interface LegendOptions {
  fullRowData: ExtendedPitchRow[];
  columnWidths: number[];
  cellWidth: number;
  cellHeight: number;
  colorMode?: string;
  showOctaveLabels?: boolean;
}

// Import MODE_NAMES for modal scale support
const MODE_NAMES = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'] as const;

function stripOctaveSuffix(label: string): string {
  const withoutOctave = label.replace(/\d+$/, '');
  return withoutOctave.length > 0 ? withoutOctave : label;
}

// Helper function to extract tonic note from pitch at given row
function getTonicNoteFromRow(rowIndex: number, fullRowData: ExtendedPitchRow[]): string | null {
  const pitchEntry = fullRowData[rowIndex];
  if (!pitchEntry) {return null;}

  // Extract the base note name (without octave) from the pitch
  const pitch = pitchEntry.pitch;
  const noteWithoutOctave = pitch.replace(/\d+$/, ''); // Remove octave number

  // Handle enharmonic equivalents - take the first part if it's a slash notation
  const basePitch = noteWithoutOctave.includes('/') ?
    (noteWithoutOctave.split('/')[0] ?? noteWithoutOctave) :
    noteWithoutOctave;

  // Normalize flats and sharps for tonal library
  const normalizedPitch = basePitch.replace(/♭/g, 'b').replace(/♯/g, '#');

  return normalizedPitch;
}

// Helper function to get modal scale notes for a tonic
function getModalScaleNotes(tonicNote: string | null, tonicNumber?: number | null): string[] {
  if (!tonicNote || !tonicNumber) {return [];}

  // Map tonic number to mode name (tonicNumber is 1-indexed)
  const modeIndex = tonicNumber - 1;
  if (modeIndex < 0 || modeIndex >= MODE_NAMES.length) {
    logger.warn('LegendRenderer', `Invalid tonic number: ${tonicNumber}`, null, 'grid');
    return [];
  }

  const modeName = MODE_NAMES[modeIndex];

  try {
    const scaleQuery = `${tonicNote} ${modeName}`;
    const scale = Scale.get(scaleQuery);
    return scale.notes || [];
  } catch (error) {
    logger.warn('LegendRenderer', `Could not generate ${modeName} scale`, { tonic: tonicNote, error }, 'grid');
    return [];
  }
}

// Normalize notation used across the app into standard b/# spellings without octave numbers
function normalizeNoteName(note: string | null | undefined): string {
  if (!note) {return '';}

  return note
    .replace(/\d+$/, '') // strip octave
    .replace(/ƒT-/g, 'b')
    .replace(/ƒT_/g, '#')
    .replace(/サ-/g, 'b')
    .replace(/サ_/g, '#')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#');
}

// Build a lookup set for quick focus checks, including enharmonic equivalents
function buildFocusSet(scaleNotes: string[]): Set<string> {
  const focusSet = new Set<string>();

  scaleNotes.forEach(note => {
    const normalized = normalizeNoteName(note);
    if (!normalized) {return;}
    focusSet.add(normalized);

    try {
      const enharmonic = normalizeNoteName(Note.enharmonic(normalized));
      if (enharmonic) {
        focusSet.add(enharmonic);
      }
    } catch {
      // tonal can throw on unexpected spellings; ignore and continue
    }
  });

  return focusSet;
}

// Determine if a given legend row should be treated as focused
function isRowFocused(row: ExtendedPitchRow, focusSet: Set<string>): boolean {
  if (!focusSet.size) {return true;}

  const normalizedPitch = normalizeNoteName(row.toneNote || row.pitch);
  if (!normalizedPitch) {return false;}

  if (focusSet.has(normalizedPitch)) {return true;}

  try {
    const enharmonic = normalizeNoteName(Note.enharmonic(normalizedPitch));
    if (enharmonic && focusSet.has(enharmonic)) {
      return true;
    }
  } catch {
    // Ignore tonal parsing errors
  }

  // Support combined slash spellings just in case
  if (normalizedPitch.includes('/')) {
    return normalizedPitch.split('/').some(part => focusSet.has(part));
  }

  return false;
}

export function drawLegends(ctx: CanvasRenderingContext2D, options: LegendOptions, startRow: number, endRow: number): void {
  const { fullRowData, columnWidths, cellWidth, cellHeight, colorMode: rawColorMode } = options;
  const colorMode = rawColorMode ?? 'color';
  const { sharp, flat } = store.state.accidentalMode;
  const { focusColours, showFrequencyLabels } = store.state;
  const showOctaveLabels = options.showOctaveLabels ?? true;
  const finalizeLabel = (value: string): string => showOctaveLabels ? value : stripOctaveSuffix(value);

  // Focus colours logic - union of all tonic scales
  let focusScale: string[] = [];
  let focusSet: Set<string> = new Set<string>();

  if (focusColours) {
    const tonics = getPlacedTonicSigns(store.state);
    const allNotes = new Set<string>();

    console.log('[LegendRenderer] (Separate canvases) Focus Colours enabled', { tonicCount: tonics.length });

    tonics.forEach(tonic => {
      const tonicNote = getTonicNoteFromRow(tonic.row, fullRowData);
      const scaleNotes = getModalScaleNotes(tonicNote, tonic.tonicNumber);
      console.log('[LegendRenderer] (Separate canvases) Tonic scale computed', { tonicNote, tonicNumber: tonic.tonicNumber, scaleNotes });
      scaleNotes.forEach(note => allNotes.add(note));
    });

    focusScale = Array.from(allNotes);
    console.log('[LegendRenderer] (Separate canvases) Focus Colours combined scale', { focusScale });

    focusSet = buildFocusSet(focusScale);
  }



  const processLabel = (
    label: string,
    _relevantScale: string[] = [],
    rowData: ExtendedPitchRow | null = null
  ): string | null => {
    // When Hz mode is on, optionally gate the numeric display to focus pitches
    if (showFrequencyLabels) {
      const focusGateActive = focusColours && focusSet.size > 0;
      const isScalePitch = rowData ? isRowFocused(rowData, focusSet) : false;

      if (focusGateActive && rowData && !isScalePitch) {
        // Non-focus pitches are hidden entirely when focus colours are active
        return null;
      }

      if (rowData && rowData.frequency) {
        return String(rowData.frequency);
      }
      return label;
    }

    // If no rowData provided, use the new direct field access
    if (!rowData) {
      // Fallback to old string parsing if rowData not available
      if (!label.includes('/')) {return finalizeLabel(label);}
      const octave = label.slice(-1);
      const pitches = label.substring(0, label.length - 1);
      const [flatName, sharpName] = pitches.split('/');

      if (sharp && flat) {return finalizeLabel(`${flatName}/${sharpName}${octave}`);}
      if (sharp) {return finalizeLabel(`${sharpName}${octave}`);}
      if (flat) {return finalizeLabel(`${flatName}${octave}`);}
      return finalizeLabel(`${sharpName}${octave}`);
    }

    // NEW: Use direct field access from expanded pitchData structure
    const { flatName, sharpName, isAccidental } = rowData;

    // For natural notes, flatName === sharpName === pitch
    if (!isAccidental) {
      return finalizeLabel(flatName); // or sharpName, they're identical for naturals
    }

    // Accidental button logic
    let result;
    if (sharp && flat) {result = rowData.pitch;} // Combined notation like 'Bb/A#7'
    else if (sharp && !flat) {result = sharpName;} // e.g., 'A#7'
    else if (flat && !sharp) {result = flatName;} // e.g., 'Bb7'
    else {result = sharpName;} // Default fallback

    return finalizeLabel(result);
  };

  const isAccidentalHidden = (): boolean => !sharp && !flat;

  function drawLegendColumn(startCol: number, columnsOrder: readonly ('A' | 'B')[]): void {
    const xStart = getColumnX(startCol, options);
    // Legend columns have fixed width (not in columnWidths after Step 1)
    // Total legend width, split 50/50 between columns A and B
    const totalLegendWidth = SIDE_COLUMN_WIDTH * 2 * cellWidth;
    const colWidthsPx = [totalLegendWidth / 2, totalLegendWidth / 2];
    let cumulativeX = xStart;

    let filteredCount = 0;
    let totalCount = 0;

    columnsOrder.forEach((colLabel: 'A' | 'B', colIndex: number) => {
      const colWidth = colWidthsPx[colIndex] ?? 0;
      // Only process rows within the visible viewport bounds
      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const row: ExtendedPitchRow | undefined = fullRowData[rowIndex];
        if (!row || row.isDummy) {continue;}

        if (row.column === colLabel) {
          const y = getRowY(rowIndex, options);
          const isAccidental = row.isAccidental ?? row.pitch.includes('/');
          const shouldHideAccidental = !showFrequencyLabels && isAccidental && isAccidentalHidden();

          const isFocused = isRowFocused(row, focusSet);

          const pitchToDraw = processLabel(row.pitch, focusScale, row);
          if (pitchToDraw === null) {
            continue;
          }

          let bgColor = colorMode === 'bw' ? '#ffffff' : (row.hex || '#ffffff');
          if (focusColours && !isFocused && !showFrequencyLabels) {
            bgColor = '#ffffff';
          }

          let textAlpha = 'FF';
          if (shouldHideAccidental) {
            textAlpha = '00';
          } else if (focusColours && !isFocused) {
            textAlpha = '55';
          }

          ctx.fillStyle = shouldHideAccidental ? 'rgba(255,255,255,0)' : bgColor;
          ctx.fillRect(cumulativeX, y - cellHeight / 2, colWidth, cellHeight);

          const isShortLabel = pitchToDraw.length <= 3;
          const baseFontSize = Math.max(10, Math.min(cellWidth * 1.2, cellHeight * 1.2));
          const finalFontSize = isShortLabel ? baseFontSize : baseFontSize * 0.7;

          ctx.font = `bold ${finalFontSize}px 'Atkinson Hyperlegible', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const textX = cumulativeX + colWidth / 2;
          const textY = y;

          ctx.strokeStyle = `#212529${textAlpha}`;
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.strokeText(pitchToDraw, textX, textY);

          ctx.fillStyle = `#ffffff${textAlpha}`;
          ctx.fillText(pitchToDraw, textX, textY);

          if (focusColours && focusSet.size > 0) {
            totalCount += 1;
            if (!isFocused) {filteredCount += 1;}
          }
        }
      }
      cumulativeX += colWidth;
    });

    if (focusColours && focusSet.size > 0) {
      console.log('[LegendRenderer] Focus filter summary', {
        side: startCol === 0 ? 'left' : 'right',
        startCol,
        relevantScale: focusScale,
        totalLabels: totalCount,
        filteredLabels: filteredCount
      });
    }
  }


  drawLegendColumn(0, ['B', 'A'] as const);
  // Right legend starts after all musical columns
  drawLegendColumn(columnWidths.length, ['A', 'B'] as const);
}

/**
 * Draws legends to separate left and right canvas contexts.
 * This is the new approach that renders legends independently from the main grid.
 */
export function drawLegendsToSeparateCanvases(
  leftCtx: CanvasRenderingContext2D | null,
  rightCtx: CanvasRenderingContext2D | null,
  options: LegendOptions,
  startRow: number,
  endRow: number
): void {
  const { fullRowData, columnWidths, cellWidth, cellHeight, colorMode: rawColorMode } = options;
  const colorMode = rawColorMode ?? 'color';
  const { sharp, flat } = store.state.accidentalMode;
  const { focusColours, showFrequencyLabels } = store.state;
  const showOctaveLabels = options.showOctaveLabels ?? true;
  const finalizeLabel = (value: string): string => showOctaveLabels ? value : stripOctaveSuffix(value);

  // Focus colours logic - union of all tonic scales
  let focusScale: string[] = [];
  let focusSet: Set<string> = new Set<string>();

  if (focusColours) {
    const tonics = getPlacedTonicSigns(store.state);
    const allNotes = new Set<string>();

    console.log('[LegendRenderer] Focus Colours enabled', { tonicCount: tonics.length });

    if (!tonics.length) {
      logger.info('LegendRenderer', 'Focus Colours ON but no tonic placements found', null, 'grid');
    }

    tonics.forEach(tonic => {
      const tonicNote = getTonicNoteFromRow(tonic.row, fullRowData);
      const scaleNotes = getModalScaleNotes(tonicNote, tonic.tonicNumber);
      logger.debug('LegendRenderer', 'Focus Colours tonic scale', {
        tonicNote,
        tonicNumber: tonic.tonicNumber,
        scaleNotes
      }, 'grid');
      console.log('[LegendRenderer] Tonic scale computed', { tonicNote, tonicNumber: tonic.tonicNumber, scaleNotes });
      scaleNotes.forEach(note => allNotes.add(note));
    });

    focusScale = Array.from(allNotes);
    logger.debug('LegendRenderer', 'Focus Colours combined scale', { focusScale }, 'grid');
    console.log('[LegendRenderer] Focus Colours combined scale', { focusScale });

    focusSet = buildFocusSet(focusScale);
  }

  const processLabel = (
    label: string,
    _relevantScale: string[] = [],
    rowData: ExtendedPitchRow | null = null
  ): string | null => {
    // When Hz mode is on, optionally gate the numeric display to focus pitches
    if (showFrequencyLabels) {
      const focusGateActive = focusColours && focusSet.size > 0;
      const isScalePitch = rowData ? isRowFocused(rowData, focusSet) : false;

      if (focusGateActive && rowData && !isScalePitch) {
        // Non-focus pitches are hidden entirely when focus colours are active
        return null;
      }

      if (rowData && rowData.frequency) {
        return String(rowData.frequency);
      }
      return label;
    }

    // If no rowData provided, use the new direct field access
    if (!rowData) {
      // Fallback to old string parsing if rowData not available
      if (!label.includes('/')) {return finalizeLabel(label);}
      const octave = label.slice(-1);
      const pitches = label.substring(0, label.length - 1);
      const [flatName, sharpName] = pitches.split('/');

      if (sharp && flat) {return finalizeLabel(`${flatName}/${sharpName}${octave}`);}
      if (sharp) {return finalizeLabel(`${sharpName}${octave}`);}
      if (flat) {return finalizeLabel(`${flatName}${octave}`);}
      return finalizeLabel(`${sharpName}${octave}`);
    }

    // NEW: Use direct field access from expanded pitchData structure
    const { flatName, sharpName, isAccidental } = rowData;

    // For natural notes, flatName === sharpName === pitch
    if (!isAccidental) {
      return finalizeLabel(flatName); // or sharpName, they're identical for naturals
    }

    // Accidental button logic
    let result;
    if (sharp && flat) {result = rowData.pitch;} // Combined notation like 'Bb/A#7'
    else if (sharp && !flat) {result = sharpName;} // e.g., 'A#7'
    else if (flat && !sharp) {result = flatName;} // e.g., 'Bb7'
    else {result = sharpName;} // Default fallback

    return finalizeLabel(result);
  };

  const isAccidentalHidden = (): boolean => !sharp && !flat;

  function drawSingleLegend(
    ctx: CanvasRenderingContext2D,
    startCol: number,
    columnsOrder: readonly ('A' | 'B')[],
    relevantScale: string[]
  ): void {
    // After Phase 8: Legend columns have fixed width, split 50/50 between A and B
    // Total legend width for both columns combined
    const totalLegendWidth = SIDE_COLUMN_WIDTH * 2 * cellWidth;
    const colWidthsPx = [totalLegendWidth / 2, totalLegendWidth / 2];

    let cumulativeX = 0; // Start at 0 for separate canvas
    let filteredCount = 0;
    let totalCount = 0;

    columnsOrder.forEach((colLabel: 'A' | 'B', colIndex: number) => {
      const colWidth = colWidthsPx[colIndex] ?? 0;

      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const row: ExtendedPitchRow | undefined = fullRowData[rowIndex];
        if (!row || row.isDummy) {continue;}

        if (row.column === colLabel) {
          const y = getRowY(rowIndex, options);

          const isAccidental = row.isAccidental ?? row.pitch.includes('/');
          const shouldHideAccidental = !showFrequencyLabels && isAccidental && isAccidentalHidden();

          const isFocused = isRowFocused(row, focusSet);

          const pitchToDraw = processLabel(row.pitch, relevantScale, row);
          if (pitchToDraw === null) {
            continue;
          }

          // BOUNDARY ROW DETECTION
          // Row 0 (C♯8/D♭8) and row 106 (A♭0/G♯0) are visual padding rows that allow
          // the complete top/bottom half-cells of C8 and A0 to be visible.
          // Their backgrounds render normally (white), but text labels are hidden (textAlpha='00').
          const isBoundaryRow = rowIndex === 0 || rowIndex === fullRowData.length - 1;

          let bgColor = colorMode === 'bw' ? '#ffffff' : (row.hex || '#ffffff');
          if (focusColours && !isFocused && !showFrequencyLabels) {
            bgColor = '#ffffff';
          }

          // Hide text for boundary rows and hidden accidentals, fade text for unfocused rows when using focus colors
          const textAlpha = (shouldHideAccidental || isBoundaryRow) ? '00' : (focusColours && !isFocused ? '55' : 'FF');

          if (focusColours && focusSet.size > 0) {
            totalCount += 1;
            if (!isFocused) {filteredCount += 1;}
          }

          ctx.fillStyle = shouldHideAccidental ? 'rgba(255,255,255,0)' : bgColor;
          ctx.fillRect(cumulativeX, y - cellHeight / 2, colWidth, cellHeight);

          const isShortLabel = pitchToDraw.length <= 3;
          const baseFontSize = Math.max(10, Math.min(cellWidth * 1.2, cellHeight * 1.2));
          const finalFontSize = isShortLabel ? baseFontSize : baseFontSize * 0.7;

          ctx.font = `bold ${finalFontSize}px 'Atkinson Hyperlegible', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const textX = cumulativeX + colWidth / 2;
          const textY = y;

          ctx.strokeStyle = `#212529${textAlpha}`;
          ctx.lineWidth = 2.5;
          ctx.lineJoin = 'round';
          ctx.strokeText(pitchToDraw, textX, textY);

          ctx.fillStyle = `#ffffff${textAlpha}`;
          ctx.fillText(pitchToDraw, textX, textY);
        }
      }
      cumulativeX += colWidth;
    });

    if (focusColours && focusSet.size > 0) {
      console.log('[LegendRenderer] (Separate) Focus filter summary', {
        side: startCol === 0 ? 'left' : 'right',
        startCol,
        relevantScale,
        totalLabels: totalCount,
        filteredLabels: filteredCount
      });
    }
  }

  // Draw left legend if context is available
  if (leftCtx) {
    drawSingleLegend(leftCtx, 0, ['B', 'A'] as const, focusScale);
  }

  // Draw right legend if context is available
  if (rightCtx) {
    // Right legend starts after all musical columns
    drawSingleLegend(rightCtx, columnWidths.length, ['A', 'B'] as const, focusScale);
  }
}

