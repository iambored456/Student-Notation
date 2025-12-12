// State type definitions

import type { CanvasSpaceColumn } from '../js/utils/coordinateTypes';

// Re-export coordinate types for convenience
export type { CanvasSpaceColumn } from '../js/utils/coordinateTypes';

export interface PitchRowData {
  pitch: string;
  flatName: string;
  sharpName: string;
  toneNote: string;
  frequency: number;
  column: 'A' | 'B';
  hex: string;
  isAccidental: boolean;
}

export interface PlacedNote {
  uuid: string;
  row: number;
  /** Absolute row index in masterRowData; used to restore position after range changes. */
  globalRow?: number;
  /** Canvas-space column index (0 = first musical beat) */
  startColumnIndex: CanvasSpaceColumn;
  /** Canvas-space column index (0 = first musical beat) */
  endColumnIndex: CanvasSpaceColumn;
  shape: 'circle' | 'oval' | 'diamond';
  color: string;
  isDrum?: boolean;
  drumTrack?: number;
  enharmonicPreference?: boolean;
  tonicNumber?: number | null;
}

export type AnimatableNote = Pick<PlacedNote, 'color'> & Partial<Pick<PlacedNote, 'uuid'>>;

export interface PlacedChord {
  position: {
    xBeat: number;
    [key: string]: unknown;
  };
  notes: string[];
  [key: string]: unknown;
}

export interface TonicSign {
  /** Canvas-space column index (0 = first musical beat) */
  columnIndex: CanvasSpaceColumn;
  row: number;
  /** Absolute row index in master pitch data (preserved across pitch range changes) */
  globalRow?: number;
  tonicNumber: number;
  preMacrobeatIndex: number;
  uuid?: string;
  [key: string]: unknown;
}

export type TonicSignGroups = Record<string, TonicSign[]>;

export interface StampPlacement {
  id: string;
  stampId: number;
  /** Canvas-space column index (0 = first musical beat) */
  startColumn: CanvasSpaceColumn;
  /** Canvas-space column index (0 = first musical beat) */
  endColumn: CanvasSpaceColumn;
  row: number;
  /** Absolute row index in masterRowData; used to restore position after range changes. */
  globalRow?: number;
  color: string;
  timestamp: number;
  shapeOffsets?: Record<string, number>;
}

export interface TripletPlacement {
  id: string;
  stampId: number;
  startCellIndex: number;
  span: number;
  row: number;
  /** Absolute row index in masterRowData; used to restore position after range changes. */
  globalRow?: number;
  color: string;
  timestamp: number;
  shapeOffsets?: Record<string, number>;
}

export type Annotation = Record<string, unknown>;

export interface LassoSelection {
  selectedItems: {
    type: 'note' | 'stamp' | 'triplet';
    id: string;
    data: PlacedNote | StampPlacement | TripletPlacement;
  }[];
  convexHull: unknown | null;
  isActive: boolean;
}

export interface TimbreState {
  name: string;
  adsr: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  coeffs: Float32Array;
  phases: Float32Array;
  activePresetName: string | null;
  gain: number;
  filter: {
    enabled: boolean;
    blend: number;
    cutoff: number;
    resonance: number;
    type: string;
    mix: number;
  };
  vibrato: {
    speed: number;
    span: number;
  };
  tremelo: {
    speed: number;
    span: number;
  };
}

export interface TimbresState {
  timbres: Record<string, TimbreState>;
  [key: string]: unknown;
}

export type MacrobeatGrouping = 2 | 3;
export type MacrobeatBoundaryStyle = 'dashed' | 'solid' | 'anacrusis';
export type ModulationRatio = number;

export interface ModulationMarker {
  id: string;
  measureIndex: number;
  ratio: ModulationRatio;
  active: boolean;
  xPosition: number | null;
  /** Canvas-space column index (0 = first musical beat) */
  columnIndex: CanvasSpaceColumn | null;
  macrobeatIndex: number | null;
  xCanvas?: number;
}

export interface AnacrusisCache {
  groupings: MacrobeatGrouping[];
  boundaryStyles: MacrobeatBoundaryStyle[];
}

export interface PitchRange {
  topIndex: number;
  bottomIndex: number;
}

export interface DeviceProfile {
  isMobile: boolean;
  isTouch: boolean;
  isCoarsePointer: boolean;
  orientation: 'landscape' | 'portrait';
  width: number;
  height: number;
}

export interface AccidentalMode {
  sharp: boolean;
  flat: boolean;
}

export interface PrintOptions {
  includeButtonGrid: boolean;
  includeDrums: boolean;
  includeLeftLegend: boolean;
  includeRightLegend: boolean;
  orientation: 'landscape' | 'portrait';
  colorMode: 'color' | 'bw';
  cropTop: number;
  cropBottom: number;
  cropLeft: number;
  cropRight: number;
  topRow?: number;
  bottomRow?: number;
}

