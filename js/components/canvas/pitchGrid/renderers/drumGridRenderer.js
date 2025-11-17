// js/components/Canvas/PitchGrid/renderers/drumGridRenderer.js
import LayoutService from '../../../../services/layoutService.js';
import { getLogicalCanvasWidth, getLogicalCanvasHeight } from '@utils/canvasDimensions.js';

// --- Pure Helper Functions ---
function getColumnX(index) {
  // Use LayoutService to get the column X position with horizontal offset
  return LayoutService.getColumnX(index);
}

export function drawDrumShape(ctx, drumRow, x, y, width, height) {
  const cx = x + width / 2;
  const cy = y + height / 2;
  const size = Math.min(width, height) * 0.4;
  ctx.beginPath();

  if (drumRow === 0) { // High: Triangle
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx - size, cy + size);
    ctx.lineTo(cx + size, cy + size);
    ctx.closePath();
  } else if (drumRow === 1) { // Mid: Diamond
    ctx.moveTo(cx, cy - size);
    ctx.lineTo(cx + size, cy);
    ctx.lineTo(cx, cy + size);
    ctx.lineTo(cx - size, cy);
    ctx.closePath();
  } else { // Low: Pentagon
    const sides = 5;
    for (let i = 0; i < sides; i++) {
      const angle = (2 * Math.PI / sides) * i - Math.PI / 2;
      const sx = cx + size * Math.cos(angle);
      const sy = cy + size * Math.sin(angle);
      if (i === 0) {ctx.moveTo(sx, sy);}
      else {ctx.lineTo(sx, sy);}
    }
    ctx.closePath();
  }
  ctx.fill();
}

function drawVerticalGridLines(ctx, options) {
  const { columnWidths, macrobeatGroupings, macrobeatBoundaryStyles, placedTonicSigns } = options;
  const totalColumns = columnWidths.length;
  const macrobeatBoundaries = [];

  // This logic must exactly match the rhythmService logic for calculating positions
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
      style = { lineWidth: 2, strokeStyle: '#adb5bd', dash: [] };
    } else if (isMacrobeatEnd) {
      const mbIndex = macrobeatBoundaries.indexOf(i);
      if (mbIndex !== -1) {
        const boundaryStyle = macrobeatBoundaryStyles[mbIndex];
        if (boundaryStyle === 'anacrusis') {continue;}
        style = { lineWidth: 1, strokeStyle: '#adb5bd', dash: boundaryStyle === 'solid' ? [] : [5, 5] };
      } else { continue; }
    } else { continue; }

    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, getLogicalCanvasHeight(ctx.canvas));
    ctx.lineWidth = style.lineWidth;
    ctx.strokeStyle = style.strokeStyle;
    ctx.setLineDash(style.dash);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

/**
 * The "pure" drawing function for the entire drum grid.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} options
 */
export function drawDrumGrid(ctx, options) {
  const { placedNotes, columnWidths, cellWidth, cellHeight, placedTonicSigns } = options;

  ctx.clearRect(0, 0, getLogicalCanvasWidth(ctx.canvas), getLogicalCanvasHeight(ctx.canvas));

  // Use zoom-dependent row height with minimum size
  const baseDrumRowHeight = 30;
  const drumRowHeight = Math.max(baseDrumRowHeight, 0.5 * cellHeight);
  const totalColumns = columnWidths.length;
  const drumLabels = ['H', 'M', 'L'];

  // Draw drum labels (no changes here)
  ctx.font = `${Math.floor(drumRowHeight * 0.7)}px 'Atkinson Hyperlegible', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#6c757d';
  const labelX = getColumnX(1, options);
  drumLabels.forEach((label, i) => {
    ctx.fillText(label, labelX, i * drumRowHeight + drumRowHeight / 2);
  });

  // Draw horizontal lines (no changes here)
  for (let i = 0; i < 4; i++) {
    const y = i * drumRowHeight;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(getLogicalCanvasWidth(ctx.canvas), y);
    ctx.strokeStyle = '#ced4da';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawVerticalGridLines(ctx, options);

  // Draw notes and placeholders
  for (let col = 2; col < totalColumns - 2; col++) {
    // --- THIS IS THE CRITICAL ADDITION ---
    // If a tonic sign is in this column, skip drawing anything (notes or placeholders).
    if (placedTonicSigns.some(ts => ts.columnIndex === col)) {
      continue;
    }

    const x = getColumnX(col, options);
    const currentCellWidth = columnWidths[col] * cellWidth;

    for (let row = 0; row < 3; row++) {
      const y = row * drumRowHeight;
      const drumTrack = drumLabels[row];

      const drumHit = placedNotes.find(note =>
        note.isDrum && note.drumTrack === drumTrack && note.startColumnIndex === col
      );

      if (drumHit) {
        ctx.fillStyle = drumHit.color;
        drawDrumShape(ctx, row, x, y, currentCellWidth, drumRowHeight);
      } else {
        ctx.fillStyle = '#ced4da';
        ctx.beginPath();
        ctx.arc(x + currentCellWidth / 2, y + drumRowHeight / 2, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
