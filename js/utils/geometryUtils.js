// js/utils/geometryUtils.js

/**
 * Point-in-polygon test using ray casting algorithm
 * @param {Object} point - {x, y} or {col, row}
 * @param {Array} polygon - Array of {x, y} or {col, row} points
 * @returns {boolean} - True if point is inside polygon
 */
export function isPointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;

    // Use x/y if available, otherwise use col/row
    const px = point.x !== undefined ? point.x : point.col;
    const py = point.y !== undefined ? point.y : point.row;

    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x !== undefined ? polygon[i].x : polygon[i].col;
        const yi = polygon[i].y !== undefined ? polygon[i].y : polygon[i].row;
        const xj = polygon[j].x !== undefined ? polygon[j].x : polygon[j].col;
        const yj = polygon[j].y !== undefined ? polygon[j].y : polygon[j].row;

        const intersect = ((yi > py) !== (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

/**
 * Calculate the convex hull of a set of points using Graham scan algorithm
 * @param {Array} points - Array of {x, y} or {col, row} points
 * @returns {Array} - Array of points forming the convex hull
 */
export function calculateConvexHull(points) {
    if (!points || points.length < 3) return points;

    // Normalize points to use x/y
    const normalized = points.map(p => ({
        x: p.x !== undefined ? p.x : p.col,
        y: p.y !== undefined ? p.y : p.row
    }));

    // Find the bottom-most point (or left-most if tied)
    let start = normalized[0];
    for (let i = 1; i < normalized.length; i++) {
        if (normalized[i].y < start.y ||
            (normalized[i].y === start.y && normalized[i].x < start.x)) {
            start = normalized[i];
        }
    }

    // Sort points by polar angle with respect to start point
    const sorted = normalized.filter(p => p !== start);
    sorted.sort((a, b) => {
        const angleA = Math.atan2(a.y - start.y, a.x - start.x);
        const angleB = Math.atan2(b.y - start.y, b.x - start.x);
        if (angleA !== angleB) return angleA - angleB;
        // If angles are equal, sort by distance
        const distA = Math.hypot(a.x - start.x, a.y - start.y);
        const distB = Math.hypot(b.x - start.x, b.y - start.y);
        return distA - distB;
    });

    // Build convex hull
    const hull = [start, sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        // Remove points that make a right turn
        while (hull.length > 1 && !isLeftTurn(hull[hull.length - 2], hull[hull.length - 1], sorted[i])) {
            hull.pop();
        }
        hull.push(sorted[i]);
    }

    return hull;
}

/**
 * Check if three points make a left turn (counter-clockwise)
 * @param {Object} p1 - First point {x, y}
 * @param {Object} p2 - Second point {x, y}
 * @param {Object} p3 - Third point {x, y}
 * @returns {boolean} - True if the points make a left turn
 */
function isLeftTurn(p1, p2, p3) {
    return ((p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x)) > 0;
}

/**
 * Check if a point is near a line segment (for clicking on bounding border)
 * @param {Object} point - {x, y} point to test
 * @param {Object} p1 - First endpoint {x, y}
 * @param {Object} p2 - Second endpoint {x, y}
 * @param {number} threshold - Distance threshold in pixels
 * @returns {boolean} - True if point is within threshold distance of line segment
 */
export function isPointNearLineSegment(point, p1, p2, threshold = 10) {
    const px = point.x;
    const py = point.y;
    const x1 = p1.x;
    const y1 = p1.y;
    const x2 = p2.x;
    const y2 = p2.y;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
        // Line segment is actually a point
        const dist = Math.hypot(px - x1, py - y1);
        return dist <= threshold;
    }

    // Calculate projection of point onto line
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    // Find closest point on line segment
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;

    // Calculate distance
    const dist = Math.hypot(px - closestX, py - closestY);
    return dist <= threshold;
}

/**
 * Check if a point is near the convex hull border
 * @param {Object} point - {x, y} point to test
 * @param {Array} hull - Array of {x, y} points forming the hull
 * @param {number} threshold - Distance threshold in pixels
 * @returns {boolean} - True if point is near any edge of the hull
 */
export function isPointNearHull(point, hull, threshold = 10) {
    if (!hull || hull.length < 2) return false;

    for (let i = 0; i < hull.length; i++) {
        const p1 = hull[i];
        const p2 = hull[(i + 1) % hull.length];
        if (isPointNearLineSegment(point, p1, p2, threshold)) {
            return true;
        }
    }

    return false;
}

/**
 * Check if polygon intersects with an ellipse
 * @param {Array} polygon - Array of {x, y} points
 * @param {Object} ellipse - {centerX, centerY, rx, ry}
 * @returns {boolean} - True if polygon intersects with ellipse
 */
export function polygonIntersectsEllipse(polygon, ellipse) {
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
 * Check if polygon intersects with a rectangle
 * @param {Array} polygon - Array of {x, y} points
 * @param {Object} rect - {x, y, width, height}
 * @returns {boolean} - True if polygon intersects with rectangle
 */
export function polygonIntersectsRect(polygon, rect) {
    const { x, y, width, height } = rect;

    // Check all four corners
    const corners = [
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
        const px = point.x !== undefined ? point.x : point.col;
        const py = point.y !== undefined ? point.y : point.row;

        if (px >= x && px <= x + width && py >= y && py <= y + height) {
            return true;
        }
    }

    return false;
}
