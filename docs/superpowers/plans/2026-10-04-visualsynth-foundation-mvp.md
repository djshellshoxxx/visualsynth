# VisualSynth Foundation and MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working VisualSynth MVP from the approved specification: a static GitHub Pages modular synthesizer with a compiled AudioWorklet DSP graph, keyboard/MIDI note input, oscillators, mixer, filter, VCA, ADSR, LFO modulation, patch cables, polyphony, master monitoring, save/load, presets, and per-module visualization.

**Architecture:** The UI owns editable patch state. A graph compiler validates typed connections, resolves voice/global scope, produces a compact executable graph description, and sends it to one AudioWorklet processor. The AudioWorklet owns real-time voices and DSP state; visualization telemetry flows one-way back to a centralized rendering scheduler so graphics can degrade without affecting audio.

**Tech Stack:** Static HTML/CSS/ES modules, Web Audio API, AudioWorklet, Web MIDI API with graceful fallback, Canvas 2D, IndexedDB/localStorage, Vitest or Node test runner for pure modules, Playwright for browser integration/UI tests, GitHub Actions, GitHub Pages.

**Spec:** `spec/PROJECT_SPEC.md`, `spec/ARCHITECTURE.md`, `spec/DSP_SPEC.md`, `spec/MODULE_SPEC.md`, `spec/GUI_SPEC.md`, `spec/VISUALIZATION_SPEC.md`, `spec/PATCH_FORMAT.md`, `spec/REQUIREMENTS_MATRIX.md`, `spec/ACCEPTANCE_CRITERIA.md`

## Global Constraints

- Run entirely as a static GitHub Pages application under `/visualsynth/`.
- No required backend, account, tracking, or uploaded audio.
- Audio processing must run locally and take priority over visualization work.
- Use one persistent `AudioContext`; do not destroy/recreate it for routine graph edits.
- Modular graph changes must be validated before activation.
- Polyphonic voice processing is explicit; voice and global domains must never be inferred ad hoc in module code.
- Continuous meaningful parameters use centralized metadata and smoothing rules.
- Oscillators and nonlinear DSP require browser-appropriate anti-aliasing strategies from `spec/DSP_SPEC.md`.
- Invalid state, NaN/Infinity, excessive feedback, unstable filter values, and runaway gain must fail safely.
- Patch files are versioned and migrated through explicit schema migrations.
- MIDI is optional at runtime; computer keyboard and on-screen keyboard remain functional when Web MIDI is unavailable.
- Visualizations show measured DSP state where the specification marks them as measured; decorative animation must never masquerade as signal data.
- Desktop is the primary patch-building target; touch controls must remain usable on modern tablets/phones.
- All public controls require accessible text/numeric state and may not depend on color alone.
- Use TDD for logic and bug fixes; commit after each independently testable task.

## Review Focus

- Malformed or cyclic patch graphs: reject invalid zero-delay cycles without corrupting the last valid running graph.
- Rapid graph edits while notes are sounding: audio must remain bounded and must not leave orphaned/stuck voices.
- Unsupported/denied MIDI permission: keyboard/on-screen input must continue normally and UI must report MIDI as unavailable without throwing.
- Extreme modulation/feedback values: DSP must clamp or contain unsafe values while retaining musically useful ranges.
- Heavy visualization load/offscreen modules: visualization rate must degrade before audio processing is affected.

---

## File Structure

Initial structure to create during Tasks 1-4:

```text
index.html
styles/
  app.css
src/
  app.js
  state/
    patch-state.js
    actions.js
    history.js
  graph/
    types.js
    registry.js
    validate.js
    compile.js
  engine/
    audio-engine.js
    worklet-processor.js
    protocol.js
    voice-manager.js
    parameter-runtime.js
  dsp/
    math.js
    oscillator.js
    envelope.js
    lfo.js
    mixer.js
    filters.js
    vca.js
    safety.js
  input/
    note-events.js
    computer-keyboard.js
    midi.js
  persistence/
    patch-schema.js
    migrations.js
    patch-store.js
    presets.js
  ui/
    workspace.js
    module-view.js
    cable-layer.js
    controls.js
    keyboard-view.js
    master-view.js
  visual/
    scheduler.js
    waveform.js
    spectrum.js
    telemetry.js
  modules/
    core-definitions.js
    oscillator-module.js
    mixer-module.js
    filter-module.js
    envelope-module.js
    lfo-module.js
    vca-module.js
    master-module.js
  presets/
    factory.js
tests/
  unit/
  integration/
  browser/
.github/workflows/
  test.yml
  pages.yml
package.json
.nojekyll
```

