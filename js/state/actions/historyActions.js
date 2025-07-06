// js/state/actions/historyActions.js

export const historyActions = {
    recordState() {
        this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);
        const newSnapshot = {
            notes: JSON.parse(JSON.stringify(this.state.placedNotes)),
            tonicSignGroups: JSON.parse(JSON.stringify(this.state.tonicSignGroups)),
            timbres: JSON.parse(JSON.stringify(this.state.timbres))
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
            this.state.timbres = JSON.parse(JSON.stringify(snapshot.timbres));
            this.emit('notesChanged');
            this.emit('rhythmStructureChanged');
            this.emit('timbreChanged', this.state.selectedTool.color); 
            this.emit('historyChanged');
        }
    },

    redo() {
        if (this.state.historyIndex < this.state.history.length - 1) {
            this.state.historyIndex++;
            const snapshot = this.state.history[this.state.historyIndex];
            this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
            this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
            this.state.timbres = JSON.parse(JSON.stringify(snapshot.timbres));
            this.emit('notesChanged');
            this.emit('rhythmStructureChanged');
            this.emit('timbreChanged', this.state.selectedTool.color);
            this.emit('historyChanged');
        }
    },
};