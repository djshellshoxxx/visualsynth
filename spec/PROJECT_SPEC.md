# VisualSynth Project Specification

Status: Specification v1.0-draft

## 1. Executive summary

VisualSynth is a static browser application that functions first as a serious playable synthesizer and modular synthesis environment, and second as a visual/educational system for understanding synthesis. It runs locally in the browser, requires no account or backend, and is designed for GitHub Pages deployment.

The system exposes sound construction as a typed modular graph. Modules are visible panels with inputs, outputs, parameters, modulation, and a meaningful visualization. The audio engine compiles the graph into an immutable runtime representation processed inside an AudioWorklet. Polyphony is represented visually as one patch while voice-scoped modules are replicated internally. Global effects, analyzers, probes and output modules operate after or around the voice mix boundary.

## 2. Product vision

VisualSynth should make synthesis observable without making it simplistic. A user should be able to build a patch, play it from a computer keyboard, on-screen keyboard, sequencer, or MIDI controller, and inspect what each stage is doing to the sound.

A beginner should be able to start from a template and understand oscillator -> filter -> envelope/VCA -> output. An experienced user should be able to ignore Learning Mode and still use modulation, polyphony, wavetable/additive/FM/PM techniques, effects, sequencers, macros, automation, probes, recording and patch export.

## 3. Design philosophy

1. Audio correctness and responsiveness have priority over animation.
2. Real DSP state is visualized wherever practical.
3. Important routing is explicit rather than hidden.
4. Modulation must be visible at source, route and destination.
5. Common patches should be easy; advanced patches should remain possible.
6. A patch must not change semantic meaning when Beginner/Normal/Advanced UI modes change.
7. The audio engine must survive invalid edits, extreme settings and recoverable module errors without emitting NaN/Infinity or uncontrolled output.
8. The system must remain fully usable without Web MIDI.
9. Static GitHub Pages hosting is a hard deployment constraint.
10. No implementation requirement may depend on a backend service.

## 4. User types

### Beginner learner
Needs templates, large visuals, explanations, guided lessons, safe defaults and clear signal flow.

### Musician/sound designer
Needs low-latency playability, reliable patch recall, expressive modulation, MIDI mapping, macros, effects, recording and useful presets.

### Modular synthesis user
Needs explicit typed routing, audio/control-rate modulation, feedback with defined latency, probes, utilities and flexible patch construction.

### Educator/student
Needs stable demonstrations, Compare Mode, signal inspection, labels, lesson scripts, scope freezing and repeatable patches.

### Experimental user
Needs random/chaos sources, mutation, unusual modulation, mathematical/custom waves, feedback, spectral/harmonic tools and generative sequencing.

## 5. Primary use cases

- Build a subtractive synth from modules.
- Create and play polyphonic bass, lead, pad, pluck and keys patches.
- Design FM/PM/AM/ring-modulated sounds.
- Draw/edit harmonic or wavetable content.
- Build rhythmic/generative patches.
- Inspect any cable with a Scope Probe or Control Probe.
- Compare two processing states visually and audibly.
- Map MIDI CC to controls using MIDI Learn.
- Record or offline-render the master output.
- Save/share/export/import complete patches.
- Follow interactive synthesis lessons that manipulate the real patch.

## 6. Technology decisions

TECH-001: The application SHALL be implemented as a static client-side web application deployable under `/visualsynth/`.

TECH-002: The implementation SHOULD use TypeScript and Vite, with no mandatory runtime UI framework.

TECH-003: Custom synthesis DSP SHALL execute inside AudioWorklet.

TECH-004: SharedArrayBuffer SHALL NOT be required by the baseline architecture.

TECH-005: Canvas 2D SHALL be the default visualization renderer. SVG or one overlay Canvas MAY be used for patch cables. WebGL/WebGPU SHALL only be introduced after profiling demonstrates a material need.

TECH-006: IndexedDB SHALL store user patch libraries. JSON files SHALL support portable import/export.

