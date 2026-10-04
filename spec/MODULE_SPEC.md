# VisualSynth Module Catalogue and Module Specifications

## 1. Catalogue policy

Every module is classified as `CORE`, `STANDARD`, `ADVANCED`, `EXPERIMENTAL`, or `FUTURE`.

- CORE: required for MVP and fundamental synthesis.
- STANDARD: expected for first serious beta.
- ADVANCED: sophisticated but broadly useful.
- EXPERIMENTAL: intentionally exploratory/nontraditional.
- FUTURE: architecture-reserved, not required for beta.

All modules inherit common instance state: stable `id`, `type`, `moduleVersion`, `scope`, position, collapsed state, bypass/mute/enable state where applicable, parameter values, MIDI mappings, and UI visualization preferences.

## 2. Definitive initial catalogue

### CORE

1. Note Input
2. Oscillator
3. Mixer
4. Multimode Filter
5. ADSR Envelope
6. VCA
7. LFO
8. Master Output
9. Scope Probe
10. Control Probe
11. Voice Sum / Voice Boundary
12. Feedback Delay

### STANDARD

13. Noise Generator
14. Additive/Harmonic Oscillator
15. Wavetable Oscillator
16. Supersaw Oscillator
17. Multi-Stage Envelope
18. Sample & Hold / Random
19. Ring Modulator
20. FM/PM Operator Utility
21. Waveshaper/Distortion
22. Delay
23. Chorus/Flanger
24. Phaser
25. Reverb
26. Parametric EQ
27. Compressor
28. Stereo Utility
29. Envelope Follower
30. Step Sequencer
31. Gate/Mod Sequencer
32. Arpeggiator
33. Macro
34. XY Pad
35. Voice Reduce
36. Clock/Transport

### ADVANCED

37. Ladder Filter
38. Wavefolder
39. Bit Crusher / Sample-Rate Reducer
40. Euclidean Sequencer
41. Probability Router
42. Custom Function Generator
43. Audio-to-Control / Control-to-Audio Utilities
44. Spectral/Harmonic Analyzer
45. Comparator / Logic Utility
46. Slew Limiter
47. Sample Delay / Align Utility

### EXPERIMENTAL

48. Chaos Generator
49. Random Walk
50. Patch Mutation Controller
51. Phase Interference Lab
52. Harmonic Exciter/Partial Modulator
53. Generative Event Router

### FUTURE

54. Granular Oscillator/Sampler
55. Spectral Oscillator
56. Physical Modeling Voice
57. Convolution Processor
58. External Audio Input
59. MPE/MIDI 2.0 Input
60. Microtuning/Scala Module

---

# CORE MODULES

## 3. Note Input [CORE]

**Purpose:** Converts computer keyboard, on-screen keyboard, Web MIDI, sequencer or arpeggiator note events into polyphonic pitch/gate/velocity/expression signals.

**Inputs:** EVENT note stream; optional global transpose CONTROL.

**Outputs:** PITCH(poly), GATE(poly), VELOCITY CONTROL(poly), AFTERTOUCH CONTROL(poly), NOTE EVENT passthrough.

**Parameters:** mode (poly/mono/legato/unison), max voices, transpose, glide time, retrigger policy, pitch-bend range, unison voices/detune where enabled.

**Modulation targets:** transpose/glide may be control-modulatable; discrete mode parameters are not continuous targets.

**DSP/algorithm:** Voice allocator described in ARCHITECTURE.md. Converts MIDI-note float to frequency only when needed by destination; keeps pitch in note/semitone domain through pitch network.

**Visualization:** active-note lane view, currently allocated voices, held/sustained notes, velocity bars, voice-steal indication.

**Scope:** GLOBAL source producing polyphonic voice lanes.

**CPU:** 1/5.

**Default:** poly, 8 voices, no glide, bend ±2 semitones.

**Serialization:** all parameters and optional persistent MIDI channel filter; active notes are runtime only.

**Educational explanation:** Shows how one note event becomes pitch, gate and expression information for a synth voice.

**Automated tests:** allocation, note-off, sustain, steal ordering, mono note stack, legato/retrigger, pitch bend, duplicate note IDs.

**Edge cases:** lost MIDI note-off, sustain disconnect, max voices=1, repeated same note, device disconnect. Panic clears all runtime notes.

## 4. Oscillator [CORE]

**Purpose:** General band-limited voltage-controlled oscillator.

**Inputs:** PITCH, FM CONTROL/AUDIO, PM CONTROL/AUDIO, SYNC TRIGGER, RESET TRIGGER, amplitude CONTROL.

**Outputs:** AUDIO mono or stereo when stereo spread enabled; optional phase CONTROL in Advanced UI.

**Parameters:** waveform (sine/triangle/saw/reverse-saw/square/pulse/variable), octave, semitone, cents, phase, amplitude, pulse width/shape, retrigger/free-run, polarity, pan, key tracking, drift, sync behavior.

**Mod targets:** pitch, fine tune, amplitude, phase, pulse width/shape, pan.

**DSP:** sine plus PolyBLEP/band-limited discontinuous waveforms; triangle from band-limited integration or verified table method. Per-voice phase state.

**Visualization:** source waveform plus optional actual post-modulation waveform; phase marker, pulse-width handle, fundamental frequency, note/cents readout.

**Scope:** VOICE default; GLOBAL allowed for drones/modulators.

**CPU:** 1–2/5 depending waveform/modulation.

**Default:** saw, 0 octave, 0 semitone/cents, amplitude -12 dB-equivalent, retrigger on, centered pan.

**Serialization:** all parameters; runtime phase excluded.

**Education:** waveform shape, frequency, phase, pulse width, harmonic content.

