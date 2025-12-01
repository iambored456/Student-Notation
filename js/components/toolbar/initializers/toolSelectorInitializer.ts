// js/components/Toolbar/initializers/toolSelectorInitializer.ts
import store from '@state/index.ts';
import StampsToolbar from '@components/rhythm/stampsToolbar/stampsToolbar.ts';
import domCache from '@services/domCache.ts';
import notificationSystem from '@components/ui/notificationSystem.ts';
import clefRangeController from '@components/harmony/clefRangeController.ts';
import logger from '@utils/logger.ts';

type HarmonyChordShapes = Record<string, string[]>;
type IntervalShapes = Record<string, string[]>;

interface ToolChangedPayload {
  newTool?: string;
}

interface NoteChangedPayload {
  newNote?: { color?: string; shape?: 'circle' | 'oval' | 'diamond' };
}

interface _DegreeModeToggleElements {
  degreeVisibilityToggle: HTMLElement | null;
  degreeModeToggle: HTMLElement | null;
  flatBtn: HTMLElement | null;
  sharpBtn: HTMLElement | null;
  frequencyBtn: HTMLElement | null;
  focusColoursToggle: HTMLInputElement | null;
}

// UPDATED: New chord shapes with intervals for basic and advanced chords
const BASIC_CHORD_SHAPES: HarmonyChordShapes = {
  'X':       ['1P', '3M', '5P'],           // Major triad
  'x':       ['1P', '3m', '5P'],           // Minor triad
  'x°':      ['1P', '3m', '5d'],           // Diminished triad
  'X+':      ['1P', '3M', '5A'],           // Augmented triad
  'X⁷':      ['1P', '3M', '5P', '7m'],     // Dominant 7
  'x⁷':      ['1P', '3m', '5P', '7m'],     // Minor 7
  'Xmaj⁷':   ['1P', '3M', '5P', '7M'],     // Major 7
  'ø⁷':      ['1P', '3m', '5d', '7m'],     // Half-diminished 7
  'x°⁷':     ['1P', '3m', '5d', '6M'],     // Fully diminished 7
  'X⁶':      ['1P', '3M', '5P', '6M'],     // Major 6 (add 6)
  'Xsus2':   ['1P', '2M', '5P'],           // Suspended 2
  'Xsus4':   ['1P', '4P', '5P']            // Suspended 4
};

const ADVANCED_CHORD_SHAPES: HarmonyChordShapes = {
  'xmaj⁷':     ['1P', '3m', '5P', '7M'],           // Minor-major 7
  'Xadd9':     ['1P', '3M', '5P', '9M'],           // Major add 9 (9th up an octave)
  'xadd9':     ['1P', '3m', '5P', '9M'],           // Minor add 9 (9th up an octave)
  'X6/9':      ['1P', '3M', '5P', '6M', '9M'],     // Major 6/9 (9th up an octave)
  'X9':        ['1P', '3M', '5P', '7m', '9M'],     // Dominant 9 (9th up an octave)
  'X11':       ['1P', '3M', '5P', '7m', '9M', '11P'], // Dominant 11 (9th and 11th up an octave)
  'X13':       ['1P', '3M', '5P', '7m', '9M', '13M'], // Dominant 13 (9th and 13th up an octave)
  'Xmaj9':     ['1P', '3M', '5P', '7M', '9M'],     // Major 9 (9th up an octave)
  'x⁹':        ['1P', '3m', '5P', '7m', '9M'],     // Minor 9 (9th up an octave)
  'x⁶':        ['1P', '3m', '5P', '6M'],           // Minor 6
  'x¹¹':       ['1P', '3m', '5P', '7m', '9M', '11P'], // Minor 11 (9th and 11th up an octave)
  'Xmaj7♯11':  ['1P', '3M', '5P', '7M', '11A']    // Major 7 sharp 11 (augmented 11th up an octave)
};

// Legacy CHORD_SHAPES for backward compatibility - now combines both basic and advanced
const CHORD_SHAPES: HarmonyChordShapes = { ...BASIC_CHORD_SHAPES, ...ADVANCED_CHORD_SHAPES };

