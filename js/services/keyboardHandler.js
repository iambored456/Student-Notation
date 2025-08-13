// js/services/keyboardHandler.js
import store from '../state/index.js';
import logger from '../utils/logger.js';

logger.moduleLoaded('KeyboardHandler', 'keyboard');
export function initKeyboardHandler() {
document.addEventListener('keydown', (e) => {
const activeElement = document.activeElement.tagName.toLowerCase();
if (['input', 'textarea'].includes(activeElement)) {
return;
}
// Handle Ctrl+P for printing
if (e.ctrlKey && e.key.toLowerCase() === 'p') {
    e.preventDefault(); // Prevent browser's default print dialog
    logger.info('KeyboardHandler', 'Ctrl+P pressed. Opening print preview', null, 'keyboard');
    store.emit('printPreviewStateChanged', true);
    return; // Stop further processing for this event
}

let handled = false;
switch (e.key) {
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