// js/services/gridScrollHandler.js
import store from '../state/store.js';

console.log("GridScrollHandler: Module loaded.");

// --- Configuration ---
const LERP_FACTOR = 0.15;
const COMMIT_DEBOUNCE_MS = 150;

// --- State Variables ---
let scrollableContainer; // The element we will transform
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
    // BUG FIX: Only process wheel events that have a vertical scroll component.
    // This prevents phantom horizontal scroll/trackpad events from interfering.
    if (e.deltaY === 0) {
        return;
    }

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
    targetY = -store.state.gridPosition * rowHeight;
    currentY = targetY;

    if (scrollableContainer) {
       scrollableContainer.style.transform = `translateY(${currentY}px)`;
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