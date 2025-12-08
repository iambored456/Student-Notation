/**
 * Coordinate System Debugger
 *
 * Provides debugging tools to visualize and validate coordinate conversions
 * during the migration from dual-space to canvas-space only.
 */

import logger from './logger.ts';

interface ConversionEvent {
  timestamp: number;
  from: 'canvas' | 'full';
  to: 'canvas' | 'full';
  input: number;
  output: number;
  stackTrace?: string;
}

const conversionHistory: ConversionEvent[] = [];
const MAX_HISTORY_SIZE = 1000;

/**
 * Records a coordinate conversion for debugging
 */
export function recordConversion(
  from: 'canvas' | 'full',
  to: 'canvas' | 'full',
  input: number,
  output: number
): void {
  if (process.env['NODE_ENV'] !== 'development') {
    return;
  }

  const event: ConversionEvent = {
    timestamp: Date.now(),
    from,
    to,
    input,
    output,
    stackTrace: new Error().stack
  };

  conversionHistory.push(event);

  // Keep history bounded
  if (conversionHistory.length > MAX_HISTORY_SIZE) {
    conversionHistory.shift();
  }

  logger.debug('coordinateDebugger', `Conversion: ${from}(${input}) → ${to}(${output})`, {
    from,
    to,
    input,
    output
  }, 'coords');
}

/**
 * Gets recent conversion history
 */
export function getConversionHistory(count: number = 100): ConversionEvent[] {
  return conversionHistory.slice(-count);
}

/**
 * Clears conversion history
 */
export function clearConversionHistory(): void {
  conversionHistory.length = 0;
}

/**
 * Prints a visual representation of the coordinate spaces
 */
export function visualizeCoordinateSpaces(columnWidths: number[]): string {
  const totalColumns = columnWidths.length;
  const musicalStart = 2;
  const musicalEnd = totalColumns - 2;

  const lines: string[] = [];

  lines.push('');
  lines.push('COORDINATE SPACE VISUALIZATION');
  lines.push('==============================');
  lines.push('');

  // Full-space indices
  const fullSpaceIndices = columnWidths.map((_, i) => i.toString().padStart(3));
  lines.push(`Full-Space:  [${fullSpaceIndices.join('][')}]`);

  // Column types
  const columnTypes = columnWidths.map((_, i) => {
    if (i < musicalStart) {return ' LL';} // Left Legend
    if (i >= musicalEnd) {return ' RL';} // Right Legend
    return ' M '; // Musical
  });
  lines.push(`Type:        [${columnTypes.join('][')}]`);

  // Canvas-space indices (only for musical columns)
  const canvasSpaceIndices = columnWidths.map((_, i) => {
    if (i < musicalStart || i >= musicalEnd) {return '  -';}
    return (i - musicalStart).toString().padStart(3);
  });
  lines.push(`Canvas-Space:[${canvasSpaceIndices.join('][')}]`);

  lines.push('');
  lines.push('Legend: LL = Left Legend, RL = Right Legend, M = Musical');
  lines.push('');

  return lines.join('\n');
}

/**
 * Validates that a note/stamp/triplet has valid canvas-space coordinates
 */
export function validateCanvasSpaceObject(
  obj: { startColumnIndex?: number; endColumnIndex?: number; startColumn?: number; endColumn?: number; columnIndex?: number },
  musicalColumnCount: number,
  objectType: string
): boolean {
  if (process.env['NODE_ENV'] !== 'development') {
    return true;
  }

  const errors: string[] = [];

  // Check startColumnIndex / startColumn
  const startCol = obj.startColumnIndex ?? obj.startColumn;
  if (startCol !== undefined) {
    if (startCol < 0) {
      errors.push(`${objectType} startColumn ${startCol} is negative`);
    }
    if (startCol >= musicalColumnCount) {
      errors.push(`${objectType} startColumn ${startCol} >= musicalColumnCount ${musicalColumnCount}`);
    }
  }

  // Check endColumnIndex / endColumn
  const endCol = obj.endColumnIndex ?? obj.endColumn;
  if (endCol !== undefined) {
    if (endCol < 0) {
      errors.push(`${objectType} endColumn ${endCol} is negative`);
    }
    if (endCol > musicalColumnCount) {
      errors.push(`${objectType} endColumn ${endCol} > musicalColumnCount ${musicalColumnCount}`);
    }
  }

  // Check columnIndex (for tonic signs)
  if (obj.columnIndex !== undefined) {
    if (obj.columnIndex < 0) {
      errors.push(`${objectType} columnIndex ${obj.columnIndex} is negative`);
    }
    if (obj.columnIndex >= musicalColumnCount) {
      errors.push(`${objectType} columnIndex ${obj.columnIndex} >= musicalColumnCount ${musicalColumnCount}`);
    }
  }

  if (errors.length > 0) {
    logger.error('coordinateDebugger', `Validation failed for ${objectType}`, {
      object: obj,
      errors,
      musicalColumnCount
    }, 'coords');
    return false;
  }

  return true;
}

