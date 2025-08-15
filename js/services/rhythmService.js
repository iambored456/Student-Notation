// js/services/rhythmService.js
import store from '../state/index.js';
import { getMacrobeatInfo } from '../state/selectors.js';
import LayoutService from './layoutService.js';


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
                const measureStartX = LayoutService.getColumnX(measureStartColumn);
                const measureEndX = LayoutService.getColumnX(measureEndColumn);
                
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
        store.state.macrobeatGroupings.forEach((group, index) => {
            const { startColumn, endColumn } = getMacrobeatInfo(store.state, index);
            const startX = LayoutService.getColumnX(startColumn);
            const endX = LayoutService.getColumnX(endColumn + 1);
            const centerX = (startX + endX) / 2;

            buttons.push({ type: 'grouping', content: group, x: centerX, y: 0, index });

            if (index < store.state.macrobeatGroupings.length - 1) {
                const style = store.state.macrobeatBoundaryStyles[index];
                let content;
                switch (style) {
                    case 'solid': content = '●'; break;
                    case 'anacrusis': content = 'x'; break;
                    default: content = '○'; break;
                }
                buttons.push({ type: 'boundary', content, x: endX, y: 22, index });
            }
        });
        return buttons;
    }
};

export default RhythmService;