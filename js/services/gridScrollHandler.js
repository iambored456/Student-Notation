// js/services/gridScrollHandler.js
import LayoutService from './layoutService.js';
import ScrollSyncService from './scrollSyncService.js';
import store from '../state/index.js';
import logger from '../utils/logger.js';

/**
 * Initializes the mouse wheel handler for the grid to control zooming and panning.
 */
export function initGridScrollHandler() {
    // We attach the listener to the wrapper that contains the viewport
    const scrollContainer = document.getElementById('pitch-grid-wrapper'); 
    if (!scrollContainer) {
        logger.error('GridScrollHandler', 'Scroll container #pitch-grid-wrapper not found', null, 'scroll');
        return;
    }

    // State for middle mouse button drag
    let isMiddleMouseDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let currentHorizontalOffset = 0;

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
            
            // Change cursor to indicate dragging
            scrollContainer.style.cursor = 'grabbing';
            
            // Prevent text selection during drag
            document.body.style.userSelect = 'none';
        }
    });

    document.addEventListener('mousemove', (e) => {
        if (isMiddleMouseDragging) {
            e.preventDefault();
            
            // Calculate movement delta
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            
            // Handle vertical scrolling through LayoutService (for proper grid virtualization)
            if (deltaY !== 0) {
                LayoutService.scrollByPixels(deltaY, 0);
            }
            
            // Handle horizontal scrolling with CSS transforms (to avoid cursor offset issues)
            if (deltaX !== 0) {
                currentHorizontalOffset += deltaX; // Natural drag behavior
                
                // Apply transform to all grid containers that should move together
                const containersToMove = [
                    'pitch-grid-container',
                    'drum-grid-wrapper', 
                    'harmonyAnalysisGrid',
                    'time-signature-display',
                    'canvas-macrobeat-tools'
                ];
                
                containersToMove.forEach(id => {
                    const container = document.getElementById(id);
                    if (container) {
                        container.style.transform = `translateX(${currentHorizontalOffset}px)`;
                    }
                });
                
                console.log('🔄 Horizontal transform applied:', currentHorizontalOffset);
            }
            
            // Update last mouse position for next frame
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
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

    logger.info('GridScrollHandler', 'Initialized with wheel listener for zoom and pan, and middle mouse drag', null, 'scroll');
}