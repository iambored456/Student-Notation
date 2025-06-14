// js/components/Toolbar/rhythmUI.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';

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

    let currentColumn = 2; // Start after the legend columns

    store.state.macrobeatGroupings.forEach((group, index) => {
        const startX = ConfigService.getColumnX(currentColumn);
        const endX = ConfigService.getColumnX(currentColumn + group);
        const centerX = (startX + endX) / 2;

        // Grouping Button (2 or 3)
        const groupingBtn = document.createElement('button');
        groupingBtn.textContent = group;
        groupingBtn.className = 'rhythm-ui-button';
        groupingBtn.style.position = 'absolute';
        groupingBtn.style.left = `${offsetLeft + centerX}px`;
        groupingBtn.style.top = '0px';
        groupingBtn.style.transform = 'translateX(-50%)';
        groupingBtn.addEventListener('click', () => store.toggleMacrobeatGrouping(index));
        container.appendChild(groupingBtn);

        // Boundary Style Button (Solid/Dashed)
        const boundaryBtn = document.createElement('button');
        boundaryBtn.textContent = store.state.macrobeatBoundaryStyles[index] ? '●' : '○';
        boundaryBtn.className = 'rhythm-ui-button';
        boundaryBtn.style.position = 'absolute';
        boundaryBtn.style.left = `${offsetLeft + endX}px`;
        boundaryBtn.style.top = '0px';
        boundaryBtn.style.transform = 'translateX(-50%)'; // Center on the line
        boundaryBtn.addEventListener('click', () => store.toggleMacrobeatBoundaryStyle(index));
        container.appendChild(boundaryBtn);

        currentColumn += group;
    });
}