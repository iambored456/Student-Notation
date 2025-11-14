// js/services/playheadModel.js
/**
 * Centralized playhead geometry/time data so pitch and drum playheads
 * stay perfectly aligned.
 */

let cachedTimeMap = [];
let cachedMusicalEndTime = 0;
let columnPositions = [0];
let rightLegendStartIndex = 0;

function recomputeColumnPositions(columnWidths = [], cellWidth = 0) {
    columnPositions = [0];
    let x = 0;
    for (let i = 0; i < columnWidths.length; i++) {
        columnPositions[i] = x;
        x += (columnWidths[i] || 0) * cellWidth;
    }
    columnPositions[columnWidths.length] = x;
    rightLegendStartIndex = Math.max(0, columnWidths.length - 2);
}

export function updatePlayheadModel({
    timeMap = [],
    musicalEndTime = 0,
    columnWidths = [],
    cellWidth = 0
} = {}) {
    cachedTimeMap = Array.isArray(timeMap) ? [...timeMap] : [];
    cachedMusicalEndTime = Number(musicalEndTime) || 0;
    recomputeColumnPositions(columnWidths, cellWidth);
}

export function getTimeMapReference() {
    return cachedTimeMap;
}

export function getCachedMusicalEndTime() {
    return cachedMusicalEndTime;
}

export function getColumnStartX(index) {
    if (!Array.isArray(columnPositions) || columnPositions.length === 0) {
        return 0;
    }
    if (index <= 0) return 0;
    if (index >= columnPositions.length) {
        return columnPositions[columnPositions.length - 1] ?? 0;
    }
    return columnPositions[index] ?? columnPositions[columnPositions.length - 1] ?? 0;
}

export function getColumnWidth(index) {
    return getColumnStartX(index + 1) - getColumnStartX(index);
}

export function getRightLegendStartIndex() {
    return rightLegendStartIndex;
}

export function getCanvasWidth() {
    return columnPositions[columnPositions.length - 1] ?? 0;
}
