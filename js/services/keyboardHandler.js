// js/services/keyboardHandler.js
import store from '../state/index.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('KeyboardHandler', 'keyboard');
export function initKeyboardHandler() {
document.addEventListener('keydown', (e) => {
const activeElement = document.activeElement;
const tagName = activeElement.tagName.toLowerCase();
const isEditable = activeElement.contentEditable === 'true';
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
    store.undo();
    return;
}

// Handle Ctrl+Y for redo
if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    store.redo();
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

            // Remove notes
            selectedItems.filter(item => item.type === 'note').forEach(item => {
                const index = store.state.placedNotes.findIndex(note =>
                    note.row === item.data.row &&
                    note.columnIndex === item.data.columnIndex &&
                    note.color === item.data.color &&
                    note.shape === item.data.shape
                );
                if (index !== -1) {
                    store.state.placedNotes.splice(index, 1);
                }
            });

            // Remove stamps
            selectedItems.filter(item => item.type === 'stamp').forEach(item => {
                const index = store.state.stampPlacements.findIndex(stamp =>
                    stamp.row === item.data.row &&
                    stamp.column === item.data.column &&
                    stamp.stampId === item.data.stampId
                );
                if (index !== -1) {
                    store.state.stampPlacements.splice(index, 1);
                }
            });

            // Remove triplets
            selectedItems.filter(item => item.type === 'triplet').forEach(item => {
                const index = store.state.tripletPlacements.findIndex(triplet =>
                    triplet.row === item.data.row &&
                    triplet.column === item.data.column &&
                    triplet.tripletId === item.data.tripletId
                );
                if (index !== -1) {
                    store.state.tripletPlacements.splice(index, 1);
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