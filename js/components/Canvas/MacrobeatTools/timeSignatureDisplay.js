// js/components/Canvas/MacrobeatTools/timeSignatureDisplay.js
import RhythmService from '../../../services/rhythmService.js';
import TimeSignatureService from '../../../services/timeSignatureService.js';
import store from '../../../state/index.js';

console.log("TimeSignatureDisplay: Module loaded.");

let dropdownInstance = null;

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
        
        // Add click handler for dropdown
        labelElem.addEventListener('click', (e) => {
            e.stopPropagation();
            showTimeSignatureDropdown(e.target, measureIndex);
        });
        
        container.appendChild(labelElem);
    });

    // Ensure dropdown exists in DOM
    ensureDropdownExists();
}

function ensureDropdownExists() {
    if (!document.getElementById('time-signature-dropdown')) {
        const dropdownHTML = TimeSignatureService.generateDropdownHTML();
        document.body.insertAdjacentHTML('beforeend', dropdownHTML);
        
        // Add click handlers to dropdown options
        const dropdown = document.getElementById('time-signature-dropdown');
        dropdown.addEventListener('click', handleDropdownSelection);
    }
}

function showTimeSignatureDropdown(labelElement, measureIndex) {
    const dropdown = document.getElementById('time-signature-dropdown');
    if (!dropdown) return;

    // Store the measure index for later use
    dropdown.dataset.measureIndex = measureIndex;

    // Position dropdown near the clicked label
    const labelRect = labelElement.getBoundingClientRect();
    dropdown.style.left = `${labelRect.left}px`;
    dropdown.style.top = `${labelRect.bottom + 5}px`;
    
    // Adjust if dropdown would go off-screen
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

    // Close dropdown when clicking elsewhere
    setTimeout(() => {
        document.addEventListener('click', closeDropdownOnOutsideClick, { once: true });
    }, 0);
}

function closeDropdownOnOutsideClick(e) {
    const dropdown = document.getElementById('time-signature-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
        dropdownInstance = null;
    }
}

function handleDropdownSelection(e) {
    const option = e.target.closest('.dropdown-option');
    if (!option) return;

    const groupingsData = option.dataset.groupings;
    const measureIndex = parseInt(dropdownInstance?.measureIndex);
    
    if (!groupingsData || isNaN(measureIndex)) return;

    try {
        const groupings = JSON.parse(groupingsData);
        store.updateTimeSignature(measureIndex, groupings);
        
        // Close dropdown
        const dropdown = document.getElementById('time-signature-dropdown');
        dropdown.classList.add('hidden');
        dropdownInstance = null;
        
    } catch (error) {
        console.error('Error parsing time signature groupings:', error);
    }
}