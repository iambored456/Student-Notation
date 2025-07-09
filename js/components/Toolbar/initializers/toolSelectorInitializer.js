// js/components/Toolbar/initializers/toolSelectorInitializer.js
import store from '../../../state/index.js';

export function initToolSelectors() {
    // --- Existing Tonic Button Logic ---
    const tonicButtons = document.querySelectorAll('.tonic-sign-container .tonic-sign-button');
    tonicButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tonicNumber = btn.getAttribute('data-tonic');
            store.setSelectedTool('tonicization', '#000000', tonicNumber);
        });
    });

    // --- NEW: Chord Shape Tool ---
    const chordShapeTool = document.getElementById('x-chord-shape-tool');
    if (chordShapeTool) {
        chordShapeTool.addEventListener('click', () => {
            store.setSelectedTool('chord');
        });
    }
    
    // --- Existing Degree Display Logic ---
    const diatonicBtn = document.getElementById('toggle-diatonic-degrees');
    const modalBtn = document.getElementById('toggle-modal-degrees');

    if (diatonicBtn && modalBtn) {
        diatonicBtn.addEventListener('click', () => store.setDegreeDisplayMode('diatonic'));
        modalBtn.addEventListener('click', () => store.setDegreeDisplayMode('modal'));

        store.on('degreeDisplayModeChanged', (mode) => {
            diatonicBtn.classList.remove('active');
            modalBtn.classList.remove('active');
            if (mode === 'diatonic') diatonicBtn.classList.add('active');
            else if (mode === 'modal') modalBtn.classList.add('active');
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
        document.querySelectorAll('.note, .note-pair, .tonic-sign-button, #x-chord-shape-tool').forEach(el => el.classList.remove('selected'));
        
        if (newTool.type === 'tonicization') {
            document.querySelector(`.tonic-sign-button[data-tonic='${newTool.tonicNumber}']`)?.classList.add('selected');
        } else if (newTool.type === 'chord') {
            document.getElementById('x-chord-shape-tool')?.classList.add('selected');
        } else {
            const targetPair = document.querySelector(`.note-pair[data-color='${newTool.color}']`);
            if (targetPair) {
                targetPair.classList.add('selected');
                const targetNote = targetPair.querySelector(`.note[data-type='${newTool.type}']`);
                if (targetNote) targetNote.classList.add('selected');
            }
        }
    });
}