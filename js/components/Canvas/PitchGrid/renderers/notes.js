// js/components/Canvas/PitchGrid/renderers/notes.js
import { getColumnX, getRowY, getCurrentCoordinateMapping } from './rendererUtils.js';
import TonalService from '../../../../services/tonalService.js';
import store from '../../../../state/index.js';
// NOTE: Animation effects are now managed by animationEffectsManager in timbreEffects architecture
import {
    OVAL_NOTE_FONT_RATIO, FILLED_NOTE_FONT_RATIO, MIN_FONT_SIZE, MIN_TONIC_FONT_SIZE,
    MIN_STROKE_WIDTH_THICK, MIN_STROKE_WIDTH_THIN, STROKE_WIDTH_RATIO,
    TAIL_LINE_WIDTH_RATIO, MIN_TAIL_LINE_WIDTH, SHADOW_BLUR_RADIUS,
    TONIC_RADIUS_RATIO, MIN_TONIC_RADIUS, TONIC_BORDER_WIDTH, TONIC_FONT_SIZE_RATIO
} from '../../../../core/constants.js';

// Helper function to calculate visual offset for overlapping notes
function calculateColorOffset(note, allNotes, options) {
    const { cellWidth } = options;
    const offsetAmount = cellWidth * 0.25; // Small right offset - 25% of cell width
    
    // Safety check for ghost notes without UUIDs
    if (!note.uuid) {
        return 0; // Ghost notes get no offset
    }
    
    // Find all notes at the same position (row + startColumnIndex)
    const notesAtSamePosition = allNotes.filter(otherNote => 
        !otherNote.isDrum && 
        otherNote.row === note.row && 
        otherNote.startColumnIndex === note.startColumnIndex &&
        otherNote.uuid && // Ensure other note has UUID
        otherNote.uuid !== note.uuid // Don't include the note itself
    );
    
    
    if (notesAtSamePosition.length === 0) {
        return 0; // No offset needed
    }
    
    // Sort all notes at this position by their UUID (which contains timestamp)
    // Most recently placed notes (higher timestamps) should appear on top (rightmost)
    const allNotesAtPosition = [note, ...notesAtSamePosition];
    allNotesAtPosition.sort((a, b) => {
        // Extract timestamp from UUID format: uuid-timestamp-randomstring
        const timestampA = parseInt(a.uuid.split('-')[1]);
        const timestampB = parseInt(b.uuid.split('-')[1]);
        return timestampA - timestampB; // Sort by timestamp ascending (oldest first)
    });
    
    
    // Find the index of the current note in the sorted array
    const currentNoteIndex = allNotesAtPosition.findIndex(n => n.uuid === note.uuid);
    
    
    return currentNoteIndex * offsetAmount;
}

// Helper function to calculate vibrato Y offset
function calculateVibratoYOffset(note, options) {
    const { cellHeight } = options;

    // Check if this note should be animated
    const shouldAnimate = window.animationEffectsManager ? window.animationEffectsManager.shouldAnimateNote(note) : false;
    if (!shouldAnimate) {
        return 0;
    }

    // Get vibrato offset in semitones from animation service
    const vibratoOffsetSemitones = window.animationEffectsManager ? window.animationEffectsManager.getVibratoYOffset(note.color) : 0;


    // Convert semitones to pixels
    // In the pitch grid, one row = one semitone = cellHeight
    // So vibrato offset in pixels = offset in semitones * cellHeight
    const vibratoOffsetPixels = vibratoOffsetSemitones * cellHeight;


    return vibratoOffsetPixels;
}

