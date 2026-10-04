# VisualSynth Specification Audit

Date: 2026-10-04
Status: PASS for implementation-readiness review

## 1. Audit scope

The specification set was checked against the original VisualSynth design request for completeness, contradictions, undefined behavior, requirements traceability, and accidental implementation work.

Files audited:

- `README.md`
- `research/RESEARCH.md`
- `research/REFERENCES.md`
- `spec/PROJECT_SPEC.md`
- `spec/ARCHITECTURE.md`
- `spec/DSP_SPEC.md`
- `spec/MODULE_SPEC.md`
- `spec/GUI_SPEC.md`
- `spec/VISUALIZATION_SPEC.md`
- `spec/PATCH_FORMAT.md`
- `spec/REQUIREMENTS_MATRIX.md`
- `spec/ACCEPTANCE_CRITERIA.md`
- `docs/DEVELOPMENT_PLAN.md`

## 2. Placeholder scan

Repository code/spec search found no unresolved `TBD`, `TODO`, or `FIXME` placeholders in the committed specification set.

Result: PASS.

## 3. Product-scope consistency

Checked that all documents preserve these core priorities:

1. VisualSynth is first a serious playable synthesizer.
2. It is also a genuinely modular synthesis environment.
3. Visualization explains actual synthesis state rather than serving as decoration.
4. Learning features are optional and do not weaken advanced use.
5. The app remains static-hostable on GitHub Pages with no required backend.
6. BrowserToneGen is reference/inspiration only and is not modified.

Result: PASS.

## 4. Audio architecture consistency

Checked for contradictory engine models.

The documents consistently specify:

- one long-lived `AudioContext`;
- a primary `AudioWorkletNode` hosting a compiled internal DSP graph;
- a versioned editable PatchDocument distinct from immutable GraphIR;
- topology compile outside the sample loop;
- parameter/event deltas without full graph rebuild;
- atomic graph swap at a render boundary;
- compatible runtime-state transfer by stable ID;
- same DSP/GraphIR semantics for realtime and offline rendering.

No document requires a one-Web-Audio-node-per-module architecture.

Result: PASS.

## 5. Polyphony audit

Original requirement: explicitly solve modular polyphony.

Defined behavior now covers:

- VOICE, GLOBAL, EFFECT, UTILITY module scopes;
- per-active-voice runtime state;
- VOICE -> VOICE lane preservation;
- GLOBAL control -> VOICE broadcast;
- VOICE audio -> GLOBAL summing;
- VOICE control -> GLOBAL rejection unless `Voice Reduce` is used;
- mono, legato, poly and unison modes;
- voice allocation, sustain and energy/age-based voice stealing;
- per-voice/global LFO scope;
- poly signal visualization without duplicating every cable.

Result: PASS.

## 6. Patching/routing audit

Checked:

- signal classes;
- compatibility rules;
- fan-in;
- fan-out;
- semantic conversion;
- polarity/range metadata;
- cable selection/removal;
- module deletion behavior;
- modulation routing;
- feedback cycles;
- latency.

The architecture defines typed AUDIO, CONTROL, PITCH, GATE, TRIGGER, CLOCK and EVENT routes. Semantic conversions require explicit utility modules; only unambiguous channel adaptations may be compiler-generated.

Result: PASS.

## 7. Feedback/cycle audit

Original requirement: define cycles and feedback.

Resolution:

- graph compiler performs strongly connected component analysis;
- zero-delay cycles are rejected;
- a cyclic SCC is accepted only when a positive-delay/causal-break operator exists;
- `Feedback Delay` is a Core module with minimum one-sample delay;
- delayed SCC runtime evaluation order is defined;
- runaway numerical values remain subject to finite-value/master protection.

Result: PASS.

## 8. Parameter/modulation audit

Checked central parameter metadata against module and GUI specifications.

Defined metadata includes:

- stable ID/name/unit;
- min/max/default;
- curve/step/display;
- modulation/automation/MIDI capability;
- audio/control rate;
- smoothing;
- serialization;
- educational content.

Effective value order is consistent:

`stored base -> automation -> modulation transform/sum -> bounds -> smoothing as applicable`

Audio-rate capable destinations are explicitly identified.

Result: PASS.

## 9. Module catalogue audit

