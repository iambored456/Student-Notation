// js/components/ADSR/adsrRender.js
import store from '@state/index.js';
import { hexToRgba, shadeHexColor } from '@utils/colorUtils.js';


export function drawTempoGridlines(gridLayer, { width, height }, totalADRTime) {
    while (gridLayer.firstChild) gridLayer.removeChild(gridLayer.firstChild);

    // Draw time markers (1s, 2s, 3s, 4s, 5s) in the background
    if (totalADRTime > 0) {
        for (let seconds = 1; seconds <= 5; seconds++) {
            if (seconds <= totalADRTime) {
                const x = (seconds / totalADRTime) * width;
                const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
                text.setAttribute('x', x);
                text.setAttribute('y', height - 5); // Bottom-aligned with 5px padding
                text.setAttribute('fill', '#d0d0d0'); // Light gray
                text.setAttribute('font-size', '24');
                text.setAttribute('font-weight', 'bold');
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('dominant-baseline', 'auto');
                text.setAttribute('opacity', '0.3');
                text.textContent = `${seconds}s`;
                gridLayer.appendChild(text);
            }
        }
    }

    const tempo = store.state.tempo;
    if (tempo <= 0 || totalADRTime <= 0) return;
    const microbeatDuration = 30 / tempo;
    let beatCount = 0;
    for (let time = microbeatDuration; time < totalADRTime; time += microbeatDuration) {
        const x = (time / totalADRTime) * width;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute('x1', x);
        line.setAttribute('y1', 0);
        line.setAttribute('x2', x);
        line.setAttribute('y2', height);
        const isMacrobeat = (beatCount + 1) % 2 === 0;
        line.setAttribute('stroke', isMacrobeat ? '#adb5bd' : '#ced4da');
        line.setAttribute('stroke-width', isMacrobeat ? '1' : '0.5');
        line.setAttribute('stroke-dasharray', '3,3'); // Dashed line pattern for both
        gridLayer.appendChild(line);
        beatCount++;
    }
}