export interface HistoryEntry {
  notes: PlacedNote[];
  parkedNotes: PlacedNote[];
  tonicSignGroups: TonicSignGroups;
  timbres: TimbresState['timbres'];
  placedChords: PlacedChord[];
  stampPlacements: StampPlacement[];
  tripletPlacements: TripletPlacement[];
  annotations: Annotation[];
  lassoSelection: LassoSelection;
}

export interface AppState {
  // Data & History
  placedNotes: PlacedNote[];
  placedChords: PlacedChord[];
  tonicSignGroups: TonicSignGroups;
  stampPlacements: StampPlacement[];
  tripletPlacements: TripletPlacement[];
  annotations: Annotation[];
  lassoSelection: LassoSelection;
  history: HistoryEntry[];
  historyIndex: number;
  fullRowData: PitchRowData[];
  pitchRange: PitchRange;
  /** Notes that are outside the current pitch slice but preserved for later. */
  parkedNotes: PlacedNote[];

  // Rhythm
  macrobeatGroupings: MacrobeatGrouping[];
  macrobeatBoundaryStyles: MacrobeatBoundaryStyle[];
  hasAnacrusis: boolean;
  baseMicrobeatPx: number;
  modulationMarkers: ModulationMarker[];
  selectedModulationRatio: ModulationRatio | null;

  // Timbres & Colors
  timbres: TimbresState['timbres'];
  selectedTimbre?: string;
  colorPalette: Record<string, { primary: string; light: string }>;

  // UI & View State
  selectedTool: string;
  previousTool: string;
  selectedToolTonicNumber: number;
  selectedNote: {
    shape: 'circle' | 'oval' | 'diamond';
    color: string;
  };
  deviceProfile: DeviceProfile;
  activeChordId: string | null;
  activeChordIntervals: string[];
  isIntervalsInverted: boolean;
  chordPositionState: number;

  gridPosition: number;
  viewportRows: number;
  logicRows: number;
  cellWidth: number;
  cellHeight: number;
  /** Canvas-space: musical columns only (0 = first beat). Legend widths are constants (SIDE_COLUMN_WIDTH). */
  columnWidths: number[];
  degreeDisplayMode: 'off' | 'diatonic' | 'modal';
  accidentalMode: AccidentalMode;
  showFrequencyLabels: boolean;
  showOctaveLabels: boolean;
  focusColours: boolean;
  snapZoomToRange: boolean;
  isPitchRangeLocked: boolean;
  keySignature?: string;

  // Playback
  isPlaying: boolean;
  isPaused: boolean;
  isLooping: boolean;
  tempo: number;

  // Waveform
  waveformExtendedView: boolean;

  // ADSR
  adsrTimeAxisScale: number;

  // Print
  isPrintPreviewActive: boolean;
  printOptions: PrintOptions;
}

export interface Store {
  state: AppState;
  isColdStart?: boolean;
  _anacrusisCache?: AnacrusisCache | null;
  _isBoundaryInAnacrusis: (boundaryIndex: number) => boolean;
  on(eventName: string, callback: (data?: any) => void): void;
  emit(eventName: string, data?: any): void;

  // Note action methods
  addNote(note: Partial<PlacedNote>): PlacedNote | null;
  updateNoteTail(note: PlacedNote, newEndColumn: CanvasSpaceColumn): void;
  updateMultipleNoteTails(notes: PlacedNote[], newEndColumn: CanvasSpaceColumn): void;
  updateNoteRow(note: PlacedNote, newRow: number): void;
  updateMultipleNoteRows(notes: PlacedNote[], rowOffsets: number[]): void;
  removeNote(note: PlacedNote): void;
  removeMultipleNotes(notes: PlacedNote[]): void;
  clearAllNotes(): void;
  loadNotes(notes: Partial<PlacedNote>[]): void;

  // History action methods
  recordState(): void;
  undo(): void;
  redo(): void;
  clearSavedState(): void;

  // Playback action methods
  setPlaybackState(isPlaying: boolean, isPaused: boolean): void;
  setLooping(enabled: boolean): void;

  // Timbre/ADSR action methods
  setADSR(color: string, adsr: Partial<TimbreState['adsr']>): void;
  setAdsrTimeAxisScale(scale: number): void;
  setAdsrComponentWidth(widthPercent: number): void;

  // Rhythm action methods
  increaseMacrobeatCount(): void;
  decreaseMacrobeatCount(): void;
  updateTimeSignature(measureIndex: number, groupings: number[]): void;
  setAnacrusis(enabled: boolean): void;
  addModulationMarker(
    measureIndex: number,
    ratio: ModulationRatio,
    xPosition?: number | null,
    columnIndex?: number | null,
    macrobeatIndex?: number | null
  ): string | null;
  removeModulationMarker(markerId: string): void;
  setModulationRatio(markerId: string, ratio: ModulationRatio): void;
  clearModulationMarkers(): void;

