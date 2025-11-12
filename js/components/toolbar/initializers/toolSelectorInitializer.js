// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '@state/index.js';
import { Chord, ChordType } from 'tonal';
import domCache from '@services/domCache.js';
import notificationSystem from '@components/ui/notificationSystem.js';
import clefRangeController from '@components/harmony/clefRangeController.js';
import logger from '@utils/logger.js';

// UPDATED: New chord shapes with intervals for basic and advanced chords
const BASIC_CHORD_SHAPES = {
    'X':       ["1P", "3M", "5P"],           // Major triad
    'x':       ["1P", "3m", "5P"],           // Minor triad  
    'x°':      ["1P", "3m", "5d"],           // Diminished triad
    'X+':      ["1P", "3M", "6m"],           // Augmented triad
    'X7':      ["1P", "3M", "5P", "7m"],     // Dominant 7
    'x⁷':      ["1P", "3m", "5P", "7m"],     // Minor 7
    'Xmaj⁷':   ["1P", "3M", "5P", "7M"],     // Major 7
    'ø⁷':      ["1P", "3m", "5d", "7m"],     // Half-diminished 7
    'x°⁷':     ["1P", "3m", "5d", "6M"],     // Fully diminished 7
    'X⁶':      ["1P", "3M", "5P", "6M"],     // Major 6 (add 6)
    'Xsus2':   ["1P", "2M", "5P"],           // Suspended 2
    'Xsus4':   ["1P", "4P", "5P"]            // Suspended 4
};

const ADVANCED_CHORD_SHAPES = {
    'xmaj⁷':     ["1P", "3m", "5P", "7M"],           // Minor-major 7
    'Xadd9':     ["1P", "3M", "5P", "9M"],           // Major add 9 (9th up an octave)
    'xadd9':     ["1P", "3m", "5P", "9M"],           // Minor add 9 (9th up an octave)
    'X6/9':      ["1P", "3M", "5P", "6M", "9M"],     // Major 6/9 (9th up an octave)
    'X9':        ["1P", "3M", "5P", "7m", "9M"],     // Dominant 9 (9th up an octave)
    'X11':       ["1P", "3M", "5P", "7m", "9M", "11P"], // Dominant 11 (9th and 11th up an octave)
    'X13':       ["1P", "3M", "5P", "7m", "9M", "13M"], // Dominant 13 (9th and 13th up an octave)
    'Xmaj9':     ["1P", "3M", "5P", "7M", "9M"],     // Major 9 (9th up an octave)
    'x⁹':        ["1P", "3m", "5P", "7m", "9M"],     // Minor 9 (9th up an octave)
    'x⁶':        ["1P", "3m", "5P", "6M"],           // Minor 6
    'x¹¹':       ["1P", "3m", "5P", "7m", "9M", "11P"], // Minor 11 (9th and 11th up an octave)
    'Xmaj7♯11':  ["1P", "3M", "5P", "7M", "11A"]    // Major 7 sharp 11 (augmented 11th up an octave)
};

// Legacy CHORD_SHAPES for backward compatibility - now combines both basic and advanced
const CHORD_SHAPES = { ...BASIC_CHORD_SHAPES, ...ADVANCED_CHORD_SHAPES };

// Define interval mappings for each button in the 4x4 grid
const INTERVAL_SHAPES = {
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
 * Checks if there are any tonic shapes placed on the canvas
 * @returns {boolean} True if there are tonic shapes, false otherwise
 */
function hasTonicShapesOnCanvas() {
    return Object.keys(store.state.tonicSignGroups).length > 0;
}

/**
 * Updates the disabled state of the Scale/Mode toggle based on degree display mode
 */
function updateScaleModeToggleState() {
    const degreeModeToggle = document.getElementById('degree-mode-toggle');
    if (degreeModeToggle) {
        const isDegreesOff = store.state.degreeDisplayMode === 'off';
        degreeModeToggle.classList.toggle('disabled', isDegreesOff);
    }
}

/**
 * Updates the visual selection of the harmony preset buttons based on the current state.
 * This ensures only one button is illuminated at a time across all chord tabs.
 */
function updateChordButtonSelection() {
    // Get the merged chords panel
    const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');

    // Clear selection from all chord buttons
    if (chordsPanel) {
        chordsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
    }

    // If the current tool is 'chord', find the matching button and apply the 'selected' class.
    if (store.state.selectedTool === 'chord' && chordsPanel) {
        const currentIntervals = store.state.activeChordIntervals.toString();

        // Search through all chord buttons
        for (const button of chordsPanel.querySelectorAll('.harmony-preset-button')) {
            const buttonIntervals = CHORD_SHAPES[button.textContent.trim()]?.toString();
            if (buttonIntervals === currentIntervals) {
                button.classList.add('selected');
                return; // Exit once found
            }
        }
    }
}

/**
 * Updates the visual selection of interval buttons based on current active intervals.
 */
function updateIntervalButtonSelection() {
    const intervalsPanel = document.querySelector('#intervals-panel .harmony-preset-grid');
    if (!intervalsPanel) return;

    // Clear selection from all interval buttons
    intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));

    // If the current tool is 'chord' and we have active chord intervals, highlight matching buttons
    if (store.state.selectedTool === 'chord' && store.state.activeChordIntervals) {
        const activeIntervals = store.state.activeChordIntervals;
        intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(button => {
            const intervalLabel = button.textContent.trim();
            const buttonInterval = INTERVAL_SHAPES[intervalLabel];
            // Check if this interval button matches any of the active chord intervals
            if (buttonInterval && activeIntervals.includes(buttonInterval[0])) {
                button.classList.add('selected');
            }
        });
    }
}


