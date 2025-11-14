// js/bootstrap/rhythm/initRhythmUi.js
export function initRhythmUi() {
    initRhythmTabs();
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
