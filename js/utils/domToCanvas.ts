// Thin wrapper around html2canvas so callers keep a consistent API.

import html2canvas, { type Options as Html2CanvasOptions } from 'html2canvas';

type DomToCanvasOptions = Partial<Html2CanvasOptions>;

const DEFAULT_OPTIONS: DomToCanvasOptions = {
  scale: window.devicePixelRatio || 1,
  backgroundColor: null,
  useCORS: true,
  logging: false
};

/**
 * Renders the supplied element into a canvas using html2canvas.
 */
export function domToCanvas(element: HTMLElement | null, options: DomToCanvasOptions = {}): Promise<HTMLCanvasElement> {
  if (!element) {
    throw new Error('domToCanvas requires a valid element reference.');
  }

  const mergedOptions: DomToCanvasOptions = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  return html2canvas(element, mergedOptions as Html2CanvasOptions);
}
