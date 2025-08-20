# Student Notation Modular Library Architecture Plan

## Overview

This document outlines the strategic plan for transforming Student Notation into a modular, reusable library while maintaining its current functionality and performance characteristics.

## Current Architecture Issues

### Tight Coupling Problems
1. **Direct Store Dependencies**: Components directly import and access global store
2. **Service Singletons**: LayoutService, CanvasContextService are tightly coupled singletons
3. **DOM Assumptions**: Hard-coded DOM element IDs throughout the codebase
4. **Mixed Concerns**: Business logic mixed with rendering and interaction code
5. **Global State Mutations**: Direct state access bypasses encapsulation

### Dependency Web Analysis
```
PitchGrid Component Dependencies:
├── store (global state)
├── CanvasContextService (singleton)  
├── LayoutService (singleton)
├── GridCoordsService (singleton)
├── SynthEngine (audio singleton)
├── domCache (DOM singleton)
├── Multiple renderers (each with their own deps)
└── Event system (global)
```

## Proposed Modular Architecture

### 1. Core Abstraction Layers

#### A. Musical Data Layer
```typescript
interface MusicalData {
  pitchData: PitchRow[];
  placedNotes: Note[];
  placedTonicSigns: TonicSign[];
  columnWidths: number[];
  modulationMarkers?: ModulationMarker[];
}

interface PitchRow {
  toneNote: string;
  pitchClass: string;
  octave: number;
  // ... other properties
}
```

#### B. Viewport Management Layer
```typescript
interface ViewportManager {
  // Pure functions, no side effects
  calculateViewportInfo(
    totalRows: number,
    zoomLevel: number,
    scrollPosition: number,
    viewportHeight: number
  ): ViewportInfo;
  
  getVisibleRange(viewportInfo: ViewportInfo): VisibleRange;
  getRowY(rowIndex: number, viewportInfo: ViewportInfo): number;
  getColumnX(columnIndex: number, config: GridConfig): number;
}
```

#### C. Coordinate System Layer
```typescript
interface CoordinateSystem {
  // Musical time to pixel space
  musicalToPixel(musicalCoords: MusicalCoords): PixelCoords;
  pixelToMusical(pixelCoords: PixelCoords): MusicalCoords;
  
  // Handle modulation/tempo changes
  applyModulation(coords: PixelCoords, modulation: ModulationMapping): PixelCoords;
}
```

#### D. Rendering Engine Layer
```typescript
interface RenderingEngine {
  // Plugin-based rendering system
  registerRenderer(layerName: string, renderer: LayerRenderer): void;
  render(context: RenderContext, data: MusicalData, viewport: ViewportInfo): void;
  
  // Layer management
  setLayerOrder(layers: string[]): void;
  enableLayer(layerName: string): void;
  disableLayer(layerName: string): void;
}

interface LayerRenderer {
  render(context: RenderContext, options: RenderOptions): void;
  shouldRender(viewport: ViewportInfo): boolean;
  getZIndex(): number;
}
```

#### E. Interaction System Layer
```typescript
interface InteractionSystem {
  // Tool-based interaction system
  registerTool(toolName: string, tool: InteractionTool): void;
  setActiveTool(toolName: string): void;
  
  // Event handling
  handleMouseEvent(event: MouseEvent, coords: MusicalCoords): void;
  handleKeyboardEvent(event: KeyboardEvent): void;
}

interface InteractionTool {
  onMouseDown(coords: MusicalCoords, data: MusicalData): void;
  onMouseMove(coords: MusicalCoords, data: MusicalData): void;
  onMouseUp(coords: MusicalCoords, data: MusicalData): void;
  getCursor(coords: MusicalCoords): string;
}
```

### 2. Dependency Injection Architecture

#### Core Container
```typescript
interface StudentNotationDependencies {
  // Required dependencies
  stateManager: StateManager;
  canvasProvider: CanvasProvider;
  eventBus: EventBus;
  
  // Optional dependencies with defaults
  audioEngine?: AudioEngine;
  storageProvider?: StorageProvider;
  themeProvider?: ThemeProvider;
}

class StudentNotationEngine {
  constructor(
    container: HTMLElement,
    dependencies: StudentNotationDependencies
  ) {
    this.viewport = new ViewportManager();
    this.coordinates = new CoordinateSystem();
    this.renderer = new RenderingEngine(dependencies.canvasProvider);
    this.interactions = new InteractionSystem();
    this.eventBus = dependencies.eventBus;
    
    this.setupEventHandlers();
    this.registerDefaultRenderers();
    this.registerDefaultTools();
  }
}
```

#### State Management Abstraction
```typescript
interface StateManager {
  // Pure state access
  getState(): MusicalData;
  setState(data: Partial<MusicalData>): void;
  
  // Event subscription
  subscribe(eventName: string, handler: Function): () => void;
  emit(eventName: string, data: any): void;
}

// Implementation adapter for existing store
class StoreAdapter implements StateManager {
  constructor(private store: any) {}
  
  getState(): MusicalData {
    return {
      pitchData: this.store.state.fullRowData,
      placedNotes: this.store.state.notes,
      // ... map other properties
    };
  }
  
  setState(data: Partial<MusicalData>): void {
    // Call appropriate store actions
    if (data.placedNotes) {
      this.store.setNotes(data.placedNotes);
    }
    // ... handle other properties
  }
}
```

### 3. Plugin Architecture

