// js/state/actions/timbreActions.js
import { createDefaultFilterState } from '../initialState/timbres.js';
import logger from '../../utils/logger.js';

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
            console.log('setFilterSettings called:', { color, newSettings, activePresetName: this.state.timbres[color].activePresetName });
            console.trace('setFilterSettings call stack');
            Object.assign(this.state.timbres[color].filter, newSettings);
            const blend = this.state.timbres[color].filter.blend;
            if (blend <= 0.0) this.state.timbres[color].filter.type = 'highpass';
            else if (blend >= 2.0) this.state.timbres[color].filter.type = 'lowpass';
            else this.state.timbres[color].filter.type = 'bandpass';
            if(newSettings.enabled === undefined) {
                console.log('Clearing activePresetName because enabled is undefined');
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

    /**
     * Update the harmonic phase offsets for a given timbre.  The phases array
     * should be a Float32Array whose length matches the number of harmonic
     * bins.  Each value represents the phase of the corresponding harmonic
     * (in radians).  Changing the phase offsets will trigger a timbre
     * update event so that the synthesizer can rebuild its periodic wave.
     */
    setHarmonicPhases(color, phases) {
        if (this.state.timbres[color]) {
            logger.debug('TimbreActions', `setHarmonicPhases called for ${color}`, null, 'state');
            logger.debug('TimbreActions', 'Old phases', { phases: this.state.timbres[color].phases }, 'state');
            logger.debug('TimbreActions', 'New phases', { phases }, 'state');
            logger.debug('TimbreActions', 'Coefficients before phase change', { coeffs: this.state.timbres[color].coeffs }, 'state');
            
            this.state.timbres[color].phases = phases;
            this.state.timbres[color].activePresetName = null;
            
            logger.debug('TimbreActions', 'Coefficients after phase change', { coeffs: this.state.timbres[color].coeffs }, 'state');
            logger.debug('TimbreActions', 'Emitting timbreChanged for phase change', null, 'state');
            
            this.emit('timbreChanged', color);
        }
    },

    // REMOVED: setTimbreAmplitude (amplitude normalization feature removed)

    applyPreset(color, preset) {
        if (!preset || !this.state.timbres[color]) return;

        logger.debug('TimbreActions', `applyPreset called for ${color}`, null, 'state');
        logger.debug('TimbreActions', 'Preset name', { name: preset.name }, 'state');
        logger.debug('TimbreActions', 'Preset coeffs', { coeffs: preset.coeffs }, 'state');
        logger.debug('TimbreActions', 'Old timbre coeffs', { coeffs: this.state.timbres[color].coeffs }, 'state');

        this.state.timbres[color].adsr = preset.adsr;
        this.state.timbres[color].coeffs = new Float32Array(preset.coeffs);
        if (preset.phases) {
            this.state.timbres[color].phases = new Float32Array(preset.phases);
        } else {
            this.state.timbres[color].phases = new Float32Array(this.state.timbres[color].coeffs.length).fill(0);
        }
        this.state.timbres[color].activePresetName = preset.name;
        // Store preset gain for amplitude compensation
        this.state.timbres[color].gain = preset.gain || 1.0;
        if (preset.filter) {
            this.state.timbres[color].filter = JSON.parse(JSON.stringify(preset.filter));
        } else {
            this.state.timbres[color].filter = createDefaultFilterState();
        }

        logger.debug('TimbreActions', 'Applied preset - new coeffs', { coeffs: this.state.timbres[color].coeffs }, 'state');

        this.emit('timbreChanged', color);
        this.recordState();
    },
};