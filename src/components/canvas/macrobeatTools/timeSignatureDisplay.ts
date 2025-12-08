// js/components/Canvas/MacrobeatTools/timeSignatureDisplay.js
import RhythmService from '@services/rhythmService.ts';
import TimeSignatureService from '@services/timeSignatureService.ts';
import store from '@state/index.ts';

interface DropdownInstance { dropdown: HTMLElement; measureIndex: number }

let dropdownInstance: DropdownInstance | null = null;

export function renderTimeSignatureDisplay(): void {
  const container = document.getElementById('beat-line-button-layer');
  if (!container) {return;}

  // Prefer rendering inside the dedicated time signature row so pointer events work as expected
  const timeSignatureRow = container.querySelector('#time-signature-row') || container;

  // Remove existing time signature labels (but keep rhythm UI buttons)
  const existingLabels = container.querySelectorAll('.time-signature-label');
  existingLabels.forEach(label => label.remove());

  const canvas = document.getElementById('notation-grid') as HTMLCanvasElement | null;
  if (!canvas) {return;}

  const canvasRect = canvas.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offsetLeft = canvasRect.left - containerRect.left;

  const segments = RhythmService.getTimeSignatureSegments() as { label: string; centerX: number; isAnacrusis?: boolean }[];

  segments.forEach((segment, measureIndex) => {
    const labelElem = document.createElement('div');
    labelElem.className = 'time-signature-label';
    if (segment.isAnacrusis) {
      labelElem.classList.add('anacrusis-label');
    }
    labelElem.textContent = segment.label;
    labelElem.style.position = 'absolute';
    labelElem.style.left = `${offsetLeft + segment.startX}px`;
    labelElem.style.width = `${Math.max(0, segment.endX - segment.startX)}px`;
    labelElem.style.transform = 'none';
    labelElem.style.pointerEvents = 'auto';

    labelElem.addEventListener('click', (event) => {
      event.stopPropagation();
      showTimeSignatureDropdown(labelElem, measureIndex);
    });

    timeSignatureRow.appendChild(labelElem);
  });

  ensureDropdownExists();
}

function ensureDropdownExists(): void {
  if (!document.getElementById('time-signature-dropdown')) {
    const dropdownHTML = TimeSignatureService.generateDropdownHTML();
    document.body.insertAdjacentHTML('beforeend', dropdownHTML);

    const dropdown = document.getElementById('time-signature-dropdown');
    dropdown?.addEventListener('click', handleDropdownSelection);
  }
}

function showTimeSignatureDropdown(labelElement: HTMLElement, measureIndex: number): void {
  const dropdown = document.getElementById('time-signature-dropdown');
  if (!dropdown) {return;}

  dropdown.dataset['measureIndex'] = String(measureIndex);

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

function closeDropdownOnOutsideClick(event: MouseEvent): void {
  const dropdown = document.getElementById('time-signature-dropdown');
  const target = event.target as Node | null;
  if (dropdown && target && !dropdown.contains(target)) {
    dropdown.classList.add('hidden');
    dropdownInstance = null;
  }
}

function handleDropdownSelection(event: MouseEvent): void {
  const target = event.target as HTMLElement | null;
  const option = target?.closest('.dropdown-option') as HTMLElement | null;
  if (!option) {return;}

  const groupingsData = option.dataset['groupings'];
  const measureIndex = dropdownInstance?.measureIndex ?? NaN;

  if (!groupingsData || Number.isNaN(measureIndex)) {return;}

  try {
    const groupings = JSON.parse(groupingsData) as number[];
    store.updateTimeSignature(measureIndex, groupings);

    const dropdown = document.getElementById('time-signature-dropdown');
    dropdown?.classList.add('hidden');
    dropdownInstance = null;
  } catch {
    // Silently fail - invalid groupings data
  }
}
