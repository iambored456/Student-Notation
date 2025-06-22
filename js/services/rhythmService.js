// js/services/rhythmService.js
import store from '../state/store.js';
import ConfigService from './configService.js';

console.log("RhythmService: Module loaded.");

const RhythmService = {
    /**
     * Computes the layout data for the time signature display.
     * @returns {Array<object>} An array of segment objects with label, position, and type.
     */
    getTimeSignatureSegments() {
        const segments = [];
        let segmentMicrobeatTotal = 0;
        let startColumn = 2;
        let isAnacrusisSegment = true;
        let containsThreeGrouping = false; 

        store.state.macrobeatGroupings.forEach((groupValue, index) => {
            segmentMicrobeatTotal += groupValue;
            if (groupValue === 3) containsThreeGrouping = true;

            const isLastBeat = (index === store.state.macrobeatGroupings.length - 1);
            const isSolidBoundary = (store.state.macrobeatBoundaryStyles[index] === 'solid');

            if (isSolidBoundary || isLastBeat) {
                const segmentStartX = ConfigService.getColumnX(startColumn);
                const segmentEndX = ConfigService.getColumnX(startColumn + segmentMicrobeatTotal);
                
                const label = containsThreeGrouping 
                    ? `${segmentMicrobeatTotal}/8` 
                    : `${segmentMicrobeatTotal / 2}/4`;

                segments.push({
                    label: label,
                    centerX: (segmentStartX + segmentEndX) / 2,
                    isAnacrusis: isAnacrusisSegment,
                });
                
                startColumn += segmentMicrobeatTotal;
                segmentMicrobeatTotal = 0; 
                containsThreeGrouping = false;
                if (isSolidBoundary) isAnacrusisSegment = false; 
            }
        });
        return segments;
    },

    /**
     * Computes the layout data for the rhythm UI control buttons.
     * @returns {Array<object>} An array of button data objects with type, content, position, and index.
     */
    getRhythmUIButtons() {
        const buttons = [];
        let currentColumn = 2;

        store.state.macrobeatGroupings.forEach((group, index) => {
            const startX = ConfigService.getColumnX(currentColumn);
            const endX = ConfigService.getColumnX(currentColumn + group);
            const centerX = (startX + endX) / 2;

            // Grouping button (e.g., '2' or '3')
            buttons.push({
                type: 'grouping',
                content: group,
                x: centerX,
                y: 0,
                index: index,
            });

            if (index < store.state.macrobeatGroupings.length - 1) {
                const style = store.state.macrobeatBoundaryStyles[index];
                let content;
                switch (style) {
                    case 'solid': content = '●'; break;
                    case 'anacrusis': content = 'x'; break;
                    default: content = '○'; break;
                }
                // Boundary button (e.g., '●' or '○')
                buttons.push({
                    type: 'boundary',
                    content: content,
                    x: endX,
                    y: 22,
                    index: index,
                });
            }

            currentColumn += group;
        });
        return buttons;
    }
};

export default RhythmService;