**Tests:** frequency accuracy, anti-alias comparison, phase reset, PWM, FM/PM, free-run, Nyquist clamp, deterministic block rendering.

**Edge cases:** zero/negative effective frequency, very narrow pulse, extreme FM, phase wrap, sample-rate changes.

## 5. Mixer [CORE]

**Purpose:** Combines multiple audio signals while teaching summation/interference.

**Inputs:** dynamic AUDIO inputs (minimum 2; user can add channels).

**Outputs:** stereo AUDIO.

**Parameters per input:** level, mute, solo, pan/balance, polarity, stereo width where input stereo. Global gain and optional auto-headroom.

**Mod targets:** level, pan; width when safe.

**DSP:** summation with equal-power pan and no hidden hard clip.

**Visualization:** individual compact traces plus summed result, peak contribution bars, clipping/headroom warning, phase cancellation indicator where measurable.

**Scope:** VOICE or GLOBAL.

**CPU:** 1/5.

**Default:** 2 inputs at -6 dB, centered, normal polarity.

**Serialization:** dynamic channel count and channel settings.

**Education:** constructive/destructive interference, level summing, pan, polarity.

**Tests:** sum math, solo/mute precedence, pan law, polarity cancellation, dynamic port add/remove.

**Edge cases:** no inputs, many inputs, high summed amplitude, mono/stereo mixtures.

## 6. Multimode Filter [CORE]

**Purpose:** Stable resonant filter with visual frequency response.

**Inputs:** AUDIO, cutoff modulation CONTROL/AUDIO, resonance modulation CONTROL, PITCH for key tracking.

**Outputs:** AUDIO; optional simultaneous LP/BP/HP outputs in Advanced UI.

**Parameters:** mode LP/HP/BP/notch, cutoff, resonance/Q, slope 12/24 dB, drive, key tracking, wet/dry.

**Mod targets:** cutoff, resonance, drive, wet/dry.

**DSP:** TPT state-variable filter; cascaded stage for 24 dB; optional pre/post saturation.

**Visualization:** exact/derived frequency response curve, cutoff/resonance markers, optional input/output spectra when selected.

**Scope:** VOICE default; GLOBAL allowed.

**CPU:** 1–2/5.

**Default:** LP 12 dB, cutoff 12 kHz, low resonance, no drive.

**Serialization:** parameters and display options; integrator state runtime only.

**Education:** harmonic removal/emphasis, resonance, slope, key tracking.

**Tests:** coefficient/reference response, stable extremes, modulation, 12/24 dB behavior, state reset/transfer.

**Edge cases:** cutoff near 0/Nyquist, self-oscillation-adjacent Q, rapid audio-rate modulation.

## 7. ADSR Envelope [CORE]

**Purpose:** Standard gate-driven amplitude/control contour.

**Inputs:** GATE, retrigger TRIGGER, optional velocity CONTROL scaling.

**Outputs:** CONTROL poly or global according to scope.

**Parameters:** attack, decay, sustain, release, curve per stage, retrigger mode, velocity amount.

**Mod targets:** stage times and sustain may be control-modulatable; audio-rate modulation not required.

**DSP:** sample-accurate state machine.

**Visualization:** editable envelope graph with live stage/position marker and current value.

**Scope:** VOICE default; GLOBAL allowed.

**CPU:** 1/5.

**Default:** A 10 ms, D 150 ms, S 0.7, R 250 ms.

**Serialization:** parameters only.

**Education:** articulation and how amplitude/filter envelopes shape time.

**Tests:** exact timing, zero-time stages, retrigger modes, gate release, velocity scaling.

**Edge cases:** gate on during release, instantaneous A/D/R, automation of duration while active.

## 8. VCA [CORE]

**Purpose:** Multiplies audio by gain/control signal.

**Inputs:** AUDIO, gain CONTROL/AUDIO.

**Outputs:** AUDIO.

**Parameters:** base gain, gain mode (linear/dB), bipolar enable, mute.

**Mod targets:** gain.

**DSP:** multiplication with parameter smoothing and optional bipolar range.

**Visualization:** input level, control envelope/value and output level; optional tiny transfer plot.

**Scope:** VOICE or GLOBAL.

**CPU:** 1/5.

**Default:** base gain 1, unipolar.

**Serialization:** parameters.

**Education:** demonstrates that envelopes/LFOs do not create sound; they control amplitude.

**Tests:** unity, silence, modulation, bipolar inversion, de-clicked mute.

**Edge cases:** over-unity modulation, disconnected control input.

## 9. LFO [CORE]

**Purpose:** Repeating/slow modulation source.

**Inputs:** RESET/TRIGGER, CLOCK optional, rate modulation CONTROL.

**Outputs:** CONTROL; optional AUDIO-rate output in Advanced mode.

**Parameters:** shape, rate, tempo sync/division, phase, bipolar/unipolar, depth, delay, fade-in, retrigger/free-run, seed for random forms.

**Mod targets:** rate, depth, shape where continuous.

**DSP:** waveform oscillator; deterministic random/sample-hold forms.

**Visualization:** live waveform, phase cursor, output range; connected destinations listed/highlighted.

**Scope:** GLOBAL default; VOICE allowed.

**CPU:** 1/5.

**Default:** sine 1 Hz bipolar.

**Serialization:** all parameters/seed.

**Education:** periodic modulation, vibrato/tremolo/PWM.

**Tests:** phase/rate, sync divisions, retrigger, polarity, random determinism.

**Edge cases:** rate near audio range, transport changes, zero rate.

## 10. Master Output [CORE]

**Purpose:** Final output and system monitoring.

**Inputs:** stereo AUDIO.

**Outputs:** browser destination plus analysis/record tap.

**Parameters:** master gain, mute, mono, output quality preferences, analyzer display modes.

