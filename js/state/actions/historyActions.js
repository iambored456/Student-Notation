// js/state/actions/historyActions.js

// Helper to safely restore timbres, ensuring coeffs are Float32Array
function restoreTimbres(timbresSnapshot) {
    const newTimbres = JSON.parse(JSON.stringify(timbresSnapshot)); // Deep clone
    for (const color in newTimbres) {
        const timbre = newTimbres[color];
        if (timbre.coeffs && typeof timbre.coeffs === 'object' && !Array.isArray(timbre.coeffs)) {
            timbre.coeffs = new Float32Array(Object.values(timbre.coeffs));
        } else if (Array.isArray(timbre.coeffs)) {
            timbre.coeffs = new Float32Array(timbre.coeffs);
        }
    }
    return newTimbres;
}

export const historyActions = {
    recordState() {
        this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        
        // Create a snapshot that is safe for JSON stringify/parse
        const timbresForHistory = JSON.parse(JSON.stringify(this.state.timbres));

        const newSnapshot = {
            notes: JSON.parse(JSON.stringify(this.state.placedNotes)),
            tonicSignGroups: JSON.parse(JSON.stringify(this.state.tonicSignGroups)),
            timbres: timbresForHistory // Already cloned safely
        };
        this.state.history.push(newSnapshot);
        this.state.historyIndex++;
        this.emit('historyChanged');
    },

    undo() {
        if (this.state.historyIndex > 0) {
            this.state.historyIndex--;
            const snapshot = this.state.history[this.state.historyIndex];
            this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
            this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
            this.state.timbres = restoreTimbres(snapshot.timbres); // Use safe restore function
            this.emit('notesChanged');
            this.emit('rhythmStructureChanged');
            this.emit('timbreChanged', this.state.selectedNote.color); 
            this.emit('historyChanged');
        }
    },

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            const snapshot = this.state.history[this.state.historyIndex];
            this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
            this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
            this.state.timbres = restoreTimbres(snapshot.timbres); // Use safe restore function
            this.emit('notesChanged');
            this.emit('rhythmStructureChanged');
            this.emit('timbreChanged', this.state.selectedNote.color);
            this.emit('historyChanged');
        }
    },
};