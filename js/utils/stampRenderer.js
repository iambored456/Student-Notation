// js/utils/stampRenderer.js
import { diamondPath } from '@components/rhythm/glyphs/diamond.js';

/**
 * Shared stamp rendering utility for both canvas and SVG contexts
 */
export class StampRenderer {
  constructor(options = {}) {
    this.options = {
      diamondW: 30,
      diamondH: 120,
      ovalRx: 30,
      ovalRy: 60,
      strokeWidth: 2,
      ...options
    };
  }

  /**
   * Renders a stamp to a canvas context
   * @param {Object} placement - Optional placement object with shapeOffsets
   * @param {Function} getRowY - Optional function to calculate Y position from row index
   */
  renderToCanvas(ctx, stamp, x, y, width, height, color = '#000', placement = null, getRowY = null) {
    const scale = Math.min(width / 100, height / 100) * 0.8;
    const diamondW = this.options.diamondW * scale;
    const diamondH = this.options.diamondH * scale;
    const ovalRx = this.options.ovalRx * scale;
    const ovalRy = this.options.ovalRy * scale;

    const slotCenters = [0.125, 0.375, 0.625, 0.875].map(ratio => x + ratio * width);
    const centerY = y + height / 2;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = this.options.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw ovals (8th notes) with individual offsets if available
    stamp.ovals.forEach(ovalStart => {
      const cx = ovalStart === 0 ? x + 0.25 * width : x + 0.75 * width;

      // Calculate Y position with offset if placement data available
      let ovalY = centerY;
      if (placement && getRowY) {
        const shapeKey = `oval_${ovalStart}`;
        const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
        const shapeRow = placement.row + rowOffset;
        ovalY = getRowY(shapeRow);

      }

      ctx.beginPath();
      ctx.ellipse(cx, ovalY, ovalRx, ovalRy, 0, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Draw diamonds (16th notes) with individual offsets if available
    stamp.diamonds.forEach(slot => {
      const cx = slotCenters[slot];

      // Calculate Y position with offset if placement data available
      let diamondY = centerY;
      if (placement && getRowY) {
        const shapeKey = `diamond_${slot}`;
        const rowOffset = (placement.shapeOffsets?.[shapeKey]) || 0;
        const shapeRow = placement.row + rowOffset;
        diamondY = getRowY(shapeRow);

      }

      const path = diamondPath(cx, diamondY, diamondW, diamondH);
      const pathObj = new Path2D(path);
      ctx.stroke(pathObj);
    });

    ctx.restore();
  }

  /**
   * Renders a stamp to an SVG element
   */
  renderToSVG(stamp, viewBoxWidth = 100, viewBoxHeight = 100) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
    svg.style.color = '#000000'; // Ensure visibility with explicit color
    
    const scale = Math.min(viewBoxWidth / 100, viewBoxHeight / 100) * 0.8;
    const diamondW = this.options.diamondW * scale;
    const diamondH = this.options.diamondH * scale;
    const ovalRx = this.options.ovalRx * scale;
    const ovalRy = this.options.ovalRy * scale;

    const slotCenters = [12.5, 37.5, 62.5, 87.5];
    const centerY = viewBoxHeight / 2;


    // Draw ovals (8th notes)
    stamp.ovals.forEach(ovalStart => {
      const cx = ovalStart === 0 ? 25 : 75;
      const oval = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      oval.setAttribute('cx', cx);
      oval.setAttribute('cy', centerY);
      oval.setAttribute('rx', ovalRx);
      oval.setAttribute('ry', ovalRy);
      oval.setAttribute('fill', 'none');
      oval.setAttribute('stroke', 'currentColor');
      oval.setAttribute('stroke-width', this.options.strokeWidth * 2);
      oval.setAttribute('stroke-linecap', 'round');
      svg.appendChild(oval);
    });

    // Draw diamonds (16th notes)
    stamp.diamonds.forEach(slot => {
      const cx = slotCenters[slot];
      const path = diamondPath(cx, centerY, diamondW, diamondH);
      const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      diamond.setAttribute('d', path);
      diamond.setAttribute('fill', 'none');
      diamond.setAttribute('stroke', 'currentColor');
      diamond.setAttribute('stroke-width', this.options.strokeWidth * 2);
      diamond.setAttribute('stroke-linejoin', 'round');
      diamond.setAttribute('stroke-linecap', 'round');
      svg.appendChild(diamond);
    });

    return svg;
  }
}

export const defaultStampRenderer = new StampRenderer();
