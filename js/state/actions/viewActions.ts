// js/state/actions/viewActions.ts
import { fullRowData as masterRowData } from '../pitchData.js';
import logger from '@utils/logger.ts';
import type { Store, Annotation, PrintOptions, PlacedNote } from '../../../types/state.js';

interface PitchRange {
  topIndex: number;
  bottomIndex: number;
}

function remapAnnotation(annotation: Annotation, oldRange: PitchRange, newRange: PitchRange): boolean {
  if (!annotation || typeof annotation !== 'object') {
    return true;
  }

  const oldTop = oldRange.topIndex;
  const newTop = newRange.topIndex;
  const newBottom = newRange.bottomIndex;
  const maxRow = newBottom - newTop;

  let hasRowData = false;
  let hasRowWithinRange = false;

  const adjustValue = (value: unknown): unknown => {
    if (typeof value !== 'number') {return value;}
    hasRowData = true;
    const global = value + oldTop;
    if (global >= newTop && global <= newBottom) {
      hasRowWithinRange = true;
    }
    const remapped = global - newTop;
    return Math.max(0, Math.min(maxRow, remapped));
  };

  if (typeof annotation['row'] === 'number') {
    annotation['row'] = adjustValue(annotation['row']);
  }
  if (typeof annotation['startRow'] === 'number') {
    annotation['startRow'] = adjustValue(annotation['startRow']);
  }
  if (typeof annotation['endRow'] === 'number') {
    annotation['endRow'] = adjustValue(annotation['endRow']);
  }
  if (typeof annotation['mouseRow'] === 'number') {
    annotation['mouseRow'] = adjustValue(annotation['mouseRow']);
  }
  if (typeof annotation['baseRow'] === 'number') {
    annotation['baseRow'] = adjustValue(annotation['baseRow']);
  }

  if (Array.isArray(annotation['path'])) {
    let pathWithin = false;
    annotation['path'].forEach((point: unknown) => {
      if (point && typeof (point as { row?: number }).row === 'number') {
        const p = point as { row: number };
        const global = p.row + oldTop;
        if (global >= newTop && global <= newBottom) {
          pathWithin = true;
        }
        p.row = Math.max(0, Math.min(maxRow, global - newTop));
      }
    });
    if (annotation['path'].length > 0) {
      hasRowData = true;
      if (pathWithin) {
        hasRowWithinRange = true;
      }
    }
  }

  if (Array.isArray(annotation['points'])) {
    let pointsWithin = false;
    annotation['points'].forEach((point: unknown) => {
      if (point && typeof (point as { row?: number }).row === 'number') {
        const p = point as { row: number };
        const global = p.row + oldTop;
        if (global >= newTop && global <= newBottom) {
          pointsWithin = true;
        }
        p.row = Math.max(0, Math.min(maxRow, global - newTop));
      }
    });
    if (annotation['points'].length > 0) {
      hasRowData = true;
      if (pointsWithin) {
        hasRowWithinRange = true;
      }
    }
  }

  if (annotation['data'] && typeof annotation['data'] === 'object') {
    Object.entries(annotation['data'] as Record<string, unknown>).forEach(([, value]) => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          value.forEach((item: unknown) => {
            if (item && typeof (item as { row?: number }).row === 'number') {
              const it = item as { row: number };
              const global = it.row + oldTop;
              if (global >= newTop && global <= newBottom) {
                hasRowWithinRange = true;
              }
              hasRowData = true;
              it.row = Math.max(0, Math.min(maxRow, global - newTop));
            }
          });
        } else if (typeof (value as { row?: number }).row === 'number') {
          const v = value as { row: number };
          const global = v.row + oldTop;
          if (global >= newTop && global <= newBottom) {
            hasRowWithinRange = true;
          }
          hasRowData = true;
          v.row = Math.max(0, Math.min(maxRow, global - newTop));
        }
      }
    });
  }

  return !hasRowData || hasRowWithinRange;
}

