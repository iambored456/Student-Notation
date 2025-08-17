// js/services/rhythmService.js
import store from '../state/index.js';
import { getMacrobeatInfo } from '../state/selectors.js';
import LayoutService from './layoutService.js';
import { getColumnX } from '../components/Canvas/PitchGrid/renderers/rendererUtils.js';


const RhythmService = {
    /**
     * Computes the layout data for the time signature display.
     */
    getTimeSignatureSegments() {
        const segments = [];
        let isAnacrusisSegment = store.state.hasAnacrusis;

        let measureStartColumn = getMacrobeatInfo(store.state, 0).startColumn;
        let measureMicrobeatTotal = 0;
        let measureContainsThreeGrouping = false;

        store.state.macrobeatGroupings.forEach((groupValue, index) => {
            measureMicrobeatTotal += groupValue;
            if (groupValue === 3) measureContainsThreeGrouping = true;

            const isLastBeat = (index === store.state.macrobeatGroupings.length - 1);
            const boundaryStyle = store.state.macrobeatBoundaryStyles[index];
            const isSolidBoundary = (boundaryStyle === 'solid');

            if (isSolidBoundary || isLastBeat) {
                const measureEndColumn = getMacrobeatInfo(store.state, index).endColumn + 1;
                
                // Use modulated positions if modulation exists
                const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;
                let measureStartX, measureEndX;
                
                if (hasModulation) {
                    const renderOptions = {
                        ...store.state,
                        modulationMarkers: store.state.modulationMarkers,
                        cellWidth: store.state.cellWidth,
                        columnWidths: store.state.columnWidths,
                        baseMicrobeatPx: store.state.cellWidth
                    };
                    measureStartX = getColumnX(measureStartColumn, renderOptions);
                    measureEndX = getColumnX(measureEndColumn, renderOptions);
                } else {
                    measureStartX = LayoutService.getColumnX(measureStartColumn);
                    measureEndX = LayoutService.getColumnX(measureEndColumn);
                }
                
                const label = measureContainsThreeGrouping ? `${measureMicrobeatTotal}/8` : `${measureMicrobeatTotal / 2}/4`;
                
                segments.push({
                    label,
                    centerX: (measureStartX + measureEndX) / 2,
                    isAnacrusis: isAnacrusisSegment,
                });

                // Reset for next measure
                if (!isLastBeat) {
                    measureStartColumn = measureEndColumn;
                    measureMicrobeatTotal = 0;
                    measureContainsThreeGrouping = false;
                    if (isSolidBoundary) isAnacrusisSegment = false;
                }
            }
        });
        return segments;
    },

    /**
     * Computes the layout data for the rhythm UI control buttons.
     */
    getRhythmUIButtons() {
        const buttons = [];
        console.log('[RHYTHM-UI] Computing button positions...');
        console.log('[RHYTHM-UI] Modulation markers:', store.state.modulationMarkers);
        
        const hasModulation = store.state.modulationMarkers && store.state.modulationMarkers.length > 0;
        const renderOptions = hasModulation ? {
            ...store.state,
            modulationMarkers: store.state.modulationMarkers,
            cellWidth: store.state.cellWidth,
            columnWidths: store.state.columnWidths,
            baseMicrobeatPx: store.state.cellWidth
        } : null;
        
        console.log('[RHYTHM-UI] Using', hasModulation ? 'MODULATED' : 'BASE', 'positions for button placement');
        
        store.state.macrobeatGroupings.forEach((group, index) => {
            const { startColumn, endColumn } = getMacrobeatInfo(store.state, index);
            
            // Use modulated positions if modulation exists
            const startX = hasModulation ? 
                getColumnX(startColumn, renderOptions) : 
                LayoutService.getColumnX(startColumn);
            const endX = hasModulation ? 
                getColumnX(endColumn + 1, renderOptions) : 
                LayoutService.getColumnX(endColumn + 1);
            const centerX = (startX + endX) / 2;

            console.log(`[RHYTHM-UI] Macrobeat ${index}: columns ${startColumn}-${endColumn}, x ${startX.toFixed(1)}-${endX.toFixed(1)}, center: ${centerX.toFixed(1)} [${hasModulation ? 'modulated' : 'base'}]`);

            buttons.push({ type: 'grouping', content: group, x: centerX, y: 0, index });

            if (index < store.state.macrobeatGroupings.length - 1) {
                const style = store.state.macrobeatBoundaryStyles[index];
                let content;
                switch (style) {
                    case 'solid': content = '●'; break;
                    case 'anacrusis': content = 'x'; break;
                    default: content = '○'; break;
                }
                console.log(`[RHYTHM-UI] Boundary ${index}: style=${style}, x=${endX.toFixed(1)}, content=${content} [${hasModulation ? 'modulated' : 'base'}]`);
                buttons.push({ type: 'boundary', content, x: endX, y: 22, index });
            }
        });
        
        console.log('[RHYTHM-UI] Final button positions:', buttons.map(b => `${b.type}@${b.x.toFixed(1)}`));
        return buttons;
    }
};

export default RhythmService;