// js/services/keyboardHandler.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import type { PlacedNote, StampPlacement, TripletPlacement } from '../../types/state.js';

logger.moduleLoaded('KeyboardHandler', 'keyboard');
export function initKeyboardHandler(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const activeElement = document.activeElement;
    if (!activeElement) {return;}

    const tagName = activeElement.tagName.toLowerCase();
    const isEditable = (activeElement as HTMLElement).contentEditable === 'true';
    if (['input', 'textarea'].includes(tagName) || isEditable) {
      return;
    }
    // Handle Ctrl+P for printing
    if (e.ctrlKey && e.key.toLowerCase() === 'p') {
      e.preventDefault(); // Prevent browser's default print dialog
      logger.info('KeyboardHandler', 'Ctrl+P pressed. Opening print preview', null, 'keyboard');
      store.emit('printPreviewStateChanged', true);
      return; // Stop further processing for this event
    }

    // Handle Ctrl+Z for undo
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      (store as { undo: () => void }).undo();
      return;
    }

    // Handle Ctrl+Y for redo
    if (e.ctrlKey && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      (store as { redo: () => void }).redo();
      return;
    }

    let handled = false;
    switch (e.key) {
      case 'Escape':
        // Deselect lasso selection
        if (store.state.lassoSelection?.isActive) {
          store.state.lassoSelection = {
            selectedItems: [],
            convexHull: null,
            isActive: false
          };
          store.emit('lassoSelectionCleared');
          store.emit('render');
          handled = true;
          logger.debug('KeyboardHandler', 'Lasso selection cleared (Escape)', null, 'keyboard');
        }
        break;
      case 'Enter':
        // Also deselect lasso selection
        if (store.state.lassoSelection?.isActive) {
          store.state.lassoSelection = {
            selectedItems: [],
            convexHull: null,
            isActive: false
          };
          store.emit('lassoSelectionCleared');
          store.emit('render');
          handled = true;
          logger.debug('KeyboardHandler', 'Lasso selection cleared (Enter)', null, 'keyboard');
        }
        break;
      case 'Backspace':
      case 'Delete':
        // Delete all items in lasso selection
        if (store.state.lassoSelection?.isActive) {
          const selectedItems = store.state.lassoSelection.selectedItems;

          selectedItems.forEach(item => {
            if (item.type === 'note') {
              const noteData = item.data as PlacedNote;
              const noteIndex = store.state.placedNotes.findIndex(note => note.uuid === noteData.uuid);
              if (noteIndex !== -1) {
                store.state.placedNotes.splice(noteIndex, 1);
              }
            } else if (item.type === 'stamp') {
              const stampData = item.data as StampPlacement;
              const stampIndex = store.state.stampPlacements.findIndex(stamp => stamp.id === stampData.id);
              if (stampIndex !== -1) {
                store.state.stampPlacements.splice(stampIndex, 1);
              }
            } else if (item.type === 'triplet') {
              const tripletData = item.data as TripletPlacement;
              const tripletIndex = store.state.tripletPlacements.findIndex(triplet => triplet.id === tripletData.id);
              if (tripletIndex !== -1) {
                store.state.tripletPlacements.splice(tripletIndex, 1);
              }
            }
          });

          // Clear selection
          store.state.lassoSelection = {
            selectedItems: [],
            convexHull: null,
            isActive: false
          };

          // Record state and render
          store.recordState();
          store.emit('render');
          handled = true;
          logger.info('KeyboardHandler', `Deleted ${selectedItems.length} items from lasso selection`, null, 'keyboard');
        }
        break;
      case 'ArrowUp':
        store.shiftGridUp();
        handled = true;
        break;
      case 'ArrowDown':
        store.shiftGridDown();
        handled = true;
        break;
      case 'ArrowLeft':
        logger.debug('KeyboardHandler', "Emitting 'zoomOut' event", null, 'keyboard');
        store.emit('zoomOut');
        handled = true;
        break;
      case 'ArrowRight':
        logger.debug('KeyboardHandler', "Emitting 'zoomIn' event", null, 'keyboard');
        store.emit('zoomIn');
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
    }
  });
  logger.info('KeyboardHandler', 'Initialized', null, 'keyboard');
}