// Define interval mappings for each button in the 4x4 grid
const INTERVAL_SHAPES: IntervalShapes = {
  'M6':  ['6M'],       // Major 6th
  'A6':  ['6A'],       // Augmented 6th
  'm7':  ['7m'],       // Minor 7th
  'M7':  ['7M'],       // Major 7th
  'd5':  ['5d'],       // Diminished 5th (Tritone)
  'P5':  ['5P'],       // Perfect 5th
  'A5':  ['5A'],       // Augmented 5th
  'm6':  ['6m'],       // Minor 6th
  'm3':  ['3m'],       // Minor 3rd
  'M3':  ['3M'],       // Major 3rd
  'P4':  ['4P'],       // Perfect 4th
  'A4':  ['4A'],       // Augmented 4th (Tritone)
  'U':   ['1P'],       // Unison (Perfect 1st)
  'm2':  ['2m'],       // Minor 2nd
  'M2':  ['2M'],       // Major 2nd
  'A2':  ['2A']        // Augmented 2nd
};

/**
 * Octave equivalence mapping: Maps extended intervals to their simple equivalents
 * 9th → 2nd, 11th → 4th, 13th → 6th
 */
const OCTAVE_EQUIVALENCE: Record<string, string> = {
  '9m': '2m',   // Minor 9th → Minor 2nd
  '9M': '2M',   // Major 9th → Major 2nd
  '9A': '2A',   // Augmented 9th → Augmented 2nd
  '11P': '4P',  // Perfect 11th → Perfect 4th
  '11A': '4A',  // Augmented 11th → Augmented 4th
  '13m': '6m',  // Minor 13th → Minor 6th
  '13M': '6M',  // Major 13th → Major 6th
  '13A': '6A'   // Augmented 13th → Augmented 6th
};

const SIXTEENTH_FULL_STAMP_ID = 15;

/**
 * Normalizes an interval to its octave-simple form
 * @param {string} interval - Interval like "9M", "11P", "3M"
 * @returns {string} - Normalized interval like "2M", "4P", "3M"
 */
function normalizeInterval(interval: string): string {
  return OCTAVE_EQUIVALENCE[interval] ?? interval;
}

/**
 * Checks if there are any tonic shapes placed on the canvas
 * @returns {boolean} True if there are tonic shapes, false otherwise
 */
function hasTonicShapesOnCanvas(): boolean {
  return Object.keys(store.state.tonicSignGroups).length > 0;
}

/**
 * Updates the disabled state of the Scale/Mode toggle based on degree display mode
 */
function updateScaleModeToggleState(): void {
  const degreeModeToggle = document.getElementById('degree-mode-toggle');
  if (degreeModeToggle) {
    const isDegreesOff = store.state.degreeDisplayMode === 'off';
    degreeModeToggle.classList.toggle('disabled', isDegreesOff);
  }
}

/**
 * Updates the visual selection of the harmony preset buttons based on the current state.
 * Full match = 'selected', partial match = 'partial-match' (lighter highlighting)
 * Always shows partial matches regardless of selected tool for educational feedback
 */
function updateChordButtonSelection(): void {
  // Get the merged chords panel (use .chords-grid to avoid selecting intervals grid)
  const chordsPanel = document.querySelector<HTMLElement>('#chords-panel .chords-grid');

  // Clear selection from all chord buttons
  if (chordsPanel) {
    chordsPanel.querySelectorAll<HTMLButtonElement>('.harmony-preset-button').forEach(el => {
      el.classList.remove('selected', 'partial-match');
    });
  }

  // Find matching buttons based on active chord intervals (regardless of selected tool)
  if (store.state.activeChordIntervals && chordsPanel) {
    const currentIntervals = store.state.activeChordIntervals;
    const currentIntervalsString = currentIntervals.toString();

    // Normalize current intervals for octave equivalence
    const normalizedCurrentIntervals = currentIntervals.map(normalizeInterval);

    // Search through all chord buttons
    const buttons = chordsPanel.querySelectorAll<HTMLButtonElement>('.harmony-preset-button');
    for (const button of buttons) {
      const label = button.textContent?.trim() ?? '';
      const buttonIntervals = CHORD_SHAPES[label];
      if (!buttonIntervals) {continue;}

      const buttonIntervalsString = buttonIntervals.toString();
      const normalizedButtonIntervals = buttonIntervals.map(normalizeInterval);

      // Check for exact match
      if (buttonIntervalsString === currentIntervalsString) {
        button.classList.add('selected');
        continue;
      }

      // Check for partial match (all current intervals are in button's chord)
      const isPartialMatch = normalizedCurrentIntervals.every(interval =>
        normalizedButtonIntervals.includes(interval)
      );

      if (isPartialMatch) {
        button.classList.add('partial-match');
      }
    }
  }
}

/**
 * Updates the visual selection of interval buttons based on current active intervals.
 * Handles octave equivalence: 9th→2nd, 11th→4th, 13th→6th
 */
