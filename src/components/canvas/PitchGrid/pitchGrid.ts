// js/components/canvas/pitchGrid/pitchGrid.ts
import store from '@state/index.ts';
import CanvasContextService from '@services/canvasContextService.ts';
import { drawPitchGrid } from './renderers/pitchGridRenderer.js';
import { renderRhythmUI } from '@components/canvas/macrobeatTools/rhythmUI.js';
import { renderTimeSignatureDisplay } from '@components/canvas/macrobeatTools/timeSignatureDisplay.js';
import { getPitchNotes, getPlacedTonicSigns } from '@state/selectors.ts';
import LayoutService from '@services/layoutService.ts';
import logger from '@utils/logger.ts';
import type { AppState, PlacedNote, TonicSign } from '../../../../types/state.js';

logger.moduleLoaded('PitchGridController', 'grid');

type RenderOptions = Pick<AppState,
  | 'fullRowData'
  | 'columnWidths'
  | 'cellWidth'
  | 'cellHeight'
  | 'macrobeatGroupings'
  | 'macrobeatBoundaryStyles'
  | 'degreeDisplayMode'
  | 'modulationMarkers'
  | 'accidentalMode'
  | 'showFrequencyLabels'
  | 'showOctaveLabels'
> & {
  placedNotes: PlacedNote[];
  placedTonicSigns: TonicSign[];
  rowHeight: number;
  colorMode: 'color' | 'bw';
  zoomLevel: number;
  viewportHeight: number;
};

function renderPitchGrid() {
  const ctx = CanvasContextService.getPitchContext();
  if (!ctx?.canvas) {
    logger.error('PitchGridController', 'Pitch grid context not available for rendering', null, 'grid');
    return;
  }

  const viewportInfo = LayoutService.getViewportInfo();

  const renderOptions: RenderOptions = {
    placedNotes: getPitchNotes(store.state),
    placedTonicSigns: getPlacedTonicSigns(store.state),
    fullRowData: store.state.fullRowData,
    columnWidths: store.state.columnWidths,
    cellWidth: store.state.cellWidth,
    cellHeight: store.state.cellHeight,
    rowHeight: store.state.cellHeight * 0.5,
    macrobeatGroupings: store.state.macrobeatGroupings,
    macrobeatBoundaryStyles: store.state.macrobeatBoundaryStyles,
    accidentalMode: store.state.accidentalMode,
    showFrequencyLabels: store.state.showFrequencyLabels,
    showOctaveLabels: store.state.showOctaveLabels,
    colorMode: 'color',
    degreeDisplayMode: store.state.degreeDisplayMode,
    zoomLevel: viewportInfo.zoomLevel,
    viewportHeight: viewportInfo.containerHeight,
    modulationMarkers: store.state.modulationMarkers
  };

  logger.debug('PitchGridController', 'renderPitchGrid options', {
    columns: renderOptions.columnWidths?.length,
    rows: renderOptions.fullRowData?.length,
    placedNotes: renderOptions.placedNotes.length,
    tonicSigns: renderOptions.placedTonicSigns.length,
    zoomLevel: renderOptions.zoomLevel,
    viewportHeight: renderOptions.viewportHeight
  }, 'grid');

  drawPitchGrid(ctx, renderOptions);
}

const PitchGridController = {
  render() {
    renderPitchGrid();
  },

  renderMacrobeatTools() {
    renderRhythmUI();
    renderTimeSignatureDisplay();
  }
};

export default PitchGridController;
