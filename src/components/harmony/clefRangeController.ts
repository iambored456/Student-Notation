// js/components/harmony/clefRangeController.js
import store from '@state/index.ts';
import { fullRowData as masterRowData } from '@state/pitchData.ts';
import LayoutService from '@services/layoutService.ts';
import logger from '@utils/logger.ts';

interface WheelOption {
  index: number;
  label: string;
  toneNote?: string;
  frequency?: number;
}

interface Range { topIndex: number; bottomIndex: number }

const clefRangeDebugMessages: { level: string; args: unknown[]; timestamp: number }[] = [];

function recordClefRangeDebug(level: string, ...args: unknown[]) {
  clefRangeDebugMessages.push({ level, args, timestamp: Date.now() });
}
const OPTION_HEIGHT = 40;
const SCROLL_STEP = OPTION_HEIGHT;
const MIN_CLEF_RANGE_SEMITONES = 5;

class WheelPicker {
  private element: HTMLElement | null;
  private viewportEl: HTMLElement | null;
  private optionsEl: HTMLElement | null;
  private onChange: ((index: number, option: WheelOption) => void) | null;
  private options: WheelOption[];
  private optionNodes: HTMLElement[] = [];
  private selectedIndex = 0;
  private pointerActive = false;
  private pointerId: number | null = null;
  private lastPointerY = 0;
  private deltaBuffer = 0;
  private silent = false;
  private optionHeight = OPTION_HEIGHT;
  private resizeObserver: ResizeObserver | null = null;
  private debugLabel: string;