**Mod targets:** master gain may be automatable but MIDI mapping is guarded; no arbitrary audio-rate modulation by default.

**DSP:** DC protection, emergency finite/amplitude guard, gain, meter taps.

**Visualization:** peak/RMS/clip, oscilloscope, spectrum, optional spectrogram, stereo phase/correlation, waveform history.

**Scope:** GLOBAL singleton.

**CPU:** 1–3/5 depending visuals.

**Default:** -6 dB headroom, stereo.

**Serialization:** gain/display preferences; runtime meter history excluded.

**Education:** final combined waveform and spectrum.

**Tests:** meters, mute, panic interaction, mono fold, clipping indication, finite-value protection.

**Edge cases:** no input, extreme level, worklet fault.

## 11. Scope Probe [CORE]

**Purpose:** Inspect any audio connection without changing its audible signal.

**Inputs:** attached implicitly to one AUDIO connection.

**Outputs:** no patch signal; analysis data only.

**Parameters:** view waveform/spectrum/level, time scale, trigger/freeze, FFT size, channel selection, refresh priority.

**Mod targets:** none.

**DSP:** compiler-inserted tap with decimation/analysis accumulator.

**Visualization:** waveform/spectrum/metrics panel.

**Scope:** follows probed route.

**CPU:** 1–3/5 depending FFT.

**Default:** waveform, 30 Hz target refresh, moderate sample window.

**Serialization:** attachment and view configuration; frozen sample data not persisted by default.

**Education:** makes hidden internal audio visible.

**Tests:** probe insertion/removal is signal-transparent, bounds, many probes, freeze.

**Edge cases:** deleted cable, hidden/offscreen probe, polyphonic route selection.

## 12. Control Probe [CORE]

**Purpose:** Inspect continuous control/modulation routes.

**Inputs:** attached to CONTROL/PITCH/GATE compatible route.

**Outputs:** analysis only.

**Parameters:** time span, autoscale/fixed scale, freeze, selected voice for poly control.

**DSP:** low-cost decimated value history/event capture.

**Visualization:** scrolling control plot with zero/base reference and current value.

**Scope:** follows route.

**CPU:** 1/5.

**Default:** 2-second history.

**Serialization:** attachment/view config.

**Education:** shows modulation shape and polarity.

**Tests:** no signal alteration, correct scaling, poly voice select.

**Edge cases:** gate/event-like transitions, missing source.

## 13. Voice Sum / Voice Boundary [CORE]

**Purpose:** Makes VOICE->GLOBAL audio transition visible and explicit when desired.

**Inputs:** poly/voice AUDIO.

**Outputs:** global stereo AUDIO.

**Parameters:** normalization off/peak-estimate/1-sqrt(N), optional voice solo inspector.

**DSP:** sums active voice buses.

**Visualization:** active voice count, per-voice compact levels, total.

**Scope:** UTILITY boundary.

**CPU:** 1/5.

**Default:** no automatic N division.

**Serialization:** normalization/view settings.

**Education:** explains polyphony becoming one mixed audio stream.

**Tests:** summing, active voice changes, normalization modes.

**Edge cases:** zero voices, many voices, voice clipping.

## 14. Feedback Delay [CORE]

**Purpose:** Provides explicit causal break so feedback loops are legal.

**Inputs:** AUDIO or CONTROL depending mode.

**Outputs:** same signal class delayed.

**Parameters:** delay samples/time, interpolation for audio time mode, optional soft-safe mode.

**DSP:** minimum one-sample state delay; longer modes use circular buffer.

**Visualization:** feedback/cycle badge, one-sample/time indicator, compact history.

**Scope:** VOICE or GLOBAL.

**CPU:** 1/5.

**Default:** 1 sample.

**Serialization:** delay settings.

**Education:** causality and why digital feedback requires memory/delay.

**Tests:** exact one-sample behavior, cycle compiler acceptance, reset.

**Edge cases:** delay=0 requested (clamped/rejected), sample-rate change.

---

# STANDARD MODULES

## 15. Noise Generator [STANDARD]

**Purpose:** White/pink/brown/blue/violet noise source.

**Inputs:** optional trigger reseed, filter color modulation.

**Outputs:** AUDIO.

**Parameters:** type, level, seed, stereo correlation, optional simple color tilt.

**Mod targets:** level/color.

**DSP:** deterministic PRNG plus spectral coloring filters/differentiation/integration.

**Visualization:** spectrum and level history.

**Scope:** VOICE or GLOBAL.

**CPU:** 1/5.

**Default:** white, moderate level, deterministic seed.

**Serialization:** type/seed/settings.

**Education:** broadband energy and spectral slope.

**Tests:** determinism, approximate spectral slope, no DC runaway.

**Edge cases:** brown drift, reseed during sound.

## 16. Additive/Harmonic Oscillator [STANDARD]

**Purpose:** User-defined harmonic spectrum oscillator.

**Inputs:** PITCH, amplitude CONTROL, optional harmonic-position modulation.

**Outputs:** AUDIO.

**Parameters:** up to 64–128 partial amplitudes/phases, normalization, harmonic tilt, odd/even scaling.

**Mod targets:** overall amplitude, tilt, odd/even balance, morph between stored harmonic frames.

**DSP:** Nyquist-culled partial sum or generated band-limited table when static.

**Visualization:** draggable harmonic bars plus waveform and spectrum.

**Scope:** VOICE.

**CPU:** 2–4/5 depending partial mode.

**Default:** first 8 saw-like harmonics at descending amplitude.

**Serialization:** partial arrays and morph frames.

**Education:** direct link between harmonics and waveform.

**Tests:** harmonic amplitudes, Nyquist culling, normalization, waveform reconstruction.