// Color helper functions for creating lighter/darker variants
const lightenColor = (hex, percent = 50) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const lightenedR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
    const lightenedG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
    const lightenedB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));

    return `#${lightenedR.toString(16).padStart(2, '0')}${lightenedG.toString(16).padStart(2, '0')}${lightenedB.toString(16).padStart(2, '0')}`;
};

export function initToolSelectors() {
    const {
        noteBankContainer, eraserButton: eraserBtn,
        degreeVisibilityToggle, degreeModeToggle, flatBtn, sharpBtn, frequencyBtn, focusColoursToggle
    } = domCache.getMultiple(
        'noteBankContainer', 'eraserButton',
        'degreeVisibilityToggle', 'degreeModeToggle', 'flatBtn', 'sharpBtn', 'frequencyBtn', 'focusColoursToggle'
    );

    // Get harmony container directly since it uses a class, not an ID
    const harmonyContainer = document.querySelector('.pitch-tabs-container');
    const harmonyPresetGrid = document.querySelector('.harmony-preset-grid');

    // Get inversion toggle element
    const inversionToggle = document.getElementById('inversion-toggle');

    // Get chord position toggle element (single 6-state toggle)
    const chordPositionToggle6 = document.getElementById('chord-position-toggle-6');

    // Initialize clef range controls when the elements are available
    clefRangeController.init();

    // Define 4-note chord types
    const fourNoteChords = ['X7', 'x⁷', 'ø⁷', 'Xmaj7', 'x°7'];

    // --- Tool Click Listeners ---
    if (noteBankContainer) {
        noteBankContainer.querySelectorAll('.note').forEach(note => {
            note.addEventListener('click', () => {
                store.setSelectedNote(note.dataset.type, note.closest('.note-pair').dataset.color);
                store.setSelectedTool('note');
            });
        });
    }

    if (eraserBtn) {
        eraserBtn.addEventListener('click', () => store.setSelectedTool('eraser'));
    }

    // Get tonic mode buttons from the new grid structure
    const tonicModeButtons = Array.from(document.querySelectorAll('.tonic-mode-button'));

    const updateTonicModeButtons = (activeNumber = store.state.selectedToolTonicNumber) => {
        if (!tonicModeButtons.length) return;
        const fallbackNumber = tonicModeButtons[0] ? parseInt(tonicModeButtons[0].dataset.tonic, 10) : 1;
        const parsedCandidate = parseInt(activeNumber, 10);
        const parsedActive = Number.isNaN(parsedCandidate) ? fallbackNumber : parsedCandidate;
        tonicModeButtons.forEach(button => {
            const buttonNumber = parseInt(button.dataset.tonic, 10);
            const isActive = buttonNumber === parsedActive;
            button.classList.toggle('selected', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    if (tonicModeButtons.length) {
        tonicModeButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tonicNumber = button.getAttribute('data-tonic');
                if (!tonicNumber) return;
                store.setSelectedTool('tonicization', tonicNumber);
                updateTonicModeButtons(parseInt(tonicNumber, 10));
            });
        });
        updateTonicModeButtons();
    }
    
    // Attach chord shape handlers to buttons in the merged chords panel
    const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');

    // Helper function to add chord button event listeners
    function addChordButtonListeners(panel, chordShapes, panelName) {
        if (!panel) return;

        panel.querySelectorAll('.harmony-preset-button').forEach(button => {
            button.addEventListener('click', () => {
                const intervals = chordShapes[button.textContent];
                if (intervals && intervals.length > 0) {
                    store.setActiveChordIntervals(intervals);
                    store.setSelectedTool('chord');
                    // No need for setTimeout - state event handler will update toggle
                } else {
                    logger.error('ToolSelector', `Failed to retrieve valid intervals for ${panelName} chord: "${button.textContent}"`, null, 'toolbar');
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
    const pitchTabButtons = document.querySelectorAll('.pitch-tab-button');
    const pitchTabPanels = document.querySelectorAll('.pitch-tab-panel');
    
    if (pitchTabButtons.length > 0) {
        pitchTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.pitchTab;

                // Update active tab button
                pitchTabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                // Update active tab panel
                pitchTabPanels.forEach(panel => panel.classList.remove('active'));
                const targetPanel = document.getElementById(`${targetTab}-panel`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }

                // Update toggle state when switching to chords tab
                if (targetTab === 'chords') {
                    updateChordPositionToggleState();
                }

                // Refresh clef wheel visuals when switching to clef tab
                if (targetTab === 'clef') {
                    // Use setTimeout to ensure the tab is visible before updating visuals
                    setTimeout(() => {
                        clefRangeController.refreshWheelVisuals();
                    }, 0);
                }
            });
        });
    }

    // Add inversion toggle handler
    if (inversionToggle) {
        inversionToggle.addEventListener('click', () => {
            const newInversionState = !store.state.isIntervalsInverted;
            store.setIntervalsInversion(newInversionState);
            inversionToggle.blur(); // Remove focus to prevent lingering highlight
        });
        
        // Initialize toggle state
        const updateInversionToggle = (isInverted) => {
            inversionToggle.classList.toggle('active', isInverted);
        };
        
        // Listen for state changes
        store.on('intervalsInversionChanged', updateInversionToggle);
        
        // Set initial state
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
        const updateChordPositionToggle6 = (positionState) => {
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
        store.on('chordPositionChanged', (newState) => {
            updateChordPositionToggle6(newState);
        });

        // Set initial state
        updateChordPositionToggle6(store.state.chordPositionState);
    }

    // Helper function to get max position states based on chord note count
    function getMaxPositionStates() {
        // Use state instead of DOM to get accurate interval count immediately
        const intervals = store.state.activeChordIntervals;
        if (!intervals || intervals.length === 0) return 3;
        return intervals.length;
    }

    // Function to determine chord note count from current state
    function getChordNoteCount() {
        // Use state instead of DOM to get accurate interval count immediately
        const intervals = store.state.activeChordIntervals;
        if (!intervals || intervals.length === 0) return 3;
        return intervals.length;
    }

    // Function to update 6-state toggle grayed-out states based on chord note count
    function updateChordPositionToggleState() {
        if (!chordPositionToggle6) return;

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

    // Add interval button handlers for the intervals panel
    const intervalsPanel = document.querySelector('#intervals-panel .harmony-preset-grid');
    if (intervalsPanel) {
        intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(button => {
            button.addEventListener('click', () => {
                const intervalLabel = button.textContent.trim();
                const intervalData = INTERVAL_SHAPES[intervalLabel];
                if (intervalData && intervalData.length > 0) {
                    // For intervals, always use root + interval (inversion handled by state)
                    const intervals = ['1P', intervalData[0]];
                    store.setActiveChordIntervals(intervals);
                    store.setSelectedTool('chord'); // Reuse chord functionality for intervals
                    
                    logger.debug('ToolSelector', `Interval ${intervalLabel} selected`, intervals, 'toolbar');
                } else {
                    logger.error('ToolSelector', `Failed to retrieve valid interval for symbol: "${intervalLabel}"`, null, 'toolbar');
                    logger.error('ToolSelector', 'Available interval shapes', Object.keys(INTERVAL_SHAPES), 'toolbar');
                }
                button.blur(); // Remove focus to prevent lingering highlight
            });

            // Add double-click functionality to disable intervals
            button.addEventListener('dblclick', () => {
                if (button.classList.contains('selected')) {
                    store.setSelectedTool('note');
                }
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
                const lastMode = degreeModeToggle.classList.contains('active') ? 'modal' : 'diatonic';
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
    if (flatBtn) flatBtn.addEventListener('click', () => {
        // Toggling flat/sharp automatically turns off Hz mode
        if (store.state.showFrequencyLabels) {
            store.toggleFrequencyLabels();
        }
        store.toggleAccidentalMode('flat');
        flatBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    if (sharpBtn) sharpBtn.addEventListener('click', () => {
        // Toggling flat/sharp automatically turns off Hz mode
        if (store.state.showFrequencyLabels) {
            store.toggleFrequencyLabels();
        }
        store.toggleAccidentalMode('sharp');
        sharpBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    if (frequencyBtn) frequencyBtn.addEventListener('click', () => {
        // Hz button toggles independently, doesn't affect flat/sharp states
        store.toggleFrequencyLabels();
        frequencyBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    if (focusColoursToggle) focusColoursToggle.addEventListener('change', () => {
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
    });

    // --- UI State Change Listeners (Visual Feedback) ---
    store.on('toolChanged', ({ newTool }) => {
        // Clear selected state from tool buttons, but preserve note selection unless switching to note tool
        // Clear all chord buttons from the chords panel
        const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');
        if (chordsPanel) {
            chordsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
        }
        const intervalsPanel = document.querySelector('#intervals-panel .harmony-preset-grid');
        if (intervalsPanel) {
            intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
        }

        eraserBtn?.classList.remove('selected');
        if (harmonyContainer) harmonyContainer.classList.remove('active-tool');

        if (newTool === 'eraser') {
            eraserBtn?.classList.add('selected');
        } else if (newTool === 'tonicization') {
            // Tonic buttons remain highlighted via updateTonicModeButtons
        } else if (newTool === 'chord') {
            harmonyContainer?.classList.add('active-tool');
            updateChordButtonSelection();
            updateIntervalButtonSelection();
            updateChordPositionToggleState(); // Update toggle state when switching to chord tool
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
        if (store.state.selectedTool === 'chord') {
            updateChordButtonSelection();
            updateIntervalButtonSelection();
            updateChordPositionToggleState(); // Update position toggle based on new chord
        }
    });

    store.on('noteChanged', ({ newNote }) => {
        document.querySelectorAll('.note, .note-pair').forEach(el => el.classList.remove('selected'));
        const targetPair = document.querySelector(`.note-pair[data-color='${newNote.color}']`);
        targetPair?.classList.add('selected');
        targetPair?.querySelector(`.note[data-type='${newNote.shape}']`)?.classList.add('selected');

        // Set accent color and lighter variant for chord button styling
        if (harmonyContainer) {
            const lightColor = lightenColor(newNote.color, 50);
            const extraLightColor = lightenColor(lightColor, 60);
            harmonyContainer.style.setProperty('--c-accent', newNote.color);
            harmonyContainer.style.setProperty('--c-accent-light', extraLightColor);
        }
        const tabSidebar = document.querySelector('.tab-sidebar');
        if (tabSidebar) {
            tabSidebar.style.setProperty('--c-accent', newNote.color);
        }
    });

    store.on('degreeDisplayModeChanged', (mode) => {
        
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
            const wasActive = degreeModeToggle.classList.contains('active');
            degreeModeToggle.classList.toggle('active', mode === 'modal');
            const isActive = degreeModeToggle.classList.contains('active');
        }
        
        // Update the disabled state of the Scale/Mode toggle
        updateScaleModeToggleState();
    });

    store.on('accidentalModeChanged', (accidentalMode) => {
        const { sharp, flat } = accidentalMode;
        sharpBtn?.classList.toggle('active', sharp);
        flatBtn?.classList.toggle('active', flat);
    });

    store.on('frequencyLabelsChanged', (showFrequencyLabels) => {
        frequencyBtn?.classList.toggle('active', showFrequencyLabels);
        // Visually disable flat/sharp buttons when frequency mode is active
        if (flatBtn) flatBtn.style.opacity = showFrequencyLabels ? '0.3' : '';
        if (sharpBtn) sharpBtn.style.opacity = showFrequencyLabels ? '0.3' : '';
        if (flatBtn) flatBtn.style.pointerEvents = showFrequencyLabels ? 'none' : '';
        if (sharpBtn) sharpBtn.style.pointerEvents = showFrequencyLabels ? 'none' : '';
    });

    // Initialize accent colors on startup
    if (harmonyContainer && store.state.selectedNote) {
        const color = store.state.selectedNote.color;
        const lightColor = lightenColor(color, 50);
        const extraLightColor = lightenColor(lightColor, 60);
        harmonyContainer.style.setProperty('--c-accent', color);
        harmonyContainer.style.setProperty('--c-accent-light', extraLightColor);
    }
    const tabSidebar = document.querySelector('.tab-sidebar');
    if (tabSidebar && store.state.selectedNote) {
        tabSidebar.style.setProperty('--c-accent', store.state.selectedNote.color);
    }

    // Initialize toggle state on startup
    setTimeout(() => updateChordPositionToggleState(), 50);
    
    // Initialize Scale/Mode toggle state on startup
    updateScaleModeToggleState();
}
