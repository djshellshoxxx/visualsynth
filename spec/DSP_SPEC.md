# VisualSynth DSP Specification

## 1. DSP goals

The DSP layer must be deterministic, allocation-conscious, unit-testable outside the browser, safe under malformed modulation/extreme values, and suitable for both realtime AudioWorklet execution and offline rendering.

Primary numeric format is JavaScript `Number` for internal state/accumulation with `Float32Array` buffers at graph boundaries and output. Algorithms must not assume a fixed render quantum size.

## 2. Processing order

Per render block:

```text
1. Drain engine events whose frame falls in the block.
2. Apply graph-swap boundary if a pending graph is ready.
3. Update control-rate sources/parameters for the block.
4. For each sample frame:
   a. dispatch sample-accurate events at this frame
   b. update audio-rate parameter sources
   c. render each active VOICE graph
   d. sum voice outputs
   e. render GLOBAL/EFFECT graph
   f. run master safety/output processing
   g. feed enabled probe taps/analysis accumulators
5. Finalize block-level meter/analysis statistics.
6. Post analysis/diagnostics only when due.
```

Control-rate work that can be done once per block must not be repeated per sample.

## 3. Core processing pseudocode

```text
processBlock(outputChannels, blockLength):
  clear output buffers
  blockStart = currentFrame
  blockEnd = blockStart + blockLength

  events = eventQueue.takeRange(blockStart, blockEnd)
  prepareControlRateState(blockStart, blockLength)

  for i in 0 .. blockLength-1:
      frame = blockStart + i
      dispatch events at frame

      for each active voice:
          renderVoiceSample(voice, frame)

      mixedL, mixedR = mixVoiceOutputs()
      globalL, globalR = renderGlobalSample(mixedL, mixedR, frame)
      safeL, safeR = masterSafety(globalL, globalR)

      outputL[i] = safeL
      outputR[i] = safeR
      updateActiveProbes(frame, safeL, safeR)

  currentFrame += blockLength
  finalizeMetersAndAnalysis()
  maybePostAnalysis()
  return true
```

Implementations may process operators in vectorized blocks where semantics permit, but observable timing must match the sample-order model.

## 4. Parameter smoothing

Abrupt UI changes to continuous parameters can click. The centralized parameter runtime supports:

### One-pole smoothing

```text
alpha = 1 - exp(-1 / (timeSeconds * sampleRate))
y[n] = y[n-1] + alpha * (target - y[n-1])
```

Used for gain, pan, cutoff base changes and other continuous manual controls.

### Linear ramp smoothing

For known ramp duration `N`:

```text
step = (target - current) / max(1, N)
current += step each sample until target
```

Useful for graph-swap crossfades, bypass and panic/master ramps.

### No smoothing

Discrete enums, gate/trigger events, phase reset, sequencer step index and parameters whose DSP algorithm already guarantees continuity.

## 5. Modulation evaluation

Each compiled parameter has zero or more modulation routes.

```text
evaluateParameter(p, frame):
  base = automationActive ? automationValue(frame) : p.baseValue
  modSum = 0
  for route in p.routes:
      source = readRouteSource(route)
      source = applyPolarity(source, route)
      source = applyCurve(source, route.curve)
      source = restrictRange(source, route.inputRange)
      modSum += source * route.amount

  raw = applyParameterDomain(base, modSum, p.domain)
  bounded = applyClampMode(raw, p.min, p.max, p.clampMode)
  return p.smoother.process(bounded)
```

### Recommended domains

- frequency/pitch: modulation expressed in semitones or octaves, converted to Hz after sum;
- gain in dB: modulation may operate in dB then convert to linear amplitude;
- normalized 0..1 values: linear normalized modulation;
- bipolar pan: linear in -1..1;
- time: preferably logarithmic for wide ranges.

## 6. Audio-rate vs control-rate

A parameter may be promoted to audio rate only if its definition allows it.

Required audio-rate capable destinations:

- oscillator frequency/pitch for FM/vibrato;
- oscillator phase for PM;
- pulse width/PWM;
- VCA gain/ring modulation;
- filter cutoff;
- filter resonance where algorithm is stable;
- waveshaper drive where modulated;
- delay time for chorus/flanger within artifact-controlled ranges.

Control-rate default destinations:

- reverb room size/decay/damping;
- compressor attack/release/ratio;
- sequencer lengths/probabilities;
- FFT size/visual settings;
- module quality/oversampling mode;
- most routing/mode enums.

## 7. Oscillator core

Every oscillator runtime stores at minimum phase in cycles `[0,1)`. Frequency is clamped to a safe positive range below Nyquist unless the oscillator intentionally supports DC/negative phase motion.

### Phase update

```text
phase += frequencyHz / sampleRate
phase -= floor(phase)
```

For reverse direction, signed increments may be used and normalized with `phase -= floor(phase)`.

### Sine

`sin(2π phase)`.

A lookup table is optional only if profiling proves faster without unacceptable interpolation error.

### Naive saw reference

`2 * phase - 1` is not acceptable as the production high-frequency saw because it aliases.

### PolyBLEP correction

```text
polyBlep(t, dt):
  if t < dt:
      x = t / dt
      return x + x - x*x - 1
  if t > 1 - dt:
      x = (t - 1) / dt
      return x*x + x + x + 1
  return 0
```

Saw:

```text
y = 2*phase - 1
y -= polyBlep(phase, frequency/sampleRate)
```

Square/pulse uses a correction at each discontinuity.

### Triangle

Preferred implementation:

1. generate band-limited square;
2. integrate;
3. apply leak/DC compensation;
4. normalize.

Alternative band-limited harmonic table is permitted if tests demonstrate equivalent quality/stability.

### Variable saw/triangle

Use phase-distortion/morph functions that preserve bounded output. Discontinuity locations must receive BLEP correction where present.

### Pulse width

Clamp default practical width to `[0.01, 0.99]` for normal mode. Advanced mode may approach extremes but must retain finite output. Remove DC caused by asymmetric pulse where desired through a mode-specific correction.

### Sub oscillator

A phase-locked divider of the main oscillator at -1 or -2 octaves, selectable sine/square/triangle. Phase reset behavior follows parent oscillator unless free-run is chosen.

### Supersaw/multi-saw

A cluster of `N` band-limited saws with deterministic phase offsets and symmetric detune distribution.

```text
for j in voices:
  cents = detuneCurve(j, N) * spreadCents
  f_j = baseHz * 2^(cents/1200)
  y += saw_j(f_j)
normalize by energy-aware factor
apply stereo pan distribution if enabled
```

Quality tiers may cap N.

### Additive oscillator

```text
y = Σ amp[h] * sin(2π * h * phase + phaseOffset[h])
for h where h * fundamental < Nyquist
normalize according to selected mode
```

Partial arrays are immutable/shared until edited. A practical initial maximum is 64–128 partials, with Nyquist culling each block.

### Wavetable oscillator

Wavetable set consists of frames, each frame containing band-limited mip levels.

At block/control preparation:

1. choose two wavetable frames from morph position;
2. choose appropriate mip level from fundamental/max instantaneous frequency;
3. linearly or cubic-interpolate table samples;
4. crossfade frames.

The wavetable editor stores source frames; mip levels are generated/cached, not serialized redundantly.

### Drawable waveform

A user-drawn single-cycle source is resampled to a fixed canonical table, DC-corrected, normalized, then converted into band-limited mip levels using FFT/harmonic truncation or equivalent offline preparation.

## 8. Oscillator sync and phase reset

Hard sync is Advanced. When master wraps, slave phase resets. Because reset creates a discontinuity, anti-alias correction is required. Soft sync may reverse direction or phase-pull according to selected algorithm.

Phase reset event occurs sample-accurately at gate/note trigger if retrigger mode enabled.

## 9. Noise generators

