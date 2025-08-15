// js/components/Effects/simpleEffectsTest.js
// Simple test with just one nexus dial

import store from '../../state/index.js';

class SimpleEffectsTest {
    constructor() {
        this.dial = null;
        this.customDials = [];
        this.currentColor = store.state.selectedNote.color;
        this.currentEffect = null;
        this.effectButtons = [];
        this.effectControlsContainer = null;
    }

    createCustomDial(container, config) {
        // Create SVG element matching NexusUI size
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '60');
        svg.setAttribute('height', '60');
        svg.setAttribute('viewBox', '0 0 60 60');
        svg.style.cursor = 'pointer';
        
        const center = { x: 30, y: 30 };
        const diameter = 60;
        
        // Create elements in same order as NexusUI: background, handle, handle2, handleFill, handle2Fill, handleLine, screw
        const background = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const handle2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const handleFill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const handle2Fill = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const handleLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const screw = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        
        // Get colors from current selected shape note
        const palette = store.state.colorPalette[this.currentColor] || { primary: this.currentColor, light: this.currentColor };
        const accentColor = palette.primary;
        
        // Get computed colors from CSS variables for non-accent elements
        const computedStyle = getComputedStyle(container);
        const surfaceColor = computedStyle.getPropertyValue('--c-surface').trim() || '#ffffff';
        const borderColor = computedStyle.getPropertyValue('--c-border').trim() || '#cccccc';
        
        // Set up background circle (matches NexusUI sizing)
        background.setAttribute('cx', center.x);
        background.setAttribute('cy', center.y);
        background.setAttribute('r', diameter/2 - diameter/40); // Same as NexusUI
        background.setAttribute('fill', surfaceColor);
        background.setAttribute('stroke', borderColor);
        background.setAttribute('stroke-width', '2');
        
        // Set up screw (center element)
        screw.setAttribute('cx', center.x);
        screw.setAttribute('cy', center.y);
        screw.setAttribute('r', diameter/12); // Same as NexusUI
        screw.setAttribute('fill', accentColor);
        
        // Set up handles with theme colors
        handle.setAttribute('stroke-width', diameter/20);
        handle.setAttribute('fill', 'none');
        handle.setAttribute('stroke', accentColor);
        
        handle2.setAttribute('stroke-width', diameter/20);
        handle2.setAttribute('fill', 'none');  
        handle2.setAttribute('stroke', accentColor);
        
        handleFill.setAttribute('fill-opacity', '0.3');
        handleFill.setAttribute('fill', accentColor);
        
        handle2Fill.setAttribute('fill-opacity', '0.3');
        handle2Fill.setAttribute('fill', accentColor);
        
        handleLine.setAttribute('stroke-width', diameter/20);
        handleLine.setAttribute('stroke', accentColor);
        
        // Assemble SVG in same order as NexusUI
        svg.appendChild(background);
        svg.appendChild(handle);
        svg.appendChild(handle2);
        svg.appendChild(handleFill);
        svg.appendChild(handle2Fill);
        svg.appendChild(handleLine);
        svg.appendChild(screw);
        container.appendChild(svg);
        
