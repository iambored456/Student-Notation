// js/services/scrollSyncService.js
import logger from '@utils/logger.js';

/**
 * Service to synchronize horizontal scrolling between pitch grid and drum grid
 */
class ScrollSyncService {
    constructor() {
        this.gridsWrapper = null;
        this.pitchGridWrapper = null;
        this.drumGridWrapper = null;
        this.isInitialized = false;

        // Prevent infinite scroll loops
        this.isScrolling = false;
        this.lastScrollTime = 0;
        this.pendingSync = null;
    }

    init() {
        // With new structure, grids-wrapper is the main scrollable container
        this.gridsWrapper = document.getElementById('grids-wrapper');
        this.pitchGridWrapper = document.getElementById('pitch-grid-wrapper');
        this.drumGridWrapper = document.getElementById('drum-grid-wrapper');

        if (!this.gridsWrapper || !this.pitchGridWrapper || !this.drumGridWrapper) {
            logger.error('ScrollSyncService', 'Required elements not found for scroll sync', null, 'scroll');
            return;
        }

        this.setupScrollSynchronization();
        this.isInitialized = true;
        logger.info('ScrollSyncService', 'Initialized with unified grids-wrapper structure', null, 'scroll');
    }

    setupScrollSynchronization() {
        // With unified structure, grids-wrapper is the primary scroll container
        // Both pitch and drum grids are children and scroll together automatically
        // No manual sync needed, but we keep the service for potential future use

        // Listen to scroll on grids-wrapper for debugging/monitoring
        this.gridsWrapper.addEventListener('scroll', (e) => {
            const now = Date.now();

            // Debounce rapid scroll events
            if (now - this.lastScrollTime < 10) {
                return;
            }
            this.lastScrollTime = now;

            // Both grids scroll together via parent container - no manual sync needed
            logger.debug('ScrollSyncService', `Unified scroll: ${e.target.scrollLeft}px`, null, 'scroll');
        });
    }

    // Manual sync method for programmatic scrolling
    syncScrollTo(scrollLeft) {
        if (!this.isInitialized || !this.gridsWrapper) return;

        this.isScrolling = true;

        // With unified structure, just set scroll on the parent grids-wrapper
        this.gridsWrapper.scrollLeft = scrollLeft;

        setTimeout(() => {
            this.isScrolling = false;
        }, 10);
    }
}

// Create singleton instance
const scrollSyncService = new ScrollSyncService();

export default scrollSyncService;
