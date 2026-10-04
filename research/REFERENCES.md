# VisualSynth Research References

This file records sources consulted during the specification phase. Sources are used for architecture and API behavior, not to reproduce proprietary product designs.

## Browser audio and MIDI

1. MDN — AudioWorklet
   https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet

2. MDN — AudioWorkletNode
   https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode

3. MDN — AudioWorkletProcessor.process()
   https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process

4. Web Audio API Specification
   https://webaudio.github.io/web-audio-api/

5. MDN — Web MIDI API
   https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API

6. MDN — Navigator.requestMIDIAccess()
   https://developer.mozilla.org/en-US/docs/Web/API/Navigator/requestMIDIAccess

7. MDN — OfflineAudioContext
   https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext

8. MDN — AnalyserNode
   https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode

9. MDN — BiquadFilterNode and getFrequencyResponse()
   https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode
   https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode/getFrequencyResponse

10. MDN — DynamicsCompressorNode
    https://developer.mozilla.org/en-US/docs/Web/API/DynamicsCompressorNode

11. MDN — StereoPannerNode
    https://developer.mozilla.org/en-US/docs/Web/API/StereoPannerNode

12. MDN — crossOriginIsolated / COOP / COEP
    https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated
    https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy
    https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy

## Modular and polyphonic synthesis concepts

13. VCV Rack Manual — Polyphony
    https://vcvrack.com/manual/Polyphony

14. VCV Rack Manual — Voltage Standards / polyphonic module behavior
    https://vcvrack.com/manual/VoltageStandards

15. VCV Rack Manual — Plugin API Guide
    https://vcvrack.com/manual/PluginGuide

16. VCV Rack Manual — User Manual
    https://vcvrack.com/manual/

The VCV sources were used to study understandable visible patching and practical polyphonic signal concepts. VisualSynth does not copy VCV's implementation or appearance.

## DSP references and implementation background

17. Julius O. Smith III, *Physical Audio Signal Processing* and related online DSP texts
    https://ccrma.stanford.edu/~jos/

18. Julius O. Smith III, *Spectral Audio Signal Processing*
    https://ccrma.stanford.edu/~jos/sasp/

19. Välimäki and Huovilainen, research on virtual analog filters and oscillator alias reduction. These works inform the decision to use band-limited oscillators and stable filter structures rather than naive discontinuous waveforms.

20. Stilson/Smith and later PolyBLEP/minBLEP literature/engineering practice for correcting discontinuities in virtual analog oscillators.

21. Jon Dattorro, *Effect Design Part 1: Reverberator and Other Filters*, for feedback-delay-network/reverberation concepts.

## Product/workflow references reviewed conceptually

The following systems were reviewed for workflow categories and user expectations only. No proprietary appearance, preset content, or closed implementation detail is to be copied:

- VCV Rack
- Cardinal
- Bitwig Grid
- Max/MSP
- Pure Data
- Reaktor
- Voltage Modular
- Reason Rack
- Ableton modulation workflows
- Surge XT
- Vital
- Serum
- Pigments
- Phase Plant

The recurring useful concepts were: visible signal flow, direct manipulation, modulation visibility, macros, patch templates, probe/scope utilities, polyphonic abstraction, and progressive disclosure of complexity.

## Project reference

22. Circuit Drift Labs BrowserToneGen
    https://github.com/djshellshoxxx/browsertonegen

BrowserToneGen was inspected for architectural ideas including AudioWorklet ownership, DSP/model separation, deterministic noise, PolyBLEP-style oscillator correction, validation, analysis, diagnostics, WAV export, browser testing, and GitHub Pages deployment. It remains a separate project and is not modified by VisualSynth.

## Research rules carried into implementation

- Prefer standards-based browser APIs over nonportable tricks.
- Do not require SharedArrayBuffer for the baseline build.
- Do not assume Web MIDI exists.
- Do not assume render quanta will always contain 128 frames.
- Keep real-time audio processing free of allocation-heavy UI concerns.
- Keep signal visualization subordinate to audio-thread deadlines.
- Use references to understand architecture, not to clone commercial products.