        // Custom dial object mimicking NexusUI interface
        const customDial = {
            value: config.value,
            min: config.min,
            max: config.max,
            element: svg,
            width: 60,
            height: 60,
            // Store references to colored elements for updating
            coloredElements: { handle, handle2, handleFill, handle2Fill, handleLine, screw },
            
            // Clip function from NexusUI math utils
            clip(value, min, max) {
                return Math.min(max, Math.max(min, value));
            },
            
            // Scale function from NexusUI math utils  
            scale(value, inMin, inMax, outMin, outMax) {
                return (value - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
            },
            
            render() {
                const value = (this.value - this.min) / (this.max - this.min); // normalized value
                
                // Calculate handle points EXACTLY like NexusUI
                const handlePoints = {
                    start: Math.PI * 1.5,
                    end: this.clip(this.scale(value, 0, 0.5, Math.PI * 1.5, Math.PI * 0.5), Math.PI * 0.5, Math.PI * 1.5)
                };
                const handle2Points = {
                    start: Math.PI * 2.5,
                    end: this.clip(this.scale(value, 0.5, 1, Math.PI * 2.5, Math.PI * 1.5), Math.PI * 1.5, Math.PI * 2.5)
                };
                
                const radius = diameter/2 - diameter/40;
                
                // Create arc paths
                let handlePath = this.createNexusArc(center.x, center.y, radius, handlePoints.start, handlePoints.end);
                let handle2Path = this.createNexusArc(center.x, center.y, radius, handle2Points.start, handle2Points.end);
                
                handle.setAttribute('d', handlePath);
                handle2.setAttribute('d', handle2Path);
                
                // Create filled paths
                let handleFillPath = handlePath + ` L ${center.x} ${center.y}`;
                let handle2FillPath = handle2Path + ` L ${center.x} ${center.y}`;
                
                handleFill.setAttribute('d', handleFillPath);
                handle2Fill.setAttribute('d', handle2FillPath);
                
                // Calculate handle line position
                let arcEndingA;
                if (value <= 0.5) {
                    arcEndingA = handlePoints.end;
                } else {
                    arcEndingA = handle2Points.end;
                }
                
                const arcEndingX = center.x + Math.cos(arcEndingA) * radius;
                const arcEndingY = center.y + Math.sin(arcEndingA) * radius * -1; // NexusUI flips Y
                
                handleLine.setAttribute('d', `M ${center.x} ${center.y} L ${arcEndingX} ${arcEndingY}`);
            },
            
            // Create arc exactly like NexusUI's svg.arc function  
            createNexusArc(centerX, centerY, radius, startAngle, endAngle) {
                const start = {
                    x: centerX + Math.cos(startAngle) * radius,
                    y: centerY + Math.sin(startAngle) * radius * -1 // NexusUI flips Y
                };
                const end = {
                    x: centerX + Math.cos(endAngle) * radius,
                    y: centerY + Math.sin(endAngle) * radius * -1 // NexusUI flips Y
                };
                
                const angleDiff = Math.abs(startAngle - endAngle);
                // For exactly π (180 degrees), we need large arc flag = 1
                const largeArcFlag = angleDiff >= Math.PI ? 1 : 0;
                const sweepFlag = startAngle > endAngle ? 1 : 0;
                
                
                return [
                    "M", start.x, start.y, 
                    "A", radius, radius, 0, largeArcFlag, sweepFlag, end.x, end.y
                ].join(" ");
            },
            
            on(event, callback) {
                if (event === 'change') {
                    this.changeCallback = callback;
                }
            },
            
            setValue(newValue) {
                this.value = Math.max(this.min, Math.min(this.max, newValue));
                this.render();
                if (this.changeCallback) {
                    this.changeCallback(this.value);
                }
            },
            
            updateColors(color) {
                const palette = store.state.colorPalette[color] || { primary: color, light: color };
                const accentColor = palette.primary;
                
                // Update all colored elements
                const { handle, handle2, handleFill, handle2Fill, handleLine, screw } = this.coloredElements;
                
                handle.setAttribute('stroke', accentColor);
                handle2.setAttribute('stroke', accentColor);
                handleFill.setAttribute('fill', accentColor);
                handle2Fill.setAttribute('fill', accentColor);
                handleLine.setAttribute('stroke', accentColor);
                screw.setAttribute('fill', accentColor);
            }
        };
        
        // Add radial interaction similar to NexusUI
        let isDragging = false;
        let previousAngle = false;
        
        const getAngleFromMouse = (e) => {
            const rect = svg.getBoundingClientRect();
            const x = e.clientX - rect.left - center.x;
            const y = e.clientY - rect.top - center.y;
            let angle = Math.atan2(y, x);
            if (angle < 0) angle += Math.PI * 2;
            
            // Shift zero point from 3 o'clock to 6 o'clock (90 degrees clockwise)
            angle -= Math.PI / 2;
            if (angle < 0) angle += Math.PI * 2;
            
            return angle;
        };
        
        svg.addEventListener('mousedown', (e) => {
            isDragging = true;
            previousAngle = false; // Reset for relative mode
            svg.style.cursor = 'grabbing';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            let angle = getAngleFromMouse(e);
            
            // Wrap-around protection (like NexusUI relative mode)
            if (previousAngle !== false && Math.abs(previousAngle - angle) > 2) {
                if (previousAngle > 3) {
                    angle = Math.PI * 2;
                } else {
                    angle = 0;
                }
            }
            previousAngle = angle;
            
            // Convert angle to normalized value
            const normalizedValue = angle / (Math.PI * 2);
            const newValue = customDial.min + normalizedValue * (customDial.max - customDial.min);
            
            customDial.setValue(newValue);
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                svg.style.cursor = 'pointer';
            }
        });
        