**Edge cases:** all-zero partials, many high partials, morph discontinuity.

## 17. Wavetable Oscillator [STANDARD]

**Purpose:** Morph through user/factory wavetable frames.

**Inputs:** PITCH, table position CONTROL/AUDIO, phase modulation.

**Outputs:** AUDIO.

**Parameters:** table ID/user data, frame position, interpolation, phase, unison optional.

**Mod targets:** frame position, pitch, phase, amplitude.

**DSP:** mipmapped band-limited tables with frame interpolation.

**Visualization:** 2D/stack frame browser, current waveform, current spectrum.

**Scope:** VOICE.

**CPU:** 2/5.

**Default:** small factory table from sine->triangle->saw-like.

**Serialization:** user source table or reference to bundled table + checksum/version.

**Education:** evolving spectral shape.

**Tests:** interpolation, mip selection, custom table import/editor normalization.

**Edge cases:** malformed table, DC offset, high pitch.

## 18. Supersaw Oscillator [STANDARD]

**Purpose:** Dense detuned saw cluster.

**Inputs:** PITCH, spread/mix modulation.

**Outputs:** stereo AUDIO.

**Parameters:** voice count, detune/spread, stereo spread, center level, random/fixed phase.

**Mod targets:** detune, stereo spread, level.

**DSP:** multiple band-limited saws with energy normalization.

**Visualization:** overlaid waveforms/phase points and detune fan display.

**Scope:** VOICE.

**CPU:** 2–4/5.

**Default:** 5 saws, moderate detune.

**Serialization:** parameters/seed.

**Education:** beating, detune, stereo density.

**Tests:** normalization, symmetric detune, aliasing quality, quality-tier caps.

**Edge cases:** high polyphony x high saw count.

## 19. Multi-Stage Envelope [STANDARD]

**Purpose:** Breakpoint/drawable/looping envelope.

**Inputs:** GATE/TRIGGER/CLOCK.

**Outputs:** CONTROL.

**Parameters:** points/segments, curves, loop range, one-shot/gate mode, sync/free time.

**Mod targets:** overall time scale and level scale.

**DSP:** segment cursor/interpolator.

**Visualization:** directly editable breakpoint graph with animated cursor.

**Scope:** VOICE/GLOBAL.

**CPU:** 1/5.

**Default:** simple 4-point contour.

**Serialization:** segment list/loop metadata.

**Education:** envelopes as arbitrary time-varying control signals.

**Tests:** loops, zero-length segments, curve interpolation, tempo changes.

**Edge cases:** edited points while active, invalid loop range.

## 20. Sample & Hold / Random [STANDARD]

**Purpose:** Clocked or free random control source.

**Inputs:** CLOCK/TRIGGER, optional sampled CONTROL input.

**Outputs:** CONTROL, TRIGGER optional.

**Parameters:** source internal/external, seed, range, smoothing/slew, probability.

**Mod targets:** range/slew/probability.

**DSP:** sample incoming or deterministic random on trigger.

**Visualization:** stepped value history.

**Scope:** GLOBAL/VOICE.

**CPU:** 1/5.

**Default:** seeded bipolar random on clock.

**Serialization:** parameters/seed.

**Education:** classic S&H and stepped modulation.

**Tests:** trigger timing, determinism, sample external input.

**Edge cases:** no clock, extremely fast clock.

## 21. Ring Modulator [STANDARD]

**Purpose:** Four-quadrant amplitude multiplication.

**Inputs:** carrier AUDIO, modulator AUDIO.

**Outputs:** AUDIO.

**Parameters:** depth, gain, polarity/offset options.

**Mod targets:** depth/gain.

**DSP:** multiplication with dry blend.

**Visualization:** carrier, modulator and result mini scopes/spectrum.

**Scope:** VOICE/GLOBAL.

**CPU:** 1/5.

**Default:** 100% ring mod.

**Serialization:** parameters.

**Education:** sidebands and multiplication.

**Tests:** known sine sidebands, depth endpoints.

**Edge cases:** DC-biased modulator, high output gain.

## 22. FM/PM Operator Utility [STANDARD]

**Purpose:** Clearly expose linear FM, exponential FM and PM scaling between modulator and oscillator/operator target.

**Inputs:** CONTROL/AUDIO modulator, optional PITCH reference.

**Outputs:** CONTROL/AUDIO modulation signal.

**Parameters:** mode, depth in Hz/semitones/octaves/cycles, bias, polarity.

**Mod targets:** depth/bias.

**DSP:** domain conversion/scaling only.

**Visualization:** modulator waveform and projected pitch/phase excursion.

**Scope:** VOICE/GLOBAL.

**CPU:** 1/5.

**Default:** PM, moderate depth.

**Serialization:** parameters.

**Education:** disambiguates FM types.

**Tests:** scaling math, unit conversion.

**Edge cases:** extreme exponential depth.

## 23. Waveshaper/Distortion [STANDARD]

**Purpose:** Saturation, clipping and arbitrary transfer shaping.

**Inputs:** AUDIO, optional drive CONTROL.

**Outputs:** AUDIO.

**Parameters:** mode soft/hard/saturation/rectify/custom curve, drive, bias, wet/dry, oversampling quality.

**Mod targets:** drive, bias, wet/dry.

**DSP:** transfer function plus localized oversampling where enabled.

**Visualization:** input waveform -> transfer curve -> output waveform.

**Scope:** VOICE/GLOBAL/EFFECT.

**CPU:** 1–4/5.

**Default:** gentle soft saturation.

**Serialization:** curve points/mode/settings.

**Education:** nonlinear harmonic generation.

**Tests:** transfer endpoints, oversampling, finite output, custom curve interpolation.

