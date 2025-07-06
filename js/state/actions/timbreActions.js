// js/state/actions/timbreActions.js
import { createDefaultFilterState } from '../initialState/timbres.js';

export const timbreActions = {
    setADSR(color, newADSR) {
        if(this.state.timbres[color]) {
            this.state.timbres[color].adsr = newADSR;
            this.state.timbres[color].activePresetName = null;
            this.emit('timbreChanged', color);
        }
    },

    setFilterSettings(color, newSettings) {
        if (this.state.timbres[color]) {
            Object.assign(this.state.timbres[color].filter, newSettings);
            const blend = this.state.timbres[color].filter.blend;
            if (blend <= 0.0) this.state.timbres[color].filter.type = 'highpass';
            else if (blend >= 2.0) this.state.timbres[color].filter.type = 'lowpass';
            else this.state.timbres[color].filter.type = 'bandpass';
            if(newSettings.enabled === undefined) {
                this.state.timbres[color].activePresetName = null;
            }
            this.emit('timbreChanged', color);
        }
    },

    setHarmonicCoefficients(color, coeffs) {
        if(this.state.timbres[color]) {
            this.state.timbres[color].coeffs = coeffs;
            this.state.timbres[color].activePresetName = null;
            this.emit('timbreChanged', color);
        }
    },

    applyPreset(color, preset) {
        if (!preset || !this.state.timbres[color]) return;
        this.state.timbres[color].adsr = preset.adsr;
        this.state.timbres[color].coeffs = preset.coeffs;
        this.state.timbres[color].activePresetName = preset.name;
        if (preset.filter) {
            this.state.timbres[color].filter = JSON.parse(JSON.stringify(preset.filter));
        } else {
            this.state.timbres[color].filter = createDefaultFilterState();
        }
        this.emit('timbreChanged', color);
        this.recordState();
    },
};