## 7. Audio architecture requirements

AUD-ENG-001: The app SHALL create one long-lived AudioContext after explicit user interaction and SHALL not repeatedly destroy/recreate it for patch edits.

AUD-ENG-002: A primary AudioWorkletNode SHALL host the compiled modular DSP runtime.

AUD-ENG-003: Topology changes SHALL be compiled outside the sample loop and swapped atomically at a render boundary.

AUD-ENG-004: Parameter-only edits SHALL not require graph recompilation.

AUD-ENG-005: The engine SHALL expose panic, suspend/resume, master mute, diagnostics and recoverable error reporting.

AUD-ENG-006: Realtime and offline rendering SHALL share the same DSP algorithms and GraphIR semantics.

## 8. Modular graph requirements

DSP-GRAPH-001: Every module SHALL have a stable ID, type ID, version, scope, parameter set, input ports, output ports and serialized UI state.

DSP-GRAPH-002: Every connection SHALL reference a source module/port and destination module/port and SHALL carry a declared signal class.

DSP-GRAPH-003: The compiler SHALL reject incompatible port connections before they reach the audio runtime.

DSP-GRAPH-004: Zero-delay cycles SHALL be rejected.

DSP-GRAPH-005: Cycles SHALL be legal only if the strongly connected component contains at least one operator with declared positive delay.

DSP-GRAPH-006: Graph edits SHALL preserve compatible module runtime state by stable ID.

DSP-GRAPH-007: Module deletion SHALL remove or invalidate attached connections deterministically and SHALL be one undoable transaction.

## 9. Signal classes

SIG-AUDIO-001: `AUDIO` signals represent mono/stereo floating audio streams.

SIG-CONTROL-001: `CONTROL` signals represent continuous modulation values and declare bipolar/unipolar/domain metadata.

SIG-PITCH-001: `PITCH` signals represent note pitch as floating MIDI-note numbers internally unless a module explicitly declares another pitch unit.

SIG-GATE-001: `GATE` signals represent held logical state plus transitions.

SIG-TRIG-001: `TRIGGER` signals represent timestamped impulse events.

SIG-CLOCK-001: `CLOCK` signals represent tempo-synchronous tick/event streams.

SIG-EVENT-001: `EVENT` signals represent timestamped note/MIDI/sequencer messages.

Connections SHALL visually distinguish signal class by color plus non-color cue (port icon/cable pattern/label).

## 10. Polyphony requirements

VOICE-001: Modules SHALL declare scope capability: `VOICE`, `GLOBAL`, `EFFECT`, `UTILITY`.

VOICE-002: Voice-scoped modules SHALL be instantiated per active voice.

VOICE-003: VOICE -> VOICE connections SHALL preserve voice lanes.

VOICE-004: GLOBAL control -> VOICE SHALL broadcast to all voices.

VOICE-005: VOICE audio -> GLOBAL SHALL sum voices at an explicit compiler-generated or user-visible voice-mix boundary.

VOICE-006: VOICE control -> GLOBAL SHALL require an explicit reducer utility.

VOICE-007: Default maximum polyphony SHALL be configurable with a target range of 1–32 voices; the implementation MAY clamp lower on constrained devices.

VOICE-008: Voice stealing SHALL prioritize released/low-energy voices before active sustained voices and SHALL de-click stolen voices.

VOICE-009: Mono, legato, poly and unison modes SHALL be supported.

## 11. Parameter requirements

PARAM-001: All parameters SHALL be declared through centralized metadata.

PARAM-002: Metadata SHALL include ID, name, unit, min, max, default, curve, step, formatter, modulatable, automatable, MIDI-mappable, rate, smoothing and educational text.

PARAM-003: Continuous audible parameters SHALL apply smoothing unless explicitly marked sample-accurate/discrete.

PARAM-004: A destination with modulation SHALL display base value, modulation range and live effective value.

