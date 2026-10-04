# VisualSynth Visualization Specification

## 1. Purpose

Visualization is a first-class feature but never a realtime-audio dependency. Displays must show meaningful parameter state or measured signal state and must degrade gracefully before audio processing is affected.

## 2. Visualization classes

### State-derived

Calculated from known module parameters without sampling audio:

- oscillator mathematical waveform preview;
- envelope curve;
- LFO curve;
- filter/EQ frequency response;
- waveshaper transfer function;
- panner/stereo position;
- sequencer steps;
- macro/XY mapping ranges;
- delay timing grid;
- automation curves.

These may render entirely on the main thread from patch state.

### Signal-derived

Require actual engine data:

- post-processing waveform;
- mixer result waveform;
- scope probe;
- input/output spectra;
- master oscilloscope;
- RMS/peak meters;
- spectrogram;
- DC/centroid/dominant frequency/harmonic metrics;
- stereo correlation/phase.

Signal-derived visuals use explicit taps and bounded analysis messages.

## 3. Centralized scheduler

There is exactly one application-level visualization scheduler.

```ts
interface VisualTask {
  id: string;
  priority: 0|1|2|3|4;
  targetHz: number;
  visible: boolean;
  dirty: boolean;
  lastRenderMs: number;
  render(nowMs: number): void;
}
```

A single `requestAnimationFrame` loop decides which tasks render.

### Priority

- P0: clip indicator, master meters, currently manipulated control visual.
- P1: selected module, open probe, performance view.
- P2: visible ordinary module visuals.
- P3: educational overlays/background histories.
- P4: offscreen/collapsed; usually frozen.

## 4. Scheduling pseudocode

```text
onAnimationFrame(now):
  frameBudgetMs = adaptiveVisualizationBudget()
  work = tasks sorted by priority then lateness

  for task in work:
      if !task.visible and task.priority > 1: continue
      period = 1000 / effectiveHz(task)
      if now - task.lastRender < period and !task.dirty: continue
      if elapsedThisFrame >= frameBudgetMs and task.priority > 0: break
      task.render(now)
      task.lastRender = now
      task.dirty = false

  update visualization performance stats
  request next frame
```

The scheduler never blocks waiting for new analysis data. It renders latest available snapshot.

## 5. Adaptive visual load

When UI frame time rises or audio diagnostics warn of high DSP load:

1. reduce P3 refresh;
2. freeze offscreen P2/P4;
3. reduce oscilloscope sample count/decimation;
4. reduce per-probe FFT cadence;
5. reduce master spectrogram cadence/FFT size;
6. disable decorative cable activity animation;
7. preserve P0 meters/clip and interaction feedback.

Automatic sound-quality changes are separate and happen only after visualization reductions.

## 6. Analysis message transport

Worklet analysis messages are versioned and compact.

```ts
interface AnalysisPacket {
  version: number;
  engineFrame: number;
  patchRevision: number;
  master?: MasterAnalysis;
  probes?: ProbeAnalysis[];
  diagnostics?: EngineAnalysisStats;
}
```

Packets may omit unchanged/undue sections.

Analysis message rate target: 15–30 Hz aggregate under normal conditions, not per module.

## 7. Probe budget

Probe instrumentation has explicit limits configurable by quality tier.

Recommended Normal defaults:

- up to 8 live waveform/control probes at full visual cadence;
- up to 4 simultaneous FFT probe views;
- additional probes remain attached but update at reduced rate when not selected;
- master analysis is reserved budget and not displaced by ordinary probes.

The engine must not allocate a new large array per probe per audio block.

## 8. Scope Probe

Views:

- waveform;
- stereo waveform;
- spectrum;
- level history;
- combined waveform+spectrum.

Controls:

- time scale;
- amplitude scale/autoscale;
- trigger mode/free/zero-crossing;
- freeze;
- zoom;
- selected poly voice/all voice sum;
- FFT size/window for spectrum.

Frozen data is a UI copy and does not keep the audio tap at expensive settings unless needed.

## 9. Control Probe

Views:

- value history;
- gate/trigger event track;
- pitch history with note/cents labels;
- bipolar zero reference.

For poly signals, default view shows selected voice plus faint range/min-max envelope across voices; user may choose a specific voice.

