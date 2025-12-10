// js/components/Canvas/PitchGrid/renderers/notes.ts
import { getColumnX, getRowY, getCurrentCoordinateMapping } from './rendererUtils.ts';
import TonalService from '@services/tonalService.ts';
import store from '@state/index.ts';
import columnMapService from '@services/columnMapService.ts';
import type { AppState, ModulationMarker, PlacedNote, TonicSign } from '../../../../../types/state.js';
import {
  OVAL_NOTE_FONT_RATIO,
  FILLED_NOTE_FONT_RATIO,
  MIN_FONT_SIZE,
  MIN_STROKE_WIDTH_THICK,
  STROKE_WIDTH_RATIO,
  TAIL_LINE_WIDTH_RATIO,
  MIN_TAIL_LINE_WIDTH,
  SHADOW_BLUR_RADIUS
} from '../../../../core/constants.js';

const SHARP_SYMBOL = '\u266F';
const FLAT_SYMBOL = '\u266D';
const DEGREE_SEPARATOR = '/';

type PitchRendererOptions = Partial<AppState> & {
  columnWidths: number[];
  cellWidth: number;
  cellHeight: number;
  modulationMarkers?: ModulationMarker[];
  baseMicrobeatPx?: number;
};

interface ScaleDegreeResult {
  label: string | null;
  isAccidental: boolean;
}

interface DegreeFontResult {
  multiplier: number;
  category: 'natural' | 'single-accidental' | 'both-accidentals';
}

interface AnimationEffectsManager {
  shouldAnimateNote(note: PlacedNote): boolean;
  getVibratoYOffset(color?: string): number;
  shouldFillNote(note: PlacedNote): boolean;
  getFillLevel(note: PlacedNote): number;
}

const getAnimationEffectsManager = (): AnimationEffectsManager | undefined => {
  const effectsWindow = window as Window & { animationEffectsManager?: AnimationEffectsManager };
  return effectsWindow.animationEffectsManager;
};

const getPlacedNotes = (): PlacedNote[] => store.state.placedNotes;

let _invalidDimensionWarningShown = false;
const _loggedTonicPositions = new Set<string>();
const _tonicLogState: Record<string, { lastValues: Record<string, number | string | null> }> = {};

function getScrollDiagnostics() {
  const gridsWrapper = document.getElementById('grids-wrapper');
  const pitchWrapper = document.getElementById('pitch-grid-wrapper');
  const pitchContainer = document.getElementById('pitch-grid-container');
  const buttonGrid = document.getElementById('button-grid');
  const notationGrid = document.getElementById('notation-grid');
  const gridScrollbar = document.getElementById('grid-scrollbar-proxy');
  const canvasRect = notationGrid?.getBoundingClientRect();
  const wrapperRect = gridsWrapper?.getBoundingClientRect();

  return {
    gridsWrapperScroll: gridsWrapper ? gridsWrapper.scrollLeft : null,
    pitchWrapperScroll: pitchWrapper ? pitchWrapper.scrollLeft : null,
    pitchContainerScroll: pitchContainer ? pitchContainer.scrollLeft : null,
    buttonGridScroll: buttonGrid ? buttonGrid.scrollLeft : null,
    scrollbarProxyScroll: gridScrollbar ? gridScrollbar.scrollLeft : null,
    gridsWrapperWidth: gridsWrapper ? gridsWrapper.clientWidth : null,
    pitchWrapperWidth: pitchWrapper ? pitchWrapper.clientWidth : null,
    pitchContainerWidth: pitchContainer ? pitchContainer.clientWidth : null,
    canvasLeft: canvasRect?.left ?? null,
    canvasRight: canvasRect?.right ?? null,
    wrapperLeft: wrapperRect?.left ?? null,
    wrapperRight: wrapperRect?.right ?? null,
    canvasTransform: notationGrid ? window.getComputedStyle(notationGrid).transform : null
  };
}

