// js/services/gridScrollHandler.js
import LayoutService from './layoutService.js';
import store from '../state/index.js';

/**
 * Initializes the mouse wheel handler for the grid to control zooming and panning.
 */
export function initGridScrollHandler() {
    // We attach the listener to the wrapper that contains the viewport
    const scrollContainer = document.getElementById('pitch-grid-wrapper'); 
    if (!scrollContainer) {
        console.error("GridScrollHandler: Scroll container #pitch-grid-wrapper not found.");
        return;
    }

    scrollContainer.addEventListener('wheel', (e) => {
        // Prevent the default page scroll behavior
        e.preventDefault();

        // Use ctrlKey (Windows/Linux) or metaKey (Mac) for zooming
        if (e.ctrlKey || e.metaKey) {
            if (e.deltaY < 0) {
                store.emit('zoomIn');
            } else {
                store.emit('zoomOut');
            }
        } else {
            // No modifier key means vertical panning (scrolling)
            LayoutService.scroll(e.deltaY);
        }
    }, { passive: false }); // 'passive: false' is required for preventDefault() to work

    console.log("GridScrollHandler: Initialized with wheel listener for zoom and pan.");
}