Later beta tasks should extend this structure rather than collapsing responsibilities into large catch-all files.

---

### Task 1: Static Application Shell and Test Harness

**Files:**
- Create: `index.html`
- Create: `styles/app.css`
- Create: `src/app.js`
- Create: `package.json`
- Create: `.nojekyll`
- Create: `tests/browser/app-shell.spec.js`
- Create: `.github/workflows/test.yml`

**Interfaces:**
- Produces: `bootApp(): Promise<void>` in `src/app.js`.
- Produces: DOM regions `#toolbar`, `#module-library`, `#workspace`, `#keyboard`, `#master-monitor` used by later tasks.

- [ ] **Step 1: Write the failing browser test**

Assert that `/visualsynth/` loads without console errors and the five required regions exist.

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- --runInBand` and `npx playwright test tests/browser/app-shell.spec.js`.
Expected: FAIL because the application shell does not exist.

- [ ] **Step 3: Implement the shell**

Create semantic HTML, a minimal Circuit Drift Labs-compatible dark technical layout, base-path-safe ES module imports, and `bootApp(): Promise<void>`.

- [ ] **Step 4: Verify**

Run unit/browser tests and confirm the page works from both `/` locally and `/visualsynth/` base-path configuration.

- [ ] **Step 5: Commit**

`git commit -m "feat: scaffold VisualSynth static application"`

### Task 2: Canonical Parameter and Module Type System

**Files:**
- Create: `src/graph/types.js`
- Create: `src/graph/registry.js`
- Create: `src/modules/core-definitions.js`
- Create: `tests/unit/module-registry.test.js`

**Interfaces:**
- Produces: `registerModuleType(definition): void`
- Produces: `getModuleType(typeId): ModuleDefinition`
- Produces: `listModuleTypes(): ModuleDefinition[]`
- Produces canonical `ParameterDefinition`, `PortDefinition`, `ModuleDefinition`, `SignalType`, and `VoiceScope` shapes.

- [ ] **Step 1: Write failing registry/type tests**

Cover duplicate type IDs, unknown type lookup, default values, port signal classes, parameter min/max/default/curve/smoothing metadata, and voice/global scope.

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/module-registry.test.js`.

- [ ] **Step 3: Implement registry and initial core definitions**

Define initial module types: Note Input, Oscillator, Mixer, Filter, ADSR, LFO, VCA, Master Output.

- [ ] **Step 4: Verify pass**

Run the registry suite.

- [ ] **Step 5: Commit**

`git commit -m "feat: define module and parameter contracts"`

### Task 3: Patch State, Actions, and Undo/Redo

**Files:**
- Create: `src/state/patch-state.js`
- Create: `src/state/actions.js`
- Create: `src/state/history.js`
- Create: `tests/unit/patch-state.test.js`
- Create: `tests/unit/history.test.js`

**Interfaces:**
- Produces: `createPatchState(): PatchState`
- Produces: `reducePatch(state, action): PatchState`
- Produces: `HistoryController.apply(action)`, `.undo()`, `.redo()`.

- [ ] **Step 1: Write failing tests**

Cover module add/remove/move/duplicate, parameter edit, connection add/remove, grouped continuous control edits, preset-load history boundary, randomization-compatible atomic actions, and undo/redo correctness.

- [ ] **Step 2: Verify failure**

Run the two unit suites.

- [ ] **Step 3: Implement immutable-enough patch state and action reducer**

