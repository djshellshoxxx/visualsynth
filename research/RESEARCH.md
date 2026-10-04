# VisualSynth Research Findings

## 1. Research objective

The research phase examined modern modular-synth architecture, browser audio capabilities, polyphony models, modulation timing, visualization strategies, offline rendering, and the existing BrowserToneGen project. The purpose was not to copy a product but to determine a technically defensible architecture for a static, GitHub Pages-hosted modular synthesizer that is both musically useful and visually inspectable.

## 2. BrowserToneGen findings

BrowserToneGen demonstrates several ideas worth preserving at the architectural level:

1. A small main-thread engine object owns the `AudioContext`, loads an `AudioWorklet`, creates analysis/output nodes, sends validated configuration to the worklet, exposes diagnostics, and implements panic/stop behavior.
2. The worklet delegates DSP to a separate pure-JavaScript DSP class instead of mixing UI and signal processing.
3. DSP state is keyed by stable tone IDs so configuration changes can preserve phase/runtime state.
4. The current DSP already uses PolyBLEP-style discontinuity correction for saw/pulse waveforms, deterministic seeded noise, amplitude smoothing, headroom compensation, clipping protection, and peak/RMS reporting.
5. BrowserToneGen separates model/validation, DSP, engine, WAV encoding, and offline export concerns.
6. Its static-file/GitHub Pages model proves that serious browser audio tooling does not require a backend.

VisualSynth should retain these separations but must not retain BrowserToneGen's flat `tones[]` processing model. A modular instrument needs a graph compiler, typed ports, voice-scoped state, graph validation, parameter metadata, explicit feedback rules, and selective signal taps.

## 3. AudioWorklet conclusion

AudioWorklet is the correct baseline for VisualSynth's custom DSP. It executes on the Web Audio rendering thread rather than the main UI thread and is broadly available in current browsers when served from a secure context. GitHub Pages supplies HTTPS, so the primary deployment target is compatible.

The current API normally processes 128-frame render quanta, but code must never hard-code 128 because the Web Audio specification is moving toward configurable render quantum sizes. Every process call must derive its block length from the supplied channel arrays.

### Decision

Use one primary `AudioWorkletNode` that hosts a **compiled internal DSP graph**. Do not model every VisualSynth module as an individual browser `AudioNode`.

Reasons:

- per-module Web Audio nodes make custom audio-rate modulation and state transfer inconsistent;
- graph mutation would require many main-thread node connect/disconnect operations;
- arbitrary modular cycles become difficult to validate and make deterministic;
- per-voice duplication becomes cumbersome;
- probe insertion and educational signal tracing are easier inside one known DSP graph;
- the same DSP code can be reused by an offline renderer and unit tests;
- a single worklet boundary gives one place for safety checks and state migration.

Native Web Audio nodes are still useful around the worklet for destination connection, an optional master `AnalyserNode`, media-stream recording bridges, and browser integration.

## 4. Main-thread/worklet communication

`MessagePort` is sufficient as the required communication mechanism. VisualSynth must not depend on `SharedArrayBuffer` because SAB requires cross-origin isolation headers and therefore should be treated as an optional future optimization rather than a core deployment dependency.

Communication is divided into:

- **topology messages**: compiled immutable GraphIR snapshots;
- **parameter deltas**: compact parameter change events;
- **musical events**: note, gate, MIDI-derived and sequencer events with engine-frame timestamps;
- **analysis messages**: rate-limited probe/master snapshots;
- **diagnostics messages**: engine statistics and recoverable error reports.

The UI must never wait synchronously for the worklet while audio is running.

## 5. Render-rate model

VisualSynth needs three explicit rates:

### Audio rate

Evaluated every sample for signals whose audible result depends on sample-accurate motion. Examples: oscillator phase, audio signals, FM/PM inputs, VCA gain when audio-rate modulated, filter cutoff when audio-rate modulated, ring modulation, waveshaping and feedback.

### Control rate

Evaluated once per render quantum or a defined control divisor. Examples: most UI knob changes, slow LFOs when not patched to audio-rate destinations, macro controls, mixer pan, most effect parameters, sequencer state, MIDI CC smoothing.

### Visualization rate

Independent from audio/control processing. Typical on-screen rates are 15–30 Hz, with 60 Hz reserved for the small number of displays where it materially improves interaction. Offscreen/collapsed modules update more slowly or not at all.

## 6. Polyphony research and conclusion

