// js/components/Canvas/MacrobeatTools/rhythmUI.js
import store from '../../../state/index.js'; // <-- UPDATED PATH
import RhythmService from '../../../services/rhythmService.js';

console.log("RhythmUIComponent: Module loaded.");

export function renderRhythmUI() {
    const container = document.getElementById('beat-line-controls');
    if (!container) return;

    container.innerHTML = '';
    const canvas = document.getElementById('notation-grid');
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = canvasRect.left - containerRect.left;

    const buttons = RhythmService.getRhythmUIButtons();

    buttons.forEach(buttonData => {
        const btn = document.createElement('button');
        btn.textContent = buttonData.content;
        btn.className = 'rhythm-ui-button';
        btn.style.position = 'absolute';
        btn.style.left = `${offsetLeft + buttonData.x}px`;
        btn.style.top = `${buttonData.y}px`;
        btn.style.transform = 'translateX(-50%)';
        
        if (buttonData.type === 'grouping') {
            btn.addEventListener('click', () => store.toggleMacrobeatGrouping(buttonData.index));
        } else {
            btn.addEventListener('click', () => store.cycleMacrobeatBoundaryStyle(buttonData.index));
        }
        
        container.appendChild(btn);
    });
}