Keep runtime-only DSP state out of serialized patch state.

- [ ] **Step 4: Verify pass**

Run unit tests.

- [ ] **Step 5: Commit**

`git commit -m "feat: add patch state and undo history"`

### Task 4: Graph Validation and Compilation

**Files:**
- Create: `src/graph/validate.js`
- Create: `src/graph/compile.js`
- Create: `tests/unit/graph-validation.test.js`
- Create: `tests/unit/graph-compile.test.js`

**Interfaces:**
- Produces: `validatePatchGraph(patch, registry): ValidationResult`
- Produces: `compilePatchGraph(patch, registry): CompiledGraph`
- Consumes module/port definitions from Task 2 and patch state from Task 3.

- [ ] **Step 1: Write failing graph tests**

Cover compatible/incompatible port classes, missing endpoints, fan-in/fan-out rules, voice/global boundary rules, deterministic evaluation order, disconnected modules, and zero-delay cycles.

Add Review Focus test: a malformed cyclic graph must return an error and never replace the last valid compiled graph.

- [ ] **Step 2: Verify failure**

Run graph suites.

- [ ] **Step 3: Implement validator and compiler**

Use deterministic topological ordering. Treat explicitly supported delayed-feedback edges as cycle breaks; reject all other cycles.

- [ ] **Step 4: Verify pass**

Run graph suites.

- [ ] **Step 5: Commit**

`git commit -m "feat: validate and compile modular graphs"`

### Task 5: DSP Math, Safety, and Parameter Runtime

**Files:**
- Create: `src/dsp/math.js`
- Create: `src/dsp/safety.js`
- Create: `src/engine/parameter-runtime.js`
- Create: `tests/unit/dsp-safety.test.js`
- Create: `tests/unit/parameter-runtime.test.js`

**Interfaces:**
- Produces: `sanitizeSample(value): number`
- Produces: `safeGain(value, limit): number`
- Produces: `ParameterRuntime.setTarget(id, value, frame)` and `.renderBlock(...)`.

- [ ] **Step 1: Write failing safety/smoothing tests**

Cover NaN, Infinity, denormally tiny values, out-of-range values, linear/exponential/log-like display conversion as specified, and sample-accurate smoothing boundaries.

Add Review Focus test for extreme modulation values remaining finite and bounded.

- [ ] **Step 2: Verify failure**

Run the suites.

- [ ] **Step 3: Implement safety and centralized parameter runtime**

Parameter behavior must derive from Task 2 metadata instead of module-specific ad hoc smoothing.

- [ ] **Step 4: Verify pass**

Run tests.

- [ ] **Step 5: Commit**

`git commit -m "feat: add DSP safety and parameter smoothing"`

### Task 6: Core DSP Modules

**Files:**
- Create: `src/dsp/oscillator.js`
- Create: `src/dsp/envelope.js`
- Create: `src/dsp/lfo.js`
- Create: `src/dsp/mixer.js`
- Create: `src/dsp/filters.js`
- Create: `src/dsp/vca.js`
- Create: corresponding tests under `tests/unit/`

**Interfaces:**
- Produces pure/block DSP functions consumed by the AudioWorklet runtime.
- Oscillator interface must support sine, triangle, square/pulse, saw, reverse saw, and anti-aliased discontinuities.
- ADSR produces per-sample envelope values and explicit gate/retrigger/release behavior.
- LFO supports bipolar/unipolar operation and free/tempo-rate abstractions.

- [ ] **Step 1: Write failing oscillator tests**

Assert phase continuity, pitch accuracy, pulse width behavior, finite output, and reduced high-frequency discontinuity error versus naive waveform generation.

- [ ] **Step 2: Implement oscillator and run tests**

- [ ] **Step 3: Write failing ADSR/LFO tests**

Assert stage transitions, retrigger mode, release from current value, polarity, and deterministic phase behavior.

- [ ] **Step 4: Implement ADSR/LFO and run tests**

- [ ] **Step 5: Write failing mixer/filter/VCA tests**

