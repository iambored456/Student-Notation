// js/components/ZoomIndicator.js
import store from '../state/index.js';
import LayoutService from '../services/layoutService.js';

class ZoomIndicator {
    constructor() {
        this.element = null;
        this.isVisible = false;
        this.hideTimeout = null;
    }

    initialize() {
        // Create the zoom indicator element
        this.element = document.createElement('div');
        this.element.className = 'zoom-indicator';
        this.element.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: monospace;
            font-size: 12px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        `;

        document.body.appendChild(this.element);

        // Listen for zoom events
        store.on('zoomIn', () => this.show());
        store.on('zoomOut', () => this.show());
        
        console.log('ZoomIndicator: Initialized');
    }

    show() {
        if (!this.element) return;

        // Get viewport info if available
        let zoomPercent = 100;
        let visibilityText = '';
        
        if (LayoutService.getViewportInfo) {
            const viewportInfo = LayoutService.getViewportInfo();
            zoomPercent = Math.round(viewportInfo.zoomLevel * 100);
            
            if (viewportInfo.canSeeFullRange) {
                visibilityText = ' (Full Range)';
            } else {
                // Calculate approximate visible range using correct row height calculation
                const visibleSemitones = Math.floor((viewportInfo.endRow - viewportInfo.startRow + 1));
                visibilityText = ` (~${visibleSemitones} semitones)`;
            }
        }

        this.element.textContent = `Zoom: ${zoomPercent}%${visibilityText}`;
        this.element.style.opacity = '1';
        this.isVisible = true;

        // Auto-hide after 2 seconds
        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(() => this.hide(), 2000);
    }

    hide() {
        if (!this.element || !this.isVisible) return;
        
        this.element.style.opacity = '0';
        this.isVisible = false;
        clearTimeout(this.hideTimeout);
    }

    dispose() {
        if (this.element) {
            document.body.removeChild(this.element);
            this.element = null;
        }
        clearTimeout(this.hideTimeout);
    }
}

export default new ZoomIndicator();