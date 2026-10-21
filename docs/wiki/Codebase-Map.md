# Codebase Map: where to find what

| I want to... | Look in |
|---|---|
| App start-up and wiring | `src/app.js`, `index.html` |
| Patch model and validation | `src/graph/types.js`, `validate.js`, `compile.js`, `registry.js` |
| Patch file format and migrations | `src/persistence/patch-schema.js`, `migrations.js`, `patch-store.js` |
| Undo and actions | `src/state/actions.js`, `history.js`, `patch-state.js` |
| Audio engine (main thread) | `src/engine/audio-engine.js`, `event-queue.js`, `parameter-runtime.js`, `protocol.js` |
| AudioWorklet processor | `src/engine/worklet-processor.js` |
| Voices and polyphony | `src/engine/voice-engine.js`, `voice-allocator.js` |
| DSP primitives | `src/dsp/` (oscillator, filters, envelope, LFO, effects, mixer, VCA, noise, safety) |
| Modules and their UI definitions | `src/modules/` (`core-definitions.js`, `standard-definitions.js`, `*-module.js`) |
| Workspace, cables, keyboard, diagnostics | `src/ui/` |
| Scopes, spectrum, scheduler | `src/visual/` |
| MIDI and computer keyboard | `src/input/` |
| Guided presets and starter patch | `src/presets/` |
| Help text | `src/help/guidance.js` |
| Styles | `styles/app.css`, `styles/guidance.css` |
| Tests | `tests/unit/`, `tests/integration/`, `tests/browser/` |
| Specs | `spec/`; plan in `docs/DEVELOPMENT_PLAN.md` |
