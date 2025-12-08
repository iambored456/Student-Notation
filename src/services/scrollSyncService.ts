import logger from '@utils/logger.ts';

/**
 * Service to synchronize horizontal scrolling between pitch grid and drum grid.
 */
class ScrollSyncService {
  private gridsWrapper: HTMLElement | null = null;
  private pitchGridWrapper: HTMLElement | null = null;
  private drumGridWrapper: HTMLElement | null = null;
  private gridScrollbarProxy: HTMLElement | null = null;
  private isInitialized = false;

  private lastScrollTime = 0;
  private isSyncingFromProxy = false;
  private isSyncingFromWrapper = false;

  private handleWrapperScroll!: (event: Event) => void;
  private handleProxyScroll!: (event: Event) => void;

  init(): void {
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

  private setupScrollSynchronization(): void {
    this.handleWrapperScroll = this.handleWrapperScrollInternal.bind(this);
    this.handleProxyScroll = this.handleProxyScrollInternal.bind(this);

    this.gridsWrapper!.addEventListener('scroll', this.handleWrapperScroll, { passive: true });

    if (this.gridScrollbarProxy) {
      this.gridScrollbarProxy.addEventListener('scroll', this.handleProxyScroll, { passive: true });
    } else {
      logger.warn('ScrollSyncService', 'Grid scrollbar proxy not found; falling back to native scrollbars.', null, 'scroll');
    }
  }

  private handleWrapperScrollInternal(event: Event): void {
    if (this.isSyncingFromProxy || !this.gridsWrapper) {
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

    const target = event.target as HTMLElement | null;
    logger.debug('ScrollSyncService', `Unified scroll: ${target?.scrollLeft ?? 0}px`, null, 'scroll');
  }

  private handleProxyScrollInternal(): void {
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
  syncScrollTo(scrollLeft: number): void {
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
