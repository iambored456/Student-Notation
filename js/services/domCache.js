/**
 * DOM Element Caching Service
 * Provides centralized caching of frequently accessed DOM elements
 * to improve performance by avoiding repeated queries
 */

class DOMCache {
    constructor() {
        this.elements = new Map();
        this.initialized = false;
    }

    /**
     * Initialize and cache all commonly used DOM elements
     */
    init() {
        if (this.initialized) return;

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
        this.cacheElement('frequencyBtn', 'frequency-toggle-btn');
        this.cacheElement('focusColoursToggle', 'focus-colours-toggle');
        this.cacheElement('harmonyContainerMain', 'chordShape-container');

        // Audio controls
        this.cacheElement('tempoSlider', 'tempo-slider');
        this.cacheElement('volumeSlider', 'vertical-volume-slider');

        this.initialized = true;
    }

    /**
     * Cache a single element by ID
     * @param {string} key - Key to store the element under
     * @param {string} id - Element ID to query
     */
    cacheElement(key, id) {
        const element = document.getElementById(id);
        if (element) {
            this.elements.set(key, element);
        } else {
        }
    }

    /**
     * Get a cached element
     * @param {string} key - Element key
     * @returns {HTMLElement|null} The cached element or null if not found
     */
    get(key) {
        if (!this.initialized) {
            return null;
        }
        return this.elements.get(key) || null;
    }

    /**
     * Get multiple cached elements
     * @param {...string} keys - Element keys to retrieve
     * @returns {Object} Object with requested elements
     */
    getMultiple(...keys) {
        const result = {};
        keys.forEach(key => {
            result[key] = this.get(key);
        });
        return result;
    }

    /**
     * Check if an element is cached
     * @param {string} key - Element key
     * @returns {boolean} True if element is cached
     */
    has(key) {
        return this.elements.has(key);
    }

    /**
     * Clear the cache and reinitialize
     */
    refresh() {
        this.elements.clear();
        this.initialized = false;
        this.init();
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
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
