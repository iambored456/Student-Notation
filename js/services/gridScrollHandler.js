// js/services/gridScrollHandler.js
import store from '../state/index.js';

console.log("GridScrollHandler: Module loaded.");

// --- Configuration ---
const LERP_FACTOR = 0.15;
const COMMIT_DEBOUNCE_MS = 150;

// --- State Variables ---
let scrollableContainer;
let currentY = 0;
let targetY = 0;
let animationFrameId = null;
let commitTimeoutId = null;

function getRowHeight() {
    return store.state.cellHeight * 0.5;
}

function getMaxScrollY() {
    const totalRows = store.state.fullRowData.length;
    const visibleRows = store.state.logicRows;
    if(visibleRows === 0) return 0;
    const maxPosition = totalRows - visibleRows;
    return -maxPosition * getRowHeight();
}

function animate() {
    const distance = targetY - currentY;
    if (Math.abs(distance) < 0.5) {
        currentY = targetY;
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    } else {
        currentY += distance * LERP_FACTOR;
        animationFrameId = requestAnimationFrame(animate);
    }
    
    scrollableContainer.style.transform = `translateY(${currentY}px)`;
}

function handleWheel(e) {
    if (e.deltaY === 0) return;
    e.preventDefault();
    targetY -= e.deltaY;
    targetY = Math.max(getMaxScrollY(), Math.min(0, targetY));
    if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(animate);
    }
    clearTimeout(commitTimeoutId);
    commitTimeoutId = setTimeout(commitScrollPosition, COMMIT_DEBOUNCE_MS);
}

function commitScrollPosition() {
    const rowHeight = getRowHeight();
    if (rowHeight === 0) return;
    const newPosition = Math.round(-targetY / rowHeight);
    store.setGridPosition(newPosition);
}

function syncToStore() {
    const rowHeight = getRowHeight();
    console.log(`[GridScrollHandler] syncToStore called. rowHeight: ${rowHeight}, gridPosition: ${store.state.gridPosition}`);

    if (rowHeight === 0) {
        console.log("[GridScrollHandler] rowHeight is 0, returning early.");
        return;
    }

    const maxScroll = getMaxScrollY();
    const scrollTargetY = -(store.state.gridPosition * rowHeight);

    // THE FIX: Set the target, snap the current position, and cancel any old animation.
    targetY = Math.max(maxScroll, scrollTargetY);
    currentY = targetY; // Snap the animated value to the target

    console.log(`[GridScrollHandler] Applying transform: translateY(${currentY}px)`);

    if (scrollableContainer) {
       scrollableContainer.style.transform = `translateY(${currentY}px)`;
       // If an animation was running, stop it. We've just teleported to the final spot.
       if (animationFrameId) {
           cancelAnimationFrame(animationFrameId);
           animationFrameId = null;
       }
    }
}

export function initGridScrollHandler() {
    scrollableContainer = document.getElementById('grid-container');
    const gridWrapper = document.getElementById('grid-container-wrapper');

    if (!scrollableContainer || !gridWrapper) {
        console.error("GridScrollHandler: Could not find required grid container elements.");
        return;
    }

    gridWrapper.addEventListener('wheel', handleWheel, { passive: false });
    
    store.on('layoutConfigChanged', syncToStore);
    
    syncToStore();
    console.log("GridScrollHandler: Initialized.");
}