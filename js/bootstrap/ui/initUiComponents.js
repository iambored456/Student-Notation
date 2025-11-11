// js/bootstrap/ui/initUiComponents.js
import Toolbar from '@components/toolbar/toolbar.js';
import GridManager from '@components/canvas/pitchGrid/gridManager.js';
import PrintPreview from '@components/ui/printPreview.js';
import StampsToolbar from '@components/rhythm/stampsToolbar/stampsToolbar.js';
import TripletsToolbar from '@components/rhythm/stampsToolbar/tripletsToolbar.js';

export async function initUiComponents() {
    Toolbar.init();
    GridManager.init();
    PrintPreview.init();
    StampsToolbar.init();
    TripletsToolbar.init();
}
