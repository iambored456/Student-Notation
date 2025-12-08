// js/ui/glyphs/tripletGlyphs.js

interface TripletStamp {
  label: string;
  span: 'eighth' | 'quarter';
  hits: number[];
}

interface NoteheadParams {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  stroke?: string;
  strokeWidth?: number;
}

/**
 * Creates a single triplet notehead SVG element centered at (cx, cy).
 * Quarter triplet noteheads are 2x wider than eighth triplet noteheads
 * to represent their 2-cell (quarter note) span.
 */
export function createTripletNotehead({
  cx,
  cy,
  rx,
  ry,
  stroke = 'currentColor',
  strokeWidth = 3
}: NoteheadParams) {
  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', `${cx}`);
  ellipse.setAttribute('cy', `${cy}`);
  ellipse.setAttribute('rx', `${rx}`);
  ellipse.setAttribute('ry', `${ry}`);
  ellipse.setAttribute('fill', 'none');
  ellipse.setAttribute('stroke', stroke);
  ellipse.setAttribute('stroke-width', `${strokeWidth}`);
  ellipse.setAttribute('stroke-linecap', 'round');

  return ellipse;
}

/**
 * Creates a complete triplet preview SVG for a given stamp
 */
export function createTripletPreview(stamp: TripletStamp, width = 48, height = 48) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  const isWide = stamp.span === 'quarter';

  // ViewBox matches button aspect ratio
  const viewBoxWidth = isWide ? 200 : 100;
  const viewBoxHeight = 100;
  svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('aria-label', stamp.label);
  svg.style.color = '#000000';

  const centerY = 50;  // Middle of viewBox

  // Ellipse dimensions (in viewBox units)
  // Quarter triplets use 2x wider ellipses to match their 2-cell span
  const ellipseRx = isWide ? 32 : 16;  // Horizontal radius: 2x for quarter triplets
  const ellipseRy = 40;  // Vertical radius: same for both

  // Position noteheads at 1/6, 3/6, 5/6 of the viewBox width
  const centers = isWide
    ? [33.33, 100, 166.67]  // Spread across viewBox width 200
    : [16.67, 50, 83.33];    // Spread across viewBox width 100

  stamp.hits.forEach(hit => {
    const notehead = createTripletNotehead({
      cx: centers[hit] ?? 0,
      cy: centerY,
      rx: ellipseRx,
      ry: ellipseRy,
      stroke: 'currentColor',
      strokeWidth: 3
    });
    svg.appendChild(notehead);
  });

  return svg;
}
