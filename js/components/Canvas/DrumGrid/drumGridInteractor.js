// js/components/Canvas/DrumGrid/drumGridInteractor.js
import store from '../../../state/index.js'; // <-- UPDATED PATH
import GridCoordsService from '../../../services/gridCoordsService.js';
import LayoutService from '../../../services/layoutService.js';
import { drawDrumShape } from './drumGridRenderer.js';
import { BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR } from '../../../constants.js';

// --- Interaction State ---
let drumHoverCtx;
let isRightClickActive = false;
let rightClickActionTaken = false;

// --- Hover Drawing Logic ---
function drawHoverHighlight(colIndex, rowIndex, color) {
    if (!drumHoverCtx) return;
    const x = LayoutService.getColumnX(colIndex);
    // FIXED: Use same drum row height calculation as renderer and grid coords
    const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
    const y = rowIndex * drumRowHeight;
    const cellWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    drumHoverCtx.fillStyle = color;
    drumHoverCtx.fillRect(x, y, cellWidth, drumRowHeight);
}

function drawGhostNote(colIndex, rowIndex) {
    if (!drumHoverCtx) return;
    const x = LayoutService.getColumnX(colIndex);
    // FIXED: Use same drum row height calculation as renderer and grid coords
    const drumRowHeight = Math.max(BASE_DRUM_ROW_HEIGHT, DRUM_HEIGHT_SCALE_FACTOR * store.state.cellHeight);
    const y = rowIndex * drumRowHeight;
    const cellWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    drumHoverCtx.globalAlpha = 0.4;
    drumHoverCtx.fillStyle = store.state.selectedTool.color || '#212529';
    drawDrumShape(drumHoverCtx, rowIndex, x, y, cellWidth, drumRowHeight);
    drumHoverCtx.globalAlpha = 1.0;
}

// --- Event Handlers ---
function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Account for horizontal scroll position like harmony analysis grid does
    const scrollLeft = document.getElementById('canvas-container').scrollLeft;
    const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
    const rowIndex = GridCoordsService.getDrumRowIndex(y);
    

    if (!drumHoverCtx || colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || rowIndex < 0 || rowIndex > 2) {
        handleMouseLeave();
        return;
    }

    drumHoverCtx.clearRect(0, 0, drumHoverCtx.canvas.width, drumHoverCtx.canvas.height);
    const drumTrack = ['H', 'M', 'L'][rowIndex];
    
    if (isRightClickActive) {
        if (store.eraseDrumNoteAt(colIndex, drumTrack, false)) {
            rightClickActionTaken = true;
        }
        drawHoverHighlight(colIndex, rowIndex, 'rgba(220, 53, 69, 0.3)');
    } else {
        drawHoverHighlight(colIndex, rowIndex, 'rgba(74, 144, 226, 0.2)');
        drawGhostNote(colIndex, rowIndex);
    }
}

function handleMouseLeave() {
    if (drumHoverCtx) {
        drumHoverCtx.clearRect(0, 0, drumHoverCtx.canvas.width, drumHoverCtx.canvas.height);
    }
}

function handleMouseDown(e) {
    e.preventDefault();
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Account for horizontal scroll position like harmony analysis grid does
    const scrollLeft = document.getElementById('canvas-container').scrollLeft;
    const colIndex = GridCoordsService.getColumnIndex(x + scrollLeft);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;
    
    const drumRow = GridCoordsService.getDrumRowIndex(y);
    if (drumRow < 0 || drumRow > 2) return;
    
    const drumTrack = ['H', 'M', 'L'][drumRow];

    if (e.button === 2) { // Right-click for erasing
        isRightClickActive = true;
        rightClickActionTaken = false;
        document.getElementById('eraser-tool-button')?.classList.add('erasing-active');

        if (store.eraseDrumNoteAt(colIndex, drumTrack, false)) {
            rightClickActionTaken = true;
        }
        drumHoverCtx.clearRect(0, 0, drumHoverCtx.canvas.width, drumHoverCtx.canvas.height);
        drawHoverHighlight(colIndex, drumRow, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) { // Left-click for placing/toggling
        const { color } = store.state.selectedTool;
        const drumHit = { 
            isDrum: true, 
            drumTrack: drumTrack, 
            startColumnIndex: colIndex, 
            endColumnIndex: colIndex, 
            color: color || '#000000',
            shape: drumTrack === 'H' ? 'triangle' : drumTrack === 'M' ? 'square' : 'pentagon' 
        };
        store.toggleDrumNote(drumHit);
        
        if (window.transportService && window.transportService.drumPlayers) {
            window.transportService.drumPlayers.player(drumTrack).start();
        }
    }
}

function handleGlobalMouseUp() {
    if (isRightClickActive) {
        if (rightClickActionTaken) {
            store.recordState();
        }
        isRightClickActive = false;
        rightClickActionTaken = false;
        document.getElementById('eraser-tool-button')?.classList.remove('erasing-active');
    }
    handleMouseLeave();
}

// --- Public Interface ---
export function initDrumGridInteraction() {
    const drumCanvas = document.getElementById('drum-grid');
    const hoverCanvas = document.getElementById('drum-hover-canvas');

    if (!drumCanvas || !hoverCanvas) {
        return;
    }
    drumHoverCtx = hoverCanvas.getContext('2d');

    drumCanvas.addEventListener('mousedown', handleMouseDown);
    drumCanvas.addEventListener('mousemove', handleMouseMove);
    drumCanvas.addEventListener('mouseleave', handleMouseLeave);
    drumCanvas.addEventListener('contextmenu', e => e.preventDefault());
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
}