The definitive initial catalogue contains 60 module/reservation entries across CORE, STANDARD, ADVANCED, EXPERIMENTAL and FUTURE tiers.

The required initial synthesis families are covered:

- note/input;
- oscillators including standard, additive, wavetable and supersaw;
- mixer;
- filters;
- VCA;
- envelopes;
- LFOs;
- FM/PM/AM/ring modulation;
- waveshaping/distortion/wavefolding/bit reduction;
- noise/random/chaos;
- sequencing/arpeggiation;
- delay/reverb/chorus/flanger/phaser/EQ/compression;
- stereo utilities;
- macros/XY;
- probes and analysis;
- poly/global conversion utilities;
- explicit feedback delay.

Each actively planned module defines purpose, ports, parameters/modulation, algorithm, visualization, scope, CPU class, defaults, serialization, education, tests and edge cases either individually or under the shared module authoring rules.

Result: PASS.

## 10. Visualization audit

Checked requirement that sound-affecting behavior be visible wherever practical.

Defined coverage includes:

- oscillator source/measured waveform;
- filter response and optional spectra;
- envelope shape/live stage;
- LFO shape/live phase;
- mixer inputs/result;
- VCA levels;
- waveshaper transfer curve;
- EQ response;
- compressor transfer/gain reduction;
- delay timeline;
- reverb decay representation;
- stereo/correlation;
- Scope Probe and Control Probe;
- master scope/spectrum/spectrogram/stereo views;
- Signal Inspector metrics;
- Visual Signal Flow and Compare Mode.

The spec explicitly distinguishes state-derived previews from measured signal-derived views.

Result: PASS.

## 11. Visualization-performance audit

Original requirement: do not run dozens of expensive independent visual loops.

Resolution:

- exactly one app-level visualization scheduler;
- task priorities P0–P4;
- visibility/offscreen throttling;
- pooled/reused buffers;
- bounded analysis packets;
- independent probe budget;
- Worker option for FFT/heavy analysis;
- visual degradation before audio-quality degradation.

Result: PASS.

## 12. DSP completeness audit

DSP spec covers:

- process loop;
- parameter smoothing;
- modulation evaluation;
- control/audio rates;
- band-limited oscillator methods;
- additive/wavetable/supersaw;
- envelopes/LFO/random;
- SVF filter and advanced ladder direction;
- mixing/VCA/ring/FM/PM;
- nonlinear/oversampling;
- delay/modulation effects/reverb;
- EQ/compressor/stereo;
- sequencing timing;
- automation;
- offline rendering/WAV;
- probes/FFT/metrics;
- finite-value/DC/master safety;
- quality tiers;
- testing tolerances.

Result: PASS.

## 13. Browser technology audit

The specs do not assume unsupported browser features as universal.

- AudioWorklet is baseline and requires HTTPS/secure context.
- Web MIDI is feature-detected and optional.
- SharedArrayBuffer is explicitly non-required.
- Canvas 2D is baseline visualization technology.
- WebGL/WebGPU is deferred until profiling justifies it.
- GitHub Pages `/visualsynth/` base-path behavior is explicit.

Result: PASS.

## 14. Persistence/versioning audit

Patch format defines:

- versioned JSON;
- stable IDs;
- module versions;
- top-level sequential migration;
- module-level migration;
- unknown-module placeholders;
- safe staging before live patch replacement;
- import size/shape limits;
- no arbitrary executable JavaScript;
- IndexedDB storage;
- factory patches using same schema;
- share URL behavior;
- deterministic canonical serialization.

Result: PASS.

## 15. Undo/redo audit

Defined for:

- module add/remove/move/duplicate;
- cable connect/disconnect;
- parameter edits;
- modulation edits;
- preset/module-preset changes;
- randomization/mutation.

Continuous drag is coalesced from pointer-down to pointer-up into one history transaction.

Result: PASS.

## 16. MIDI/input audit

Defined:

- Web MIDI feature/permission flow;
- note on/off;
- velocity;
- pitch bend;
- mod wheel/CC;
- sustain;
- MIDI Learn;
- device disconnect handling;
- computer keyboard;
- on-screen keyboard;
- no-MIDI fallback requirement.

Result: PASS.

## 17. Safety/error audit

