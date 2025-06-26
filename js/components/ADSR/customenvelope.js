// js/components/ADSR/customenvelope.js
import store from '../../state/store.js';

console.log("CustomEnvelope: Module loaded.");

function shadeHexColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return '#CCCCCC'; // Return a default if hex is invalid
    const f = parseInt(hex.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent;
    const R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

class CustomEnvelope {
    constructor(options) {
        this.container = document.querySelector(options.container);
        this.parentContainer = this.container.closest('.adsr-container');
        this.sustainTrack = document.getElementById('sustain-slider-track');
        this.sustainThumb = document.getElementById('sustain-slider-thumb');
        this.multiSliderContainer = document.getElementById('multi-thumb-slider-container');
        this.thumbA = document.getElementById('thumb-a');
        this.thumbD = document.getElementById('thumb-d');
        this.thumbR = document.getElementById('thumb-r');
        
        // FIX: Initialize with the current tool's color from the store
        this.currentColor = store.state.selectedTool.color;
        
        // Initialize local state from the store *before* first draw
        const initialTimbre = store.state.timbres[this.currentColor];
        this.attack = initialTimbre.adsr.attack;
        this.decay = initialTimbre.adsr.decay;
        this.sustain = initialTimbre.adsr.sustain;
        this.release = initialTimbre.adsr.release;

        this.createSVGLayers();
        this.resize(); // Perform initial sizing and drawing
        this.applyTheme(this.currentColor);

        this.initSustainSlider();
        this.initMultiThumbSlider();
        this.listenForStoreChanges();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
    }
    
    resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        if (this.svgContainer) {
            this.svgContainer.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
        }
        this.updateFromStore();
    }

    updateFromStore() {
        const timbre = store.state.timbres[this.currentColor];
        if (!timbre) return;
        
        const adsr = timbre.adsr;
        this.attack = adsr.attack;
        this.decay = adsr.decay;
        this.sustain = adsr.sustain;
        this.release = adsr.release;

        this.updateEnvelopeDrawing();
        this.updateSustainSliderFromStore();
        this.updateThumbsFromStore();
    }

    listenForStoreChanges() {
        store.on('toolChanged', ({ newTool }) => {
            if (newTool.color && newTool.color !== this.currentColor) {
                this.currentColor = newTool.color;
                this.updateFromStore();
                this.applyTheme(this.currentColor);
            }
        });
        
        store.on('timbreChanged', (color) => {
            if (color === this.currentColor) {
                this.updateFromStore();
            }
        });
    }
    
    applyTheme(color) {
        const lightColor = shadeHexColor(color, 0.8);
        const darkColor = shadeHexColor(color, -0.2);
        
        this.parentContainer.style.setProperty('--c-accent', color);
        this.parentContainer.style.setProperty('--c-accent-hover', darkColor);
        
        if (this.fillPolygon) this.fillPolygon.setAttribute("fill", lightColor);
        if (this.polyline) this.polyline.setAttribute("stroke", color);
    }

    createSVGLayers() {
        this.svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgContainer.setAttribute("width", "100%");
        this.svgContainer.setAttribute("height", "100%");
        this.container.appendChild(this.svgContainer);

        this.envelopeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.svgContainer.appendChild(this.envelopeLayer);
    }
    
    calculateEnvelopePoints() {
        const totalTime = this.attack + this.decay + this.release;
        if (totalTime === 0 || !this.width || !this.height) return [];
        
        const p1 = { x: 0, y: this.height };
        const p2 = { x: (this.attack / totalTime) * this.width, y: 0 };
        const p3 = { x: ((this.attack + this.decay) / totalTime) * this.width, y: this.height * (1 - this.sustain) };
        const p4 = { x: this.width, y: this.height };
        return [p1, p2, p3, p4];
    }

    updateSustainSliderFromStore() {
        const sustainPercent = this.sustain * 100;
        this.sustainThumb.style.bottom = `${sustainPercent}%`;
        this.sustainTrack.style.setProperty('--sustain-progress', `${sustainPercent}%`);
    }

    updateEnvelopeDrawing() {
        while (this.envelopeLayer.firstChild) {
            this.envelopeLayer.removeChild(this.envelopeLayer.firstChild);
        }
        this.points = this.calculateEnvelopePoints();
        if(this.points.length === 0) return;

        this.fillPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const fillPoints = `0,${this.height} ` + this.points.map(p => `${p.x},${p.y}`).join(" ") + ` ${this.width},${this.height}`;
        this.fillPolygon.setAttribute("points", fillPoints);
        
        this.polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        this.polyline.setAttribute("points", this.points.map(p => `${p.x},${p.y}`).join(" "));
        this.polyline.setAttribute("stroke-width", 2);
        this.polyline.setAttribute("fill", "none");
        
        this.envelopeLayer.appendChild(this.fillPolygon);
        this.envelopeLayer.appendChild(this.polyline);
        this.applyTheme(this.currentColor);
    }

    initSustainSlider() {
        let isDragging = false;
        const startDrag = (e) => { isDragging = true; drag(e); };
        const drag = (e) => {
            if (!isDragging) return;
            const rect = this.sustainTrack.getBoundingClientRect();
            const y = e.clientY - rect.top;
            let percent = 100 - (y / rect.height) * 100;
            percent = Math.max(0, Math.min(100, percent));
            
            const currentTimbre = store.state.timbres[this.currentColor];
            store.setADSR(this.currentColor, { ...currentTimbre.adsr, sustain: percent / 100 });
        };
        const stopDrag = () => { isDragging = false; };

        this.sustainThumb.addEventListener('pointerdown', startDrag);
        document.addEventListener('pointermove', drag);
        document.addEventListener('pointerup', stopDrag);
    }
    
    initMultiThumbSlider() {
        let activeThumb = null;
        const startDrag = (e) => {
            if (e.target.classList.contains('time-slider-thumb')) {
                activeThumb = e.target;
                drag(e);
            }
        };
        const drag = (e) => {
            if (!activeThumb) return;
            const rect = this.multiSliderContainer.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let percent = (x / rect.width) * 100;
            percent = Math.max(0, Math.min(100, percent));
            this.updateStoreFromThumbs(activeThumb.id, percent);
        };
        const stopDrag = () => { activeThumb = null; };

        this.multiSliderContainer.addEventListener('pointerdown', startDrag);
        document.addEventListener('pointermove', drag);
        document.addEventListener('pointerup', stopDrag);
    }
    
    updateStoreFromThumbs(thumbId, newPercent) {
        const currentTimbre = store.state.timbres[this.currentColor];
        let { attack, decay, release } = currentTimbre.adsr;
        const totalTime = attack + decay + release;
        if (totalTime === 0) return;

        let aP = (attack / totalTime) * 100;
        let dP = ((attack + decay) / totalTime) * 100;

        if (thumbId === 'thumb-a') aP = Math.min(newPercent, dP - 0.1);
        if (thumbId === 'thumb-d') dP = Math.max(aP + 0.1, newPercent);
        
        attack = (aP / 100) * totalTime;
        decay = (dP - aP) / 100 * totalTime;
        
        store.setADSR(this.currentColor, { ...currentTimbre.adsr, attack, decay });
    }

    updateThumbsFromStore() {
        let { attack, decay, release } = this;
        const totalTime = attack + decay + release;
        if (totalTime === 0) return;
        
        const aPercent = (attack / totalTime) * 100;
        const dPercent = ((attack + decay) / totalTime) * 100;
        
        this.thumbA.style.left = `${aPercent}%`;
        this.thumbD.style.left = `${dPercent}%`;
        this.thumbR.style.left = `100%`;
        
        this.multiSliderContainer.style.setProperty('--adr-progress', `100%`);
    }
}

export function initADSR() {
    const adsrElem = document.getElementById('adsr-envelope');
    if (!adsrElem) return null;
    return new CustomEnvelope({ container: '#adsr-envelope' });
}