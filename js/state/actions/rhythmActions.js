// js/state/actions/rhythmActions.js
import { ANACRUSIS_ON_GROUPINGS, ANACRUSIS_ON_STYLES, ANACRUSIS_OFF_GROUPINGS, ANACRUSIS_OFF_STYLES } from '../initialState/rhythm.js';

export const rhythmActions = {
    setAnacrusis(enabled) {
        if (this.state.hasAnacrusis === enabled) return;
        
        this.state.hasAnacrusis = enabled;
        if (enabled) {
            this.state.macrobeatGroupings = [...ANACRUSIS_ON_GROUPINGS];
            this.state.macrobeatBoundaryStyles = [...ANACRUSIS_ON_STYLES];
        } else {
            this.state.macrobeatGroupings = [...ANACRUSIS_OFF_GROUPINGS];
            this.state.macrobeatBoundaryStyles = [...ANACRUSIS_OFF_STYLES];
        }

        this.emit('anacrusisChanged', enabled);
        this.emit('rhythmStructureChanged');
        this.recordState();
    },

    toggleMacrobeatGrouping(index) {
        if (index === undefined || index < 0 || index >= this.state.macrobeatGroupings.length) {
            console.error(`[Store] Invalid index for toggleMacrobeatGrouping: ${index}`);
            return;
        }

        const currentValue = this.state.macrobeatGroupings[index];
        this.state.macrobeatGroupings[index] = currentValue === 2 ? 3 : 2;

        this.emit('rhythmStructureChanged');
        this.recordState();
    },
    
    cycleMacrobeatBoundaryStyle(index) {
        if (index === undefined || index < 0 || index >= this.state.macrobeatBoundaryStyles.length) {
             console.error(`[Store] Invalid index for cycleMacrobeatBoundaryStyle: ${index}`);
            return;
        }
        const styles = ['dashed', 'solid', 'anacrusis'];
        const currentStyle = this.state.macrobeatBoundaryStyles[index];
        const currentIndex = styles.indexOf(currentStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        this.state.macrobeatBoundaryStyles[index] = styles[nextIndex];

        this.emit('rhythmStructureChanged');
        this.recordState();
    },
    
    increaseMacrobeatCount() {
        this.state.macrobeatGroupings.push(2);
        this.state.macrobeatBoundaryStyles.push('dashed');
        this.emit('rhythmStructureChanged');
        this.recordState();
    },
    
    decreaseMacrobeatCount() {
        if (this.state.macrobeatGroupings.length > 1) {
            this.state.macrobeatGroupings.pop();
            this.state.macrobeatBoundaryStyles.pop();
            this.emit('rhythmStructureChanged');
            this.recordState();
        }
    },
};