## 10. Oscillator visualization

Two modes can coexist:

### Source preview

Displays ideal source shape from oscillator parameters. Always available, cheap, and editable.

### Measured output

When expanded or selected, optional tap shows actual generated waveform after FM/PM/PWM/unison/processing.

UI labels `SOURCE` and `OUTPUT` to avoid implying the mathematical preview is measured signal.

Additional displays:

- frequency/note;
- phase marker;
- harmonic spectrum in expanded editor;
- detune fan for supersaw;
- wavetable frame position.

## 11. Mixer visualization

Default compact view:

- per-input peak bars;
- combined output waveform thumbnail;
- headroom indicator.

Expanded educational view:

- overlay input traces with distinct trace identities;
- summed trace;
- optional polarity/phase cancellation hint.

Do not run separate FFT per mixer input by default.

## 12. Filter visualization

Always available state-derived layer:

- log frequency x-axis;
- gain dB y-axis;
- actual response curve from coefficients/algorithm approximation;
- cutoff marker;
- resonance/Q marker;
- slope/mode label.

Optional signal layer when expanded/selected:

- input spectrum in subdued style;
- output spectrum stronger;
- spectral difference shading.

For nonlinear driven filters, response curve is labeled `small-signal response` if it cannot represent level-dependent behavior exactly.

## 13. Envelope visualization

Envelope graph is parameter-derived. During active voices:

- current voice cursor is shown;
- in polyphony, selected/latest voice cursor is primary;
- optional thin markers show other voices;
- current numeric value shown.

Do not animate dozens of independent full envelope canvases per voice.

## 14. LFO visualization

Display one or two cycles at current rate/shape independent of actual slow timeline. A live phase cursor shows current position. Output scale indicates bipolar/unipolar range and depth.

If attached destinations exist, clicking destination highlights its modulation arc/range.

## 15. Waveshaper visualization

Three coordinated mini-panels in expanded mode:

```text
INPUT WAVE -> TRANSFER CURVE -> OUTPUT WAVE
```

Transfer curve is state-derived. Input/output waveforms use a single tap pair only while view is visible.

## 16. Delay visualization

Use an echo timeline rather than an expensive full waveform by default:

- input at time zero;
- repeat markers spaced by delay time;
- marker height decays by feedback estimate;
- stereo ping-pong alternates sides;
- filter coloration indicated by compact brightness/spectral tilt icon.

Optional measured activity pulses reflect actual delay output level.

## 17. Reverb visualization

Default:

- pre-delay marker;
- early/late energy envelope;
- decay-time estimate;
- damping spectral tilt.

Expanded measured mode may show input vs wet RMS decay history, but no decorative particle system.

## 18. Compressor visualization

- static transfer curve with threshold/knee/ratio;
- moving input level point;
- gain-reduction meter/history;
- input/output peak/RMS.

Transfer curve must use the same gain computer function as DSP.

## 19. EQ visualization

- exact combined response curve;
- draggable band handles;
- optional input/output spectrum overlay only when selected/expanded.

## 20. Stereo visualization

Available views:

- L/R meters;
- correlation meter;
- vectorscope/Lissajous;
- pan/width diagram.

Correlation and phase displays use actual master/probe samples.

## 21. Master dashboard

Modes:

### Oscilloscope
Time-domain stereo waveform, trigger/free modes, time/amplitude zoom, freeze.

### Spectrum
FFT magnitude on log-frequency axis. Frequency cursor reports Hz/note and level.

### Spectrogram
Scrolling time-frequency display with configurable range/FFT cadence.

### Stereo/Phase
Vectorscope + correlation + L/R meters.

### Level
Large peak/RMS/clip/history view.

### Combined
Compact scope, spectrum, meters and correlation simultaneously.

Master dashboard can undock/expand but remains one scheduler task family.

## 22. FFT strategy

Custom FFT analysis uses a reusable FFT plan/buffer. If a small dependency is selected for FFT, it must be benchmarked and isolated; otherwise implement/test radix-2 FFT in analysis worker.

Windowing: Hann default.

FFT sizes:

- compact: 512–1024;
- standard master: 2048–4096;
- detailed/frozen: up to 16384 when hardware allows.

