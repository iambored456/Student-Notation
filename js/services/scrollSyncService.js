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
    this.gridScrollbarProxy = null;
    this.isInitialized = false;

    this.lastScrollTime = 0;
    this.isSyncingFromProxy = false;
    this.isSyncingFromWrapper = false;
  }

  init() {
    // With new structure, grids-wrapper is the main scrollable container
    this.gridsWrapper = document.getElementById('grids-wrapper');
    this.pitchGridWrapper = document.getElementById('pitch-grid-wrapper');
    this.drumGridWrapper = document.getElementById('drum-grid-wrapper');
    this.gridScrollbarProxy = document.getElementById('grid-scrollbar-proxy');

    if (!this.gridsWrapper || !this.pitchGridWrapper || !this.drumGridWrapper) {
      logger.error('ScrollSyncService', 'Required elements not found for scroll sync', null, 'scroll');
      return;
    }

    this.setupScrollSynchronization();
    this.isInitialized = true;
    logger.info('ScrollSyncService', 'Initialized with unified grids-wrapper structure', null, 'scroll');
  }

  setupScrollSynchronization() {
    this.handleWrapperScroll = this.handleWrapperScroll.bind(this);
    this.handleProxyScroll = this.handleProxyScroll.bind(this);

    this.gridsWrapper.addEventListener('scroll', this.handleWrapperScroll, { passive: true });

    if (this.gridScrollbarProxy) {
      this.gridScrollbarProxy.addEventListener('scroll', this.handleProxyScroll, { passive: true });
    } else {
      logger.warn('ScrollSyncService', 'Grid scrollbar proxy not found; falling back to native scrollbars.', null, 'scroll');
    }
  }

  handleWrapperScroll(event) {
    if (this.isSyncingFromProxy) {
      return;
    }

    const now = Date.now();
    this.lastScrollTime = now;

    if (this.gridScrollbarProxy) {
      const wrapperScrollLeft = this.gridsWrapper.scrollLeft;
      if (Math.abs(this.gridScrollbarProxy.scrollLeft - wrapperScrollLeft) > 0.5) {
        this.isSyncingFromWrapper = true;
        this.gridScrollbarProxy.scrollLeft = wrapperScrollLeft;
        this.isSyncingFromWrapper = false;
      }
    }

    logger.debug('ScrollSyncService', `Unified scroll: ${event.target.scrollLeft}px`, null, 'scroll');
  }

  handleProxyScroll() {
    if (this.isSyncingFromWrapper || !this.gridScrollbarProxy) {
      return;
    }

    const proxyScrollLeft = this.gridScrollbarProxy.scrollLeft;
    if (!this.gridsWrapper) {
      return;
    }

    if (Math.abs(this.gridsWrapper.scrollLeft - proxyScrollLeft) > 0.5) {
      this.isSyncingFromProxy = true;
      this.gridsWrapper.scrollLeft = proxyScrollLeft;
      this.isSyncingFromProxy = false;
    }
  }

  // Manual sync method for programmatic scrolling
  syncScrollTo(scrollLeft) {
    if (!this.isInitialized || !this.gridsWrapper) {return;}

    this.isSyncingFromProxy = true;
    this.isSyncingFromWrapper = true;

    this.gridsWrapper.scrollLeft = scrollLeft;
    if (this.gridScrollbarProxy) {
      this.gridScrollbarProxy.scrollLeft = scrollLeft;
    }

    this.isSyncingFromProxy = false;
    this.isSyncingFromWrapper = false;
  }
}

// Create singleton instance
const scrollSyncService = new ScrollSyncService();

export default scrollSyncService;