Use deterministic seeded PRNG per module/voice for reproducible patches and offline renders.

### White

Uniform or approximately Gaussian white noise, normalized.

### Pink

Use a tested efficient pink-noise algorithm such as filtered white/Voss-McCartney. Statistical tests should verify falling spectral slope within tolerance.

### Brown

Leaky integration of white noise with normalization/DC control.

### Blue/violet

Differentiated pink/white forms with bounded gain.

Noise modules may expose seed and `reseed` trigger.

## 10. ADSR envelope

Envelope is sample-accurate and event-driven.

States: `IDLE`, `ATTACK`, `DECAY`, `SUSTAIN`, `RELEASE`.

Curves may be linear or exponential-shaped while guaranteeing finite endpoints.

```text
onGateOn(retriggerPolicy):
  if policy == RESET: value = 0
  state = ATTACK

onGateOff():
  releaseStart = value
  state = RELEASE

processSample():
  switch state:
    ATTACK: advance toward 1 over attack time
    DECAY: advance toward sustain over decay time
    SUSTAIN: value = sustain
    RELEASE: advance from releaseStart toward 0 over release time
             if finished -> IDLE
```

Zero-time stages must transition without division by zero.

## 11. Multi-stage envelope

Represent as ordered segments:

```ts
{target:number, duration:number, curve:number, hold?:boolean}
```

Segments may loop between `loopStart`/`loopEnd`, run one-shot, gate-held or tempo-synced. The editor operates on the same serialized segment list.

## 12. LFO

LFO oscillator shares normalized waveform helpers but defaults to control rate when frequency is low and destination does not demand audio rate.

Modes:

- free-run;
- note retrigger;
- transport retrigger;
- one-shot;
- fade-in/delay;
- tempo-synced divisions.

Random LFO forms use deterministic seed and explicit sample/hold timing.

## 13. Sample and hold / random walk

Sample-and-hold updates value on trigger/clock edge.

Smooth random interpolates between deterministic random targets.

Random walk:

```text
value += randomSigned() * stepSize
value = boundaryMode(value) // clamp, reflect, wrap
```

Probability trigger compares seeded random value against probability per incoming trigger.

## 14. Mixer

Each input has level, mute, solo, polarity and pan.

Use equal-power pan:

```text
angle = (pan + 1) * π/4
leftGain = cos(angle)
rightGain = sin(angle)
```

For stereo inputs, pan behavior is selectable between balance and true stereo pan later; initial implementation may use balance preserving channel identity.

Mixer sum uses accumulator values then finite/peak guard. Mixer itself should not hard-clip unless a saturation mode is selected.

## 15. VCA

Default:

`out = input * linearGain(base + modulation)`

Gain parameter supports linear or dB display modes. Audio-rate control enables AM/tremolo. Bipolar control permits ring-like inversion only when explicitly enabled.

## 16. Ring modulator

Four-quadrant multiplication:

`out = carrier * modulator * gain`

If a depth control is exposed:

`out = lerp(carrier, carrier*modulator, depth)`

## 17. Frequency modulation

Linear FM:

`instantaneousHz = baseHz + modSignal * depthHz`

Exponential FM:

`instantaneousHz = baseHz * 2^(modSignal * depthOctaves)`

PM:

`samplePhase = phase + modSignal * depthCycles`

PM is often more numerically convenient for stable digital FM-style synthesis. UI must label linear FM vs exponential FM vs PM distinctly.

## 18. Filter core: TPT state-variable filter

Core multimode filter SHOULD use a topology-preserving transform SVF or equivalent stable zero-delay-feedback structure.

Inputs: audio `x`, cutoff `fc`, resonance/Q `Q`.

Implementation must:

- clamp `fc` below Nyquist with margin;
- transform cutoff with `g = tan(π fc / sampleRate)` or a tested approximation;
- maintain stable integrator state;
- expose low-pass, band-pass, high-pass and notch combinations;
- guard extreme Q.

Exact coefficient equations must be implemented from a verified DSP reference and tested against expected frequency response.