export const viewActions = {
  // Tools
  toggleAccidentalMode(this: Store, type: 'flat' | 'sharp'): void {
    if (!Object.prototype.hasOwnProperty.call(this.state.accidentalMode || {}, type)) {return;}

    const snapshot = { ...this.state.accidentalMode };
    const currentValue = snapshot[type];
    const otherType = type === 'flat' ? 'sharp' : 'flat';
    const otherValue = snapshot[otherType];

    logger.debug('ViewActions', `toggleAccidentalMode(${type})`, {
      previousState: snapshot,
      requestedType: type,
      requestedValue: !currentValue,
      pairedType: otherType,
      pairedValue: otherValue
    }, 'state');

    if (currentValue && !otherValue) {
      this.state.accidentalMode[otherType] = true;
      this.state.accidentalMode[type] = false;
      logger.warn('ViewActions', `Prevented both accidentals from being disabled (enabling ${otherType})`, {
        enforcedType: otherType,
        toggledType: type
      }, 'state');
    } else {
      this.state.accidentalMode[type] = !currentValue;
    }

    logger.debug('ViewActions', `toggleAccidentalMode(${type}) result`, {
      newState: { ...this.state.accidentalMode }
    }, 'state');
    this.emit('accidentalModeChanged', this.state.accidentalMode);
    this.emit('layoutConfigChanged');
  },

  toggleFrequencyLabels(this: Store): void {
    const previous = this.state.showFrequencyLabels;
    this.state.showFrequencyLabels = !this.state.showFrequencyLabels;

    logger.debug('ViewActions', 'toggleFrequencyLabels', {
      previous,
      next: this.state.showFrequencyLabels,
      accidentalMode: { ...this.state.accidentalMode }
    }, 'state');

    this.emit('frequencyLabelsChanged', this.state.showFrequencyLabels);
    this.emit('layoutConfigChanged');
  },

  toggleFocusColours(this: Store): void {
    this.state.focusColours = !this.state.focusColours;
    const focusColoursEnabled = this.state.focusColours;
    this.emit('focusColoursChanged', focusColoursEnabled);

    if (focusColoursEnabled && !this.state.showFrequencyLabels) {
      this.state.showFrequencyLabels = true;
      this.emit('frequencyLabelsChanged', true);
    }

    this.emit('layoutConfigChanged');
  },

  setSnapZoomToRange(this: Store, enabled: boolean): void {
    const normalized = Boolean(enabled);
    if (this.state.snapZoomToRange === normalized) {
      return;
    }
    this.state.snapZoomToRange = normalized;
    this.emit('snapZoomSettingChanged', normalized);
  },

  setPitchRangeLock(this: Store, isLocked: boolean): void {
    const normalized = Boolean(isLocked);
    if (this.state.isPitchRangeLocked === normalized) {
      return;
    }
    this.state.isPitchRangeLocked = normalized;
    this.emit('pitchRangeLockChanged', normalized);
  },

  setDegreeDisplayMode(this: Store, mode: 'off' | 'sharps' | 'flats'): void {
    const oldMode = this.state.degreeDisplayMode;
    this.state.degreeDisplayMode = this.state.degreeDisplayMode === mode ? 'off' : mode;
    const newMode = this.state.degreeDisplayMode;
    logger.debug('ViewActions', 'setDegreeDisplayMode', { oldMode, newMode }, 'state');

    this.emit('layoutConfigChanged');
    this.emit('degreeDisplayModeChanged', newMode);
  },

  // REVISED: This now sets the tool type and optional tonic number
  setSelectedTool(this: Store, type: string, tonicNumber?: string | number): void {
    const stateChanged = this.state.selectedTool !== type ||
                           (type === 'tonicization' && this.state.selectedToolTonicNumber !== tonicNumber);

    if (stateChanged) {
      const oldTool = this.state.selectedTool;
      this.state.previousTool = oldTool;
      this.state.selectedTool = type;

      if (type === 'tonicization' && tonicNumber) {
        this.state.selectedToolTonicNumber = parseInt(String(tonicNumber), 10);
      }

      this.emit('toolChanged', { newTool: type, oldTool });
    }
  },

  // NEW: Action to set the active note properties
  setSelectedNote(this: Store, shape: 'circle' | 'oval' | 'diamond', color: string): void {
    const oldNote = { ...this.state.selectedNote };
    this.state.selectedNote = { shape, color };
    this.emit('noteChanged', { newNote: this.state.selectedNote, oldNote });
  },

  setKeySignature(this: Store, newKey: string): void {
    if (this.state.keySignature !== newKey) {
      this.state.keySignature = newKey;
      this.emit('keySignatureChanged', newKey);
    }
  },

  // Playback
  setTempo(this: Store, newTempo: number): void { this.state.tempo = newTempo; this.emit('tempoChanged', newTempo); },
  setLooping(this: Store, isLooping: boolean): void { this.state.isLooping = isLooping; this.emit('loopingChanged', isLooping); },
  setPlaybackState(this: Store, isPlaying: boolean, isPaused = false): void { this.state.isPlaying = isPlaying; this.state.isPaused = isPaused; this.emit('playbackStateChanged', { isPlaying, isPaused }); },

  // Waveform
  toggleWaveformExtendedView(this: Store): void {
    this.state.waveformExtendedView = !this.state.waveformExtendedView;
    this.emit('waveformExtendedViewChanged', this.state.waveformExtendedView);
  },

  // ADSR
  setAdsrTimeAxisScale(this: Store, scale: number): void {
    const clampedScale = Math.max(0.1, Math.min(5.0, scale)); // Clamp between 0.1x and 5.0x
    this.state.adsrTimeAxisScale = clampedScale;
    this.emit('adsrTimeAxisScaleChanged', clampedScale);
  },

  // Layout & Viewport
  setLayoutConfig(this: Store, config: { cellWidth?: number; cellHeight?: number; columnWidths?: number[] }): void {
    const oldConfig = {
      cellWidth: this.state.cellWidth,
      cellHeight: this.state.cellHeight,
      columnWidths: [...(this.state.columnWidths || [])]
    };

    let hasChanges = false;

    if (config.cellWidth !== undefined && this.state.cellWidth !== config.cellWidth) {
      this.state.cellWidth = config.cellWidth;
      hasChanges = true;
    }

    if (config.cellHeight !== undefined && this.state.cellHeight !== config.cellHeight) {
      this.state.cellHeight = config.cellHeight;
      hasChanges = true;
    }

    if (config.columnWidths !== undefined) {
      const oldWidths = JSON.stringify(this.state.columnWidths || []);
      const newWidths = JSON.stringify(config.columnWidths);
      if (oldWidths !== newWidths) {
        this.state.columnWidths = [...config.columnWidths];
        // Automatically calculate musicalColumnWidths (canvas-space: no legends)
        this.state.musicalColumnWidths = config.columnWidths.slice(2, -2);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.emit('layoutConfigChanged', {
        oldConfig,
        newConfig: {
          cellWidth: this.state.cellWidth,
          cellHeight: this.state.cellHeight,
          columnWidths: [...(this.state.columnWidths || [])],
          musicalColumnWidths: [...(this.state.musicalColumnWidths || [])]
        }
      });
    }
    // else: No history to push
  },

  setGridPosition(this: Store, newPosition: number): void {
    const maxPosition = this.state.fullRowData.length - (this.state.viewportRows * 2);
    const clampedPosition = Math.max(0, Math.min(newPosition, maxPosition));
    if (this.state.gridPosition !== clampedPosition) {
      this.state.gridPosition = clampedPosition;
      this.emit('layoutConfigChanged');
    }
  },
  shiftGridUp(this: Store): void { viewActions.setGridPosition.call(this, this.state.gridPosition - 1); },
  shiftGridDown(this: Store): void { viewActions.setGridPosition.call(this, this.state.gridPosition + 1); },

  // Print
  setPrintOptions(this: Store, newOptions: Partial<PrintOptions>): void {
    this.state.printOptions = { ...this.state.printOptions, ...newOptions };
    this.emit('printOptionsChanged', this.state.printOptions);
  },

  setPrintPreviewActive(this: Store, isActive: boolean): void {
    this.state.isPrintPreviewActive = isActive;
    this.emit('printPreviewStateChanged', isActive);
  },

  /**
     * Sets the active pitch range for the grid and removes/adjusts content outside the range.
     * @param range - The desired range { topIndex, bottomIndex } in masterRowData indices.
     */
  setPitchRange(this: Store, range: Partial<PitchRange>, options: { trimOutsideRange?: boolean; preserveContent?: boolean; maintainGlobalStart?: number } = {}): void {
    // Debug logs removed

    const { trimOutsideRange = true, preserveContent = false } = options;
    const shouldTrim = trimOutsideRange && !preserveContent;
    const totalRows = masterRowData.length;
    const oldRange = this.state.pitchRange || { topIndex: 0, bottomIndex: totalRows - 1 };

    if (!range || totalRows === 0) {
      return;
    }

    const requestedTop = range.topIndex ?? oldRange.topIndex;
    const requestedBottom = range.bottomIndex ?? oldRange.bottomIndex;

    const newTopIndex = Math.max(0, Math.min(totalRows - 1, requestedTop));
    const newBottomIndex = Math.max(newTopIndex, Math.min(totalRows - 1, requestedBottom));

    if (oldRange.topIndex === newTopIndex && oldRange.bottomIndex === newBottomIndex) {
      // Debug log removed
      return;
    }

    const newFullRowData = masterRowData.slice(newTopIndex, newBottomIndex + 1);
    const maxRowIndex = newFullRowData.length - 1;
    let removedNotes = 0;
    let removedStamps = 0;
    let removedTriplets = 0;

    const combinedNotes: PlacedNote[] = [
      ...(this.state.placedNotes || []),
      ...(this.state.parkedNotes || [])
    ];
    const nextPlacedNotes: PlacedNote[] = [];
    const nextParkedNotes: PlacedNote[] = [];

    combinedNotes.forEach(note => {
      if (note.isDrum) {
        nextPlacedNotes.push(note);
        return;
      }

      const globalRow = typeof note.globalRow === 'number'
        ? note.globalRow
        : note.row + oldRange.topIndex;

      note.globalRow = globalRow;

      const relativeRow = globalRow - newTopIndex;
      const mappedRow = Math.max(0, Math.min(maxRowIndex, relativeRow));
      const outsideRange = globalRow < newTopIndex || globalRow > newBottomIndex;

      if (outsideRange && shouldTrim) {
        removedNotes += 1;
        return;
      }

      if (outsideRange) {
        nextParkedNotes.push(note);
        return;
      }

      note.row = mappedRow;
      nextPlacedNotes.push(note);
    });

    this.state.placedNotes = nextPlacedNotes;
    this.state.parkedNotes = nextParkedNotes;

    // Remap tonic sign groups
    if (this.state.tonicSignGroups) {
      const updatedGroups: Record<string, unknown[]> = {};
      Object.entries(this.state.tonicSignGroups).forEach(([uuid, group]) => {
        const adjustedGroup = group
          .map(sign => {
            if (typeof sign.row !== 'number') {return null;}
            const globalRow = sign.row + oldRange.topIndex;
            const mappedRow = Math.max(0, Math.min(maxRowIndex, globalRow - newTopIndex));
            const outsideRange = globalRow < newTopIndex || globalRow > newBottomIndex;
            if (outsideRange && shouldTrim) {
              return null;
            }
            return { ...sign, row: mappedRow };
          })
          .filter(Boolean);

        if (adjustedGroup.length > 0) {
          updatedGroups[uuid] = adjustedGroup;
        }
      });
      this.state.tonicSignGroups = updatedGroups as typeof this.state.tonicSignGroups;
    }

    // Remap stamp placements
    if (Array.isArray(this.state.stampPlacements)) {
      // Debug logs removed

      if (this.state.stampPlacements.length > 0) {
        const firstStamp = this.state.stampPlacements[0];
        // Debug log removed
      }

      this.state.stampPlacements = this.state.stampPlacements.filter((placement, index) => {
        // Use globalRow if available, otherwise calculate from current row
        const globalRow = typeof placement.globalRow === 'number'
          ? placement.globalRow
          : placement.row + oldRange.topIndex;

        // Store globalRow for future range changes
        placement.globalRow = globalRow;

        const relativeRow = globalRow - newTopIndex;
        const outsideRange = globalRow < newTopIndex || globalRow > newBottomIndex;

        if (index === 0) {
          // Debug logs removed
        }

        if (outsideRange && shouldTrim) {
          removedStamps += 1;
          return false;
        }

        // Use relativeRow directly - don't clamp if outside range
        // This allows stamps to render at their correct position or be off-screen
        placement.row = relativeRow;
        return true;
      });

      if (this.state.stampPlacements.length > 0) {
        const firstStamp = this.state.stampPlacements[0];
        // Debug log removed
      }
    }

    // Remap triplet placements
    if (Array.isArray(this.state.tripletPlacements)) {
      this.state.tripletPlacements = this.state.tripletPlacements.filter(placement => {
        // Use globalRow if available, otherwise calculate from current row
        const globalRow = typeof placement.globalRow === 'number'
          ? placement.globalRow
          : placement.row + oldRange.topIndex;

        // Store globalRow for future range changes
        placement.globalRow = globalRow;

        const relativeRow = globalRow - newTopIndex;
        const outsideRange = globalRow < newTopIndex || globalRow > newBottomIndex;

        if (outsideRange && shouldTrim) {
          removedTriplets += 1;
          return false;
        }

        // Use relativeRow directly - don't clamp if outside range
        // This allows triplets to render at their correct position or be off-screen
        placement.row = relativeRow;
        return true;
      });
    }

    // Adjust annotations
    if (Array.isArray(this.state.annotations) && this.state.annotations.length > 0) {
      const newRange = { topIndex: newTopIndex, bottomIndex: newBottomIndex };
      if (shouldTrim) {
        this.state.annotations = this.state.annotations.filter(annotation =>
          remapAnnotation(annotation, oldRange, newRange)
        );
      } else {
        this.state.annotations.forEach(annotation =>
          remapAnnotation(annotation, oldRange, newRange)
        );
      }
    }

    // Adjust print options
    if (this.state.printOptions) {
      const currentTop = this.state.printOptions.topRow ?? 0;
      const currentBottom = this.state.printOptions.bottomRow ?? maxRowIndex;
      const offset = oldRange.topIndex - newTopIndex;
      const adjustedTop = Math.max(0, Math.min(maxRowIndex, currentTop + offset));
      const adjustedBottom = Math.max(adjustedTop, Math.min(maxRowIndex, currentBottom + offset));
      this.state.printOptions = {
        ...this.state.printOptions,
        topRow: adjustedTop,
        bottomRow: adjustedBottom
      };
    }

    this.state.pitchRange = { topIndex: newTopIndex, bottomIndex: newBottomIndex };
    this.state.fullRowData = newFullRowData;

    let maintainStartRow = null;
    if (typeof options.maintainGlobalStart === 'number' && Number.isFinite(options.maintainGlobalStart)) {
      const candidate = Math.round(options.maintainGlobalStart - newTopIndex);
      maintainStartRow = Math.max(0, Math.min(maxRowIndex, candidate));
    }

    const metadata = {
      removedNotes,
      removedStamps,
      removedTriplets,
      maintainStartRow
    };

    this.emit('pitchRangeChanged', {
      topIndex: newTopIndex,
      bottomIndex: newBottomIndex,
      metadata
    });

    this.emit('layoutConfigChanged');
    this.emit('notesChanged');
    this.emit('stampPlacementsChanged');
    this.emit('tripletPlacementsChanged');
    this.emit('annotationsChanged');

    this.recordState();
  },

  setDeviceProfile(this: Store, profile: {
    isMobile?: boolean;
    isTouch?: boolean;
    isCoarsePointer?: boolean;
    orientation?: 'landscape' | 'portrait';
    width?: number;
    height?: number;
  } = {}): void {
    const previous = this.state.deviceProfile || {};
    const nextProfile = {
      isMobile: profile.isMobile ?? previous.isMobile ?? false,
      isTouch: profile.isTouch ?? previous.isTouch ?? false,
      isCoarsePointer: profile.isCoarsePointer ?? previous.isCoarsePointer ?? false,
      orientation: (profile.orientation ?? previous.orientation ?? 'landscape'),
      width: profile.width ?? previous.width ?? 0,
      height: profile.height ?? previous.height ?? 0
    };

    const hasChanged = (Object.keys(nextProfile) as (keyof typeof nextProfile)[]).some(
      key => nextProfile[key] !== previous[key]
    );

    this.state.deviceProfile = nextProfile;

    if (hasChanged) {
      this.emit('deviceProfileChanged', nextProfile);
    }
  }
};
