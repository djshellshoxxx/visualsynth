# VisualSynth

VisualSynth is a browser-based visual modular synthesizer from Circuit Drift Labs. The project is currently in the **research, architecture, and specification phase**. No production synthesizer implementation is included yet.

The product goal is to combine four things without weakening the first two: a serious playable synthesizer, a flexible modular synthesis environment, a visual explanation of the active signal path, and an interactive learning/sound-design environment.

The governing design rule is: **everything that affects the sound should, wherever practical, be visible.** The paired quality test is that an experienced synthesizer user must still find the instrument useful after educational assistance is disabled.

## Planned system

VisualSynth is specified as a static GitHub Pages application targeting:

`https://djshellshoxxx.github.io/visualsynth/`

The architecture uses a versioned patch model, graph compiler, AudioWorklet-hosted modular DSP engine, explicit per-voice/global processing domains, typed patch connections, centralized parameter metadata, MIDI/keyboard input, scoped analysis probes, and a centralized visualization scheduler. The browser UI and audio thread are deliberately decoupled so graphics can degrade before audio quality does.

Core planned capabilities include oscillators, mixer, multimode filters, envelopes, VCAs, LFOs, modulation, MIDI, polyphony, effects, patch cables, scopes, FFT/spectrogram views, recording/export, presets, templates, Learning Mode, Visual Signal Flow Mode, Compare Mode, diagnostics, and versioned patch import/export.

## Specification set

- `research/RESEARCH.md` — technical findings and design conclusions
- `research/REFERENCES.md` — research sources
- `spec/PROJECT_SPEC.md` — product and system requirements
- `spec/ARCHITECTURE.md` — runtime, graph, voice, parameter, event, and error architecture
- `spec/DSP_SPEC.md` — DSP algorithms, rates, anti-aliasing, safety, and pseudocode
- `spec/MODULE_SPEC.md` — definitive initial module catalogue
- `spec/GUI_SPEC.md` — workspace, interaction, MIDI, learning, mobile, and accessibility behavior
- `spec/VISUALIZATION_SPEC.md` — visualization scheduler, probes, master analysis, and performance rules
- `spec/PATCH_FORMAT.md` — versioned JSON patch format and migrations
- `spec/REQUIREMENTS_MATRIX.md` — stable requirement IDs mapped to design, implementation area, and verification
- `spec/ACCEPTANCE_CRITERIA.md` — MVP, beta, release, and quality gates
- `docs/DEVELOPMENT_PLAN.md` — phased build plan

## Reference project

BrowserToneGen is used as reference material only. It is not modified by this project. Useful concepts include its AudioWorklet boundary, pure DSP/model separation, configuration validation, offline export approach, analysis, and static GitHub Pages deployment. VisualSynth redesigns those concepts around a typed modular graph and polyphonic voice architecture.

## Status

Specification/design only. Implementation begins only after the specification set is reviewed and accepted.

## Circuit Drift Labs

VisualSynth is part of Circuit Drift Labs:

https://djshellshoxxx.github.io/circuitdriftlabs/
