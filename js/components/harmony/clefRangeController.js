// js/components/harmony/clefRangeController.js
import store from '@state/index.js';
import { fullRowData as masterRowData } from '@state/pitchData.js';
import LayoutService from '@services/layoutService.js';
const clefRangeDebugMessages = [];

function recordClefRangeDebug(level, ...args) {
  clefRangeDebugMessages.push({ level, args, timestamp: Date.now() });
}
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
        } catch {
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

      if (deltaY === 0) {return;}

      this.deltaBuffer += deltaY;
      const step = this.optionHeight || SCROLL_STEP;
      while (Math.abs(this.deltaBuffer) >= step) {
        const direction = -Math.sign(this.deltaBuffer); // Inverted: drag down = scroll up
        this.increment(direction);
        this.deltaBuffer -= Math.sign(this.deltaBuffer) * step; // Use original sign for buffer
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

  increment(step) {
    if (step === 0 || !this.options || this.options.length === 0) {
      return;
    }
    const nextIndex = this.selectedIndex + step;
    this.setIndex(nextIndex);
  }

  setIndex(index, { silent = false } = {}) {
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
  constructor() {
    this.initialized = false;
    this.topPicker = null;
    this.bottomPicker = null;
    this.suppressStoreSync = false;
    this.snapToggle = null;
    this.lockToggle = null;
    this.presetContainer = null;
    this.presetButtons = [];
    this.activePresetId = null;
    this.presetRanges = {};
  }

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

  normaliseRange(range, maxLength) {
    const defaultRange = {
      topIndex: 0,
      bottomIndex: maxLength - 1
    };

    if (!range) {return defaultRange;}

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

  commitRangeChange(topIndex, bottomIndex) {
    recordClefRangeDebug('log', `[CommitRange] Called with top=${topIndex}, bottom=${bottomIndex}`);

    const previousRange = this.currentRange || store.state.pitchRange || { topIndex: 0 };
    const normalisedTop = Math.max(0, Math.min(this.masterOptions.length - 1, topIndex));
    const normalisedBottom = Math.max(normalisedTop, Math.min(this.masterOptions.length - 1, bottomIndex));

    recordClefRangeDebug('log', `[CommitRange] Normalized to top=${normalisedTop}, bottom=${normalisedBottom}`);
    recordClefRangeDebug('log', `[CommitRange] Current range:`, this.currentRange);

    if (this.currentRange &&
            this.currentRange.topIndex === normalisedTop &&
            this.currentRange.bottomIndex === normalisedBottom) {
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

    this.currentRange = { topIndex: normalisedTop, bottomIndex: normalisedBottom };
    this.lastTopIndex = normalisedTop;
    this.lastBottomIndex = normalisedBottom;
    this.updateSummary();
    this.updatePresetHighlightFromRange(this.currentRange);

    const isLocked = store.state.isPitchRangeLocked !== false;
    const trimOutsideRange = isLocked;

    if (!isLocked && store.state.snapZoomToRange) {
      store.setSnapZoomToRange(false);
    }

    recordClefRangeDebug('log', `[CommitRange] Setting pitch range in store (trim=${trimOutsideRange})`);
    store.setPitchRange({
      topIndex: normalisedTop,
      bottomIndex: normalisedBottom
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
      this.rangeLabel.textContent = `${topRow.label} — ${bottomRow.label}`;
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
}

const controller = new ClefRangeController();
export default controller;


export function getClefRangeDebugMessages() {
  return clefRangeDebugMessages.slice();
}





