// js/components/Canvas/PitchGrid/renderers/annotationRenderer.ts
import store from '@state/index.ts';
import annotationService from '../../../../services/annotationService.ts';
import { getColumnX, getRowY } from './rendererUtils.js';
import type { ModulationMarker } from '../../../../../types/state.js';

interface AnnotationOptions {
  cellWidth: number;
  cellHeight: number;
  columnWidths: number[];
  baseMicrobeatPx?: number;
  modulationMarkers?: ModulationMarker[];
}

interface Point { x: number; y: number }
interface GridPoint { col: number; row: number }

type AnnotationType = 'arrow' | 'text' | 'marker' | 'highlighter' | 'lasso';

interface BaseAnnotation {
  type: AnnotationType;
  color?: string;
}

type ArrowheadStyle = 'filled' | 'filled-arrow' | 'unfilled' | 'unfilled-arrow' | 'circle' | 'none' | string;

interface ArrowSettings {
  strokeWeight: number;
  lineStyle: 'solid' | 'dashed-big' | 'dashed-small' | 'dotted';
  arrowheadSize?: number;
  startArrowhead?: ArrowheadStyle;
  endArrowhead?: ArrowheadStyle;
}

interface ArrowAnnotation extends BaseAnnotation {
  type: 'arrow';
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
  settings: ArrowSettings;
}

interface TextSettings {
  size: number;
  background?: boolean;
  color: string;
  italic?: boolean;
  bold?: boolean;
  superscript?: boolean;
  subscript?: boolean;
  underline?: boolean;
}

interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  col: number;
  row: number;
  widthCols: number;
  heightRows: number;
  text: string;
  settings: TextSettings;
}

interface TextPreviewAnnotation {
  type: 'text';
  startCol: number;
  startRow: number;
  endCol: number;
  endRow: number;
}

type PathSize = number | 'small' | 'medium' | 'large';

interface PathSettings {
  color: string;
  size: PathSize;
}

interface PathAnnotation extends BaseAnnotation {
  type: 'marker' | 'highlighter';
  path: GridPoint[];
  settings: PathSettings;
}

interface LassoAnnotation extends BaseAnnotation {
  type: 'lasso';
  path: Point[];
}

interface UnknownAnnotation { type?: string }

type AnyAnnotation = ArrowAnnotation | TextAnnotation | PathAnnotation | LassoAnnotation | UnknownAnnotation;
type TempAnnotation = AnyAnnotation | TextPreviewAnnotation;

function isArrowAnnotation(annotation: TempAnnotation | null | undefined): annotation is ArrowAnnotation {
  if (annotation?.type !== 'arrow') {return false;}
  const candidate = annotation as Partial<ArrowAnnotation>;
  const settings = candidate.settings;
  return typeof candidate.startCol === 'number' &&
    typeof candidate.startRow === 'number' &&
    typeof candidate.endCol === 'number' &&
    typeof candidate.endRow === 'number' &&
    !!settings &&
    typeof settings.strokeWeight === 'number' &&
    typeof settings.lineStyle === 'string';
}

function isTextAnnotation(annotation: TempAnnotation | null | undefined): annotation is TextAnnotation {
  if (annotation?.type !== 'text') {return false;}
  const candidate = annotation as Partial<TextAnnotation>;
  const settings = candidate.settings;
  return typeof candidate.col === 'number' &&
    typeof candidate.row === 'number' &&
    typeof candidate.widthCols === 'number' &&
    typeof candidate.heightRows === 'number' &&
    typeof candidate.text === 'string' &&
    !!settings &&
    typeof settings.size === 'number' &&
    typeof settings.color === 'string';
}

function isTextPreviewAnnotation(annotation: TempAnnotation | null | undefined): annotation is TextPreviewAnnotation {
  if (annotation?.type !== 'text') {return false;}
  const preview = annotation as Partial<TextPreviewAnnotation>;
  const hasFinalCols = typeof (annotation as Partial<TextAnnotation>).col === 'number';
  return typeof preview.startCol === 'number' &&
    typeof preview.startRow === 'number' &&
    typeof preview.endCol === 'number' &&
    typeof preview.endRow === 'number' &&
    !hasFinalCols;
}

