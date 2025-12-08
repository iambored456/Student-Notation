/**
 * Centralized playhead geometry/time data so pitch and drum playheads stay aligned.
 *
 * IMPORTANT: The playhead coordinate system excludes legend columns.
 * - columnWidths[0-1]: Left legend (excluded from playhead)
 * - columnWidths[2 to length-3]: Musical grid (playhead moves here)
 * - columnWidths[length-2 to length-1]: Right legend (excluded from playhead)
 */

let cachedTimeMap: number[] = [];
let cachedMusicalEndTime = 0;
let columnPositions: number[] = [0]; // Positions for musical columns only (no legends)
let rightLegendStartIndex = 0;
let leftLegendWidth = 0; // Width of left legend (2 columns)

function recomputeColumnPositions(columnWidths: number[] = [], cellWidth = 0): void {
  columnPositions = [0];

  // Calculate left legend width (first 2 columns)
  leftLegendWidth = 0;
  for (let i = 0; i < 2 && i < columnWidths.length; i++) {
    leftLegendWidth += (columnWidths[i] || 0) * cellWidth;
  }

  // Build column positions for MUSICAL GRID ONLY (skip first 2 and last 2 columns)
  let x = 0;
  const musicalStartIndex = 2;
  const musicalEndIndex = Math.max(2, columnWidths.length - 2);

  for (let i = musicalStartIndex; i < musicalEndIndex; i++) {
    columnPositions[i - musicalStartIndex] = x;
    x += (columnWidths[i] || 0) * cellWidth;
  }
  columnPositions[musicalEndIndex - musicalStartIndex] = x;

  // Right legend starts at the last musical column
  rightLegendStartIndex = musicalEndIndex - musicalStartIndex;
}

export function updatePlayheadModel({
  timeMap = [],
  musicalEndTime = 0,
  columnWidths = [],
  cellWidth = 0
}: {
  timeMap?: number[];
  musicalEndTime?: number;
  columnWidths?: number[];
  cellWidth?: number;
} = {}): void {
  cachedTimeMap = Array.isArray(timeMap) ? [...timeMap] : [];
  cachedMusicalEndTime = Number(musicalEndTime) || 0;
  recomputeColumnPositions(columnWidths, cellWidth);
}

export function getTimeMapReference(): number[] {
  return cachedTimeMap;
}

export function getCachedMusicalEndTime(): number {
  return cachedMusicalEndTime;
}

export function getColumnStartX(index: number): number {
  if (!Array.isArray(columnPositions) || columnPositions.length === 0) {
    return 0;
  }
  if (index <= 0) {return 0;}
  if (index >= columnPositions.length) {
    return columnPositions[columnPositions.length - 1] ?? 0;
  }
  return columnPositions[index] ?? columnPositions[columnPositions.length - 1] ?? 0;
}

export function getColumnWidth(index: number): number {
  return getColumnStartX(index + 1) - getColumnStartX(index);
}

export function getRightLegendStartIndex(): number {
  return rightLegendStartIndex;
}

export function getCanvasWidth(): number {
  return columnPositions[columnPositions.length - 1] ?? 0;
}

export function getLeftLegendWidth(): number {
  return leftLegendWidth;
}
