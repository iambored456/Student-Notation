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

    // State for middle mouse button drag
    let isMiddleMouseDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let initialScrollPosition = 0;
    let initialHorizontalScroll = 0;

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

    // Middle mouse button drag for free panning
    scrollContainer.addEventListener('mousedown', (e) => {
        if (e.button === 1) { // Middle mouse button
            e.preventDefault();
            isMiddleMouseDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
            
            // Store initial positions
            const viewportInfo = LayoutService.getViewportInfo();
            initialScrollPosition = viewportInfo.scrollOffset || 0;
            initialHorizontalScroll = scrollContainer.scrollLeft || 0;
            
            // Change cursor to indicate dragging
            scrollContainer.style.cursor = 'grabbing';
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isMiddleMouseDragging) {
            e.preventDefault();
            
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            
            // Apply horizontal scrolling
            scrollContainer.scrollLeft = initialHorizontalScroll - deltaX;
            
            // Apply vertical scrolling using the layout service
            const verticalSensitivity = 1; // Adjust sensitivity as needed
            LayoutService.scroll(-deltaY * verticalSensitivity);
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (e.button === 1 && isMiddleMouseDragging) { // Middle mouse button
            isMiddleMouseDragging = false;
            scrollContainer.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Handle case where mouse leaves the window while dragging
    document.addEventListener('mouseleave', () => {
        if (isMiddleMouseDragging) {
            isMiddleMouseDragging = false;
            scrollContainer.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    console.log("GridScrollHandler: Initialized with wheel listener for zoom and pan, and middle mouse drag.");
}