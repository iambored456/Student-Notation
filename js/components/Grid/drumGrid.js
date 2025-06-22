// js/components/Grid/drumGrid.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import CanvasContextService from '../../services/canvasContextService.js';

console.log("DrumGridComponent: Module loaded.");

// --- Private State ---
let drumHoverCtx;
let isRightClickActive = false;

// --- Helper Functions ---
function getColumnIndex(x) {
    let cumulative = 0;
    for (let i = 0; i < store.state.columnWidths.length; i++) {
        cumulative += store.state.columnWidths[i] * store.state.cellWidth;
        if (x < cumulative) return i;
    }
    return store.state.columnWidths.length - 1;
}

function getDrumRowIndex(y) {
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    return Math.floor(y / pitchRowHeight);
}

// --- Drawing Functions ---
function drawDrumShape(ctx, drumRow, x, y, width, height) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const size = Math.min(width, height) * 0.4;
    ctx.beginPath();

    if (drumRow === 0) { // High: Triangle
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx - size, cy + size);
        ctx.lineTo(cx + size, cy + size);
        ctx.closePath();
    } else if (drumRow === 1) { // Mid: Square
        ctx.rect(cx - size, cy - size, 2 * size, 2 * size);
    } else { // Low: Pentagon
        const sides = 5;
        for (let i = 0; i < sides; i++) {
            const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
            const sx = cx + size * Math.cos(angle);
            const sy = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
    }
    ctx.fill();
}

function drawVerticalGridLines(ctx) {
    const totalColumns = store.state.columnWidths.length;
    let macrobeatBoundaries = [];
    let cum = 2;
    store.state.macrobeatGroupings.forEach(group => {
        cum += group;
        macrobeatBoundaries.push(cum);
    });

    for (let i = 0; i <= totalColumns; i++) {
        const x = ConfigService.getColumnX(i);
        let isBoundary = i === 2 || i === totalColumns - 2;
        let isMacrobeatEnd = macrobeatBoundaries.includes(i);
        let style;

        if (isBoundary) {
            style = { lineWidth: 2, strokeStyle: '#dee2e6', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            const boundaryStyle = store.state.macrobeatBoundaryStyles[mbIndex];
            if (boundaryStyle === 'anacrusis') continue;
            style = { lineWidth: 1, strokeStyle: '#dee2e6', dash: boundaryStyle === 'solid' ? [] : [4, 2] };
        } else {
            continue;
        }
        
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ctx.canvas.height);
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.strokeStyle;
        ctx.setLineDash(style.dash);
        ctx.stroke();
    }
    ctx.setLineDash([]);
}