Modular polyphony is easiest to understand when the patch visually represents one signal chain while the engine replicates voice-domain modules internally. VCV Rack's polyphonic cables demonstrate the value of carrying several voices through one visible connection rather than requiring users to duplicate the whole patch.

VisualSynth adopts an explicit **voice domain / global domain** model.

- `VOICE` modules are instantiated once per active voice.
- `GLOBAL` modules have one shared instance.
- `EFFECT` modules are global by default, though selected effects may later permit voice scope.
- `UTILITY` modules inherit or explicitly convert scope.

Connection behavior:

- VOICE → VOICE preserves voice lanes.
- GLOBAL control → VOICE broadcasts the global value to every active voice.
- VOICE audio → GLOBAL automatically sums voices at an explicit voice-mix boundary.
- VOICE control → GLOBAL is rejected unless passed through a reducer module (mean/max/min/sum/latest/selected-voice), avoiding ambiguous modulation behavior.
- GLOBAL audio → VOICE is rejected in the initial design except through explicit broadcast/feedback utility modules.

This keeps common subtractive patches simple while making domain changes visible and testable.

## 7. Graph architecture research and conclusion

The patch is a typed directed graph. Zero-delay audio/control cycles are not allowed because they do not define a causal evaluation order. Feedback is still required for synthesis and effects, so cycles are legal only when every strongly connected component contains an operator declaring at least one sample of delay.

The graph compiler performs:

1. schema validation;
2. port compatibility validation;
3. scope/domain validation;
4. cycle/SCC analysis;
5. latency annotation;
6. voice/global partitioning;
7. topological scheduling of causal operators;
8. buffer lifetime planning and reuse;
9. probe insertion;
10. generation of compact GraphIR.

A dedicated `FeedbackDelay` / `UnitDelay` module makes legal feedback explicit to the user.

## 8. Hot graph updates

Topology editing cannot click or produce undefined partial graphs.

The selected strategy is **compile outside the audio render loop, instantiate beside the active graph, then atomically swap at a render-quantum boundary**.

Where stable module IDs and compatible module types match, runtime state is migrated: oscillator phase, filter state, envelope stage, delay buffers when compatible, sequencer position, LFO phase, and smoothing state. Incompatible state starts from the module default.

Topology swaps use a short equal-power crossfade, normally 64–256 samples depending on sample rate and CPU budget. Parameter-only changes do not trigger graph recompilation.

## 9. DSP algorithm findings

### Oscillators

- Sine: direct or table lookup.
- Saw/square/pulse/variable discontinuous shapes: PolyBLEP/minBLEP-class correction is practical in JavaScript.
- Triangle: integrated band-limited square with DC correction or harmonic/table method.
- Wavetable: multi-resolution/mipmapped band-limited tables selected by fundamental frequency.
- Additive: direct partial sum with Nyquist culling; cap active partials based on CPU tier.
- Supersaw: several phase-offset/detuned saw voices with normalized mix and optional stereo spread.

### Filters

A topology-preserving-transform state-variable filter is a strong core choice because it provides stable low-pass/high-pass/band-pass/notch outputs and handles modulation well. Cascaded stages produce steeper slopes. A nonlinear ladder-style filter belongs in Advanced scope and should use conservative saturation plus optional 2× oversampling.

### Nonlinear processing

Waveshaping, clipping, foldback and high drive generate aliasing. Default processing is 1× where clean enough; nonlinear modules expose or internally select 2×/4× oversampling based on mode/quality setting. Oversampling must be localized rather than applied to the whole graph.

### Reverb

A Schroeder/Freeverb-style or small feedback-delay-network algorithm is preferred over mandatory convolution assets. This avoids large downloads and allows fully parameterized decay/damping while staying static-host friendly.

### Delay/modulation effects

Fractional delay lines with interpolation support chorus/flanger and tempo delay. Phaser uses cascaded all-pass stages. All feedback paths include finite-value guards and bounded feedback coefficients by default; expert modes may extend the range while retaining hard numerical safety.

## 10. Parameter architecture findings

All controls must be declared through one metadata schema. A parameter definition contains:

- stable ID;
- display name and short label;
- unit and display formatter;
- min/max/default;
- scale (`linear`, `log`, `exp`, `db`, `bipolar`, `enum`);
- step/quantization;
- modulation capability;
- automation capability;
- MIDI-map capability;
- base processing rate;
- allowed promotion to audio rate;
- smoothing policy and time constant;
- serialization rules;
- educational description.

The displayed knob value is the **base value**. Modulation assignments are summed/transformed after base value and before final clamp. The UI displays both base position and live effective position/range.

## 11. MIDI findings

