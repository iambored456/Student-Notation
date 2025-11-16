// js/utils/domToCanvas.js
// Thin wrapper around html2canvas so callers keep a consistent API.

import html2canvas from 'html2canvas';

const DEFAULT_OPTIONS = {
  scale: window.devicePixelRatio || 1,
  backgroundColor: null,
  useCORS: true,
  logging: false
};

/**
 * Renders the supplied element into a canvas using html2canvas.
 * @param {HTMLElement} element
 * @param {import('html2canvas').Options} options
 * @returns {Promise<HTMLCanvasElement>}
 */
export function domToCanvas(element, options = {}) {
  if (!element) {
    throw new Error('domToCanvas requires a valid element reference.');
  }

  const mergedOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  return html2canvas(element, mergedOptions);
}