/**
 * Analyzes state for coordinate space issues
 */
export function analyzeStateCoordinates(state: any): {
  totalNotes: number;
  totalStamps: number;
  totalTriplets: number;
  totalTonicSigns: number;
  invalidNotes: number;
  invalidStamps: number;
  invalidTriplets: number;
  invalidTonicSigns: number;
  issues: string[];
} {
  const musicalColumnCount = state.columnWidths?.length ? state.columnWidths.length - 4 : 0;
  const issues: string[] = [];

  let invalidNotes = 0;
  let invalidStamps = 0;
  let invalidTriplets = 0;
  let invalidTonicSigns = 0;

  // Validate notes
  (state.placedNotes || []).forEach((note: any, index: number) => {
    if (!validateCanvasSpaceObject(note, musicalColumnCount, `Note[${index}]`)) {
      invalidNotes++;
    }
  });

  // Validate stamps
  (state.stampPlacements || []).forEach((stamp: any, index: number) => {
    if (!validateCanvasSpaceObject(stamp, musicalColumnCount, `Stamp[${index}]`)) {
      invalidStamps++;
    }
  });

  // Validate triplets
  (state.tripletPlacements || []).forEach((triplet: any, index: number) => {
    // Triplets use cell indices, so musicalColumnCount / 2
    const cellCount = Math.floor(musicalColumnCount / 2);
    if (triplet.startCellIndex !== undefined && triplet.startCellIndex >= cellCount) {
      issues.push(`Triplet[${index}] startCellIndex ${triplet.startCellIndex} >= cellCount ${cellCount}`);
      invalidTriplets++;
    }
  });

  // Validate tonic signs
  Object.values(state.tonicSignGroups || {}).forEach((group: any) => {
    (group || []).forEach((sign: any, index: number) => {
      if (!validateCanvasSpaceObject(sign, musicalColumnCount, `TonicSign[${index}]`)) {
        invalidTonicSigns++;
      }
    });
  });

  return {
    totalNotes: (state.placedNotes || []).length,
    totalStamps: (state.stampPlacements || []).length,
    totalTriplets: (state.tripletPlacements || []).length,
    totalTonicSigns: Object.values(state.tonicSignGroups || {}).flat().length,
    invalidNotes,
    invalidStamps,
    invalidTriplets,
    invalidTonicSigns,
    issues
  };
}

/**
 * Enables coordinate debugging in the global window object
 */
export function enableGlobalDebugging(): void {
  if (typeof window !== 'undefined' && process.env['NODE_ENV'] === 'development') {
    // Dynamically import the validator (will be available after build)
    import('./coordinateValidator.js')
      .then(validator => {
        (window as any).__COORD_DEBUG__ = {
          getHistory: getConversionHistory,
          clearHistory: clearConversionHistory,
          visualize: visualizeCoordinateSpaces,
          analyze: analyzeStateCoordinates,
          // Add validator functions
          validate: validator.validateAndReport,
          runAllValidations: validator.runAllValidations,
          printReport: validator.printValidationReport
        };

        logger.info('coordinateDebugger', 'Coordinate debugging enabled with validation. Access via window.__COORD_DEBUG__', null, 'coords');
        logger.info('coordinateDebugger', 'Run window.__COORD_DEBUG__.validate(store.state) to validate coordinates', null, 'coords');
      })
      .catch(err => {
        // Fallback if validator is not available
        (window as any).__COORD_DEBUG__ = {
          getHistory: getConversionHistory,
          clearHistory: clearConversionHistory,
          visualize: visualizeCoordinateSpaces,
          analyze: analyzeStateCoordinates
        };

        logger.warn('coordinateDebugger', 'Coordinate debugging enabled without validator', { error: err.message }, 'coords');
      });
  }
}
