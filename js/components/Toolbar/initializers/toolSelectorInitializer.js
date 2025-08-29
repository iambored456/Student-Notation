// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '../../../state/index.js';
import { Chord, ChordType } from 'tonal';
import domCache from '../../../services/domCache.js';
import { getTabIconPath } from '../../../utils/assetPaths.js';
import notificationSystem from '../../UI/NotificationSystem.js';

// UPDATED: Matched keys to new button labels and added the new chord types.
const CHORD_SHAPES = {
    'X':      ChordType.get("M").intervals,
    'x':      ChordType.get("m").intervals,
    'x°':     ChordType.get("dim").intervals,
    'X+':     ChordType.get("aug").intervals,
    'X7':     ChordType.get("7").intervals,
    'x⁷':     ChordType.get("m7").intervals,
    'ø⁷':     ChordType.get("m7b5").intervals,
    'Xadd6':  ChordType.get("M6").intervals,
    'Xsus4':  ChordType.get("sus4").intervals,
    'Xsus2':  ChordType.get("sus2").intervals,
    'Xmaj7':  ChordType.get("M7").intervals,
    'x°7':    ChordType.get("dim7").intervals
};

// Define interval mappings for each button in the 4x4 grid
const INTERVAL_SHAPES = {
    '6':   ['6M'],       // Major 6th
    '#6':  ['7m'],       // Minor 7th (enharmonic)
    '♭7':  ['7m'],       // Minor 7th
    '7':   ['7M'],       // Major 7th
    '♭5':  ['5d'],       // Tritone (diminished 5th)
    '5':   ['5P'],       // Perfect 5th
    '#5':  ['6m'],       // Minor 6th (enharmonic)
    '♭6':  ['6m'],       // Minor 6th
    '♭3':  ['3m'],       // Minor 3rd
    '3':   ['3M'],       // Major 3rd
    '4':   ['4P'],       // Perfect 4th
    '#4':  ['4A'],       // Tritone (augmented 4th)
    '1':   ['1P'],       // Unison
    '♭2':  ['2m'],       // Minor 2nd
    '2':   ['2M'],       // Major 2nd
    '#2':  ['3m']        // Minor 3rd (enharmonic)
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
 * This ensures only one button is illuminated at a time.
 */
function updateChordButtonSelection() {
    const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');
    if (!chordsPanel) return;

    // First, clear the 'selected' class from all chord buttons in the chords panel.
    chordsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));

    // If the current tool is 'chord', find the matching button and apply the 'selected' class.
    if (store.state.selectedTool === 'chord') {
        const currentIntervals = store.state.activeChordIntervals.toString();
        for (const button of chordsPanel.children) {
            const buttonIntervals = CHORD_SHAPES[button.textContent]?.toString();
            if (buttonIntervals === currentIntervals) {
                button.classList.add('selected');
                break; // Exit the loop once the correct button is found and selected.
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

    // If the current tool is 'interval' and we have active intervals, highlight matching buttons
    if (store.state.selectedTool === 'interval' && store.state.activeIntervals) {
        const activeIntervals = store.state.activeIntervals;
        intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(button => {
            const buttonInterval = INTERVAL_SHAPES[button.textContent];
            if (buttonInterval && activeIntervals.includes(buttonInterval[0])) {
                button.classList.add('selected');
            }
        });
    }
}


export function initToolSelectors() {
    const {
        noteBankContainer, eraserButton: eraserBtn, tonicDropdownContainer,
        tonicDropdownButton, tonicDropdownLabel, tonicDropdownMenu,
        degreeVisibilityToggle, degreeModeToggle, flatBtn, sharpBtn, 
        harmonyContainerMain: harmonyContainer
    } = domCache.getMultiple(
        'noteBankContainer', 'eraserButton', 'tonicDropdownContainer',
        'tonicDropdownButton', 'tonicDropdownLabel', 'tonicDropdownMenu',
        'degreeVisibilityToggle', 'degreeModeToggle', 'flatBtn', 'sharpBtn', 
        'harmonyContainerMain'
    );
    const harmonyPresetGrid = document.querySelector('.harmony-preset-grid');
    
    // Get inversion toggle element
    const inversionToggle = document.getElementById('inversion-toggle');
    
    // Get chord position toggle elements
    const chordPositionToggle = document.getElementById('chord-position-toggle');
    const chordPositionToggle4 = document.getElementById('chord-position-toggle-4');
    
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
    
    // Only attach chord shape handlers to buttons in the chords panel (not intervals panel)
    const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');
    if (chordsPanel) {
        chordsPanel.querySelectorAll('.harmony-preset-button').forEach(button => {
            button.addEventListener('click', () => {
                const intervals = CHORD_SHAPES[button.textContent];
                if (intervals && intervals.length > 0) {
                    store.setActiveChordIntervals(intervals);
                    store.setSelectedTool('chord');
                    // Update toggle visibility after chord selection
                    setTimeout(() => updateToggleVisibility(), 10);
                } else {
                    console.error(`Failed to retrieve valid intervals for symbol: "${button.textContent}"`);
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

    // Add 3-state chord position toggle handler
    if (chordPositionToggle) {
        chordPositionToggle.addEventListener('click', () => {
            // Cycle through states: 0 -> 1 -> 2 -> 0
            const currentState = store.state.chordPositionState;
            const nextState = (currentState + 1) % 3;
            store.setChordPosition(nextState);
            chordPositionToggle.blur(); // Remove focus to prevent lingering highlight
        });
        
        // Initialize toggle state
        const updateChordPositionToggle = (positionState) => {
            // Remove all state classes
            chordPositionToggle.classList.remove('state-1', 'state-2');
            
            // Add appropriate state class
            if (positionState === 1) {
                chordPositionToggle.classList.add('state-1');
            } else if (positionState === 2) {
                chordPositionToggle.classList.add('state-2');
            }
            // positionState === 0 has no additional class (default gray)
        };
        
        // Listen for state changes
        store.on('chordPositionChanged', updateChordPositionToggle);
        
        // Set initial state
        updateChordPositionToggle(store.state.chordPositionState);
    }

    // Add 4-state chord position toggle handler
    if (chordPositionToggle4) {
        chordPositionToggle4.addEventListener('click', () => {
            // Cycle through states: 0 -> 1 -> 2 -> 3 -> 0
            const currentState = store.state.chordPositionState;
            const nextState = (currentState + 1) % 4;
            store.setChordPosition(nextState);
            chordPositionToggle4.blur(); // Remove focus to prevent lingering highlight
        });
        
        // Initialize 4-state toggle state
        const updateChordPositionToggle4 = (positionState) => {
            // Remove all state classes
            chordPositionToggle4.classList.remove('state-1', 'state-2', 'state-3');
            
            // Add appropriate state class
            if (positionState === 1) {
                chordPositionToggle4.classList.add('state-1');
            } else if (positionState === 2) {
                chordPositionToggle4.classList.add('state-2');
            } else if (positionState === 3) {
                chordPositionToggle4.classList.add('state-3');
            }
            // positionState === 0 has no additional class (default gray)
        };
        
        // Listen for state changes
        store.on('chordPositionChanged', updateChordPositionToggle4);
        
        // Set initial state
        updateChordPositionToggle4(store.state.chordPositionState);
    }

    // Function to determine if current chord is a 4-note chord
    function is4NoteChord() {
        // Check the last selected chord button
        const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');
        if (!chordsPanel) return false;
        
        const selectedButton = chordsPanel.querySelector('.harmony-preset-button.selected');
        if (!selectedButton) return false;
        
        return fourNoteChords.includes(selectedButton.textContent);
    }

    // Function to switch between 3-state and 4-state toggles
    function updateToggleVisibility() {
        if (!chordPositionToggle || !chordPositionToggle4) return;
        
        if (is4NoteChord()) {
            // Show 4-state toggle, hide 3-state toggle
            chordPositionToggle.classList.add('hidden');
            chordPositionToggle4.classList.remove('hidden');
        } else {
            // Show 3-state toggle, hide 4-state toggle
            chordPositionToggle.classList.remove('hidden');
            chordPositionToggle4.classList.add('hidden');
            
            // Reset chord position to valid range for 3-state (max 2)
            if (store.state.chordPositionState > 2) {
                store.setChordPosition(0);
            }
        }
    }

    // Add interval button handlers for the intervals panel
    const intervalsPanel = document.querySelector('#intervals-panel .harmony-preset-grid');
    if (intervalsPanel) {
        intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(button => {
            button.addEventListener('click', () => {
                const intervalData = INTERVAL_SHAPES[button.textContent];
                if (intervalData && intervalData.length > 0) {
                    // For intervals, always use root + interval (positioning handled in interactor)
                    const intervals = ['1P', intervalData[0]];
                    store.setActiveChordIntervals(intervals);
                    store.setSelectedTool('chord'); // Reuse chord functionality for intervals
                } else {
                    console.error(`Failed to retrieve valid interval for symbol: "${button.textContent}"`);
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

    if (tonicDropdownButton && tonicDropdownMenu) {
        tonicDropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            tonicDropdownContainer.classList.toggle('open');
            
            // Toggle overflow on containers for dropdown escape
            const tabContent = document.querySelector('.tab-content');
            const container3 = document.getElementById('container-3');
            const isOpen = tonicDropdownContainer.classList.contains('open');
            
            if (tabContent) {
                tabContent.classList.toggle('dropdown-open', isOpen);
            }
            if (container3) {
                container3.classList.toggle('dropdown-open', isOpen);
            }
            
            tonicDropdownButton.blur(); // Remove focus to prevent lingering highlight
        });
        tonicDropdownMenu.querySelectorAll('.tonic-sign-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const tonicNumber = btn.getAttribute('data-tonic');
                const modeLabel = btn.querySelector('.mode-label').textContent;
                store.setSelectedTool('tonicization', tonicNumber);
                if (tonicDropdownLabel) {
                    tonicDropdownLabel.innerHTML = `<img src="${getTabIconPath(`tonicShape_${tonicNumber}.svg`)}" alt="Tonic ${tonicNumber}" class="tonic-shape-icon"> ${modeLabel}`;
                }
                tonicDropdownContainer.classList.remove('open');
                
                // Remove overflow class when dropdown closes
                const tabContent = document.querySelector('.tab-content');
                const container3 = document.getElementById('container-3');
                if (tabContent) {
                    tabContent.classList.remove('dropdown-open');
                }
                if (container3) {
                    container3.classList.remove('dropdown-open');
                }
            });
        });
    }
    
    // Degree Visibility Toggle (Show/Hide)
    if (degreeVisibilityToggle) {
        degreeVisibilityToggle.addEventListener('click', () => {
            const currentMode = store.state.degreeDisplayMode;
            if (currentMode === 'off') {
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
        store.toggleAccidentalMode('flat');
        flatBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    if (sharpBtn) sharpBtn.addEventListener('click', () => {
        store.toggleAccidentalMode('sharp');
        sharpBtn.blur(); // Remove focus to prevent lingering blue highlight
    });

    document.addEventListener('click', (e) => {
        if (tonicDropdownContainer && !tonicDropdownContainer.contains(e.target)) {
            tonicDropdownContainer.classList.remove('open');
            
            // Remove overflow class when dropdown closes
            const tabContent = document.querySelector('.tab-content');
            const container3 = document.getElementById('container-3');
            if (tabContent) {
                tabContent.classList.remove('dropdown-open');
            }
            if (container3) {
                container3.classList.remove('dropdown-open');
            }
        }
    });

    // --- UI State Change Listeners (Visual Feedback) ---
    store.on('toolChanged', ({ newTool }) => {
        // Clear selected state from tool buttons, but preserve note selection unless switching to note tool
        // Clear both chord and interval buttons
        const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');
        if (chordsPanel) {
            chordsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
        }
        const intervalsPanel = document.querySelector('#intervals-panel .harmony-preset-grid');
        if (intervalsPanel) {
            intervalsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
        }
        document.querySelectorAll('#tonic-dropdown-button, #eraser-tool-button').forEach(el => el.classList.remove('selected'));
        if(harmonyContainer) harmonyContainer.classList.remove('active-tool');

        if (newTool === 'eraser') {
            eraserBtn?.classList.add('selected');
        } else if (newTool === 'tonicization') {
            tonicDropdownButton?.classList.add('selected');
        } else if (newTool === 'chord') {
            harmonyContainer?.classList.add('active-tool');
            updateChordButtonSelection();
            updateIntervalButtonSelection();
            // Update toggle visibility when switching to chord tool
            setTimeout(() => updateToggleVisibility(), 10);
        } else if (newTool === 'note') {
            // Re-select the current note when switching to note tool
            const currentNote = store.state.selectedNote;
            if (currentNote) {
                const targetPair = document.querySelector(`.note-pair[data-color='${currentNote.color}']`);
                targetPair?.classList.add('selected');
                targetPair?.querySelector(`.note[data-type='${currentNote.shape}']`)?.classList.add('selected');
            }
        }
    });

    store.on('activeChordIntervalsChanged', () => {
        if (store.state.selectedTool === 'chord') {
            updateChordButtonSelection();
            updateIntervalButtonSelection();
        }
    });

    store.on('noteChanged', ({ newNote }) => {
        document.querySelectorAll('.note, .note-pair').forEach(el => el.classList.remove('selected'));
        const targetPair = document.querySelector(`.note-pair[data-color='${newNote.color}']`);
        targetPair?.classList.add('selected');
        targetPair?.querySelector(`.note[data-type='${newNote.shape}']`)?.classList.add('selected');
        if (harmonyContainer) {
            harmonyContainer.style.setProperty('--c-accent', newNote.color);
        }
        const tabSidebar = document.querySelector('.tab-sidebar');
        if (tabSidebar) {
            tabSidebar.style.setProperty('--c-accent', newNote.color);
        }
    });

    store.on('degreeDisplayModeChanged', (mode) => {
        // Update visibility toggle button text and state
        if (degreeVisibilityToggle) {
            degreeVisibilityToggle.textContent = mode === 'off' ? 'Show Degrees (OFF)' : 'Show Degrees (ON)';
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

    store.on('accidentalModeChanged', ({ sharp, flat }) => {
        sharpBtn?.classList.toggle('active', sharp);
        flatBtn?.classList.toggle('active', flat);
    });

    if (harmonyContainer && store.state.selectedNote) {
        harmonyContainer.style.setProperty('--c-accent', store.state.selectedNote.color);
    }
    const tabSidebar = document.querySelector('.tab-sidebar');
    if (tabSidebar && store.state.selectedNote) {
        tabSidebar.style.setProperty('--c-accent', store.state.selectedNote.color);
    }

    // Initialize toggle visibility on startup
    setTimeout(() => updateToggleVisibility(), 50);
    
    // Initialize Scale/Mode toggle state on startup
    updateScaleModeToggleState();
}