// js/components/ADSR/adsrRender.js
import store from '../../state/store.js';

function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(204, 204, 204, ${alpha})`;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shadeHexColor(hex, percent) {
    if (!hex || typeof hex !== 'string') return '#CCCCCC';
    const f = parseInt(hex.slice(1), 16), t = percent < 0 ? 0 : 255, p = percent < 0 ? percent * -1 : percent;
    const R = f >> 16, G = f >> 8 & 0x00FF, B = f & 0x0000FF;
    return "#" + (0x1000000 + (Math.round((t - R) * p) + R) * 0x10000 + (Math.round((t - G) * p) + G) * 0x100 + (Math.round((t - B) * p) + B)).toString(16).slice(1);
}

export function drawTempoGridlines(gridLayer, { width, height }, totalADRTime) {
    while (gridLayer.firstChild) gridLayer.removeChild(gridLayer.firstChild);
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
        line.setAttribute('stroke', isMacrobeat ? '#dee2e6' : '#e9ecef');
        line.setAttribute('stroke-width', isMacrobeat ? '1' : '0.5');
        gridLayer.appendChild(line);
        beatCount++;
    }
}

export function drawEnvelope(envelopeLayer, nodeLayer, points, { height, width }, colorKey) {
    while (envelopeLayer.firstChild) envelopeLayer.removeChild(envelopeLayer.firstChild);
    while (nodeLayer.firstChild) nodeLayer.removeChild(nodeLayer.firstChild);
    if (points.length === 0) return;
    
    // Get the color pair from the store's palette
    const palette = store.state.colorPalette[colorKey] || { primary: colorKey, light: colorKey };
    const primaryColor = palette.primary;
    const lightColor = palette.light;

    // --- Draw Main Envelope Shape ---
    const fillPolygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const fillPoints = `0,${height} ` + points.map(p => `${p.x},${p.y}`).join(" ") + ` ${width},${height}`;
    fillPolygon.setAttribute("points", fillPoints);
    // Use the new light color with transparency for the fill
    fillPolygon.setAttribute("fill", hexToRgba(lightColor, 0.7));

    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points.map(p => `${p.x},${p.y}`).join(" "));
    polyline.setAttribute("stroke-width", 2);
    polyline.setAttribute("fill", "none");
    // Use the primary color for the line
    polyline.setAttribute("stroke", primaryColor);

    envelopeLayer.appendChild(fillPolygon);
    envelopeLayer.appendChild(polyline);

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