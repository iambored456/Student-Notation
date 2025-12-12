/**
 * ROW COORDINATE SYSTEMS
 * ======================
 *
 * This codebase uses TWO row coordinate systems for pitch positioning:
 *
 * 1. GLOBAL ROW (absolute position in masterRowData/fullRowData)
 *    ─────────────────────────────────────────────────────────────
 *    - Range: 0 to 104 (C8 at index 0, A0 at index 104)
 *    - Used for: Playback, pitch lookups, data persistence, audio
 *    - Access: fullRowData[globalRow] (always works, fullRowData is never sliced)
 *    - Stored on notes/stamps/triplets as: item.globalRow
 *
 * 2. VIEWPORT ROW (position relative to current pitchRange)
 *    ─────────────────────────────────────────────────────────────
 *    - Range: 0 to (pitchRange.bottomIndex - pitchRange.topIndex)
 *    - Used for: Canvas Y-coordinate calculations, rendering only
 *    - Conversion: viewportRow = globalRow - pitchRange.topIndex
 *    - Stored on notes/stamps/triplets as: item.row
 *
 * COORDINATE CONVERSION:
 *   globalRow   → viewportRow:  viewportRow = globalRow - pitchRange.topIndex
 *   viewportRow → globalRow:    globalRow = viewportRow + pitchRange.topIndex
 *
 * IMPORTANT USAGE RULES:
 *   ✓ For pitch data lookups:  fullRowData[note.globalRow]
 *   ✓ For playback/audio:      fullRowData[note.globalRow].toneNote
 *   ✓ For Y-position rendering: getRowY(note.row, options)  // viewport row
 *   ✗ AVOID: fullRowData[note.row] (only works if pitchRange.topIndex === 0)
 *
 * WHY TWO SYSTEMS?
 *   - fullRowData contains ALL 105 pitches (never sliced for performance)
 *   - pitchRange defines which pitches are currently visible/rendered
 *   - This allows notes outside the viewport to still play back correctly
 *   - Rendering is virtualized (only visible rows drawn) for performance
 *
 * See also:
 *   - src/state/initialState/index.ts - Pitch data architecture docs
 *   - src/components/canvas/PitchGrid/renderers/rendererUtils.ts - Y-position mapping
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
 * Development-only invariant to verify coordinate consistency.
 *
 * Since fullRowData now contains the complete gamut (same as masterRowData),
 * this function verifies that:
 * 1. item.globalRow (if set) matches the expected pitch
 * 2. item.row (viewport-relative) + topIndex === item.globalRow
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

  // Calculate the expected globalRow from viewport row
  const calculatedGlobalRow = resolveGlobalRow(item.row, currentTopIndex);

  // If item has globalRow set, it should match the calculated value
  if (typeof item.globalRow === 'number' && item.globalRow !== calculatedGlobalRow) {
    console.error('[ROW COORDINATE MISMATCH]', {
      source: source || 'rowCoordinates',
      item,
      currentTopIndex,
      viewportRow: item.row,
      storedGlobalRow: item.globalRow,
      calculatedGlobalRow,
      expectedPitch: fullRowData[calculatedGlobalRow]?.toneNote,
      actualPitch: fullRowData[item.globalRow]?.toneNote
    });
  }

  // Verify the pitch at globalRow matches expectations
  const globalRow = typeof item.globalRow === 'number' ? item.globalRow : calculatedGlobalRow;
  const pitchAtGlobalRow = fullRowData[globalRow]?.toneNote;
  const pitchAtMasterRow = masterRowData[globalRow]?.toneNote;

  if (pitchAtGlobalRow !== pitchAtMasterRow) {
    console.error('[PITCH DATA MISMATCH]', {
      source: source || 'rowCoordinates',
      globalRow,
      fullRowDataPitch: pitchAtGlobalRow,
      masterRowDataPitch: pitchAtMasterRow
    });
  }
}
