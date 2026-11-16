# VisualSynth

VisualSynth is a browser-based visual modular synthesiser from Circuit Drift Labs. It is a static
GitHub Pages application: custom DSP runs in an AudioWorklet, and the UI shows the signal path
as it is patched.

**Status:** specification-first project. The specification set is complete for Phase 0
(`docs/DEVELOPMENT_PLAN.md`). Implementation is in progress: `src/` contains the graph model,
engine, DSP modules, UI and persistence code, and the unit/integration tests pass locally. Which
phases and requirements are complete is tracked in `spec/REQUIREMENTS_MATRIX.md`, not claimed here.
Browser end-to-end tests have not been run as part of this README update.

## Goals

- A playable synthesiser that does not depend on the educational features.
- A modular environment: oscillators, mixer, multimode filters, envelopes, VCAs, LFOs, modulation,
  effects, patch cables.
- A visual explanation of the active signal path, with scopes and FFT/spectrogram views.
- Versioned JSON patches, presets and templates.

The design rule is that everything which affects the sound should, where practical, be visible.

## Run locally

Requires Node.js 22 (the CI version).

```bash
npm install
npm run serve          # Vite dev server on http://127.0.0.1:4173
npm test               # Vitest unit and integration suites
npm run test:browser   # Playwright browser tests (needs: npx playwright install chromium firefox)
```

Browser tests use an audio service on Linux CI (PulseAudio for Firefox Web Audio).

## Specifications

| File | Covers |
|---|---|
| `spec/PROJECT_SPEC.md` | product and system requirements |
| `spec/ARCHITECTURE.md` | runtime domains, graph, voices, parameters, events, errors |
| `spec/DSP_SPEC.md` | DSP algorithms, rates, anti-aliasing, safety |
| `spec/MODULE_SPEC.md` | initial module catalogue |
| `spec/GUI_SPEC.md` | workspace, interaction, MIDI, learning, accessibility |
| `spec/VISUALIZATION_SPEC.md` | scheduler, probes, performance rules |
| `spec/PATCH_FORMAT.md` | versioned patch format and migrations |
| `spec/REQUIREMENTS_MATRIX.md` | requirement IDs mapped to verification |
| `spec/ACCEPTANCE_CRITERIA.md` | MVP, beta and later acceptance |
| `docs/DEVELOPMENT_PLAN.md` | phased delivery plan |
| `research/` | research findings and references |

## Project layout

```
src/graph/       patch graph types, validation and compilation
src/engine/      audio engine, worklet processor, voice engine, event queue
src/dsp/         oscillator, filter, envelope, LFO, effects, safety primitives
src/modules/     module definitions and UI helpers
src/persistence/ patch schema, migrations, patch store
src/state/       actions and undo history
src/ui/          workspace, module views, cables, keyboard and diagnostics views
src/visual/      scheduler, waveform and spectrum visualisation
src/input/       computer keyboard and MIDI input
tests/unit/, tests/integration/, tests/browser/   test suites
```

## Contributing

Read `AGENTS.md` first. New code is modular by default; changes to public behaviour, patch format or
parameter IDs need a specification change and a versioned migration. Refactors go in separate PRs
from features. Report any test you could not run.

## Licence

MIT, see [LICENSE](LICENSE). Copyright Sheldon Davidson. "Circuit Drift Labs" trademarks are not
licensed; see [COPYRIGHT-TRADEMARK.md](COPYRIGHT-TRADEMARK.md).

## Wiki

Wiki source pages are in [docs/wiki/](docs/wiki/Home.md).