**Edge cases:** huge drive/bias, discontinuous user curve.

## 24. Delay [STANDARD]

**Purpose:** Echo and feedback delay.

**Inputs:** stereo AUDIO, CLOCK optional, feedback modulation CONTROL.

**Outputs:** stereo AUDIO.

**Parameters:** time, sync/division, feedback, wet/dry, ping-pong, stereo offset, high/low-cut in feedback.

**Mod targets:** time within defined artifact-safe range, feedback, mix, filter values.

**DSP:** interpolated circular delay lines.

**Visualization:** echo timeline, feedback decay preview, live echo pulses.

**Scope:** GLOBAL/EFFECT default.

**CPU:** 1–2/5.

**Default:** 1/4 note sync, moderate feedback, 25% wet.

**Serialization:** parameters; buffers runtime only.

**Education:** time-domain repetition/feedback.

**Tests:** exact integer delays, fractional interpolation, ping-pong, feedback stability.

**Edge cases:** time automation, BPM change, near-unity feedback.

## 25. Chorus/Flanger [STANDARD]

**Purpose:** Modulated delay effects.

**Inputs:** stereo AUDIO.

**Outputs:** stereo AUDIO.

**Parameters:** mode chorus/flanger, rate, depth, base delay, feedback, stereo phase, mix.

**Mod targets:** rate/depth/mix/feedback.

**DSP:** modulated fractional delay.

**Visualization:** delay-time motion and comb-notch response approximation.

**Scope:** EFFECT/GLOBAL.

**CPU:** 2/5.

**Default:** chorus, slow rate, moderate mix.

**Serialization:** parameters.

**Education:** moving comb filters and doubling.

**Tests:** modulation bounds, no buffer overread, stereo phase.

**Edge cases:** zero delay, high feedback.

## 26. Phaser [STANDARD]

**Purpose:** Swept all-pass phase effect.

**Inputs:** AUDIO.

**Outputs:** AUDIO.

**Parameters:** stages, rate, depth, center, feedback, mix, stereo phase.

**Mod targets:** center/rate/depth/feedback/mix.

**DSP:** cascaded all-pass filters.

**Visualization:** moving phase/notch response.

**Scope:** EFFECT/GLOBAL.

**CPU:** 1–2/5.

**Default:** 6 stages, slow rate.

**Serialization:** parameters.

**Education:** phase cancellation creates notches without direct EQ cuts.

**Tests:** stage count, coefficient stability, response movement.

**Edge cases:** extreme center frequency.

## 27. Reverb [STANDARD]

**Purpose:** Algorithmic room/space effect.

**Inputs:** stereo AUDIO.

**Outputs:** stereo AUDIO.

**Parameters:** size, decay, damping, pre-delay, width, wet/dry, quality.

**Mod targets:** mix and conservative slow modulation of size/damping/decay.

**DSP:** compact FDN/Schroeder architecture.

**Visualization:** early/late energy decay timeline and simplified frequency decay view.

**Scope:** EFFECT/GLOBAL.

**CPU:** 2–4/5.

**Default:** medium room, ~1.8 s decay.

**Serialization:** params/quality; delay states runtime only.

**Education:** dense recirculating delays simulate space.

**Tests:** decay stability, stereo decorrelation, finite feedback, quality tiers.

**Edge cases:** size changes mid-tail, high decay.

## 28. Parametric EQ [STANDARD]

**Purpose:** Interactive tonal equalization.

**Inputs:** stereo AUDIO.

**Outputs:** stereo AUDIO.

**Parameters:** dynamic bands with type/frequency/gain/Q/enabled.

**Mod targets:** frequency/gain/Q at control rate.

**DSP:** cascaded biquad filters.

**Visualization:** exact combined frequency-response curve with draggable points; optional input/output spectra.

**Scope:** GLOBAL/EFFECT; VOICE allowed but CPU warned.

**CPU:** 1–2/5.

**Default:** 3 neutral bands.

**Serialization:** band list.

**Education:** frequency-selective boost/cut.

**Tests:** known response, band add/delete, neutral bypass.

**Edge cases:** overlapping extreme bands, Nyquist.

## 29. Compressor [STANDARD]

**Purpose:** Dynamic range control.

**Inputs:** AUDIO; optional sidechain AUDIO in Advanced UI.

**Outputs:** AUDIO; gain-reduction CONTROL optional.

**Parameters:** threshold, ratio, attack, release, knee, makeup, mix, optional lookahead.

**Mod targets:** threshold/makeup/mix; attack/release slow modulation only.

**DSP:** feed-forward compressor or verified equivalent.

**Visualization:** transfer curve, input/output meters, threshold marker, gain reduction history.

**Scope:** EFFECT/GLOBAL.

**CPU:** 1–2/5.

**Default:** gentle 2:1, -18 dB threshold.

**Serialization:** params.

**Education:** dynamic vs static gain.

**Tests:** static curve, timing, knee, gain reduction, silence.

**Edge cases:** zero attack/release, lookahead latency.

## 30. Stereo Utility [STANDARD]

**Purpose:** Pan, width, mono, swap, M/S and Haas operations.

**Inputs:** stereo AUDIO.

**Outputs:** stereo AUDIO; optional M/S pair in Advanced mode.

**Parameters:** operation, pan/balance, width, channel swap, Haas delay.

**Mod targets:** pan/width/Haas time conservative.

**DSP:** equal-power pan, M/S matrix, short delay.

**Visualization:** stereo vectors/position/correlation.

**Scope:** GLOBAL/EFFECT/UTILITY.

**CPU:** 1/5.

**Default:** pass-through.

**Serialization:** params.

**Education:** stereo field and mono compatibility.

**Tests:** M/S roundtrip, mono, swap, pan law.