### Slopes

12 dB/oct from one 2-pole stage. 24 dB/oct via cascaded stages, with resonance behavior calibrated.

### Key tracking

```text
cutoffSemitoneOffset = (note - referenceNote) * keyTrackAmount
cutoffHz *= 2^(cutoffSemitoneOffset/12)
```

## 19. Ladder-style filter

Advanced module. Requirements:

- nonlinear saturation in stages or feedback path;
- conservative resonance normalization;
- optional 2× oversampling under drive/high resonance;
- self-oscillation may be allowed but must remain finite;
- CPU class high.

Exact model may be selected during implementation benchmark phase; module contract is fixed even if algorithm evolves.

## 20. EQ

Parametric EQ bands can use biquad peaking/shelf filters. Each band stores type, frequency, gain, Q and enabled state. Frequency response curve is computed from exact coefficients or mirrored formula rather than decorative drawing.

At least:

- low shelf;
- high shelf;
- bell/peak;
- optional high-pass/low-pass bands.

## 21. Waveshaper/distortion

### Soft clip example

`tanh(drive * x) / tanh(drive)` with handling for drive near zero.

### Hard clip

`clamp(x * drive, -threshold, threshold) / threshold`.

### Foldback

Use a bounded folding function with defined behavior for threshold > 0. Avoid modulo edge discontinuities that produce NaN.

### Rectification

Half-wave and full-wave modes.

### Bit crusher

Amplitude quantization:

```text
levels = 2^bits
q = round(x * (levels/2)) / (levels/2)
```

Sample-rate reduction holds a sample for `N` input frames or uses fractional phase for noninteger reduction ratios.

### Oversampling

Nonlinear modes request local 2×/4× oversampling when quality tier allows:

```text
upsample -> low-pass/interpolate -> nonlinear process -> low-pass -> decimate
```

Use proper half-band/IIR/FIR filters chosen for CPU/quality; never simply duplicate samples without reconstruction filtering and call it oversampling.

## 22. Delay

Circular buffer per channel.

```text
writeIndex increments modulo bufferLength
readPos = writeIndex - delaySamples
sample = interpolatedRead(readPos)
write = input + sample * feedback
output = dryWet(input, sample)
```

Fractional delay interpolation: linear minimum; cubic/allpass optional quality mode.

Feedback magnitude defaults below 1.0. Expert range may approach/temporarily exceed unity only with visible warning plus soft saturation and finite-value protection.

Tempo sync converts note division to seconds from transport BPM.

## 23. Chorus/flanger

Use one or more modulated short delay lines.

- chorus: longer base delay, lower feedback, stereo phase offset;
- flanger: shorter delay, stronger feedback, comb-filter effect.

Delay modulation must be smoothed/interpolated to avoid zipper noise.

## 24. Phaser

Cascade 2–12 first/second-order all-pass stages with LFO-modulated center frequencies. Mix dry/wet and optional feedback.

## 25. Reverb

Initial algorithm: compact FDN/Schroeder-class reverb.

Structure:

```text
pre-delay -> input diffuser/allpass -> parallel/coupled delay network
          -> damping filters -> stereo output mix
```

Parameters map to physically/musically sensible ranges:

- size alters delay scale;
- decay maps feedback gains while maintaining stability;
- damping controls high-frequency loss in feedback;
- pre-delay 0..~250 ms;
- width/stereo decorrelation;
- wet/dry equal-power blend.

No mandatory external impulse response.

## 26. Compressor

If native `DynamicsCompressorNode` is not used inside the compiled worklet, implement feed-forward detector:

1. sidechain absolute/RMS envelope;
2. attack/release smoothing;
3. static curve from threshold, ratio, knee;
4. gain computer in dB;
5. makeup gain;
6. optional lookahead only if module declares latency.

Transfer-curve visualization is derived from the same static curve function.

## 27. Envelope follower

Converts audio amplitude to CONTROL.