PARAM-005: Multiple modulation sources SHALL combine through a deterministic ordered rule documented in ARCHITECTURE.md.

PARAM-006: Discrete enum parameters SHALL not accept arbitrary continuous audio-rate modulation unless a module explicitly defines a mapping.

## 12. Modulation requirements

MOD-001: Nearly every meaningful continuous parameter SHALL be a modulation target unless DSP or UX constraints make modulation nonsensical.

MOD-002: Modulation assignments SHALL support amount, polarity, scale and optional curve/range restriction.

MOD-003: The UI SHALL support cable-based modulation. Direct drag-and-drop assignment MAY be provided as a shortcut but SHALL create the same underlying routing object.

MOD-004: LFO/envelope/control cables SHALL visibly indicate activity without requiring 60 Hz updates.

MOD-005: Audio-rate modulation SHALL be supported for oscillator FM/PM, VCA amplitude, ring modulation and other explicitly audio-rate capable destinations.

## 13. Core synthesis requirements

AUD-OSC-001: Core oscillator waveforms SHALL include sine, triangle, saw, reverse saw, square, pulse and sub oscillator.

AUD-OSC-002: Standard/advanced oscillator modes SHALL include variable shape, supersaw/multi-saw, additive/harmonic editor, wavetable and user-defined waveform support.

AUD-OSC-003: Discontinuous oscillator shapes SHALL use band-limiting/anti-aliasing appropriate to the algorithm.

AUD-FILTER-001: Core filter SHALL support low-pass, high-pass, band-pass and notch with cutoff, Q/resonance and modulation.

AUD-FILTER-002: Standard filter SHALL add selectable slope, drive, wet/dry, key tracking and multimode output.

AUD-ENV-001: ADSR SHALL be core and visual.

AUD-ENV-002: Multi-stage/looping/drawable envelopes SHALL be Standard or Advanced.

AUD-LFO-001: LFO SHALL support sine, triangle, square, saw, reverse saw, sample-and-hold, smooth random and stepped random.

AUD-VCA-001: VCA SHALL support gain, control input, polarity where appropriate, mute and visualization of input/output level.

AUD-MIX-001: Mixer SHALL support multiple inputs, gain, mute, solo, pan, polarity and result visualization.

## 14. Effects requirements

FX-001: Beta SHALL include delay, chorus/flanger/phaser, distortion/waveshaping, EQ, compressor and reverb.

FX-002: Delay SHALL support tempo sync, feedback, filtering and ping-pong mode.

FX-003: Reverb SHALL use a browser-efficient algorithm and SHALL not require large convolution downloads.

FX-004: Nonlinear processors SHALL implement localized anti-aliasing/oversampling where required by quality mode.

FX-005: Effect wet/dry controls SHALL avoid phase-invalid dry/wet behavior and SHALL use equal-power or algorithm-appropriate mixing.

## 15. Sequencing/generative requirements

SEQ-001: Beta SHOULD include step, gate and modulation sequencers.

SEQ-002: Probability and Euclidean rhythm modules SHALL be Standard/Advanced.

SEQ-003: Sequencers SHALL emit typed PITCH/GATE/TRIGGER/CONTROL/CLOCK outputs rather than behaving as a DAW timeline.

SEQ-004: Internal transport SHALL expose BPM, play/stop, reset, bar/beat phase and swing where applicable.

## 16. Master/output requirements

MASTER-001: Exactly one active master output path SHALL feed the browser destination; multiple output modules MAY be merged explicitly before master.

MASTER-002: Master SHALL provide volume, mute, panic, peak/RMS, clip indicator, oscilloscope and FFT spectrum.

MASTER-003: Spectrogram and stereo/phase views SHALL be Beta targets and MAY reduce refresh rate under load.

MASTER-004: Master output SHALL apply final finite-value protection, DC protection and emergency limiting/clamping sufficient to prevent runaway digital values.

## 17. Visualization requirements

