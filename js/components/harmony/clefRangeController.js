// js/components/harmony/clefRangeController.js
import store from '../../state/index.js';
import { fullRowData as masterRowData } from '../../state/pitchData.js';
import LayoutService from '../../services/layoutService.js';
import logger from '../../utils/logger.js';

const OPTION_HEIGHT = 40;
const SCROLL_STEP = OPTION_HEIGHT;

class WheelPicker {
    constructor(element, options, initialIndex, onChange) {
        this.element = element;
        this.viewportEl = element?.querySelector('.clef-wheel-viewport');
        this.optionsEl = element?.querySelector('.clef-wheel-options');
        this.onChange = onChange;
        this.options = options;
        this.selectedIndex = 0;
        this.pointerActive = false;
        this.pointerId = null;
        this.deltaBuffer = 0;
        this.silent = false;
        this.optionHeight = OPTION_HEIGHT;
        this.resizeObserver = null;
        this.debugLabel = element?.id || 'clef-wheel';

        if (!element || !this.viewportEl || !this.optionsEl) {
            return;
        }

        this.renderOptions();
        this.setIndex(initialIndex, { silent: true });
        this.attachEvents();
        this.observeSize();
    }

    renderOptions() {
        this.optionsEl.innerHTML = '';
        this.optionNodes = this.options.map((option, index) => {
            const optionNode = document.createElement('div');
            optionNode.className = 'clef-wheel-option';
            optionNode.dataset.index = index.toString();
            optionNode.textContent = option.label;
            this.optionsEl.appendChild(optionNode);
            return optionNode;
        });
    }

    attachEvents() {
        this.element.addEventListener('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const delta = Math.sign(event.deltaY);
            if (delta !== 0) {
                this.increment(delta);
            }
        }, { passive: false });