// Helper function to draw radiating fill for envelope visualization
function drawEnvelopeFill(ctx, note, centerX, centerY, rx, ry) {
    // Check if this note should have fill animation
    if (!window.animationEffectsManager) {
        return;
    }

    const shouldFill = window.animationEffectsManager.shouldFillNote(note);

    if (!shouldFill) return;

    // Get fill level (0 to 1)
    const fillLevel = window.animationEffectsManager.getFillLevel(note);

    if (fillLevel <= 0) return;

    // Draw filled ellipse that radiates inward from perimeter with gradient
    // fillLevel 0 = no fill, fillLevel 1 = fully filled
    ctx.save();

    // Calculate the inner "unfilled" radius based on fill level
    // When fillLevel = 0, innerRatio = 1 (full size, no fill visible)
    // When fillLevel = 1, innerRatio = 0 (no inner space, fully filled)
    const innerRatio = 1 - fillLevel;

    // Create radial gradient for the fill effect
    // The gradient radiates from the center outward to create the "filling" effect
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(rx, ry));

    // Inner part (where the fill hasn't reached yet) - completely transparent
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(Math.max(0, innerRatio - 0.05), 'transparent');

    // Linear gradient from fill edge to outer perimeter
    // Creates smooth fade: darkest at the outer stroke, fading to transparent toward center
    gradient.addColorStop(innerRatio, note.color + '1F'); // 12% opacity at fill edge
    gradient.addColorStop(1, note.color + 'BF'); // 75% opacity at outer perimeter

    // Create clipping path for the shape
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, rx, ry, 0, 0, 2 * Math.PI);
    ctx.clip();

    // Fill with gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - rx - 10, centerY - ry - 10, (rx + 10) * 2, (ry + 10) * 2);

    ctx.restore();
}

// Helper function to calculate vertical offset for note tails
function calculateTailYOffset(note, allNotes, options) {
    const { cellHeight } = options;
    const tailOffsetAmount = (cellHeight / 2) * 0.12; // Vertical offset for tails - dual-parity spacing
    
    // Safety check for ghost notes without UUIDs
    if (!note.uuid) {
        return 0; // Ghost notes get no offset
    }
    
    // Find all notes at the same position (row + startColumnIndex) that have tails
    const notesWithTailsAtSamePosition = allNotes.filter(otherNote => 
        !otherNote.isDrum && 
        otherNote.row === note.row && 
        otherNote.startColumnIndex === note.startColumnIndex &&
        otherNote.uuid && // Ensure other note has UUID
        otherNote.uuid !== note.uuid && // Don't include the note itself
        otherNote.endColumnIndex > otherNote.startColumnIndex // Only notes with tails
    );
    
    
    if (notesWithTailsAtSamePosition.length === 0) {
        return 0; // No offset needed
    }
    
    // Sort all notes with tails at this position by their UUID timestamp
    const allNotesWithTailsAtPosition = [note, ...notesWithTailsAtSamePosition];
    allNotesWithTailsAtPosition.sort((a, b) => {
        const timestampA = parseInt(a.uuid.split('-')[1]);
        const timestampB = parseInt(b.uuid.split('-')[1]);
        return timestampA - timestampB; // Sort by timestamp ascending (oldest first)
    });
    
    // Find the index of the current note in the sorted array
    const currentNoteIndex = allNotesWithTailsAtPosition.findIndex(n => n.uuid === note.uuid);
    
    
    return currentNoteIndex * tailOffsetAmount;
}

function drawScaleDegreeText(ctx, note, options, centerX, centerY, noteHeight) {
    console.log(`🎵 [SCALE/MODE] drawScaleDegreeText called:`, {
        degreeDisplayMode: options.degreeDisplayMode,
        noteRow: note.row,
        noteStartCol: note.startColumnIndex,
        pitch: options.fullRowData[note.row]?.pitch
    });
    
    const degreeStr = TonalService.getDegreeForNote(note, options);
    
    console.log(`🎵 [SCALE/MODE] TonalService returned:`, {
        degreeStr,
        degreeDisplayMode: options.degreeDisplayMode
    });
    
    if (!degreeStr) return;
    
    // Scale font size with zoom level for clarity
    const fontSize = (note.shape === 'oval' ? noteHeight * OVAL_NOTE_FONT_RATIO : noteHeight * FILLED_NOTE_FONT_RATIO) * options.zoomLevel;
    if (fontSize < MIN_FONT_SIZE) return; // Don't draw text if it's too small to read

    ctx.fillStyle = '#212529';
    ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(degreeStr, centerX, centerY);
}

