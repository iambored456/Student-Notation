// js/components/Canvas/MacrobeatTools/rhythmUI.js
import store from '../../../state/index.js'; // <-- UPDATED PATH
import RhythmService from '../../../services/rhythmService.js';


export function renderRhythmUI() {
    console.log('[RHYTHM-UI] renderRhythmUI() called');
    
    const container = document.getElementById('beat-line-controls');
    if (!container) {
        console.warn('[RHYTHM-UI] Container not found');
        return;
    }

    container.innerHTML = '';
    const canvas = document.getElementById('notation-grid');
    if (!canvas) {
        console.warn('[RHYTHM-UI] Canvas not found');
        return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = canvasRect.left - containerRect.left;
    
    console.log('[RHYTHM-UI] Layout info:', {
        canvasRect: { left: canvasRect.left, width: canvasRect.width },
        containerRect: { left: containerRect.left, width: containerRect.width },
        offsetLeft
    });

    const buttons = RhythmService.getRhythmUIButtons();
    console.log('[RHYTHM-UI] Placing', buttons.length, 'buttons');

    buttons.forEach((buttonData, index) => {
        const btn = document.createElement('button');
        btn.textContent = buttonData.content;
        btn.className = 'rhythm-ui-button';
        btn.style.position = 'absolute';
        
        const finalLeft = offsetLeft + buttonData.x;
        btn.style.left = `${finalLeft}px`;
        btn.style.top = `${buttonData.y}px`;
        btn.style.transform = 'translateX(-50%)';
        
        console.log(`[RHYTHM-UI] Button ${index}: type=${buttonData.type}, content="${buttonData.content}", x=${buttonData.x.toFixed(1)}, finalLeft=${finalLeft.toFixed(1)}`);
        
        if (buttonData.type === 'grouping') {
            btn.addEventListener('click', () => store.toggleMacrobeatGrouping(buttonData.index));
        } else {
            btn.addEventListener('click', () => store.cycleMacrobeatBoundaryStyle(buttonData.index));
        }
        
        container.appendChild(btn);
    });
    
    console.log('[RHYTHM-UI] renderRhythmUI() complete');
}