**Edge cases:** excessive width, mono cancellation.

## 31. Envelope Follower [STANDARD]

**Purpose:** Converts audio amplitude to modulation.

**Inputs:** AUDIO.

**Outputs:** CONTROL.

**Parameters:** attack, release, sensitivity, mode peak/RMS, range/polarity.

**Mod targets:** sensitivity/response times.

**DSP:** rectification/RMS detector plus smoothing.

**Visualization:** audio waveform with follower overlay.

**Scope:** VOICE/GLOBAL.

**CPU:** 1/5.

**Default:** peak follower, 10 ms attack/100 ms release.

**Serialization:** params.

**Education:** deriving control from sound.

**Tests:** step response, silence, scaling.

**Edge cases:** DC input, rapid transients.

## 32. Step Sequencer [STANDARD]

**Purpose:** Modular pitch/note sequence source.

**Inputs:** CLOCK, RESET, transpose PITCH/CONTROL.

**Outputs:** PITCH, GATE, TRIGGER, EVENT.

**Parameters:** 1–64 steps, pitch, gate, velocity, tie, skip, probability, length, direction, swing inheritance.

**Mod targets:** transpose, global gate length; per-step values editable rather than generic audio-rate modulation.

**DSP:** sample-frame transport event generator.

**Visualization:** step grid with active step and note values.

**Scope:** GLOBAL source.

**CPU:** 1/5.

**Default:** 16 steps, simple scale pattern.

**Serialization:** all step data.

**Education:** pitch/gate sequence construction.

**Tests:** timing, reset, direction, ties, probability deterministic seed.

**Edge cases:** BPM/length changes while running.

## 33. Gate/Mod Sequencer [STANDARD]

**Purpose:** Sequenced gates or continuous modulation values.

**Inputs:** CLOCK, RESET.

**Outputs:** GATE/TRIGGER or CONTROL.

**Parameters:** steps, values, interpolation mode, probability, rate/division.

**Mod targets:** value scale/offset.

**DSP:** frame-clocked step/curve output.

**Visualization:** bar/curve lane with active step.

**Scope:** GLOBAL.

**CPU:** 1/5.

**Default:** 8 bipolar modulation steps.

**Serialization:** step values/settings.

**Education:** modulation sequencing vs note sequencing.

**Tests:** interpolation, sync, triggers.

**Edge cases:** zero-length sequence.

## 34. Arpeggiator [STANDARD]

**Purpose:** Converts held notes to timed note sequence.

**Inputs:** EVENT held notes, CLOCK optional.

**Outputs:** EVENT/PITCH/GATE.

**Parameters:** up/down/up-down/random/chord/pattern, octaves, rate, gate, swing, latch.

**Mod targets:** transpose/gate length limited.

**DSP:** held-note set + frame-scheduled events.

**Visualization:** held-note list and active generated note.

**Scope:** GLOBAL event processor.

**CPU:** 1/5.

**Default:** up, 1/8, one octave.

**Serialization:** settings/custom pattern.

**Education:** note-order generation.

**Tests:** duplicate notes, latch, octave range, random seed.

**Edge cases:** notes released mid-step.

## 35. Macro [STANDARD]

**Purpose:** One control drives multiple parameters.

**Inputs:** CONTROL/MIDI mapping.

**Outputs:** CONTROL optional; primarily parameter assignments.

**Parameters:** macro value/name and destination mapping list with min/max/curve/invert.

**Mod targets:** macro value itself.

**DSP:** compiled control mapping; no audio.

**Visualization:** knob/slider plus destination list and live ranges.

**Scope:** GLOBAL utility.

**CPU:** 1/5.

**Default:** unassigned.

**Serialization:** name/value/mappings.

**Education:** coordinated timbral movement.

**Tests:** mapping curves, multiple destinations, circular mapping rejection.

**Edge cases:** destination deleted, macro-to-macro cycles.

## 36. XY Pad [STANDARD]

**Purpose:** Two expressive control axes.

**Inputs:** pointer/touch/MIDI/control optional.

**Outputs:** X CONTROL, Y CONTROL; parameter assignment shortcut.

**Parameters:** ranges, snap, return mode, smoothing, destination maps.

**Mod targets:** X/Y can themselves accept automation/MIDI.

**DSP:** smoothed control values.

**Visualization:** pad trajectory/history.

**Scope:** GLOBAL.

**CPU:** 1/5.

**Default:** center, bipolar X/Y.

**Serialization:** value/ranges/mappings.

**Education:** multidimensional modulation.

**Tests:** pointer/touch, range mapping, smoothing.

**Edge cases:** multi-touch pointer loss.

## 37. Voice Reduce [STANDARD]

**Purpose:** Explicitly convert VOICE control lanes to one GLOBAL control value.

**Inputs:** poly CONTROL/PITCH.

**Outputs:** GLOBAL CONTROL/PITCH.

**Parameters:** mode sum/mean/min/max/latest/highest-note/lowest-note/selected-voice, smoothing.

**Mod targets:** none meaningful.

**DSP:** reducer over active voice lanes.

**Visualization:** voice values and selected/result value.

**Scope:** UTILITY.

**CPU:** 1/5.

**Default:** mean.

**Serialization:** mode/settings.

**Education:** explains ambiguous poly->global control conversion.

**Tests:** all reducer modes, no active voices.

**Edge cases:** changing voice count.

## 38. Clock/Transport [STANDARD]

**Purpose:** Shared tempo and reset source.

**Inputs:** external CLOCK optional, start/stop/reset EVENT.

**Outputs:** CLOCK divisions, bar/beat TRIGGER, transport EVENT.

**Parameters:** BPM, swing, time signature, run state, phase reset.

**Mod targets:** BPM may be automated/control-rate with smoothing/defined phase behavior.

