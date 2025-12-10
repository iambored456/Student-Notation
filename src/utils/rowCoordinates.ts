/**
 * Shared helpers for mapping row-based items between viewport (relative) space
 * and absolute pitch space.
 */

export interface RowPositionedItem {
  row: number;
  globalRow?: number;
}

/**
 * Resolve the absolute row for an item, computing it from the current topIndex
 * if the item does not yet have globalRow.
 */
export function resolveGlobalRow(row: number, currentTopIndex: number): number {
  return row + currentTopIndex;
}

/**
 * Map an absolute row back into the current viewport (relative) space.
 */
export function mapToRelativeRow(globalRow: number, newTopIndex: number): number {
  return globalRow - newTopIndex;
}

/**
 * Convenience helper to remap an item across pitch ranges.
 */
export function remapRowPosition(
  item: RowPositionedItem,
  oldTopIndex: number,
  newTopIndex: number,
  newBottomIndex: number
): { globalRow: number; mappedRow: number; outsideRange: boolean } {
  const globalRow = typeof item.globalRow === 'number'
    ? item.globalRow
    : resolveGlobalRow(item.row, oldTopIndex);

  const mappedRow = mapToRelativeRow(globalRow, newTopIndex);
  const outsideRange = globalRow < newTopIndex || globalRow > newBottomIndex;

  return { globalRow, mappedRow, outsideRange };
}

/**
 * Development-only invariant to catch coordinate drift between viewport and
 * absolute pitch spaces.
 */
export function assertRowIntegrity(
  item: RowPositionedItem,
  fullRowData: { toneNote?: string }[],
  masterRowData: { toneNote?: string }[],
  currentTopIndex: number,
  source?: string
): void {
  if (process.env['NODE_ENV'] !== 'development') {
    return;
  }

  const globalRow = typeof item.globalRow === 'number'
    ? item.globalRow
    : resolveGlobalRow(item.row, currentTopIndex);

  const viewportTone = fullRowData[item.row]?.toneNote;
  const masterTone = masterRowData[globalRow]?.toneNote;

  if (viewportTone && masterTone && viewportTone !== masterTone) {
    console.error('[PITCH DRIFT]', {
      source: source || 'rowCoordinates',
      item,
      currentTopIndex,
      viewportTone,
      masterTone,
      viewportRow: item.row,
      globalRow
    });
  }
}
