export interface GeometryPoint {
  x?: number;
  y?: number;
  col?: number;
  row?: number;
}

interface Rect { x: number; y: number; width: number; height: number }
interface Ellipse { centerX: number; centerY: number; rx: number; ry: number }

function getX(point: GeometryPoint): number {
  return (point.x ?? point.col) ?? 0;
}

function getY(point: GeometryPoint): number {
  return (point.y ?? point.row) ?? 0;
}

/**
 * Point-in-polygon test using ray casting algorithm.
 */
export function isPointInPolygon(point: GeometryPoint, polygon: GeometryPoint[]): boolean {
  if (!polygon || polygon.length < 3) {return false;}

  const px = getX(point);
  const py = getY(point);

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = getX(polygon[i]!);
    const yi = getY(polygon[i]!);
    const xj = getX(polygon[j]!);
    const yj = getY(polygon[j]!);

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) {inside = !inside;}
  }

  return inside;
}

/**
 * Calculate the convex hull of a set of points using Graham scan algorithm.
 */
export function calculateConvexHull(points: GeometryPoint[]): GeometryPoint[] {
  if (!points || points.length < 3) {return points;}

  // Normalize points to use x/y
  const normalized = points.map(p => ({
    x: getX(p),
    y: getY(p)
  }));

  if (normalized.length === 0) {return [];}

  // Find the bottom-most point (or left-most if tied)
  let start = normalized[0]!;
  for (let i = 1; i < normalized.length; i++) {
    const candidate = normalized[i]!;
    if (candidate.y < start.y ||
      (candidate.y === start.y && candidate.x < start.x)) {
      start = candidate;
    }
  }

  // Sort points by polar angle with respect to start point
  const sorted = normalized.filter(p => p !== start);
  sorted.sort((a, b) => {
    const angleA = Math.atan2(a.y - start.y, a.x - start.x);
    const angleB = Math.atan2(b.y - start.y, b.x - start.x);
    if (angleA !== angleB) {return angleA - angleB;}
    const distA = Math.hypot(a.x - start.x, a.y - start.y);
    const distB = Math.hypot(b.x - start.x, b.y - start.y);
    return distA - distB;
  });

  // Build convex hull
  if (sorted.length === 0) {
    return [start];
  }

  const hull: GeometryPoint[] = [start, sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]!;
    // Remove points that make a right turn
    while (hull.length > 1 && !isLeftTurn(hull[hull.length - 2]!, hull[hull.length - 1]!, next)) {
      hull.pop();
    }
    hull.push(next);
  }

  return hull;
}

/**
 * Check if three points make a left turn (counter-clockwise)
 */
function isLeftTurn(p1: GeometryPoint, p2: GeometryPoint, p3: GeometryPoint): boolean {
  const x1 = getX(p1);
  const y1 = getY(p1);
  const x2 = getX(p2);
  const y2 = getY(p2);
  const x3 = getX(p3);
  const y3 = getY(p3);
  return ((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1)) > 0;
}

/**
 * Check if a point is near a line segment (for clicking on bounding border)
 */
export function isPointNearLineSegment(point: GeometryPoint, p1: GeometryPoint, p2: GeometryPoint, threshold = 10): boolean {
  const px = getX(point);
  const py = getY(point);
  const x1 = getX(p1);
  const y1 = getY(p1);
  const x2 = getX(p2);
  const y2 = getY(p2);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    const dist = Math.hypot(px - x1, py - y1);
    return dist <= threshold;
  }

  // Calculate projection of point onto line
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));

  // Find closest point on line segment
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;

  const dist = Math.hypot(px - closestX, py - closestY);
  return dist <= threshold;
}

/**
 * Check if a point is near the convex hull border.
 */
export function isPointNearHull(point: GeometryPoint, hull: GeometryPoint[], threshold = 10): boolean {
  if (!hull || hull.length < 2) {return false;}

  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i]!;
    const p2 = hull[(i + 1) % hull.length]!;
    if (isPointNearLineSegment(point, p1, p2, threshold)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if polygon intersects with an ellipse.
 */
export function polygonIntersectsEllipse(polygon: GeometryPoint[], ellipse: Ellipse): boolean {
  const { centerX, centerY, rx, ry } = ellipse;

  // Sample points around the ellipse perimeter
  const samples = 16; // Number of points to sample
  for (let i = 0; i < samples; i++) {
    const angle = (i / samples) * 2 * Math.PI;
    const x = centerX + rx * Math.cos(angle);
    const y = centerY + ry * Math.sin(angle);

    if (isPointInPolygon({ x, y }, polygon)) {
      return true;
    }
  }

  // Also check if center is inside (for small polygons)
  if (isPointInPolygon({ x: centerX, y: centerY }, polygon)) {
    return true;
  }

  return false;
}

/**
 * Check if polygon intersects with a rectangle.
 */
export function polygonIntersectsRect(polygon: GeometryPoint[], rect: Rect): boolean {
  const { x, y, width, height } = rect;

  // Check all four corners
  const corners: GeometryPoint[] = [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height }
  ];

  for (const corner of corners) {
    if (isPointInPolygon(corner, polygon)) {
      return true;
    }
  }

  // Also check if any polygon points are inside the rectangle
  for (const point of polygon) {
    const px = getX(point);
    const py = getY(point);

    if (px >= x && px <= x + width && py >= y && py <= y + height) {
      return true;
    }
  }

  return false;
}
