# Student Notation Library API Boundaries

## Executive Summary

This document defines the specific API boundaries and interfaces for extracting Student Notation's pitch grid system into a reusable library. It identifies what should be exposed, what should remain internal, and how to structure the public API.

## Public API Surface

### 1. Primary Entry Point

```typescript
class StudentNotationEngine {
  constructor(
    container: HTMLElement, 
    config: StudentNotationConfig
  );
  
  // Core Methods
  render(): void;
  setData(data: MusicalData): void;
  getData(): MusicalData;
  destroy(): void;
  
  // Viewport Control
  setZoom(level: number): void;
  getZoom(): number;
  setScroll(position: number): void;
  getScroll(): number;
  scrollToNote(noteId: string): void;
  
  // Tool Management
  setActiveTool(toolName: string): void;
  getActiveTool(): string;
  addTool(name: string, tool: InteractionTool): void;
  
  // Event System
  on(eventName: string, handler: Function): () => void;
  off(eventName: string, handler?: Function): void;
  emit(eventName: string, data: any): void;
  
  // Plugin System
  addRenderer(name: string, renderer: LayerRenderer): void;
  removeRenderer(name: string): void;
  setLayerOrder(layers: string[]): void;
  
  // State Access
  addNote(note: Note): void;
  removeNote(noteId: string): void;
  updateNote(noteId: string, changes: Partial<Note>): void;
  getNotes(): Note[];
}
```

### 2. Configuration Interface

```typescript
interface StudentNotationConfig {
  // Required
  data: MusicalData;
  
  // Viewport Configuration
  viewport?: {
    initialZoom?: number;
    zoomLimits?: { min: number; max: number; };
    scrollBehavior?: 'smooth' | 'auto';
    enableVirtualization?: boolean;
  };
  
  // Interaction Configuration
  interaction?: {
    tools?: string[];
    defaultTool?: string;
    enableAudio?: boolean;
    audioConfig?: AudioConfig;
    customToolHandlers?: Record<string, InteractionTool>;
  };
  
  // Rendering Configuration
  rendering?: {
    theme?: string | Theme;
    layers?: string[];
    customRenderers?: Record<string, LayerRenderer>;
    performance?: {
      enableVirtualization?: boolean;
      bufferRows?: number;
      maxFPS?: number;
    };
  };
  
  // Event Handlers
  onDataChange?: (data: MusicalData) => void;
  onNoteAdded?: (note: Note) => void;
  onNoteRemoved?: (noteId: string) => void;
  onViewportChange?: (viewport: ViewportInfo) => void;
}
```

### 3. Data Interfaces

```typescript
interface MusicalData {
  pitchData: PitchRow[];
  placedNotes: Note[];
  placedTonicSigns?: TonicSign[];
  columnWidths: number[];
  modulationMarkers?: ModulationMarker[];
  metadata?: {
    title?: string;
    composer?: string;
    keySignature?: string;
    timeSignature?: string;
  };
}

interface Note {
  id: string;
  row: number;
  column: number;
  pitch: string;
  shape: 'circle' | 'oval';
  color: string;
  octave?: number;
  duration?: number;
  velocity?: number;
  properties?: Record<string, any>;
}

interface PitchRow {
  toneNote: string;
  pitchClass: string;
  octave: number;
  displayName?: string;
  color?: string;
}
```

### 4. Plugin Interfaces

```typescript
// Renderer Plugin Interface
interface LayerRenderer {
  name: string;
  zIndex: number;
  
  render(context: RenderContext, options: RenderOptions): void;
  shouldRender(viewport: ViewportInfo, data: MusicalData): boolean;
  initialize?(engine: StudentNotationEngine): void;
  dispose?(): void;
}

// Tool Plugin Interface  
interface InteractionTool {
  name: string;
  cursor?: string;
  
  onActivate?(engine: StudentNotationEngine): void;
  onDeactivate?(): void;
  onMouseDown?(coords: MusicalCoords, event: MouseEvent): void;
  onMouseMove?(coords: MusicalCoords, event: MouseEvent): void;
  onMouseUp?(coords: MusicalCoords, event: MouseEvent): void;
  onKeyDown?(event: KeyboardEvent): boolean; // return true if handled
}

// Theme Plugin Interface
interface Theme {
  name: string;
  colors: {
    background: string;
    gridLines: string;
    notes: Record<string, string>;
    text: string;
  };
  fonts: {
    default: string;
    notes: string;
    labels: string;
  };
  dimensions: {
    noteSize: number;
    lineWidth: number;
  };
}
```

### 5. Event System

```typescript
// Standard Events
interface StudentNotationEvents {
  // Data Events
  'dataChanged': (data: MusicalData) => void;
  'noteAdded': (note: Note) => void;
  'noteRemoved': (noteId: string) => void;
  'noteUpdated': (note: Note, changes: Partial<Note>) => void;
  
  // Viewport Events  
  'viewportChanged': (viewport: ViewportInfo) => void;
  'zoomChanged': (zoomLevel: number) => void;
  'scrollChanged': (scrollPosition: number) => void;
  
  // Interaction Events
  'toolChanged': (toolName: string) => void;
  'noteClicked': (note: Note, event: MouseEvent) => void;
  'noteHovered': (note: Note | null) => void;
  
  // System Events
  'initialized': () => void;
  'destroyed': () => void;
  'error': (error: Error) => void;
}
```