export function drawTwoColumnOvalNote(ctx, options, note, rowIndex) {
    
    const { cellWidth, cellHeight, zoomLevel } = options;
    const baseY = getRowY(rowIndex, options);
    const vibratoYOffset = calculateVibratoYOffset(note, options);
    const y = baseY + vibratoYOffset; // Apply vibrato animation
    const xStart = getColumnX(note.startColumnIndex, options);
    
    // MODULATION FIX: Calculate actual cell width from modulated positions for sizing
    let actualCellWidth;
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
        const nextX = getColumnX(note.startColumnIndex + 1, options);
        actualCellWidth = nextX - xStart;
    } else {
        actualCellWidth = cellWidth;
    }
    
    // Calculate visual offset for overlapping notes
    const xOffset = calculateColorOffset(note, store.state.placedNotes, options);
    const centerX = xStart + actualCellWidth + xOffset;
    
    // Don't double-scale - cellWidth/cellHeight already include zoom
    // Use modulated cell width for stroke calculations to maintain proper proportions
    const dynamicStrokeWidth = Math.max(MIN_STROKE_WIDTH_THICK, actualCellWidth * STROKE_WIDTH_RATIO);

    // Draw the tail/extension line if the note extends beyond its starting column
    if (note.endColumnIndex > note.startColumnIndex) {
        const originalEndX = getColumnX(note.endColumnIndex + 1, options);
        
        // Apply horizontal offset to end position, but shorten by the offset amount to stay within grid boundaries
        const endX = originalEndX + xOffset - xOffset;
        const tailYOffset = calculateTailYOffset(note, store.state.placedNotes, options);
        const tailY = y + tailYOffset;
        
        ctx.beginPath();
        ctx.moveTo(centerX, tailY);
        ctx.lineTo(endX, tailY);
        ctx.strokeStyle = note.color;
        ctx.lineWidth = Math.max(MIN_TAIL_LINE_WIDTH, actualCellWidth * TAIL_LINE_WIDTH_RATIO);
        ctx.stroke();
    }

    // Calculate ellipse dimensions for dual-parity grid spacing
    // Use modulated cell width for proper scaling
    const rx = actualCellWidth - (dynamicStrokeWidth / 2);
    const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2); // Dual-parity: notes should fill the rank height

    // Save context state for cleaner rendering
    ctx.save();

    // Draw envelope fill animation FIRST (underneath the stroke)
    drawEnvelopeFill(ctx, note, centerX, y, rx, ry);

    // Draw the circle/ellipse as a ring (hollow center)
    ctx.beginPath();
    ctx.ellipse(centerX, y, rx, ry, 0, 0, 2 * Math.PI);

    // Only stroke, no fill (to create transparent center)
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = SHADOW_BLUR_RADIUS;
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.restore();

    // Draw degree text if enabled
    if (options.degreeDisplayMode !== 'off') {
        drawScaleDegreeText(ctx, note, options, centerX, y, (cellHeight / 2)); // Use full note height for text sizing
    }
}