export function drawEnvelope(envelopeLayer, nodeLayer, points, { height, width }, colorKey, maxTime, canvasCtx) {
    while (envelopeLayer.firstChild) envelopeLayer.removeChild(envelopeLayer.firstChild);
    while (nodeLayer.firstChild) nodeLayer.removeChild(nodeLayer.firstChild);
    if (points.length === 0) return;

    // Get the color pair from the store's palette
    const palette = store.state.colorPalette[colorKey] || { primary: colorKey, light: colorKey };
    const primaryColor = palette.primary;
    const lightColor = palette.light;

    // Get delay and reverb parameters from effectsCoordinator
    let delayParams = { time: 0, feedback: 0 };
    let reverbParams = { decay: 0, roomSize: 0 };
    if (window.effectsCoordinator) {
        delayParams = window.effectsCoordinator.getEffectParameters(colorKey, 'delay');
        reverbParams = window.effectsCoordinator.getEffectParameters(colorKey, 'reverb');
    }

    // Clear canvas for new frame
    if (canvasCtx) {
        canvasCtx.clearRect(0, 0, width, height);
    }

    // Helper function to draw reverb shadow on canvas (MUCH faster than SVG)
    const drawReverbShadow = (envelopePoints, opacityMultiplier = 1.0) => {
        if (!canvasCtx || reverbParams.decay === 0 || reverbParams.roomSize === 0 || !maxTime) return;

        const shadowLength = (reverbParams.decay / 100) * 5 * (width / maxTime); // Expanded from 3 to 5 seconds
        const shadowDarkness = (reverbParams.roomSize / 100) * opacityMultiplier;

        // Enable canvas blur (hardware-accelerated)
        canvasCtx.filter = 'blur(30px)';

        // Convert hex color to RGB for canvas gradient
        const r = parseInt(lightColor.slice(1, 3), 16);
        const g = parseInt(lightColor.slice(3, 5), 16);
        const b = parseInt(lightColor.slice(5, 7), 16);

        // Draw reverb shadow using gradient fills (much faster than 2400 polygons)
        const numSamples = 60;

        for (let i = 0; i < numSamples; i++) {
            const t = i / numSamples;
            const nextT = (i + 1) / numSamples;

            const edgeY = envelopePoints[1].y + (envelopePoints[3].y - envelopePoints[1].y) * t;
            const nextEdgeY = envelopePoints[1].y + (envelopePoints[3].y - envelopePoints[1].y) * nextT;
            const edgeX = envelopePoints[1].x + (envelopePoints[3].x - envelopePoints[1].x) * t;
            const nextEdgeX = envelopePoints[1].x + (envelopePoints[3].x - envelopePoints[1].x) * nextT;

            // Create horizontal gradient for this segment
            const gradient = canvasCtx.createLinearGradient(edgeX, edgeY, edgeX + shadowLength, edgeY);
            gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${shadowDarkness})`);
            gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

            // Draw gradient-filled quad
            canvasCtx.fillStyle = gradient;
            canvasCtx.beginPath();
            canvasCtx.moveTo(edgeX, edgeY);
            canvasCtx.lineTo(edgeX + shadowLength, edgeY);
            canvasCtx.lineTo(nextEdgeX + shadowLength, nextEdgeY);
            canvasCtx.lineTo(nextEdgeX, nextEdgeY);
            canvasCtx.closePath();
            canvasCtx.fill();
        }

        // Reset canvas filter
        canvasCtx.filter = 'none';
    };

    // --- Draw Reverb Shadow on Main Envelope (on canvas) ---
    drawReverbShadow(points, 1.0);

    // --- Draw Delay Echoes (behind main envelope) ---
    if (delayParams.time > 0 && delayParams.feedback > 0 && maxTime) {
        // Convert delay time from percentage (0-100) to seconds (0-0.5s as per delayAudioEffect.js)
        const delayTimeSeconds = Math.max(0.01, (delayParams.time / 100) * 0.5);
        // Convert feedback from percentage to 0-1
        const feedbackAmount = Math.min(0.95, delayParams.feedback / 100);

        // Calculate how many echoes to draw (stop when opacity becomes too low)
        const minOpacity = 0.05;
        let currentOpacity = feedbackAmount;
        let echoCount = 0;

        while (currentOpacity > minOpacity && echoCount < 10) {
            echoCount++;
            const delayOffsetPx = (delayTimeSeconds * echoCount / maxTime) * width;

            // Shift all points by the delay offset
            const echoPoints = points.map(p => ({ x: p.x + delayOffsetPx, y: p.y }));

            // Only draw if the echo is still visible within the canvas
            if (echoPoints[0].x < width) {
                // Draw reverb shadow for this echo on canvas (with reduced opacity matching the echo)
                drawReverbShadow(echoPoints, currentOpacity);

                // Draw echo fill
                const echoFill = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                const echoFillPoints = `${echoPoints[0].x},${height} ` +
                                       echoPoints.map(p => `${p.x},${p.y}`).join(" ") +
                                       ` ${Math.min(echoPoints[3].x, width)},${height}`;
                echoFill.setAttribute("points", echoFillPoints);
                echoFill.setAttribute("fill", hexToRgba(lightColor, 0.7 * currentOpacity));
                echoFill.setAttribute("class", "delay-echo");
                envelopeLayer.appendChild(echoFill);

                // Draw echo line
                const echoLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
                echoLine.setAttribute("points", echoPoints.map(p => `${p.x},${p.y}`).join(" "));
                echoLine.setAttribute("stroke-width", 2);
                echoLine.setAttribute("fill", "none");
                echoLine.setAttribute("stroke", hexToRgba(primaryColor, currentOpacity));
                echoLine.setAttribute("class", "delay-echo");
                envelopeLayer.appendChild(echoLine);
            }

            // Reduce opacity for next echo (each echo is quieter)
            currentOpacity *= feedbackAmount;
        }
    }

    // --- Draw Main Envelope Shape ---
    const fillPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const fillPoints = `0,${height} ` + points.map(p => `${p.x},${p.y}`).join(" ") + ` ${width},${height}`;
    fillPolygon.setAttribute("points", fillPoints);
    // Use the new light color with transparency for the fill
    fillPolygon.setAttribute("fill", hexToRgba(lightColor, 0.7));

    envelopeLayer.appendChild(fillPolygon);

    // Draw envelope line in segments so we can soften the release based on reverb
    // Attack segment (p0 to p1)
    const attackLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    attackLine.setAttribute("x1", points[0].x);
    attackLine.setAttribute("y1", points[0].y);
    attackLine.setAttribute("x2", points[1].x);
    attackLine.setAttribute("y2", points[1].y);
    attackLine.setAttribute("stroke", primaryColor);
    attackLine.setAttribute("stroke-width", 2);
    envelopeLayer.appendChild(attackLine);

    // Decay segment (p1 to p2)
    const decayLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    decayLine.setAttribute("x1", points[1].x);
    decayLine.setAttribute("y1", points[1].y);
    decayLine.setAttribute("x2", points[2].x);
    decayLine.setAttribute("y2", points[2].y);
    decayLine.setAttribute("stroke", primaryColor);
    decayLine.setAttribute("stroke-width", 2);
    envelopeLayer.appendChild(decayLine);

    // Release segment (p2 to p3) - soften based on reverb
    const releaseOpacity = reverbParams.decay > 0 && reverbParams.roomSize > 0
        ? Math.max(0.3, 1 - ((reverbParams.decay / 100) * (reverbParams.roomSize / 100) * 0.7))
        : 1.0;

    const releaseLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    releaseLine.setAttribute("x1", points[2].x);
    releaseLine.setAttribute("y1", points[2].y);
    releaseLine.setAttribute("x2", points[3].x);
    releaseLine.setAttribute("y2", points[3].y);
    releaseLine.setAttribute("stroke", hexToRgba(primaryColor, releaseOpacity));
    releaseLine.setAttribute("stroke-width", 2);
    envelopeLayer.appendChild(releaseLine);

    // --- Draw Draggable Nodes ---
    const nodeIds = ['attack-node', 'decay-sustain-node', 'release-node'];
    const nodePoints = [points[1], points[2], points[3]];

    nodePoints.forEach((point, i) => {
        const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        node.setAttribute('id', nodeIds[i]);
        node.setAttribute('class', 'adsr-node');
        node.setAttribute('cx', point.x);
        node.setAttribute('cy', point.y);
        node.setAttribute('r', 8);
        node.setAttribute('fill', primaryColor); // Use primary color for node fill
        node.setAttribute('stroke', shadeHexColor(primaryColor, -0.3));
        node.setAttribute('stroke-width', 2);
        node.style.cursor = 'grab';

        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        node.appendChild(title);

        nodeLayer.appendChild(node);
    });
}


export function applyTheme(parentContainer, color) {
    const darkColor = shadeHexColor(color, -0.2);
    parentContainer.style.setProperty('--c-accent', color);
    parentContainer.style.setProperty('--c-accent-hover', darkColor);
}