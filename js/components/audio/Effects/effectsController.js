// js/components/Effects/effectsController.js

import logger from '../../../utils/logger.js';
import store from '../../../state/index.js';
import effectsCoordinator from '../../../services/timbreEffects/effectsCoordinator.js';

class EffectsController {
    constructor() {
        this.currentEffect = null;
        this.effectControlsContainer = null;
        this.effectButtons = [];
        this.dials = [];
        this.currentColor = null;
        this.isDialInteractionActive = false;
        
        this.effectConfigs = {
            reverb: {
                name: 'Reverb',
                controls: {
                    decay: { label: 'Time', min: 0, max: 100, default: 0, unit: '%' },     // x-axis
                    roomSize: { label: 'Size', min: 0, max: 100, default: 0, unit: '%' },   // y-axis
                    wet: { label: 'Mix', min: 0, max: 100, default: 10, unit: '%' }        // mix slider
                }
            },
            delay: {
                name: 'Delay',
                controls: {
                    time: { label: 'Time', min: 0, max: 100, default: 0, unit: '%' },      // x-axis
                    feedback: { label: 'Echoes', min: 0, max: 95, default: 0, unit: '%' }, // y-axis
                    wet: { label: 'Mix', min: 0, max: 100, default: 15, unit: '%' }        // mix slider
                }
            },
            vibrato: {
                name: 'Vibrato',
                controls: {
                    speed: { label: 'Speed', min: 0, max: 100, default: 0, unit: '%' },     // x-axis
                    span: { label: 'Span', min: 0, max: 100, default: 0, unit: '%' }       // y-axis
                }
            },
            tremolo: {
                name: 'Tremolo',
                controls: {
                    speed: { label: 'Speed', min: 0, max: 100, default: 0, unit: '%' },     // x-axis
                    span: { label: 'Span', min: 0, max: 100, default: 0, unit: '%' }       // y-axis
                }
            }
        };
    }

    init() {
        logger.initStart('Effects Controller');

        this.effectControlsContainer = document.getElementById('effect-controls');
        this.effectButtons = document.querySelectorAll('.effect-button[data-effect]');

        if (!this.effectControlsContainer || this.effectButtons.length === 0) {
            logger.initFailed('Effects Controller', 'Required DOM elements not found');
            return false;
        }

        this.setupEventListeners();
        this.initializeSelectedColorTracking();
        this.setupGlobalMouseUpHandler();
        logger.initSuccess('Effects Controller');
        return true;
    }

    setupGlobalMouseUpHandler() {
        // Handle mouseup anywhere on the document to end dial interactions
        // This catches cases where user drags outside the slider and releases
        document.addEventListener('mouseup', () => {
            if (this.isDialInteractionActive) {
                this.onDialInteractionEnd(this.currentEffect);
            }
        });
    }

