# VisualSynth main-branch audit — 2026-10-28

## Scope and baseline

Audited `main` at `e337cf35c802489ef0f7489acd288c6d7188ccba`. Reviewed the shipped application under `src/`, UI assistance, static entry point/styles, patch schema and migrations, test coverage, package dependencies and deployment workflows against the existing specifications. Checked active branches and PRs before changes. PRs #8 and #9 contain separate beta implementations; #11 contains documentation work. None was merged or overwritten.

The original suite passed **148 tests in 29 files**. Eight initial behavioral regression tests failed on that baseline: audible envelope routing, LFO modulation, Voice Sum gain, metadata round-trip, panic ordering, malformed performance events, concurrent audio startup, and key release after focus changes. Existing modulation tests verified compiler metadata only, not rendered sound.

This is a review of the main application, not certification of every roadmap feature. Vendored skills and native JUCE scaffolding are not application runtime dependencies; shared Python scripts received syntax checks, not platform integration tests.

## Confirmed defects repaired

| Priority | Finding | Repair and verification |
|---|---|---|
| High | Compiled modulation routes were ignored; ADSR/LFO modules had no DSP dispatch | Prepared typed routes, actual envelope/LFO rendering, FM/PM/filter-cutoff/gain modulation; tests inspect audio samples |
| High | Voice oscillators were summed before voice filters/VCAs; voice processors shared state | Independent preallocated DSP lanes; nonlinear filter output compared against separately rendered voices |
| High | Note-off killed sources before envelope release | Voice source lifetime includes the voice envelope release window; attack/release waveform test |
| High | Voice Sum gain was ignored | Apply gain at the explicit summing boundary |
| High | Null protocol payloads and unsupported note events could throw on the audio thread | Reject malformed payloads and unsupported events before dispatch |
| High | Panic could process later events already removed from the queue, and delay history survived | Stop dispatch at panic, clear queued notes and DSP histories; verify silent restart |
| High | Save/load discarded metadata, modulation settings and module UI state | Preserve nonempty optional canonical fields and modulation metadata, including v0 migration; preserve current layout over stale UI coordinates |
| High | Processor failure left the application showing a permanently running engine | Disconnect failed node, clear status/meters, expose retry, reuse the loaded worklet module |
| Medium | Concurrent starts could construct duplicate connected worklet nodes | Share an in-flight startup promise; concurrency test |
| Medium | Graph swaps restarted oscillator phase and filter/effect state | Reuse state for matching module ID/type/scope; phase-continuity test |
| Medium | Polyphony control did not affect allocation | Apply 1–32 limits on graph swap and parameter update; trim excess voices |
| Medium | Parameter smoothing metadata was unused by audio rendering | Apply prepared one-pole ramps to compiled continuous parameters, once per sample rather than per voice |
| Medium | Module mute/disable/bypass and disabled cables were not propagated into rendering | Compile flags and honor them in the prepared graph |
| Medium | Master output could exceed the finite audio range | Final finite guard and hard bound to ±1 |
| Medium | Keyup on an editable target left a previously held note sounding | Always release tracked keys, while keeping keydown typing protection |
| Medium | Sparse loaded IDs collided with newly added/duplicated modules or cables | Probe the current patch for an unused generated ID |
| Medium | Repeated movement used a stale captured position; unrelated gestures coalesced in undo | Read the live card position and commit each completed gesture separately |
| Medium | Denied localStorage access aborted application initialization | Keep playback available; report save/load failures; keep tooltip preferences in memory |
| Medium | On-screen keys could not be played with Enter/Space; one pointer could release another | Add keyboard press/release and note ownership checks |
| Medium | Graph validation threw on malformed collections; duplicate cable IDs and fractional choice values were accepted | Structural validation, identity checks, duplicate checks, integral enum validation |
| Low | Gain adjustment unmuted audio but left the button labeled Unmute | Synchronize the label with the new state |
| Low | Sustain changes could leave stale envelope value for release | Keep the envelope's held value synchronized |
| High (development tooling) | Vitest 3 dependency graph reported 2 critical and 1 moderate advisory entries | Upgrade Vitest alone to 4.1.12, commit npm lockfile, use `npm ci`; subsequent audit reports zero |
| Medium (delivery) | Pages deployed independently of tests and uploaded the whole repository | Require unit and Chromium/Firefox browser tests before deploying; stage only application assets |