        this.element.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.increment(-1);
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.increment(1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                this.setIndex(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                this.setIndex(this.options.length - 1);
            }
        });

        this.element.addEventListener('pointerdown', (event) => {
            this.pointerActive = true;
            this.pointerId = event.pointerId;
            this.lastPointerY = event.clientY;
            this.deltaBuffer = 0;
            if (typeof this.element.setPointerCapture === 'function') {
                try {
                    this.element.setPointerCapture(this.pointerId);
                } catch (err) {
                    // Ignore if pointer capture is not available for this element
                }
            }
        });

        this.element.addEventListener('pointermove', (event) => {
            if (!this.pointerActive || event.pointerId !== this.pointerId) {
                return;
            }

            const deltaY = event.clientY - this.lastPointerY;
            this.lastPointerY = event.clientY;

            if (deltaY === 0) return;

            this.deltaBuffer += deltaY;
            const step = this.optionHeight || SCROLL_STEP;
            while (Math.abs(this.deltaBuffer) >= step) {
                const direction = Math.sign(this.deltaBuffer);
                this.increment(direction);
                this.deltaBuffer -= direction * step;
            }
        });

        const endPointer = (event) => {
            if (this.pointerActive && event.pointerId === this.pointerId) {
                this.pointerActive = false;
                this.pointerId = null;
                this.deltaBuffer = 0;
                if (this.element.hasPointerCapture(event.pointerId)) {
                    this.element.releasePointerCapture(event.pointerId);
                }
            }
        };

        this.element.addEventListener('pointerup', endPointer);
        this.element.addEventListener('pointercancel', endPointer);
        this.element.addEventListener('pointerleave', (event) => {
            if (this.pointerActive && event.pointerId === this.pointerId) {
                this.pointerActive = false;
                this.pointerId = null;
                this.deltaBuffer = 0;
                if (this.element.hasPointerCapture(event.pointerId)) {
                    this.element.releasePointerCapture(event.pointerId);
                }
            }
        });
    }

    observeSize() {
        if (!this.element) return;

        if (typeof ResizeObserver === 'function') {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    if (entry.target === this.element && entry.contentRect.height > 0) {
                        this.updateVisuals();
                    }
                }
            });
            this.resizeObserver.observe(this.element);
        } else {
            window.addEventListener('resize', () => this.updateVisuals());
        }
    }

    getIndex() {
        return this.selectedIndex;
    }

    increment(step) {
        if (step === 0 || !this.options || this.options.length === 0) {
            return;
        }
        const nextIndex = this.selectedIndex + step;
        this.setIndex(nextIndex);
    }

    setIndex(index, { silent = false } = {}) {
        if (!this.optionsEl) return;

        const clampedIndex = Math.max(0, Math.min(this.options.length - 1, index));
        if (clampedIndex === this.selectedIndex) {
            this.updateVisuals();
            return;
        }

        this.selectedIndex = clampedIndex;
        this.updateVisuals();

        if (!silent && typeof this.onChange === 'function') {
            this.onChange(clampedIndex, this.options[clampedIndex]);
        }
    }

    updateVisuals() {
        if (!this.optionsEl || !this.viewportEl) return;

        const viewportHeight = this.viewportEl.clientHeight || 0;
        const selectedNode = this.optionNodes?.[this.selectedIndex];
        const fallbackNode = this.optionNodes?.[0];
        const optionHeight =
            selectedNode?.offsetHeight ||
            fallbackNode?.offsetHeight ||
            OPTION_HEIGHT;

        this.optionHeight = optionHeight || OPTION_HEIGHT;

        if (this.optionNodes) {
            this.optionNodes.forEach((node, index) => {
                const distance = Math.abs(index - this.selectedIndex);
                const cappedDistance = Math.min(distance, 3);
                node.dataset.distance = String(cappedDistance);
            });
        }

        if (viewportHeight === 0 || optionHeight === 0) {
            return;
        }
        const padding = Math.max(0, (viewportHeight - optionHeight) / 2);
        this.optionsEl.style.paddingTop = `${padding}px`;
        this.optionsEl.style.paddingBottom = `${padding}px`;

        let offset = 0;
        if (selectedNode) {
            const centerOffset = selectedNode.offsetTop + optionHeight / 2;
            offset = (viewportHeight / 2) - centerOffset;
        } else {
            offset = (viewportHeight / 2) - (padding + optionHeight / 2);
        }
        this.optionsEl.style.transform = `translateY(${offset}px)`;

        console.log(`[ClefRangeController] ${this.debugLabel} update`, {
            viewportHeight,
            optionHeight,
            padding,
            selectedIndex: this.selectedIndex,
            centerOffset: selectedNode ? selectedNode.offsetTop + optionHeight / 2 : null,
            offset
        });
    }
}

class ClefRangeController {
    constructor() {
        this.initialized = false;
        this.topPicker = null;
        this.bottomPicker = null;
        this.suppressStoreSync = false;
        this.snapToggle = null;
    }