**DSP:** sample-frame clock accumulator.

**Visualization:** BPM, beat/bar counters, phase pulse.

**Scope:** GLOBAL singleton-ish source.

**CPU:** 1/5.

**Default:** 120 BPM 4/4.

**Serialization:** tempo/settings, not live frame.

**Education:** timing reference for sequencers/LFOs/delays.

**Tests:** long-term drift, divisions, reset, BPM change.

**Edge cases:** extreme BPM, external clock dropout.

---

# ADVANCED MODULES

## 39. Ladder Filter [ADVANCED]

Purpose: driven nonlinear resonant low-pass/multimode analog-style filter. Inputs/outputs mirror Multimode Filter. Parameters: cutoff, resonance, drive, poles/mode, oversampling. Mod targets: cutoff/resonance/drive. DSP: verified nonlinear ladder approximation with localized 2× oversampling in high quality. Visualization: response plus drive/resonance. Scope VOICE/GLOBAL. CPU 3–4/5. Default: 4-pole LP, modest drive. Serialize parameters only. Education: feedback resonance and nonlinear filter character. Tests: stability/self-oscillation bounds/oversampling. Edge: extreme resonance and cutoff modulation.

## 40. Wavefolder [ADVANCED]

Purpose: repeated nonlinear folding. Inputs AUDIO; output AUDIO. Parameters threshold/folds/bias/mix/oversampling. Mod targets threshold/bias/mix. DSP bounded fold transfer with 2×/4× oversampling as needed. Visualization transfer curve + waveform. Scope VOICE/GLOBAL. CPU 2–4/5. Default gentle fold. Serialize params. Education: harmonic generation distinct from clipping. Tests symmetry/finiteness/alias reduction. Edge extreme drive.

## 41. Bit Crusher / Sample-Rate Reducer [ADVANCED]

Purpose: digital quantization/hold effects. Inputs AUDIO; output AUDIO. Parameters bits, hold/rate, dither optional, mix. Mod targets bits/rate/mix at control rate. DSP quantize + zero-order hold/fractional phase. Visualization stair-step waveform. Scope GLOBAL/VOICE. CPU 1/5. Default 12-bit mild reduction. Serialize params. Education sampling/quantization. Tests exact levels/hold timing. Edge 1-bit/extreme reduction.

## 42. Euclidean Sequencer [ADVANCED]

Purpose: distribute pulses evenly over steps. Inputs CLOCK/RESET; outputs TRIGGER/GATE. Parameters steps, fills, rotation, probability, accent. DSP Bjorklund or equivalent deterministic pattern generation. Visualization circular/ring pattern plus active step. GLOBAL. CPU 1/5. Serialize pattern settings. Education Euclidean rhythm distribution. Tests known patterns/rotation. Edge fills 0 or = steps.

## 43. Probability Router [ADVANCED]

Purpose: probabilistically route triggers/events. Inputs TRIGGER/EVENT; multiple outputs same type. Parameters probabilities/weights/seed/mode independent or exclusive. DSP deterministic PRNG per event. Visualization routing probability and recent path. GLOBAL. CPU 1/5. Serialize seed/weights. Education controlled randomness. Tests distribution/statistical tolerance and determinism. Edge zero total weight.

## 44. Custom Function Generator [ADVANCED]

Purpose: user-defined mathematical periodic/control shape without arbitrary unsafe JavaScript execution. Inputs phase/time/control variables; outputs CONTROL or AUDIO. Parameters expression built from constrained expression AST/function blocks, frequency, range. DSP compiled safe expression AST from whitelist (`sin`, `cos`, `abs`, `pow`, `tanh`, arithmetic, constants). Visualization function graph and live cursor. VOICE/GLOBAL. CPU 1–4/5 depending expression. Serialize AST, never executable source. Education math-to-sound. Tests parser/AST limits/finite output. Edge division by zero, huge exponent, invalid AST.

## 45. Audio-to-Control / Control-to-Audio Utilities [ADVANCED]

Purpose: explicit semantic rate conversion. Audio->Control modes sample/average/RMS/envelope; Control->Audio produces DC/control signal with smoothing. Visualization source vs converted result. Scope utility. CPU 1/5. Serialize mode/rate/smoothing. Education signal-rate differences. Tests conversions. Edge aliasing when intentionally converting stepped controls.

## 46. Spectral/Harmonic Analyzer [ADVANCED]

Purpose: detailed signal metrics. Input AUDIO, analysis only output/optional harmonic CONTROL values later. Params FFT size/window/fundamental mode. Visualization spectrum, detected fundamental, centroid, harmonic bars. GLOBAL/probe. CPU 2–4/5 but analysis off audio-critical path. Serialize display settings. Education spectra/harmonics. Tests FFT known tones/centroid. Edge noise/no clear pitch.

## 47. Comparator / Logic Utility [ADVANCED]

Purpose: derive gate/trigger from control comparisons and combine gates. Inputs CONTROL/GATE; outputs GATE/TRIGGER. Parameters operation >,<,window,AND/OR/XOR/NOT, threshold, hysteresis. DSP comparisons with hysteresis/edge detection. Visualization thresholds/state. GLOBAL/VOICE. CPU 1/5. Serialize settings. Education control logic. Tests edges/hysteresis. Edge chatter near threshold.

## 48. Slew Limiter [ADVANCED]

Purpose: rate-limit control changes/glide. Input CONTROL/PITCH; output same class. Parameters rise/fall time, linear/exponential. Mod targets times. DSP bounded per-sample slope or one-pole. Visualization input/output history. VOICE/GLOBAL. CPU 1/5. Serialize params. Education portamento/control smoothing. Tests slopes. Edge zero times.

