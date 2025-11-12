// js/components/canvas/macrobeatTools/rhythmUI.js
import store from '@state/index.js';
import RhythmService from '@services/rhythmService.js';
import logger from '@utils/logger.js';

const RHYTHM_UI_ATTR = 'data-rhythm-ui-element';

const formatPx = (value) => `${Math.round(value * 100) / 100}px`;

const clearExistingElements = (container) => {
    container
        .querySelectorAll(`[${RHYTHM_UI_ATTR}]`)
        .forEach(element => element.remove());
};

const getCanvasOffset = (container) => {
    const canvas = document.getElementById('notation-grid');
    if (!canvas) {
        return null;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (canvasRect.width === 0) {
        return null;
    }

    return canvasRect.left - containerRect.left;
};

const createGroupingSegment = (grouping, offsetLeft) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'grouping-segment';
    element.dataset.rhythmUiElement = 'grouping';
    element.dataset.index = grouping.index;
    element.textContent = grouping.content;
    element.style.left = formatPx(offsetLeft + grouping.startX);
    element.style.width = formatPx(Math.max(0, grouping.endX - grouping.startX));

    if (grouping.nextBoundaryStyle) {
        element.dataset.nextBoundaryStyle = grouping.nextBoundaryStyle;
    } else {
        element.removeAttribute('data-next-boundary-style');
    }

    element.setAttribute(
        'aria-label',
        `Toggle macrobeat grouping (${grouping.content}) at position ${grouping.index + 1}`
    );

    element.addEventListener('click', (event) => {
        event.stopPropagation();
        store.toggleMacrobeatGrouping(grouping.index);
    });

    return element;
};

const createBoundaryButton = (boundary, offsetLeft) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rhythm-ui-button rhythm-ui-button--boundary';
    button.dataset.rhythmUiElement = 'boundary';
    button.dataset.index = boundary.index;
    button.style.left = formatPx(offsetLeft + boundary.x);
    button.setAttribute('aria-label', 'Cycle boundary style');

    const diamond = document.createElement('span');
    diamond.className = 'boundary-diamond';
    diamond.dataset.style = boundary.boundaryStyle || 'dashed';
    button.appendChild(diamond);

    button.addEventListener('click', (event) => {
        event.stopPropagation();
        store.cycleMacrobeatBoundaryStyle(boundary.index);
    });

    return button;
};

export function renderRhythmUI() {
    const container = document.getElementById('beat-line-button-layer');
    if (!container) {
        logger.warn('rhythmUI', 'Cannot render rhythm UI without beat-line container', null, 'ui');
        return;
    }

    const offsetLeft = getCanvasOffset(container);
    if (offsetLeft === null) {
        return;
    }

    const timeRow = container.querySelector('#time-signature-row');
    const groupingRow = container.querySelector('#grouping-buttons-row');
    const boundaryRow = container.querySelector('#boundary-buttons-row');
    clearExistingElements(container);

    const layoutButtons = RhythmService.getRhythmUIButtons();
    if (!Array.isArray(layoutButtons) || layoutButtons.length === 0) {
        return;
    }

    const groupingFragment = document.createDocumentFragment();
    const boundaryFragment = document.createDocumentFragment();

    let groupingCount = 0;
    let boundaryCount = 0;

    layoutButtons.forEach((buttonDescriptor) => {
        if (buttonDescriptor.type === 'grouping') {
            groupingFragment.appendChild(createGroupingSegment(buttonDescriptor, offsetLeft));
            groupingCount += 1;
        } else if (buttonDescriptor.type === 'boundary') {
            boundaryFragment.appendChild(createBoundaryButton(buttonDescriptor, offsetLeft));
            boundaryCount += 1;
        }
    });

    if (groupingRow) {
        groupingRow.appendChild(groupingFragment);
    } else {
        container.appendChild(groupingFragment);
    }

    if (boundaryRow) {
        boundaryRow.appendChild(boundaryFragment);
    } else {
        container.appendChild(boundaryFragment);
    }
}
