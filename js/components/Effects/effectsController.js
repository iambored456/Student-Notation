// js/components/Effects/effectsController.js

import logger from '../../utils/logger.js';
import store from '../../state/index.js';

class EffectsController {
    constructor() {
        this.currentEffect = null;
        this.effectControlsContainer = null;
        this.effectButtons = [];
        this.dials = [];
        
        this.effectConfigs = {
            reverb: {
                name: 'Reverb',
                controls: {
                    roomSize: { label: 'Room Size', min: 0, max: 100, default: 50, unit: '%' },
                    decay: { label: 'Decay', min: 0, max: 100, default: 30, unit: '%' },
                    wet: { label: 'Wet/Dry', min: 0, max: 100, default: 25, unit: '%' }
                }
            },
            delay: {
                name: 'Delay',
                controls: {
                    time: { label: 'Time', min: 0, max: 100, default: 25, unit: '%' },
                    feedback: { label: 'Feedback', min: 0, max: 95, default: 40, unit: '%' },
                    wet: { label: 'Wet/Dry', min: 0, max: 100, default: 30, unit: '%' }
                }
            },
            phaser: {
                name: 'Phaser',
                controls: {
                    rate: { label: 'Rate', min: 0, max: 100, default: 50, unit: '%' },
                    depth: { label: 'Depth', min: 0, max: 100, default: 75, unit: '%' },
                    stages: { label: 'Stages', min: 2, max: 12, default: 6, unit: '' }
                }
            },
            vibratio: {
                name: 'Vibrato',
                controls: {
                    speed: { label: 'Speed', min: 0, max: 100, default: 40, unit: '%' },
                    span: { label: 'Span', min: 0, max: 100, default: 60, unit: '%' }
                }
            },
            tremelo: {
                name: 'Tremolo',
                controls: {
                    speed: { label: 'Speed', min: 0, max: 100, default: 35, unit: '%' },
                    span: { label: 'Span', min: 0, max: 100, default: 50, unit: '%' }
                }
            },
            portamento: {
                name: 'Portamento',
                controls: {
                    time: { label: 'Glide Time', min: 0, max: 100, default: 20, unit: '%' },
                    curve: { label: 'Curve', min: 0, max: 100, default: 50, unit: '%' },
                    legato: { label: 'Legato Only', min: 0, max: 1, default: 1, unit: '' }
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
        logger.initSuccess('Effects Controller');
        return true;
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
        
        // Only allow Reverb for now
        if (effectType !== 'reverb') {
            logger.info('Effects', `Effect ${effectType} not implemented yet - only Reverb available for testing`, null, 'ui');
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

        // Clear existing dials
        this.clearDials();
        
        // Create controls container
        this.effectControlsContainer.innerHTML = '<div class="effect-controls"></div>';
        const controlsContainer = this.effectControlsContainer.querySelector('.effect-controls');
        
        // Create dials for each control
        Object.entries(config.controls).forEach(([key, control]) => {
            const dialContainer = document.createElement('div');
            dialContainer.className = 'effect-control-group';
            controlsContainer.appendChild(dialContainer);
            
            // Add label
            const label = document.createElement('div');
            label.className = 'nexus-dial-label';
            label.textContent = control.label;
            dialContainer.appendChild(label);
            
            // Create dial container for nexus
            const nexusContainer = document.createElement('div');
            dialContainer.appendChild(nexusContainer);
            
            // Create custom dial (replace with your custom dial implementation)
            const dial = this.createCustomDial(nexusContainer, {
                min: control.min,
                max: control.max,
                value: control.default
            });
            
            // Add value display
            const valueDisplay = document.createElement('div');
            valueDisplay.className = 'nexus-dial-value';
            const displayValue = control.unit ? `${control.default}${control.unit}` : control.default;
            valueDisplay.textContent = displayValue;
            dialContainer.appendChild(valueDisplay);
            
            // Store dial reference
            this.dials.push({ dial, control: key, effectType, valueDisplay, controlConfig: control });
            
            // Setup dial change listener
            dial.on('change', (value) => {
                const displayValue = control.unit ? `${Math.round(value)}${control.unit}` : Math.round(value);
                valueDisplay.textContent = displayValue;
                logger.debug('Effects', `${effectType} ${key}: ${value}`, null, 'audio');
                this.onEffectParameterChange(effectType, key, value);
            });
        });
        
        // Debug logging for dial wrapper contents and dimensions
        console.log('=== DIAL WRAPPER DEBUG ===');
        Object.entries(config.controls).forEach(([key, control], index) => {
            const dialContainer = controlsContainer.children[index];
            console.log(`Dial ${key}:`);
            console.log('  Container children:', dialContainer.children.length);
            Array.from(dialContainer.children).forEach((child, childIndex) => {
                console.log(`    Child ${childIndex}:`, {
                    tagName: child.tagName,
                    className: child.className,
                    textContent: child.textContent?.slice(0, 20) || '',
                    offsetHeight: child.offsetHeight,
                    computedHeight: window.getComputedStyle(child).height,
                    marginTop: window.getComputedStyle(child).marginTop,
                    marginBottom: window.getComputedStyle(child).marginBottom,
                    paddingTop: window.getComputedStyle(child).paddingTop,
                    paddingBottom: window.getComputedStyle(child).paddingBottom
                });
            });
            console.log(`  Total container height: ${dialContainer.offsetHeight}px`);
            console.log(`  Container computed height: ${window.getComputedStyle(dialContainer).height}`);
            console.log(`  Container gap: ${window.getComputedStyle(dialContainer).gap}`);
            console.log('  ---');
        });
        console.log('=== END DIAL WRAPPER DEBUG ===');
        
        this.effectControlsContainer.classList.add('active');
    }

    hideEffectControls() {
        this.clearDials();
        this.effectControlsContainer.classList.remove('active');
        this.effectControlsContainer.innerHTML = '';
        
        // Remove active state from all buttons
        this.effectButtons.forEach(btn => btn.classList.remove('active'));
    }

    clearDials() {
        // Destroy existing dials
        this.dials.forEach(({ dial }) => {
            dial.destroy();
        });
        this.dials = [];
    }


    onEffectParameterChange(effectType, parameter, value) {
        // This method would be called when an effect parameter changes
        // You can integrate this with your SynthEngine or audio processing system
        logger.debug('Effects', `Effect parameter changed: ${effectType}.${parameter} = ${value}`, null, 'audio');
        
        // Emit an event that other parts of the system can listen to
        // store.emit('effectParameterChanged', { effectType, parameter, value });
    }

    getCurrentEffect() {
        return this.currentEffect;
    }

    getEffectParameters(effectType) {
        if (!this.effectConfigs[effectType]) {
            return null;
        }

        const parameters = {};
        
        this.dials.forEach(({ dial, control, effectType: dialEffectType }) => {
            if (dialEffectType === effectType) {
                parameters[control] = dial.value;
            }
        });
        
        return parameters;
    }
}

// Create and export a singleton instance
const effectsController = new EffectsController();
export default effectsController;