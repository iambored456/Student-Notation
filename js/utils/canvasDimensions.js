// js/utils/canvasDimensions.js

/**
 * Returns the logical (CSS) width for a canvas, falling back to its backing width.
 * @param {HTMLCanvasElement} canvas
 * @returns {number}
 */
export function getLogicalCanvasWidth(canvas) {
    if (!canvas) {
        return 0;
    }

    const storedWidth = canvas.dataset?.logicalWidth;
    const parsedWidth = storedWidth !== undefined ? Number(storedWidth) : NaN;
    if (Number.isFinite(parsedWidth)) {
        return parsedWidth;
    }

    return canvas.width || 0;
}

/**
 * Returns the logical (CSS) height for a canvas, falling back to its backing height.
 * @param {HTMLCanvasElement} canvas
 * @returns {number}
 */
export function getLogicalCanvasHeight(canvas) {
    if (!canvas) {
        return 0;
    }

    const storedHeight = canvas.dataset?.logicalHeight;
    const parsedHeight = storedHeight !== undefined ? Number(storedHeight) : NaN;
    if (Number.isFinite(parsedHeight)) {
        return parsedHeight;
    }

    return canvas.height || 0;
}

/**
 * Returns the device pixel ratio that was last applied to the canvas.
 * @param {HTMLCanvasElement} canvas
 * @returns {number}
 */
export function getCanvasPixelRatio(canvas) {
    if (!canvas) {
        return 1;
    }

    const storedRatio = canvas.dataset?.pixelRatio;
    const parsedRatio = storedRatio !== undefined ? Number(storedRatio) : NaN;
    if (Number.isFinite(parsedRatio) && parsedRatio > 0) {
        return parsedRatio;
    }

    return 1;
}