Web MIDI requires HTTPS and user permission and is not implemented equally across browsers. It therefore cannot be the only play input.

Required fallback hierarchy:

1. Web MIDI when available and permitted;
2. computer keyboard;
3. on-screen piano/pads;
4. sequencers/arpeggiators/internal generators.

MIDI timestamps are converted to engine-frame timestamps. Note-on with velocity zero is normalized to note-off. Sustain pedal handling occurs in the voice allocator, not the oscillator.

## 12. Voice allocation

The default voice allocator supports poly, mono, legato, retrigger and unison modes.

Default poly voice-stealing order:

1. released voices with lowest current envelope energy;
2. oldest sustained voice with lowest energy;
3. oldest active voice.

A stolen voice receives a short de-click ramp. Voice IDs remain stable for the lifetime of the note event chain so visual voice traces can identify them.

## 13. Visualization research and conclusion

VisualSynth must not create a separate `requestAnimationFrame` loop per module. A single visualization scheduler owns all render callbacks.

Data is divided into two categories:

### State-derived visuals

Can be drawn from parameter state without tapping live audio: ADSR shape, LFO mathematical shape, EQ/filter response, sequencer steps, panner position, waveshaper transfer curve.

### Signal-derived visuals

Require samples/measurements from the DSP engine: oscilloscope waveform, incoming/outgoing spectrum, mixer sum, phase correlation, probe history, master meters.

Signal-derived analysis is opt-in and budgeted. The graph compiler inserts lightweight tap operators only for visible/active probes. Audio samples are decimated or summarized in the worklet and transferred at a bounded rate.

The visualization scheduler uses priority classes:

- P0 master meters/clip indicators;
- P1 active edited module and attached probe;
- P2 visible module visualizations;
- P3 background/educational extras;
- P4 offscreen/collapsed, normally frozen.

Audio quality always wins over display frame rate.

## 14. Offline rendering and recording

The DSP core must be written as environment-neutral TypeScript/JavaScript classes imported by both the AudioWorklet adapter and an offline-render Worker. The offline engine processes the same GraphIR and event timeline in blocks until the requested duration is complete.

This gives deterministic WAV rendering at 44.1/48/96 kHz and 16-bit PCM, 24-bit PCM or 32-bit float without relying on browser-specific MediaRecorder codecs.

`OfflineAudioContext` remains useful for interoperability tests and any future native-node rendering path, but the canonical export path should use the same internal DSP implementation as realtime.

Realtime recording captures the post-master float stream into bounded chunks transferred to an encoder Worker. Long recordings must stream/chunk rather than retain an unbounded in-memory sample list.

## 15. Framework/tooling conclusion

The recommended implementation stack is:

- TypeScript;
- Vite for static bundling and correct `/visualsynth/` base paths;
- no runtime UI framework initially;
- DOM/custom lightweight components for panels and controls;
- SVG or a single overlay canvas for patch cables;
- Canvas 2D for most scopes/graphs;
- optional WebGL/WebGPU only for a future high-density spectrogram if profiling justifies it;
- Vitest for pure model/DSP/graph unit tests;
- Playwright for browser/UI integration tests.

The build output remains static and deployable to GitHub Pages.

## 16. Storage

- Factory patches: bundled JSON.
- User library: IndexedDB.
- Preferences: localStorage for small non-critical settings.
- Import/export: versioned JSON patch file.
- Share URL: compressed patch data only when below a conservative URL-size threshold; otherwise export a file.

No backend/account/tracking is required.

## 17. Mobile and accessibility findings

Desktop is the primary patch-building target. Tablet should support full playback and practical patch editing. Phones should support playback, preset editing, learning and small-patch editing but may use a simplified workspace layout.

Controls must expose numeric values and labels independently of visualization. Pointer Events should provide one interaction model for mouse/pen/touch. Patch cable state must be distinguishable by shape/label as well as color. Reduced-motion mode disables pulsing/activity animation while preserving value indicators.

## 18. Key architecture recommendation

VisualSynth should be built around the following invariant:

`UI Patch State -> Validator/Graph Compiler -> immutable GraphIR -> AudioWorklet DSP Runtime -> Output`

Parameter and musical events update the running GraphIR without forcing recompilation. Topology changes compile new GraphIR and swap atomically. Visual probes are graph instrumentation, not ad-hoc UI polling.

This architecture is the strongest fit for the project's two defining questions:

1. Can the user understand what is happening to the sound by looking at VisualSynth?
2. Would an experienced synthesizer user still find the synth useful without the educational layer?