const getUuidTimestamp = (value?: string): number => {
  const timestampSegment = value?.split('-')[1];
  return Number.parseInt(timestampSegment ?? '0', 10);
};

function hasVisibleTail(note: PlacedNote): boolean {
  if (!note || typeof note.startColumnIndex !== 'number' || typeof note.endColumnIndex !== 'number') {
    return false;
  }
  const baselineEnd = note.shape === 'circle'
    ? note.startColumnIndex + 1
    : note.startColumnIndex;
  return note.endColumnIndex > baselineEnd;
}

function calculateColorOffset(note: PlacedNote, allNotes: PlacedNote[], options: PitchRendererOptions): number {
  const { cellWidth } = options;
  const offsetAmount = cellWidth * 0.25;

  const noteUuid = note.uuid;
  if (!noteUuid) {
    return 0;
  }

  const notesAtSamePosition = allNotes.filter(otherNote =>
    !otherNote.isDrum &&
    otherNote.row === note.row &&
    otherNote.startColumnIndex === note.startColumnIndex &&
    otherNote.uuid &&
    otherNote.uuid !== noteUuid
  );

  if (notesAtSamePosition.length === 0) {
    return 0;
  }

  const allNotesAtPosition = [note, ...notesAtSamePosition];
  allNotesAtPosition.sort((a, b) => getUuidTimestamp(a.uuid) - getUuidTimestamp(b.uuid));

  const currentNoteIndex = allNotesAtPosition.findIndex(n => n.uuid === noteUuid);
  return currentNoteIndex * offsetAmount;
}

function calculateVibratoYOffset(note: PlacedNote, options: PitchRendererOptions): number {
  const { cellHeight } = options;
  const animationManager = getAnimationEffectsManager();

  if (!animationManager?.shouldAnimateNote(note)) {
    return 0;
  }

  const vibratoOffset = animationManager.getVibratoYOffset(note.color);
  return vibratoOffset * cellHeight;
}

function drawEnvelopeFill(
  ctx: CanvasRenderingContext2D,
  note: PlacedNote,
  centerX: number,
  centerY: number,
  rx: number,
  ry: number
): void {
  const animationManager = getAnimationEffectsManager();
  if (!animationManager?.shouldFillNote(note)) {
    return;
  }

  const fillLevel = animationManager.getFillLevel(note);
  if (fillLevel <= 0) {return;}

  ctx.save();

  const innerRatio = 1 - fillLevel;
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(rx, ry));
  gradient.addColorStop(0, 'transparent');
  gradient.addColorStop(Math.max(0, innerRatio - 0.05), 'transparent');
  gradient.addColorStop(innerRatio, `${note.color}1F`);
  gradient.addColorStop(1, `${note.color}BF`);

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, rx, ry, 0, 0, 2 * Math.PI);
  ctx.clip();
  ctx.fillStyle = gradient;
  ctx.fillRect(centerX - rx - 10, centerY - ry - 10, (rx + 10) * 2, (ry + 10) * 2);

  ctx.restore();
}

function calculateTailYOffset(note: PlacedNote, allNotes: PlacedNote[], options: PitchRendererOptions): number {
  const { cellHeight } = options;
  const tailOffsetAmount = (cellHeight / 2) * 0.12;

  const noteUuid = note.uuid;
  if (!noteUuid) {
    return 0;
  }

  const notesWithTailsAtSamePosition = allNotes.filter(otherNote =>
    !otherNote.isDrum &&
    otherNote.row === note.row &&
    otherNote.startColumnIndex === note.startColumnIndex &&
    otherNote.uuid &&
    otherNote.uuid !== noteUuid &&
    hasVisibleTail(otherNote)
  );

  if (notesWithTailsAtSamePosition.length === 0) {
    return 0;
  }

  const allNotesWithTailsAtPosition = [note, ...notesWithTailsAtSamePosition];
  allNotesWithTailsAtPosition.sort((a, b) => getUuidTimestamp(a.uuid) - getUuidTimestamp(b.uuid));

  const currentNoteIndex = allNotesWithTailsAtPosition.findIndex(n => n.uuid === noteUuid);
  return currentNoteIndex * tailOffsetAmount;
}

