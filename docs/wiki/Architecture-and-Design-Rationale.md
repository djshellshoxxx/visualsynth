# Architecture and Design Rationale

Source: `spec/ARCHITECTURE.md`, `spec/DSP_SPEC.md`, `research/RESEARCH.md`. *(inferred)* marks conclusions drawn from the code layout.

## Runtime domains

- **Main thread:** UI components, patch store, command/undo history, graph compiler client, parameter/event router, visualisation scheduler.
- **Audio render thread (AudioWorklet):** adapter, runtime graph manager, voice domain, voice mix, global domain, master.
- **Offline render:** the same DSP core runs in a worker to produce WAV from a timeline. *(planned in spec)*

## Why two representations

The **patch** is a user-facing, versioned JSON document. **GraphIR** is a compact, compiler-oriented
structure that is rebuilt from the patch. Keeping them separate lets the patch format evolve without
touching the audio runtime, and lets the compiler change without breaking saved patches.

## Why the UI and audio are decoupled

Graphics can degrade before audio does. Visualisation runs on a central scheduler fed by probes, and the
audio thread never waits for the UI. *(from the spec's goals and runtime diagram.)*

## Other decisions

- **No required SharedArrayBuffer** (TECH-004), so the app runs on plain static Pages.
- **Custom DSP in AudioWorklet** (TECH-003), no third-party audio framework.
- **Parameter edits do not recompile the graph** (AUD-ENG-004); topology changes swap atomically (AUD-ENG-003).
- **Everything visible where practical**, with educational features that can be disabled; the spec requires the instrument to stay useful without them.
