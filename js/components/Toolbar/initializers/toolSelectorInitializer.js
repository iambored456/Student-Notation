// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '../../../state/index.js';

export function initToolSelectors() {
    // --- Tonic Dropdown Logic ---
    const tonicDropdownContainer = document.getElementById('tonic-dropdown-container');
    const tonicDropdownButton = document.getElementById('tonic-dropdown-button');
    const tonicDropdownLabel = document.getElementById('tonic-dropdown-label');
    const tonicDropdownMenu = document.getElementById('tonic-dropdown-menu');

    if (tonicDropdownContainer && tonicDropdownButton && tonicDropdownMenu) {
        tonicDropdownButton.addEventListener('click', () => {
            tonicDropdownContainer.classList.toggle('open');
        });
        tonicDropdownMenu.querySelectorAll('.tonic-sign-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const tonicNumber = btn.getAttribute('data-tonic');
                store.setSelectedTool('tonicization', null, tonicNumber); 
            });
        });
        document.addEventListener('click', (e) => {
            if (!tonicDropdownContainer.contains(e.target)) {
                tonicDropdownContainer.classList.remove('open');
            }
        });
        store.on('rhythmStructureChanged', () => {
            if (tonicDropdownContainer.classList.contains('open') && store.state.selectedTool.type === 'tonicization') {
                tonicDropdownContainer.classList.remove('open');
                const currentTonic = store.state.selectedTool.tonicNumber;
                if (currentTonic) {
                    const correspondingButton = tonicDropdownMenu.querySelector(`.tonic-sign-button[data-tonic='${currentTonic}']`);
                    if (correspondingButton) {
                        tonicDropdownLabel.textContent = correspondingButton.textContent;
                    }
                }
            }
        });
    }

    // --- Chord Shape Tool ---
    const chordShapeTool = document.getElementById('x-chord-shape-tool');
    if (chordShapeTool) {
        chordShapeTool.addEventListener('click', () => {
            store.setSelectedTool('chord');
        });
    }
    
    // --- NEW: Degree Dropdown Logic ---
    const degreeDropdownWrapper = document.getElementById('degree-dropdown-wrapper');
    const degreeDropdownButton = document.getElementById('degree-dropdown-button');
    const diatonicBtn = document.getElementById('toggle-diatonic-degrees');
    const modalBtn = document.getElementById('toggle-modal-degrees');

    if (degreeDropdownWrapper && degreeDropdownButton && diatonicBtn && modalBtn) {
        degreeDropdownButton.addEventListener('click', () => {
            degreeDropdownWrapper.classList.toggle('open');
        });

        const handleDegreeSelection = (mode) => {
            store.setDegreeDisplayMode(mode);
            degreeDropdownWrapper.classList.remove('open'); // Close after selection
        };
        
        diatonicBtn.addEventListener('click', () => handleDegreeSelection('diatonic'));
        modalBtn.addEventListener('click', () => handleDegreeSelection('modal'));

        store.on('degreeDisplayModeChanged', (mode) => {
            diatonicBtn.classList.remove('active');
            modalBtn.classList.remove('active');
            if (mode === 'diatonic') {
                diatonicBtn.classList.add('active');
            } else if (mode === 'modal') {
                modalBtn.classList.add('active');
            }
        });

        document.addEventListener('click', (e) => {
            if (!degreeDropdownWrapper.contains(e.target)) {
                degreeDropdownWrapper.classList.remove('open');
            }
        });
    }

    // --- Accidental Toggle Logic ---
    const flatBtn = document.getElementById('flat-toggle-btn');
    const sharpBtn = document.getElementById('sharp-toggle-btn');

    if (flatBtn && sharpBtn) {
        flatBtn.addEventListener('click', () => store.toggleAccidentalMode('flat'));
        sharpBtn.addEventListener('click', () => store.toggleAccidentalMode('sharp'));
        store.on('accidentalModeChanged', ({ sharp, flat }) => {
            sharpBtn.classList.toggle('active', sharp);
            sharpBtn.setAttribute('aria-pressed', sharp);
            flatBtn.classList.toggle('active', flat);
            flatBtn.setAttribute('aria-pressed', flat);
        });
    }

    // --- Tool Selection Highlighting ---
    store.on('toolChanged', ({ newTool }) => {
        document.querySelectorAll('.note, .note-pair, #x-chord-shape-tool, #tonic-dropdown-button, .tonic-sign-button').forEach(el => el.classList.remove('selected'));
        
        if (newTool.type === 'tonicization') {
            tonicDropdownButton?.classList.add('selected');
            const selectedBtnInMenu = tonicDropdownMenu?.querySelector(`.tonic-sign-button[data-tonic='${newTool.tonicNumber}']`);
            selectedBtnInMenu?.classList.add('selected');
        } else if (newTool.type === 'chord') {
            document.getElementById('x-chord-shape-tool')?.classList.add('selected');
            tonicDropdownContainer?.classList.remove('open');
        } else { 
            const targetPair = document.querySelector(`.note-pair[data-color='${newTool.color}']`);
            if (targetPair) {
                targetPair.classList.add('selected');
                const targetNote = targetPair.querySelector(`.note[data-type='${newTool.type}']`);
                if (targetNote) targetNote.classList.add('selected');
            }
            tonicDropdownContainer?.classList.remove('open');
        }
    });
}