// js/components/Toolbar/initializers/fileActionsInitializer.ts
import store from '@state/index.ts';
import logger from '@utils/logger.ts';
import type { PlacedNote } from '../../../../types/state.js';

interface FilePickerOptions {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}

function generateDateBasedFilename(): string {
  const now = new Date();
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const day = now.getDate();
  return `SN-score-${month}${day}.csv`;
}

async function saveWithPicker(blob: Blob): Promise<void> {
  try {
    const options: FilePickerOptions = {
      suggestedName: generateDateBasedFilename(),
      types: [{ description: 'Student Notation CSV File', accept: { 'text/csv': ['.csv'] } }]
    };
    const handle = await (window as any).showSaveFilePicker(options);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  } catch (err: any) {
    if (err.name !== 'AbortError') {logger.error('FileActionsInitializer', 'Error saving file with picker', err, 'toolbar');}
  }
}

function saveWithLegacyLink(blob: Blob): void {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', generateDateBasedFilename());
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getScoreAsCSV(): string {
  return store.state.placedNotes.map(note => {
    return [
      note.row, note.startColumnIndex, note.endColumnIndex,
      note.color, note.shape, note.tonicNumber || '',
      note.isDrum, note.drumTrack || ''
    ].join(',');
  }).join('\n');
}

export function initFileActions(): void {
  document.getElementById('save-as-button')?.addEventListener('click', () => void (async () => {
    const csvData = getScoreAsCSV();
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    if ((window as any).showSaveFilePicker) {await saveWithPicker(blob);}
    else {saveWithLegacyLink(blob);}
  })());

  document.getElementById('import-button')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt';
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) {return;}
      const reader = new FileReader();
      reader.onload = (readerEvent: ProgressEvent<FileReader>) => {
        const content = readerEvent.target?.result as string;
        if (!content) {
          logger.warn('FileActionsInitializer', 'Imported file was empty', null, 'toolbar');
          return;
        }

        const allowedShapes = new Set(['circle', 'oval', 'diamond']);
        const importedNotes: Partial<PlacedNote>[] = [];

        content.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .forEach(line => {
            const parts = line.split(',');
            if (parts.length < 7) {
              logger.warn('FileActionsInitializer', 'Skipping invalid note row', { line }, 'toolbar');
              return;
            }

            const row = Number.parseInt(parts[0] ?? '', 10);
            const startColumnIndex = Number.parseInt(parts[1] ?? '', 10);
            const endColumnIndex = Number.parseInt(parts[2] ?? '', 10);
            const color = (parts[3] ?? '').trim();
            const rawShape = (parts[4] ?? '').trim().toLowerCase();
            const tonicNumber = parts[5] ? Number.parseInt(parts[5], 10) : null;
            const isDrum = (parts[6] ?? '').trim().toLowerCase() === 'true';
            const drumTrackValue = parts[7] ? Number.parseInt(parts[7], 10) : null;
            const parsedDrumTrack = typeof drumTrackValue === 'number' && Number.isFinite(drumTrackValue)
              ? drumTrackValue
              : undefined;

            if (!color) {
              logger.warn('FileActionsInitializer', 'Skipping note with missing color', { line }, 'toolbar');
              return;
            }
            if (!Number.isFinite(row) || !Number.isFinite(startColumnIndex) || !Number.isFinite(endColumnIndex)) {
              logger.warn('FileActionsInitializer', 'Skipping note with invalid coordinates', { line }, 'toolbar');
              return;
            }

            const shape = allowedShapes.has(rawShape)
              ? (rawShape as 'circle' | 'oval' | 'diamond')
              : 'circle';

            if (!allowedShapes.has(rawShape)) {
              logger.warn('FileActionsInitializer', `Unknown shape "${rawShape}", defaulting to circle`, null, 'toolbar');
            }

            importedNotes.push({
              row,
              startColumnIndex,
              endColumnIndex,
              color,
              shape,
              tonicNumber,
              isDrum,
              drumTrack: parsedDrumTrack
            });
          });

        if (importedNotes.length === 0) {
          logger.warn('FileActionsInitializer', 'No valid notes found in imported file', null, 'toolbar');
          return;
        }

        store.loadNotes(importedNotes);
      };
      reader.readAsText(file);
    };
    input.click();
  });

  document.getElementById('print-button')?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open'); // Close sidebar
    store.emit('printPreviewStateChanged', true);
  });

  document.getElementById('reset-canvas-button')?.addEventListener('click', () => {
    if (window.confirm('Are you sure you want to reset the canvas? This will clear all your work and cannot be undone.')) {
      store.clearSavedState();
    }
  });
}