    setupEventListeners() {
        this.effectButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const effect = e.target.dataset.effect;
                this.selectEffect(effect);
            });
        });
    }

    selectEffect(effectType) {
        logger.debug('Effects', `Selecting effect: ${effectType}`, null, 'ui');
        
        // Allow all configured effects (vibrato, tremolo, reverb, delay)
        if (!this.effectConfigs[effectType]) {
            logger.info('Effects', `Effect ${effectType} not configured`, null, 'ui');
            return;
        }
        
        // Update button states
        this.effectButtons.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.effect === effectType) {
                btn.classList.add('active');
            }
        });
        
        // If same effect is clicked again, deselect it
        if (this.currentEffect === effectType) {
            this.currentEffect = null;
            this.hideEffectControls();
            return;
        }
        
        this.currentEffect = effectType;
        this.showEffectControls(effectType);
    }

    showEffectControls(effectType) {
        const config = this.effectConfigs[effectType];
        if (!config) {
            logger.warn('Effects', `No configuration found for effect: ${effectType}`, null, 'ui');
            return;
        }

        // Clear existing controls
        this.clearControls();

        // Create controls container
        this.effectControlsContainer.innerHTML = '<div class="effect-controls"></div>';
        const controlsContainer = this.effectControlsContainer.querySelector('.effect-controls');

        // Create simple sliders for each control
        Object.entries(config.controls).forEach(([key, control]) => {
            // Get current value from effectsCoordinator for this color and effect
            const effectParams = this.currentColor ? effectsCoordinator.getEffectParameters(this.currentColor, effectType) : null;
            const currentValue = effectParams?.[key] || 0;

            const sliderContainer = document.createElement('div');
            sliderContainer.className = 'effect-slider-group';
            sliderContainer.style.cssText = 'margin-bottom: 15px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;';
            controlsContainer.appendChild(sliderContainer);
            
            // Add label
            const label = document.createElement('label');
            label.className = 'effect-slider-label';
            label.textContent = control.label;
            label.style.cssText = 'display: block; margin-bottom: 5px; font-weight: bold; color: #333;';
            sliderContainer.appendChild(label);
            
            // Create slider
            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = control.min;
            slider.max = control.max;
            slider.value = currentValue; // Use current value from effectsCoordinator
            slider.className = 'effect-slider';
            slider.style.cssText = 'width: 100%; margin: 5px 0;';
            sliderContainer.appendChild(slider);
            
            // Add value display
            const valueDisplay = document.createElement('div');
            valueDisplay.className = 'effect-slider-value';
            const displayValue = control.unit ? `${Math.round(currentValue)}${control.unit}` : Math.round(currentValue);
            valueDisplay.textContent = displayValue;
            valueDisplay.style.cssText = 'text-align: center; font-size: 12px; color: #666;';
            sliderContainer.appendChild(valueDisplay);
            
            // Store slider reference
            this.dials.push({ 
                dial: { 
                    element: slider, 
                    value: currentValue,
                    destroy: () => {} // No cleanup needed for native inputs
                }, 
                control: key, 
                effectType, 
                valueDisplay, 
                controlConfig: control 
            });
            
            // Setup slider change listeners - handle both dragging (input) and click-to-position (change)
            const handleSliderChange = (e) => {
                const value = parseFloat(e.target.value);
                const displayValue = control.unit ? `${Math.round(value)}${control.unit}` : Math.round(value);
                valueDisplay.textContent = displayValue;
                logger.debug('Effects', `${effectType} ${key}: ${value}`, null, 'audio');
                this.onEffectParameterChange(effectType, key, value);
            };

            // Track when user starts dragging the slider - triggers visual effects
            slider.addEventListener('mousedown', (e) => {
                this.onDialInteractionStart(effectType);
            });

            // Track when user stops dragging the slider - stops visual effects
            slider.addEventListener('mouseup', (e) => {
                this.onDialInteractionEnd(effectType);
            });

            // Also handle when mouse leaves the slider while dragging
            slider.addEventListener('mouseleave', (e) => {
                // Only end interaction if mouse is actually down (dragging)
                if (e.buttons === 1) {
                    // Mouse is still pressed but left the slider
                    // Will end on document mouseup (handled below)
                }
            });

            // Also handle touch events for mobile
            slider.addEventListener('touchstart', (e) => {
                this.onDialInteractionStart(effectType);
            });

            slider.addEventListener('touchend', (e) => {
                this.onDialInteractionEnd(effectType);
            });

            slider.addEventListener('input', handleSliderChange); // During dragging
            slider.addEventListener('change', handleSliderChange); // Click-to-position
        });
        
        this.effectControlsContainer.classList.add('active');
    }

    hideEffectControls() {
        this.clearControls();
        this.effectControlsContainer.classList.remove('active');
        this.effectControlsContainer.innerHTML = '';
        
        // Remove active state from all buttons
        this.effectButtons.forEach(btn => btn.classList.remove('active'));
    }

    clearControls() {
        // Clean up existing controls (sliders don't need special cleanup)
        this.dials.forEach(({ dial }) => {
            if (dial.destroy) {
                dial.destroy();
            }
        });
        this.dials = [];
    }


    onEffectParameterChange(effectType, parameter, value) {
        // This method would be called when an effect parameter changes
        logger.debug('Effects', `Effect parameter changed: ${effectType}.${parameter} = ${value}`, null, 'audio');

        // Get the current color
        const currentColor = store.state.selectedNote?.color;

        if (!currentColor) {
            logger.warn('Effects', 'Cannot update effect parameter: no color selected', { effectType, parameter, value }, 'audio');
            return;
        }

        // Use the effects coordinator to handle all effect changes
        effectsCoordinator.updateParameter(effectType, parameter, value, currentColor);

        // Emit general event that other parts of the system can listen to (for backward compatibility)
        store.emit('effectParameterChanged', { effectType, parameter, value, color: currentColor });
    }

    /**
     * Called when user starts dragging a dial for vibrato/tremolo
     * Triggers visual effects on canvas notes and waveforms
     */
    onDialInteractionStart(effectType) {
        if (this.isDialInteractionActive) return; // Already active

        // Only trigger visual effects for vibrato and tremolo
        if (effectType !== 'vibrato' && effectType !== 'tremolo') {
            return;
        }

        this.isDialInteractionActive = true;
        const currentColor = store.state.selectedNote?.color;

        if (!currentColor) {
            logger.debug('Effects', 'Dial interaction started but no color selected', null, 'ui');
            return;
        }

        // Emit event to trigger visual effects during dial interaction
        // This simulates a "preview" note interaction for the animation system
        store.emit('effectDialInteractionStart', {
            effectType,
            color: currentColor
        });

        logger.debug('Effects', `Dial interaction started for ${effectType} on ${currentColor}`, null, 'ui');
    }

    /**
     * Called when user stops dragging a dial
     * Stops visual effects preview
     */
    onDialInteractionEnd(effectType) {
        if (!this.isDialInteractionActive) return; // Not active

        this.isDialInteractionActive = false;
        const currentColor = store.state.selectedNote?.color;

        if (!currentColor) {
            return;
        }

        // Emit event to stop visual effects preview
        store.emit('effectDialInteractionEnd', {
            effectType,
            color: currentColor
        });

        logger.debug('Effects', `Dial interaction ended for ${effectType} on ${currentColor}`, null, 'ui');
    }

    getCurrentEffect() {
        return this.currentEffect;
    }

    getEffectParameters(effectType) {
        if (!this.effectConfigs[effectType]) {
            return null;
        }

        // Get parameters from effectsCoordinator (single source of truth)
        const currentColor = store.state.selectedNote?.color;
        if (!currentColor) {
            return null;
        }

        // Use effectsCoordinator if available, otherwise fall back to UI values
        if (window.effectsCoordinator) {
            return window.effectsCoordinator.getEffectParameters(currentColor, effectType);
        }

        // Fallback: get from UI sliders
        const parameters = {};
        this.dials.forEach(({ dial, control, effectType: sliderEffectType }) => {
            if (sliderEffectType === effectType) {
                parameters[control] = parseFloat(dial.element.value);
            }
        });
        
        return parameters;
    }


    /**
     * Initialize tracking of selected color changes
     */
    initializeSelectedColorTracking() {
        // Track current selected color
        this.currentColor = store.state.selectedNote?.color;
        
        // Listen for color changes
        store.on('selectedNoteChanged', () => {
            const newColor = store.state.selectedNote?.color;
            if (newColor !== this.currentColor) {
                this.currentColor = newColor;
                this.updateEffectButtonIndicators();
            }
        });

        // Listen for effect parameter changes to update indicators
        store.on('audioEffectChanged', () => {
            this.updateEffectButtonIndicators();
        });
        
        // Initial update
        this.updateEffectButtonIndicators();
    }

    /**
     * Update effect button indicators based on current color's active effects
     * Extracted from simpleEffectsTest.js
     */
    updateEffectButtonIndicators() {
        if (!this.effectButtons || !this.currentColor) return;
        
        this.effectButtons.forEach(button => {
            const effectType = button.getAttribute('data-effect');
            let isActive = false;
            
            // Get effect parameters from effectsCoordinator (single source of truth)
            const effectParams = effectsCoordinator.getEffectParameters(this.currentColor, effectType);
            
            // Check if this effect is active
            switch (effectType) {
                case 'vibrato':
                    isActive = effectParams.speed > 0 && effectParams.span > 0;
                    break;
                case 'tremolo':
                    isActive = effectParams.speed > 0 && effectParams.span > 0;
                    break;
                case 'reverb':
                    isActive = effectParams.roomSize > 0 || effectParams.decay > 0 || (effectParams.wet > 0 && (effectParams.roomSize > 0 || effectParams.decay > 0));
                    break;
                case 'delay':
                    isActive = effectParams.time > 0 || effectParams.feedback > 0 || (effectParams.wet > 0 && (effectParams.time > 0 || effectParams.feedback > 0));
                    break;
            }
            
            // Apply sub-active styling: background color without border
            if (isActive) {
                button.style.backgroundColor = this.currentColor;
                button.style.color = 'white';
                button.classList.add('effect-active');
            } else {
                button.style.backgroundColor = '';
                button.style.color = '';
                button.classList.remove('effect-active');
            }
        });
    }
}

// Create and export a singleton instance
const effectsController = new EffectsController();
export default effectsController;