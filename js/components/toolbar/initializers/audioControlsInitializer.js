// js/components/Toolbar/initializers/audioControlsInitializer.js
import store from '@state/index.js';
import { PRESETS } from '@services/presetData.js';
import DraggableNumber from '@components/ui/draggableNumber.js';
import tempoVisualizer from '../tempoVisualizer.js';
import tapTempo from '../tapTempo.js';
import logger from '@utils/logger.js';

const logTempoDebug = (event, details = {}) => {
    // Logging disabled
};

export function initAudioControls() {
    const tempoSlider = document.getElementById('tempo-slider');
    
    if (!tempoSlider) {
        logger.warn('AudioControlsInitializer', 'Tempo slider not found during initial load - will retry when rhythm tab is accessed', null, 'toolbar');
    }
    
    // Initialize DraggableNumber components for tempo inputs with app styling
    const tempoInputConfig = {
        size: [45, 24],
        step: 1,
        decimalPlaces: 0,
        useAppStyling: true
    };
    
    const eighthNoteInput = new DraggableNumber('#eighth-note-tempo', {
        ...tempoInputConfig,
        value: 180,
        min: 60,
        max: 480
    });
    
    const quarterNoteInput = new DraggableNumber('#quarter-note-tempo', {
        ...tempoInputConfig,
        value: 90,
        min: 30,
        max: 240
    });
    
    const dottedQuarterInput = new DraggableNumber('#dotted-quarter-tempo', {
        ...tempoInputConfig,
        value: 60,
        min: 20,
        max: 160
    });

    function updateTempoDisplays(baseBPM) {
        const quarterBPM = Math.round(baseBPM);
        logTempoDebug('TempoUI:updateDisplays', {
            baseBPM,
            quarterBPM
        });

        // Update slider if it exists
        const currentSlider = tempoSlider || document.getElementById('tempo-slider');
        if (currentSlider && parseInt(currentSlider.value, 10) !== quarterBPM) {
            currentSlider.value = quarterBPM;
        }

        const eighthBPM = quarterBPM * 2;
        const dottedQuarterBPM = Math.round(quarterBPM / 1.5);

        if (eighthNoteInput.value !== eighthBPM) eighthNoteInput.passiveUpdate(eighthBPM);
        if (quarterNoteInput.value !== quarterBPM) quarterNoteInput.passiveUpdate(quarterBPM);
        if (dottedQuarterInput.value !== dottedQuarterBPM) dottedQuarterInput.passiveUpdate(dottedQuarterBPM);

        if (store.state.tempo !== quarterBPM) {
            store.setTempo(quarterBPM);
            tempoVisualizer.updateTempo();
            logTempoDebug('TempoUI:setTempo', { appliedTempo: quarterBPM });
        }
    }

    // State tracking for tempo slider pulse visualization
    let isSliderPressed = false;

    // Simple slider initialization
    if (tempoSlider) {
        // Log slider and container heights for debugging
        const logSliderHeights = () => {
            const tempoContentBox = document.querySelector('.tempo-content-box');
            const tempoContainer = document.querySelector('.tempo-container');
            const tempoColumn2 = document.querySelector('.tempo-column-2');

            logger.debug('AudioControlsInitializer', '[Tempo Slider Heights]', {
                slider: {
                    offsetHeight: tempoSlider.offsetHeight,
                    clientHeight: tempoSlider.clientHeight,
                    scrollHeight: tempoSlider.scrollHeight,
                    computedHeight: getComputedStyle(tempoSlider).height,
                    computedMaxHeight: getComputedStyle(tempoSlider).maxHeight
                },
                tempoColumn2: tempoColumn2 ? {
                    offsetHeight: tempoColumn2.offsetHeight,
                    clientHeight: tempoColumn2.clientHeight,
                    computedHeight: getComputedStyle(tempoColumn2).height
                } : 'not found',
                tempoContainer: tempoContainer ? {
                    offsetHeight: tempoContainer.offsetHeight,
                    clientHeight: tempoContainer.clientHeight,
                    computedHeight: getComputedStyle(tempoContainer).height,
                    computedFlex: getComputedStyle(tempoContainer).flex
                } : 'not found',
                tempoContentBox: tempoContentBox ? {
                    offsetHeight: tempoContentBox.offsetHeight,
                    clientHeight: tempoContentBox.clientHeight,
                    computedHeight: getComputedStyle(tempoContentBox).height
                } : 'not found'
            });
        };

        // Log immediately and after a delay to see if values change
        setTimeout(logSliderHeights, 100);
        setTimeout(logSliderHeights, 500);

        // Start pulse on mouse/touch down
        tempoSlider.addEventListener('mousedown', () => {
            isSliderPressed = true;
            tempoVisualizer.start();
            logTempoDebug('TempoUI:slider-down');
        });

        tempoSlider.addEventListener('touchstart', () => {
            isSliderPressed = true;
            tempoVisualizer.start();
            logTempoDebug('TempoUI:slider-touchstart');
        });

        // Update tempo on input
        tempoSlider.addEventListener('input', (e) => {
            const tempo = parseInt(e.target.value, 10);
            updateTempoDisplays(tempo);
            logTempoDebug('TempoUI:slider-input', { sliderTempo: tempo });
        });

        // Blur on mouseup to remove focus
        tempoSlider.addEventListener('mouseup', function() {
            this.blur();
        });

        // Set initial value
        updateTempoDisplays(store.state.tempo);
    } else {
        logger.warn('AudioControlsInitializer', 'Tempo slider not found - will initialize when rhythm tab is opened', null, 'toolbar');
    }
    
    // Set up draggable number inputs (these should work regardless of tab visibility)
    eighthNoteInput.on('change', (val) => { if (!isNaN(val) && val > 0) updateTempoDisplays(val / 2); });
    quarterNoteInput.on('change', (val) => { if (!isNaN(val) && val > 0) updateTempoDisplays(val); });
    dottedQuarterInput.on('change', (val) => { if (!isNaN(val) && val > 0) updateTempoDisplays(val * 1.5); });
    
    // Initialize tempo displays with current state value
    updateTempoDisplays(store.state.tempo);

    // Global event listeners to stop tempo pulse on mouse/touch release
    document.addEventListener('mouseup', () => {
        if (isSliderPressed) {
            isSliderPressed = false;
            tempoVisualizer.stop();
            logTempoDebug('TempoUI:slider-up');
        }
    });

    document.addEventListener('touchend', () => {
        if (isSliderPressed) {
            isSliderPressed = false;
            tempoVisualizer.stop();
            logTempoDebug('TempoUI:slider-touchend');
        }
    });

    document.addEventListener('touchcancel', () => {
        if (isSliderPressed) {
            isSliderPressed = false;
            tempoVisualizer.stop();
            logTempoDebug('TempoUI:slider-touchcancel');
        }
    });

    const presetContainer = document.querySelector('.preset-effects-container');
    document.querySelectorAll('.preset-button').forEach(button => {
        const presetId = button.id.replace('preset-', '');
        const preset = PRESETS[presetId];
        if (preset) {
            button.addEventListener('click', () => {
                // THE FIX: Get the current color from the selectedNOTE, not the selectedTOOL.
                const currentColor = store.state.selectedNote?.color;
                if (currentColor) {
                    store.applyPreset(currentColor, preset);
                    // Immediately update the selection to show the highlight
                    setTimeout(() => {
                        try {
                            updatePresetSelection(currentColor);
                        } catch (error) {
                        }
                    }, 10);
                } else {
                }
                button.blur(); // Remove focus to prevent lingering blue highlight
            });
        }
    });

    const darkenColor = (hex, percent = 20) => {
        // Convert hex to RGB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        // Darken each component
        const darkenedR = Math.max(0, Math.floor(r * (1 - percent / 100)));
        const darkenedG = Math.max(0, Math.floor(g * (1 - percent / 100)));
        const darkenedB = Math.max(0, Math.floor(b * (1 - percent / 100)));
        
        // Convert back to hex
        return `#${darkenedR.toString(16).padStart(2, '0')}${darkenedG.toString(16).padStart(2, '0')}${darkenedB.toString(16).padStart(2, '0')}`;
    };

    const lightenColor = (hex, percent = 50) => {
        // Convert hex to RGB
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        // Lighten each component towards white
        const lightenedR = Math.min(255, Math.floor(r + (255 - r) * (percent / 100)));
        const lightenedG = Math.min(255, Math.floor(g + (255 - g) * (percent / 100)));
        const lightenedB = Math.min(255, Math.floor(b + (255 - b) * (percent / 100)));
        
        // Convert back to hex
        return `#${lightenedR.toString(16).padStart(2, '0')}${lightenedG.toString(16).padStart(2, '0')}${lightenedB.toString(16).padStart(2, '0')}`;
    };

    const updatePresetSelection = (color) => {
        if (!color || !presetContainer) {
            return;
        }
        const timbre = store.state.timbres[color];
        
        // Get the light color from the color palette for button backgrounds
        const palette = store.state.colorPalette[color] || { primary: color, light: color };
        const lightColor = palette.light;
        const primaryColor = palette.primary;
        
        // Debug logging
        
        document.querySelectorAll('.preset-button').forEach(btn => {
            const presetId = btn.id.replace('preset-', '');
            const isSelected = timbre && timbre.activePresetName === presetId;
            btn.classList.toggle('selected', isSelected);
            if (isSelected) {
            }
        });
        
        // Create an even lighter version for button backgrounds
        const extraLightColor = lightenColor(lightColor, 60);
        
        // Use extra light color for button backgrounds, primary for text/borders
        presetContainer.style.setProperty('--c-accent', primaryColor);
        presetContainer.style.setProperty('--c-accent-light', extraLightColor);
        presetContainer.style.setProperty('--c-accent-hover', darkenColor(primaryColor, 20));
        
    };
    
    // THE FIX: Listen for 'noteChanged' to update the UI when the color changes.
    store.on('noteChanged', ({ newNote }) => {
        if (newNote.color) {
            updatePresetSelection(newNote.color);
        } else {
            // Handle cases where there might not be a color (e.g. eraser tool selected)
            document.querySelectorAll('.preset-button').forEach(btn => btn.classList.remove('selected'));
            if(presetContainer) {
                presetContainer.style.setProperty('--c-accent', '#4A90E2'); // Reset to default
                presetContainer.style.setProperty('--c-accent-hover', '#357ABD'); // Reset to default
            }
        }
    });

    // THE FIX: Listen for 'timbreChanged' and check against the correct state property.
    store.on('timbreChanged', (color) => {
        if (color === store.state.selectedNote?.color) {
            updatePresetSelection(color);
        }
    });

    // Listen for tempo changes (e.g., from tap tempo)
    store.on('tempoChanged', (newTempo) => {
        updateTempoDisplays(newTempo);
    });

    // THE FIX: Get the initial color from the correct state property on load.
    const initialColor = store.state.selectedNote?.color;
    if (initialColor) {
        updatePresetSelection(initialColor);
    }
}