```text
rectified = abs(x)
if rectified > env:
  coeff = attackCoeff
else:
  coeff = releaseCoeff
env = coeff*env + (1-coeff)*rectified
```

Optional RMS window mode may be added.

## 28. Stereo utilities

### Mid/side

`M = (L+R)/sqrt(2)`
`S = (L-R)/sqrt(2)`

Inverse uses corresponding orthonormal transform.

### Width

Scale `S`, then decode. Width=0 mono, 1 unchanged, >1 wider with headroom caution.

### Haas delay

Short one-channel delay. UI must explain mono compatibility/comb filtering.

### Correlation

Master stereo analyzer estimates normalized correlation over a sliding/block window.

## 29. Sequencer timing

Transport uses sample/frame phase, not UI timers.

```text
framesPerBeat = sampleRate * 60 / bpm
stepFrames = framesPerBeat * beatsPerStep
```

Swing offsets alternating subdivisions while preserving long-term bar alignment.

Step events are queued at exact target frames. UI highlight may lag slightly but audio event timing must not.

## 30. Arpeggiator

Maintain held-note set ordered by note-on sequence and/or pitch. Pattern modes generate timestamped note events using transport divisions. Gate length is fraction of step duration.

## 31. Automation playback

Automation lane stores ordered points/segments.

```text
valueAt(frame):
  locate current segment using cached cursor
  if step: return left.value
  if linear: interpolate
  if curve: evaluate normalized curve/exponent/bezier approximation
```

Do not binary-search from the start per sample; cache current segment and advance monotonically during playback.

## 32. Offline rendering pseudocode

```text
renderOffline(patch, events, options):
  migrated = migratePatch(patch)
  ir = compile(migrated, options.sampleRate)
  runtime = new RuntimeGraph(ir, sampleRate)
  runtime.loadEventTimeline(events)
  encoder = new WavEncoder(options.format)

  totalFrames = duration * sampleRate
  for frame = 0; frame < totalFrames; frame += blockSize:
      if cancelRequested: abort cleanly
      n = min(blockSize, totalFrames-frame)
      block = runtime.process(n)
      encoder.append(block)
      report progress occasionally

  return encoder.finalize()
```

Offline render must be deterministic for seeded random modules given the same patch, event timeline, sample rate and app/DSP version.

## 33. WAV encoding

16-bit PCM:

`round(clamp(x,-1,1) * 32767)` with negative endpoint handling.

24-bit PCM: signed 24-bit little-endian.

32-bit float: IEEE 754 float samples.

Header sizes must be validated. Files exceeding classic RIFF size limits are a future RF64 concern and should be rejected with a clear message rather than silently corrupted.

## 34. Scope probe capture

Probe DSP tap is deliberately cheap.

```text
for each probed sample:
  peakAbs = max(peakAbs, abs(x))
  if decimationCounter == 0:
      ring[write++] = x
  decimationCounter = (decimationCounter + 1) % decimationFactor
```

At visualization interval, a bounded snapshot plus metrics is copied to a transferable message payload. Probe capture rate is independent of screen frame rate.

## 35. Spectrum analysis

Master spectrum may use native `AnalyserNode` or custom FFT analysis outside the critical per-sample module loop. Per-probe FFTs are budgeted and computed only for visible probes.

Recommended sizes:

- compact module: 512/1024;
- master default: 2048/4096;
- detailed/frozen: up to 8192/16384 if device budget allows.

Windowing (e.g. Hann) is required for custom FFT. Spectrum UI must label amplitude convention consistently.

## 36. Spectrogram

Spectrogram consumes sequential FFT frames into a fixed-size time-frequency image buffer. It is a visualization feature, never a dependency for audio. Under load, reduce FFT rate/resolution before altering sound processing.

## 37. Filter-response visualization

For filters whose transfer function is known analytically, response curves are calculated from actual coefficients/parameters over logarithmically spaced frequencies.

For complex nonlinear filters, the UI may display an approximate small-signal response and must label it as such when drive materially changes the response.