function isPathAnnotation(annotation: TempAnnotation | null | undefined): annotation is PathAnnotation {
  if (!annotation || (annotation.type !== 'marker' && annotation.type !== 'highlighter')) {return false;}
  const candidate = annotation as Partial<PathAnnotation>;
  const settings = candidate.settings;
  return Array.isArray(candidate.path) &&
    !!settings &&
    typeof settings.color === 'string' &&
    (typeof settings.size === 'number' ||
      settings.size === 'small' || settings.size === 'medium' || settings.size === 'large');
}

function isLassoAnnotation(annotation: TempAnnotation | null | undefined): annotation is LassoAnnotation {
  return annotation?.type === 'lasso' && Array.isArray((annotation as LassoAnnotation).path);
}

/**
 * Renders annotations on the pitch grid
 * Annotations are stored in grid coordinates (row, col) and converted to canvas pixels
 */
export function renderAnnotations(ctx: CanvasRenderingContext2D, options: AnnotationOptions): void {
  // Get annotations from store
  const annotations = store.state.annotations as AnyAnnotation[];
  const tempAnnotation = (annotationService as any).tempAnnotation as TempAnnotation | null;

  // Get selected and hover annotations from service
  const selectedAnnotation = (annotationService as any).selectedAnnotation as AnyAnnotation | null;
  const hoverAnnotation = (annotationService as any).hoverAnnotation as AnyAnnotation | null;

  // Render saved annotations
  if (annotations && annotations.length > 0) {
    annotations.forEach(annotation => {
      const isSelected = annotation === selectedAnnotation;
      const isHovered = annotation === hoverAnnotation;
      const type = annotation.type;

      switch (type) {
        case 'arrow':
          if (isArrowAnnotation(annotation)) {
            drawArrow(ctx, annotation, isSelected, isHovered, options);
          }
          break;
        case 'text':
          if (isTextAnnotation(annotation)) {
            drawText(ctx, annotation, isSelected, isHovered, options);
          }
          break;
        case 'marker':
        case 'highlighter':
          if (isPathAnnotation(annotation)) {
            drawPath(ctx, annotation, options);
          }
          break;
      }
    });
  }

  // Draw temp annotation if any (for preview while drawing)
  if (tempAnnotation) {
    switch (tempAnnotation.type) {
      case 'arrow':
        if (isArrowAnnotation(tempAnnotation)) {
          drawArrow(ctx, tempAnnotation, false, false, options);
        }
        break;
      case 'text':
        if (isTextPreviewAnnotation(tempAnnotation)) {
          drawTextBoxPreview(ctx, tempAnnotation, options);
        } else if (isTextAnnotation(tempAnnotation)) {
          drawText(ctx, tempAnnotation, false, false, options);
        }
        break;
      case 'marker':
      case 'highlighter':
        if (isPathAnnotation(tempAnnotation)) {
          drawPath(ctx, tempAnnotation, options);
        }
        break;
      case 'lasso':
        if (isLassoAnnotation(tempAnnotation)) {
          drawLassoPath(ctx, tempAnnotation);
        }
        break;
    }
  }

  // Draw lasso selection convex hull if active
  const lassoSelection = store.state.lassoSelection;
  if (lassoSelection?.isActive && Array.isArray(lassoSelection.convexHull)) {
    // Update convex hull position before rendering (handles scrolling/viewport changes)
    annotationService.updateLassoConvexHull();
    drawConvexHull(ctx, lassoSelection.convexHull as Point[]);
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, annotation: ArrowAnnotation, isSelected = false, isHovered = false, options: AnnotationOptions): void {
  const { startCol, startRow, endCol, endRow, settings } = annotation;

  // Convert grid coordinates to canvas pixels
  const startX = getColumnX(startCol, options);
  const startY = getRowY(startRow, options);
  const endX = getColumnX(endCol, options);
  const endY = getRowY(endRow, options);

  ctx.save();
  ctx.strokeStyle = annotation.color || '#000000';
  ctx.lineWidth = getSizeValue(settings.strokeWeight);
  ctx.setLineDash(getLineDash(settings.lineStyle));

  // Calculate angle and arrowhead size
  const angle = Math.atan2(endY - startY, endX - startX);
  const arrowheadSize = settings.arrowheadSize || 12;

  // Calculate adjusted endpoints to stop at arrowhead base
  let adjustedStartX = startX;
  let adjustedStartY = startY;
  let adjustedEndX = endX;
  let adjustedEndY = endY;

  if (settings.startArrowhead && settings.startArrowhead !== 'none') {
    adjustedStartX = startX + Math.cos(angle) * arrowheadSize;
    adjustedStartY = startY + Math.sin(angle) * arrowheadSize;
  }

  if (settings.endArrowhead && settings.endArrowhead !== 'none') {
    adjustedEndX = endX - Math.cos(angle) * arrowheadSize;
    adjustedEndY = endY - Math.sin(angle) * arrowheadSize;
  }

  // Draw line
  ctx.beginPath();
  ctx.moveTo(adjustedStartX, adjustedStartY);
  ctx.lineTo(adjustedEndX, adjustedEndY);
  ctx.stroke();

  // Reset line dash for arrowheads
  ctx.setLineDash([]);

  // Draw arrowheads
  if (settings.startArrowhead && settings.startArrowhead !== 'none') {
    drawArrowhead(ctx, startX, startY, angle + Math.PI, settings.startArrowhead, arrowheadSize);
  }

  if (settings.endArrowhead && settings.endArrowhead !== 'none') {
    drawArrowhead(ctx, endX, endY, angle, settings.endArrowhead, arrowheadSize);
  }

  // Draw selection/hover highlight
  if (isSelected || isHovered) {
    ctx.strokeStyle = isSelected ? 'rgba(74, 144, 226, 0.6)' : 'rgba(74, 144, 226, 0.3)';
    ctx.lineWidth = getSizeValue(settings.strokeWeight) + 4;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawArrowhead(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, type: ArrowheadStyle, size: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  switch (type) {
    case 'filled':
    case 'filled-arrow':
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size / 2);
      ctx.lineTo(-size, size / 2);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      break;
    case 'unfilled':
    case 'unfilled-arrow':
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-size, -size / 2);
      ctx.lineTo(-size, size / 2);
      ctx.closePath();
      ctx.stroke();
      break;
    case 'circle':
      ctx.beginPath();
      ctx.arc(0, 0, size / 3, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      break;
  }

  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, annotation: TextAnnotation, isSelected = false, isHovered = false, options: AnnotationOptions): void {
  const { col, row, text, widthCols, heightRows, settings } = annotation;

  // Convert grid coordinates to canvas pixels
  const x = getColumnX(col, options);
  const y = getRowY(row, options);
  const width = getColumnX(col + (typeof widthCols === 'number' ? widthCols : 2), options) - x;
  const height = getRowY(row + (typeof heightRows === 'number' ? heightRows : 1), options) - y;

  ctx.save();

  // Get the actual font family from CSS variable
  const computedStyle = window.getComputedStyle(document.documentElement);
  const mainFont = computedStyle.getPropertyValue('--main-font').trim() || '"Atkinson Hyperlegible", Arial, sans-serif';

  const fontSize = settings.size;
  const lineHeight = fontSize * 1.2;

  // Match the padding from the text input (4px top/bottom, 8px left/right)
  const paddingHorizontal = settings.background ? 8 : 4;
  const paddingVertical = 4;
  const availableWidth = width - (paddingHorizontal * 2);
  const lines = wrapText(ctx, text, availableWidth, fontSize, settings, mainFont);

  // Draw background if enabled
  if (settings.background) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
  }

  // Show hover highlight
  if (isHovered && !isSelected) {
    ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
    ctx.fillRect(x, y, width, height);
  }

  // Show selection highlight
  if (isSelected) {
    ctx.fillStyle = 'rgba(74, 144, 226, 0.2)';
    ctx.fillRect(x, y, width, height);
  }

  // Draw text with formatting support, offset by padding
  ctx.fillStyle = settings.color;

  lines.forEach((line, i) => {
    const lineY = y + paddingVertical + i * lineHeight;
    drawTextWithFormatting(ctx, line, x + paddingHorizontal, lineY, fontSize, settings, mainFont);
  });

  // Draw resize handles if selected
  if (isSelected) {
    drawResizeHandles(ctx, x, y, width, height);
  }

  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  fontSize: number,
  settings: TextSettings,
  fontFamily: string
): string[] {
  ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;

  const paragraphs = text.split('\n');
  const wrappedLines: string[] = [];

  paragraphs.forEach(paragraph => {
    if (!paragraph.trim()) {
      wrappedLines.push('');
      return;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    words.forEach((word) => {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        wrappedLines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  });

  return wrappedLines;
}

function drawTextWithFormatting(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  settings: TextSettings,
  fontFamily: string
): void {
  // If entire text is superscript or subscript from toolbar settings
  if (settings.superscript || settings.subscript) {
    ctx.save();
    const smallerSize = fontSize * 0.6;
    const offset = settings.superscript ? -fontSize * 0.4 : fontSize * 0.3;
    ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${smallerSize}px ${fontFamily}`;
    ctx.fillText(text, x, y + offset);

    if (settings.underline) {
      const metrics = ctx.measureText(text);
      ctx.beginPath();
      ctx.strokeStyle = settings.color;
      ctx.lineWidth = 1;
      ctx.moveTo(x, y + offset + smallerSize * 1.2 - 2);
      ctx.lineTo(x + metrics.width, y + offset + smallerSize * 1.2 - 2);
      ctx.stroke();
    }

    ctx.restore();
    return;
  }

  // Parse text for formatting markers
  const segments = parseFormattedText(text);
  let currentX = x;

  segments.forEach(segment => {
    ctx.save();

    if (segment.format === 'superscript') {
      const superSize = fontSize * 0.6;
      const superOffset = -fontSize * 0.4;
      ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${superSize}px ${fontFamily}`;
      ctx.fillText(segment.text, currentX, y + superOffset);
      currentX += ctx.measureText(segment.text).width;
    } else if (segment.format === 'subscript') {
      const subSize = fontSize * 0.6;
      const subOffset = fontSize * 0.3;
      ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${subSize}px ${fontFamily}`;
      ctx.fillText(segment.text, currentX, y + subOffset);
      currentX += ctx.measureText(segment.text).width;
    } else {
      ctx.font = `${settings.italic ? 'italic ' : ''}${settings.bold ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
      ctx.fillText(segment.text, currentX, y);

      if (settings.underline) {
        const metrics = ctx.measureText(segment.text);
        ctx.beginPath();
        ctx.strokeStyle = settings.color;
        ctx.lineWidth = 1;
        ctx.moveTo(currentX, y + fontSize * 1.2 - 2);
        ctx.lineTo(currentX + metrics.width, y + fontSize * 1.2 - 2);
        ctx.stroke();
      }

      currentX += ctx.measureText(segment.text).width;
    }

    ctx.restore();
  });
}

interface TextSegment { text: string; format: 'normal' | 'superscript' | 'subscript' }

function parseFormattedText(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  let currentSegment = '';
  let inCaretSuperscript = false;

  while (i < text.length) {
    // Check for <sup> tag
    if (text.substr(i, 5) === '<sup>') {
      if (currentSegment) {
        segments.push({ text: currentSegment, format: 'normal' });
        currentSegment = '';
      }
      const closeIndex = text.indexOf('</sup>', i);
      if (closeIndex !== -1) {
        const supText = text.substring(i + 5, closeIndex);
        segments.push({ text: supText, format: 'superscript' });
        i = closeIndex + 6;
        continue;
      }
    }

    // Check for <sub> tag
    if (text.substr(i, 5) === '<sub>') {
      if (currentSegment) {
        segments.push({ text: currentSegment, format: 'normal' });
        currentSegment = '';
      }
      const closeIndex = text.indexOf('</sub>', i);
      if (closeIndex !== -1) {
        const subText = text.substring(i + 5, closeIndex);
        segments.push({ text: subText, format: 'subscript' });
        i = closeIndex + 6;
        continue;
      }
    }

    // Check for ^ character
    if (text[i] === '^' && !inCaretSuperscript) {
      if (currentSegment) {
        segments.push({ text: currentSegment, format: 'normal' });
        currentSegment = '';
      }
      inCaretSuperscript = true;
      i++;
      continue;
    }

    // Space ends caret superscript
    if (inCaretSuperscript && text[i] === ' ') {
      if (currentSegment) {
        segments.push({ text: currentSegment, format: 'superscript' });
        currentSegment = '';
      }
      inCaretSuperscript = false;
      segments.push({ text: ' ', format: 'normal' });
      i++;
      continue;
    }

    currentSegment += text[i];
    i++;
  }

  if (currentSegment) {
    segments.push({
      text: currentSegment,
      format: inCaretSuperscript ? 'superscript' : 'normal'
    });
  }

  return segments;
}

function drawResizeHandles(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  const handleSize = 8;
  const handles = [
    { x: x, y: y },
    { x: x + width / 2, y: y },
    { x: x + width, y: y },
    { x: x + width, y: y + height / 2 },
    { x: x + width, y: y + height },
    { x: x + width / 2, y: y + height },
    { x: x, y: y + height },
    { x: x, y: y + height / 2 }
  ];

  ctx.save();
  handles.forEach(handle => {
    ctx.fillStyle = '#4a90e2';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.fillRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(handle.x - handleSize / 2, handle.y - handleSize / 2, handleSize, handleSize);
  });
  ctx.restore();
}

function drawTextBoxPreview(ctx: CanvasRenderingContext2D, annotation: TextPreviewAnnotation, options: AnnotationOptions): void {
  const { startCol, startRow, endCol, endRow } = annotation;

  // Convert grid coordinates to canvas pixels
  const startX = getColumnX(startCol, options);
  const startY = getRowY(startRow, options);
  const endX = getColumnX(endCol, options);
  const endY = getRowY(endRow, options);

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  ctx.save();
  ctx.strokeStyle = 'rgba(74, 144, 226, 0.6)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function drawPath(ctx: CanvasRenderingContext2D, annotation: PathAnnotation, options: AnnotationOptions): void {
  const { path, settings, type } = annotation;
  if (!path || path.length < 2) {return;}

  // Convert grid coordinates to canvas pixels
  const canvasPath = path.map((point: GridPoint) => ({
    x: getColumnX(point.col, options),
    y: getRowY(point.row, options)
  }));

  ctx.save();

  if (type === 'highlighter') {
    ctx.globalAlpha = 0.3;
  }

  ctx.strokeStyle = settings.color;
  ctx.lineWidth = typeof settings.size === 'number' ? settings.size : getSizeValue(settings.size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  const firstPoint = canvasPath[0];
  if (!firstPoint) {
    ctx.restore();
    return;
  }
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let i = 1; i < canvasPath.length; i++) {
    const point = canvasPath[i];
    if (!point) {continue;}
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
  ctx.restore();
}

function getSizeValue(size: PathSize | undefined): number {
  if (typeof size === 'number') {return size;}

  switch (size) {
    case 'small': return 2;
    case 'medium': return 4;
    case 'large': return 6;
    default: return 4;
  }
}

function getLineDash(style: string | undefined): number[] {
  switch (style) {
    case 'solid': return [];
    case 'dashed-big': return [10, 5];
    case 'dashed-small': return [5, 3];
    case 'dotted': return [2, 3];
    default: return [];
  }
}

/**
 * Draw temporary lasso path while user is drawing
 */
function drawLassoPath(ctx: CanvasRenderingContext2D, annotation: LassoAnnotation): void {
  const path = annotation.path;
  if (!path || path.length < 2) {return;}
  const firstPoint = path[0];
  if (!firstPoint) {return;}

  ctx.save();
  ctx.strokeStyle = '#4a90e2';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha = 0.7;

  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let i = 1; i < path.length; i++) {
    const point = path[i];
    if (!point) {continue;}
    ctx.lineTo(point.x, point.y);
  }

  // Close the path visually for preview
  if (path.length > 2) {
    ctx.lineTo(firstPoint.x, firstPoint.y);
  }

  ctx.stroke();
  ctx.restore();
}

/**
 * Draw the convex hull around selected items (dashed border)
 */
function drawConvexHull(ctx: CanvasRenderingContext2D, hull: Point[]): void {
  if (!hull || hull.length < 3) {return;}
  const firstPoint = hull[0];
  if (!firstPoint) {return;}

  ctx.save();
  ctx.strokeStyle = '#4a90e2';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.globalAlpha = 0.8;

  ctx.beginPath();
  ctx.moveTo(firstPoint.x, firstPoint.y);

  for (let i = 1; i < hull.length; i++) {
    const point = hull[i];
    if (!point) {continue;}
    ctx.lineTo(point.x, point.y);
  }

  // Close the hull
  ctx.closePath();
  ctx.stroke();

  // Draw a semi-transparent fill
  ctx.fillStyle = 'rgba(74, 144, 226, 0.1)';
  ctx.fill();

  ctx.restore();
}