Frequency axis is logarithmic for musical displays, with optional linear mode in Advanced settings.

## 23. Spectrogram strategy

A ring texture/image buffer stores columns. New columns are produced from master FFT frames at 10–30 Hz. Canvas 2D is baseline. WebGL/WebGPU is considered only if Canvas profiling shows unacceptable CPU usage at desired resolution.

## 24. Signal Inspector

Advanced probe/master inspector can show:

- frequency/pitch estimate;
- peak;
- RMS;
- DC offset;
- dominant frequency;
- spectral centroid;
- harmonic distribution;
- stereo correlation;
- sample rate/window/FFT settings.

Metrics disclose limitations: e.g. `dominant frequency` is not labeled as pitch when signal is noisy/polyphonic.

## 25. Cable activity visualization

Audio cable activity uses level envelope, not raw audio samples. Control cable activity uses current normalized control value. Event cables flash on events.

Reduced-motion mode:

- no moving dashes/pulses;
- use static brightness/thickness/value badge changes;
- flash frequency capped and accessibility-safe.

## 26. Polyphony visualization

Avoid rendering a separate full cable for every voice. Instead:

- poly cable appears slightly thicker/multi-stripe;
- badge shows active lane count (`6v`);
- inspector/probe can select individual voice;
- Voice Sum module can show per-voice levels.

## 27. Visual Signal Flow Mode

Engine/graph compiler provides path metadata; UI does not infer audio semantics from screen position.

For selected source->master trace:

- path modules highlighted in execution/routing order;
- each stage can show before/after thumbnail;
- causal feedback loops represented as loop branch with delay marker;
- voice/global transition marked;
- parallel routes displayed as branches.

## 28. Compare Mode visualization

For A/B snapshots:

- filter/EQ curves overlay A and B;
- waveform/spectrum may freeze A capture while B runs;
- parameter controls display small A/B ticks;
- audio switching uses de-clicked crossfade.

## 29. Visualization workers

Heavy non-realtime analysis may be moved to a dedicated Worker:

- FFT/spectrogram column creation;
- harmonic analysis;
- dominant-frequency estimation;
- large waveform decimation;
- preview generation.

The worklet only captures/decimates enough data to feed analysis safely.

## 30. Memory management

- reuse typed arrays;
- fixed-size ring buffers;
- cap waveform history length;
- cap spectrogram time depth;
- no unbounded diagnostic histories;
- transfer ownership of large one-shot analysis buffers where useful;
- avoid per-frame object creation in hot renderer paths.

## 31. Visibility detection

Use viewport/workspace knowledge and optionally `IntersectionObserver` for DOM panels to mark visual tasks visible/offscreen. A module outside logical viewport does not need full-rate waveform updates even if still mounted.

## 32. Reduced-motion behavior

When `prefers-reduced-motion: reduce` or app setting enabled:

- cable activity motion disabled;
- envelope/LFO cursors may update at reduced stepped rate;
- scopes remain functional but do not auto-pan unnecessarily;
- spectrogram still updates if requested because information, not decoration, is its purpose;
- flashing alerts use nonflashing alternatives.

## 33. Accuracy labeling

Visuals must identify these distinctions where relevant:

- `SOURCE PREVIEW` vs `MEASURED OUTPUT`;
- `RESPONSE` vs `MEASURED SPECTRUM`;
- `ESTIMATED` metric when algorithm is approximate;
- `SELECTED VOICE` vs `VOICE SUM`.

## 34. Visualization acceptance tests

1. Collapsing/offscreening a module measurably reduces its visual work.
2. Adding ten hidden probes does not produce ten full-rate rendering loops.
3. Scope Probe does not change audio samples beyond floating-point identity/tolerance.
4. Filter response updates from the same coefficients/parameters as DSP.
5. Envelope cursor follows engine state, not UI timer.
6. Under synthetic UI load, audio continues while visual FPS drops.
7. Reduced-motion mode removes cable movement without hiding routing state.
8. Master clipping indicator reacts even when other visual tasks are throttled.
9. Frozen scope retains snapshot while underlying audio continues.
10. Deleting a probed connection cleans analysis instrumentation without leaked scheduler tasks.
