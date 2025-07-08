// js/components/Toolbar/initializers/fileActionsInitializer.js
import store from '../../../state/index.js'; // <-- UPDATED PATH

function getScoreAsCSV() {
    return store.state.placedNotes.map(note => {
        return [
            note.row, note.startColumnIndex, note.endColumnIndex,
            note.color, note.shape, note.tonicNumber || '',
            note.isDrum, note.drumTrack || ''
        ].join(',');
    }).join('\n');
}

async function saveWithPicker(blob) {
    try {
        const options = {
            suggestedName: 'student-notation-score.csv',
            types: [{ description: 'Student Notation CSV File', accept: { 'text/csv': ['.csv'] } }],
        };
        const handle = await window.showSaveFilePicker(options);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
    } catch (err) {
        if (err.name !== 'AbortError') console.error('Error saving file with picker:', err);
    }
}

function saveWithLegacyLink(blob) {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "student-notation-export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function initFileActions() {
    document.getElementById('save-as-button').addEventListener('click', async () => {
        const csvData = getScoreAsCSV();
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
        if (window.showSaveFilePicker) await saveWithPicker(blob);
        else saveWithLegacyLink(blob);
    });

    document.getElementById('import-button').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.txt';
        input.onchange = e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = readerEvent => {
                const content = readerEvent.target.result;
                const importedNotes = content.split('\n').filter(line => line.trim()).map(line => {
                    const parts = line.split(',');
                    return {
                        row: parseInt(parts[0]), startColumnIndex: parseInt(parts[1]),
                        endColumnIndex: parseInt(parts[2]), color: parts[3],
                        shape: parts[4], tonicNumber: parts[5] ? parseInt(parts[5]) : null,
                        isDrum: parts[6] === 'true', drumTrack: parts[7] || null
                    };
                });
                store.loadNotes(importedNotes);
            }
            reader.readAsText(file);
        }
        input.click();
    });

    document.getElementById('print-button').addEventListener('click', () => {
        console.log('[FileActions] Print button clicked. Closing sidebar and emitting event.');
        document.body.classList.remove('sidebar-open');
        store.emit('printPreviewStateChanged', true);
    });

    document.getElementById('reset-canvas-button').addEventListener('click', () => {
        if (window.confirm('Are you sure you want to reset the canvas? This will clear all your work and cannot be undone.')) {
            // This action is defined in js/state/index.js
            // It clears the saved state from localStorage and reloads the page.
            store.clearSavedState();
        }
    });
}