The dependency advisories concern development tooling, not a remotely exposed production server. Reviewed the official [Vitest 4 migration guide](https://v4.vitest.dev/guide/migration.html); the existing Node 22/Vite 7 setup and test APIs are compatible. The dependency upgrade does not add production packages.

## Module contracts

- `src/engine/worklet-processor.js`: retains the `WorkletRuntime` entry point and existing protocol. Owns graph revisions, event timing, master gain, panic and telemetry. `processBlock()` remains an allocating offline/test convenience; the actual processor uses `processInto()` with browser-owned output buffers.
- `src/engine/graph-renderer.js`: owns a prepared acyclic routing graph, output lanes, smoothing state and per-lane DSP instances. Global control broadcasts to voice lanes; voice audio is normalized at the global sum boundary. Matching IDs/types/scopes retain DSP state on graph swaps. Graph preparation must succeed before the runtime adopts a revision.
- `src/engine/node-dsp.js`: owns built-in DSP construction/reset and typed per-sample dispatch. It does not own UI, persistence, the voice allocator or the protocol. `gainIn` multiplies the VCA base gain; FM is semitones, PM cycles, and cutoff modulation octaves for the compiler's standard routes.

No existing module/parameter IDs, preset schema versions or public exports were removed. No beta modules or branch histories were merged.

## Verification

- Baseline: 148 unit/integration tests passing.
- Repaired tree: 169 unit/integration tests in 30 files passing under Vitest 4.1.12.
- Chromium browser suite: 44 tests, including new worklet-output, storage-denial, movement/undo, sparse-ID, keyboard-access and fault-recovery cases.
- Local browser testing uses Chromium 153 from a temporary external tool installation, with GPU disabled. The normal Playwright browser download was unavailable in this environment. This temporary configuration is not committed.
- All application JS modules parse; shared Python scripts compile; `git diff --check` passes.
- `npm audit`: 0 advisory entries after the isolated Vitest upgrade.
- Offline stress sample: all 24 factory presets, eight voices, 48 kHz, 128-frame blocks, 20 warm-up blocks then 100 measured blocks each. All output was finite and bounded. Slowest mean block was approximately **0.83 ms** (`space-pad`) on this host versus a **2.67 ms** audio deadline. This short Node benchmark is not a browser/mobile latency guarantee.
- Firefox, Safari, Windows devices, real MIDI hardware and physical audio listening remain unverified locally. The repository CI retains Chromium and Firefox checks. Deployment changes have not been exercised against live Pages.

## Remaining limitations and specification gaps

These are explicit follow-up work, not claims of completed implementation:

1. Nonlinear modulation curves, general custom scaling, direct parameter-modulation documents and automation playback are not implemented by this main-branch renderer. The repair implements the current compiler's standard linear port routes; imported extended metadata is preserved.
2. The seventh oscillator choice is still a sine fallback for the planned variable-waveform feature. Advanced oscillators, feedback-delay cycles, sequencers, recording/offline export, MIDI Learn, IndexedDB library and related beta features live outside this main-branch implementation or remain roadmap work.
3. The final guard bounds samples but is not a look-ahead limiter or DC-blocking filter. Continuous graph crossfades, crossfaded voice stealing and delay-time interpolation still need dedicated audio-quality work and listening tests.
4. Per-sample routing no longer constructs Maps/arrays and the worklet no longer allocates output buffers each block. Note-event handling and telemetry still allocate, and graph preparation is still performed in the worklet message handler. This is not a claim of a completely allocation-free realtime pipeline.
5. Voice release lifetime uses the maximum voice ADSR release in the graph rather than reachability/energy-based retirement. Long releases or disconnected envelopes may retain voice lanes longer than necessary.
6. Visual canvases remain parameter-derived previews where labeled as such, not oscilloscope measurements of individual module outputs. Larger feature/requirements matrices remain planning documents, not evidence that every listed feature is implemented.

All changes are intended for review on a separate branch. Passing automated checks cannot establish that no other defects exist.
