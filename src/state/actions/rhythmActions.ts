// js/state/actions/rhythmActions.ts
import { ANACRUSIS_ON_GROUPINGS, ANACRUSIS_ON_STYLES, ANACRUSIS_OFF_GROUPINGS, ANACRUSIS_OFF_STYLES } from '../initialState/rhythm.js';
import { createModulationMarker, MODULATION_RATIOS } from '@/rhythm/modulationMapping.js';
import { visualToTimeIndex, timeIndexToVisualColumn, getTimeBoundaryAfterMacrobeat } from '@services/columnMap.ts';
import columnMapService from '@services/columnMapService.ts';
import logger from '@utils/logger.ts';
import type {
  AnacrusisCache,
  CanvasSpaceColumn,
  MacrobeatBoundaryStyle,
  MacrobeatGrouping,
  ModulationMarker,
  PlacedNote,
  StampPlacement,
  Store,
  TripletPlacement
} from '../../../types/state.js';

function recomputeTonicColumns(state: Store['state']): void {
  const map = columnMapService.getColumnMap(state as any);
  const tonicStartByUuid = new Map<string, number>();

  map.entries.forEach(entry => {
    if (entry.type === 'tonic' && entry.tonicSignUuid && typeof entry.canvasIndex === 'number') {
      tonicStartByUuid.set(entry.tonicSignUuid, entry.canvasIndex);
    }
  });

  Object.entries(state.tonicSignGroups || {}).forEach(([uuid, group]) => {
    const start = tonicStartByUuid.get(uuid);
    if (start === undefined) {return;}
    group.forEach(sign => {
      sign.columnIndex = start as CanvasSpaceColumn;
    });
  });
}

type ModulationRatio = (typeof MODULATION_RATIOS)[keyof typeof MODULATION_RATIOS];
type GroupingArray = MacrobeatGrouping[];
type BoundaryStyleArray = MacrobeatBoundaryStyle[];

/**
 * COORDINATE SYSTEM NOTE:
 * All column indices in this file use CANVAS-SPACE coordinates (0 = first musical beat).
 * The visualToTimeIndex and timeIndexToVisualColumn functions convert between:
 * - Visual columns: Canvas-space column indices
 * - Time indices: Abstract time units that account for modulation
 */

