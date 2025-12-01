// js/ui/glyphs/tripletGlyphs.js

interface TripletStamp {
  label: string;
  span: 'eighth' | 'quarter';
  hits: number[];
}

interface NoteheadParams {
  kind: 'ovalWide' | 'circleWide';
  cx: number;
  cy: number;
  stroke?: string;
  strokeWidth?: number;
  scale?: number;
}

/**
 * Renders a single wide notehead centered at (cx,cy).
 * - "ovalWide": ellipse with rx>ry (for 8th-triplet stamps)
 * - "circleWide": wider ellipse (for quarter-triplet stamps)
 */
export function createTripletNotehead({
  kind,
  cx,
  cy,
  stroke = 'currentColor',
  strokeWidth = 4,
  scale = 1
}: NoteheadParams) {
  const baseRx = 20 * scale;
  const baseRy = 60 * scale;

  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', `${cx}`);
  ellipse.setAttribute('cy', `${cy}`);
  ellipse.setAttribute('fill', 'none');
  ellipse.setAttribute('stroke', stroke);
  ellipse.setAttribute('stroke-width', `${strokeWidth}`);
  ellipse.setAttribute('stroke-linecap', 'round');

  if (kind === 'circleWide') {
    ellipse.setAttribute('rx', `${baseRx * 2}`);
    ellipse.setAttribute('ry', `${baseRy}`);
  } else {
    ellipse.setAttribute('rx', `${baseRx}`);
    ellipse.setAttribute('ry', `${baseRy}`);
  }

  return ellipse;
}

/**
 * Creates a complete triplet preview SVG for a given stamp
 */
export function createTripletPreview(stamp: TripletStamp, width = 48, height = 48) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  const isWide = stamp.span === 'quarter';
  const viewBoxWidth = isWide ? 200 : 100;
  svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} 100`);
  svg.setAttribute('width', `${width}`);
  svg.setAttribute('height', `${height}`);
  svg.setAttribute('aria-label', stamp.label);
  svg.style.color = '#000000';

  const centerY = 50;
  const kind: NoteheadParams['kind'] = stamp.span === 'eighth' ? 'ovalWide' : 'circleWide';

  let centers: number[];
  if (isWide) {
    centers = [33.33, 100, 166.67];
  } else {
    centers = [16.67, 50, 83.33];
  }

  stamp.hits.forEach(hit => {
    const notehead = createTripletNotehead({
      kind,
      cx: centers[hit] ?? 0,
      cy: centerY,
      stroke: 'currentColor',
      strokeWidth: 3,
      scale: 0.8
    });
    svg.appendChild(notehead);
  });

  return svg;
}
