// js/components/ADSR/adsrPlayhead.js
import * as Tone from 'tone';

const playheads = {};
let componentRef = null;
let isPaused = false;

function createPlayheadElements(noteId, color) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute('data-playhead-id', noteId);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("stroke", color);
    line.setAttribute("stroke-width", 2);
    line.setAttribute("stroke-dasharray", "3,3");
    group.appendChild(line);

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", 5);
    circle.setAttribute("fill", color);
    group.appendChild(circle);
    
    return group;
}

function trigger(noteId, phase, color) {
    if (!componentRef) return;

    // Clean up any existing playhead for this note first
    if (playheads[noteId]) {
        cancelAnimationFrame(playheads[noteId].requestId);
        playheads[noteId].group.remove();
        delete playheads[noteId];
    }
    
    if (phase === 'attack') {
        const group = createPlayheadElements(noteId, color);
        componentRef.playheadLayer.appendChild(group);

        playheads[noteId] = {
            group,
            phase,
            color,
            requestId: null,
            startTimestamp: Tone.now(),
            elapsed: 0
        };
        
        animateAttack(noteId);

    } else if (phase === 'release') {
        // Don't start a release animation if paused
        if (isPaused) return;

        const group = createPlayheadElements(noteId, color);
        componentRef.playheadLayer.appendChild(group);

        playheads[noteId] = {
            group,
            phase,
            color,
            requestId: null,
            startTimestamp: Tone.now(),
            elapsed: 0
        };
        animateRelease(noteId);
    }
}

function animateAttack(noteId) {
    if (!playheads[noteId] || isPaused) return;

    const ph = playheads[noteId];
    const { attack, decay } = componentRef;
    const points = componentRef.calculateEnvelopePoints();
    if (points.length < 4) return;
    const [p1, p2, p3] = points;

    const elapsed = Tone.now() - ph.startTimestamp;
    ph.elapsed = elapsed;

    const totalAttackDecayTime = attack + decay;
    const t = Math.min(elapsed, totalAttackDecayTime);

    let x, y;
    if (t <= attack) {
        const ratio = t / attack;
        x = p1.x + ratio * (p2.x - p1.x);
        y = p1.y + ratio * (p2.y - p1.y);
    } else {
        const t2 = t - attack;
        const ratio = t2 / decay;
        x = p2.x + ratio * (p3.x - p2.x);
        y = p2.y + ratio * (p3.y - p2.y);
    }

    const [line, circle] = ph.group.children;
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', componentRef.height);
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);

    if (t < totalAttackDecayTime) {
        ph.requestId = requestAnimationFrame(() => animateAttack(noteId));
    }
}

function animateRelease(noteId) {
    if (!playheads[noteId] || isPaused) return;

    const ph = playheads[noteId];
    const { release } = componentRef;
    const points = componentRef.calculateEnvelopePoints();
     if (points.length < 4) return;
    const [, , p3, p4] = points;

    const elapsed = Tone.now() - ph.startTimestamp;
    ph.elapsed = elapsed;
    const t = Math.min(elapsed, release);

    const ratio = t / release;
    const x = p3.x + ratio * (p4.x - p3.x);
    const y = p3.y + ratio * (p4.y - p3.y);

    const [line, circle] = ph.group.children;
    line.setAttribute('x1', x);
    line.setAttribute('y1', 0);
    line.setAttribute('x2', x);
    line.setAttribute('y2', componentRef.height);
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    
    if (t < release) {
        ph.requestId = requestAnimationFrame(() => animateRelease(noteId));
    } else {
        ph.group.remove();
        delete playheads[noteId];
    }
}

function pause() {
    isPaused = true;
    for (const noteId in playheads) {
        const ph = playheads[noteId];
        if (ph.requestId) {
            cancelAnimationFrame(ph.requestId);
            ph.requestId = null;
        }
    }
}

function resume() {
    isPaused = false;
    for (const noteId in playheads) {
        const ph = playheads[noteId];
        ph.startTimestamp = Tone.now() - ph.elapsed; // Adjust start time
        if (ph.phase === 'attack') {
            animateAttack(noteId);
        } else {
            animateRelease(noteId);
        }
    }
}

function clearAll() {
    isPaused = false;
    for (const noteId in playheads) {
        const ph = playheads[noteId];
        cancelAnimationFrame(ph.requestId);
        ph.group.remove();
    }
    for (const prop in playheads) delete playheads[prop];
}

export function initPlayheadManager(adsrComponent) {
    componentRef = adsrComponent;
    console.log("ADSR Playhead Manager: Initialized.");
    return { trigger, pause, resume, clearAll };
}