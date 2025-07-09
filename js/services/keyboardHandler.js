// js/services/keyboardHandler.js
import store from '../state/index.js';
console.log("KeyboardHandler: Module loaded.");
export function initKeyboardHandler() {
document.addEventListener('keydown', (e) => {
const activeElement = document.activeElement.tagName.toLowerCase();
if (['input', 'textarea'].includes(activeElement)) {
return;
}
// Handle Ctrl+P for printing
if (e.ctrlKey && e.key.toLowerCase() === 'p') {
    e.preventDefault(); // Prevent browser's default print dialog
    console.log("[KeyboardHandler] Ctrl+P pressed. Opening print preview.");
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
        console.log("[KeyboardHandler] Emitting 'zoomOut' event.");
        store.emit('zoomOut');
        handled = true;
        break;
    case 'ArrowRight':
        console.log("[KeyboardHandler] Emitting 'zoomIn' event.");
        store.emit('zoomIn');
        handled = true;
        break;
}

if (handled) {
    e.preventDefault(); 
}
});
console.log("KeyboardHandler: Initialized.");
}