VIS-001: Every major module SHALL have a meaningful visualization.

VIS-002: Visualizations SHALL distinguish predicted/state-derived displays from measured/signal-derived displays where the distinction matters.

VIS-SCOPE-001: Users SHALL be able to attach a Scope Probe to audio cables.

VIS-CTRL-001: Users SHALL be able to attach a Control Probe to modulation/control routes.

VIS-SCHED-001: One centralized scheduler SHALL control visualization refresh.

VIS-SCHED-002: Offscreen/collapsed visuals SHALL update at reduced rates or freeze.

VIS-SCHED-003: Visualization overload SHALL degrade graphics before it can threaten audio rendering.

## 18. Playability/MIDI requirements

MIDI-001: Web MIDI SHALL be feature-detected and permission-requested only after user interaction.

MIDI-002: MIDI note on/off, velocity, pitch bend, mod wheel, sustain and common CC mapping SHALL be supported when supplied by the device/browser.

MIDI-003: MIDI Learn SHALL bind a hardware control to a parameter through the centralized parameter system.

MIDI-004: The app SHALL remain fully playable without Web MIDI.

KEY-001: Computer keyboard mode SHALL provide chromatic note mapping, octave shifting and visible pressed-note state.

KEY-002: On-screen keyboard SHALL support pointer/touch interaction and velocity approximation where practical.

## 19. Patch/preset requirements

PATCH-001: Patch documents SHALL use a versioned JSON format.

PATCH-002: Patch loading SHALL validate before replacing the current patch.

PATCH-003: Failed imports SHALL not destroy the current working patch.

PATCH-004: Migrations SHALL upgrade older schema versions sequentially and deterministically.

PATCH-005: User patches SHALL be exportable/downloadable and importable locally.

PATCH-006: IndexedDB SHALL hold the user patch library.

PRESET-001: Factory presets SHALL be grouped into instruments, bass, leads, pads, plucks, keys, percussion, drones, FX, experimental, generative and educational categories.

PRESET-002: Factory templates SHALL include basic subtractive, two-oscillator analog, supersaw, FM, AM, PWM, bass, lead, pad, drone, noise percussion, kick, snare, hi-hat, generative ambient and experimental modulation examples.

## 20. Randomization requirements

RAND-001: Module and patch randomization SHALL be undoable.

RAND-002: Parameters SHALL be lockable against randomization.

RAND-003: `Musically Safe` randomization SHALL honor parameter-specific safe ranges and routing constraints.

RAND-004: `Chaos` mode MAY use full legal ranges but SHALL still obey DSP numerical safety limits.

## 21. Undo/redo requirements

UNDO-001: Add/remove/move module, connect/disconnect cable, parameter edit, modulation edit, preset load and randomization SHALL be undoable.

UNDO-002: Continuous pointer drags SHALL coalesce into one history transaction from pointer-down to pointer-up.

UNDO-003: History SHALL store patch-state commands/diffs, not raw DSP runtime objects.

## 22. Recording/export requirements

REC-001: Realtime master recording SHALL be supported.

REC-002: Offline WAV rendering SHALL support 44.1, 48 and 96 kHz where device memory allows.

REC-003: WAV formats SHALL include 16-bit PCM, 24-bit PCM and 32-bit float.

REC-004: Long render/record tasks SHALL report progress and allow cancellation.

REC-005: Offline output SHALL use the same GraphIR semantics and DSP implementations as realtime.

## 23. Automation requirements

AUTO-001: Continuous parameter automation SHALL support recorded gestures and editable points/curves.

AUTO-002: Automation SHALL be evaluated before modulation or at a precisely documented stage; VisualSynth chooses: `base preset value -> automation value -> modulation sum/transform -> clamp -> smoothing as applicable`.

AUTO-003: Automation playback SHALL be frame/timeline based and independent of UI refresh.

## 24. Learning Mode requirements

