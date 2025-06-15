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

        // FIX: Only create a boundary style button if it's NOT the last one.
        if (index < store.state.macrobeatGroupings.length - 1) {
            // Boundary Style Button (Solid/Dashed/Anacrusis)
            const boundaryBtn = document.createElement('button');
            const style = store.state.macrobeatBoundaryStyles[index];
            
            switch (style) {
                case 'solid':
                    boundaryBtn.textContent = '●';
                    break;
                case 'anacrusis':
                    boundaryBtn.textContent = 'x';
                    break;
                default: // 'dashed'
                    boundaryBtn.textContent = '○';
                    break;
            }

            boundaryBtn.className = 'rhythm-ui-button';
            boundaryBtn.style.position = 'absolute';
            boundaryBtn.style.left = `${offsetLeft + endX}px`;
            boundaryBtn.style.top = '22px';
            boundaryBtn.style.transform = 'translateX(-50%)'; // Center on the line
            boundaryBtn.addEventListener('click', () => store.cycleMacrobeatBoundaryStyle(index));
            container.appendChild(boundaryBtn);
        }

        currentColumn += group;
    });
}