# VisualSynth Development Plan

## 1. Delivery principles

Implementation must follow the specification set rather than invent architecture ad hoc. Each phase ends with tests and a requirements-matrix audit. No phase may knowingly leave a foundational interface ambiguous for the next phase.

The engineering order is deliberately bottom-up: types/graph/DSP before elaborate UI, and core modular playability before advanced educational features.

## Phase 0 — Research and architecture

Status: complete for specification phase.

Deliverables:

- research findings and references;
- project, architecture, DSP, module, GUI, visualization and patch specs;
- requirements matrix;
- acceptance criteria;
- development plan;
- specification audit.

Exit criteria:

- no unresolved architectural TBDs;
- polyphony and feedback semantics defined;
- initial module catalogue fixed;
- major requirements mapped to verification.

## Phase 1 — Project skeleton, types and graph compiler

Goals:

- establish TypeScript/Vite/static Pages project;
- central type model for patch/module/port/parameter schemas;
- module registry;
- schema validator and migrations;
- graph compiler, scope analysis, SCC cycle detection, scheduling and GraphIR;
- unit tests for graph validity and patch format.

Key deliverables:

- `src/graph/*`;
- `src/modules/registry.ts`;
- `src/persistence/patch-codec.ts`;
- fixture patches;
- CI typecheck/lint/unit tests.

Exit criteria:

- legal/illegal graph fixture suite passes;
- zero-delay cycles rejected;
- delayed feedback cycle accepted;
- patch canonical round-trip passes;
- no audio implementation required yet beyond interface stubs.

## Phase 2 — Core DSP library and AudioWorklet runtime

Goals:

- environment-neutral DSP primitives;
- runtime module interface;
- parameter smoothing/modulation runtime;
- AudioWorklet adapter;
- graph runtime and graph-swap manager;
- finite-value guards and panic path.

Core DSP implemented here:

- oscillator primitives and anti-aliasing;
- ADSR;
- VCA;
- mixer;
- multimode SVF;
- LFO;
- voice summing;
- feedback delay;
- master guard/meters.

Exit criteria:

- pure DSP tests pass;
- worklet starts/stops/restarts;
- graph can render a hard-coded simple synth;
- panic silences injected fault cases;
- parameter-only update path proven separate from topology compile.

## Phase 3 — Voice engine and playability

Goals:

- note/event queue;
- frame clock;
- Note Input module;
- poly/mono/legato/unison allocation;
- voice stealing;
- sustain and pitch bend;
- computer keyboard and on-screen keyboard.

Exit criteria:

- at least 8 stable voices in reference test patch;
- no stuck notes under repeated/reordered events;
- voice stealing tests pass;
- note/gate/pitch routing works through GraphIR;
- no MIDI dependency.

## Phase 4 — Visual modular workspace MVP

Goals:

- module library/search;
- module panels;
- DOM workspace pan/zoom/select/move/duplicate/delete;
- typed ports and cable layer;
- connect/disconnect UX;
- inspector;
- undo/redo transaction system;
- Beginner/Normal/Advanced view filtering.

Exit criteria:

- user can construct Note Input -> Oscillator -> Filter -> VCA -> Master from an empty patch;
- invalid connections explain failure;
- delete/undo restores exact modules/routes;
- UI mode changes preserve semantic patch hash.

## Phase 5 — Visualization foundation

Goals:

- centralized visualization scheduler;
- module waveform/envelope/LFO/filter visualizations;
- master scope/FFT/meters;
- state-derived vs measured labeling;
- visual throttling/offscreen behavior.

Exit criteria:

- no per-module RAF loops;
- master scope/FFT show measured output;
- oscillator/filter/envelope/LFO visuals track actual state;
- stress test demonstrates visuals degrade before audio.

## Phase 6 — Patch persistence, presets and templates

Goals:

- IndexedDB patch library;
- import/export;
- factory patch validation in CI;
- share URL for small patches;
- Basic Synth/default startup flow;
- first preset/template bank.

Exit criteria:

- round-trip import/export succeeds;
- invalid import preserves current patch;
- all factory patches compile in CI;
- share URL obeys size and validation limits.

At this point the project should satisfy the full MVP acceptance criteria.

## Phase 7 — Rich modulation and advanced oscillator set

Goals:

- direct modulation assignment shortcut;
- modulation arcs/ranges/effective-value display;
- audio-rate parameter promotion;
- Additive/Harmonic Oscillator;
- Wavetable Oscillator/editor;
- Supersaw;
- Multi-Stage Envelope;
- Noise Generator;
- Sample & Hold/Random;
- FM/PM utility and ring modulation.

Exit criteria:

- audio-rate FM/PM/VCA tests pass;
- wavetable mip/band-limit tests pass;
- modulation route and UI model remain identical regardless of assignment method;
- advanced oscillators serialize/migrate correctly.

## Phase 8 — Effects and stereo processing

Implement:

- Waveshaper/Distortion;
- Delay;
- Chorus/Flanger;
- Phaser;
- Reverb;
- Parametric EQ;
- Compressor;
- Stereo Utility;
- Envelope Follower;
- advanced ladder filter/wavefolder as time permits after standard effects.

Exit criteria:

- transfer/response visualizations derive from actual DSP functions;
- feedback effects remain stable across fuzzed legal parameter ranges;
- localized oversampling shows measurable alias reduction where enabled;
- effect bypass transitions de-click.

## Phase 9 — MIDI, performance controls and sequencing

Goals:

- Web MIDI capability/permission management;
- MIDI note/expression processing;
- MIDI Learn;
- macros;
- XY pad;
- Clock/Transport;
- Step Sequencer;
- Gate/Mod Sequencer;
- Arpeggiator;
- Voice Reduce;
- Euclidean/Probability modules.

Exit criteria:

- browser without MIDI still passes core playability tests;
- MIDI device disconnect does not leave stuck notes;
- sequencers use engine-frame timing;
- long-run clock drift tests pass.

## Phase 10 — Probes, signal inspector and educational visualization

Goals:

- Scope Probe;
- Control Probe;
- probe compiler instrumentation;
- advanced signal metrics;
- Visual Signal Flow Mode;
- Compare Mode;
- expanded master spectrogram/stereo views.

Exit criteria:

- probes are signal-transparent;
- probe count/FFT budget enforced;
- source-to-master path trace correctly represents graph metadata;
- A/B switching de-clicks.

## Phase 11 — Automation, randomization and offline rendering

Goals:

- automation lane model and frame-based playback;
- gesture capture/editor;
- safe mutation/chaos mode/locks;
- realtime recording;
- offline deterministic renderer Worker;
- WAV 16/24/32f encoding;
- render progress/cancel/tail handling.

Exit criteria:

- automation ordering matches specification;
- deterministic seeded offline render fixture repeats;
- WAV headers/data validated;
- cancelled render frees resources;
- randomization is fully undoable and cannot bypass graph validation.

## Phase 12 — Learning Mode and lessons

Goals:

- parameter help metadata presentation;
- data-driven lesson engine;
- 20 required initial lessons;
- lesson sandbox/restore behavior;
- integration with signal flow/probes/compare tools.

Exit criteria:

- each lesson operates on real patch state;
- lesson exits can restore original patch;
- no lesson requires MIDI;
- content audit covers required synthesis concepts.

## Phase 13 — Accessibility and responsive completion

Goals:

- keyboard navigation audit;
- ARIA/value text;
- non-color signal cues;
- reduced motion;
- high contrast;
- tablet drawers/workspace;
- phone Performance/Patch Navigator/Selected Module/Learn flows;
- touch cable fallback flow.

Exit criteria:

- automated accessibility checks plus manual keyboard audit pass agreed gate;
- reduced-motion E2E works;
- Playwright desktop/tablet/mobile flows pass.

## Phase 14 — Performance optimization and long-session QA

Work:

- benchmark reference hardware tiers;
- optimize buffer reuse;
- profile graph runtime and visual scheduler;
- tune FFT/probe cadence;
- establish ECO/NORMAL/HIGH quality settings;
- 1–4 hour soak sessions;
- repeated graph swap/probe add-remove leak testing;
- high-polyphony and heavy-modulation stress tests.

Exit criteria:

- documented recommended polyphony/quality limits;
- no unbounded memory growth;
- normal reference patch stays below sustained render deadline;
- overload degradation order follows specification.

## Phase 15 — Cross-browser and GitHub Pages beta

Release-gate work:

- Chromium current stable;
- Firefox current stable;
- Safari where available;
- Web MIDI unsupported/permission-denied cases;
- mobile browser spot checks;
- GitHub Pages `/visualsynth/` asset/base-path validation;
- secure-context AudioWorklet validation;
- no-backend/no-tracking network audit.

Exit criteria:

- all BETA matrix rows have evidence or explicitly approved deferral;
- release blocker list is clear;
- deployment smoke test passes.

## Phase 16 — Documentation and beta release

Produce/update:

- `docs/ARCHITECTURE.md` summary/link to canonical spec;
- `docs/USER_GUIDE.md`;
- `docs/MODULE_REFERENCE.md`;
- `docs/MODULATION_GUIDE.md`;
- `docs/LEARNING_GUIDE.md`;
- `docs/PATCHING_GUIDE.md`;
- `docs/MIDI.md`;
- `docs/DEVELOPMENT.md`;
- `docs/TESTING.md`;
- `docs/TROUBLESHOOTING.md`.

Final checks:

- screenshots/docs match current UI;
- all factory presets/templates load;
- requirements matrix audited against shipped implementation;
- known limitations documented;
- version tagged as first beta only after acceptance gates pass.

## 17. Suggested implementation slices

Within each phase, prefer vertical slices that are independently testable. For example, implement oscillator metadata -> runtime DSP -> patch serialization -> module UI -> visualization -> tests as one coherent slice rather than creating dozens of empty modules first.

## 18. Testing strategy by layer

### Pure unit tests

Graph validation, migrations, parameter transforms, oscillator/filter/envelope math, random determinism, voice allocation, MIDI transforms, WAV encoding.

### Integration tests

Graph compile/runtime execution, graph swaps, poly voice routes, feedback, probe insertion, offline/realtime equivalence.

### Browser E2E

Workspace actions, controls, input, save/load, undo/redo, MIDI UI feature detection, lessons, accessibility, responsive layouts.

### Performance tests

Benchmark patches checked into `tests/perf/fixtures/` with machine/browser/sample-rate metadata recorded alongside results.

## 19. Branch/CI guidance

Before implementation begins, establish CI jobs for:

1. typecheck/lint;
2. unit tests;
3. browser tests where practical;
4. production build;
5. factory patch validation;
6. later, benchmark smoke thresholds that detect catastrophic regressions rather than fragile exact timings.

GitHub Pages deployment should consume only a successfully built artifact.

## 20. MVP milestone definition

MVP ends after Phase 6 when a user can build, play, see, save and reload a polyphonic modular subtractive synth with modulation, typed cables, meaningful module visuals, master analysis, undo/redo, panic and diagnostics.

This is intentionally broader than a sound-producing prototype because the defining VisualSynth concept is inseparable from visualization and patchability.

## 21. Beta milestone definition

Beta ends after Phases 7–16 and must demonstrate the product differentiators: rich modulation, advanced oscillators/effects, probes, visual signal flow, MIDI/performance controls, learning tools, automation/rendering, responsive/accessibility work and evidence-based performance limits.

## 22. Deferred work after beta

- granular synthesis;
- spectral synthesis/editing;
- physical modeling;
- convolution asset library;
- external audio input;
- MPE/MIDI 2.0;
- Scala/microtuning UI/import;
- optional SharedArrayBuffer fast path;
- any backend/cloud/collaboration feature.

These may be added only through new requirement IDs and patch/module version planning.