Assert summation, gain/pan/polarity, filter response direction, finite resonance extremes, and VCA modulation.

- [ ] **Step 6: Implement mixer/filter/VCA and run tests**

- [ ] **Step 7: Commit**

`git commit -m "feat: implement core synthesis DSP modules"`

### Task 7: Voice Allocation and Polyphony

**Files:**
- Create: `src/engine/voice-manager.js`
- Create: `src/input/note-events.js`
- Create: `tests/unit/voice-manager.test.js`

**Interfaces:**
- Produces: `VoiceManager.noteOn(noteEvent)`, `.noteOff(noteEvent)`, `.allNotesOff()`, `.snapshot()`.
- Produces canonical `NoteEvent` shape used by keyboard and MIDI adapters.

- [ ] **Step 1: Write failing voice tests**

Cover polyphonic allocation, mono/legato mode, repeated-note handling, sustain state hook, voice stealing policy from the spec, all-notes-off, and stable IDs.

Add Review Focus test: rapid note and graph activity must not leave voices stuck after panic/all-notes-off.

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement voice manager**

Separate per-voice state allocation from global module state.

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

`git commit -m "feat: add polyphonic voice allocation"`

### Task 8: AudioWorklet Engine and Graph Hot Swap

**Files:**
- Create: `src/engine/protocol.js`
- Create: `src/engine/audio-engine.js`
- Create: `src/engine/worklet-processor.js`
- Create: `tests/integration/audio-engine.test.js`
- Create: `tests/browser/audio-smoke.spec.js`

**Interfaces:**
- Produces: `AudioEngine.start()`, `.applyCompiledGraph(graph)`, `.sendNote(event)`, `.setParameter(...)`, `.panic()`, `.diagnostics()`.
- Defines protocol messages: initialize, graphSwap, note, parameter, transport/panic, telemetry.

- [ ] **Step 1: Write failing protocol/integration tests**

Assert message schema, graph revision ordering, stale update rejection, processor startup, and panic behavior.

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement persistent AudioContext + AudioWorklet engine**

The processor must execute the compiled graph for every active voice, combine voice outputs into the global chain, sanitize each critical stage, and emit bounded telemetry.

- [ ] **Step 4: Add graph hot-swap test**

While a note is active, apply a valid graph revision and verify finite output and no orphaned voices. Apply an invalid graph and verify the running revision remains unchanged.

- [ ] **Step 5: Verify browser smoke test**

- [ ] **Step 6: Commit**

`git commit -m "feat: add compiled AudioWorklet synthesis engine"`

### Task 9: Computer Keyboard and Web MIDI Input

**Files:**
- Create: `src/input/computer-keyboard.js`
- Create: `src/input/midi.js`
- Create: `tests/unit/computer-keyboard.test.js`
- Create: `tests/unit/midi.test.js`

**Interfaces:**
- Produces both sources as normalized `NoteEvent` streams.
- MIDI adapter additionally emits pitch bend, mod wheel, CC, sustain, velocity, and aftertouch when available.

- [ ] **Step 1: Write failing keyboard mapping tests**

Cover note mapping, octave change, key-repeat suppression, release, focus-sensitive shortcut prevention, and all-notes-off on blur where appropriate.

- [ ] **Step 2: Implement keyboard adapter and verify**

- [ ] **Step 3: Write failing MIDI tests**

Cover note on/off including velocity-zero note-off semantics, pitch bend normalization, CC, sustain, device connect/disconnect, and permission failure.

Add Review Focus test: denied/unsupported MIDI leaves keyboard input operational and reports a recoverable unavailable state.

- [ ] **Step 4: Implement MIDI adapter and verify**

- [ ] **Step 5: Commit**

`git commit -m "feat: add keyboard and MIDI note input"`

### Task 10: Modular Workspace and Patch Cables

**Files:**
- Create: `src/ui/workspace.js`
- Create: `src/ui/module-view.js`
- Create: `src/ui/cable-layer.js`
- Create: `src/ui/controls.js`
- Create: `tests/browser/workspace.spec.js`