    init() {
        if (this.initialized) return;

        this.topWheel = document.getElementById('clef-top-wheel');
        this.bottomWheel = document.getElementById('clef-bottom-wheel');
        this.rangeLabel = document.getElementById('clef-range-label');
        this.rangeCount = document.getElementById('clef-range-count');
        this.fullRangeButton = document.getElementById('clef-full-range-button');
        this.trebleButton = document.getElementById('clef-treble-button');
        this.altoButton = document.getElementById('clef-alto-button');
        this.bassButton = document.getElementById('clef-bass-button');
        this.snapToggle = document.getElementById('clef-snap-zoom-toggle');

        if (!this.topWheel || !this.bottomWheel) {
            logger.warn('ClefRangeController', 'Clef tab elements not found; skipping initialization', null, 'ui');
            return;
        }

        this.masterOptions = masterRowData.map((row, index) => ({
            index,
            label: row.pitch,
            toneNote: row.toneNote,
            frequency: row.frequency
        }));

        const initialRange = this.normaliseRange(store.state.pitchRange, this.masterOptions.length);

        this.topPicker = new WheelPicker(
            this.topWheel,
            this.masterOptions,
            initialRange.topIndex,
            (index) => this.handleTopSelection(index)
        );

        this.bottomPicker = new WheelPicker(
            this.bottomWheel,
            this.masterOptions,
            initialRange.bottomIndex,
            (index) => this.handleBottomSelection(index)
        );

        if (this.fullRangeButton) {
            this.fullRangeButton.addEventListener('click', () => this.setPresetRange('full'));
        }

        if (this.trebleButton) {
            this.trebleButton.addEventListener('click', () => this.setPresetRange('treble'));
        }

        if (this.altoButton) {
            this.altoButton.addEventListener('click', () => this.setPresetRange('alto'));
        }

        if (this.bassButton) {
            this.bassButton.addEventListener('click', () => this.setPresetRange('bass'));
        }

        if (this.snapToggle) {
            this.snapToggle.checked = Boolean(store.state.snapZoomToRange);
            this.snapToggle.addEventListener('change', () => {
                const enabled = Boolean(this.snapToggle.checked);
                store.setSnapZoomToRange(enabled);
                if (enabled && LayoutService && typeof LayoutService.snapZoomToCurrentRange === 'function') {
                    LayoutService.snapZoomToCurrentRange();
                }
            });
        }

        store.on('pitchRangeChanged', (range) => {
            this.syncFromStore(range);
        });

        store.on('snapZoomSettingChanged', (enabled) => {
            if (this.snapToggle && this.snapToggle.checked !== enabled) {
                this.snapToggle.checked = enabled;
            }
        });

        this.currentRange = initialRange;
        this.lastTopIndex = initialRange.topIndex;
        this.lastBottomIndex = initialRange.bottomIndex;
        this.updateSummary();
        this.initialized = true;
        logger.moduleLoaded('ClefRangeController', 'ui');
    }

    normaliseRange(range, maxLength) {
        const defaultRange = {
            topIndex: 0,
            bottomIndex: maxLength - 1
        };

        if (!range) return defaultRange;

        const topIndex = Math.max(0, Math.min(maxLength - 1, range.topIndex));
        const bottomIndex = Math.max(topIndex, Math.min(maxLength - 1, range.bottomIndex));

        return { topIndex, bottomIndex };
    }

    handleTopSelection(newTopIndex) {
        const currentBottom = this.bottomPicker.getIndex();
        const nextBottom = Math.max(newTopIndex, currentBottom);

        if (nextBottom !== currentBottom) {
            this.bottomPicker.setIndex(nextBottom, { silent: true });
        }

        this.commitRangeChange(newTopIndex, nextBottom);
    }

    handleBottomSelection(newBottomIndex) {
        const currentTop = this.topPicker.getIndex();
        const nextTop = Math.min(newBottomIndex, currentTop);

        if (nextTop !== currentTop) {
            this.topPicker.setIndex(nextTop, { silent: true });
        }

        this.commitRangeChange(nextTop, newBottomIndex);
    }

    commitRangeChange(topIndex, bottomIndex) {
        const previousRange = this.currentRange || store.state.pitchRange || { topIndex: 0 };
        const normalisedTop = Math.max(0, Math.min(this.masterOptions.length - 1, topIndex));
        const normalisedBottom = Math.max(normalisedTop, Math.min(this.masterOptions.length - 1, bottomIndex));

        if (this.currentRange &&
            this.currentRange.topIndex === normalisedTop &&
            this.currentRange.bottomIndex === normalisedBottom) {
            return;
        }

        let maintainGlobalStart = null;
        if (LayoutService?.getViewportInfo) {
            const viewportInfo = LayoutService.getViewportInfo();
            if (viewportInfo) {
                const currentTop = previousRange.topIndex ?? 0;
                maintainGlobalStart = currentTop + viewportInfo.startRank;
            }
        }

        this.currentRange = { topIndex: normalisedTop, bottomIndex: normalisedBottom };
        this.lastTopIndex = normalisedTop;
        this.lastBottomIndex = normalisedBottom;
        this.updateSummary();

        store.setPitchRange({
            topIndex: normalisedTop,
            bottomIndex: normalisedBottom
        }, { maintainGlobalStart });

        if (LayoutService && typeof LayoutService.snapZoomToCurrentRange === 'function' && store.state.snapZoomToRange) {
            LayoutService.snapZoomToCurrentRange();
        } else if (LayoutService && typeof LayoutService.recalculateLayout === 'function') {
            LayoutService.recalculateLayout();
        }
    }

