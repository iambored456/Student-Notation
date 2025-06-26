// js/services/keyboardHandler.js
import store from '../state/store.js';

console.log("KeyboardHandler: Module loaded.");

export function initKeyboardHandler() {
    document.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) {
            return;
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
                console.log("[KeyboardHandler] Emitting 'zoomIn' event.");
                store.emit('zoomIn');
                handled = true;
                break;
            case 'ArrowRight':
                console.log("[KeyboardHandler] Emitting 'zoomOut' event.");
                store.emit('zoomOut');
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault(); 
        }
    });

    console.log("KeyboardHandler: Initialized.");
}