function getScaleDegreeLabel(note: PlacedNote, options: PitchRendererOptions): ScaleDegreeResult {
  const degreeStr = TonalService.getDegreeForNote(note, options as AppState);
  if (!degreeStr) {
    return { label: null, isAccidental: false };
  }

  const isAccidental = TonalService.hasAccidental(degreeStr);
  if (!isAccidental) {
    return { label: degreeStr, isAccidental: false };
  }

  const accidentalMode = store.state.accidentalMode || {};
  const sharpEnabled = accidentalMode.sharp ?? true;
  const flatEnabled = accidentalMode.flat ?? true;

  if (!sharpEnabled && !flatEnabled) {
    return { label: null, isAccidental: true };
  }

  let sharpLabel = degreeStr.includes(SHARP_SYMBOL) ? degreeStr : null;
  let flatLabel = degreeStr.includes(FLAT_SYMBOL) ? degreeStr : null;
  const enharmonic = TonalService.getEnharmonicDegree(degreeStr);

  if (enharmonic) {
    if (enharmonic.includes(SHARP_SYMBOL) && !sharpLabel) {
      sharpLabel = enharmonic;
    }
    if (enharmonic.includes(FLAT_SYMBOL) && !flatLabel) {
      flatLabel = enharmonic;
    }
  }

  let label: string | null = null;
  if (sharpEnabled && flatEnabled) {
    const parts: string[] = [];
    if (sharpLabel) {
      parts.push(sharpLabel);
    }
    if (flatLabel && (!sharpLabel || flatLabel !== sharpLabel)) {
      parts.push(flatLabel);
    }
    label = parts.join(DEGREE_SEPARATOR);
    if (!label) {
      label = degreeStr;
    }
  } else if (sharpEnabled) {
    label = sharpLabel || degreeStr;
  } else if (flatEnabled) {
    label = flatLabel || degreeStr;
  }

  return { label, isAccidental: true };
}

function getDegreeFontMultiplier(label: string | null): DegreeFontResult {
  if (!label) {return { multiplier: 1.0, category: 'natural' };
  }

  const hasFlat = label.includes(FLAT_SYMBOL);
  const hasSharp = label.includes(SHARP_SYMBOL);
  const hasBothAccidentals = label.includes(DEGREE_SEPARATOR);

  if (!hasFlat && !hasSharp) {
    return { multiplier: 1.0, category: 'natural' };
  }
  if (hasBothAccidentals) {
    return { multiplier: 0.75, category: 'both-accidentals' };
  }
  return { multiplier: 0.88, category: 'single-accidental' };
}

function drawScaleDegreeText(
  ctx: CanvasRenderingContext2D,
  note: PlacedNote,
  options: PitchRendererOptions,
  centerX: number,
  centerY: number,
  noteWidth: number,
  _noteHeight?: number
): void {
  const { label: noteLabel } = getScaleDegreeLabel(note, options);
  if (!noteLabel) {return;
  }

  const { multiplier: contentMultiplier, category } = getDegreeFontMultiplier(noteLabel);
  let baseFontSize: number;

  if (note.shape === 'circle') {
    const circleBaseSize = noteWidth * 2 * FILLED_NOTE_FONT_RATIO;
    switch (category) {
      case 'natural':
        baseFontSize = circleBaseSize;
        break;
      case 'single-accidental':
        baseFontSize = circleBaseSize * 0.8;
        break;
      case 'both-accidentals':
        baseFontSize = circleBaseSize * 0.4;
        break;
      default:
        baseFontSize = circleBaseSize * contentMultiplier;
    }
  } else {
    const ovalBaseSize = noteWidth * 2 * OVAL_NOTE_FONT_RATIO;
    switch (category) {
      case 'natural':
        baseFontSize = ovalBaseSize * 1.5;
        break;
      case 'single-accidental':
        baseFontSize = ovalBaseSize * 1.2;
        break;
      case 'both-accidentals':
        baseFontSize = ovalBaseSize;
        break;
      default:
        baseFontSize = ovalBaseSize * contentMultiplier;
    }
  }

  const fontSize = baseFontSize;
  if (fontSize < MIN_FONT_SIZE) {return;
  }

  ctx.fillStyle = '#212529';
  ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (note.shape === 'oval' && category === 'both-accidentals' && noteLabel.includes(DEGREE_SEPARATOR)) {
    const parts = noteLabel.split(DEGREE_SEPARATOR);
    const lineHeight = fontSize * 1.1;
    const totalHeight = lineHeight * (parts.length - 1);
    const startY = centerY - (totalHeight / 2);

    parts.forEach((part, index) => {
      const y = startY + (index * lineHeight);
      const opticalOffset = fontSize * 0.08;
      ctx.fillText(part.trim(), centerX, y + opticalOffset);
    });
  } else {
    const opticalOffset = fontSize * 0.08;
    ctx.fillText(noteLabel, centerX, centerY + opticalOffset);
  }
}

