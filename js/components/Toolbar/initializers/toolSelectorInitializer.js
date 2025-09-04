// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '../../../state/index.js';
import { Chord, ChordType } from 'tonal';
import domCache from '../../../services/domCache.js';
import { getTabIconPath } from '../../../utils/assetPaths.js';
import notificationSystem from '../../UI/NotificationSystem.js';

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
    // Get all chord panels (basic and advanced)
    const basicChordsPanel = document.querySelector('#basic-chords-panel .harmony-preset-grid');
    const advancedChordsPanel = document.querySelector('#advanced-chords-panel .harmony-preset-grid');
    
    // Clear selection from all chord buttons in both panels
    [basicChordsPanel, advancedChordsPanel].forEach(panel => {
        if (panel) {
            panel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
        }
    });

    // If the current tool is 'chord', find the matching button and apply the 'selected' class.
    if (store.state.selectedTool === 'chord') {
        const currentIntervals = store.state.activeChordIntervals.toString();
        
        // Search in basic chords panel first
        if (basicChordsPanel) {
            for (const button of basicChordsPanel.children) {
                const buttonIntervals = BASIC_CHORD_SHAPES[button.textContent]?.toString();
                if (buttonIntervals === currentIntervals) {
                    button.classList.add('selected');
                    return; // Exit once found
                }
            }
        }
        
        // Search in advanced chords panel if not found in basic
        if (advancedChordsPanel) {
            for (const button of advancedChordsPanel.children) {
                const buttonIntervals = ADVANCED_CHORD_SHAPES[button.textContent]?.toString();
                if (buttonIntervals === currentIntervals) {
                    button.classList.add('selected');
                    return; // Exit once found
                }
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


export function initToolSelectors() {
    const {
        noteBankContainer, eraserButton: eraserBtn, tonicDropdownContainer,
        tonicDropdownButton, tonicDropdownLabel, tonicDropdownMenu,
        degreeVisibilityToggle, degreeModeToggle, flatBtn, sharpBtn, focusColoursToggle,
        harmonyContainerMain: harmonyContainer
    } = domCache.getMultiple(
        'noteBankContainer', 'eraserButton', 'tonicDropdownContainer',
        'tonicDropdownButton', 'tonicDropdownLabel', 'tonicDropdownMenu',
        'degreeVisibilityToggle', 'degreeModeToggle', 'flatBtn', 'sharpBtn', 'focusColoursToggle',
        'harmonyContainerMain'
    );
    const harmonyPresetGrid = document.querySelector('.harmony-preset-grid');
    
    // Get inversion toggle element
    const inversionToggle = document.getElementById('inversion-toggle');
    
    // Get chord position toggle elements
    const chordPositionToggle = document.getElementById('chord-position-toggle');
    const chordPositionToggle4 = document.getElementById('chord-position-toggle-4');
    const chordPositionToggleAdv = document.getElementById('chord-position-toggle-adv');
    const chordPositionToggle4Adv = document.getElementById('chord-position-toggle-4-adv');
    const chordPositionToggle5Adv = document.getElementById('chord-position-toggle-5-adv');
    const chordPositionToggle6Adv = document.getElementById('chord-position-toggle-6-adv');
    
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
    
    // Attach chord shape handlers to buttons in both basic and advanced chord panels
    const basicChordsPanel = document.querySelector('#basic-chords-panel .harmony-preset-grid');
    const advancedChordsPanel = document.querySelector('#advanced-chords-panel .harmony-preset-grid');
    
    // Helper function to add chord button event listeners
    function addChordButtonListeners(panel, chordShapes, panelName) {
        if (!panel) return;
        
        panel.querySelectorAll('.harmony-preset-button').forEach(button => {
            button.addEventListener('click', () => {
                const intervals = chordShapes[button.textContent];
                if (intervals && intervals.length > 0) {
                    store.setActiveChordIntervals(intervals);
                    store.setSelectedTool('chord');
                    // Update toggle visibility after chord selection
                    setTimeout(() => updateToggleVisibility(), 10);
                } else {
                    console.error(`Failed to retrieve valid intervals for ${panelName} chord: "${button.textContent}"`);
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
    
    // Add event listeners to both panels
    addChordButtonListeners(basicChordsPanel, BASIC_CHORD_SHAPES, 'basic');
    addChordButtonListeners(advancedChordsPanel, ADVANCED_CHORD_SHAPES, 'advanced');

    // Add chord tab switching logic
    const chordTabButtons = document.querySelectorAll('.chord-tab-button');
    const chordTabPanels = document.querySelectorAll('.chord-tab-panel');
    
    if (chordTabButtons.length > 0) {
        chordTabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.dataset.chordTab;
                
                // Update active tab button
                chordTabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                // Update active tab panel
                chordTabPanels.forEach(panel => panel.classList.remove('active'));
                const targetPanel = document.getElementById(`${targetTab}-panel`);
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
                
                // Update toggle visibility when switching to chord tabs
                if (targetTab === 'basic-chords' || targetTab === 'advanced-chords') {
                    setTimeout(() => updateToggleVisibility(), 10);
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

    // Add advanced chord position toggle handlers
    if (chordPositionToggleAdv) {
        chordPositionToggleAdv.addEventListener('click', () => {
            const currentState = store.state.chordPositionState;
            const nextState = (currentState + 1) % 3;
            store.setChordPosition(nextState);
            chordPositionToggleAdv.blur();
        });
        
        // Initialize advanced 3-state toggle state updater
        const updateChordPositionToggleAdv = (positionState) => {
            // Remove all state classes
            chordPositionToggleAdv.classList.remove('state-1', 'state-2');
            
            // Add appropriate state class
            if (positionState === 1) {
                chordPositionToggleAdv.classList.add('state-1');
            } else if (positionState === 2) {
                chordPositionToggleAdv.classList.add('state-2');
            }
            // positionState === 0 has no additional class (default gray)
        };
        
        // Listen for state changes
        store.on('chordPositionChanged', updateChordPositionToggleAdv);
        
        // Set initial state
        updateChordPositionToggleAdv(store.state.chordPositionState);
    }

    if (chordPositionToggle4Adv) {
        chordPositionToggle4Adv.addEventListener('click', () => {
            const currentState = store.state.chordPositionState;
            const nextState = (currentState + 1) % 4;
            store.setChordPosition(nextState);
            chordPositionToggle4Adv.blur();
        });
        
        // Initialize advanced 4-state toggle state updater
        const updateChordPositionToggle4Adv = (positionState) => {
            // Remove all state classes
            chordPositionToggle4Adv.classList.remove('state-1', 'state-2', 'state-3');
            
            // Add appropriate state class
            if (positionState === 1) {
                chordPositionToggle4Adv.classList.add('state-1');
            } else if (positionState === 2) {
                chordPositionToggle4Adv.classList.add('state-2');
            } else if (positionState === 3) {
                chordPositionToggle4Adv.classList.add('state-3');
            }
            // positionState === 0 has no additional class (default gray)
        };
        
        // Listen for state changes
        store.on('chordPositionChanged', updateChordPositionToggle4Adv);
        
        // Set initial state
        updateChordPositionToggle4Adv(store.state.chordPositionState);
    }

    if (chordPositionToggle5Adv) {
        chordPositionToggle5Adv.addEventListener('click', () => {
            const currentState = store.state.chordPositionState;
            const nextState = (currentState + 1) % 5;
            store.setChordPosition(nextState);
            chordPositionToggle5Adv.blur();
        });
        
        // Initialize 5-state toggle state updater
        const updateChordPositionToggle5 = (positionState) => {
            // Remove all state classes
            chordPositionToggle5Adv.classList.remove('state-1', 'state-2', 'state-3', 'state-4');
            
            // Add appropriate state class
            if (positionState === 1) {
                chordPositionToggle5Adv.classList.add('state-1');
            } else if (positionState === 2) {
                chordPositionToggle5Adv.classList.add('state-2');
            } else if (positionState === 3) {
                chordPositionToggle5Adv.classList.add('state-3');
            } else if (positionState === 4) {
                chordPositionToggle5Adv.classList.add('state-4');
            }
            // positionState === 0 has no additional class (default gray)
        };
        
        // Listen for state changes
        store.on('chordPositionChanged', updateChordPositionToggle5);
        
        // Set initial state
        updateChordPositionToggle5(store.state.chordPositionState);
    }

    if (chordPositionToggle6Adv) {
        chordPositionToggle6Adv.addEventListener('click', () => {
            const currentState = store.state.chordPositionState;
            const nextState = (currentState + 1) % 6;
            store.setChordPosition(nextState);
            chordPositionToggle6Adv.blur();
        });
        
        // Initialize 6-state toggle state updater
        const updateChordPositionToggle6 = (positionState) => {
            // Remove all state classes
            chordPositionToggle6Adv.classList.remove('state-1', 'state-2', 'state-3', 'state-4', 'state-5');
            
            // Add appropriate state class
            if (positionState === 1) {
                chordPositionToggle6Adv.classList.add('state-1');
            } else if (positionState === 2) {
                chordPositionToggle6Adv.classList.add('state-2');
            } else if (positionState === 3) {
                chordPositionToggle6Adv.classList.add('state-3');
            } else if (positionState === 4) {
                chordPositionToggle6Adv.classList.add('state-4');
            } else if (positionState === 5) {
                chordPositionToggle6Adv.classList.add('state-5');
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

    // Function to determine chord note count and return appropriate toggle info
    function getChordToggleInfo() {
        // Check for selected chord button in both basic and advanced panels
        const basicChordsPanel = document.querySelector('#basic-chords-panel .harmony-preset-grid');
        const advancedChordsPanel = document.querySelector('#advanced-chords-panel .harmony-preset-grid');
        
        let selectedButton = null;
        if (basicChordsPanel) {
            selectedButton = basicChordsPanel.querySelector('.harmony-preset-button.selected');
        }
        if (!selectedButton && advancedChordsPanel) {
            selectedButton = advancedChordsPanel.querySelector('.harmony-preset-button.selected');
        }
        
        if (!selectedButton) return { noteCount: 3, isAdvanced: false };
        
        // Get the intervals array to determine note count
        const chordSymbol = selectedButton.textContent;
        const intervals = CHORD_SHAPES[chordSymbol];
        const noteCount = intervals ? intervals.length : 3;
        const isAdvanced = advancedChordsPanel?.contains(selectedButton) || false;
        
        return { noteCount, isAdvanced, chordSymbol };
    }

    // Function to switch between 3-state, 4-state, 5-state, and 6-state toggles
    function updateToggleVisibility() {
        
        const basicToggle = chordPositionToggle;
        const fourStateToggle = chordPositionToggle4;
        const advancedToggle = document.getElementById('chord-position-toggle-adv');
        const advancedFourToggle = document.getElementById('chord-position-toggle-4-adv');  
        const advancedFiveToggle = document.getElementById('chord-position-toggle-5-adv');
        const advancedSixToggle = document.getElementById('chord-position-toggle-6-adv');
        
        
        const { noteCount, isAdvanced, chordSymbol } = getChordToggleInfo();
        
        
        // Always show inversion toggle (intervals panel inversion)
        if (inversionToggle) {
            inversionToggle.classList.remove('hidden');
        }
        
        // Hide all chord position toggles first
        [basicToggle, fourStateToggle, advancedToggle, advancedFourToggle, advancedFiveToggle, advancedSixToggle].forEach(toggle => {
            if (toggle) toggle.classList.add('hidden');
        });
        
        // Show appropriate toggle based on note count and panel
        let activeToggle = null;
        let maxPosition = 0;
        
        if (isAdvanced) {
            // Advanced chord panel toggles
            if (noteCount >= 6) {
                activeToggle = advancedSixToggle;
                maxPosition = 5; // 6-note chord: positions 0-5
            } else if (noteCount === 5) {
                activeToggle = advancedFiveToggle;
                maxPosition = 4; // 5-note chord: positions 0-4
            } else if (noteCount >= 4) {
                activeToggle = advancedFourToggle;
                maxPosition = 3; // 4-note chord: positions 0-3
            } else {
                activeToggle = advancedToggle;
                maxPosition = 2; // 3-note chord: positions 0-2
            }
        } else {
            // Basic chord panel toggles  
            if (noteCount >= 4) {
                activeToggle = fourStateToggle;
                maxPosition = 3; // 4-note chord: positions 0-3
            } else {
                activeToggle = basicToggle;
                maxPosition = 2; // 3-note chord: positions 0-2
            }
        }
        
        if (activeToggle) {
            activeToggle.classList.remove('hidden');
            
            // Reset chord position to valid range if current position exceeds max
            if (store.state.chordPositionState > maxPosition) {
                store.setChordPosition(0);
            }
        } else {
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
                    
                    console.log(`Interval ${intervalLabel} selected:`, intervals);
                } else {
                    console.error(`Failed to retrieve valid interval for symbol: "${intervalLabel}"`);
                    console.error('Available interval shapes:', Object.keys(INTERVAL_SHAPES));
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
        store.toggleAccidentalMode('flat');
        flatBtn.blur(); // Remove focus to prevent lingering blue highlight
    });
    if (sharpBtn) sharpBtn.addEventListener('click', () => {
        store.toggleAccidentalMode('sharp');
        sharpBtn.blur(); // Remove focus to prevent lingering blue highlight
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
        // Clear all chord buttons from both panels
        const basicChordsPanel = document.querySelector('#basic-chords-panel .harmony-preset-grid');
        const advancedChordsPanel = document.querySelector('#advanced-chords-panel .harmony-preset-grid');
        [basicChordsPanel, advancedChordsPanel].forEach(panel => {
            if (panel) {
                panel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
            }
        });
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