// js/components/UI/zoomIndicator.js
import store from '@state/index.ts';
import LayoutService from '@services/layoutService.ts';

class ZoomIndicator {
  private element: HTMLDivElement | null = null;
  private isVisible = false;
  private hideTimeout: ReturnType<typeof setTimeout> | null = null;

  initialize(): void {
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
    store.on('zoomIn', () => this.show());
    store.on('zoomOut', () => this.show());

  }

  show(): void {
    if (!this.element) {return;}

    let zoomPercent = 100;
    let visibilityText = '';

    const viewportInfo = LayoutService.getViewportInfo();
    if (viewportInfo) {
      zoomPercent = Math.round((viewportInfo.zoomLevel ?? 1) * 100);

      if ((viewportInfo as any).canSeeFullRange) {
        visibilityText = ' (Full Range)';
      } else {
        const startRank = viewportInfo.startRank ?? (viewportInfo as any).startRow ?? 0;
        const endRank = viewportInfo.endRank ?? (viewportInfo as any).endRow ?? startRank;
        const visibleSemitones = Math.floor((endRank - startRank + 1));
        visibilityText = ` (~${visibleSemitones} semitones)`;
      }
    }

    this.element.textContent = `Zoom: ${zoomPercent}%${visibilityText}`;
    this.element.style.opacity = '1';
    this.isVisible = true;

    // Auto-hide after 2 seconds
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
    }
    this.hideTimeout = setTimeout(() => this.hide(), 2000);
  }

  hide(): void {
    if (!this.element || !this.isVisible) {return;}

    this.element.style.opacity = '0';
    this.isVisible = false;
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }

  dispose(): void {
    if (this.element) {
      document.body.removeChild(this.element);
      this.element = null;
    }
    if (this.hideTimeout !== null) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }
  }
}

export default new ZoomIndicator();