        // Initial render
        customDial.render();
        
        return customDial;
    }

    init() {
        // Find the effects container
        this.effectControlsContainer = document.getElementById('effect-controls');
        this.effectButtons = document.querySelectorAll('.effect-button[data-effect]');
        
        if (!this.effectControlsContainer || this.effectButtons.length === 0) {
            console.error('SimpleEffectsTest: Could not find effect-controls container or effect buttons');
            return false;
        }

        // Define effect configurations
        this.effectConfigs = {
            reverb: {
                name: 'Reverb',
                controls: [
                    { name: 'Room Size', min: 0, max: 100, value: 50, isCustom: true },
                    { name: 'Decay', min: 0, max: 100, value: 30, isCustom: true },
                    { name: 'Wet/Dry', min: 0, max: 100, value: 25, isCustom: true }
                ]
            },
            delay: {
                name: 'Delay',
                controls: [
                    { name: 'Time', min: 0, max: 100, value: 25, isCustom: true },
                    { name: 'Feedback', min: 0, max: 95, value: 40, isCustom: true },
                    { name: 'Wet/Dry', min: 0, max: 100, value: 30, isCustom: true }
                ]
            },
            phaser: {
                name: 'Phaser',
                controls: [
                    { name: 'Rate', min: 0, max: 100, value: 50, isCustom: true },
                    { name: 'Depth', min: 0, max: 100, value: 75, isCustom: true },
                    { name: 'Stages', min: 2, max: 12, value: 6, isCustom: true }
                ]
            },
            vibratio: {
                name: 'Vibrato',
                controls: [
                    { name: 'Speed', min: 0, max: 100, value: 40, isCustom: true },
                    { name: 'Span', min: 0, max: 100, value: 60, isCustom: true }
                ]
            },
            tremelo: {
                name: 'Tremolo',
                controls: [
                    { name: 'Speed', min: 0, max: 100, value: 35, isCustom: true },
                    { name: 'Span', min: 0, max: 100, value: 50, isCustom: true }
                ]
            },
            portamento: {
                name: 'Portamento',
                controls: [
                    { name: 'Glide Time', min: 0, max: 100, value: 20, isCustom: true },
                    { name: 'Glide Shape', min: 0, max: 100, value: 50, isCustom: true }
                ]
            }
        };

        // Set up event listeners for effect buttons
        this.setupEventListeners();
        
        // Apply initial button theming
        this.updateButtonTheming(this.currentColor);
        
        // Listen for shape note color changes
        store.on('noteChanged', ({ newNote }) => {
            if (newNote.color && newNote.color !== this.currentColor) {
                this.currentColor = newNote.color;
                // Update all custom dials with new color
                this.customDials.forEach(customDial => {
                    customDial.updateColors(this.currentColor);
                });
                // Update button theming
                this.updateButtonTheming(this.currentColor);
            }
        });

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
        console.log(`SimpleEffectsTest: Selecting effect: ${effectType}`);
        
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
            console.warn(`SimpleEffectsTest: No configuration found for effect: ${effectType}`);
            return;
        }

        // Clear existing dials
        this.clearDials();
        
        // Create controls container with original styling
        this.effectControlsContainer.innerHTML = '<div id="dial-container"></div>';
        this.effectControlsContainer.classList.add('active');
        const controlsContainer = this.effectControlsContainer.querySelector('#dial-container');
        
        // Create dials for each control
        config.controls.forEach((controlConfig) => {
            // Create container for each dial
            const dialWrapper = document.createElement('div');
            dialWrapper.className = 'dial-wrapper';
            controlsContainer.appendChild(dialWrapper);

            // Create label
            const label = document.createElement('div');
            label.className = 'dial-label';
            label.textContent = controlConfig.name;
            dialWrapper.appendChild(label);

            // Create dial container
            const nexusContainer = document.createElement('div');
            dialWrapper.appendChild(nexusContainer);

            let dial;
            if (controlConfig.isCustom) {
                // Create our custom dial
                dial = this.createCustomDial(nexusContainer, controlConfig);
                // Store reference for color updates
                this.customDials.push(dial);
            } else {
                // All dials are now custom
                dial = this.createCustomDial(nexusContainer, controlConfig);
                this.customDials.push(dial);
            }

            // Create value display (initially hidden)
            const valueDisplay = document.createElement('div');
            valueDisplay.className = 'dial-value dial-value-hidden';
            valueDisplay.textContent = `${controlConfig.value}%`;
            dialWrapper.appendChild(valueDisplay);

            // Show/hide value on interaction
            setTimeout(() => {
                const svg = nexusContainer.querySelector('svg');
                if (svg) {
                    svg.addEventListener('mousedown', (e) => {
                        valueDisplay.classList.remove('dial-value-hidden');
                        valueDisplay.classList.add('dial-value-visible');
                    });

                    svg.addEventListener('mouseup', (e) => {
                        valueDisplay.classList.remove('dial-value-visible');
                        valueDisplay.classList.add('dial-value-hidden');
                    });

                    svg.addEventListener('mouseleave', (e) => {
                        valueDisplay.classList.remove('dial-value-visible');
                        valueDisplay.classList.add('dial-value-hidden');
                    });
                }
            }, 100);

            dial.on('change', (value) => {
                valueDisplay.textContent = `${Math.round(value)}%`;
                console.log(`${config.name} ${controlConfig.name}: ${Math.round(value)}%`);
            });

            if (!this.dials) this.dials = [];
            this.dials.push(dial);
        });
        
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
        // Clear custom dials array
        this.customDials = [];
        
        // Destroy existing dials if they exist
        if (this.dials) {
            this.dials.forEach((dial) => {
                if (dial.destroy) {
                    dial.destroy();
                }
            });
            this.dials = [];
        }
    }

    updateButtonTheming(color) {
        // Get the light color from the color palette for button backgrounds
        const palette = store.state.colorPalette[color] || { primary: color, light: color };
        const lightColor = palette.light;
        const primaryColor = palette.primary;
        
        // Create an even lighter version for button backgrounds
        const extraLightColor = this.lightenColor(lightColor, 60);
        
        // Find the effects container parent to apply theming
        const effectsParent = document.querySelector('.effects-content-box') || document.body;
        
        // Set CSS custom properties for effect buttons
        effectsParent.style.setProperty('--c-accent', primaryColor);
        effectsParent.style.setProperty('--c-accent-light', extraLightColor);
        effectsParent.style.setProperty('--c-accent-hover', this.darkenColor(primaryColor, 20));
    }

    darkenColor(hex, percent = 20) {
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
    }

    lightenColor(hex, percent = 50) {
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
    }
}

// Create singleton
const simpleEffectsTest = new SimpleEffectsTest();
export default simpleEffectsTest;