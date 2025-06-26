// js/services/rhythmService.js
import store from '../state/store.js';
import LayoutService from './layoutService.js';

console.log("RhythmService: Module loaded.");

const RhythmService = {
    /**
     * Computes the layout data for the time signature display.
     * This logic must perfectly mirror how the grid columns are actually laid out.
     * @returns {Array<object>} An array of segment objects with label, position, and type.
     */
    getTimeSignatureSegments() {
        const segments = [];
        let columnCursor = 2;
        // FIX: Use the new store getter
        const sortedTonicSigns = [...store.placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
        let tonicSignCursor = 0;

        const advancePastTonicsAtBoundary = (mbIndex) => {
            while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
                columnCursor += 1;
                const uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
                while(sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].uuid === uuid) {
                    tonicSignCursor++;
                }
            }
        };

        advancePastTonicsAtBoundary(-1);

        let segmentStartColumn = columnCursor;
        let segmentMicrobeatTotal = 0;
        let containsThreeGrouping = false;
        let isAnacrusisSegment = true;

        store.state.macrobeatGroupings.forEach((groupValue, index) => {
            segmentMicrobeatTotal += groupValue;
            if (groupValue === 3) containsThreeGrouping = true;

            const isLastBeat = (index === store.state.macrobeatGroupings.length - 1);
            const isSolidBoundary = (store.state.macrobeatBoundaryStyles[index] === 'solid');

            if (isSolidBoundary || isLastBeat) {
                const segmentStartX = LayoutService.getColumnX(segmentStartColumn);
                const segmentEndColumn = segmentStartColumn + segmentMicrobeatTotal;
                const segmentEndX = LayoutService.getColumnX(segmentEndColumn);

                const label = containsThreeGrouping ? `${segmentMicrobeatTotal}/8` : `${segmentMicrobeatTotal / 2}/4`;

                segments.push({
                    label: label,
                    centerX: (segmentStartX + segmentEndX) / 2,
                    isAnacrusis: isAnacrusisSegment,
                });

                columnCursor += segmentMicrobeatTotal;
                advancePastTonicsAtBoundary(index);
                segmentStartColumn = columnCursor;
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
        let columnCursor = 2;
        // FIX: Use the new store getter
        const sortedTonicSigns = [...store.placedTonicSigns].sort((a, b) => a.preMacrobeatIndex - b.preMacrobeatIndex);
        let tonicSignCursor = 0;

        const advancePastTonicsAtBoundary = (mbIndex) => {
            while (sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].preMacrobeatIndex === mbIndex) {
                columnCursor += 1;
                 const uuid = sortedTonicSigns[tonicSignCursor]?.uuid;
                while(sortedTonicSigns[tonicSignCursor] && sortedTonicSigns[tonicSignCursor].uuid === uuid) {
                    tonicSignCursor++;
                }
            }
        };

        advancePastTonicsAtBoundary(-1);

        store.state.macrobeatGroupings.forEach((group, index) => {
            const startX = LayoutService.getColumnX(columnCursor);
            const endX = LayoutService.getColumnX(columnCursor + group);
            const centerX = (startX + endX) / 2;

            buttons.push({ type: 'grouping', content: group, x: centerX, y: 0, index: index });

            if (index < store.state.macrobeatGroupings.length - 1) {
                const style = store.state.macrobeatBoundaryStyles[index];
                let content;
                switch (style) {
                    case 'solid': content = '●'; break;
                    case 'anacrusis': content = 'x'; break;
                    default: content = '○'; break;
                }
                buttons.push({ type: 'boundary', content: content, x: endX, y: 22, index: index });
            }
            columnCursor += group;
            advancePastTonicsAtBoundary(index);
        });
        return buttons;
    }
};

export default RhythmService;