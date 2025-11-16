// js/components/Canvas/PitchGrid/renderers/legend.js
import store from '../../../../state/index.js'; // <-- UPDATED PATH
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass } from './rendererUtils.js';
import { Scale, Note } from 'tonal';
import { getPlacedTonicSigns } from '../../../../state/selectors.js';
import logger from '@utils/logger.js';

// Import MODE_NAMES for modal scale support
const MODE_NAMES = ['major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'minor', 'locrian'];

// Helper function to detect leftmost and rightmost tonic shapes
function getTonicInfo(state) {
  const placedTonicSigns = getPlacedTonicSigns(state);

  if (placedTonicSigns.length === 0) {
    return { leftTonic: null, rightTonic: null };
  }

  // Find leftmost tonic (lowest columnIndex)
  const leftTonic = placedTonicSigns.reduce((min, tonic) =>
    tonic.columnIndex < min.columnIndex ? tonic : min
  );

  // Find rightmost tonic (highest columnIndex)
  const rightTonic = placedTonicSigns.reduce((max, tonic) =>
    tonic.columnIndex > max.columnIndex ? tonic : max
  );

  // If only one tonic, it affects both legends
  return {
    leftTonic,
    rightTonic: placedTonicSigns.length === 1 ? leftTonic : rightTonic
  };
}

// Helper function to extract tonic note from pitch at given row
function getTonicNoteFromRow(rowIndex, fullRowData) {
  const pitchEntry = fullRowData[rowIndex];
  if (!pitchEntry) {return null;}

  // Extract the base note name (without octave) from the pitch
  const pitch = pitchEntry.pitch;
  const noteWithoutOctave = pitch.replace(/\d+$/, ''); // Remove octave number

  // Handle enharmonic equivalents - take the first part if it's a slash notation
  const basePitch = noteWithoutOctave.includes('/') ?
    noteWithoutOctave.split('/')[0] : noteWithoutOctave;

  // Normalize flats and sharps for tonal library
  const normalizedPitch = basePitch.replace(/♭/g, 'b').replace(/♯/g, '#');

  return normalizedPitch;
}

// Helper function to get modal scale notes for a tonic
function getModalScaleNotes(tonicNote, tonicNumber) {
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

// Helper function to check if a pitch belongs to a scale
function isPitchInScale(pitchName, scaleNotes) {
  if (!pitchName || !scaleNotes.length) {return false;}

  // Extract base note name without octave
  const baseNote = pitchName.replace(/\d+$/, '');

  // Handle enharmonic equivalents
  const notesToCheck = baseNote.includes('/') ?
    baseNote.split('/') : [baseNote];

  // Normalize flats and sharps
  const normalizedNotesToCheck = notesToCheck.map(note =>
    note.replace(/♭/g, 'b').replace(/♯/g, '#')
  );

  // Check if any enharmonic equivalent is in the scale
  return normalizedNotesToCheck.some(note =>
    scaleNotes.some(scaleNote => {
      // Use Note.enharmonic to handle enharmonic equivalents
      try {
        return Note.enharmonic(note) === Note.enharmonic(scaleNote) || note === scaleNote;
      } catch {
        return note === scaleNote;
      }
    })
  );
}

export function drawLegends(ctx, options, startRow, endRow) {
  const { fullRowData, columnWidths, cellWidth, cellHeight, colorMode } = options;
  const { sharp, flat } = store.state.accidentalMode;
  const { focusColours, showFrequencyLabels } = store.state;


  // Focus colours logic - get tonic information and scales
  let leftScale = [];
  let rightScale = [];

  if (focusColours) {
    const tonicInfo = getTonicInfo(store.state);

    if (tonicInfo.leftTonic) {
      const leftTonicNote = getTonicNoteFromRow(tonicInfo.leftTonic.row, fullRowData);
      leftScale = getModalScaleNotes(leftTonicNote, tonicInfo.leftTonic.tonicNumber);
    }

    if (tonicInfo.rightTonic) {
      const rightTonicNote = getTonicNoteFromRow(tonicInfo.rightTonic.row, fullRowData);
      rightScale = getModalScaleNotes(rightTonicNote, tonicInfo.rightTonic.tonicNumber);
    }
  }



  const processLabel = (label, relevantScale = [], rowData = null) => {
    // When Hz mode is on, optionally gate the numeric display to focus pitches
    if (showFrequencyLabels) {
      const focusGateActive = focusColours && Array.isArray(relevantScale) && relevantScale.length > 0;
      const isScalePitch = rowData ? isPitchInScale(rowData.pitch, relevantScale) : false;

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
      if (!label.includes('/')) {return label;}
      const octave = label.slice(-1);
      const pitches = label.substring(0, label.length - 1);
      const [flatName, sharpName] = pitches.split('/');

      if (sharp && flat) {return `${flatName}/${sharpName}${octave}`;}
      if (sharp) {return `${sharpName}${octave}`;}
      if (flat) {return `${flatName}${octave}`;}
      return `${sharpName}${octave}`;
    }

    // NEW: Use direct field access from expanded pitchData structure
    const { flatName, sharpName, isAccidental } = rowData;

    // For natural notes, flatName === sharpName === pitch
    if (!isAccidental) {
      return flatName; // or sharpName, they're identical for naturals
    }

    // Focus Colours override: prioritize scale degrees over accidental buttons
    if (focusColours && relevantScale.length > 0) {
      // Normalize for tonal library comparison
      const flatNormalized = flatName.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\d+$/, '');
      const sharpNormalized = sharpName.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/\d+$/, '');

      const flatInScale = relevantScale.some(note => {
        try {
          return Note.enharmonic(note) === Note.enharmonic(flatNormalized) || note === flatNormalized;
        } catch {
          return note === flatNormalized;
        }
      });

      const sharpInScale = relevantScale.some(note => {
        try {
          return Note.enharmonic(note) === Note.enharmonic(sharpNormalized) || note === sharpNormalized;
        } catch {
          return note === sharpNormalized;
        }
      });

      // If both accidental buttons are inactive, show the scale degree version
      if (!sharp && !flat) {
        if (flatInScale) {return flatName;}
        if (sharpInScale) {return sharpName;}
      }
      // If only sharp button active, show sharp version if it's in scale
      else if (sharp && !flat) {
        if (sharpInScale) {return sharpName;}
        return null; // Not in scale, hide it
      }
      // If only flat button active, show flat version if it's in scale
      else if (!sharp && flat) {
        if (flatInScale) {return flatName;}
        return null; // Not in scale, hide it
      }
      // If both buttons active, use combined notation but still filter by scale
      else if (sharp && flat) {
        if (flatInScale || sharpInScale) {
          return rowData.pitch; // Return combined notation like 'B♭/A♯7'
        }
        return null; // Neither version is in scale
      }
    }

    // Original accidental button logic (when Focus Colours is off or no relevant scale)
    let result;
    if (sharp && flat) {result = rowData.pitch;} // Combined notation like 'B♭/A♯7'
    else if (sharp && !flat) {result = sharpName;} // e.g., 'A♯7'
    else if (flat && !sharp) {result = flatName;} // e.g., 'B♭7'
    else {result = sharpName;} // Default fallback

    return result;
  };

  const isAccidentalHidden = () => !sharp && !flat;

  function drawLegendColumn(startCol, columnsOrder) {
    const xStart = getColumnX(startCol, options);
    const colWidthsPx = columnWidths.slice(startCol, startCol + 2).map(w => w * cellWidth);
    let cumulativeX = xStart;

    // Determine if this is the left legend (startCol === 0) or right legend
    const isLeftLegend = startCol === 0;
    const relevantScale = isLeftLegend ? leftScale : rightScale;


    columnsOrder.forEach((colLabel, colIndex) => {
      const colWidth = colWidthsPx[colIndex];
      // Only process rows within the visible viewport bounds
      for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
        const row = fullRowData[rowIndex];
        if (!row || row.isDummy) {continue;}

        if (row.column === colLabel) {
          const y = getRowY(rowIndex, options);
          // Use the new isAccidental field from expanded pitchData
          const isAccidental = row.isAccidental ?? row.pitch.includes('/'); // Fallback for safety
          // Don't hide accidentals when in frequency mode
          const shouldHideAccidental = !showFrequencyLabels && isAccidental && isAccidentalHidden();

          // Set transparency for background colors
          let bgColor = colorMode === 'bw' ? '#ffffff' : (row.hex || '#ffffff');

          // Pre-check if this pitch should be shown at all (for Focus Colours filtering)
          const pitchToDraw = processLabel(row.pitch, relevantScale, row);
          const shouldSkipPitch = pitchToDraw === null;


          // Check if we should apply transparency
          let shouldApplyTransparency = shouldHideAccidental || shouldSkipPitch;

          // Focus colours logic: make non-scale pitches transparent (but not in frequency mode)
          if (!showFrequencyLabels && focusColours && relevantScale.length > 0 && !shouldSkipPitch) {
            const isPitchInRelevantScale = isPitchInScale(row.pitch, relevantScale);
            if (!isPitchInRelevantScale) {
              shouldApplyTransparency = true;
            }
          }

          if (shouldApplyTransparency) {
            // Make background completely transparent
            const rgbMatch = bgColor.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
            if (rgbMatch) {
              const r = parseInt(rgbMatch[1], 16);
              const g = parseInt(rgbMatch[2], 16);
              const b = parseInt(rgbMatch[3], 16);
              bgColor = `rgba(${r}, ${g}, ${b}, 0)`; // 100% transparent
            }
          }

          ctx.fillStyle = bgColor;
          ctx.fillRect(cumulativeX, y - cellHeight / 2, colWidth, cellHeight);

          const pitchClass = getPitchClass(row.pitch);

          // Skip drawing text if pitch should not be shown
          if (shouldSkipPitch) {
            continue;
          }

          const isShortLabel = pitchToDraw.length <= 3;
          const baseFontSize = Math.max(10, Math.min(cellWidth * 1.2, cellHeight * 1.2));
          const finalFontSize = isShortLabel ? baseFontSize : baseFontSize * 0.7;

          ctx.font = `bold ${finalFontSize}px 'Atkinson Hyperlegible', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const textX = cumulativeX + colWidth / 2;
          const textY = y;

          // Apply transparency to text when accidental is hidden OR when focus colours hides non-scale pitches
          const textAlpha = shouldApplyTransparency ? '00' : 'FF'; // 100% transparent vs opaque

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
  }


  drawLegendColumn(0, ['B', 'A']);
  drawLegendColumn(columnWidths.length - 2, ['A', 'B']);
}
