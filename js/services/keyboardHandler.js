// js/services/keyboardHandler.js
import store from '../state/store.js';
import ConfigService from './configService.js';

console.log("KeyboardHandler: Module loaded.");

export function initKeyboardHandler() {
    document.addEventListener('keydown', (e) => {
        // --- LOGGING: Start of keydown event ---
        console.log(`[Keyboard] Key pressed: ${e.key}`);
        console.log(`[Keyboard] Active element is:`, document.activeElement);

        const activeElement = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea'].includes(activeElement)) {
            console.log("[Keyboard] Event ignored due to active input element.");
            return;
        }

        let handled = false;
        switch (e.key) {
            case 'ArrowUp':
                console.log("[Keyboard] Action: Calling store.shiftGridUp()");
                store.shiftGridUp();
                handled = true;
                break;
            case 'ArrowDown':
                console.log("[Keyboard] Action: Calling store.shiftGridDown()");
                store.shiftGridDown();
                handled = true;
                break;
            case 'ArrowLeft':
                // This matches the UI button with the left arrow for Zoom In
                console.log("[Keyboard] Action: Calling ConfigService.zoomIn()");
                ConfigService.zoomIn();
                handled = true;
                break;
            case 'ArrowRight':
                // This matches the UI button with the right arrow for Zoom Out
                console.log("[Keyboard] Action: Calling ConfigService.zoomOut()");
                ConfigService.zoomOut();
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault(); 
        }
        console.log(`[Keyboard] --- End of event for ${e.key} ---`);
    });

    console.log("KeyboardHandler: Initialized.");
}