  constructor(element: HTMLElement | null, options: WheelOption[], initialIndex: number, onChange: (index: number, option: WheelOption) => void) {
    this.element = element;
    this.viewportEl = element?.querySelector('.clef-wheel-viewport') as HTMLElement | null;
    this.optionsEl = element?.querySelector('.clef-wheel-options') as HTMLElement | null;
    this.onChange = onChange;
    this.options = options;
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
    if (!this.optionsEl) {return;}
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
    if (!this.element) {return;}

    this.element.addEventListener('wheel', (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const delta = Math.sign(event.deltaY);
      if (delta !== 0) {
        this.increment(delta);
      }
    }, { passive: false });

    this.element.addEventListener('keydown', (event: KeyboardEvent) => {
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

    this.element.addEventListener('pointerdown', (event: PointerEvent) => {
      this.pointerActive = true;
      this.pointerId = event.pointerId;
      this.lastPointerY = event.clientY;
      this.deltaBuffer = 0;
      if (typeof this.element.setPointerCapture === 'function') {
        try {
          this.element.setPointerCapture(this.pointerId);
        } catch {
          // Ignore if pointer capture is not available for this element
        }
      }
    });

    this.element.addEventListener('pointermove', (event: PointerEvent) => {
      if (!this.pointerActive || event.pointerId !== this.pointerId) {
        return;
      }

      const deltaY = event.clientY - this.lastPointerY;
      this.lastPointerY = event.clientY;

      if (deltaY === 0) {return;}

      this.deltaBuffer += deltaY;
      const step = this.optionHeight || SCROLL_STEP;
      while (Math.abs(this.deltaBuffer) >= step) {
        const direction = -Math.sign(this.deltaBuffer); // Inverted: drag down = scroll up
        this.increment(direction);
        this.deltaBuffer -= Math.sign(this.deltaBuffer) * step; // Use original sign for buffer
      }
    });

    const endPointer = (event: PointerEvent) => {
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
    this.element.addEventListener('pointerleave', (event: PointerEvent) => {
      if (this.pointerActive && event.pointerId === this.pointerId) {
        this.pointerActive = false;
        this.pointerId = null;
        this.deltaBuffer = 0;
        if (this.element?.hasPointerCapture?.(event.pointerId)) {
          this.element.releasePointerCapture(event.pointerId);
        }
      }
    });
  }

  observeSize() {
    if (!this.element) {return;}

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

  increment(step: number) {
    if (step === 0 || !this.options || this.options.length === 0) {
      return;
    }
    const nextIndex = this.selectedIndex + step;
    this.setIndex(nextIndex);
  }

  setIndex(index: number, { silent = false }: { silent?: boolean } = {}) {
    if (!this.optionsEl) {return;}

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
    if (!this.optionsEl || !this.viewportEl) {return;}

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
  }
}

class ClefRangeController {
  private initialized = false;
  private topPicker: WheelPicker | null = null;
  private bottomPicker: WheelPicker | null = null;
  private suppressStoreSync = false;
  private snapToggle: HTMLElement | null = null;
  private lockToggle: HTMLInputElement | null = null;
  private presetContainer: HTMLElement | null = null;
  private presetButtons: HTMLElement[] = [];
  private activePresetId: string | null = null;
  private presetRanges: Record<string, Range> = {};
  private topWheel: HTMLElement | null = null;
  private bottomWheel: HTMLElement | null = null;
  private rangeLabel: HTMLElement | null = null;
  private rangeCount: HTMLElement | null = null;
  private fullRangeButton: HTMLElement | null = null;
  private trebleButton: HTMLElement | null = null;
  private altoButton: HTMLElement | null = null;
  private bassButton: HTMLElement | null = null;
  private masterOptions: WheelOption[] = [];
  private currentRange: Range | null = null;
  private lastTopIndex = 0;
  private lastBottomIndex = 0;

  init() {
    if (this.initialized) {return;}

    this.topWheel = document.getElementById('clef-top-wheel');
    this.bottomWheel = document.getElementById('clef-bottom-wheel');
    this.rangeLabel = document.getElementById('clef-range-label');
    this.rangeCount = document.getElementById('clef-range-count');
    this.fullRangeButton = document.getElementById('clef-full-range-button');
    this.trebleButton = document.getElementById('clef-treble-button');
    this.altoButton = document.getElementById('clef-alto-button');
    this.bassButton = document.getElementById('clef-bass-button');
    this.lockToggle = document.getElementById('clef-lock-toggle');
    if (!this.lockToggle) {
      logger.warn('ClefRangeController', 'Lock Range toggle not found in DOM', null, 'ui');
    } else {
      logger.info('ClefRangeController', 'Lock Range toggle found', { checked: this.lockToggle.checked }, 'ui');
    }
    this.presetContainer = document.querySelector('.clef-preset-buttons');
    this.presetButtons = Array.from(document.querySelectorAll('.clef-preset-button'));

    if (!this.topWheel || !this.bottomWheel) {
      logger.warn('ClefRangeController', 'Clef tab elements not found; skipping initialization', null, 'ui');
      return;
    }

    // Set up dynamic wheel height calculation
    this.calculateAndSetWheelHeight();
    window.addEventListener('resize', () => this.calculateAndSetWheelHeight());

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

    if (this.lockToggle) {
      const isLocked = store.state.isPitchRangeLocked !== false;
      this.lockToggle.checked = isLocked;
      this.lockToggle.addEventListener('change', () => {
        this.handleLockToggle(this.lockToggle.checked);
      });
    }

    store.on('pitchRangeChanged', (range) => {
      this.syncFromStore(range);
    });

    store.on('pitchRangeLockChanged', (isLocked) => {
      if (this.lockToggle) {
        this.lockToggle.checked = isLocked;
      }
      this.updatePresetStyles();
    });

    this.computePresetRanges();
    this.currentRange = initialRange;
    this.lastTopIndex = initialRange.topIndex;
    this.lastBottomIndex = initialRange.bottomIndex;
    this.updatePresetHighlightFromRange(initialRange);
    this.updateSummary();
    this.initialized = true;
    logger.moduleLoaded('ClefRangeController', 'ui');
  }

  normaliseRange(range: Range | null, maxLength: number): Range {
    const defaultRange = {
      topIndex: 0,
      bottomIndex: Math.max(0, maxLength - 1)
    };

    if (!range) {
      return this.enforceMinimumRange(defaultRange.topIndex, defaultRange.bottomIndex, maxLength);
    }
    const topIndex = Math.max(0, Math.min(maxLength - 1, range.topIndex));
    const bottomIndex = Math.max(topIndex, Math.min(maxLength - 1, range.bottomIndex));

    return this.enforceMinimumRange(topIndex, bottomIndex, maxLength);
  }

  private enforceMinimumRange(topIndex: number, bottomIndex: number, maxLength = this.masterOptions.length): Range {
    const maxIndex = Math.max(0, maxLength - 1);
    const maxTopIndex = Math.max(0, maxIndex - MIN_CLEF_RANGE_SEMITONES);
    const normalizedTop = Math.max(0, Math.min(maxTopIndex, topIndex));
    const minBottomIndex = Math.min(normalizedTop + MIN_CLEF_RANGE_SEMITONES, maxIndex);
    const normalizedBottom = Math.max(minBottomIndex, Math.min(maxIndex, bottomIndex));

    return { topIndex: normalizedTop, bottomIndex: normalizedBottom };
  }

  handleTopSelection(newTopIndex: number) {
    if (!this.topPicker || !this.bottomPicker) {return;}

    const currentBottom = this.bottomPicker.getIndex();
    const { topIndex: constrainedTop, bottomIndex: adjustedBottom } =
      this.enforceMinimumRange(newTopIndex, currentBottom);

    if (constrainedTop !== newTopIndex) {
      this.topPicker.setIndex(constrainedTop, { silent: true });
    }

    if (adjustedBottom !== currentBottom) {
      this.bottomPicker.setIndex(adjustedBottom, { silent: true });
    }

    this.commitRangeChange(constrainedTop, adjustedBottom);
  }

  handleBottomSelection(newBottomIndex: number) {
    if (!this.topPicker || !this.bottomPicker) {return;}

    const currentTop = this.topPicker.getIndex();
    const { topIndex: adjustedTop, bottomIndex: constrainedBottom } =
      this.enforceMinimumRange(currentTop, newBottomIndex);

    if (adjustedTop !== currentTop) {
      this.topPicker.setIndex(adjustedTop, { silent: true });
    }

    if (constrainedBottom !== newBottomIndex) {
      this.bottomPicker.setIndex(constrainedBottom, { silent: true });
    }

    this.commitRangeChange(adjustedTop, constrainedBottom);
  }

  computePresetRanges() {
    const map = {};
    map.full = {
      topIndex: 0,
      bottomIndex: this.masterOptions.length > 0 ? this.masterOptions.length - 1 : 0
    };

    const resolvePreset = (topNote, bottomNote) => {
      const topIndex = this.findNoteIndex(topNote);
      const bottomIndex = this.findNoteIndex(bottomNote);
      if (topIndex === -1 || bottomIndex === -1) {return null;}
      return {
        topIndex: Math.min(topIndex, bottomIndex),
        bottomIndex: Math.max(topIndex, bottomIndex)
      };
    };

    map.treble = resolvePreset('A♭/G♯5', 'C4');
    map.alto = resolvePreset('B♭/A♯4', 'D3');
    map.bass = resolvePreset('D♭/C♯4', 'F2');
    this.presetRanges = map;
  }

  updatePresetHighlightFromRange(range) {
    if (!range) {return;}
    let matchedId = null;
    Object.entries(this.presetRanges || {}).forEach(([id, presetRange]) => {
      if (!presetRange) {return;}
      if (presetRange.topIndex === range.topIndex && presetRange.bottomIndex === range.bottomIndex) {
        matchedId = id;
      }
    });
    // Only highlight when the current range exactly matches a preset
    this.activePresetId = matchedId;
    this.updatePresetStyles();
  }

  updatePresetStyles() {
    const isLocked = store.state.isPitchRangeLocked !== false;
    if (this.presetContainer) {
      this.presetContainer.classList.toggle('locked', isLocked);
    }
    if (!this.presetButtons?.length) {return;}
    this.presetButtons.forEach(btn => {
      const sanitizedId = (btn.dataset?.preset)
        ? btn.dataset.preset
        : (btn.id || '')
          .replace(/^clef-/, '')
          .replace(/-button$/, '')
          .replace(/-range$/, '')
          .replace(/-/g, '');
      const isActive = this.activePresetId && sanitizedId === this.activePresetId;
      btn.classList.toggle('active', Boolean(isActive));
    });
  }

  commitRangeChange(topIndex: number, bottomIndex: number) {
    recordClefRangeDebug('log', `[CommitRange] Called with top=${topIndex}, bottom=${bottomIndex}`);

    const previousRange = this.currentRange || store.state.pitchRange || { topIndex: 0 };
    const maxLength = this.masterOptions.length;
    const maxIndex = Math.max(0, maxLength - 1);
    const normalisedTop = Math.max(0, Math.min(maxIndex, topIndex));
    const normalisedBottom = Math.max(normalisedTop, Math.min(maxIndex, bottomIndex));
    const enforcedRange = this.enforceMinimumRange(normalisedTop, normalisedBottom, maxLength);

    recordClefRangeDebug('log', `[CommitRange] Normalized to top=${normalisedTop}, bottom=${normalisedBottom}`);
    recordClefRangeDebug('log', `[CommitRange] Enforced min range top=${enforcedRange.topIndex}, bottom=${enforcedRange.bottomIndex}`);
    recordClefRangeDebug('log', `[CommitRange] Current range:`, this.currentRange);

    if (this.currentRange?.topIndex === enforcedRange.topIndex &&
            this.currentRange.bottomIndex === enforcedRange.bottomIndex) {
      recordClefRangeDebug('log', `[CommitRange] Range unchanged, skipping commit`);
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

    this.currentRange = enforcedRange;
    this.lastTopIndex = enforcedRange.topIndex;
    this.lastBottomIndex = enforcedRange.bottomIndex;
    this.updateSummary();
    this.updatePresetHighlightFromRange(this.currentRange);

    const isLocked = store.state.isPitchRangeLocked !== false;
    const trimOutsideRange = isLocked;

    if (!isLocked && store.state.snapZoomToRange) {
      store.setSnapZoomToRange(false);
    }

    recordClefRangeDebug('log', `[CommitRange] Setting pitch range in store (trim=${trimOutsideRange})`);
    store.setPitchRange({
      topIndex: enforcedRange.topIndex,
      bottomIndex: enforcedRange.bottomIndex
    }, { maintainGlobalStart, trimOutsideRange, preserveContent: !trimOutsideRange });

    if (isLocked) {
      // Auto-enable snap zoom when user interacts with range controls
      recordClefRangeDebug('log', `[CommitRange] Snap zoom currently: ${store.state.snapZoomToRange}`);
      if (!store.state.snapZoomToRange) {
        recordClefRangeDebug('log', `[CommitRange] Enabling snap zoom`);
        store.setSnapZoomToRange(true);
      }

      recordClefRangeDebug('log', `[CommitRange] Snap zoom now: ${store.state.snapZoomToRange}`);
      if (LayoutService && typeof LayoutService.snapZoomToCurrentRange === 'function' && store.state.snapZoomToRange) {
        recordClefRangeDebug('log', `[CommitRange] Calling snapZoomToCurrentRange`);
        LayoutService.snapZoomToCurrentRange();
      } else if (LayoutService && typeof LayoutService.recalculateLayout === 'function') {
        recordClefRangeDebug('log', `[CommitRange] Calling recalculateLayout (snap zoom not enabled)`);
        LayoutService.recalculateLayout();
      }
    } else {
      // Unlocked: just recalc layout to reflect new slice/zoom if snap is off
      if (LayoutService && typeof LayoutService.recalculateLayout === 'function') {
        LayoutService.recalculateLayout();
      }
    }

    recordClefRangeDebug('log', `[CommitRange] Complete`);
  }

  handleLockToggle(isLocked) {
    const normalized = Boolean(isLocked);
    store.setPitchRangeLock(normalized);

    const targetRange = this.currentRange || this.normaliseRange(store.state.pitchRange, this.masterOptions.length);

    if (normalized) {
      // Re-apply current range as the authoritative locked slice
      this.commitRangeChange(targetRange.topIndex, targetRange.bottomIndex);
    } else {
      // Just disable lock-related behaviors; keep current range/zoom intact
      store.setSnapZoomToRange(false);
      LayoutService.recalculateLayout?.();
    }
  }

  syncFromStore(range) {
    if (!this.initialized || !range) {return;}

    const normalised = this.normaliseRange(range, this.masterOptions.length);
    this.currentRange = normalised;

    if (this.topPicker && this.topPicker.getIndex() !== normalised.topIndex) {
      this.topPicker.setIndex(normalised.topIndex, { silent: true });
    }

    if (this.bottomPicker && this.bottomPicker.getIndex() !== normalised.bottomIndex) {
      this.bottomPicker.setIndex(normalised.bottomIndex, { silent: true });
    }

    this.updateSummary(range.metadata);
    this.updatePresetHighlightFromRange(normalised);
  }

  updateSummary(metadata) {
    if (!this.currentRange) {return;}

    const topRow = this.masterOptions[this.currentRange.topIndex];
    const bottomRow = this.masterOptions[this.currentRange.bottomIndex];
    const count = (this.currentRange.bottomIndex - this.currentRange.topIndex) + 1;

    if (this.rangeLabel) {
      this.rangeLabel.textContent = `${bottomRow.label} — ${topRow.label}`;
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
        // Final commit - ensure we're at target and trigger onChange
        picker.selectedIndex = targetIndex;
        picker.updateVisuals();
        if (typeof picker.onChange === 'function') {
          picker.onChange(targetIndex, picker.options[targetIndex]);
        }
      }
    };

    requestAnimationFrame(animate);
  }

  setPresetRange(preset) {
    let topNote, bottomNote;

    switch (preset) {
      case 'full':
        // Full range: entire master list
        this.activePresetId = preset;
        this.updatePresetStyles();
        this.animateRangeTransition(0, this.masterOptions.length - 1);
        return;

      case 'treble':
        // Treble: C4 to G5
        topNote = 'A♭/G♯5';
        bottomNote = 'C4';
        break;

      case 'alto':
        // Alto: E3 to A4
        topNote = 'B♭/A♯4';
        bottomNote = 'D3';
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

    // Mark this preset as the requested target; actual highlight will clear if final range mismatches
    this.activePresetId = preset;
    this.updatePresetStyles();

    // Animate range transition with synchronized wheels and canvas
    this.animateRangeTransition(topIndex, bottomIndex);
  }

  animateRangeTransition(targetTopIndex, targetBottomIndex, duration = 500) {
    const startTopIndex = this.topPicker.getIndex();
    const startBottomIndex = this.bottomPicker.getIndex();
    const topDistance = targetTopIndex - startTopIndex;
    const bottomDistance = targetBottomIndex - startBottomIndex;
    const startTime = performance.now();
    let frameCount = 0;
    const noMovement = topDistance === 0 && bottomDistance === 0;

    recordClefRangeDebug('log', `[AnimateRange] Starting animation:`, {
      startTop: startTopIndex,
      targetTop: targetTopIndex,
      startBottom: startBottomIndex,
      targetBottom: targetBottomIndex,
      duration,
      noMovement
    });

    // Temporarily disable snap zoom during animation
    const wasSnapEnabled = store.state.snapZoomToRange;
    recordClefRangeDebug('log', `[AnimateRange] Snap zoom was ${wasSnapEnabled ? 'enabled' : 'disabled'}, disabling for animation`);
    if (wasSnapEnabled) {
      store.setSnapZoomToRange(false);
    }

    // Calculate start and target zoom levels
    const startZoom = LayoutService.getCurrentZoomLevel ? LayoutService.getCurrentZoomLevel() : 1.0;
    const targetZoom = this.calculateTargetZoom(targetTopIndex, targetBottomIndex);
    const zoomDistance = targetZoom - startZoom;

    recordClefRangeDebug('log', `[AnimateRange] Zoom animation: ${Math.round(startZoom * 100)}% -> ${Math.round(targetZoom * 100)}%`);

    const isLocked = store.state.isPitchRangeLocked !== false;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out cubic for smooth, natural movement
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Calculate current indices for both wheels
      const currentTopIndex = Math.round(startTopIndex + (topDistance * eased));
      const currentBottomIndex = Math.round(startBottomIndex + (bottomDistance * eased));

      // Calculate current zoom level
      const currentZoom = startZoom + (zoomDistance * eased);

      frameCount++;
      if (frameCount % 10 === 0 || progress === 1) {
        recordClefRangeDebug('log', `[AnimateRange] Frame ${frameCount}: progress=${(progress * 100).toFixed(1)}%, top=${currentTopIndex}, bottom=${currentBottomIndex}, zoom=${Math.round(currentZoom * 100)}%`);
      }

      // Update wheel visuals silently
      this.topPicker.setIndex(currentTopIndex, { silent: true });
      this.bottomPicker.setIndex(currentBottomIndex, { silent: true });

      // Directly update store.state.pitchRange and fullRowData without emitting events
      store.state.pitchRange = {
        topIndex: currentTopIndex,
        bottomIndex: currentBottomIndex
      };

      if (masterRowData && masterRowData.length > 0) {
        store.state.fullRowData = masterRowData.slice(currentTopIndex, currentBottomIndex + 1);
      }

      // Update the controller's internal range tracking and summary display during animation
      this.currentRange = { topIndex: currentTopIndex, bottomIndex: currentBottomIndex };
      this.updateSummary();

      // Update zoom level directly
      if (LayoutService.setZoomLevel) {
        LayoutService.setZoomLevel(currentZoom);
      }

      // Trigger canvas redraw to show the updated range and zoom
      document.dispatchEvent(new CustomEvent('canvasResized', {
        detail: { source: 'clefRangeAnimation' }
      }));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - finalize everything properly
        recordClefRangeDebug('log', `[AnimateRange] Animation complete, finalizing at top=${targetTopIndex}, bottom=${targetBottomIndex}`);

        // Force final positions
        this.topPicker.selectedIndex = targetTopIndex;
        this.bottomPicker.selectedIndex = targetBottomIndex;
        this.topPicker.updateVisuals();
        this.bottomPicker.updateVisuals();

        // Update the controller's internal range tracking
        this.currentRange = { topIndex: targetTopIndex, bottomIndex: targetBottomIndex };
        this.lastTopIndex = targetTopIndex;
        this.lastBottomIndex = targetBottomIndex;
        this.updateSummary();
        this.updatePresetHighlightFromRange(this.currentRange);

        if (isLocked) {
          // Now properly commit the range change through the normal flow
          recordClefRangeDebug('log', `[AnimateRange] Committing final range change through setPitchRange`);
          store.setPitchRange({
            topIndex: targetTopIndex,
            bottomIndex: targetBottomIndex
          });

          // Re-enable snap zoom (but don't trigger it since we already animated to the target)
          recordClefRangeDebug('log', `[AnimateRange] Re-enabling snap zoom`);
          store.setSnapZoomToRange(true);
        } else {
          // Unlocked: commit range without trimming so state/UI stay in sync
          recordClefRangeDebug('log', `[AnimateRange] Committing view-only range change (unlocked)`);
          store.setSnapZoomToRange(false);
          store.setPitchRange({
            topIndex: targetTopIndex,
            bottomIndex: targetBottomIndex
          }, { trimOutsideRange: false, preserveContent: true });
        }

        recordClefRangeDebug('log', `[AnimateRange] Animation fully complete`);
      }
    };

    requestAnimationFrame(animate);
  }

  calculateTargetZoom(topIndex, bottomIndex) {
    // Calculate what zoom level would be needed to fit this range
    const totalRanks = bottomIndex - topIndex + 1;
    if (totalRanks === 0) {return 1.0;}

    const pitchGridContainer = document.getElementById('pitch-grid-container');
    const containerHeight = pitchGridContainer?.clientHeight || (window.innerHeight * 0.7);

    if (!containerHeight || containerHeight <= 0) {return 1.0;}

    const BASE_ABSTRACT_UNIT = 30;
    const requiredZoom = (2 * containerHeight) / (totalRanks * BASE_ABSTRACT_UNIT);

    // Clamp between min and max zoom levels
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 5.0;
    return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, requiredZoom));
  }

  applyViewPresetRange(topIndex, bottomIndex) {
    const targetZoom = this.calculateTargetZoom(topIndex, bottomIndex);

    if (LayoutService.setPendingStartRow) {
      LayoutService.setPendingStartRow(topIndex);
    }

    if (LayoutService.setZoomLevel) {
      LayoutService.setZoomLevel(targetZoom);
    } else if (LayoutService.recalculateLayout) {
      LayoutService.recalculateLayout();
    }
  }

  refreshWheelVisuals() {
    // Force wheel pickers to update their visuals
    // This is useful when the tab becomes visible after being hidden
    if (this.topPicker) {
      this.topPicker.updateVisuals();
    }
    if (this.bottomPicker) {
      this.bottomPicker.updateVisuals();
    }
  }

  calculateAndSetWheelHeight() {
    // Find the wheels section and its title
    const wheelsSection = document.querySelector('.range-panel-section.wheels-section')!;
    const sectionTitle = wheelsSection?.querySelector('.panel-section-title')!;

    if (!wheelsSection || !this.topWheel || !this.bottomWheel) {
      return;
    }

    // Calculate available height
    const sectionHeight = wheelsSection.clientHeight;
    const titleHeight = sectionTitle?.offsetHeight || 0;
    const gap = 15; // Approximate gap from CSS (var(--space-015))

    // Calculate wheel height: section height - title height - gap between title and wheels
    const calculatedHeight = sectionHeight - titleHeight - gap;

    // Set minimum height of 120px, maximum of calculated height
    const wheelHeight = Math.max(120, Math.min(calculatedHeight, 300));

    // Set CSS custom property on both wheels
    this.topWheel.style.setProperty('--clef-wheel-height', `${wheelHeight}px`);
    this.bottomWheel.style.setProperty('--clef-wheel-height', `${wheelHeight}px`);

    // Trigger visual update for pickers
    setTimeout(() => {
      this.topPicker?.updateVisuals();
      this.bottomPicker?.updateVisuals();
    }, 0);
  }
}

const controller = new ClefRangeController();
export default controller;


export function getClefRangeDebugMessages() {
  return clefRangeDebugMessages.slice();
}