EDU-001: Learning Mode SHALL be optional and never required to operate the synth.

EDU-002: Parameter help SHALL include meaning, audible effect, useful range, what to listen for and related concepts.

EDU-003: Interactive lessons SHALL manipulate actual patch state and SHALL be reversible/resettable.

EDU-004: Initial lesson set SHALL cover waveform, frequency/pitch, amplitude, harmonics, oscillator mixing, phase, detune, filter, resonance, ADSR, LFO, FM, AM, PWM, subtractive, additive, wavetable, signal routing, effects and building a patch.

EDU-005: Visual Signal Flow Mode SHALL highlight the active route from source to master and show stage-specific visual state.

EDU-006: Compare Mode SHALL support A/B comparisons such as dry/wet, one/two oscillators, filtered/unfiltered and phase variants.

## 25. UI complexity modes

GUI-MODE-001: Beginner, Normal and Advanced modes SHALL be views of the same patch model, not different patch formats.

GUI-MODE-002: Beginner mode MAY hide advanced modules/parameters but SHALL never silently alter them.

GUI-MODE-003: Advanced mode SHALL expose graph diagnostics, scope/probe settings, rate/quality controls and advanced modulation.

## 26. Mobile requirements

MOBILE-001: Desktop is the primary authoring target.

MOBILE-002: Tablet SHALL support meaningful patch editing, performance and learning.

MOBILE-003: Phone SHALL support playback, presets, keyboard/pads, parameter editing and small patch edits; very large graph editing MAY use simplified navigation.

MOBILE-004: Controls SHALL use Pointer Events and touch-appropriate hit targets.

## 27. Accessibility requirements

A11Y-001: Important controls SHALL be keyboard reachable and have accessible names.

A11Y-002: Numeric/text values SHALL accompany visual-only data where practical.

A11Y-003: Signal class/state SHALL not rely on color alone.

A11Y-004: Reduced-motion preference SHALL suppress cable pulsing and nonessential animation.

A11Y-005: High-contrast mode SHALL preserve routing and focus visibility.

## 28. Diagnostics/performance requirements

PERF-001: Diagnostics SHALL expose sample rate, context state, base/output latency where available, active voices, active modules, connection count, visualization load, engine timing/load estimate, MIDI devices and recent engine errors.

PERF-002: `Copy Diagnostics` and `Download Diagnostics JSON` SHALL exclude patch names/content unless explicitly requested by the user.

PERF-003: The engine SHALL monitor render-time budget statistically without performing expensive per-sample timing calls.

PERF-004: Quality tiers SHALL allow reduction of visual refresh, FFT size, supersaw voice count, reverb density and localized oversampling before reducing note polyphony where possible.

## 29. Error handling requirements

ERR-001: Invalid patch edits SHALL be rejected with a human-readable reason while retaining the last valid running graph.

ERR-002: Worklet processor failure SHALL mute output, report the failure and permit engine restart without page reload where possible.

ERR-003: Invalid imported patches SHALL be quarantined from the live engine.

ERR-004: Unknown future module types SHALL be represented as disabled placeholders preserving serialized data rather than silently discarded.

## 30. DSP safeguards

SAFE-001: Every module boundary SHALL prevent NaN/Infinity propagation.

SAFE-002: The master SHALL provide DC blocking/protection and an emergency amplitude guard.

SAFE-003: Resonance/feedback parameters SHALL have algorithm-specific stability limits.

SAFE-004: Feedback paths SHALL require explicit delay.

SAFE-005: PANIC SHALL immediately silence active voices, clear pending note/gate events, force master gain to zero, and reset unstable runtime state.

## 31. Tuning

TUNE-001: 12-TET with adjustable A4 reference SHALL be supported.

TUNE-002: Pitch shall be represented internally so microtuning/Scala support can be added without redesigning oscillators or note routing.

## 32. Deployment

DEPLOY-001: Production build SHALL function under `/visualsynth/` without root-relative breakage.