export function drawSingleColumnOvalNote(ctx, options, note, rowIndex) {
    
    const { columnWidths, cellWidth, cellHeight, zoomLevel } = options;
    const baseY = getRowY(rowIndex, options);
    const vibratoYOffset = calculateVibratoYOffset(note, options);
    const y = baseY + vibratoYOffset; // Apply vibrato animation
    const x = getColumnX(note.startColumnIndex, options);
    
    // MODULATION FIX: Calculate actual cell width from modulated positions
    let currentCellWidth;
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
        const nextX = getColumnX(note.startColumnIndex + 1, options);
        currentCellWidth = nextX - x;
    } else {
        currentCellWidth = columnWidths[note.startColumnIndex] * cellWidth;
    }
    
    // Calculate visual offset for overlapping notes
    const xOffset = calculateColorOffset(note, store.state.placedNotes, options);
    
    // Don't double-scale - cellWidth/cellHeight already include zoom
    const dynamicStrokeWidth = Math.max(0.5, currentCellWidth * 0.15);
    const cx = x + currentCellWidth / 2 + xOffset;
    const rx = (currentCellWidth / 2) - (dynamicStrokeWidth / 2);
    const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2); // Dual-parity: notes should fill the rank height

    // Save context state
    ctx.save();

    // Draw envelope fill animation FIRST (underneath the stroke)
    drawEnvelopeFill(ctx, note, cx, y, rx, ry);

    // Draw the oval as transparent ring (not filled)
    ctx.beginPath();
    ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);

    // Only stroke, no fill (to create transparent center)
    ctx.strokeStyle = note.color;
    ctx.lineWidth = dynamicStrokeWidth;
    ctx.shadowColor = note.color;
    ctx.shadowBlur = SHADOW_BLUR_RADIUS;
    ctx.stroke();

    // Reset shadow
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.restore();

    // Draw degree text if enabled
    if (options.degreeDisplayMode !== 'off') {
        drawScaleDegreeText(ctx, note, options, cx, y, (cellHeight / 2)); // Use full note height for text sizing
    }
}

export function drawTonicShape(ctx, options, tonicSign) {
    
    const { cellWidth, cellHeight } = options;
    const y = getRowY(tonicSign.row, options);
    const x = getColumnX(tonicSign.columnIndex, options);
    
    // MODULATION FIX: Calculate actual width for tonic sign scaling
    let actualCellWidth;
    if (options.modulationMarkers && options.modulationMarkers.length > 0) {
        const nextX = getColumnX(tonicSign.columnIndex + 1, options);
        actualCellWidth = nextX - x;
    } else {
        actualCellWidth = cellWidth;
    }

    // Don't double-scale - cellWidth/cellHeight already include zoom like notes
    // Use modulated cell width for proper scaling
    const width = actualCellWidth * 2;
    const centerX = x + width / 2;
    const radius = (Math.min(width, cellHeight) / 2 * 0.9);
    
    if (radius < 2) {
        return; // Don't draw if too small
    }

    ctx.beginPath();
    ctx.arc(centerX, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = Math.max(0.5, actualCellWidth * 0.05); // Use proportional line width like notes
    ctx.stroke();
    
    // Safety check for tonicNumber
    if (!tonicSign.tonicNumber) {
        return;
    }
    const numberText = tonicSign.tonicNumber.toString();
    const fontSize = radius * 1.5;
    if (fontSize < 6) {
        return; // Don't draw text if too small
    }

    ctx.fillStyle = '#212529';
    ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numberText, centerX, y);
}

/**
 * Checks if a note crosses modulation marker boundaries and needs special handling
 * @param {Object} note - Note object with startColumnIndex and endColumnIndex
 * @param {Object} options - Render options containing modulation markers
 * @returns {Object} Information about segments the note crosses
 */
export function analyzeNoteCrossesMarkers(note, options) {
    const { modulationMarkers } = options;
    
    if (!modulationMarkers || modulationMarkers.length === 0) {
        return { crossesMarkers: false, segments: [] };
    }
    
    const mapping = getCurrentCoordinateMapping(options);
    const noteStartX = getColumnX(note.startColumnIndex, options);
    const noteEndX = getColumnX(note.endColumnIndex + 1, options);
    
    const affectedSegments = mapping.segments.filter(segment => {
        // Check if note overlaps with this segment
        return !(noteEndX <= segment.startX || noteStartX >= segment.endX);
    });
    
    const crossesMarkers = affectedSegments.length > 1;
    
    return {
        crossesMarkers,
        segments: affectedSegments,
        noteStartX,
        noteEndX
    };
}