function updateIntervalButtonSelection(): void {
  const intervalsPanel = document.querySelector<HTMLElement>('#chords-panel .intervals-4x4-grid');
  if (!intervalsPanel) {return;}

  // Clear selection from all interval buttons
  intervalsPanel.querySelectorAll<HTMLButtonElement>('.harmony-preset-button').forEach(el => el.classList.remove('selected'));

  // If we have active chord intervals, highlight matching buttons (regardless of selected tool)
  if (store.state.activeChordIntervals) {
    const activeIntervals = store.state.activeChordIntervals;

    // Normalize active intervals to handle octave equivalence
    const normalizedActiveIntervals = activeIntervals.map(normalizeInterval);

    intervalsPanel.querySelectorAll<HTMLButtonElement>('.harmony-preset-button').forEach(button => {
      const intervalLabel = button.textContent?.trim() ?? '';
      const buttonInterval = INTERVAL_SHAPES[intervalLabel];
      // Check if this interval button matches any of the normalized active chord intervals
      if (buttonInterval && normalizedActiveIntervals.includes(buttonInterval[0])) {
        button.classList.add('selected');
      }
    });
  }
}


// Color helper functions for creating lighter/darker variants
const lightenColor = (hex: string, percent = 50): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lightenedR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
  const lightenedG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
  const lightenedB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

  return `#${lightenedR.toString(16).padStart(2, '0')}${lightenedG.toString(16).padStart(2, '0')}${lightenedB.toString(16).padStart(2, '0')}`;
};