## 49. Sample Delay / Align Utility [ADVANCED]

Purpose: explicit small latency for phase alignment and causal graph design. Input AUDIO/CONTROL; output same. Params delay samples up to practical short range. DSP fixed ring buffer. Visualization samples/time/phase offset. VOICE/GLOBAL. CPU 1/5. Serialize delay. Education phase alignment. Tests exact delay. Edge sample-rate conversion of time display.

---

# EXPERIMENTAL MODULES

## 50. Chaos Generator [EXPERIMENTAL]

Purpose: bounded deterministic chaotic modulation. Inputs reset/rate; outputs 2–3 CONTROL channels. Parameters algorithm (e.g. logistic/Lorenz-inspired discrete safe forms), seed/state, rate, scale, coupling. DSP bounded equations with finite guards. Visualization phase portrait/history. GLOBAL. CPU 1–2/5. Serialize algorithm/seed/params. Education deterministic chaos vs randomness. Tests determinism/bounds. Edge unstable parameter regions forced through safety envelope.

## 51. Random Walk [EXPERIMENTAL]

Purpose: slowly wandering control. Inputs CLOCK/TRIGGER; output CONTROL. Parameters step size, bias, boundary clamp/reflect/wrap, seed, smoothing. Visualization path/history. GLOBAL/VOICE. CPU 1/5. Serialize seed/settings. Education stochastic motion. Tests boundaries/determinism. Edge persistent boundary accumulation.

## 52. Patch Mutation Controller [EXPERIMENTAL]

Purpose: controlled randomization of selected parameters/modules. No direct audio input. Outputs optional TRIGGER on mutation. Parameters mutation amount, target scope, locks, safe/chaos, seed. Algorithm generates PatchCommands only on main thread; never mutates worklet state directly. Visualization list of changed parameters and undo control. GLOBAL utility. CPU negligible. Serialize settings/locks. Education parameter-space exploration. Tests reproducibility/locks/undo. Edge graph-invalid random routes are discarded before commit.

## 53. Phase Interference Lab [EXPERIMENTAL]

Purpose: educational/creative multi-oscillator phase summation module. Inputs 2–4 AUDIO or internal sine generators; output summed AUDIO. Parameters per-source phase/gain/frequency ratio. Visualization overlaid cycles, vector/phasor view, summed waveform. VOICE/GLOBAL. CPU 1–2/5. Serialize setup. Education cancellation/beating/phase. Tests known cancellation/addition. Edge unrelated frequencies where static phasor is only approximate.

## 54. Harmonic Exciter/Partial Modulator [EXPERIMENTAL]

Purpose: dynamically emphasize/generated harmonic regions. Input AUDIO/PITCH reference; output AUDIO. Params harmonic targets, amount, saturation type, tracking. DSP filtered bands/nonlinear synthesis with conservative anti-aliasing. Visualization harmonic ladder. GLOBAL/VOICE high CPU 3–4/5. Serialize params. Education harmonic enhancement. Tests tracking/finiteness. Edge no fundamental detection.

## 55. Generative Event Router [EXPERIMENTAL]

Purpose: transform/branch event streams using probability, state, pattern and constraints. Inputs EVENT/TRIGGER/CLOCK; outputs multiple EVENT/TRIGGER. Parameters rules, seed, density, memory. DSP event-domain state machine, no audio loop cost. Visualization node/path history. GLOBAL. CPU 1/5. Serialize rules/seed. Education generative structure. Tests determinism/no stuck notes. Edge mutually recursive event routes prevented by event-cycle validation or bounded hop count.

---

# FUTURE MODULE CONTRACT RESERVATIONS

## 56. Granular Oscillator/Sampler [FUTURE]

Reserve architecture for local user-loaded sample buffers, grain position/density/size/pitch/randomness and waveform display. Requires explicit file-locality/privacy design and memory limits.

## 57. Spectral Oscillator [FUTURE]

Reserve complex spectrum frame data and inverse FFT/oscillator-bank implementation. Must not block initial architecture.

## 58. Physical Modeling Voice [FUTURE]

Reserve waveguide/resonator family with excitation input, pitch, damping and body parameters.

## 59. Convolution Processor [FUTURE]

Reserve optional IR loading. Large assets are not baseline dependencies.

## 60. External Audio Input [FUTURE]

Reserve microphone/interface input permission flow. Must be opt-in and local only unless policy changes explicitly.

## 61. MPE/MIDI 2.0 Input [FUTURE]

Reserve per-note expression in event model; current `noteId` and per-voice expression storage must not preclude it.

## 62. Microtuning/Scala Module [FUTURE]

Reserve tuning-table transform from logical note to cents/frequency. Core pitch representation must allow non-12-TET mapping later.

---

# 63. Module authoring rules

Every implemented module must provide:

1. `ModuleDefinition` metadata.
2. Parameter definitions through the central parameter schema.
3. Port definitions with signal/rate/scope rules.
4. Runtime DSP factory.
5. Reset and state-transfer behavior.
6. Serialization/migration handler when state shape changes.
7. Educational metadata.
8. Visualization renderer or explicit reason no visualization is needed.
9. Unit tests for nominal behavior and numerical edge cases.
10. CPU class estimate and benchmark scenario.

No module may invent a private parameter-routing or MIDI mapping system outside the shared architecture.

# 64. Module completeness gate

A module is not beta-complete until:

- it produces/changes sound correctly;
- all declared ports connect correctly;
- modulation destinations behave at declared rates;
- serialization round-trips;
- undo/redo handles add/delete/parameter edits;
- visualization reflects real state;
- poly/global scope behavior is tested;
- bypass/mute/reset/panic semantics are defined;
- finite-value fuzz tests pass;
- help text explains purpose and one practical use.
