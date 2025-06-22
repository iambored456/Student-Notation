// js/components/ADSR/CustomEnvelope.js
import * as Tone from 'tone';
import store from '../../state/store.js';

console.log("CustomEnvelope: Module loaded.");

const PITCH_CLASS_COLORS = {
  'C': '#f090ae', 'D♭/C♯': '#f59383', 'D': '#ea9e5e',
  'E♭/D♯': '#d0ae4e', 'E': '#a8bd61', 'F': '#76c788',
  'G♭/F♯': '#41cbb5', 'G': '#33c6dc', 'A♭/G♯': '#62bbf7',
  'A': '#94adff', 'B♭/A♯': '#bea0f3', 'B': '#dd95d6'
};

function getPitchClass(noteId) {
    if (!noteId) return 'C';
    let pc = noteId.replace(/\d/g, '').trim();
    const mapping = {
        "Ab": "A♭/G♯", "G#": "A♭/G♯", "Db": "D♭/C♯", "C#": "D♭/C♯",
        "Eb": "E♭/D♯", "D#": "E♭/D♯", "Gb": "G♭/F♯", "F#": "G♭/F♯",
        "Bb": "B♭/A♯", "A#": "B♭/A♯"
    };
    return mapping[pc] || pc;
}


class CustomEnvelope {
    constructor(options) {
        this.container = document.querySelector(options.container);
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        this.totalTime = 2.125; // Halved from 4.25

        // Get UI elements
        this.sustainTrack = document.getElementById('sustain-slider-track');
        this.sustainThumb = document.getElementById('sustain-slider-thumb');
        this.multiSliderContainer = document.getElementById('multi-thumb-slider-container');
        this.thumbA = document.getElementById('thumb-a');
        this.thumbD = document.getElementById('thumb-d');
        this.thumbR = document.getElementById('thumb-r');

        // Initialize state from store
        const initialState = store.state.adsr;
        this.attack = initialState.attack;
        this.decay = initialState.decay;
        this.sustain = initialState.sustain;
        this.release = initialState.release;
        this.tempo = store.state.tempo;
        this.isPaused = store.state.isPaused;

        this.playheads = {};
        
        this.createSVGLayers();
        this.drawGridlines();
        this.updateFromStore(store.state.adsr);

        // Wire up all interactions
        this.initSustainSlider();
        this.initMultiThumbSlider();
        this.initSVGInteraction();
        this.listenForStoreChanges();

        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resize();
    }
    
    resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        if (this.svgContainer) {
            this.svgContainer.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
        }
        this.updateEnvelopeDrawing();
        this.updateThumbsFromStore();
    }

    updateFromStore(adsr) {
        this.attack = adsr.attack;
        this.decay = adsr.decay;
        this.sustain = adsr.sustain;
        this.release = adsr.release;
        this.updateEnvelopeDrawing();
        this.updateSustainSliderFromStore();
        this.updateThumbsFromStore();
    }

    listenForStoreChanges() {
        store.on('tempoChanged', (newTempo) => {
            this.tempo = newTempo;
            this.drawGridlines();
        });
        store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
            this.isPaused = isPaused;
            if (!isPlaying && !isPaused) { this.clearPlayheads(); }
        });
        store.on('adsrChanged', (newADSR) => {
            this.updateFromStore(newADSR);
        });
    }

    createSVGLayers() {
        this.svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgContainer.setAttribute("width", "100%");
        this.svgContainer.setAttribute("height", "100%");
        this.svgContainer.setAttribute("viewBox", `0 0 ${this.width} ${this.height}`);
        this.svgContainer.setAttribute("preserveAspectRatio", "none");

        this.gridLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.envelopeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.playheadLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");

        this.svgContainer.appendChild(this.gridLayer);
        this.svgContainer.appendChild(this.envelopeLayer);
        this.svgContainer.appendChild(this.playheadLayer);
        this.container.appendChild(this.svgContainer);
    }
    
    drawGridlines() {
        while (this.gridLayer.firstChild) {
            this.gridLayer.removeChild(this.gridLayer.firstChild);
        }
        const microbeatDuration = 60 / (this.tempo * 2);
        const numLines = Math.floor(this.totalTime / microbeatDuration);

        for (let i = 0; i <= numLines; i++) {
            if (i % 2 !== 0) continue;
            const t = i * microbeatDuration;
            const x = (t / this.totalTime) * this.width;
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x);
            line.setAttribute("y1", 0);
            line.setAttribute("x2", x);
            line.setAttribute("y2", this.height);
            line.setAttribute("stroke", "#e9ecef");
            line.setAttribute("stroke-width", 1);
            this.gridLayer.appendChild(line);
        }
    }

    calculateEnvelopePoints() {
        const p1 = { x: 0, y: this.height };
        const p2 = { x: (this.attack / this.totalTime) * this.width, y: 0 };
        const p3 = { x: ((this.attack + this.decay) / this.totalTime) * this.width, y: this.height * (1 - this.sustain) };
        const p4 = { x: ((this.attack + this.decay + this.release) / this.totalTime) * this.width, y: this.height };
        const p5 = { x: this.width, y: this.height };
        return [p1, p2, p3, p4, p5];
    }

    updateSustainSliderFromStore() {
        if (!this.sustainTrack || !this.sustainThumb) return;
        const sustainPercent = this.sustain * 100;
        this.sustainThumb.style.bottom = `${sustainPercent}%`;
        this.sustainTrack.style.setProperty('--sustain-progress', `${sustainPercent}%`);
    }

    updateEnvelopeDrawing() {
        while (this.envelopeLayer.firstChild) {
            this.envelopeLayer.removeChild(this.envelopeLayer.firstChild);
        }
        this.points = this.calculateEnvelopePoints();

        const fillPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        fillPolygon.setAttribute("points", this.points.map(p => `${p.x},${p.y}`).join(" "));
        fillPolygon.setAttribute("fill", "rgba(74, 144, 226, 0.2)");
        this.envelopeLayer.appendChild(fillPolygon);

        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", this.points.slice(0, 4).map(p => `${p.x},${p.y}`).join(" "));
        polyline.setAttribute("stroke", "#4A90E2");
        polyline.setAttribute("stroke-width", 2);
        polyline.setAttribute("fill", "none");
        this.envelopeLayer.appendChild(polyline);

        this.controlPoints = [];
        const scaleX = this.width / this.svgContainer.viewBox.baseVal.width;
        const scaleY = this.height / this.svgContainer.viewBox.baseVal.height;
        const inverseYScale = scaleX / scaleY;

        for (let i = 1; i <= 3; i++) {
            const cp = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            cp.setAttribute("cx", this.points[i].x);
            cp.setAttribute("cy", this.points[i].y);
            cp.setAttribute("r", 6);
            cp.setAttribute("fill", "white");
            cp.setAttribute("stroke", "#4A90E2");
            cp.setAttribute("stroke-width", 2);
            cp.style.cursor = "pointer";
            cp.dataset.index = i;
            cp.setAttribute("transform", `scale(1, ${inverseYScale})`);
            cp.setAttribute("transform-origin", `${this.points[i].x} ${this.points[i].y}`);
            
            this.envelopeLayer.appendChild(cp);
            this.controlPoints.push(cp);
        }
    }

    initSustainSlider() {
        let isDragging = false;

        const startDrag = (e) => {
            e.preventDefault();
            isDragging = true;
            this.sustainThumb.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            drag(e);
        };

        const drag = (e) => {
            if (!isDragging) return;
            const rect = this.sustainTrack.getBoundingClientRect();
            const y = e.clientY - rect.top;
            let percent = 100 - (y / rect.height) * 100;
            percent = Math.max(0, Math.min(100, percent));

            this.sustainThumb.style.bottom = `${percent}%`;
            this.sustainTrack.style.setProperty('--sustain-progress', `${percent}%`);
            
            const newSustainValue = percent / 100;
            store.setADSR({ ...store.state.adsr, sustain: newSustainValue });
        };

        const stopDrag = () => {
            isDragging = false;
            this.sustainThumb.style.cursor = 'grab';
            document.body.style.cursor = 'default';
        };

        this.sustainThumb.addEventListener('pointerdown', startDrag);
        document.addEventListener('pointermove', drag);
        document.addEventListener('pointerup', stopDrag);
    }
    
    initMultiThumbSlider() {
        let activeThumb = null;

        const startDrag = (e) => {
            if (e.target.classList.contains('time-slider-thumb')) {
                e.preventDefault();
                activeThumb = e.target;
                document.body.style.cursor = 'grabbing';
                drag(e);
            }
        };

        const drag = (e) => {
            if (!activeThumb) return;
            const rect = this.multiSliderContainer.getBoundingClientRect();
            let x = e.clientX - rect.left;
            let percent = (x / rect.width) * 100;
            percent = Math.max(0, Math.min(100, percent));
            
            const posA = parseFloat(this.thumbA.style.left);
            const posD = parseFloat(this.thumbD.style.left);
            const posR = parseFloat(this.thumbR.style.left);

            if (activeThumb.id === 'thumb-a') {
                percent = Math.min(percent, posD - 1);
            } else if (activeThumb.id === 'thumb-d') {
                percent = Math.max(posA + 1, Math.min(percent, posR - 1));
            } else if (activeThumb.id === 'thumb-r') {
                percent = Math.max(posD + 1, percent);
            }
            activeThumb.style.left = `${percent}%`;

            this.updateStoreFromThumbs();
        };

        const stopDrag = () => {
            activeThumb = null;
            document.body.style.cursor = 'default';
        };

        this.multiSliderContainer.addEventListener('pointerdown', startDrag);
        document.addEventListener('pointermove', drag);
        document.addEventListener('pointerup', stopDrag);
    }
    
    updateStoreFromThumbs() {
        const percentA = parseFloat(this.thumbA.style.left) / 100;
        const percentD = parseFloat(this.thumbD.style.left) / 100;
        const percentR = parseFloat(this.thumbR.style.left) / 100;
        
        const timeA = percentA * this.totalTime;
        const timeD = percentD * this.totalTime;
        const timeR = percentR * this.totalTime;

        store.setADSR({
            ...store.state.adsr,
            attack: Math.max(0.001, timeA),
            decay: Math.max(0, timeD - timeA),
            release: Math.max(0.01, timeR - timeD),
        });
    }

    updateThumbsFromStore() {
        const { attack, decay, release } = this;
        const timeA = attack;
        const timeD = attack + decay;
        const timeR = attack + decay + release;

        const aPercent = (timeA / this.totalTime) * 100;
        const dPercent = (timeD / this.totalTime) * 100;
        const rPercent = (timeR / this.totalTime) * 100;

        this.thumbA.style.left = `${aPercent}%`;
        this.thumbD.style.left = `${dPercent}%`;
        this.thumbR.style.left = `${rPercent}%`;
        
        this.multiSliderContainer.style.setProperty('--adr-progress', `${rPercent}%`);
    }

    initSVGInteraction() {
        let currentDrag = null;
        this.svgContainer.addEventListener("mousedown", (e) => { if (e.target.tagName.toLowerCase() === "circle") { currentDrag = e.target; } });
        this.svgContainer.addEventListener("mousemove", (e) => {
            if (!currentDrag) return;
            const pt = this.getSVGPoint(e);
            const index = parseInt(currentDrag.dataset.index);
            const newADSR = { ...store.state.adsr };
            if (index === 1) { newADSR.attack = Math.max(0.001, (pt.x / this.width) * this.totalTime); }
            else if (index === 2) {
                newADSR.decay = Math.max(0, ((pt.x / this.width) * this.totalTime) - newADSR.attack);
                newADSR.sustain = Math.max(0, Math.min(1, 1 - pt.y / this.height));
            } else if (index === 3) { newADSR.release = Math.max(0.01, ((pt.x / this.width) * this.totalTime) - newADSR.attack - newADSR.decay); }
            store.setADSR(newADSR);
        });
        window.addEventListener("mouseup", () => { currentDrag = null; });
    }

    getSVGPoint(e) {
        const pt = this.svgContainer.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        return pt.matrixTransform(this.svgContainer.getScreenCTM().inverse());
    }

    clearPlayheads() {
        Object.values(this.playheads).forEach(ph => {
            if (ph.requestId) cancelAnimationFrame(ph.requestId);
            ph.group.remove();
        });
        this.playheads = {};
    }

    triggerPlayhead(noteId, phase) {
        const pitchClass = getPitchClass(noteId);
        const color = PITCH_CLASS_COLORS[pitchClass] || '#f00';
        if (this.playheads[noteId]) {
            cancelAnimationFrame(this.playheads[noteId].requestId);
            this.playheads[noteId].group.remove();
            delete this.playheads[noteId];
        }

        const playheadGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        
        line.setAttribute("stroke", color);
        line.setAttribute("stroke-width", 2);
        line.setAttribute("stroke-dasharray", "2,4");
        circle.setAttribute("r", 4);
        circle.setAttribute("fill", color);
        playheadGroup.append(line, circle);
        this.playheadLayer.appendChild(playheadGroup);

        const ph = { group: playheadGroup, requestId: null, startTime: Tone.now() };
        this.playheads[noteId] = ph;
        
        const [p1, p2, p3, p4] = this.calculateEnvelopePoints();
        
        const animate = () => {
            if (this.isPaused) {
                ph.requestId = requestAnimationFrame(animate);
                return;
            }

            const elapsed = Tone.now() - ph.startTime;
            let x, y, duration, finished = false;

            if (phase === "attack") {
                duration = this.attack + this.decay;
                if (elapsed <= this.attack) {
                    const ratio = elapsed / this.attack;
                    x = p1.x + ratio * (p2.x - p1.x); y = p1.y + ratio * (p2.y - p1.y);
                } else {
                    const ratio = (elapsed - this.attack) / this.decay;
                    x = p2.x + ratio * (p3.x - p2.x); y = p2.y + ratio * (p3.y - p2.y);
                }
                if (elapsed >= duration) {
                    x = p3.x; y = p3.y;
                }
            } else { // Release
                duration = this.release;
                const ratio = elapsed / duration;
                x = p3.x + ratio * (p4.x - p3.x); y = p3.y + ratio * (p4.y - p3.y);
                if (elapsed >= duration) {
                    finished = true;
                }
            }

            line.setAttribute("x1", x); line.setAttribute("y1", 0);
            line.setAttribute("x2", x); line.setAttribute("y2", this.height);
            circle.setAttribute("cx", x); circle.setAttribute("cy", y);

            if (finished) {
                playheadGroup.remove();
                delete this.playheads[noteId];
            } else {
                ph.requestId = requestAnimationFrame(animate);
            }
        };
        animate();
    }
}

export function initADSR() {
    const adsrElem = document.getElementById('adsr-envelope');
    if (!adsrElem) {
        console.error("ADSR container element not found.");
        return null;
    }
    const envelopeInstance = new CustomEnvelope({ container: '#adsr-envelope' });
    console.log("CustomEnvelope: Initialized.");
    return envelopeInstance;
}