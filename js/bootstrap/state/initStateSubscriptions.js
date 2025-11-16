// js/bootstrap/state/initStateSubscriptions.js
import LayoutService from '@services/layoutService.js';
import GridManager from '@components/canvas/pitchGrid/gridManager.js';
import PitchGridController from '@components/canvas/pitchGrid/pitchGrid.js';
import PrintService from '@services/printService.js';

export function initStateSubscriptions(store, componentReadiness) {
  const renderAll = () => {
    if (!componentReadiness.uiComponents) {
      return;
    }
    GridManager.renderPitchGrid();
    GridManager.renderDrumGrid();
  };

  store.on('notesChanged', renderAll);
  store.on('stampPlacementsChanged', renderAll);
  store.on('tripletPlacementsChanged', renderAll);
  store.on('modulationMarkersChanged', () => {
    LayoutService.recalculateLayout();
    renderAll();
    PitchGridController.renderMacrobeatTools();
    PrintService.invalidateButtonGridSnapshot();
  });
  store.on('rhythmStructureChanged', () => {
    LayoutService.recalculateLayout();
    renderAll();
    PitchGridController.renderMacrobeatTools();
    PrintService.invalidateButtonGridSnapshot();
  });
  store.on('layoutConfigChanged', () => {
    renderAll();
    PitchGridController.renderMacrobeatTools();
    PrintService.invalidateButtonGridSnapshot();
  });
  store.on('zoomIn', () => LayoutService.zoomIn());
  store.on('zoomOut', () => LayoutService.zoomOut());

  // Initial render
  renderAll();
  PitchGridController.renderMacrobeatTools();

  return { renderAll };
}
