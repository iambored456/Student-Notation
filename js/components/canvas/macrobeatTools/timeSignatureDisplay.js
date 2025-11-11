// js/components/Canvas/MacrobeatTools/timeSignatureDisplay.js
import RhythmService from '../../../services/rhythmService.js';
import TimeSignatureService from '../../../services/timeSignatureService.js';
import store from '../../../state/index.js';

let dropdownInstance = null;

export function renderTimeSignatureDisplay() {
    const container = document.getElementById('beat-line-button-layer');
    if (!container) return;

    // Remove existing time signature labels (but keep rhythm UI buttons)
    const existingLabels = container.querySelectorAll('.time-signature-label');
    existingLabels.forEach(label => label.remove());

    const canvas = document.getElementById('notation-grid');
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const offsetLeft = canvasRect.left - containerRect.left;

    const segments = RhythmService.getTimeSignatureSegments();

    segments.forEach((segment, measureIndex) => {
        const labelElem = document.createElement('div');
        labelElem.className = 'time-signature-label';
        if (segment.isAnacrusis) {
            labelElem.classList.add('anacrusis-label');
        }
        labelElem.textContent = segment.label;
        labelElem.style.position = 'absolute';
        labelElem.style.left = `${offsetLeft + segment.centerX}px`;
        labelElem.style.transform = 'translateX(-50%)';

        labelElem.addEventListener('click', (event) => {
            event.stopPropagation();
            showTimeSignatureDropdown(labelElem, measureIndex);
        });

        container.appendChild(labelElem);
    });

    ensureDropdownExists();
}

function ensureDropdownExists() {
    if (!document.getElementById('time-signature-dropdown')) {
        const dropdownHTML = TimeSignatureService.generateDropdownHTML();
        document.body.insertAdjacentHTML('beforeend', dropdownHTML);

        const dropdown = document.getElementById('time-signature-dropdown');
        dropdown.addEventListener('click', handleDropdownSelection);
    }
}

function showTimeSignatureDropdown(labelElement, measureIndex) {
    const dropdown = document.getElementById('time-signature-dropdown');
    if (!dropdown) return;

    dropdown.dataset.measureIndex = measureIndex;

    const labelRect = labelElement.getBoundingClientRect();
    dropdown.style.left = `${labelRect.left}px`;
    dropdown.style.top = `${labelRect.bottom + 5}px`;

    const dropdownRect = dropdown.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (labelRect.left + dropdownRect.width > viewportWidth) {
        dropdown.style.left = `${viewportWidth - dropdownRect.width - 10}px`;
    }

    if (labelRect.bottom + dropdownRect.height > viewportHeight) {
        dropdown.style.top = `${labelRect.top - dropdownRect.height - 5}px`;
    }

    dropdown.classList.remove('hidden');
    dropdownInstance = { dropdown, measureIndex };

    setTimeout(() => {
        document.addEventListener('click', closeDropdownOnOutsideClick, { once: true });
    }, 0);
}

function closeDropdownOnOutsideClick(event) {
    const dropdown = document.getElementById('time-signature-dropdown');
    if (dropdown && !dropdown.contains(event.target)) {
        dropdown.classList.add('hidden');
        dropdownInstance = null;
    }
}

function handleDropdownSelection(event) {
    const option = event.target.closest('.dropdown-option');
    if (!option) return;

    const groupingsData = option.dataset.groupings;
    const measureIndex = parseInt(dropdownInstance?.measureIndex, 10);

    if (!groupingsData || Number.isNaN(measureIndex)) return;

    try {
        const groupings = JSON.parse(groupingsData);
        store.updateTimeSignature(measureIndex, groupings);

        const dropdown = document.getElementById('time-signature-dropdown');
        dropdown.classList.add('hidden');
        dropdownInstance = null;
    } catch (error) {
        // Silently fail - invalid groupings data
    }
}
