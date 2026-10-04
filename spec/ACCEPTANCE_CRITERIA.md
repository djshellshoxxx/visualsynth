# VisualSynth Acceptance Criteria

## 1. General completion rule

A feature is accepted only when its functional behavior, audible behavior where applicable, persistence behavior, UI feedback, error behavior, tests and relevant visualization all satisfy the specification. A feature that exists only as a control with no working DSP, or only as DSP with no required visibility/routing support, is incomplete.

## 2. Architecture acceptance

The architecture is accepted when:

1. The app can start one long-lived AudioContext and AudioWorklet after user interaction.
2. A valid patch compiles to GraphIR and runs without building one browser AudioNode per module.
3. Parameter-only edits reach the running engine without recompiling the graph.
4. Topology changes compile in staging and atomically replace the previous graph.
5. A failed graph compile leaves the previous graph audible and editable.
6. Compatible runtime state survives topology edits by stable module ID.
7. Zero-delay cycles are rejected with module/connection-specific errors.
8. A feedback cycle containing Feedback Delay is accepted and causal.
9. Worklet processor failure mutes output and supports restart without page reload where browser behavior permits.
10. Offline engine can execute the same GraphIR semantics as realtime.

## 3. MVP acceptance

The MVP is accepted only when all of the following work together in a deployed static build.

### Playable synthesis

- Computer keyboard and on-screen keyboard can play notes.
- Polyphonic mode supports at least 8 stable voices on reference desktop hardware.
- Note Input produces pitch/gate/velocity lanes.
- Oscillator supports sine, triangle, saw, reverse saw, square and pulse.
- Oscillator pitch tracks notes correctly and discontinuous shapes use anti-aliasing.
- ADSR controls VCA amplitude per voice.
- Mixer combines at least two oscillators/signals.
- Multimode filter supports LP/HP/BP/notch and visible cutoff/resonance response.
- LFO can modulate filter cutoff and oscillator pitch/shape.
- Master Output produces stereo sound with gain, mute, panic, peak/RMS and clip indication.

### Modular workspace

- Modules can be added, moved, duplicated and deleted.
- Typed ports and cables can be connected/disconnected.
- Incompatible connections are prevented and explain why.
- Fan-out works.
- Supported fan-in works according to port policy.
- Voice->global audio boundary functions correctly.
- Cable deletion/module deletion is undoable.

### Visualization

- Oscillator waveform reflects waveform selection.
- Envelope graph reflects ADSR and shows live stage position.
- Filter response reflects actual parameter changes.
- LFO waveform/phase is visible.
- Mixer shows input contribution/result at least at level/waveform summary level.
- Master oscilloscope and FFT respond to actual output.
- One centralized scheduler controls visuals.
- Hiding/collapsing/offscreening visual modules reduces update work.

### Persistence/history

- Patch saves to IndexedDB.
- JSON export/import round-trips a test patch.
- Invalid import cannot replace current patch.
- Undo/redo covers add/remove/connect/disconnect/parameter edit/module move.
- Continuous knob drag produces one undo transaction.

### Stability

- Panic silences output under normal and intentionally unstable test patches.
- Fuzzed legal parameter values do not propagate NaN/Infinity to master output.
- Audio continues when visualization is artificially throttled.
- App works when Web MIDI is unavailable.

### Deployment

- Production build runs from `https://djshellshoxxx.github.io/visualsynth/` or an equivalent Pages preview using `/visualsynth/` base path.
- No backend requests are required for synthesis, saving, presets or rendering.
- No tracking/analytics requests exist.

## 4. Beta acceptance

Beta includes all MVP criteria plus the following.

### Expanded synthesis

- Additive/Harmonic Oscillator is functional with editable harmonics.
- Wavetable Oscillator is functional with morphing and anti-aliased mip/table selection.
- Supersaw functions with deterministic phase/spread and quality-tier voice count.
- FM/PM/AM/ring modulation examples work at audio rate.
- Multi-stage envelope supports looping and direct graph editing.
- Noise Generator supports white/pink/brown and at least one additional color.

### Effects

- Delay supports free/sync time, feedback, filtering and ping-pong.
- Chorus/Flanger and Phaser work and expose visible modulation.
- Reverb produces stable decays with size/decay/damping/pre-delay/mix.
- Waveshaper/Distortion exposes transfer curve and oversampling mode where required.
- Parametric EQ exposes interactive exact response curve.
- Compressor exposes transfer curve and measured gain reduction.
- Stereo Utility provides pan/width/mono/M-S or equivalent documented modes.

