// js/components/ADSR/CustomEnvelope.js
import * as Tone from 'tone';
import store from '../../state/store.js';

console.log("CustomEnvelope: Module loaded.");

// This color map is now self-contained within the component.
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
        this.width = options.width || 400;
        this.height = options.height || 150;
        this.totalTime = 8.5; // Fixed time span for the envelope view

        // Initialize state from the central store
        this.attack = store.state.adsr.attack;
        this.decay = store.state.adsr.decay;
        this.sustain = store.state.adsr.sustain;
        this.release = store.state.adsr.release;
        this.tempo = store.state.tempo;
        this.isPaused = store.state.isPaused;

        this.playheads = {};
        
        this.createSVGLayers();
        this.drawGridlines();
        this.updateEnvelopeDrawing();
        this.initInteraction();
        this.listenForStoreChanges();
    }

    listenForStoreChanges() {
        store.on('tempoChanged', (newTempo) => {
            this.tempo = newTempo;
            this.drawGridlines();
        });
        store.on('playbackStateChanged', ({ isPlaying, isPaused }) => {
            this.isPaused = isPaused;
            if (!isPlaying && !isPaused) { // Full stop
                this.clearPlayheads();
            }
        });
    }

    createSVGLayers() {
        this.svgContainer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svgContainer.setAttribute("width", this.width);
        this.svgContainer.setAttribute("height", this.height);
        this.svgContainer.style.backgroundColor = "#fff";
        this.svgContainer.style.border = "1px solid #ccc";
        this.svgContainer.style.borderRadius = "4px";

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
            line.setAttribute("stroke", "#ddd");
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

    updateEnvelopeDrawing() {
        while (this.envelopeLayer.firstChild) {
            this.envelopeLayer.removeChild(this.envelopeLayer.firstChild);
        }
        this.points = this.calculateEnvelopePoints();

        const fillPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        fillPolygon.setAttribute("points", this.points.map(p => `${p.x},${p.y}`).join(" "));
        fillPolygon.setAttribute("fill", "rgba(0,0,0,0.2)");
        this.envelopeLayer.appendChild(fillPolygon);

        const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
        polyline.setAttribute("points", this.points.slice(0, 4).map(p => `${p.x},${p.y}`).join(" "));
        polyline.setAttribute("stroke", "#000");
        polyline.setAttribute("stroke-width", 2);
        polyline.setAttribute("fill", "none");
        this.envelopeLayer.appendChild(polyline);

        this.controlPoints = [];
        for (let i = 1; i <= 3; i++) {
            const cp = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            cp.setAttribute("cx", this.points[i].x);
            cp.setAttribute("cy", this.points[i].y);
            cp.setAttribute("r", 6);
            cp.setAttribute("fill", "white");
            cp.setAttribute("stroke", "#000");
            cp.style.cursor = "pointer";
            cp.dataset.index = i;
            this.envelopeLayer.appendChild(cp);
            this.controlPoints.push(cp);
        }
    }

    initInteraction() {
        let currentDrag = null;
        const onUpdate = () => {
            this.updateEnvelopeDrawing();
            const newADSR = { attack: this.attack, decay: this.decay, sustain: this.sustain, release: this.release };
            store.state.adsr = newADSR;
            store.emit('adsrChanged', newADSR);
        };

        this.svgContainer.addEventListener("mousedown", (e) => {
            if (e.target.tagName.toLowerCase() === "circle") {
                currentDrag = e.target;
            }
        });

        this.svgContainer.addEventListener("mousemove", (e) => {
            if (!currentDrag) return;
            const pt = this.getSVGPoint(e);
            const index = parseInt(currentDrag.dataset.index);

            if (index === 1) { // Attack
                this.attack = Math.max(0, (pt.x / this.width) * this.totalTime);
            } else if (index === 2) { // Decay/Sustain
                this.decay = Math.max(0, ((pt.x / this.width) * this.totalTime) - this.attack);
                this.sustain = Math.max(0, Math.min(1, 1 - pt.y / this.height));
            } else if (index === 3) { // Release
                this.release = Math.max(0, ((pt.x / this.width) * this.totalTime) - this.attack - this.decay);
            }
            onUpdate();
        });
        
        window.addEventListener("mouseup", () => {
            currentDrag = null;
        });
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

        // Clear any existing playhead for this noteId
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
                    x = p3.x; y = p3.y; // Clamp to sustain point, but don't finish
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

// Export an init function to be called from main.js
export function initADSR() {
    const adsrElem = document.getElementById('adsr-envelope');
    if (!adsrElem) {
        console.error("ADSR container element not found.");
        return null;
    }
    
    const envelopeInstance = new CustomEnvelope({
        container: '#adsr-envelope',
        width: adsrElem.clientWidth,
        height: adsrElem.clientHeight
    });
    
    console.log("CustomEnvelope: Initialized.");
    return envelopeInstance; // Return instance for synthEngine to use
}