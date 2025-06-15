// js/components/Grid/drumGrid.js
import store from '../../state/store.js';
import ConfigService from '../../services/configService.js';
import CanvasContextService from '../../services/canvasContextService.js';

console.log("DrumGridComponent: Module loaded.");

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
            style = { lineWidth: 2, strokeStyle: '#000', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            const boundaryStyle = store.state.macrobeatBoundaryStyles[mbIndex];
            if (boundaryStyle === 'anacrusis') continue;
            style = { lineWidth: 1, strokeStyle: '#000', dash: boundaryStyle === 'solid' ? [] : [4, 2] };
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
    ctx.font = `${Math.floor(pitchRowHeight * 0.7)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#333';
    const labelX = ConfigService.getColumnX(1);
    drumLabels.forEach((label, i) => {
        ctx.fillText(label, labelX, i * pitchRowHeight + pitchRowHeight / 2);
    });
    
    for (let i = 0; i < 4; i++) {
        const y = i * pitchRowHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 0.5;
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
                ctx.fillStyle = '#000';
                drawDrumShape(ctx, row, x, y, cellWidth, pitchRowHeight);
            } else {
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
    },
    drawDrumShape
};

export default DrumGrid;