// js/components/HarmonicMultislider/harmonicMultislider.js
import Nexus from 'nexusui';
import store from '../../state/store.js';

console.log("HarmonicMultislider: Module loaded.");

export function initHarmonicMultislider() {
    const multislider = new Nexus.Multislider('#harmonic-multislider', {
        size: [400, 150], // Or use CSS to define size
        numberOfSliders: 11,
        min: 0,
        max: 1,
        step: 0.001,
        values: store.state.harmonicLevels
    });

    // When the user interacts with the slider, update the store's state
    multislider.on('change', (values) => {
        store.state.harmonicLevels = values;
        // Emit an event so the synthEngine knows to update the partials
        store.emit('harmonicLevelsChanged', values);
    });
    
    // When a preset button is clicked, it will change the store,
    // and we listen for that change to update the UI here.
    store.on('harmonicPresetChanged', (presetValues) => {
        if (Array.isArray(presetValues) && presetValues.length === 11) {
            multislider.setAllSliders(presetValues);
            // Also update the state directly, as this change comes from outside
            store.state.harmonicLevels = presetValues;
            console.log("HarmonicMultislider: UI updated from preset.");
        }
    });

    console.log("HarmonicMultislider: Initialized.");
}