**Interfaces:**
- Workspace dispatches Task 3 actions only; it does not mutate engine state directly.
- Cable creation calls graph validation before commit.

- [ ] **Step 1: Write failing browser tests**

Cover add/move/remove/duplicate module, cable drag connect/disconnect, incompatible-port rejection, bypass/mute affordances where supported, keyboard navigation, touch-sized connection targets, and grouped knob undo.

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement workspace and module panels**

Use SVG or Canvas overlay for cables; prefer DOM/SVG hit targets for accessibility and pointer interactions.

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

`git commit -m "feat: add modular workspace and patch cables"`

### Task 11: Centralized Visualization Scheduler and Telemetry

**Files:**
- Create: `src/visual/telemetry.js`
- Create: `src/visual/scheduler.js`
- Create: `src/visual/waveform.js`
- Create: `src/visual/spectrum.js`
- Create: `tests/unit/visual-scheduler.test.js`
- Create: `tests/browser/visualization.spec.js`

**Interfaces:**
- Produces: `VisualizationScheduler.register(view, priority)`, `.setVisibility(...)`, `.frame(timestamp)`.
- Consumes telemetry snapshots from Task 8.

- [ ] **Step 1: Write failing scheduler tests**

Cover one shared animation loop, refresh priorities, collapsed/offscreen throttling, freeze, decimation, and bounded telemetry queues.

Add Review Focus test: simulated frame overload reduces visualization updates before dropping required audio-engine messages.

- [ ] **Step 2: Implement scheduler and verify**

- [ ] **Step 3: Implement waveform/spectrum renderers with tests**

Ensure module visuals can distinguish predicted source shape from measured output where required.

- [ ] **Step 4: Commit**

`git commit -m "feat: add centralized signal visualization"`

### Task 12: Module-Specific UI and Visuals

**Files:**
- Create: `src/modules/oscillator-module.js`
- Create: `src/modules/mixer-module.js`
- Create: `src/modules/filter-module.js`
- Create: `src/modules/envelope-module.js`
- Create: `src/modules/lfo-module.js`
- Create: `src/modules/vca-module.js`
- Create: `src/modules/master-module.js`
- Create browser tests for each core module.

**Interfaces:**
- Each module view consumes its `ModuleDefinition`, instance state, and telemetry selector.
- Each control dispatches generic parameter actions rather than module-specific engine commands.

- [ ] **Step 1: Write failing module-view tests**

Assert parameter controls, labels/units, measured/predicted visualization semantics, modulation indication, bypass/mute states, and accessible numeric entry.

- [ ] **Step 2: Implement core module UIs**

Oscillator: live waveform. Filter: response curve + input/output spectral context. ADSR/LFO: animated curves. Mixer/VCA: level/signal traces. Master: oscilloscope, spectrum, peak/RMS, clipping.

- [ ] **Step 3: Verify browser tests**

- [ ] **Step 4: Commit**

`git commit -m "feat: add visual core synthesis modules"`

### Task 13: On-Screen Keyboard and Master Controls

**Files:**
- Create: `src/ui/keyboard-view.js`
- Create: `src/ui/master-view.js`
- Create: `tests/browser/performance-controls.spec.js`

**Interfaces:**
- On-screen keyboard emits canonical `NoteEvent`s.
- Master view calls AudioEngine panic and exposes master gain/mute plus meters.

- [ ] **Step 1: Write failing interaction tests**

Cover mouse/touch note on/off, glissando-safe pointer handling, pressed-note display, octave changes, panic, clipping indicator, master mute/volume.

- [ ] **Step 2: Implement and verify**

- [ ] **Step 3: Commit**

`git commit -m "feat: add playable keyboard and master controls"`

### Task 14: Patch Serialization, Migration, and Local Storage

**Files:**
- Create: `src/persistence/patch-schema.js`
- Create: `src/persistence/migrations.js`
- Create: `src/persistence/patch-store.js`
- Create: `tests/unit/patch-format.test.js`
- Create: `tests/unit/migrations.test.js`