## 38. Signal inspector metrics

Where applicable:

- peak: max absolute sample over analysis window;
- RMS: sqrt(mean(x²));
- DC offset: mean(x);
- dominant frequency: max spectral bin with interpolation optional;
- spectral centroid: weighted mean frequency;
- harmonic distribution: amplitudes around integer multiples of detected fundamental;
- stereo correlation: normalized L/R covariance;
- phase relationship: derived from stereo scope/Lissajous or targeted oscillator comparison.

Advanced metrics are computed at visualization/worker rate, not audio rate.

## 39. Finite-value safety

At module output boundaries in debug/test builds and selected strategic boundaries in release:

```text
if !isFinite(sample):
  sample = 0
  moduleFaultCounter++
```

If repeated faults exceed threshold within a window, fail-silent that module instance and report it.

## 40. DC protection

Modules likely to create DC (asymmetric waveshaping, pulse extremes, feedback) must either correct DC internally or expose it intentionally. Master output includes a gentle high-pass/DC blocker at a very low cutoff or equivalent protection that does not audibly thin normal bass.

## 41. Master amplitude guard

Master chain target:

```text
global graph -> optional user master processors -> DC protection
             -> soft emergency guard/limiter -> master gain -> output
```

The emergency guard is not a loudness maximizer. It exists to prevent extreme digital values from reaching the output during patch mistakes.

## 42. Panic

Worklet panic action:

```text
onPanic:
  eventQueue.clear()
  voiceAllocator.reset()
  for module in runtime:
      module.resetForPanic()
  masterRamp.setImmediateTarget(0, veryShortRamp)
  outputZeroUntilStable = true for at least one block
```

Main thread also ramps outer GainNode to zero.

## 43. CPU quality tiers

`ECO`, `NORMAL`, `HIGH`.

Examples:

- supersaw count 3/5/7+;
- reverb delay-network density low/normal/high;
- nonlinear oversampling 1×/2×/4× where relevant;
- wavetable interpolation linear/cubic;
- probe/FFT refresh/resolution reduced first.

Patch serialization stores preferred quality but runtime may downgrade transiently if device constraints require it. Any sound-affecting downgrade must be visible in diagnostics/status, not hidden.

## 44. Performance budget targets

Targets are measured on representative modern desktop hardware and adjusted after benchmark work:

- normal patch at 16 voices should remain comfortably below sustained render deadline;
- 32 voices should be possible for simple subtractive patches;
- heavy advanced modules may lower recommended polyphony but not break timing;
- UI visualization should aim for 30–60 fps while permitting degradation to 15 fps;
- graph compile should remain interactive for ordinary patches and move to Worker when large patches exceed target latency.

Exact millisecond thresholds depend on sample rate/render quantum and are established during Phase 10 benchmarking.

## 45. DSP test tolerances

Examples:

- oscillator frequency error: < 0.1 cent for stable tones excluding intentional modulation;
- sine THD: limited primarily by floating point, with no unexpected harmonics above test floor;
- band-limited saw/square: alias-energy tests must outperform naive reference by defined dB threshold;
- envelope stage timing: within 1 sample of configured duration where sample-exact;
- filter response: within implementation-specific tolerance against reference coefficients;
- pan law: center approximately -3.01 dB/channel for equal-power mono source;
- offline/realtime deterministic block engine: sample-identical or tolerance-defined where browser/native nodes differ;
- no NaN/Infinity for fuzzed legal parameter ranges.

## 46. DSP implementation audit checklist

Before beta:

- every nonlinear module reviewed for aliasing;
- every feedback module reviewed for stability;
- every stateful module implements reset/state transfer policy;
- every random source supports deterministic seed;
- every parameter documents control/audio rate;
- every filter documents cutoff/resonance safe range;
- every delay validates buffer bounds;
- every oscillator handles Nyquist edge cases;
- all zero-time envelope stages tested;
- all bypass transitions de-clicked;
- panic proven under intentionally unstable patches.