function hasRenderableDimensions(width: number, height: number): boolean {
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
}

export function drawTwoColumnOvalNote(
  ctx: CanvasRenderingContext2D,
  options: PitchRendererOptions,
  note: PlacedNote,
  rowIndex: number
): void {
  const { cellWidth, cellHeight, modulationMarkers } = options;
  const baseY = getRowY(rowIndex, options);
  const vibratoYOffset = calculateVibratoYOffset(note, options);
  const y = baseY + vibratoYOffset;
  const xStart = getColumnX(note.startColumnIndex, options);

  let actualCellWidth: number;
  if (modulationMarkers && modulationMarkers.length > 0) {
    const nextX = getColumnX(note.startColumnIndex + 1, options);
    actualCellWidth = nextX - xStart;
  } else {
    actualCellWidth = cellWidth;
  }

  if (!hasRenderableDimensions(actualCellWidth, cellHeight)) {
    _invalidDimensionWarningShown = true;
    return;
  }

  const xOffset = calculateColorOffset(note, getPlacedNotes(), options);
  const centerX = xStart + actualCellWidth + xOffset;
  const dynamicStrokeWidth = Math.max(MIN_STROKE_WIDTH_THICK, actualCellWidth * STROKE_WIDTH_RATIO);

  if (hasVisibleTail(note)) {
    const originalEndX = getColumnX(note.endColumnIndex + 1, options);
    const tailYOffset = calculateTailYOffset(note, getPlacedNotes(), options);
    const tailY = y + tailYOffset;

    ctx.beginPath();
    ctx.moveTo(centerX, tailY);
    ctx.lineTo(originalEndX, tailY);
    ctx.strokeStyle = note.color;
    ctx.lineWidth = Math.max(MIN_TAIL_LINE_WIDTH, actualCellWidth * TAIL_LINE_WIDTH_RATIO);
    ctx.stroke();
  }

  const rx = actualCellWidth - (dynamicStrokeWidth / 2);
  const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2);

  if (!hasRenderableDimensions(rx, ry)) {
    return;
  }

  ctx.save();
  drawEnvelopeFill(ctx, note, centerX, y, rx, ry);
  ctx.beginPath();
  ctx.ellipse(centerX, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.strokeStyle = note.color;
  ctx.lineWidth = dynamicStrokeWidth;
  ctx.shadowColor = note.color;
  ctx.shadowBlur = SHADOW_BLUR_RADIUS;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.restore();

  if (options.degreeDisplayMode !== 'off') {
    drawScaleDegreeText(ctx, note, options, centerX, y, rx);
  }
}