    syncFromStore(range) {
        if (!this.initialized || !range) return;

        const normalised = this.normaliseRange(range, this.masterOptions.length);
        this.currentRange = normalised;

        if (this.topPicker && this.topPicker.getIndex() !== normalised.topIndex) {
            this.topPicker.setIndex(normalised.topIndex, { silent: true });
        }

        if (this.bottomPicker && this.bottomPicker.getIndex() !== normalised.bottomIndex) {
            this.bottomPicker.setIndex(normalised.bottomIndex, { silent: true });
        }

        this.updateSummary(range.metadata);
    }

    updateSummary(metadata) {
        if (!this.currentRange) return;

        const topRow = this.masterOptions[this.currentRange.topIndex];
        const bottomRow = this.masterOptions[this.currentRange.bottomIndex];
        const count = (this.currentRange.bottomIndex - this.currentRange.topIndex) + 1;

        if (this.rangeLabel) {
            this.rangeLabel.textContent = `${topRow.label} – ${bottomRow.label}`;
        }
        if (this.rangeCount) {
            this.rangeCount.textContent = `${count} ${count === 1 ? 'pitch' : 'pitches'}`;
        }

        if (metadata) {
            const { removedNotes = 0, removedStamps = 0, removedTriplets = 0 } = metadata;
            const totalRemoved = removedNotes + removedStamps + removedTriplets;
            if (totalRemoved > 0) {
                logger.info('ClefRangeController', `Range change removed: ${totalRemoved} items`, metadata, 'ui');
            }
        }
    }

    resetRange() {
        this.topPicker.setIndex(0, { silent: true });
        this.bottomPicker.setIndex(this.masterOptions.length - 1, { silent: true });
        this.commitRangeChange(0, this.masterOptions.length - 1);
    }

    findNoteIndex(noteName) {
        // Find the index of a note by its label (e.g., "C4", "G5", "E3")
        return this.masterOptions.findIndex(opt => opt.label === noteName);
    }

    animateWheelToIndex(picker, targetIndex, duration = 300) {
        // Smoothly animate the wheel from current position to target
        const startIndex = picker.getIndex();
        const distance = targetIndex - startIndex;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentIndex = Math.round(startIndex + (distance * eased));

            picker.setIndex(currentIndex, { silent: progress < 1 });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Final commit with sound enabled
                picker.setIndex(targetIndex);
            }
        };

        requestAnimationFrame(animate);
    }

    setPresetRange(preset) {
        let topNote, bottomNote;

        switch (preset) {
            case 'full':
                // Full range: C8 to C1 (or entire available range)
                this.animateWheelToIndex(this.topPicker, 0);
                this.animateWheelToIndex(this.bottomPicker, this.masterOptions.length - 0);
                return;

            case 'treble':
                // Treble: C4 to G5
                topNote = 'A♭/G♯5';
                bottomNote = 'C4';
                break;

            case 'alto':
                // Alto: E3 to A4
                topNote = 'B♭/A♯4';
                bottomNote = 'E3';
                break;

            case 'bass':
                // Bass: F2 to C4
                topNote = 'D♭/C♯4';
                bottomNote = 'F2';
                break;

            default:
                return;
        }

        const topIndex = this.findNoteIndex(topNote);
        const bottomIndex = this.findNoteIndex(bottomNote);

        if (topIndex === -1 || bottomIndex === -1) {
            logger.warn('ClefRangeController', `Preset notes not found: ${topNote} or ${bottomNote}`, null, 'ui');
            return;
        }

        // Animate both wheels simultaneously
        this.animateWheelToIndex(this.topPicker, topIndex);
        this.animateWheelToIndex(this.bottomPicker, bottomIndex);
    }
}

const controller = new ClefRangeController();
export default controller;
