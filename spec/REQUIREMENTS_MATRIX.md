# VisualSynth Requirements Traceability Matrix

Legend: `MVP`, `BETA`, `LATER`. Verification abbreviations: `UT` unit test, `IT` integration test, `E2E` browser end-to-end, `PERF` benchmark, `MAN` manual/UX acceptance, `CI` build/deploy validation.

| Requirement | Phase | Specification / intent | Planned implementation area | Verification |
|---|---|---|---|---|
| TECH-001 | MVP | Static `/visualsynth/` app | Vite config, Pages workflow | CI base-path smoke |
| TECH-002 | MVP | TypeScript/static bundle, no required UI framework | project tooling | CI build/lint/typecheck |
| TECH-003 | MVP | Custom DSP in AudioWorklet | engine/worklet | IT/E2E audio startup |
| TECH-004 | MVP | No required SharedArrayBuffer | engine transport | E2E non-isolated Pages |
| TECH-005 | MVP | Canvas/SVG visualization baseline | visualization/ui | PERF/MAN |
| TECH-006 | MVP | IndexedDB + JSON portability | persistence | UT/E2E |
| AUD-ENG-001 | MVP | Long-lived AudioContext | audio-engine | IT lifecycle |
| AUD-ENG-002 | MVP | Primary compiled-graph worklet | processor/runtime-graph | IT/PERF |
| AUD-ENG-003 | MVP | Atomic topology swap | compiler/runtime manager | IT click/state tests |
| AUD-ENG-004 | MVP | Param edits avoid compile | event-router/params | IT compile counter |
| AUD-ENG-005 | MVP | panic/suspend/diagnostics/recovery | engine/diagnostics | E2E fault tests |
| AUD-ENG-006 | BETA | realtime/offline shared DSP | dsp/offline worker | UT render comparison |
| DSP-GRAPH-001 | MVP | stable module graph schema | graph/types | UT schema |
| DSP-GRAPH-002 | MVP | typed connections | graph/types/compiler | UT |
| DSP-GRAPH-003 | MVP | reject incompatible routes | validator | UT/E2E |
| DSP-GRAPH-004 | MVP | reject zero-delay cycles | cycle-analysis | UT fixtures |
| DSP-GRAPH-005 | MVP | delayed cycles legal | cycle-analysis/runtime | UT/IT feedback |
| DSP-GRAPH-006 | MVP | state transfer by ID | runtime graph manager | IT phase/filter state |
| DSP-GRAPH-007 | MVP | deterministic module deletion | patch commands | UT/E2E undo |
| SIG-AUDIO-001 | MVP | audio signal class | ports/runtime | UT/IT |
| SIG-CONTROL-001 | MVP | control signal class | ports/params | UT |
| SIG-PITCH-001 | MVP | pitch signal class | note input/oscillator | UT frequency |
| SIG-GATE-001 | MVP | gate state/transitions | events/envelope | UT |
| SIG-TRIG-001 | BETA | trigger impulses | event router/modules | UT |
| SIG-CLOCK-001 | BETA | transport clock | transport/sequencers | UT drift/timing |
| SIG-EVENT-001 | MVP | timestamped note/event stream | event router | UT ordering |
| VOICE-001 | MVP | scope classes | module definitions | UT registry |
| VOICE-002 | MVP | per-voice runtime instances | voice-manager | IT poly patch |
| VOICE-003 | MVP | voice lane preservation | compiler/runtime | IT |
| VOICE-004 | MVP | global control broadcast | compiler | IT LFO->voices |
| VOICE-005 | MVP | voice audio sum | voice mix | UT/IT |
| VOICE-006 | BETA | explicit voice control reducer | Voice Reduce module | UT/E2E |
| VOICE-007 | MVP | configurable 1–32 target polyphony | voice manager/settings | PERF/IT |
| VOICE-008 | MVP | energy/age voice stealing | voice allocator | UT |
| VOICE-009 | MVP | mono/legato/poly/unison | Note Input | UT/E2E |
| PARAM-001 | MVP | centralized parameter metadata | parameter registry | UT consistency |
| PARAM-002 | MVP | full metadata fields | parameter types | type/registry tests |
| PARAM-003 | MVP | smoothing | dsp/parameter runtime | UT de-click |
| PARAM-004 | MVP | base/range/live display | UI controls | E2E/MAN |
| PARAM-005 | MVP | deterministic multi-mod sum | modulation runtime | UT |
| PARAM-006 | MVP | enum modulation restrictions | validator | UT |
| MOD-001 | MVP | broad continuous modulation | module parameter defs | matrix audit/UT |
| MOD-002 | MVP | amount/polarity/curve/range | modulation route | UT/E2E |
| MOD-003 | MVP | cable modulation; shortcut same model | UI/patch model | E2E |
| MOD-004 | MVP | visible modulation activity | cable scheduler | MAN/PERF |
| MOD-005 | MVP | audio-rate FM/PM/VCA etc. | dsp/modulation | UT spectral/timing |
| AUD-OSC-001 | MVP | core waveform set | core oscillator | UT frequency/alias |
| AUD-OSC-002 | BETA | variable/supersaw/additive/wavetable/custom | oscillator modules | UT/E2E |
| AUD-OSC-003 | MVP | anti-alias discontinuous waves | oscillator DSP | spectral UT |
| AUD-FILTER-001 | MVP | LP/HP/BP/notch | SVF | response UT |
| AUD-FILTER-002 | BETA | slope/drive/wet/keytracking | filter module | UT/E2E |
| AUD-ENV-001 | MVP | ADSR visual envelope | ADSR | UT/E2E |
| AUD-ENV-002 | BETA | multistage/loop/draw | MSEG | UT/E2E |
| AUD-LFO-001 | MVP | required LFO shapes | LFO | UT |
| AUD-VCA-001 | MVP | VCA behavior | VCA | UT |
| AUD-MIX-001 | MVP | multi-input mixer | Mixer | UT/E2E |
| FX-001 | BETA | core beta effects suite | effects modules | UT/E2E |
| FX-002 | BETA | delay sync/feedback/filter/pingpong | Delay | UT |
| FX-003 | BETA | algorithmic reverb | Reverb | PERF/UT |
| FX-004 | BETA | localized oversampling | nonlinear DSP | spectral UT/PERF |
| FX-005 | BETA | correct dry/wet | effects common | UT |
| SEQ-001 | BETA | step/gate/mod sequencers | sequencer modules | UT/E2E |
| SEQ-002 | BETA | probability/Euclidean | advanced sequencing | UT |
| SEQ-003 | BETA | modular outputs, not DAW timeline | sequencer ports | schema/IT |
| SEQ-004 | BETA | frame-based transport | transport | long-run UT |
| MASTER-001 | MVP | one master destination path | master/engine | compile/IT |
| MASTER-002 | MVP | gain/mute/panic/meters/scope/FFT | Master | E2E/MAN |
| MASTER-003 | BETA | spectrogram/stereo-phase | master visuals | PERF/MAN |
| MASTER-004 | MVP | final safety/DC/guard | master DSP | fuzz/UT |
| VIS-001 | MVP | meaningful major-module visuals | module renderers | acceptance audit |
| VIS-002 | MVP | distinguish state vs measured | UI labels | MAN/E2E snapshots |
| VIS-SCOPE-001 | BETA | audio scope probe | probe compiler/runtime | IT/E2E transparency |
| VIS-CTRL-001 | BETA | control probe | probe runtime | IT/E2E |
| VIS-SCHED-001 | MVP | one visual scheduler | scheduler | code audit/PERF |
| VIS-SCHED-002 | MVP | offscreen throttle/freeze | scheduler | E2E/PERF |
| VIS-SCHED-003 | MVP | visuals degrade before audio | adaptive scheduler | PERF stress |
| MIDI-001 | BETA | feature detect/request permission | midi-manager | E2E/browser matrix |
| MIDI-002 | BETA | note/velocity/bend/mod/sustain/CC | midi-manager/events | UT/hardware MAN |
| MIDI-003 | BETA | MIDI Learn | midi-map/UI | E2E |
| MIDI-004 | MVP | fully playable without MIDI | keyboard/on-screen | E2E Firefox/Safari |
| KEY-001 | MVP | computer keyboard map | keyboard input | E2E |
| KEY-002 | MVP | on-screen keyboard/touch | performance UI | E2E touch |
| PATCH-001 | MVP | versioned JSON | patch-codec | UT fixtures |
| PATCH-002 | MVP | validate before replace | import staging | E2E |
| PATCH-003 | MVP | failed import preserves current patch | import flow | E2E |
| PATCH-004 | MVP | sequential migrations | migrations | UT fixtures |
| PATCH-005 | MVP | local import/export | persistence UI | E2E |
| PATCH-006 | MVP | IndexedDB library | indexeddb | E2E |
| PRESET-001 | BETA | category library | factory patches | CI compile-all |
| PRESET-002 | BETA | architecture templates | factory templates | CI/MAN |
| RAND-001 | BETA | undoable randomization | command system | UT/E2E |
| RAND-002 | BETA | parameter locks | randomizer | UT |
| RAND-003 | BETA | safe random ranges | module metadata | property tests |
| RAND-004 | BETA | chaos still numerically safe | randomizer/DSP safety | fuzz |
| UNDO-001 | MVP | undo significant edits | command history | UT/E2E |
| UNDO-002 | MVP | coalesce drags | UI history transaction | E2E |
| UNDO-003 | MVP | history stores model diffs | command system | code/UT |
| REC-001 | BETA | realtime record | worklet/encoder worker | E2E |
| REC-002 | BETA | 44.1/48/96 kHz WAV | offline worker | file validation UT |
| REC-003 | BETA | 16/24/32f formats | WAV encoder | binary fixture UT |
| REC-004 | BETA | progress/cancel | workers/UI | E2E |
| REC-005 | BETA | same GraphIR/DSP semantics | offline engine | render comparison |
| AUTO-001 | BETA | gesture/curve/step automation | automation model/UI | UT/E2E |
| AUTO-002 | BETA | base->automation->mod pipeline | parameter runtime | UT |
| AUTO-003 | BETA | frame-based playback | event/automation engine | timing UT |
| EDU-001 | BETA | optional Learning Mode | learning UI | E2E |
| EDU-002 | BETA | meaningful parameter help | metadata/content | content audit |
| EDU-003 | BETA | lessons manipulate actual patch | lesson runner | E2E |
| EDU-004 | BETA | 20 initial concepts | lesson content | checklist/MAN |
| EDU-005 | BETA | Visual Signal Flow | graph path UI | E2E |
| EDU-006 | BETA | Compare Mode | snapshot/bypass A-B | E2E/audio MAN |
| GUI-MODE-001 | MVP | same model across complexity modes | UI filters | E2E state hash |
| GUI-MODE-002 | MVP | beginner hides, never alters | UI | E2E |
| GUI-MODE-003 | BETA | advanced diagnostics/rates | inspector | E2E |
| MOBILE-001 | MVP | desktop primary | responsive design | MAN |
| MOBILE-002 | BETA | tablet meaningful editing | responsive UI | Playwright tablet |
| MOBILE-003 | BETA | phone performance/small edits | responsive UI | Playwright mobile |
| MOBILE-004 | MVP | Pointer Events/touch targets | controls/workspace | E2E |
| A11Y-001 | MVP | keyboard/access names | UI components | axe/MAN |
| A11Y-002 | MVP | text/numeric alternatives | controls/visuals | accessibility audit |
| A11Y-003 | MVP | not color-only | theme/ports/cables | MAN |
| A11Y-004 | MVP | reduced motion | scheduler/theme | E2E media emulation |
| A11Y-005 | BETA | high contrast | theme | visual/MAN |
| PERF-001 | MVP | diagnostics data | diagnostics | UT/E2E |
| PERF-002 | MVP | copy/download diagnostics privacy | diagnostics UI | E2E content check |
| PERF-003 | BETA | render budget stats | worklet diagnostics | PERF |
| PERF-004 | BETA | adaptive quality order | scheduler/quality | PERF stress |
| ERR-001 | MVP | invalid edit keeps last graph | compiler client | E2E |
| ERR-002 | MVP | processor fault mute/restart | engine | injected-fault E2E |
| ERR-003 | MVP | invalid imports staged | persistence | E2E |
| ERR-004 | BETA | unknown modules as placeholders | migrations/UI | fixture test |
| SAFE-001 | MVP | finite guards | DSP safety | fuzz/property tests |
| SAFE-002 | MVP | master DC/amplitude guard | master | UT |
| SAFE-003 | MVP | stable resonance/feedback bounds | filter/effects | fuzz |
| SAFE-004 | MVP | explicit delayed feedback only | compiler | cycle UT |
| SAFE-005 | MVP | immediate panic semantics | engine/worklet | E2E/PERF |
| TUNE-001 | MVP | A4 + 12-TET | pitch system | UT |
| TUNE-002 | MVP | microtuning-ready pitch model | pitch types | design/code audit |
| DEPLOY-001 | MVP | `/visualsynth/` paths | Vite/Pages | CI deployed smoke |
| DEPLOY-002 | MVP | no backend/tracking/account | static app | network audit |
| DEPLOY-003 | MVP | HTTPS/worklet secure context | Pages | deployed E2E |
| DEPLOY-004 | MVP | CI tests/build before deploy | Actions | branch protection/process |
| TEST-DSP-001 | MVP | comprehensive DSP units | tests/dsp | CI |
| TEST-GRAPH-001 | MVP | graph integration coverage | tests/graph | CI |
| TEST-UI-001 | MVP/BETA | browser UI flows | Playwright | CI |
| TEST-PERF-001 | BETA | stress scenarios | benchmarks | PERF reports |
| TEST-BROWSER-001 | BETA | Chromium/Firefox gate, Safari best effort | CI/manual matrix | release checklist |

## Matrix audit rule

Any new requirement ID introduced in another specification document must be added here before that document is considered complete. Any matrix row without a verification method is a specification defect.
