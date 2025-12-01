/**
 * DOM Element Caching Service
 * Provides centralized caching of frequently accessed DOM elements
 * to improve performance by avoiding repeated queries.
 */

class DOMCache {
  private elements = new Map<string, HTMLElement>();
  private initialized = false;

  /**
   * Initialize and cache all commonly used DOM elements.
   */
  init(): void {
    if (this.initialized) {return;}

    // Canvas elements (animation-heavy)
    this.cacheElement('notationGrid', 'notation-grid');
    this.cacheElement('playheadCanvas', 'playhead-canvas');
    this.cacheElement('hoverCanvas', 'hover-canvas');
    this.cacheElement('drumGrid', 'drum-grid');
    this.cacheElement('drumHoverCanvas', 'drum-hover-canvas');
    this.cacheElement('pitchPaintCanvas', 'pitch-paint-canvas');

    // Layout containers
    this.cacheElement('appContainer', 'app-container');
    this.cacheElement('pitchGridWrapper', 'pitch-grid-wrapper');
    this.cacheElement('drumGridWrapper', 'drum-grid-wrapper');

    // Toolbar elements (frequently accessed)
    this.cacheElement('eraserButton', 'eraser-tool-button');
    this.cacheElement('playButton', 'play-button');
    this.cacheElement('stopButton', 'stop-button');
    this.cacheElement('clearButton', 'clear-button');
    this.cacheElement('loopButton', 'loop-button');
    this.cacheElement('undoButton', 'undo-button');
    this.cacheElement('redoButton', 'redo-button');

    // Note bank and tonic controls
    this.cacheElement('noteBankContainer', 'note-bank-container');
    this.cacheElement('tonicModeGrid', 'tonic-mode-grid');
    this.cacheElement('degreeVisibilityToggle', 'degree-visibility-toggle');
    this.cacheElement('degreeModeToggle', 'degree-mode-toggle');
    this.cacheElement('flatBtn', 'flat-toggle-btn');
    this.cacheElement('sharpBtn', 'sharp-toggle-btn');
    this.cacheElement('frequencyBtn', 'hz-toggle-btn');
    this.cacheElement('focusColoursToggle', 'focus-colours-toggle');
    this.cacheElement('harmonyContainerMain', 'chordShape-container');

    // Audio controls
    this.cacheElement('tempoSlider', 'tempo-slider');
    this.cacheElement('volumeSlider', 'vertical-volume-slider');

    this.initialized = true;
  }

  /**
   * Cache a single element by ID.
   */
  cacheElement(key: string, id: string): void {
    const element = document.getElementById(id);
    if (element) {
      this.elements.set(key, element);
    }
    // If element not found, just don't cache it
  }

  /**
   * Get a cached element.
   */
  get<T extends HTMLElement = HTMLElement>(key: string): T | null {
    if (!this.initialized) {
      return null;
    }
    return (this.elements.get(key) as T | undefined) ?? null;
  }

  /**
   * Get multiple cached elements.
   */
  getMultiple(...keys: string[]): Record<string, HTMLElement | null> {
    const result: Record<string, HTMLElement | null> = {};
    keys.forEach(key => {
      result[key] = this.get(key);
    });
    return result;
  }

  /**
   * Check if an element is cached.
   */
  has(key: string): boolean {
    return this.elements.has(key);
  }

  /**
   * Clear the cache and reinitialize.
   */
  refresh(): void {
    this.elements.clear();
    this.initialized = false;
    this.init();
  }

  /**
   * Get cache statistics.
   */
  getStats(): { totalCached: number; foundElements: number; missingElements: number } {
    const totalElements = this.elements.size;
    const foundElements = Array.from(this.elements.values()).filter(el => el !== null).length;
    return {
      totalCached: totalElements,
      foundElements,
      missingElements: totalElements - foundElements
    };
  }
}

// Create singleton instance
const domCache = new DOMCache();

export default domCache;
