// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '../../../state/index.js';
import { Chord } from 'tonal';
import domCache from '../../../services/domCache.js';

const CHORD_SHAPES = {
    'X':      Chord.get("M").intervals,   'x':      Chord.get("m").intervals,
    'x°':     Chord.get("dim").intervals, 'X+':     Chord.get("aug").intervals,
    'X⁷':     Chord.get("7").intervals,   'x⁷':     Chord.get("m7").intervals,
    'ø⁷':     Chord.get("m7b5").intervals,'X⁶':     Chord.get("Madd6").intervals,
    'Xsus':   Chord.get("sus4").intervals,'Xsus2':  Chord.get("sus2").intervals
};

export function initToolSelectors() {
    const {
        noteBankContainer, eraserButton: eraserBtn, tonicDropdownContainer,
        tonicDropdownButton, tonicDropdownLabel, tonicDropdownMenu,
        degreeDropdownWrapper, degreeDropdownButton, diatonicBtn,
        modalBtn, flatBtn, sharpBtn, harmonyContainerMain: harmonyContainer
    } = domCache.getMultiple(
        'noteBankContainer', 'eraserButton', 'tonicDropdownContainer',
        'tonicDropdownButton', 'tonicDropdownLabel', 'tonicDropdownMenu',
        'degreeDropdownWrapper', 'degreeDropdownButton', 'diatonicBtn',
        'modalBtn', 'flatBtn', 'sharpBtn', 'harmonyContainerMain'
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
    
    if (harmonyPresetGrid) {
        harmonyPresetGrid.querySelectorAll('.harmony-preset-button').forEach(button => {
            button.addEventListener('click', () => {
                const intervals = CHORD_SHAPES[button.textContent];
                if (intervals) {
                    store.setActiveChordIntervals(intervals);
                    store.setSelectedTool('chord');
                }
            });
        });
    }

    if (tonicDropdownButton && tonicDropdownMenu) {
        tonicDropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            tonicDropdownContainer.classList.toggle('open');
            if(degreeDropdownWrapper) degreeDropdownWrapper.classList.remove('open');
        });
        tonicDropdownMenu.querySelectorAll('.tonic-sign-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const tonicNumber = btn.getAttribute('data-tonic');
                store.setSelectedTool('tonicization', tonicNumber);
                if (tonicDropdownLabel) {
                    tonicDropdownLabel.innerHTML = `<img src="/assets/icons/tonicShape_${tonicNumber}.svg" alt="Tonic ${tonicNumber}" class="tonic-shape-icon">`;
                }
                tonicDropdownContainer.classList.remove('open');
            });
        });
    }
    
    if (degreeDropdownButton) {
        degreeDropdownButton.addEventListener('click', (e) => {
            e.stopPropagation();
            degreeDropdownWrapper.classList.toggle('open');
            if(tonicDropdownContainer) tonicDropdownContainer.classList.remove('open');
        });
    }

    if(diatonicBtn) diatonicBtn.addEventListener('click', () => store.setDegreeDisplayMode('diatonic'));
    if(modalBtn) modalBtn.addEventListener('click', () => store.setDegreeDisplayMode('modal'));
    if (flatBtn) flatBtn.addEventListener('click', () => store.toggleAccidentalMode('flat'));
    if (sharpBtn) sharpBtn.addEventListener('click', () => store.toggleAccidentalMode('sharp'));

    document.addEventListener('click', (e) => {
        if (tonicDropdownContainer && !tonicDropdownContainer.contains(e.target)) tonicDropdownContainer.classList.remove('open');
        if (degreeDropdownWrapper && !degreeDropdownWrapper.contains(e.target)) degreeDropdownWrapper.classList.remove('open');
    });

    // --- UI State Change Listeners (Visual Feedback) ---
    store.on('toolChanged', ({ newTool }) => {
        document.querySelectorAll('.note, .note-pair, .harmony-preset-button, #tonic-dropdown-button, #eraser-tool-button').forEach(el => el.classList.remove('selected'));
        if(harmonyContainer) harmonyContainer.classList.remove('active-tool');

        if (newTool === 'eraser') {
            eraserBtn?.classList.add('selected');
        } else if (newTool === 'tonicization') {
            tonicDropdownButton?.classList.add('selected');
        } else if (newTool === 'chord') {
            harmonyContainer?.classList.add('active-tool');
            const currentIntervals = store.state.activeChordIntervals.toString();
            for (const button of harmonyPresetGrid.children) {
                const buttonIntervals = CHORD_SHAPES[button.textContent]?.toString();
                if (buttonIntervals === currentIntervals) {
                    button.classList.add('selected');
                    break;
                }
            }
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
        // Update tab buttons to use the selected note color
        const tabSidebar = document.querySelector('.tab-sidebar');
        if (tabSidebar) {
            tabSidebar.style.setProperty('--c-accent', newNote.color);
        }
    });

    store.on('degreeDisplayModeChanged', (mode) => {
        diatonicBtn?.classList.toggle('active', mode === 'diatonic');
        modalBtn?.classList.toggle('active', mode === 'modal');
    });

    store.on('accidentalModeChanged', ({ sharp, flat }) => {
        sharpBtn?.classList.toggle('active', sharp);
        flatBtn?.classList.toggle('active', sharp);
    });

    // --- Initial sync with safety check ---
    if (harmonyContainer && store.state.selectedNote) {
        harmonyContainer.style.setProperty('--c-accent', store.state.selectedNote.color);
    }
    const tabSidebar = document.querySelector('.tab-sidebar');
    if (tabSidebar && store.state.selectedNote) {
        tabSidebar.style.setProperty('--c-accent', store.state.selectedNote.color);
    }
}