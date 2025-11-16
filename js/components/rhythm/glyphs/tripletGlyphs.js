// js/ui/glyphs/tripletGlyphs.js

/**
 * Renders a single wide notehead centered at (cx,cy).
 * - "ovalWide": ellipse with rx>ry (for 8th-triplet stamps)
 * - "circleWide": circle (for quarter-triplet stamps) — reads as heavier/longer
 */
export function createTripletNotehead({
  kind,
  cx,
  cy,
  stroke = 'currentColor',
  strokeWidth = 4,
  scale = 1
}) {
  const baseRx = 20 * scale;
  const baseRy = 60 * scale;

  const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ellipse.setAttribute('cx', cx);
  ellipse.setAttribute('cy', cy);
  ellipse.setAttribute('fill', 'none');
  ellipse.setAttribute('stroke', stroke);
  ellipse.setAttribute('stroke-width', strokeWidth);
  ellipse.setAttribute('stroke-linecap', 'round');

  if (kind === 'circleWide') {
    // Draw ellipse for "circleWide" - allows independent x/y scaling
    ellipse.setAttribute('rx', baseRx * 2); // Slightly wider for quarter note weight
    ellipse.setAttribute('ry', baseRy);
  } else {
    // Draw ellipse for "ovalWide"
    ellipse.setAttribute('rx', baseRx);
    ellipse.setAttribute('ry', baseRy);
  }

  return ellipse;
}

/**
 * Creates a complete triplet preview SVG for a given stamp
 */
export function createTripletPreview(stamp, width = 48, height = 48) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

  // Use wider viewBox for quarter triplets to maintain proper proportions
  const isWide = stamp.span === 'quarter';
  const viewBoxWidth = isWide ? 200 : 100; // Quarter triplets get 2x wider viewBox
  svg.setAttribute('viewBox', `0 0 ${viewBoxWidth} 100`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  svg.setAttribute('aria-label', stamp.label);
  svg.style.color = '#000000'; // Ensure visibility like the stamp renderer


  // Calculate centers based on viewBox width
  const centerY = 50;
  const kind = stamp.span === 'eighth' ? 'ovalWide' : 'circleWide';

  // Position noteheads appropriately for the viewBox size
  let centers;
  if (isWide) {
    // For quarter triplets (200-wide viewBox): spread noteheads across the width
    centers = [33.33, 100, 166.67]; // 1/6, 3/6, 5/6 of 200
  } else {
    // For eighth triplets (100-wide viewBox): use original positions
    centers = [16.67, 50, 83.33]; // 1/6, 3/6, 5/6 of 100
  }

  // Draw noteheads for each hit in the stamp
  stamp.hits.forEach(hit => {
    const notehead = createTripletNotehead({
      kind,
      cx: centers[hit],
      cy: centerY,
      stroke: 'currentColor',
      strokeWidth: 3, // Match grid rendering
      scale: 0.8 // Match grid rendering
    });
    svg.appendChild(notehead);
  });

  return svg;
}