export const rhythmActions = {
  setAnacrusis(this: Store, enabled: boolean): void {
    if (this.state.hasAnacrusis === enabled) {return;}

    const oldGroupings: GroupingArray = [...this.state.macrobeatGroupings];
    const oldBoundaryStyles: BoundaryStyleArray = [...this.state.macrobeatBoundaryStyles];
    const oldTotalBeats = oldGroupings.reduce((sum, val) => sum + val, 0);

    let newGroupings: GroupingArray;
    let newBoundaryStyles: BoundaryStyleArray;

    if (!enabled) {
      const firstSolidIndex = oldBoundaryStyles.findIndex(style => style === 'solid');
      let removalCount = 0;

      if (firstSolidIndex !== -1) {
        removalCount = firstSolidIndex + 1;
      } else {
        while (
          removalCount < oldBoundaryStyles.length &&
                    oldBoundaryStyles[removalCount] === 'anacrusis'
        ) {
          removalCount++;
        }
      }

      removalCount = Math.min(removalCount, oldGroupings.length);

      const removedGroupings = oldGroupings.slice(0, removalCount);
      const removedStyles = oldBoundaryStyles.slice(0, removalCount);

      if (removalCount > 0) {
        this._anacrusisCache = {
          groupings: removedGroupings,
          boundaryStyles: removedStyles
        };
      } else {
        this._anacrusisCache = null;
      }

      newGroupings = oldGroupings.slice(removalCount);
      newBoundaryStyles = oldBoundaryStyles
        .slice(removalCount)
        .map(style => (style === 'anacrusis' ? 'dashed' : style));

      if (newGroupings.length === 0) {
        newGroupings = [...ANACRUSIS_OFF_GROUPINGS];
        newBoundaryStyles = [...ANACRUSIS_OFF_STYLES];
      }

      logger.debug(
        'rhythmActions',
        'Disabled anacrusis',
        {
          removalCount,
          removedColumns: removedGroupings.reduce((sum, val) => sum + val, 0)
        },
        'state'
      );
    } else {
      const cache: AnacrusisCache | null | undefined = this._anacrusisCache;
      const anacrusisLength = ANACRUSIS_ON_GROUPINGS.length - ANACRUSIS_OFF_GROUPINGS.length;
      const defaultGroupings = ANACRUSIS_ON_GROUPINGS.slice(0, anacrusisLength);
      const defaultStyles = ANACRUSIS_ON_STYLES.slice(0, anacrusisLength);

      const groupingsToInsert = cache?.groupings?.length
        ? [...cache.groupings]
        : [...defaultGroupings];
      const stylesToInsert = cache?.boundaryStyles?.length
        ? [...cache.boundaryStyles]
        : [...defaultStyles];

      newGroupings = [...groupingsToInsert, ...oldGroupings];
      newBoundaryStyles = [...stylesToInsert, ...oldBoundaryStyles];

      if (!cache?.boundaryStyles?.length) {
        for (let i = 0; i < stylesToInsert.length; i++) {
          newBoundaryStyles[i] = i < stylesToInsert.length - 1 ? 'anacrusis' : 'solid';
        }
      }

      this._anacrusisCache = null;

      logger.debug(
        'rhythmActions',
        'Enabled anacrusis',
        {
          insertedCount: groupingsToInsert.length,
          insertedColumns: groupingsToInsert.reduce((sum, val) => sum + val, 0)
        },
        'state'
      );
    }

    const newTotalBeats = newGroupings.reduce((sum, val) => sum + val, 0);
    const timeShift = newTotalBeats - oldTotalBeats;

    this.state.hasAnacrusis = enabled;
    this.state.macrobeatGroupings = [...newGroupings];
    this.state.macrobeatBoundaryStyles = [...newBoundaryStyles];
    recomputeTonicColumns(this.state);

    if (timeShift !== 0) {
      const notesToRemove: PlacedNote[] = [];

      this.state.placedNotes.forEach(note => {
        const startTime = visualToTimeIndex(this.state, note.startColumnIndex, oldGroupings);
        const endTime = visualToTimeIndex(this.state, note.endColumnIndex, oldGroupings);

        if (startTime === null || endTime === null) {
          return;
        }

        const newStartTime = startTime + timeShift;
        const newEndTime = endTime + timeShift;

        if (newStartTime < 0) {
          notesToRemove.push(note);
          return;
        }

        const newStartColumn = timeIndexToVisualColumn(this.state, newStartTime, newGroupings);
        const newEndColumn = timeIndexToVisualColumn(this.state, newEndTime, newGroupings);

        if (newStartColumn === null || newEndColumn === null) {
          notesToRemove.push(note);
          return;
        }

        // timeIndexToVisualColumn returns canvas-space columns
        note.startColumnIndex = newStartColumn as CanvasSpaceColumn;
        note.endColumnIndex = newEndColumn as CanvasSpaceColumn;
      });

      notesToRemove.forEach(noteToRemove => {
        const index = this.state.placedNotes.indexOf(noteToRemove);
        if (index > -1) {
          this.state.placedNotes.splice(index, 1);
        }
      });

      const stampsToRemove: StampPlacement[] = [];

      this.state.stampPlacements.forEach(stamp => {
        const startTime = visualToTimeIndex(this.state, stamp.startColumn, oldGroupings);
        const endTime = visualToTimeIndex(this.state, stamp.endColumn, oldGroupings);

        if (startTime === null || endTime === null) {
          return;
        }

        const newStartTime = startTime + timeShift;
        const newEndTime = endTime + timeShift;

        if (newStartTime < 0) {
          stampsToRemove.push(stamp);
          return;
        }

        const newStartColumn = timeIndexToVisualColumn(this.state, newStartTime, newGroupings);
        const newEndColumn = timeIndexToVisualColumn(this.state, newEndTime, newGroupings);

        if (newStartColumn === null || newEndColumn === null) {
          stampsToRemove.push(stamp);
          return;
        }

        // timeIndexToVisualColumn returns canvas-space columns
        stamp.startColumn = newStartColumn as CanvasSpaceColumn;
        stamp.endColumn = newEndColumn as CanvasSpaceColumn;
      });

      stampsToRemove.forEach(stampToRemove => {
        const index = this.state.stampPlacements.indexOf(stampToRemove);
        if (index > -1) {
          this.state.stampPlacements.splice(index, 1);
        }
      });

      const tripletsToRemove: TripletPlacement[] = [];

      if (this.state.tripletPlacements) {
        this.state.tripletPlacements.forEach(triplet => {
          const cellShift = timeShift / 2;
          const legendCells = 1;

          if (triplet.startCellIndex >= legendCells) {
            const newStartCellIndex = triplet.startCellIndex + cellShift;

            if (newStartCellIndex < legendCells) {
              tripletsToRemove.push(triplet);
            } else {
              triplet.startCellIndex = newStartCellIndex;
            }
          }
        });

        tripletsToRemove.forEach(tripletToRemove => {
          const index = this.state.tripletPlacements.indexOf(tripletToRemove);
          if (index > -1) {
            this.state.tripletPlacements.splice(index, 1);
          }
        });
      }

      Object.values(this.state.tonicSignGroups).flat().forEach(tonicSign => {
        if (tonicSign.preMacrobeatIndex >= 0) {
          // Position recomputed during layout
        }
      });

      // Update modulation markers to reflect the new grid layout
      const markersToRemove: ModulationMarker[] = [];
      const anacrusisShift = enabled ?
        (newGroupings.length - oldGroupings.length) :
        -(oldGroupings.length - newGroupings.length);

      this.state.modulationMarkers.forEach(marker => {
        // Shift measureIndex by the number of macrobeats added/removed
        const newMeasureIndex = marker.measureIndex + anacrusisShift;

        if (newMeasureIndex < 0) {
          // Marker is now before the start of the grid - remove it
          markersToRemove.push(marker);
          return;
        }

        // Update measureIndex to reflect new position
        marker.measureIndex = newMeasureIndex;

        // Clear ALL cached position data to force recalculation with new grid
        marker.columnIndex = null;
        marker.xPosition = null;
        marker.macrobeatIndex = null; // CRITICAL: Clear this so renderer uses measureIndex instead
      });

      markersToRemove.forEach(markerToRemove => {
        const index = this.state.modulationMarkers.indexOf(markerToRemove);
        if (index > -1) {
          this.state.modulationMarkers.splice(index, 1);
        }
      });
    }

    this.emit('anacrusisChanged', enabled);
    this.emit('notesChanged'); // Ensure notes are redrawn with new positions
    this.emit('stampPlacementsChanged'); // Ensure stamps are redrawn with new positions
    this.emit('tripletPlacementsChanged'); // Ensure triplets are redrawn with new positions
    this.emit('modulationMarkersChanged'); // Ensure modulation markers are redrawn with new positions
    this.emit('rhythmStructureChanged');
    this.recordState();
  },

  /**
     * Toggles a macrobeat's grouping between 2 and 3 and intelligently transposes all
     * subsequent notes and tonic signs to keep them aligned with their musical position.
     * @param {number} index - The index of the macrobeat grouping to toggle.
     */
  toggleMacrobeatGrouping(this: Store, index: number): void {
    if (index === undefined || index < 0 || index >= this.state.macrobeatGroupings.length) {
      logger.error('rhythmActions', `Invalid index for toggleMacrobeatGrouping: ${index}`, null, 'state');
      return;
    }

    // --- 1. Determine the change and the boundary ---
    const oldGroupings = [...this.state.macrobeatGroupings];
    const currentValue = oldGroupings[index]!;
    const newValue = currentValue === 2 ? 3 : 2;
    const delta = newValue - currentValue; // +1 or -1 time-bearing columns

    const newGroupings = [...oldGroupings];
    newGroupings[index] = newValue;

    const boundaryTime = getTimeBoundaryAfterMacrobeat(this.state, index, oldGroupings);

    // --- 2. Transpose all notes that occur after the boundary (time-aware) ---
    const notesToRemove: PlacedNote[] = [];

    this.state.placedNotes.forEach(note => {
      const startTime = visualToTimeIndex(this.state, note.startColumnIndex, oldGroupings);
      const endTime = visualToTimeIndex(this.state, note.endColumnIndex, oldGroupings);

      if (startTime === null || endTime === null) {
        return;
      }

      if (startTime >= boundaryTime) {
        const newStartTime = startTime + delta;
        const newEndTime = endTime + delta;
        const newStartCol = timeIndexToVisualColumn(this.state, newStartTime, newGroupings);
        const newEndCol = timeIndexToVisualColumn(this.state, newEndTime, newGroupings);
        if (newStartCol !== null && newEndCol !== null) {
          // timeIndexToVisualColumn returns canvas-space columns
          note.startColumnIndex = newStartCol as CanvasSpaceColumn;
          note.endColumnIndex = newEndCol as CanvasSpaceColumn;
        } else {
          notesToRemove.push(note);
        }
      }
    });

    if (notesToRemove.length) {
      notesToRemove.forEach(n => {
        const idx = this.state.placedNotes.indexOf(n);
        if (idx > -1) {this.state.placedNotes.splice(idx, 1);}
      });
    }

    // --- 3. Update the state and notify the application ---
    this.state.macrobeatGroupings = newGroupings;
    recomputeTonicColumns(this.state);

    // Emit both events to ensure the notes and the grid lines redraw correctly.
    this.emit('notesChanged');
    this.emit('rhythmStructureChanged');

    this.recordState();
  },

  cycleMacrobeatBoundaryStyle(this: Store, index: number): void {
    if (index === undefined || index < 0 || index >= this.state.macrobeatBoundaryStyles.length) {
      logger.error('rhythmActions', `Invalid index for cycleMacrobeatBoundaryStyle: ${index}`, null, 'state');
      return;
    }

    // Determine if this boundary is within anacrusis area
    const isInAnacrusis = this._isBoundaryInAnacrusis(index);

    let styles: BoundaryStyleArray;
    if (isInAnacrusis) {
      // In anacrusis: cycle through all 3 states (dashed, solid, anacrusis)
      styles = ['dashed', 'solid', 'anacrusis'];
    } else {
      // Outside anacrusis: only cycle between dashed and solid
      styles = ['dashed', 'solid'];
    }

    const currentStyle = this.state.macrobeatBoundaryStyles[index] ?? 'dashed';
    const currentIndex = styles.indexOf(currentStyle);

    // If current style is not in the allowed styles for this area, start from beginning
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % styles.length;
    const nextStyle = styles[nextIndex] ?? 'dashed';
    this.state.macrobeatBoundaryStyles[index] = nextStyle;

    this.emit('rhythmStructureChanged');
    this.recordState();
  },

  _isBoundaryInAnacrusis(this: Store, boundaryIndex: number): boolean {
    if (!this.state.hasAnacrusis) {return false;}

    // Check if any boundary before this one (or this one) has 'solid' style
    // Anacrusis continues until the first solid boundary
    for (let i = 0; i <= boundaryIndex; i++) {
      if (this.state.macrobeatBoundaryStyles[i] === 'solid') {
        return i === boundaryIndex; // Only the solid boundary itself is still considered anacrusis
      }
    }
    return true; // No solid boundary found yet, so still in anacrusis
  },

  increaseMacrobeatCount(this: Store): void {
    this.state.macrobeatGroupings.push(2);
    this.state.macrobeatBoundaryStyles.push('dashed');
    this.emit('rhythmStructureChanged');
    this.recordState();
  },

  decreaseMacrobeatCount(this: Store): void {
    if (this.state.macrobeatGroupings.length > 1) {
      // Calculate the time boundary for the last macrobeat before removal
      const lastMacrobeatIndex = this.state.macrobeatGroupings.length - 1;
      const boundaryTime = getTimeBoundaryAfterMacrobeat(
        this.state,
        lastMacrobeatIndex - 1,
        this.state.macrobeatGroupings
      );

      // Remove notes that are at or beyond this boundary
      const notesToRemove: PlacedNote[] = [];
      this.state.placedNotes.forEach(note => {
        const startTime = visualToTimeIndex(this.state, note.startColumnIndex, this.state.macrobeatGroupings);
        if (startTime !== null && startTime >= boundaryTime) {
          notesToRemove.push(note);
        }
      });

      notesToRemove.forEach(note => {
        const idx = this.state.placedNotes.indexOf(note);
        if (idx > -1) {
          this.state.placedNotes.splice(idx, 1);
        }
      });

      // Remove stamps that are at or beyond this boundary
      const stampsToRemove: StampPlacement[] = [];
      this.state.stampPlacements.forEach(stamp => {
        const startTime = visualToTimeIndex(this.state, stamp.startColumn, this.state.macrobeatGroupings);
        if (startTime !== null && startTime >= boundaryTime) {
          stampsToRemove.push(stamp);
        }
      });

      stampsToRemove.forEach(stamp => {
        const idx = this.state.stampPlacements.indexOf(stamp);
        if (idx > -1) {
          this.state.stampPlacements.splice(idx, 1);
        }
      });

      // Remove triplets that are at or beyond this boundary
      const tripletsToRemove: TripletPlacement[] = [];
      if (this.state.tripletPlacements) {
        // Convert time boundary to cell index (triplets use cell-based indexing)
        const boundaryCellIndex = boundaryTime / 2;

        this.state.tripletPlacements.forEach(triplet => {
          if (triplet.startCellIndex >= boundaryCellIndex) {
            tripletsToRemove.push(triplet);
          }
        });

        tripletsToRemove.forEach(triplet => {
          const idx = this.state.tripletPlacements.indexOf(triplet);
          if (idx > -1) {
            this.state.tripletPlacements.splice(idx, 1);
          }
        });
      }

      // Now remove the macrobeat grouping and boundary style
      this.state.macrobeatGroupings.pop();
      this.state.macrobeatBoundaryStyles.pop();

      // Emit appropriate events
      if (notesToRemove.length > 0) {
        this.emit('notesChanged');
      }
      if (stampsToRemove.length > 0) {
        this.emit('stampPlacementsChanged');
      }
      if (tripletsToRemove.length > 0) {
        this.emit('tripletPlacementsChanged');
      }
      this.emit('rhythmStructureChanged');
      this.recordState();
    }
  },

  /**
     * Updates a specific measure's time signature by replacing its macrobeat groupings
     * @param {number} measureIndex - The index of the measure to update
     * @param {Array} newGroupings - Array of 2s and 3s defining the new time signature
     */
  updateTimeSignature(this: Store, measureIndex: number, newGroupings: GroupingArray): void {
    if (!Array.isArray(newGroupings) || newGroupings.length === 0) {
      logger.error('rhythmActions', 'Invalid groupings provided to updateTimeSignature', null, 'state');
      return;
    }

    // Find the start and end indices of the measure in the macrobeatGroupings array
    let measureStartIndex = 0;
    let measureEndIndex = 0;
    let currentMeasure = 0;

    for (let i = 0; i < this.state.macrobeatGroupings.length; i++) {
      if (currentMeasure === measureIndex) {
        measureStartIndex = i;
        break;
      }

      // Check if this boundary ends a measure (solid boundary or last beat)
      const isLastBeat = (i === this.state.macrobeatGroupings.length - 1);
      const boundaryStyle = this.state.macrobeatBoundaryStyles[i];
      const isSolidBoundary = (boundaryStyle === 'solid');

      if (isSolidBoundary || isLastBeat) {
        currentMeasure++;
      }
    }

    // Find the end of the target measure
    currentMeasure = 0;
    for (let i = 0; i < this.state.macrobeatGroupings.length; i++) {
      if (currentMeasure === measureIndex) {
        const isLastBeat = (i === this.state.macrobeatGroupings.length - 1);
        const boundaryStyle = this.state.macrobeatBoundaryStyles[i];
        const isSolidBoundary = (boundaryStyle === 'solid');

        if (isSolidBoundary || isLastBeat) {
          measureEndIndex = i;
          break;
        }
      } else if (currentMeasure < measureIndex) {
        const isLastBeat = (i === this.state.macrobeatGroupings.length - 1);
        const boundaryStyle = this.state.macrobeatBoundaryStyles[i];
        const isSolidBoundary = (boundaryStyle === 'solid');

        if (isSolidBoundary || isLastBeat) {
          currentMeasure++;
        }
      }
    }

    // Calculate time shift for existing notes (time-bearing columns only)
    const oldLength = measureEndIndex - measureStartIndex + 1;
    const newLength = newGroupings.length;
    const oldTimeSpan = this.state.macrobeatGroupings.slice(measureStartIndex, measureEndIndex + 1)
      .reduce((sum, val) => sum + val, 0);
    const newTimeSpan = newGroupings.reduce((sum, val) => sum + val, 0);
    const timeShift = newTimeSpan - oldTimeSpan;

    const boundaryTime = getTimeBoundaryAfterMacrobeat(this.state, measureEndIndex, this.state.macrobeatGroupings);

    // Shift notes that come after this measure (in time space)
    if (timeShift !== 0) {
      const nextMacrobeatGroupings = (() => {
        const tmp: GroupingArray = [...this.state.macrobeatGroupings];
        tmp.splice(measureStartIndex, oldLength, ...newGroupings);
        return tmp;
      })();

      const notesToRemove: PlacedNote[] = [];

      this.state.placedNotes.forEach(note => {
        const startTime = visualToTimeIndex(this.state, note.startColumnIndex, this.state.macrobeatGroupings);
        const endTime = visualToTimeIndex(this.state, note.endColumnIndex, this.state.macrobeatGroupings);

        if (startTime === null || endTime === null) {
          return;
        }

        if (startTime >= boundaryTime) {
          const newStartTime = startTime + timeShift;
          const newEndTime = endTime + timeShift;
          const newStartCol = timeIndexToVisualColumn(this.state, newStartTime, nextMacrobeatGroupings);
          const newEndCol = timeIndexToVisualColumn(this.state, newEndTime, nextMacrobeatGroupings);

          if (newStartCol !== null && newEndCol !== null) {
            // timeIndexToVisualColumn returns canvas-space columns
            note.startColumnIndex = newStartCol as CanvasSpaceColumn;
            note.endColumnIndex = newEndCol as CanvasSpaceColumn;
          } else {
            notesToRemove.push(note);
          }
        }
      });

      if (notesToRemove.length) {
        notesToRemove.forEach(n => {
          const idx = this.state.placedNotes.indexOf(n);
          if (idx > -1) {this.state.placedNotes.splice(idx, 1);}
        });
      }
    }

    // Replace the measure's macrobeat groupings
    const newGroupingsCopy = [...newGroupings];
    const newStylesArray = new Array<MacrobeatBoundaryStyle>(Math.max(newLength - 1, 0)).fill('dashed');

    // Preserve the final boundary style of the measure if it's not the last measure
    if (measureEndIndex < this.state.macrobeatBoundaryStyles.length) {
      const originalFinalStyle = this.state.macrobeatBoundaryStyles[measureEndIndex] ?? 'dashed';
      newStylesArray.push(originalFinalStyle);
    }

    this.state.macrobeatGroupings.splice(measureStartIndex, oldLength, ...newGroupingsCopy);
    this.state.macrobeatBoundaryStyles.splice(measureStartIndex, oldLength - 1, ...newStylesArray);

    this.emit('notesChanged');
    this.emit('rhythmStructureChanged');
    this.recordState();
  },

  /**
     * Adds a new modulation marker at the specified measure boundary
     * @param {number} measureIndex - Index of the measure after which modulation starts
     * @param {number} ratio - Modulation ratio (2/3 or 3/2)
     * @param {number} xPosition - Optional X position override (for accurate placement)
     * @param {CanvasSpaceColumn} columnIndex - Optional canvas-space column index for stable positioning
     * @param {number} macrobeatIndex - Optional macrobeat index for stable positioning
     * @returns {string} The ID of the created marker
     */
  addModulationMarker(
    this: Store,
    measureIndex: number,
    ratio: ModulationRatio,
    xPosition: number | null = null,
    columnIndex: CanvasSpaceColumn | null = null,
    macrobeatIndex: number | null = null
  ): string | null {
    if (!Object.values(MODULATION_RATIOS).includes(ratio)) {
      logger.error('rhythmActions', `Invalid modulation ratio: ${ratio}`, null, 'state');
      return null;
    }

    // Check for existing marker at the same location
    const existingMarkerIndex = this.state.modulationMarkers.findIndex((marker: ModulationMarker) => {
      // Check by measureIndex first (primary location identifier)
      if (marker.measureIndex === measureIndex) {
        return true;
      }

      // If macrobeatIndex is provided, also check for conflicts there
      if (macrobeatIndex !== null && marker.macrobeatIndex === macrobeatIndex) {
        return true;
      }

      // If columnIndex is provided, also check for conflicts there
      if (columnIndex !== null && marker.columnIndex === columnIndex) {
        return true;
      }

      return false;
    });

    if (existingMarkerIndex !== -1) {
      // Replace existing marker at the same location
      const existingMarker = this.state.modulationMarkers[existingMarkerIndex]!;
      logger.info('rhythmActions', `Replacing existing modulation marker ${existingMarker.id} at measure ${measureIndex} (old ratio: ${existingMarker.ratio}, new ratio: ${ratio})`, null, 'state');

      // Update the existing marker with new values
      existingMarker.ratio = ratio;
      existingMarker.xPosition = xPosition;
      if (columnIndex !== null) {existingMarker.columnIndex = columnIndex;}
      if (macrobeatIndex !== null) {existingMarker.macrobeatIndex = macrobeatIndex;}

      this.emit('modulationMarkersChanged');
      this.recordState();

      return existingMarker.id;
    }

    // No existing marker, create new one
    const marker = createModulationMarker(measureIndex, ratio, xPosition, columnIndex, macrobeatIndex);
    this.state.modulationMarkers.push(marker);

    // Sort markers by measure index
    this.state.modulationMarkers.sort((a, b) => a.measureIndex - b.measureIndex);

    this.emit('modulationMarkersChanged');
    this.recordState();

    logger.info('rhythmActions', `Added modulation marker ${marker.id} at measure ${measureIndex} with ratio=${ratio}, columnIndex=${columnIndex}`, null, 'state');
    return marker.id;
  },

  /**
     * Removes a modulation marker by ID
     * @param {string} markerId - The ID of the marker to remove
     */
  removeModulationMarker(this: Store, markerId: string): void {
    const index = this.state.modulationMarkers.findIndex(m => m.id === markerId);
    if (index === -1) {
      logger.warn('rhythmActions', `Modulation marker not found: ${markerId}`, null, 'state');
      return;
    }

    this.state.modulationMarkers.splice(index, 1);
    this.emit('modulationMarkersChanged');
    this.recordState();

    logger.info('rhythmActions', `Removed modulation marker ${markerId}`, null, 'state');
  },

  /**
     * Updates the ratio of a modulation marker
     * @param {string} markerId - The ID of the marker to update
     * @param {number} ratio - New modulation ratio
     */
  setModulationRatio(this: Store, markerId: string, ratio: ModulationRatio): void {
    if (!Object.values(MODULATION_RATIOS).includes(ratio)) {
      logger.error('rhythmActions', `Invalid modulation ratio: ${ratio}`, null, 'state');
      return;
    }

    const marker = this.state.modulationMarkers.find(m => m.id === markerId);
    if (!marker) {
      logger.warn('rhythmActions', `Modulation marker not found: ${markerId}`, null, 'state');
      return;
    }

    marker.ratio = ratio;
    this.emit('modulationMarkersChanged');
    this.recordState();

    logger.info('rhythmActions', `Updated modulation marker ${markerId} ratio to ${ratio}`, null, 'state');
  },

  /**
     * Moves a modulation marker to a new measure boundary
     * @param {string} markerId - The ID of the marker to move
     * @param {number} measureIndex - New measure index
     */
  moveModulationMarker(this: Store, markerId: string, measureIndex: number): void {
    const marker = this.state.modulationMarkers.find(m => m.id === markerId);
    if (!marker) {
      logger.warn('rhythmActions', `Modulation marker not found: ${markerId}`, null, 'state');
      return;
    }

    marker.measureIndex = measureIndex;

    // Re-sort markers by measure index
    this.state.modulationMarkers.sort((a, b) => a.measureIndex - b.measureIndex);

    this.emit('modulationMarkersChanged');
    this.recordState();

    logger.info('rhythmActions', `Moved modulation marker ${markerId} to measure ${measureIndex}`, null, 'state');
  },

  /**
     * Toggles the active state of a modulation marker
     * @param {string} markerId - The ID of the marker to toggle
     */
  toggleModulationMarker(this: Store, markerId: string): void {
    const marker = this.state.modulationMarkers.find(m => m.id === markerId);
    if (!marker) {
      logger.warn('rhythmActions', `Modulation marker not found: ${markerId}`, null, 'state');
      return;
    }

    marker.active = !marker.active;
    this.emit('modulationMarkersChanged');
    this.recordState();

    logger.info('rhythmActions', `Toggled modulation marker ${markerId} active state to ${marker.active}`, null, 'state');
  },

  /**
     * Clears all modulation markers
     */
  clearModulationMarkers(this: Store): void {
    const removedCount = this.state.modulationMarkers.length;
    this.state.modulationMarkers = [];
    this.emit('modulationMarkersChanged');
    this.recordState();

    logger.info('rhythmActions', `Cleared ${removedCount} modulation markers`, null, 'state');
  }
};
