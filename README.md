Live link: https://iambored456.github.io/Student-Notation/

## Contributor Notes
- All directories and files use camelCase (e.g., `components/toolbar`, `paintControls.js`). Please follow this when adding or renaming anything to keep imports predictable across platforms.
- Large renames should happen feature-by-feature so related imports are updated together. After each batch, run `npx vite` to confirm case-sensitive files resolve correctly.

## Module Aliases
Vite now exposes several import aliases to reduce long relative paths:

| Alias | Resolves to | Intended usage |
| --- | --- | --- |
| `@` | `/js` | Entry point for general modules while the project still lives under `/js`. |
| `@components` | `/js/components` | UI components and renderers. |
| `@services` | `/js/services` | Shared services (layout, transport, paint playback, etc.). |
| `@state` | `/js/state` | Store, actions, selectors. |
| `@utils` | `/js/utils` | Generic helpers and diagnostics. |

Editor tooling: `jsconfig.json` mirrors these aliases so VS Code (and other TS-aware editors) resolve the same paths without extra setup.

When files move into a future `src/` directory, update the alias targets in `vite.config.js` but keep the same alias names to avoid touching every import.

## Bootstrap Strategy
- `js/core/main.js` remains the single entry ('bootstrap') that wires services, UI, and listeners.
- Each subsystem (toolbar, canvas, rhythm, paint, audio, diagnostics) should expose an `initXYZ()` in `js/bootstrap/<area>/`. `main.js` only orchestrates these in order, passing shared `store`, layout services, or Tone context as needed.
- Current initializers: `js/bootstrap/ui/initUiComponents.js`, `js/bootstrap/audio/initAudioComponents.js`, `js/bootstrap/rhythm/initRhythmUi.js`, `js/bootstrap/canvas/initCanvasServices.js`, `js/bootstrap/paint/initPaintSystem.js`, `js/bootstrap/draw/initDrawSystem.js`, and `js/bootstrap/input/initInputAndDiagnostics.js`.
- New functionality (e.g., future tutorial engines) should add a new initializer rather than expanding `main.js` directly.
- Document cross-feature dependencies inside each initializer so they remain loosely coupled and testable.

## Environment Variables
- Vite reads `.env` files and only exposes variables prefixed with `VITE_` to browser code via `import.meta.env`.
- No env files are required today, but when lessons or tutorials need configurable behavior you can add, for example, `VITE_LESSON_MODE=voice` in `.env` and read it where voice playback is initialized:
  ```js
  const lessonMode = import.meta.env.VITE_LESSON_MODE ?? 'text';
  ```
- Keep runtime user toggles in the store/UI; env vars simply set defaults per deployment (dev vs. tutorial builds, etc.).
