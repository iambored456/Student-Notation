// js/bootstrap/input/initInputAndDiagnostics.js
import store from '@state/index.js';
import LayoutService from '@services/layoutService.js';
import { initSpacebarHandler } from '@services/spacebarHandler.js';
import { initUIDiagnostics } from '@utils/uiDiagnostics.js';
import ZoomIndicator from '@components/ui/ZoomIndicator.js';
import logger from '@utils/logger.js';

export function initInputAndDiagnostics() {
  initSpacebarHandler();
  initializeNewZoomSystem();
  setupDebugTools();
  initUIDiagnostics();
}

function initializeNewZoomSystem() {
  ZoomIndicator.initialize();
  document.addEventListener('keydown', (e) => {
    const activeElement = document.activeElement.tagName.toLowerCase();
    if (['input', 'textarea'].includes(activeElement)) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
      e.preventDefault();
      store.emit('zoomIn');
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      store.emit('zoomOut');
    }

    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      if (LayoutService.resetZoom) {
        LayoutService.resetZoom();
      }
    }
  });
}

function setupDebugTools() {
  window.debugZoom = {
    info: () => LayoutService.getViewportInfo ? LayoutService.getViewportInfo() : 'Viewport info not available',
    zoomTo: (level) => {
      logger.debug('Debug Tools', `Setting zoom to ${level}`, null, 'zoom');
    },
    scrollTo: (position) => {
      logger.debug('Debug Tools', `Scrolling to position ${position}`, null, 'scroll');
      if (LayoutService.scroll) {
        const viewportInfo = LayoutService.getViewportInfo();
        const currentScrollPixels = viewportInfo.scrollPosition * (store.state.fullRowData.length * store.state.cellHeight * 0.5);
        const targetScrollPixels = position * (store.state.fullRowData.length * store.state.cellHeight * 0.5);
        LayoutService.scroll(targetScrollPixels - currentScrollPixels);
      }
    },
    scrollToNote: (noteName) => {
      logger.debug('Debug Tools', `Scrolling to note ${noteName}`, null, 'scroll');
      if (LayoutService.scrollToNote) {
        LayoutService.scrollToNote(noteName);
      }
    }
  };
}