DEPLOY-002: No backend, account, telemetry or upload service SHALL be required.

DEPLOY-003: The deployment SHALL be HTTPS and compatible with AudioWorklet secure-context requirements.

DEPLOY-004: A GitHub Actions workflow SHOULD run tests and build before Pages deployment.

## 33. Testing requirements

TEST-DSP-001: Unit tests SHALL cover oscillators, filters, envelopes, LFOs, modulation, mixing, waveshaping, sequencing, smoothing, voice allocation, MIDI transforms and numerical safeguards.

TEST-GRAPH-001: Unit/integration tests SHALL cover connection compatibility, graph compile order, legal/illegal cycles, scope transitions, hot insertion/deletion and state migration.

TEST-UI-001: Browser tests SHALL cover module creation/deletion/movement, cable connect/disconnect, knob/pointer/touch operation, keyboard play, MIDI UI, preset management, undo/redo, Learning Mode and probes.

TEST-PERF-001: Performance scenarios SHALL cover high oscillator count, heavy modulation, max configured polyphony, multiple scopes, FFT/spectrogram load and long-running sessions.

TEST-BROWSER-001: Chromium and Firefox SHALL be release-gate browsers. Safari SHALL be tested where reasonably available, with unsupported Web MIDI handled gracefully.

## 34. Versioning strategy

- Application semantic version: `major.minor.patch`.
- Patch schema version: integer, migrated sequentially.
- Module state version: integer per module type.
- GraphIR version: internal integer, never serialized as the portable patch contract.

## 35. MVP requirements

The MVP SHALL demonstrate the defining concept, not merely produce sound. It includes:

- keyboard/on-screen note input;
- polyphonic voice allocator;
- oscillator(s);
- mixer;
- multimode filter;
- ADSR;
- VCA;
- LFO;
- typed patch cables;
- audio/control modulation;
- per-module meaningful visuals;
- master scope and spectrum;
- save/load/export/import;
- undo/redo;
- several templates/presets;
- panic and diagnostics.

## 36. Beta requirements

The first serious beta adds:

- richer oscillator set including wavetable/additive/supersaw;
- FM/PM/AM/ring modulation;
- delay/reverb/modulation effects/distortion/EQ/compressor;
- MIDI + MIDI Learn;
- scope/control probes;
- Visual Signal Flow Mode;
- Compare Mode;
- learning help and initial interactive lessons;
- sequencers/arpeggiator;
- macros/XY pad;
- automation;
- recording/offline WAV;
- randomization/mutation;
- performance/quality controls;
- expanded preset/template library.

## 37. Future features

- Scala import and microtuning editor;
- spectral oscillator/editor;
- granular synthesis modules;
- physical modeling modules;
- convolution reverb as optional downloadable asset feature;
- WebGPU spectrogram/visual compute path;
- collaborative/shared online patch service, only if a backend is intentionally introduced later;
- external audio input, subject to permission/privacy design;
- MPE/MIDI 2.0 when browser support is sufficiently mature;
- optional SharedArrayBuffer fast path under a compatible deployment configuration.

## 38. Explicitly rejected/deferred features

- Full DAW arrangement/timeline: rejected for initial product direction.
- Backend accounts/cloud library: rejected for baseline.
- Mandatory WebGL/WebGPU: rejected.
- Mandatory SharedArrayBuffer: rejected.
- Unbounded arbitrary zero-delay feedback: rejected.
- Per-module independent animation loops: rejected.
- Copying a commercial synth's UI or proprietary behavior: rejected.
- Large required convolution impulse-response packs: deferred.

## 39. Acceptance principle

A feature is not complete merely because it sounds correct. For any major sound-affecting module, acceptance requires both:

1. correct/usable DSP behavior; and
2. a visual representation that materially explains source, transformation, modulation or result.

Likewise, a visualization is not complete if it is decorative and does not correspond to parameter state or measured signal state.