function renderDrumGrid() {
    const ctx = CanvasContextService.getDrumContext();
    if (!ctx || !ctx.canvas) {
        console.error("DrumGridComponent: Drum grid context not available for rendering.");
        return;
    }
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const totalColumns = store.state.columnWidths.length;

    const drumLabels = ['H', 'M', 'L'];
    // FIX: Use the 'Atkinson Hyperlegible' font for consistency.
    ctx.font = `${Math.floor(pitchRowHeight * 0.7)}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6c757d';
    const labelX = ConfigService.getColumnX(1);
    drumLabels.forEach((label, i) => {
        ctx.fillText(label, labelX, i * pitchRowHeight + pitchRowHeight / 2);
    });
    
    for (let i = 0; i < 4; i++) {
        const y = i * pitchRowHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawVerticalGridLines(ctx);

    for (let col = 2; col < totalColumns - 2; col++) {
        const x = ConfigService.getColumnX(col);
        const cellWidth = store.state.columnWidths[col] * store.state.cellWidth;
        
        for (let row = 0; row < 3; row++) {
            const y = row * pitchRowHeight;
            const drumTrack = drumLabels[row];
            
            const drumHit = store.state.placedNotes.find(note => 
                note.isDrum && note.drumTrack === drumTrack && note.startColumnIndex === col
            );

            if (drumHit) {
                ctx.fillStyle = '#212529';
                drawDrumShape(ctx, row, x, y, cellWidth, pitchRowHeight);
            } else {
                ctx.fillStyle = '#e9ecef';
                ctx.beginPath();
                ctx.arc(x + cellWidth / 2, y + pitchRowHeight / 2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// --- Hover Logic ---
function drawHoverHighlight(colIndex, rowIndex, color) {
    if (!drumHoverCtx) return;
    const x = ConfigService.getColumnX(colIndex);
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const y = rowIndex * pitchRowHeight;
    const cellWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    drumHoverCtx.fillStyle = color;
    drumHoverCtx.fillRect(x, y, cellWidth, pitchRowHeight);
}

function drawGhostNote(colIndex, rowIndex) {
    if (!drumHoverCtx) return;
    const x = ConfigService.getColumnX(colIndex);
    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const y = rowIndex * pitchRowHeight;
    const cellWidth = store.state.columnWidths[colIndex] * store.state.cellWidth;
    drumHoverCtx.globalAlpha = 0.4;
    drumHoverCtx.fillStyle = '#212529';
    drawDrumShape(drumHoverCtx, rowIndex, x, y, cellWidth, pitchRowHeight);
    drumHoverCtx.globalAlpha = 1.0;
}

// --- Event Handlers ---
function handleMouseMove(e) {
    const rect = e.target.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const colIndex = getColumnIndex(x);
    const rowIndex = getDrumRowIndex(y);

    if (!drumHoverCtx || colIndex < 2 || colIndex >= store.state.columnWidths.length - 2 || rowIndex < 0 || rowIndex > 2) {
        handleMouseLeave();
        return;
    }

    drumHoverCtx.clearRect(0, 0, drumHoverCtx.canvas.width, drumHoverCtx.canvas.height);
    const drumTrack = ['H', 'M', 'L'][rowIndex];
    
    if (isRightClickActive) {
        store.eraseDrumNoteAt(colIndex, drumTrack);
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
    const colIndex = getColumnIndex(x);
    if (colIndex < 2 || colIndex >= store.state.columnWidths.length - 2) return;
    
    const drumRow = getDrumRowIndex(y);
    if (drumRow < 0 || drumRow > 2) return;
    
    const drumTrack = ['H', 'M', 'L'][drumRow];

    if (e.button === 2) { // Right-click for erasing
        isRightClickActive = true;
        store.eraseDrumNoteAt(colIndex, drumTrack);
        drumHoverCtx.clearRect(0, 0, drumHoverCtx.canvas.width, drumHoverCtx.canvas.height);
        drawHoverHighlight(colIndex, drumRow, 'rgba(220, 53, 69, 0.3)');
        return;
    }

    if (e.button === 0) { // Left-click for placing/toggling
        const drumHit = { 
            isDrum: true, 
            drumTrack: drumTrack, 
            startColumnIndex: colIndex, 
            endColumnIndex: colIndex, 
            color: '#000', 
            shape: drumTrack === 'H' ? 'triangle' : drumTrack === 'M' ? 'square' : 'pentagon' 
        };
        store.toggleDrumNote(drumHit);
        
        // Directly trigger sound for immediate feedback
        if (window.transportService && window.transportService.drumPlayers) {
            window.transportService.drumPlayers.player(drumTrack).start();
        }
    }
}

function handleGlobalMouseUp() {
    isRightClickActive = false;
    handleMouseLeave();
}

// --- Public Interface ---
const DrumGrid = {
    init() {
        const drumCanvas = document.getElementById('drum-grid');
        const hoverCanvas = document.getElementById('drum-hover-canvas');

        if (!drumCanvas || !hoverCanvas) {
            console.error("DrumGridComponent: Could not find required canvas elements for initialization.");
            return;
        }
        drumHoverCtx = hoverCanvas.getContext('2d');

        drumCanvas.addEventListener('mousedown', handleMouseDown);
        drumCanvas.addEventListener('mousemove', handleMouseMove);
        drumCanvas.addEventListener('mouseleave', handleMouseLeave);
        drumCanvas.addEventListener('contextmenu', e => e.preventDefault());
        
        // Listen for global mouseup to cancel right-click dragging
        window.addEventListener('mouseup', handleGlobalMouseUp);

        console.log("DrumGridComponent: Initialized and event listeners attached.");
    },
    
    render() {
        console.log("DrumGridComponent: Render triggered.");
        renderDrumGrid();
    },
    // Expose for external use if needed, e.g., by a tutorial component
    drawDrumShape
};

export default DrumGrid;