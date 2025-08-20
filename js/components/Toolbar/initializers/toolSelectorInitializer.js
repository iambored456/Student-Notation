// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '../../../state/index.js';
import { Chord, ChordType } from 'tonal';
import domCache from '../../../services/domCache.js';
import { getTabIconPath } from '../../../utils/assetPaths.js';

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
                // If degrees are off, turn them on with the last used mode (default to diatonic)
                const lastMode = degreeModeToggle.textContent === 'Mode Degrees' ? 'modal' : 'diatonic';
                store.setDegreeDisplayMode(lastMode);
            } else {
                // If degrees are on, turn them off
                store.setDegreeDisplayMode('off');
            }
            degreeVisibilityToggle.blur();
        });
    }

    // Degree Mode Toggle (Scale/Mode)
    if (degreeModeToggle) {
        degreeModeToggle.addEventListener('click', () => {
            const currentMode = store.state.degreeDisplayMode;
            if (currentMode === 'diatonic') {
                store.setDegreeDisplayMode('modal');
            } else if (currentMode === 'modal') {
                store.setDegreeDisplayMode('diatonic');
            } else {
                // If degrees are off, turn on with the opposite mode
                const newMode = degreeModeToggle.textContent === 'Scale Degrees' ? 'modal' : 'diatonic';
                store.setDegreeDisplayMode(newMode);
            }
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
        // Only clear chord buttons from the chords panel
        const chordsPanel = document.querySelector('#chords-panel .harmony-preset-grid');
        if (chordsPanel) {
            chordsPanel.querySelectorAll('.harmony-preset-button').forEach(el => el.classList.remove('selected'));
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
        // Shows "Hide" when degrees are off (grayed), "Show" when degrees are on (white)
        if (degreeVisibilityToggle) {
            degreeVisibilityToggle.textContent = mode === 'off' ? 'Hide' : 'Show';
            degreeVisibilityToggle.classList.toggle('active', mode !== 'off');
        }
        
        // Update mode toggle button text and state (simple gold when active)
        if (degreeModeToggle) {
            degreeModeToggle.textContent = mode === 'modal' ? 'Mode Degrees' : 'Scale Degrees';
            degreeModeToggle.classList.toggle('active', mode !== 'off');
        }
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
}