export function drawSingleColumnOvalNote(
  ctx: CanvasRenderingContext2D,
  options: PitchRendererOptions,
  note: PlacedNote,
  rowIndex: number
): void {
  const { columnWidths, cellWidth, cellHeight, modulationMarkers } = options;
  const baseY = getRowY(rowIndex, options);
  const vibratoYOffset = calculateVibratoYOffset(note, options);
  const y = baseY + vibratoYOffset;
  const x = getColumnX(note.startColumnIndex, options);

  let currentCellWidth: number;
  if (modulationMarkers && modulationMarkers.length > 0) {
    const nextX = getColumnX(note.startColumnIndex + 1, options);
    currentCellWidth = nextX - x;
  } else {
    // Notes use canvas-space indices, so use musicalColumnWidths
    const musicalColumnWidths = options.musicalColumnWidths || columnWidths;
    currentCellWidth = (musicalColumnWidths[note.startColumnIndex] ?? 0) * cellWidth;
  }

  if (!hasRenderableDimensions(currentCellWidth, cellHeight)) {
    _invalidDimensionWarningShown = true;
    return;
  }

  const xOffset = calculateColorOffset(note, getPlacedNotes(), options);
  const dynamicStrokeWidth = Math.max(0.5, currentCellWidth * 0.15);
  const cx = x + currentCellWidth / 2 + xOffset;
  const rx = (currentCellWidth / 2) - (dynamicStrokeWidth / 2);
  const ry = (cellHeight / 2) - (dynamicStrokeWidth / 2);

  if (!hasRenderableDimensions(rx, ry)) {
    return;
  }

  ctx.save();
  drawEnvelopeFill(ctx, note, cx, y, rx, ry);
  ctx.beginPath();
  ctx.ellipse(cx, y, rx, ry, 0, 0, 2 * Math.PI);
  ctx.strokeStyle = note.color;
  ctx.lineWidth = dynamicStrokeWidth;
  ctx.shadowColor = note.color;
  ctx.shadowBlur = SHADOW_BLUR_RADIUS;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.restore();

  if (options.degreeDisplayMode !== 'off') {
    drawScaleDegreeText(ctx, note, options, cx, y, rx);
  }
}

