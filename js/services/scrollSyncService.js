// js/services/scrollSyncService.js

/**
 * Service to synchronize horizontal scrolling between pitch grid and drum grid
 */
class ScrollSyncService {
    constructor() {
        this.canvasContainer = null;
        this.pitchGridWrapper = null;
        this.drumGridWrapper = null;
        this.harmonyAnalysisGrid = null;
        this.isInitialized = false;
        
        // Prevent infinite scroll loops
        this.isScrolling = false;
        this.lastScrollTime = 0;
        this.pendingSync = null;
    }

    init() {
        this.canvasContainer = document.getElementById('canvas-container');
        this.pitchGridWrapper = document.getElementById('pitch-grid-wrapper');
        this.drumGridWrapper = document.getElementById('drum-grid-wrapper');
        this.harmonyAnalysisGrid = document.getElementById('harmonyAnalysisGrid');

        if (!this.canvasContainer || !this.pitchGridWrapper || !this.drumGridWrapper) {
            console.error('ScrollSyncService: Required elements not found');
            return;
        }

        this.setupScrollSynchronization();
        this.isInitialized = true;
        
        console.log('ScrollSyncService: Initialized scroll synchronization between pitch and drum grids');
    }

    setupScrollSynchronization() {
        // Find which container actually has the scrollbar
        const scrollableContainers = [
            this.canvasContainer,
            this.pitchGridWrapper,
            document.getElementById('pitch-grid-container')
        ].filter(el => el !== null);

        // All containers that need to be synced (including drum grid)
        const allSyncTargets = [
            ...scrollableContainers,
            this.drumGridWrapper,
            this.harmonyAnalysisGrid
        ].filter(el => el !== null);

        // Listen to scroll events on all potential containers
        scrollableContainers.forEach(container => {
            container.addEventListener('scroll', (e) => {
                const now = Date.now();
                
                // Debounce rapid scroll events to prevent acceleration
                if (now - this.lastScrollTime < 10) {
                    return;
                }
                this.lastScrollTime = now;
                
                if (this.isScrolling) {
                    console.log(`📜 ScrollSync: Ignoring scroll event - sync in progress`);
                    return;
                }
                
                this.isScrolling = true;
                const scrollLeft = e.target.scrollLeft;
                
                console.log(`📜 ScrollSync: ${e.target.id || e.target.className} scrolled to ${scrollLeft}px`);
                
                // Cancel any pending sync
                if (this.pendingSync) {
                    cancelAnimationFrame(this.pendingSync);
                }
                
                // Immediate sync without requestAnimationFrame to prevent acceleration
                this.syncAllTargets(e.target, scrollLeft, allSyncTargets);
                this.isScrolling = false;
            });
        });
    }

    syncAllTargets(sourceElement, scrollLeft, allTargets) {
        allTargets.forEach(target => {
            if (target !== sourceElement && Math.abs(target.scrollLeft - scrollLeft) > 2) {
                target.scrollLeft = scrollLeft;
            }
        });
    }

    // Manual sync method for programmatic scrolling
    syncScrollTo(scrollLeft) {
        if (!this.isInitialized) return;
        
        this.isScrolling = true;
        
        const allTargets = [
            this.canvasContainer,
            this.pitchGridWrapper,
            document.getElementById('pitch-grid-container'),
            this.drumGridWrapper,
            this.harmonyAnalysisGrid
        ].filter(el => el !== null);
        
        this.syncAllTargets(null, scrollLeft, allTargets);
        
        setTimeout(() => {
            this.isScrolling = false;
        }, 10);
    }
}

// Create singleton instance
const scrollSyncService = new ScrollSyncService();

export default scrollSyncService;