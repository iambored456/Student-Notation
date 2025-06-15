// js/components/Toolbar/timeSignatureDisplay.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';

console.log("TimeSignatureDisplay: Module loaded.");

function computeTimeSignatureSegments() {
    const segments = [];
    let segmentMicrobeatTotal = 0;
    let startColumn = 2; // Start after legend
    let isAnacrusisSegment = true;
    // FIX: Add a flag to track if a segment contains a 3-based macrobeat.
    let containsThreeGrouping = false; 

    store.state.macrobeatGroupings.forEach((groupValue, index) => {
        segmentMicrobeatTotal += groupValue;

        // If this macrobeat is 3, set the flag for the current segment.
        if (groupValue === 3) {
            containsThreeGrouping = true;
        }

        const isLastBeat = (index === store.state.macrobeatGroupings.length - 1);
        const isSolidBoundary = (store.state.macrobeatBoundaryStyles[index] === 'solid');

        if (isSolidBoundary || isLastBeat) {
            const segmentStartX = ConfigService.getColumnX(startColumn);
            const segmentEndX = ConfigService.getColumnX(startColumn + segmentMicrobeatTotal);
            
            let label;
            // FIX: Use the new flag to determine the time signature style.
            if (containsThreeGrouping) {
                // If there was a 3, use an 8th-note denominator.
                label = `${segmentMicrobeatTotal}/8`;
            } else {
                // Otherwise, use a 4th-note denominator.
                label = `${segmentMicrobeatTotal / 2}/4`;
            }

            segments.push({
                label: label,
                centerX: (segmentStartX + segmentEndX) / 2,
                isAnacrusis: isAnacrusisSegment,
            });
            
            // Reset for the next segment
            startColumn += segmentMicrobeatTotal;
            segmentMicrobeatTotal = 0; 
            containsThreeGrouping = false; // Reset the flag

            if (isSolidBoundary) {
                isAnacrusisSegment = false; 
            }
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
        if (segment.isAnacrusis) {
            labelElem.classList.add('anacrusis-label');
        }
        labelElem.textContent = segment.label;
        labelElem.style.position = 'absolute';
        labelElem.style.left = `${offsetLeft + segment.centerX}px`;
        labelElem.style.transform = 'translateX(-50%)';
        container.appendChild(labelElem);
    });
}