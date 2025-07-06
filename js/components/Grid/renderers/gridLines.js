// js/components/Grid/renderers/gridLines.js
import { getColumnX, getRowY, getPitchClass, getLineStyleFromPitchClass } from './rendererUtils.js';

function drawHorizontalMusicLines(ctx, options) {
    const { fullRowData, cellHeight, placedTonicSigns } = options;

    const tonicColumnXCoords = placedTonicSigns.map(ts => {
        const startX = getColumnX(ts.columnIndex, options);
        const endX = startX + options.cellWidth * 2;
        return { start: startX, end: endX };
    }).sort((a,b) => a.start - b.start);

    const musicAreaStartX = getColumnX(2, options);
    const musicAreaEndX = getColumnX(options.columnWidths.length - 2, options);

    fullRowData.forEach((row, rowIndex) => {
        const y = getRowY(rowIndex, options);
        const pitchClass = getPitchClass(row.pitch);
        const style = getLineStyleFromPitchClass(pitchClass);
        if (!style) return;

        let lastX = musicAreaStartX;

        tonicColumnXCoords.forEach(coords => {
            drawSegment(lastX, coords.start, y, style, cellHeight, ctx);
            lastX = coords.end;
        });
        drawSegment(lastX, musicAreaEndX, y, style, cellHeight, ctx);
    });
}

function drawSegment(startX, endX, y, style, cellHeight, ctx) {
    if (startX >= endX) return;
    const width = endX - startX;

    if (style.color === '#f8f9fa') { // G line background fill
        ctx.fillStyle = style.color;
        ctx.fillRect(startX, y - (cellHeight / 2), width, cellHeight);
    } else {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.lineWidth = style.lineWidth;
        ctx.strokeStyle = style.color;
        ctx.setLineDash(style.dash);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

export function drawHorizontalLines(ctx, options) {
    // This function now only draws lines in the main music area.
    // Legend lines are handled by the legend renderer itself.
    drawHorizontalMusicLines(ctx, options);
}

export function drawVerticalLines(ctx, options) {
    const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
    const totalColumns = columnWidths.length;
    let macrobeatBoundaries = [];

    let current_col = 2;
    for(let i=0; i<macrobeatGroupings.length; i++) {
        while(placedTonicSigns.some(ts => ts.columnIndex === current_col)) {
            current_col++;
        }
        current_col += macrobeatGroupings[i];
        macrobeatBoundaries.push(current_col);
    }

    for (let i = 0; i <= totalColumns; i++) {
        const x = getColumnX(i, options);
        let style;
        const isBoundary = i === 2 || i === totalColumns - 2;
        const isTonicCol = placedTonicSigns.some(ts => ts.columnIndex === i || ts.columnIndex + 1 === i);
        const isMacrobeatEnd = macrobeatBoundaries.includes(i);

        if (isBoundary || isTonicCol) {
            style = { lineWidth: 2, strokeStyle: '#dee2e6', dash: [] };
        } else if (isMacrobeatEnd) {
            const mbIndex = macrobeatBoundaries.indexOf(i);
            if (mbIndex !== -1) {
                const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
                if (boundaryStyle === 'anacrusis') continue;
                style = { lineWidth: 1, strokeStyle: '#dee2e6', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
            } else { continue; }
        } else { continue; }
        
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