## Internal Interfaces (Not Exposed)

### 1. Core System Interfaces

```typescript
// These remain internal to the library
interface ViewportManager {
  calculateViewportInfo(...): ViewportInfo;
  getVisibleRange(...): VisibleRange;
  // ... other internal methods
}

interface CoordinateSystem {
  musicalToPixel(...): PixelCoords;
  pixelToMusical(...): MusicalCoords;
  // ... other internal methods
}

interface RenderingEngine {
  // Internal rendering pipeline
  registerInternalRenderer(...): void;
  executeRenderPipeline(...): void;
  // ... other internal methods
}
```

### 2. Service Adapters (Internal)

```typescript
// These bridge the gap between new architecture and existing code
class StoreAdapter implements StateManager {
  // Internal implementation details
}

class CanvasContextAdapter implements CanvasProvider {
  // Internal implementation details  
}

class LayoutServiceAdapter implements ViewportManager {
  // Internal implementation details
}
```

## API Usage Examples

### 1. Basic Usage

```typescript
// Simple setup with default configuration
const notation = new StudentNotationEngine(
  document.getElementById('notation-container'),
  {
    data: {
      pitchData: generatePitchRows(),
      placedNotes: [],
      columnWidths: generateColumnWidths()
    }
  }
);

// Add some notes
notation.addNote({
  id: 'note1',
  row: 12,
  column: 4, 
  pitch: 'C4',
  shape: 'circle',
  color: '#4a90e2'
});

notation.render();
```

### 2. Advanced Usage with Plugins

```typescript
// Custom renderer
class CustomHighlightRenderer implements LayerRenderer {
  name = 'customHighlight';
  zIndex = 10;
  
  render(context: RenderContext, options: RenderOptions) {
    // Custom rendering logic
    this.highlightSelectedNotes(context, options.selectedNotes);
  }
  
  shouldRender(viewport: ViewportInfo): boolean {
    return viewport.zoomLevel > 0.5;
  }
}

// Custom tool
class CustomSelectTool implements InteractionTool {
  name = 'select';
  cursor = 'pointer';
  
  onMouseDown(coords: MusicalCoords, event: MouseEvent) {
    // Custom selection logic
  }
}

// Setup with plugins
const notation = new StudentNotationEngine(container, {
  data: musicalData,
  rendering: {
    customRenderers: {
      'customHighlight': CustomHighlightRenderer
    },
    layers: ['gridLines', 'notes', 'customHighlight']
  },
  interaction: {
    tools: ['note', 'eraser', 'select'],
    customToolHandlers: {
      'select': CustomSelectTool
    },
    defaultTool: 'select'
  }
});

// Add event handlers
notation.on('noteClicked', (note) => {
  console.log('Note clicked:', note);
});

notation.on('viewportChanged', (viewport) => {
  console.log('Viewport changed:', viewport);
});
```

### 3. Framework Integration

```typescript
// React Integration Example
function NotationComponent({ data, onDataChange }) {
  const containerRef = useRef();
  const notationRef = useRef();
  
  useEffect(() => {
    if (containerRef.current && !notationRef.current) {
      notationRef.current = new StudentNotationEngine(
        containerRef.current,
        {
          data,
          onDataChange
        }
      );
    }
    
    return () => {
      notationRef.current?.destroy();
    };
  }, []);
  
  useEffect(() => {
    notationRef.current?.setData(data);
  }, [data]);
  
  return <div ref={containerRef} className="notation-container" />;
}
```

## Versioning and Compatibility

### Semantic Versioning
- **Major**: Breaking API changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

### API Stability Guarantees
- **Core API**: Stable, breaking changes only in major versions
- **Plugin Interfaces**: Stable, with deprecation warnings before changes  
- **Internal APIs**: No stability guarantee, can change in any version
- **Configuration**: New options added as optional, old options deprecated gracefully

### Migration Support
```typescript
// Version compatibility helpers
StudentNotationEngine.version; // "2.1.3"
StudentNotationEngine.isCompatible(config); // boolean
StudentNotationEngine.migrateConfig(oldConfig); // newConfig
```

## Documentation Strategy

### API Documentation
- Full TypeScript definitions
- JSDoc comments for all public APIs
- Interactive examples and demos
- Migration guides between versions

### Plugin Development Guide
- Plugin architecture overview
- Renderer plugin tutorial
- Tool plugin tutorial  
- Theme development guide
- Performance best practices

### Integration Examples
- Vanilla JavaScript
- React integration
- Vue integration  
- Angular integration
- Node.js server-side rendering

This API boundary definition provides a clear separation between public and private concerns while maintaining the flexibility needed for the complex musical notation requirements of Student Notation.