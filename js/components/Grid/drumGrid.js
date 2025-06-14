// js/components/Grid/drumGrid.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';

console.log("DrumGridComponent: Module loaded.");

// Helper function to draw a specific drum shape.
function drawDrumShape(ctx, drumRow, x, y, width, height) {
    const cx = x + width / 2;
    const cy = y + height / 2;
    const size = Math.min(width, height) * 0.4; // Slightly smaller for better spacing
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


function renderDrumGrid() {
    const ctx = window.drumGridCtx;
    if (!ctx || !ctx.canvas) {
        console.error("DrumGridComponent: Drum grid context not available for rendering.");
        return;
    }
    
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const pitchRowHeight = 0.5 * store.state.cellHeight;
    const totalColumns = store.state.columnWidths.length;

    // Draw Y-axis labels (H, M, L)
    const drumLabels = ['H', 'M', 'L'];
    ctx.font = `${Math.floor(pitchRowHeight * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    const labelX = ConfigService.getColumnX(1); // Align with the second legend column
    drumLabels.forEach((label, i) => {
        ctx.fillText(label, labelX, i * pitchRowHeight + pitchRowHeight / 2);
    });
    
    // Draw horizontal and vertical grid lines
    for (let i = 0; i < 4; i++) { // 3 rows need 4 lines
        const y = i * pitchRowHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    // Draw main grid content
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
                ctx.fillStyle = '#000';
                drawDrumShape(ctx, row, x, y, cellWidth, pitchRowHeight);
            } else {
                // Optional: Draw a placeholder dot
                ctx.fillStyle = '#ddd';
                ctx.beginPath();
                ctx.arc(x + cellWidth / 2, y + pitchRowHeight / 2, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

const DrumGrid = {
    render() {
        console.log("DrumGridComponent: Render triggered.");
        renderDrumGrid();
    }
};

export default DrumGrid;