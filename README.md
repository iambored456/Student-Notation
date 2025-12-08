# Student Notation
Accessible music theory without needing to read traditional staff notation.

[Live app](https://iambored456.github.io/Student-Notation/)

## What is this?
Student Notation is a grid-based music sketchpad built by a music educator and hobby coder. Instead of relying on Western staff notation, it uses labeled cells and simple visuals so learners can explore pitch, rhythm, and timbre, hear the results instantly, and connect theory to sound.

## Who it’s for
- Students who want to access music theory without needing to read Western Standard Music Notation
- Music educators who want a visually intuitive way to demonstrate ideas in class
- Folks interested in alternative music notation systems

## What you can do
- Sketch melodies and rhythms on a labeled grid instead of staff notation
- Hear ideas immediately with Tone.js transport controls; tweak tempo/looping
- Toggle toolbars for drawing, editing, zooming, and layout tweaks on desktop or touch
- Print or export grids/legends for handouts or sharing (html2canvas snapshots)
- Mobile/touch: tap-and-hold to place notes with a ghost overlay, then drag to resize once placed

## Quick start (local dev)
- Prereq: Node 18+
- Install: `npm install`
- Run: `npm run dev` then open the Vite URL (usually http://localhost:5173)
- Build: `npm run build`
- Lint/Typecheck: `npm run lint`, `npm run typecheck`

## Tech stack
- Vite + TypeScript modules
- Tone.js for synthesis/transport
- html2canvas for printable snapshots
- Plain CSS for styling

## Roadmap ideas
- Guided lesson modes for common theory topics
- Better sharing (saved states, links, or exports)
- More mobile-specific gestures and accessibility aids

## For developers
- Use camelCase for all dirs/files to keep imports consistent across platforms. Large renames should happen feature-by-feature; after each batch run `npm run dev` to confirm case-sensitive paths resolve.
- Path aliases (Vite + `jsconfig.json`): `@ -> src`, `@components -> src/components`, `@services -> src/services`, `@state -> src/state`, `@utils -> src/utils`, `tone -> tone/build/Tone.js`.
- Bootstrap pattern: `src/core/main.ts` orchestrates subsystem initializers in `src/bootstrap/*` (UI, audio, rhythm, canvas, draw, input/diagnostics, state). Add new init files rather than bloating `main.ts`; document cross-feature dependencies in each initializer.
- Mobile profile: `initDeviceProfileService()` syncs `store.state.deviceProfile` and toggles `<html>/<body>` classes (`is-mobile`, `is-touch`, `orientation-portrait`, `orientation-landscape`). Gate mobile-specific behavior off this instead of ad-hoc `matchMedia` checks.
- Environment variables: Vite reads `.env` files and only exposes `VITE_*` to browser code via `import.meta.env`. None are required today; use them to set deployment defaults (e.g., `VITE_LESSON_MODE=voice`).

## License
MIT
