// js/state/actions/historyActions.ts
import type { Store, TimbreState } from '../../../types/state.js';

// Helper to safely restore timbres, ensuring coeffs are Float32Array
function restoreTimbres(timbresSnapshot: Record<string, TimbreState>): Record<string, TimbreState> {
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
  recordState(this: Store): void {
    this.state.history = this.state.history.slice(0, this.state.historyIndex + 1);

    // Create a snapshot that is safe for JSON stringify/parse
    const timbresForHistory = JSON.parse(JSON.stringify(this.state.timbres));

    const newSnapshot = {
      notes: JSON.parse(JSON.stringify(this.state.placedNotes)),
      parkedNotes: JSON.parse(JSON.stringify(this.state.parkedNotes || [])),
      tonicSignGroups: JSON.parse(JSON.stringify(this.state.tonicSignGroups)),
      placedChords: JSON.parse(JSON.stringify(this.state.placedChords)),
      stampPlacements: JSON.parse(JSON.stringify(this.state.stampPlacements)),
      tripletPlacements: JSON.parse(JSON.stringify(this.state.tripletPlacements || [])),
      timbres: timbresForHistory, // Already cloned safely
      annotations: this.state.annotations ? JSON.parse(JSON.stringify(this.state.annotations)) : [],
      lassoSelection: JSON.parse(JSON.stringify(this.state.lassoSelection))
    };
    this.state.history.push(newSnapshot);
    this.state.historyIndex++;
    this.emit('historyChanged');
  },

  undo(this: Store): void {
    if (this.state.historyIndex > 0) {
      this.state.historyIndex--;
      const snapshot = this.state.history[this.state.historyIndex];
      if (!snapshot) {return;}
      this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
      this.state.parkedNotes = JSON.parse(JSON.stringify(snapshot.parkedNotes || []));
      this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
      this.state.stampPlacements = JSON.parse(JSON.stringify(snapshot.stampPlacements || []));
      this.state.tripletPlacements = JSON.parse(JSON.stringify(snapshot.tripletPlacements || []));
      this.state.timbres = restoreTimbres(snapshot.timbres); // Use safe restore function
      this.state.annotations = snapshot.annotations ? JSON.parse(JSON.stringify(snapshot.annotations)) : [];
      this.emit('notesChanged');
      this.emit('stampPlacementsChanged');
      this.emit('tripletPlacementsChanged');
      this.emit('rhythmStructureChanged');
      if (this.state.selectedNote?.color) {
        this.emit('timbreChanged', this.state.selectedNote.color);
      }
      this.emit('annotationsChanged');
      this.emit('historyChanged');
    }
  },

  redo(this: Store): void {
    if (this.state.historyIndex < this.state.history.length - 1) {
      this.state.historyIndex++;
      const snapshot = this.state.history[this.state.historyIndex];
      if (!snapshot) {return;}
      this.state.placedNotes = JSON.parse(JSON.stringify(snapshot.notes));
      this.state.parkedNotes = JSON.parse(JSON.stringify(snapshot.parkedNotes || []));
      this.state.tonicSignGroups = JSON.parse(JSON.stringify(snapshot.tonicSignGroups));
      this.state.stampPlacements = JSON.parse(JSON.stringify(snapshot.stampPlacements || []));
      this.state.tripletPlacements = JSON.parse(JSON.stringify(snapshot.tripletPlacements || []));
      this.state.timbres = restoreTimbres(snapshot.timbres); // Use safe restore function
      this.state.annotations = snapshot.annotations ? JSON.parse(JSON.stringify(snapshot.annotations)) : [];
      this.emit('notesChanged');
      this.emit('stampPlacementsChanged');
      this.emit('tripletPlacementsChanged');
      this.emit('rhythmStructureChanged');
      if (this.state.selectedNote?.color) {
        this.emit('timbreChanged', this.state.selectedNote.color);
      }
      this.emit('annotationsChanged');
      this.emit('historyChanged');
    }
  }
};