#### Renderer Plugins
```typescript
// Grid Lines Plugin
class GridLinesRenderer implements LayerRenderer {
  getZIndex(): number { return 1; }
  
  shouldRender(viewport: ViewportInfo): boolean { 
    return viewport.zoomLevel > 0.1; 
  }
  
  render(context: RenderContext, options: RenderOptions): void {
    // Draw horizontal and vertical grid lines
    this.drawHorizontalLines(context, options);
    this.drawVerticalLines(context, options);
  }
}

// Notes Plugin
class NotesRenderer implements LayerRenderer {
  getZIndex(): number { return 5; }
  
  render(context: RenderContext, options: RenderOptions): void {
    const visibleNotes = this.cullNotes(options.data.placedNotes, options.viewport);
    visibleNotes.forEach(note => this.drawNote(context, note, options));
  }
}
```

#### Tool Plugins
```typescript
// Note Tool Plugin
class NoteTool implements InteractionTool {
  constructor(private stateManager: StateManager) {}
  
  onMouseDown(coords: MusicalCoords, data: MusicalData): void {
    const note = this.createNote(coords);
    const updatedNotes = [...data.placedNotes, note];
    this.stateManager.setState({ placedNotes: updatedNotes });
  }
  
  getCursor(): string { return 'crosshair'; }
}
```

### 4. API Design

#### Public API
```typescript
// Consumer-facing API
const notation = new StudentNotation(containerElement, {
  // Required configuration
  data: {
    pitchData: pitchRowsData,
    initialNotes: existingNotes
  },
  
  // Optional configuration with defaults
  viewport: {
    initialZoom: 1.0,
    zoomLimits: { min: 0.1, max: 5.0 },
    scrollBehavior: 'smooth'
  },
  
  interaction: {
    tools: ['note', 'eraser', 'chord'],
    defaultTool: 'note',
    enableAudio: true
  },
  
  rendering: {
    theme: 'default',
    layers: ['gridLines', 'notes', 'stamps'],
    performance: { enableVirtualization: true }
  }
});

// Fluent API for configuration
notation
  .addRenderer('customLayer', new CustomRenderer())
  .addTool('customTool', new CustomTool())
  .setTheme(customTheme)
  .on('noteAdded', handleNoteAdded)
  .render();

// Data manipulation
notation.setData(newMusicalData);
notation.addNote(newNote);
notation.removeNote(noteId);
notation.setZoom(1.5);
notation.scrollToNote(noteId);

// Event handling
notation.on('dataChanged', (data) => { 
  // Handle data changes
});
notation.on('viewportChanged', (viewport) => { 
  // Handle viewport changes  
});
```

#### Advanced API
```typescript
// Access to lower-level systems
const viewport = notation.getViewport();
const coordinates = notation.getCoordinateSystem();
const renderer = notation.getRenderer();

// Plugin development
notation.extend({
  renderers: {
    'myCustomRenderer': MyCustomRenderer
  },
  tools: {
    'myCustomTool': MyCustomTool  
  },
  coordinateSystems: {
    'myCustomCoords': MyCustomCoordinates
  }
});
```

### 5. Migration Strategy

#### Phase 1: Interface Extraction
1. Define all interfaces without changing implementations
2. Create adapter classes for existing services
3. Add type definitions throughout codebase

#### Phase 2: Dependency Injection
1. Replace direct imports with injected dependencies
2. Create container/factory system
3. Maintain backward compatibility with adapters

#### Phase 3: Plugin System Implementation
1. Extract renderers into plugins
2. Extract tools into plugins  
3. Create plugin registration system

#### Phase 4: State Management Abstraction
1. Create StateManager interface
2. Implement StoreAdapter
3. Replace direct store access with StateManager calls

#### Phase 5: Public API Creation
1. Create consumer-facing API wrapper
2. Hide internal complexity
3. Add documentation and examples

#### Phase 6: Package Extraction
1. Separate core library from Student Notation app
2. Create npm package structure
3. Add build process and distribution

### 6. Backward Compatibility

#### Compatibility Layer
```typescript
// Maintain existing API during transition
class LegacyStudentNotation {
  constructor() {
    // Create new engine with legacy adapters
    this.engine = new StudentNotationEngine(container, {
      stateManager: new StoreAdapter(store),
      canvasProvider: new CanvasContextAdapter(CanvasContextService),
      eventBus: new EventBusAdapter()
    });
  }
  
  // Proxy existing methods to new engine
  render() { return this.engine.render(); }
  setData(data) { return this.engine.setData(data); }
}
```

### 7. Benefits of This Architecture

#### For Library Consumers
- **Clean API**: Simple, intuitive interface
- **Extensible**: Plugin system for customization
- **Performant**: Virtualization and optimization built-in
- **Framework Agnostic**: Works with any framework or vanilla JS

#### For Library Maintainers  
- **Testable**: Pure functions and dependency injection
- **Modular**: Clear separation of concerns
- **Maintainable**: Reduced coupling and cohesion
- **Extensible**: Easy to add new features via plugins

#### For Student Notation App
- **Gradual Migration**: Can migrate incrementally
- **Feature Preservation**: All existing functionality maintained
- **Performance Gains**: Better optimization opportunities
- **Future Flexibility**: Easy to adapt to new requirements

## Implementation Timeline

### Quarter 1: Foundation
- [ ] Interface definitions
- [ ] Dependency injection container  
- [ ] Basic plugin system
- [ ] Viewport abstraction

### Quarter 2: Core Systems
- [ ] Coordinate system abstraction
- [ ] State management abstraction
- [ ] Rendering engine refactor
- [ ] Tool system refactor

### Quarter 3: API & Packaging
- [ ] Public API design
- [ ] Package structure
- [ ] Documentation
- [ ] Testing framework

### Quarter 4: Migration & Release
- [ ] Student Notation migration
- [ ] Performance optimization
- [ ] Beta testing
- [ ] Public release

This architecture provides a clear path forward for creating a powerful, reusable musical notation library while preserving all the sophisticated functionality that Student Notation has already developed.