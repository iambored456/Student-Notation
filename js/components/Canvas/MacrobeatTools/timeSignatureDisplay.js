// js/components/Canvas/MacrobeatTools/timeSignatureDisplay.js
import RhythmService from '../../../services/rhythmService.js'; // Use the new service

console.log("TimeSignatureDisplay: Module loaded.");

export function renderTimeSignatureDisplay() {
    const container = document.getElementById('time-signature-display');
    if (!container) return;

    container.innerHTML = '';
    const canvas = document.getElementById('notation-grid');
    if (!canvas) return;
    
    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = canvasRect.left - containerRect.left;

    const segments = RhythmService.getTimeSignatureSegments();

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