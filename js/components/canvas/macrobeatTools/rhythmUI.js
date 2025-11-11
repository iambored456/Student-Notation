// js/components/Canvas/MacrobeatTools/rhythmUI.js
import store from '../../../state/index.js'; // <-- UPDATED PATH
import RhythmService from '../../../services/rhythmService.js';


export function renderRhythmUI() {

    const groupingContainer = document.getElementById('grouping-buttons-row');
    const boundaryContainer = document.getElementById('boundary-buttons-row');
    if (!groupingContainer || !boundaryContainer) return;

    // Clear existing buttons
    groupingContainer.innerHTML = '';
    boundaryContainer.innerHTML = '';
    const canvas = document.getElementById('notation-grid');
    if (!canvas) {
        return;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = groupingContainer.getBoundingClientRect();
    const offsetLeft = canvasRect.left - containerRect.left;

    // Calculate dynamic button size based on microbeat column width
    // BEAT_COLUMN_WIDTH = 1, so microbeat width = cellWidth * 1
    const microBeatWidth = store.state.cellWidth * 1; // BEAT_COLUMN_WIDTH = 1

    const GROUP_BUTTON_SCALE = 0.8;
    const BOUNDARY_BUTTON_SCALE = 0.64; // 64% of column width for boundary diamonds
    const MIN_GROUP_BUTTON_SIZE = 20; // Minimum 20px for usability
    const MIN_BOUNDARY_BUTTON_SIZE = 18;
    const groupingButtonSize = Math.max(MIN_GROUP_BUTTON_SIZE, microBeatWidth * GROUP_BUTTON_SCALE);
    const boundaryButtonSize = Math.max(MIN_BOUNDARY_BUTTON_SIZE, microBeatWidth * BOUNDARY_BUTTON_SCALE);

    const timeSignatureContainer = document.getElementById('time-signature-row');

    const buttons = RhythmService.getRhythmUIButtons();

    // Ensure rows adopt desired heights: boundary matches diamond, others flex
    if (timeSignatureContainer) {
        timeSignatureContainer.style.height = '';
    }
    groupingContainer.style.height = '';
    boundaryContainer.style.height = `${boundaryButtonSize}px`;
    boundaryContainer.style.minHeight = `${boundaryButtonSize}px`;

    const mapDelimiterStyle = (style) => {
        if (!style) return '';
        if (style === 'solid') return 'solid';
        return 'dashed';
    };

    buttons.forEach((buttonData) => {
        if (buttonData.type === 'grouping') {
            const segmentButton = document.createElement('button');
            segmentButton.type = 'button';
            segmentButton.className = 'grouping-segment';
            segmentButton.dataset.type = 'grouping';
            const segmentStartX = buttonData.startX ?? 0;
            const segmentEndX = buttonData.endX ?? segmentStartX;
            const segmentLeft = offsetLeft + segmentStartX;
            const segmentWidth = Math.max(0, segmentEndX - segmentStartX);
            segmentButton.style.left = `${segmentLeft}px`;
            segmentButton.style.width = `${segmentWidth}px`;
            segmentButton.style.top = '0';
            segmentButton.style.bottom = '0';
            segmentButton.style.fontSize = `${groupingButtonSize * 0.55}px`; // 55% of button size for better readability
            segmentButton.style.zIndex = '10';
            const delimiterStyle = mapDelimiterStyle(buttonData.nextBoundaryStyle);
            if (delimiterStyle) {
                segmentButton.dataset.nextBoundaryStyle = delimiterStyle;
            } else {
                delete segmentButton.dataset.nextBoundaryStyle;
            }
            segmentButton.textContent = String(buttonData.content);
            segmentButton.setAttribute('aria-label', `Cycle grouping size (current: ${buttonData.content})`);
            segmentButton.addEventListener('click', () => store.toggleMacrobeatGrouping(buttonData.index));
            groupingContainer.appendChild(segmentButton);
            return;
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rhythm-ui-button';
        btn.dataset.type = buttonData.type;
        btn.classList.add(`rhythm-ui-button--${buttonData.type}`);

        const boundaryStyle = buttonData.boundaryStyle || 'dashed';
        const finalLeft = offsetLeft + buttonData.x;
        btn.dataset.boundaryStyle = boundaryStyle;
        btn.style.position = 'absolute';
        btn.style.left = `${finalLeft}px`;
        btn.style.transform = 'translateX(-50%)';
        btn.style.top = 'auto';
        btn.style.bottom = '0';
        btn.style.width = `${boundaryButtonSize}px`;
        btn.style.height = `${boundaryButtonSize}px`;

        const labelText = `Cycle boundary style (current: ${boundaryStyle})`;
        btn.setAttribute('aria-label', labelText);
        btn.title = labelText;

        const diamond = document.createElement('span');
        diamond.className = 'boundary-diamond';
        diamond.dataset.style = boundaryStyle;
        diamond.setAttribute('aria-hidden', 'true');
        btn.appendChild(diamond);

        btn.addEventListener('click', () => store.cycleMacrobeatBoundaryStyle(buttonData.index));
        boundaryContainer.appendChild(btn);
    });

    // renderRhythmUI() complete
}
