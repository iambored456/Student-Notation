// js/components/Toolbar/timeSignatureDisplay.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';

console.log("TimeSignatureDisplay: Module loaded.");

// This module is now purely for rendering. The state is in the store.

function computeTimeSignatureSegments() {
    const segments = [];
    let segmentTotal = 0;
    let currentGridColumn = 2; // Start after legend
    
    store.state.macrobeatGroupings.forEach((value, index) => {
        segmentTotal += value;
        currentGridColumn += value;

        // End a segment if the boundary style is solid or it's the last one
        if (store.state.macrobeatBoundaryStyles[index] === true || index === store.state.macrobeatGroupings.length - 1) {
            const segmentStartX = ConfigService.getColumnX(currentGridColumn - segmentTotal);
            const segmentEndX = ConfigService.getColumnX(currentGridColumn);
            
            segments.push({
                label: `${segmentTotal/2}/4`, // Simplified label for now
                centerX: (segmentStartX + segmentEndX) / 2,
            });
            segmentTotal = 0; // Reset for next segment
        }
    });
    return segments;
}

export function renderTimeSignatureDisplay() {
    const container = document.getElementById('time-signature-display');
    if (!container) return;

    container.innerHTML = '';
    const canvas = document.getElementById('notation-grid');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = canvasRect.left - containerRect.left;

    const segments = computeTimeSignatureSegments();

    segments.forEach(segment => {
        const labelElem = document.createElement('div');
        labelElem.className = 'time-signature-label';
        labelElem.textContent = segment.label;
        labelElem.style.position = 'absolute';
        labelElem.style.left = `${offsetLeft + segment.centerX}px`;
        labelElem.style.transform = 'translateX(-50%)';
        container.appendChild(labelElem);
    });
}