const hexToRgba = (hex: string, alpha = 1): string => {
  const normalizedHex = hex.startsWith('#') ? hex.slice(1) : hex;
  if (normalizedHex.length !== 6) {return hex;}
  const r = parseInt(normalizedHex.slice(0, 2), 16);
  const g = parseInt(normalizedHex.slice(2, 4), 16);
  const b = parseInt(normalizedHex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const applyHarmonyAccentColors = (container: HTMLElement | null, color: string): void => {
  if (!container) {return;}
  const lightColor = lightenColor(color, 50);
  const extraLightColor = lightenColor(lightColor, 60);
  container.style.setProperty('--c-accent', color);
  container.style.setProperty('--c-accent-light', extraLightColor);
  container.style.setProperty('--harmony-partial-bg', hexToRgba(extraLightColor, 0.25));
  container.style.setProperty('--harmony-partial-border', hexToRgba(color, 0.4));
  container.style.setProperty('--harmony-partial-bg-hover', hexToRgba(extraLightColor, 0.4));
  container.style.setProperty('--harmony-partial-border-hover', hexToRgba(color, 0.6));
};

export function initToolSelectors() {
  const cachedElements = domCache.getMultiple(
    'noteBankContainer',
    'eraserButton',
    'degreeVisibilityToggle',
    'degreeModeToggle',
    'flatBtn',
    'sharpBtn',
    'frequencyBtn',
    'focusColoursToggle'
  );

  const noteBankContainer = cachedElements['noteBankContainer'];
  const eraserBtn = cachedElements['eraserButton'];
  const degreeVisibilityToggle = cachedElements['degreeVisibilityToggle'];
  const degreeModeToggle = cachedElements['degreeModeToggle'];
  const flatBtn = cachedElements['flatBtn'];
  const sharpBtn = cachedElements['sharpBtn'];
  const frequencyBtn = cachedElements['frequencyBtn'];
  const focusColoursToggle = cachedElements['focusColoursToggle'] as HTMLInputElement | null;

  // Get harmony container directly since it uses a class, not an ID
  const harmonyContainer = document.querySelector<HTMLElement>('.pitch-tabs-container');

  // Get inversion toggle element
  const inversionToggle = document.getElementById('inversion-toggle');

  // Get chord position toggle element (single 6-state toggle)
  const chordPositionToggle6 = document.getElementById('chord-position-toggle-6');

  // Initialize clef range controls when the elements are available
  clefRangeController.init();

  const openSixteenthStampTab = (): void => {
    const rhythmTabButton = document.querySelector<HTMLButtonElement>('[data-tab="rhythm"]');
    if (rhythmTabButton && !rhythmTabButton.classList.contains('active')) {
      rhythmTabButton.click();
    }

    const sixteenthTabButton = document.querySelector<HTMLButtonElement>('[data-rhythm-tab="stamps"]');
    if (sixteenthTabButton && !sixteenthTabButton.classList.contains('active')) {
      sixteenthTabButton.click();
    }
  };

  // --- Tool Click Listeners ---
  if (noteBankContainer) {
    noteBankContainer.querySelectorAll<HTMLElement>('.note').forEach(note => {
      note.addEventListener('click', () => {
        const noteType = note.dataset['type'] as 'circle' | 'oval' | 'diamond' | undefined;
        const notePair = note.closest<HTMLElement>('.note-pair');
        const color = notePair?.dataset['color'];
        if (!noteType || !color) {return;}

        if (noteType === 'diamond') {
          store.setSelectedNote('diamond', color);

          const activeStampButton = document.querySelector<HTMLButtonElement>('.stamp-button.active');
          const activeStampId = activeStampButton
            ? parseInt(activeStampButton.dataset['stampId'] ?? '', 10)
            : NaN;
          const isDifferentStampActive = store.state.selectedTool === 'stamp'
            && activeStampButton
            && !Number.isNaN(activeStampId)
            && activeStampId !== SIXTEENTH_FULL_STAMP_ID;

          if (isDifferentStampActive) {return;}

          openSixteenthStampTab();
          StampsToolbar.selectStamp(SIXTEENTH_FULL_STAMP_ID);
          return;
        }

        store.setSelectedNote(noteType, color);
        store.setSelectedTool('note');
      });
    });
  }

  if (eraserBtn) {
    eraserBtn.addEventListener('click', () => store.setSelectedTool('eraser'));
  }

  // Get tonic mode buttons from the new grid structure
  const tonicModeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.tonic-mode-button'));

  const updateTonicModeButtons = (activeNumber: string | number | null | undefined = store.state.selectedToolTonicNumber) => {
    if (!tonicModeButtons.length) {return;}
    const fallbackNumber = tonicModeButtons[0] ? parseInt(tonicModeButtons[0].dataset['tonic'] ?? '1', 10) : 1;
    const parsedCandidate = typeof activeNumber === 'number' ? activeNumber : parseInt(String(activeNumber ?? ''), 10);
    const parsedActive = Number.isNaN(parsedCandidate) ? fallbackNumber : parsedCandidate;
    tonicModeButtons.forEach(button => {
      const tonicValue = button.dataset['tonic'];
      const buttonNumber = tonicValue ? parseInt(tonicValue, 10) : NaN;
      const isActive = buttonNumber === parsedActive;
      button.classList.toggle('selected', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  };

  if (tonicModeButtons.length) {
    tonicModeButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tonicNumber = button.getAttribute('data-tonic');
        if (!tonicNumber) {return;}
        const parsed = parseInt(tonicNumber, 10);
        store.setSelectedTool('tonicization', parsed);
        updateTonicModeButtons(parsed);
      });
    });
    updateTonicModeButtons();
  }

  // Attach chord shape handlers to buttons in the merged chords panel
  // NOTE: Use specific selector to avoid selecting interval grid
  const chordsPanel = document.querySelector<HTMLElement>('#chords-panel .chords-grid');

  // Helper function to add chord button event listeners
  function addChordButtonListeners(panel: Element | null, chordShapes: HarmonyChordShapes, panelName: string): void {
    if (!panel) {return;}

    panel.querySelectorAll<HTMLButtonElement>('.harmony-preset-button').forEach(button => {
      button.addEventListener('click', () => {
        const label = button.textContent?.trim() ?? '';
        const intervals = chordShapes[label];
        if (intervals && intervals.length > 0) {
          store.setActiveChordIntervals(intervals);
          store.setSelectedTool('chord');
          // No need for setTimeout - state event handler will update toggle
        } else {
          logger.error('ToolSelector', `Failed to retrieve valid intervals for ${panelName} chord: "${label}"`, null, 'toolbar');
        }
        button.blur(); // Remove focus to prevent lingering highlight
      });

      // Add double-click functionality to disable chord shapes
      button.addEventListener('dblclick', () => {
        // Only handle double-click if this button is currently selected
        if (button.classList.contains('selected')) {
          // Return to note tool to use the most recent shape note
          store.setSelectedTool('note');
        }
        button.blur(); // Remove focus to prevent lingering highlight
      });
    });
  }

  // Add event listeners to the merged chords panel
  addChordButtonListeners(chordsPanel, CHORD_SHAPES, 'chords');

  // Add chord tab switching logic
  const pitchTabButtons = document.querySelectorAll<HTMLButtonElement>('.pitch-tab-button');
  const pitchTabPanels = document.querySelectorAll<HTMLElement>('.pitch-tab-panel');

  if (pitchTabButtons.length > 0) {
    pitchTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset['pitchTab'];
        if (!targetTab) {return;}
        const ensuredTargetTab = targetTab;

        // Update active tab button
        pitchTabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update active tab panel
        pitchTabPanels.forEach(panel => panel.classList.remove('active'));
        const targetPanel = document.getElementById(`${ensuredTargetTab}-panel`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }

        // Save the selected pitch sub-tab to localStorage
        localStorage.setItem('selectedPitchTab', ensuredTargetTab);

        // Update toggle state when switching to chords tab
        if (targetTab === 'chords') {
          updateChordPositionToggleState();
        }

        // Refresh clef wheel visuals when switching to range tab
        if (targetTab === 'range') {
          // Use setTimeout to ensure the tab is visible before updating visuals
          setTimeout(() => {
            clefRangeController.refreshWheelVisuals();
          }, 0);
        }
      });
    });

    // Restore saved pitch sub-tab on page load
    const savedPitchTab = localStorage.getItem('selectedPitchTab') || 'chords';
    const pitchTabButton = document.querySelector<HTMLButtonElement>(`[data-pitch-tab="${savedPitchTab}"]`);
    const pitchTabPanel = document.getElementById(`${savedPitchTab}-panel`);
    if (pitchTabButton && pitchTabPanel) {
      pitchTabButtons.forEach(btn => btn.classList.remove('active'));
      pitchTabPanels.forEach(panel => panel.classList.remove('active'));
      pitchTabButton.classList.add('active');
      pitchTabPanel.classList.add('active');
    }
  }

  // Add rhythm tab switching logic
  const rhythmTabButtons = document.querySelectorAll<HTMLButtonElement>('.rhythm-tab-button');
  const rhythmTabPanels = document.querySelectorAll<HTMLElement>('.rhythm-tab-panel');

  if (rhythmTabButtons.length > 0) {
    rhythmTabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetTab = button.dataset['rhythmTab'];
        if (!targetTab) {return;}
        const ensuredTargetTab = targetTab;

        // Update active tab button
        rhythmTabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        // Update active tab panel
        rhythmTabPanels.forEach(panel => panel.classList.remove('active'));
        const targetPanel = document.getElementById(`${ensuredTargetTab}-panel`);
        if (targetPanel) {
          targetPanel.classList.add('active');
        }

        // Save the selected rhythm sub-tab to localStorage
        localStorage.setItem('selectedRhythmTab', ensuredTargetTab);
      });
    });

    // Restore saved rhythm sub-tab on page load
    const savedRhythmTab = localStorage.getItem('selectedRhythmTab') || 'controls';
    const rhythmTabButton = document.querySelector<HTMLButtonElement>(`[data-rhythm-tab="${savedRhythmTab}"]`);
    const rhythmTabPanel = document.getElementById(`${savedRhythmTab}-panel`);
    if (rhythmTabButton && rhythmTabPanel) {
      rhythmTabButtons.forEach(btn => btn.classList.remove('active'));
      rhythmTabPanels.forEach(panel => panel.classList.remove('active'));
      rhythmTabButton.classList.add('active');
      rhythmTabPanel.classList.add('active');
    }
  }

  // Add inversion toggle handler
  if (inversionToggle) {
    inversionToggle.addEventListener('click', () => {
      const newInversionState = !store.state.isIntervalsInverted;
      store.setIntervalsInversion(newInversionState);
      inversionToggle.blur(); // Remove focus to prevent lingering highlight
    });

    const updateInversionToggle = (isInverted: boolean): void => {
      inversionToggle.classList.toggle('active', isInverted);
    };

    store.on('intervalsInversionChanged', (isInverted: boolean) => {
      updateInversionToggle(isInverted);
    });

    updateInversionToggle(store.state.isIntervalsInverted);
  }

  // Add unified 6-state chord position toggle handler
  if (chordPositionToggle6) {
    chordPositionToggle6.addEventListener('click', () => {
      const currentState = store.state.chordPositionState;
      const maxStates = getMaxPositionStates();
      const nextState = (currentState + 1) % maxStates;
      store.setChordPosition(nextState);
      chordPositionToggle6.blur();
    });

    // Initialize 6-state toggle state updater
    const updateChordPositionToggle6 = (positionState: number): void => {
      // Remove all state classes
      chordPositionToggle6.classList.remove('state-1', 'state-2', 'state-3', 'state-4', 'state-5');

      // Add appropriate state class
      if (positionState === 1) {
        chordPositionToggle6.classList.add('state-1');
      } else if (positionState === 2) {
        chordPositionToggle6.classList.add('state-2');
      } else if (positionState === 3) {
        chordPositionToggle6.classList.add('state-3');
      } else if (positionState === 4) {
        chordPositionToggle6.classList.add('state-4');
      } else if (positionState === 5) {
        chordPositionToggle6.classList.add('state-5');
      }
      // positionState === 0 has no additional class (default gray)
    };

    // Listen for state changes to update visual state
    store.on('chordPositionChanged', (newState: number) => {
      updateChordPositionToggle6(newState);
    });

    // Set initial state
    updateChordPositionToggle6(store.state.chordPositionState);
  }

  // Helper function to get max position states based on chord note count
  function getMaxPositionStates(): number {
    // Use state instead of DOM to get accurate interval count immediately
    const intervals = store.state.activeChordIntervals;
    if (!intervals || intervals.length === 0) {return 3;}
    return intervals.length;
  }

  // Function to determine chord note count from current state
  function getChordNoteCount(): number {
    // Use state instead of DOM to get accurate interval count immediately
    const intervals = store.state.activeChordIntervals;
    if (!intervals || intervals.length === 0) {return 3;}
    return intervals.length;
  }

  // Function to update 6-state toggle grayed-out states based on chord note count
  function updateChordPositionToggleState(): void {
    if (!chordPositionToggle6) {return;}

    const noteCount = getChordNoteCount();

    // Remove all disabled state classes
    for (let i = 0; i <= 5; i++) {
      chordPositionToggle6.classList.remove(`disabled-state-${i}`);
    }

    // Gray out states that aren't applicable
    // States 0-2 (Root, 1st, 2nd) are always available for all chords
    // State 3 (3rd) is disabled for triads (3-note chords)
    // State 4 (4th) is disabled for chords with <= 4 notes
    // State 5 (5th) is disabled for chords with <= 5 notes

    if (noteCount < 4) {
      // Triads: disable states 3, 4, 5
      chordPositionToggle6.classList.add('disabled-state-3', 'disabled-state-4', 'disabled-state-5');
    } else if (noteCount === 4) {
      // 4-note chords: disable states 4, 5
      chordPositionToggle6.classList.add('disabled-state-4', 'disabled-state-5');
    } else if (noteCount === 5) {
      // 5-note chords: disable state 5
      chordPositionToggle6.classList.add('disabled-state-5');
    }
    // 6+ note chords: all states enabled

    // Reset chord position to valid range if current position exceeds max
    const maxPosition = noteCount - 1;
    if (store.state.chordPositionState > maxPosition) {
      store.setChordPosition(0);
    }
  }

  // Add interval button handlers for the intervals grid in chords panel
  const intervalsPanel = document.querySelector<HTMLElement>('#chords-panel .intervals-4x4-grid');
  if (intervalsPanel) {
    intervalsPanel.querySelectorAll<HTMLButtonElement>('.harmony-preset-button').forEach(button => {
      button.addEventListener('click', () => {
        const intervalLabel = button.textContent?.trim() ?? '';
        const intervalData = INTERVAL_SHAPES[intervalLabel];

        if (intervalData && intervalData.length > 0) {
          const clickedInterval = intervalData[0];

          // Get current active intervals (or start fresh)
          let currentIntervals = store.state.selectedTool === 'chord' && store.state.activeChordIntervals
            ? [...store.state.activeChordIntervals]  // Clone the array
            : ['1P'];  // Start with root only

          // Toggle logic: Add or remove the interval
          if (currentIntervals.includes(clickedInterval)) {
            // Remove interval (but always keep root)
            if (clickedInterval !== '1P') {
              currentIntervals = currentIntervals.filter(i => i !== clickedInterval);
            }
          } else {
            // Add interval
            currentIntervals.push(clickedInterval);
          }

          // Ensure root is always present
          if (!currentIntervals.includes('1P')) {
            currentIntervals.unshift('1P');
          }

          // Sort intervals by their position in chromatic scale for consistent ordering
          const intervalOrder = ['1P', '2m', '2M', '2A', '3m', '3M', '4P', '4A', '5d', '5P', '5A', '6m', '6M', '6A', '7m', '7M', '9M', '11P', '11A', '13M'];
          currentIntervals.sort((a, b) => {
            const indexA = intervalOrder.indexOf(a);
            const indexB = intervalOrder.indexOf(b);
            return indexA - indexB;
          });

          // Update state with new interval set
          store.setActiveChordIntervals(currentIntervals);
          store.setSelectedTool('chord');

          logger.debug('ToolSelector', `Interval ${intervalLabel} toggled`, currentIntervals, 'toolbar');
        } else {
          logger.error('ToolSelector', `Failed to retrieve valid interval for symbol: "${intervalLabel}"`, null, 'toolbar');
          logger.error('ToolSelector', 'Available interval shapes', Object.keys(INTERVAL_SHAPES), 'toolbar');
        }
        button.blur(); // Remove focus to prevent lingering highlight
      });

      // Add double-click functionality to clear all intervals (reset to root only)
      button.addEventListener('dblclick', () => {
        // Reset to just root
        store.setActiveChordIntervals(['1P']);
        store.setSelectedTool('chord');
        button.blur();
      });
    });
  }

  // Degree Visibility Toggle (Show/Hide)
  if (degreeVisibilityToggle) {
    degreeVisibilityToggle.addEventListener('click', () => {
      const currentMode = store.state.degreeDisplayMode;
      const isCurrentlyOff = currentMode === 'off';

      if (isCurrentlyOff) {
        // Check if there are tonic shapes on canvas before turning on
        if (!hasTonicShapesOnCanvas()) {
          notificationSystem.alert(
            'Please place a tonal center on the canvas before showing degrees.',
            'Tonal Center Required'
          );
          return;
        }

        // If degrees are off, turn them on with the last used mode (default to diatonic)
        const lastMode: 'modal' | 'diatonic' = degreeModeToggle?.classList.contains('active') ? 'modal' : 'diatonic';
        store.setDegreeDisplayMode(lastMode);
      } else {
        // If degrees are on, turn them off
        store.setDegreeDisplayMode('off');
      }
      degreeVisibilityToggle.blur();
    });
  }

  // Degree Mode Toggle (Scale/Mode) - Two-state toggle switch
  if (degreeModeToggle) {
    degreeModeToggle.addEventListener('click', () => {

      // Do nothing if toggle is disabled (degrees are off)
      if (degreeModeToggle.classList.contains('disabled')) {
        return;
      }

      // Toggle the visual state of the switch
      degreeModeToggle.classList.toggle('active');

      const isActive = degreeModeToggle.classList.contains('active');
      const newMode = isActive ? 'modal' : 'diatonic';


      store.setDegreeDisplayMode(newMode);
      degreeModeToggle.blur();

    });
  }
  if (flatBtn) {flatBtn.addEventListener('click', () => {
    // Toggling flat/sharp automatically turns off Hz mode
    if (store.state.showFrequencyLabels) {
      store.toggleFrequencyLabels();
    }
    store.toggleAccidentalMode('flat');
    flatBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}
  if (sharpBtn) {sharpBtn.addEventListener('click', () => {
    // Toggling flat/sharp automatically turns off Hz mode
    if (store.state.showFrequencyLabels) {
      store.toggleFrequencyLabels();
    }
    store.toggleAccidentalMode('sharp');
    sharpBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}
  if (frequencyBtn) {frequencyBtn.addEventListener('click', () => {
    // Hz button toggles independently, doesn't affect flat/sharp states
    store.toggleFrequencyLabels();
    frequencyBtn.blur(); // Remove focus to prevent lingering blue highlight
  });}

  const setAccidentalButtonsLocked = (locked: boolean): void => {
    [flatBtn, sharpBtn].forEach(btn => {
      if (!btn) {return;}
      btn.classList.toggle('accidental-btn--disabled', locked);
      btn.setAttribute('aria-disabled', locked ? 'true' : 'false');
    });
  };

  const syncFrequencyUiState = (showFrequencyLabels: boolean): void => {
    if (frequencyBtn) {
      frequencyBtn.classList.toggle('active', showFrequencyLabels);
      frequencyBtn.setAttribute('aria-pressed', showFrequencyLabels ? 'true' : 'false');
    }
    setAccidentalButtonsLocked(showFrequencyLabels);
  };
  if (focusColoursToggle) {focusColoursToggle.addEventListener('change', () => {
    // If turning on Focus Colours, check for tonic shapes
    if (!store.state.focusColours && !hasTonicShapesOnCanvas()) {
      notificationSystem.alert(
        'Please place a tonal center on the canvas before enabling focus colours.',
        'Tonal Center Required'
      );
      // Reset the checkbox since we're not proceeding
      focusColoursToggle.checked = false;
      return;
    }
    store.toggleFocusColours();
  });}

  // --- UI State Change Listeners (Visual Feedback) ---
  store.on('toolChanged', ({ newTool }: ToolChangedPayload = {}) => {
    // Handle tool-specific UI (but NOT data-driven visual state)
    eraserBtn?.classList.remove('selected');
    if (harmonyContainer) {harmonyContainer.classList.remove('active-tool');}

    if (newTool === 'eraser') {
      eraserBtn?.classList.add('selected');
    } else if (newTool === 'tonicization') {
      // Tonic buttons remain highlighted via updateTonicModeButtons
    } else if (newTool === 'chord') {
      harmonyContainer?.classList.add('active-tool');
      // Interval/chord visual state is handled by data listeners, not tool listeners
      // This ensures visual feedback persists regardless of active tool
    } else if (newTool === 'note') {
      // Re-select the current note when switching to note tool
      const currentNote = store.state.selectedNote;
      if (currentNote) {
        const targetPair = document.querySelector(`.note-pair[data-color='${currentNote.color}']`);
        targetPair?.classList.add('selected');
        targetPair?.querySelector(`.note[data-type='${currentNote.shape}']`)?.classList.add('selected');
      }
    }

    updateTonicModeButtons();
  });

  store.on('activeChordIntervalsChanged', () => {
    // Always update visual feedback when chord intervals change
    // This provides continuous educational feedback regardless of active tool
    updateChordButtonSelection();
    updateIntervalButtonSelection();
    updateChordPositionToggleState(); // Update position toggle based on new chord
  });

  store.on('noteChanged', ({ newNote }: NoteChangedPayload = {}) => {
    if (!newNote?.color || !newNote.shape) {return;}
    const { color, shape } = newNote;
    document.querySelectorAll('.note, .note-pair').forEach(el => el.classList.remove('selected'));
    const targetPair = document.querySelector<HTMLElement>(`.note-pair[data-color='${color}']`);
    targetPair?.classList.add('selected');
    targetPair?.querySelector<HTMLElement>(`.note[data-type='${shape}']`)?.classList.add('selected');

    // Set accent color and lighter variant for chord button styling
    applyHarmonyAccentColors(harmonyContainer, color);
    const tabSidebar = document.querySelector<HTMLElement>('.tab-sidebar');
    if (tabSidebar) {
      tabSidebar.style.setProperty('--c-accent', color);
    }
  });

  store.on('degreeDisplayModeChanged', (mode: 'off' | 'diatonic' | 'modal') => {
    // Update visibility toggle switch state (Show/Hide)
    if (degreeVisibilityToggle) {
      // Set toggle switch position based on mode: false = Show (left), true = Hide (right)
      // When mode is 'off', toggle should show "Show" (inactive state, slider on left)
      // When mode is not 'off', toggle should show "Hide" (active state, slider on right)
      degreeVisibilityToggle.classList.toggle('active', mode !== 'off');
    }

    // Update mode toggle switch state - just handle the visual toggle state
    if (degreeModeToggle) {
      // Set toggle switch position based on mode: false = Scale (left), true = Mode (right)
      degreeModeToggle.classList.toggle('active', mode === 'modal');
    }

    // Update the disabled state of the Scale/Mode toggle
    updateScaleModeToggleState();
  });

  store.on('accidentalModeChanged', (accidentalMode: { sharp: boolean; flat: boolean }) => {
    const { sharp, flat } = accidentalMode;
    sharpBtn?.classList.toggle('active', sharp);
    flatBtn?.classList.toggle('active', flat);
  });

  store.on('frequencyLabelsChanged', (showFrequencyLabels: boolean) => {
    syncFrequencyUiState(showFrequencyLabels);
  });
  syncFrequencyUiState(store.state.showFrequencyLabels);

  // Initialize accent colors on startup
  if (harmonyContainer && store.state.selectedNote) {
    const color = store.state.selectedNote.color;
    applyHarmonyAccentColors(harmonyContainer, color);
  }
  const tabSidebar = document.querySelector('.tab-sidebar');
  if (tabSidebar && store.state.selectedNote) {
    tabSidebar.style.setProperty('--c-accent', store.state.selectedNote.color);
  }

  // Initialize toggle state on startup
  setTimeout(() => updateChordPositionToggleState(), 50);

  // Initialize Scale/Mode toggle state on startup
  updateScaleModeToggleState();

  // Initialize degree display toggle states from saved state
  const currentMode = store.state.degreeDisplayMode;
  if (degreeVisibilityToggle) {
    degreeVisibilityToggle.classList.toggle('active', currentMode !== 'off');
  }
  if (degreeModeToggle) {
    degreeModeToggle.classList.toggle('active', currentMode === 'modal');
    degreeModeToggle.classList.toggle('disabled', currentMode === 'off');
  }

  // Initialize interval and chord button selection on startup
  // This ensures the U button is highlighted with initial state of ["1P"]
  // Run regardless of selected tool so intervals show initial state
  updateChordButtonSelection();
  updateIntervalButtonSelection();
  updateChordPositionToggleState();
}

function initToolbar() {}

export { initToolbar };
export default { initToolbar };