export function drawTonicShape(
  ctx: CanvasRenderingContext2D,
  options: PitchRendererOptions,
  tonicSign: TonicSign
): void {
  const { cellWidth, cellHeight, modulationMarkers } = options;
  const y = getRowY(tonicSign.row, options);

  // DIAGNOSTIC: Log Y position calculation for tonic drift debugging
  console.log('[TONIC Y DIAGNOSTIC]', {
    inputRow: tonicSign.row,
    calculatedY: y,
    cellHeight: cellHeight,
  });

  // Resolve tonic column from column map (source of truth) to avoid drift if groupings change
  let canvasSpaceColumn = tonicSign.columnIndex;
  if (tonicSign.uuid) {
    const map = columnMapService.getColumnMap(store.state as AppState);
    const entry = map.entries.find(e =>
      e.type === 'tonic' &&
      e.tonicSignUuid === tonicSign.uuid &&
      typeof e.canvasIndex === 'number'
    );
    if (entry && typeof entry.canvasIndex === 'number') {
      const logKey = tonicSign.uuid;
      if (entry.canvasIndex !== canvasSpaceColumn && !_loggedTonicPositions.has(logKey)) {
        console.log('[TonicShape] Column mismatch', {
          uuid: tonicSign.uuid,
          storedColumnIndex: canvasSpaceColumn,
          resolvedColumnIndex: entry.canvasIndex
        });
        _loggedTonicPositions.add(logKey);
      }

      const scrollInfo = getScrollDiagnostics();
      const xPos = getColumnX(entry.canvasIndex, options);
      const screenX = scrollInfo.canvasLeft !== null ? xPos + scrollInfo.canvasLeft : null;
      const values: Record<string, number | string | null> = {
        xPos,
        screenX,
        columnIndex: entry.canvasIndex,
        gridsWrapperScroll: scrollInfo.gridsWrapperScroll,
        pitchWrapperScroll: scrollInfo.pitchWrapperScroll,
        pitchContainerScroll: scrollInfo.pitchContainerScroll,
        buttonGridScroll: scrollInfo.buttonGridScroll,
        scrollbarProxyScroll: scrollInfo.scrollbarProxyScroll,
        canvasLeft: scrollInfo.canvasLeft,
        canvasRight: scrollInfo.canvasRight,
        wrapperLeft: scrollInfo.wrapperLeft,
        wrapperRight: scrollInfo.wrapperRight,
        gridsWrapperWidth: scrollInfo.gridsWrapperWidth,
        pitchWrapperWidth: scrollInfo.pitchWrapperWidth,
        pitchContainerWidth: scrollInfo.pitchContainerWidth,
        canvasTransform: scrollInfo.canvasTransform || ''
      };

      const last = _tonicLogState[logKey]?.lastValues || {};
      const changed = Object.keys(values).some(k => {
        const prev = last[k];
        const next = values[k];
        if (typeof prev === 'number' && typeof next === 'number') {
          return Math.abs(prev - next) > 0.5;
        }
        return prev !== next;
      });

      if (changed) {
        console.log('[TonicShape] draw debug', {
          uuid: tonicSign.uuid,
          ...values,
          totalCanvasColumns: map.totalCanvasColumns
        });
        _tonicLogState[logKey] = { lastValues: values };
      }

      canvasSpaceColumn = entry.canvasIndex;
    } else if (!_loggedTonicPositions.has(`missing-${tonicSign.uuid}`)) {
      console.log('[TonicShape] No column map entry found for tonic', {
        uuid: tonicSign.uuid,
        storedColumnIndex: canvasSpaceColumn
      });
      _loggedTonicPositions.add(`missing-${tonicSign.uuid}`);
    }
  }
  const x = getColumnX(canvasSpaceColumn, options);

  let actualCellWidth: number;
  if (modulationMarkers && modulationMarkers.length > 0) {
    // Tonic spans 2 columns: use canvas-space for both
    const nextX = getColumnX(canvasSpaceColumn + 1, options);
    actualCellWidth = nextX - x;
  } else {
    actualCellWidth = cellWidth;
  }

  const width = actualCellWidth * 2;
  const centerX = x + width / 2;
  const radius = (Math.min(width, cellHeight) / 2) * 0.9;

  if (radius < 2) {
    return;
  }

  ctx.beginPath();
  ctx.arc(centerX, y, radius, 0, 2 * Math.PI);
  ctx.strokeStyle = '#212529';
  ctx.lineWidth = Math.max(0.5, actualCellWidth * 0.05);
  ctx.stroke();

  if (tonicSign.tonicNumber == null) {
    return;
  }
  const numberText = tonicSign.tonicNumber.toString();
  const fontSize = radius * 1.5;
  if (fontSize < 6) {
    return;
  }

  ctx.fillStyle = '#212529';
  ctx.font = `bold ${fontSize}px 'Atkinson Hyperlegible', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(numberText, centerX, y);
}

interface NoteMarkerAnalysis {
  crossesMarkers: boolean;
  segments: ReturnType<typeof getCurrentCoordinateMapping>['segments'];
  noteStartX: number;
  noteEndX: number;
}

export function analyzeNoteCrossesMarkers(note: PlacedNote, options: PitchRendererOptions): NoteMarkerAnalysis {
  const noteStartX = getColumnX(note.startColumnIndex, options);
  const noteEndX = getColumnX(note.endColumnIndex + 1, options);
  const { modulationMarkers } = options;

  if (!modulationMarkers || modulationMarkers.length === 0) {
    return { crossesMarkers: false, segments: [], noteStartX, noteEndX };
  }

  const mapping = getCurrentCoordinateMapping(options);

  const affectedSegments = mapping.segments.filter(segment => (
    !(noteEndX <= segment.startX || noteStartX >= segment.endX)
  ));

  const crossesMarkers = affectedSegments.length > 1;

  return {
    crossesMarkers,
    segments: affectedSegments,
    noteStartX,
    noteEndX
  };
}