  // Stamp/Triplet action methods
  addStampPlacement(stampId: number, startColumn: CanvasSpaceColumn, row: number, color?: string): StampPlacement;
  removeStampPlacement(placementId: string): boolean;
  eraseStampsInArea(eraseStartCol: CanvasSpaceColumn, eraseEndCol: CanvasSpaceColumn, eraseStartRow: number, eraseEndRow: number): boolean;
  getAllStampPlacements(): StampPlacement[];
  getStampAt(column: CanvasSpaceColumn, row: number): StampPlacement | null;
  clearAllStamps(): void;
  getStampPlaybackData(): unknown[];
  addTripletPlacement(placement: Omit<TripletPlacement, 'id'>): TripletPlacement;
  removeTripletPlacement(placementId: string): boolean;
  eraseTripletsInArea(eraseStartCol: number, eraseEndCol: number, eraseStartRow: number, eraseEndRow: number): boolean;
  getAllTripletPlacements(): TripletPlacement[];
  getTripletAt(cellIndex: number, row: number): TripletPlacement | null;
  clearAllTripletPlacements(): void;
  getTripletPlaybackData(): unknown[];

  // View action methods
  setSelectedTool(tool: string, tonicNumber?: string | number): void;
  setSelectedNote(shape: 'circle' | 'oval' | 'diamond', color: string): void;
  setTempo(tempo: number): void;
  applyPreset(color: string, preset: unknown): void;
  setDeviceProfile(profile: Partial<DeviceProfile>): void;
  setPitchRange(range: Partial<PitchRange>, options?: { trimOutsideRange?: boolean; preserveContent?: boolean; maintainGlobalStart?: number }): void;
  setLayoutConfig(config: { cellWidth?: number; cellHeight?: number; columnWidths?: number[] }): void;
  setSnapZoomToRange(enabled: boolean): void;
  setActiveChordIntervals(intervals: string[]): void;
  setIntervalsInversion(isInverted: boolean): void;
  setChordPosition(position: number): void;
  toggleAccidentalMode(mode: 'flat' | 'sharp'): void;
  toggleFrequencyLabels(): void;
  toggleOctaveLabels(): void;
  toggleFocusColours(): void;
  setDegreeDisplayMode(mode: 'off' | 'diatonic' | 'modal'): void;
  toggleWaveformExtendedView(): void;
  shiftGridUp(): void;
  shiftGridDown(): void;
  toggleMacrobeatGrouping(measureIndex: number): void;
  cycleMacrobeatBoundaryStyle(boundaryIndex: number): void;
  setFilterSettings(color: string, settings: Partial<TimbreState['filter']>): void;
  setPrintPreviewActive(isActive: boolean): void;
  setPrintOptions(options: Partial<PrintOptions>): void;

// Additional action methods will be added by other action modules
  [key: string]: unknown;
}

export interface AnimationEffectsManagerApi {
  updateAnimationState(): void;
  shouldTremoloBeRunning(): boolean;
  shouldVibratoBeRunning(): boolean;
  shouldEnvelopeFillBeRunning(): boolean;
  shouldAnimateNote(note: AnimatableNote): boolean;
  getVibratoYOffset(color?: string): number;
  getTremoloAmplitudeMultiplier(color: string): number;
  getADSRTremoloAmplitudeMultiplier(color: string): number;
  getFillLevel(note: AnimatableNote): number;
  shouldFillNote(note: AnimatableNote): boolean;
  triggerTremoloAmplitudeUpdate(): void;
  getAllActiveColors(): string[];
  dispose(): void;
}

// Window interface extensions for global objects
declare global {
  interface StaticWaveformVisualizer {
    currentColor: string | null;
    calculatedAmplitude?: number;
    initialize(): boolean;
    generateWaveform(): void;
    startPhaseTransition?(fromPhases: Float32Array, toPhases: Float32Array, changedBinIndex?: number): void;
    startSingleNoteVisualization(color: string): void;
    stopLiveVisualization(): void;
    startLiveVisualization(): void;
    getNormalizedAmplitude(): number;
    dispose(): void;
  }

  interface Window {
    staticWaveformVisualizer?: StaticWaveformVisualizer;
    effectsCoordinator?: {
      getEffectParameters(colorKey: string, effectType: string): {
        time?: number;
        feedback?: number;
        decay?: number;
        roomSize?: number;
      };
    };
    animationEffectsManager?: AnimationEffectsManagerApi;
    synthEngine?: any;
    initAudio?: () => Promise<void>;
    getModulationMapping?: () => {
      canvasXToMicrobeat: (x: number) => number;
      microbeatToCanvasX: (microbeat: number) => number;
    };
    LayoutService?: {
      recalculateLayout: () => void;
    };
    __transportTimeMap?: any[];
    __transportMusicalEnd?: string;
    Tone?: {
      now?: () => number;
      [key: string]: unknown;
    };
  }
}