Defined protections include:

- schema/graph validation;
- last-valid-graph retention;
- finite-value guards;
- repeated module fault fail-silent behavior;
- algorithm-specific resonance/feedback bounds;
- DC protection;
- emergency master amplitude guard;
- two-level panic path (worklet and outer master gain);
- worklet restart path;
- invalid import quarantine.

Result: PASS.

## 18. Mobile/accessibility audit

Covered:

- desktop-primary design;
- tablet authoring;
- phone performance/selected-module/small-patch flows;
- Pointer Events;
- touch-sized connection targets and two-step phone connection fallback;
- keyboard navigation;
- ARIA/value text;
- non-color signal cues;
- reduced motion;
- high contrast.

Result: PASS.

## 19. Testing audit

Required layers are explicit:

- DSP unit tests;
- graph/compiler tests;
- integration tests;
- browser/UI tests;
- responsive/touch tests;
- browser matrix;
- performance/stress/soak tests;
- migration/serialization fixtures;
- factory-patch compile CI;
- numerical fuzz tests.

Acceptance criteria also define release blockers and graph fixture patches.

Result: PASS.

## 20. Requirements traceability audit

`spec/REQUIREMENTS_MATRIX.md` maps the stable requirement IDs introduced in `spec/PROJECT_SPEC.md` to:

- milestone phase;
- requirement intent;
- planned implementation area;
- verification method.

No matrix row is intentionally left without a verification method.

Any future requirement added to any spec must be added to the matrix before implementation acceptance.

Result: PASS.

## 21. Development-phase audit

The original conceptual Phase 0–12 sequence was refined to a 16-phase implementation roadmap plus Phase 0 design completion. The ordering resolves major dependencies:

1. graph/persistence foundations before runtime;
2. DSP/worklet before UI complexity;
3. playability before advanced effects;
4. scheduler before proliferating visualizations;
5. persistence before broad factory library;
6. advanced synthesis/effects before teaching content;
7. probes/signal-flow before lessons that depend on them;
8. performance/cross-browser QA before beta release.

Result: PASS.

## 22. Deferred/rejected feature audit

Explicitly deferred/rejected:

- full DAW arrangement/timeline;
- required backend/accounts/cloud library;
- mandatory SharedArrayBuffer;
- mandatory WebGL/WebGPU;
- arbitrary zero-delay feedback;
- per-module independent animation loops;
- required large convolution packs;
- granular/spectral/physical modeling until after beta;
- external audio input/MPE/microtuning UI as future work.

Result: PASS.

## 23. Contradiction scan findings

Potential contradictions considered and resolved:

### Is feedback allowed or forbidden?
Resolved: feedback is allowed only through a positive-delay causal break; zero-delay cycles are forbidden.

### Are patches visibly monophonic or truly polyphonic?
Resolved: one visible patch may carry polyphonic voice lanes; VOICE modules instantiate per voice internally.

### Is modulation cable-based or drag-to-control?
Resolved: both UI interactions may exist, but both create the same underlying route model.

### Are visuals mathematical or measured?
Resolved: both are permitted and explicitly labeled; measured DSP state is used whenever the distinction matters.

### Is MIDI required?
Resolved: no. MIDI is a beta capability with complete keyboard/on-screen fallback.

### Does offline render use OfflineAudioContext or custom DSP?
Resolved: canonical offline rendering uses the shared internal DSP/GraphIR in a Worker; OfflineAudioContext remains useful for tests/interoperability, not the required export engine.

### Does module bypass remove DSP from graph?
Resolved: bypass semantics are module/category-defined and de-clicked; topology removal occurs only when explicitly safe/compiled.

Result: PASS.

## 24. Implementation boundary audit

The task explicitly required specification/research only, not synthesizer implementation.

The repository currently contains documentation/specification artifacts only. No production synth application, DSP source tree, package scaffold, or deployment implementation was added during this task.

Result: PASS.

## 25. Final conclusion

The VisualSynth specification set is sufficiently detailed to begin implementation planning without requiring the implementing engineer to redesign the product's core architecture.

The major product, DSP, graph, polyphony, modulation, visualization, persistence, UI, testing, performance and deployment decisions are explicit.

No unresolved specification blockers were identified in this audit.