### MIDI/performance

- Web MIDI feature detection and permission flow are functional in supported browsers.
- Note on/off, velocity, pitch bend, mod wheel and sustain work.
- MIDI Learn can map CC to a parameter with min/max/invert/curve.
- Device disconnect does not leave stuck notes.
- Computer/on-screen input remains usable in browsers without MIDI support.

### Probes and analysis

- Scope Probe can attach to arbitrary audio connection and is signal-transparent.
- Control Probe can display LFO/envelope/control route history.
- Probe deletion/connection deletion removes instrumentation cleanly.
- Master supports oscilloscope, spectrum and at least one of spectrogram/stereo phase views.
- Advanced Signal Inspector exposes peak/RMS/DC and selected spectral metrics.

### Learning/demonstration

- Learning Mode can be enabled/disabled without patch semantic change.
- Core parameter help is populated for all MVP modules.
- At least the 20 specified lessons exist and manipulate actual patch state.
- Visual Signal Flow Mode traces a real source-to-master path.
- Compare Mode supports at least module bypass A/B and parameter snapshot A/B.

### Sequencing/modulation

- Step Sequencer, Gate/Mod Sequencer and Arpeggiator operate from sample-frame transport timing.
- Probability and Euclidean rhythm modules pass timing/determinism tests.
- Macro and XY Pad can control multiple targets.
- Voice Reduce explicitly handles poly control -> global conversion.

### Automation/recording

- Parameter gesture recording and point/curve playback work.
- Automation timing is engine-frame based, not animation-frame based.
- Realtime record produces valid audio file/output path defined by implementation.
- Offline render produces valid 44.1/48/96 kHz WAV at 16/24/32f where supported by memory limits.
- Offline render can be cancelled and reports progress.
- Seeded random patch renders deterministically for same app/DSP version and settings.

### Randomization

- Module randomization is undoable.
- Parameter locks are honored.
- Safe mutation uses declared safe ranges.
- Chaos mutation still cannot create structurally invalid or numerically unsafe state.

### Responsive/accessibility

- Desktop Chromium/Firefox are release gates.
- Tablet layout supports patch editing and performance.
- Phone layout supports performance, presets and selected-module editing.
- Keyboard navigation works for primary controls.
- Important controls have accessible names/value text.
- Signal types do not depend on color alone.
- Reduced-motion mode suppresses cable motion/nonessential animation.

## 5. Performance acceptance

Reference hardware tiers must be defined during implementation and recorded in benchmark docs. Until then, these are behavioral gates rather than fixed hardware claims.

### Audio deadline behavior

- No sustained audible dropouts in a standard 16-voice subtractive patch on reference desktop tier.
- A simple 32-voice patch is benchmarked and either passes or the product UI states the measured recommended limit.
- Heavy patch overload produces visible warning before catastrophic behavior where measurable.
- Visualization load is reduced before adaptive audio-quality changes.

### Visual performance

- Standard patch targets 30–60 fps UI on reference desktop.
- Under stress, visual update may fall to 15 fps while audio remains stable.
- Offscreen modules do not run full-rate waveform renderers.
- Multiple scopes share scheduler/analysis infrastructure.

### Memory

- Long session memory usage does not grow without bound from discarded graphs, probes, recordings, histories or visual buffers.
- Graph swaps retire old runtime state.
- Cancelled renders/recordings release buffers.

## 6. DSP acceptance details

### Oscillators

- Frequency accuracy <0.1 cent for stable tone test where practical.
- Sine output has no unexpected clipping/DC.
- Saw/square/pulse alias energy is materially lower than naive waveform reference under spectral test.
- Pulse width extremes remain finite.
- Additive partials above Nyquist are culled.
- Wavetable morph does not introduce unintended discontinuity beyond designed frame content.

### Envelopes/LFO

- Sample-exact stage duration within one sample for fixed unsmoothed timing tests.
- Zero-time stages are valid and do not divide by zero.
- LFO sync remains phase-coherent under transport start/reset rules.
- Random forms repeat with same seed.

### Filters

- Core filter response matches reference coefficient model within tolerance documented by tests.
- Cutoff remains stable near allowed low/high limits.
- Resonance extreme remains finite.
- Audio-rate cutoff modulation does not corrupt state.