**Interfaces:**
- Produces: `serializePatch(patch): string`
- Produces: `parsePatch(json): PatchState`
- Produces: `migratePatch(document): CurrentPatchDocument`
- Produces: `PatchStore.save/list/load/delete`.

- [ ] **Step 1: Write failing round-trip and validation tests**

Cover stable schema version, unknown fields, invalid types, unknown module types, missing connection endpoints, and deterministic round-trip.

- [ ] **Step 2: Write failing migration tests**

Include at least one synthetic prior-version fixture to prove the migration chain is real rather than placeholder architecture.

- [ ] **Step 3: Implement serialization/migrations/store**

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

`git commit -m "feat: add versioned patch persistence"`

### Task 15: Factory Presets and MVP Templates

**Files:**
- Create: `src/presets/factory.js`
- Create: `src/persistence/presets.js`
- Create: `tests/unit/factory-presets.test.js`
- Create: `tests/browser/preset-loading.spec.js`

**Interfaces:**
- Produces immutable factory patch documents for Basic Subtractive, Two Oscillator Analog, Supersaw-lite, Bass, Lead, Pad, Noise Percussion, and Educational Basic Signal Flow.

- [ ] **Step 1: Write failing preset validation tests**

Every factory preset must parse, migrate, validate, compile, and contain no dangling connection.

- [ ] **Step 2: Implement presets and preset browser**

- [ ] **Step 3: Verify all presets can sound in browser smoke tests**

- [ ] **Step 4: Commit**

`git commit -m "feat: add factory patches and synth templates"`

### Task 16: Modulation UX for MVP

**Files:**
- Modify: `src/graph/compile.js`
- Modify: `src/ui/cable-layer.js`
- Modify: `src/ui/controls.js`
- Add: `tests/integration/modulation-routing.test.js`
- Add: `tests/browser/modulation-ui.spec.js`

**Interfaces:**
- Control/modulation cables compile to destination parameter modulation slots with amount/polarity/scaling.
- Target controls expose base value, modulation range, and live modulated position.

- [ ] **Step 1: Write failing modulation tests**

Cover LFO→pitch, LFO→filter cutoff, envelope→VCA, multiple modulation sources, bipolar/unipolar interpretation, and invalid audio/control connections.

- [ ] **Step 2: Implement modulation compilation/runtime**

- [ ] **Step 3: Implement visual assignment/range indication**

- [ ] **Step 4: Verify pass**

- [ ] **Step 5: Commit**

`git commit -m "feat: add modular parameter modulation"`

### Task 17: Diagnostics and Performance Monitor

**Files:**
- Create: `src/ui/diagnostics-view.js`
- Add engine telemetry fields in `src/engine/audio-engine.js` and `src/engine/worklet-processor.js`
- Add tests under `tests/unit/` and `tests/browser/`.

**Interfaces:**
- Produces `collectDiagnostics(): DiagnosticsDocument` with browser, sample rate, AudioContext state, latency, voices, modules, connections, visualization rates, MIDI devices, recent engine events/errors, and no private user data.

- [ ] **Step 1: Write failing diagnostics tests**

- [ ] **Step 2: Implement diagnostics, Copy Diagnostics, Download Diagnostics JSON**

- [ ] **Step 3: Implement performance panel with active voices/modules and visualization pressure indicators**

- [ ] **Step 4: Verify no private data is emitted**

- [ ] **Step 5: Commit**

`git commit -m "feat: add diagnostics and performance monitoring"`

### Task 18: Accessibility, Responsive Behavior, and Reduced Motion

**Files:**
- Modify: `styles/app.css`
- Modify core UI files from Tasks 10-13
- Create: `tests/browser/accessibility.spec.js`
- Create: `tests/browser/responsive.spec.js`

**Interfaces:**
- No new engine APIs.

- [ ] **Step 1: Write failing accessibility tests**

Cover ARIA/name/value exposure, keyboard reachability, focus order, non-color-only connection state, reduced-motion behavior, and numeric alternatives to graphs.

