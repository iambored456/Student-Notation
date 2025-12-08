// js/components/canvas/drumGrid/drumGrid.js
import store from '@state/index.ts';
import CanvasContextService from '@services/canvasContextService.ts';
import { drawDrumGrid, type DrumGridRenderOptions } from './drumGridRenderer.ts';
import { getDrumNotes, getPlacedTonicSigns } from '@state/selectors.ts';
import { getVolumeIconState } from './drumGridInteractor.js';
import DrumPlayheadRenderer from './drumPlayheadRenderer.js';

function renderDrumGrid(): void {
  const ctx = CanvasContextService.getDrumContext();
  if (!ctx?.canvas) {
    return;
  }

  const renderOptions: DrumGridRenderOptions = {
    placedNotes: getDrumNotes(store.state),
    placedTonicSigns: getPlacedTonicSigns(store.state),
    columnWidths: store.state.columnWidths,
    musicalColumnWidths: store.state.musicalColumnWidths,
    cellWidth: store.state.cellWidth,
    cellHeight: store.state.cellHeight,
    macrobeatGroupings: store.state.macrobeatGroupings,
    macrobeatBoundaryStyles: store.state.macrobeatBoundaryStyles,
    modulationMarkers: store.state.modulationMarkers,
    baseMicrobeatPx: store.state.cellWidth,
    volumeIconState: getVolumeIconState()
  };

  drawDrumGrid(ctx, renderOptions);
}

const DrumGridController = {
  animationFrameId: null as number | null,

  render(): void {
    renderDrumGrid();

    // If there are active animations, keep rendering
    if (DrumPlayheadRenderer.hasActiveAnimations()) {
      if (!DrumGridController.animationFrameId) {
        DrumGridController.startAnimationLoop();
      }
    } else {
      DrumGridController.stopAnimationLoop();
    }
  },

  startAnimationLoop(): void {
    if (DrumGridController.animationFrameId) {return;}

    const animate = () => {
      DrumPlayheadRenderer.cleanupAnimations();
      renderDrumGrid();

      if (DrumPlayheadRenderer.hasActiveAnimations()) {
        DrumGridController.animationFrameId = requestAnimationFrame(animate);
      } else {
        DrumGridController.animationFrameId = null;
      }
    };

    DrumGridController.animationFrameId = requestAnimationFrame(animate);
  },

  stopAnimationLoop(): void {
    if (DrumGridController.animationFrameId) {
      cancelAnimationFrame(DrumGridController.animationFrameId);
      DrumGridController.animationFrameId = null;
    }
  }
};

// Make globally accessible for interactor
window.drumGridRenderer = DrumGridController;

export default DrumGridController;