### Nonlinear effects

- Transfer curves match displayed function.
- Oversampled mode reduces measured alias content for selected reference signals.
- No oversampling mode changes DC/gain unexpectedly beyond documented tolerance.

### Delay/reverb

- Integer delay tests return exact delayed impulse timing.
- Fractional delay stays bounded.
- Feedback decay is stable within allowed settings.
- Reverb tail decays and does not accumulate NaN/DC.

### Master

- Peak/RMS tests match reference calculations.
- Clip indicator triggers at defined threshold.
- DC guard materially reduces sustained DC test signal while preserving normal low-frequency audio within specified tolerance.

## 7. Graph acceptance fixtures

Required fixture patches:

1. Basic subtractive mono.
2. Basic subtractive 8-voice poly.
3. Two oscillators -> mixer -> filter -> VCA.
4. Global LFO broadcast to per-voice oscillator.
5. VOICE audio -> global effect.
6. Illegal VOICE control -> GLOBAL direct route.
7. Same route through Voice Reduce.
8. Illegal zero-delay feedback.
9. Legal feedback with Unit/Feedback Delay.
10. Parallel fan-out.
11. Multi-input mixer fan-in.
12. Module deletion with attached cables/probe.
13. Hot oscillator insertion while note held.
14. Filter replacement while note held.
15. Missing-module imported patch.

Each fixture has expected compile result and, where applicable, deterministic output assertions.

## 8. Patch format acceptance

- All factory patches validate/compile in CI.
- Every schema migration has before/after fixture.
- Current patch -> canonical serialize -> parse -> validate preserves semantic hash.
- Unknown top-level extension data is preserved according to schema policy.
- Unknown module data is preserved in placeholder rather than silently lost.
- NaN/Infinity/nonfinite numbers are rejected.
- Oversized structures hit clear import limits.
- Custom Function AST cannot execute arbitrary JavaScript/global access.

## 9. Learning content acceptance

A lesson passes when:

- it launches from a known patch state;
- instructions identify actual UI targets;
- expected-condition checks correspond to real patch state;
- demonstration commands are undoable/reversible;
- lesson exit can restore prior patch;
- content names the audible effect and visual evidence;
- no lesson requires Web MIDI.

## 10. Documentation acceptance

Before beta, repository must contain and keep current:

- README.md
- docs/ARCHITECTURE.md or the canonical `spec/ARCHITECTURE.md` linked from docs
- docs/USER_GUIDE.md
- docs/MODULE_REFERENCE.md
- docs/MODULATION_GUIDE.md
- docs/LEARNING_GUIDE.md
- docs/PATCHING_GUIDE.md
- docs/MIDI.md
- docs/DEVELOPMENT.md
- docs/TESTING.md
- docs/TROUBLESHOOTING.md
- research/RESEARCH.md
- research/REFERENCES.md
- all canonical `spec/` files

During specification phase, the `spec/` documents are authoritative. Implementation-phase user/developer guides may be generated progressively but cannot contradict specs.

## 11. Release blocker conditions

Any of the following blocks beta/release:

- known reproducible NaN/Infinity reaching master output;
- panic cannot silence a known unstable patch;
- invalid import can overwrite current patch;
- zero-delay cycle can compile;
- module/connection delete corrupts unrelated patch state;
- graph edit causes repeated unavoidable loud click beyond specified swap behavior;
- offline export produces corrupt WAV headers/data;
- factory patch fails compile;
- major module has nonfunctional/decorative visualization contrary to its spec;
- deployed Pages build has broken `/visualsynth/` paths;
- primary playback requires MIDI or unsupported browser-only feature;
- undo history changes DSP semantics incorrectly;
- serious memory leak from repeated graph swaps/probe add-remove;
- requirement marked MVP/BETA has no verification evidence.

## 12. Definition of implementation-ready specification

The design phase is complete when:

- product scope and deferred scope are explicit;
- runtime architecture is chosen;
- voice/global behavior is explicit;
- typed routing/fan-in/fan-out/feedback behavior is explicit;
- parameter/modulation rate and combination behavior are explicit;
- module catalogue defines every initial module's contract;
- visualization scheduling/probes are explicit;
- patch format and migration behavior are explicit;
- DSP algorithms/pseudocode cover ambiguous engine behavior;
- development phases are sequenced;
- every significant requirement has a matrix row and verification method;
- specification audit finds no unresolved contradictions/TBDs.