- [ ] **Step 2: Implement accessibility fixes**

- [ ] **Step 3: Write responsive tests for desktop/laptop/tablet/mobile widths**

- [ ] **Step 4: Implement responsive behavior without making mobile the primary graph-editing layout**

- [ ] **Step 5: Commit**

`git commit -m "feat: harden accessibility and responsive UI"`

### Task 19: GitHub Pages Deployment and Cross-Browser CI

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `.github/workflows/test.yml`
- Add: `tests/browser/base-path.spec.js`

**Interfaces:**
- Deployment artifact is the static repository application.

- [ ] **Step 1: Write base-path browser test**

Verify dynamic imports, worklet module URL, preset loading, and CSS/assets under `/visualsynth/`.

- [ ] **Step 2: Add Chromium and Firefox CI browser runs**

Add Safari/WebKit tests where the CI environment makes them reliable; MIDI-specific tests should be capability-gated rather than skipped silently.

- [ ] **Step 3: Add GitHub Pages workflow**

- [ ] **Step 4: Verify CI and deployed Pages smoke test**

- [ ] **Step 5: Commit**

`git commit -m "ci: deploy and test VisualSynth on GitHub Pages"`

### Task 20: MVP Acceptance Audit

**Files:**
- Modify: `spec/REQUIREMENTS_MATRIX.md`
- Modify: `spec/ACCEPTANCE_CRITERIA.md`
- Create: `docs/MVP_VERIFICATION.md`

**Interfaces:**
- No runtime API.

- [ ] **Step 1: Run full automated suite**

Run unit, integration, Playwright, lint/static checks, production Pages build, and all factory-preset compile tests.

- [ ] **Step 2: Run manual audio acceptance passes**

Verify keyboard/MIDI, polyphony, patching, LFO modulation, ADSR, oscillator/filter/VCA flow, panic, save/load, presets, oscilloscope, spectrum, per-module visuals, and sustained session stability.

- [ ] **Step 3: Cross-check every MVP requirement ID**

Mark each requirement with concrete test or manual evidence; no requirement may be marked complete by inspection alone when an executable verification is feasible.

- [ ] **Step 4: Record known limitations**

Only document actual remaining limitations; do not silently defer failed MVP requirements.

- [ ] **Step 5: Commit**

`git commit -m "docs: verify VisualSynth MVP against specification"`

---

## Post-MVP Plans

Do not overload this plan with the complete beta. After Task 20 passes, write separate implementation plans for:

1. Advanced oscillators, wavetable, additive/harmonic editor, waveform drawing, FM/PM/AM/ring modulation.
2. Effects and nonlinear processing: waveshaper, distortion, delay, reverb, chorus, flanger, phaser, EQ, compressor, stereo utilities.
3. Advanced modulation, macros, XY controls, random/chaos sources, sequencing and arpeggiation.
4. Scope Probe, Control Probe, Signal Inspector, spectrogram, phase/stereo analysis, visual signal-flow mode and Compare Mode.
5. Learning Mode and interactive lessons.
6. Automation recording/editing and offline render/export.
7. Advanced presets/templates, controlled patch randomization/mutation, microtuning and future module families.

Each plan must use the same canonical module, graph, parameter, patch-schema, engine-protocol, and visualization interfaces established here.

## Self-Review Results

- Spec coverage: all MVP requirements listed in `spec/PROJECT_SPEC.md` are assigned to Tasks 1-20. Beta-only systems are explicitly split into follow-on plans rather than silently omitted.
- Step scan: implementation bodies are intentionally not transcribed; exact interfaces, files, tests, and acceptance behavior are specified.
- Type consistency: graph definitions originate in Task 2; patch state in Task 3; compiled graph in Task 4; note events in Task 7; engine protocol in Task 8; later tasks consume those contracts.
- Review Focus: malformed cycles, hot graph edits, MIDI failure, extreme modulation/feedback, and visualization overload all have explicit owning tests.
- Proportion: this plan is narrower than the full product specification and ends at a complete MVP acceptance gate.