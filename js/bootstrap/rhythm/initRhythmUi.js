// js/bootstrap/rhythm/initRhythmUi.js
import store from '@state/index.js';

export function initRhythmUi() {
    initRhythmTabs();
    initAccidentalButtons();
}

function initRhythmTabs() {
    const buttons = document.querySelectorAll('.rhythm-tab-button');
    const panels = document.querySelectorAll('.rhythm-tab-panel');

    if (!buttons.length || !panels.length) {
        return;
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-rhythm-tab');

            buttons.forEach(btn => btn.classList.remove('active'));
            panels.forEach(panel => panel.classList.remove('active'));

            button.classList.add('active');
            const targetPanel = document.getElementById(`${targetTab}-panel`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });
}

function initAccidentalButtons() {
    const flatBtn = document.getElementById('flat-toggle-btn');
    const sharpBtn = document.getElementById('sharp-toggle-btn');
    const hzBtn = document.getElementById('hz-toggle-btn');

    if (!flatBtn || !sharpBtn || !hzBtn) {
        return;
    }

    let savedFlatState = flatBtn.classList.contains('active');
    let savedSharpState = sharpBtn.classList.contains('active');

    hzBtn.addEventListener('click', () => {
        const isHzActive = hzBtn.classList.contains('active');

        if (isHzActive) {
            hzBtn.classList.remove('active');
            hzBtn.setAttribute('aria-pressed', 'false');
            flatBtn.classList.toggle('active', savedFlatState);
            flatBtn.setAttribute('aria-pressed', savedFlatState);
            sharpBtn.classList.toggle('active', savedSharpState);
            sharpBtn.setAttribute('aria-pressed', savedSharpState);
            store.state.showFrequencyLabels = false;
        } else {
            savedFlatState = flatBtn.classList.contains('active');
            savedSharpState = sharpBtn.classList.contains('active');

            hzBtn.classList.add('active');
            hzBtn.setAttribute('aria-pressed', 'true');
            flatBtn.classList.remove('active');
            flatBtn.setAttribute('aria-pressed', 'false');
            sharpBtn.classList.remove('active');
            sharpBtn.setAttribute('aria-pressed', 'false');
            store.state.showFrequencyLabels = true;
        }

        store.emit('layoutConfigChanged');
    });

    flatBtn.addEventListener('click', () => {
        const hzActive = hzBtn.classList.contains('active');
        if (hzActive) {
            hzBtn.classList.remove('active');
            hzBtn.setAttribute('aria-pressed', 'false');
            store.state.showFrequencyLabels = false;
        }

        const nextState = !flatBtn.classList.contains('active');
        flatBtn.classList.toggle('active', nextState);
        flatBtn.setAttribute('aria-pressed', nextState);
        savedFlatState = nextState;
        store.emit('layoutConfigChanged');
    });

    sharpBtn.addEventListener('click', () => {
        const hzActive = hzBtn.classList.contains('active');
        if (hzActive) {
            hzBtn.classList.remove('active');
            hzBtn.setAttribute('aria-pressed', 'false');
            store.state.showFrequencyLabels = false;
        }

        const nextState = !sharpBtn.classList.contains('active');
        sharpBtn.classList.toggle('active', nextState);
        sharpBtn.setAttribute('aria-pressed', nextState);
        savedSharpState = nextState;
        store.emit('layoutConfigChanged');
    });
}
