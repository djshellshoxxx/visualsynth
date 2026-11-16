# Developer Guide

## Setup and checks

```bash
npm install
npm test              # Vitest: 29 files, 148 tests (all passed on the snapshot checked for this page)
npm run test:browser  # Playwright; install browsers first: npx playwright install chromium firefox
npm run serve
```

CI: `.github/workflows/test.yml` runs `npm install`, `npm test` and the browser suite on Node 22 with
a PulseAudio service for Firefox. `pages.yml` deploys the static site.

## Conventions (from AGENTS.md)

- New code is modular: one responsibility per module, explicit contracts, no hidden global state.
- Separate DSP and domain logic from UI, browser and persistence adapters.
- Preserve public APIs, parameter IDs and patch formats. Incompatible changes need a spec change and a
  versioned migration (`src/persistence/migrations.js`).
- Refactors go in their own PR. Characterise behaviour before moving code.
- Audio callbacks: no blocking, allocation, I/O, logging or UI access.

## Where to look first

`src/graph/` (types, validation, compile), `src/engine/worklet-processor.js` (the AudioWorklet), and
`spec/ARCHITECTURE.md` for the domain split.
