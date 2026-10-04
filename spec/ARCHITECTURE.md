# VisualSynth Architecture Specification

## 1. System overview

VisualSynth is divided into five runtime domains:

```text
+------------------------------- MAIN THREAD -------------------------------+
| UI Components -> Patch Store -> Command/Undo -> Graph Compiler Client     |
|        |              |                |               |                   |
|        +------ Parameter/Event Router --+               |                   |
|                                                         v                   |
|                                           Dedicated Graph Worker (optional) |
|                                                         |                   |
|                        Visualization Scheduler <--- Analysis Router          |
+-----------------------------------|-----------------------------------------+
                                    | MessagePort
                                    v
+--------------------------- AUDIO RENDER THREAD -----------------------------+
| AudioWorklet adapter -> Runtime Graph Manager -> Active GraphIR Runtime     |
|                                            |                                |
|                         Voice Domain -> Voice Mix -> Global Domain -> Master |
|                                            |                                |
|                                  Probe/Analysis taps                         |
+-----------------------------------|-----------------------------------------+
                                    v
                          AudioContext.destination

Offline render:
Patch/Event timeline -> Graph compiler -> Offline Worker -> same DSP core -> WAV
```

The portable patch document and the audio runtime are deliberately different structures. The patch is user-oriented and versioned for persistence. GraphIR is compiler-oriented, compact and disposable.

## 2. Source layout target

Suggested implementation boundaries:

```text
src/
  app/
    app-controller.ts
    patch-store.ts
    command-history.ts
    preferences.ts
  graph/
    types.ts
    validator.ts
    compiler.ts
    cycle-analysis.ts
    scope-analysis.ts
    buffer-plan.ts
    graph-ir.ts
    migrations.ts
  engine/
    audio-engine.ts
    event-router.ts
    frame-clock.ts
    diagnostics.ts
    offline-renderer.ts
  worklet/
    processor.ts
    runtime-graph.ts
    voice-manager.ts
    module-runtime.ts
  dsp/
    oscillator/
    filter/
    envelope/
    modulation/
    effects/
    analysis/
    safety/
  modules/
    registry.ts
    definitions/
  midi/
    midi-manager.ts
    midi-map.ts
  visualization/
    scheduler.ts
    renderers/
    analysis-router.ts
  ui/
    workspace/
    controls/
    modules/
    inspectors/
    learning/
  persistence/
    patch-codec.ts
    indexeddb.ts
    share-url.ts
  workers/
    graph-worker.ts
    wav-worker.ts
    offline-worker.ts
```

A module definition contains UI/metadata and a runtime DSP factory reference but UI code must never be imported into the worklet.

## 3. Patch Store

The main-thread `PatchStore` is the authoritative editable model.

Responsibilities:

- current patch document;
- selected modules/connections;
- parameter base values;
- module positions/collapse states;
- modulation routing objects;
- transport/automation state;
- dirty/save status;
- applying validated commands;
- emitting minimal state-change notifications.

The PatchStore does not contain oscillator phase, filter memory, delay buffers, active envelope phase or active voice runtime state.

## 4. Command/history architecture

All user edits pass through commands.

```ts
interface PatchCommand {
  id: string;
  label: string;
  apply(patch: PatchDocument): PatchDocument;
  invert(before: PatchDocument, after: PatchDocument): PatchCommand;
  merge?(next: PatchCommand): PatchCommand | null;
}
```

Continuous drags use a transaction:

```text
pointerdown -> begin transaction
pointermove -> preview/apply parameter values without pushing history entries
pointerup   -> commit one command containing before/after value
escape      -> restore transaction start
```

Topology commands trigger graph compilation. Pure UI layout commands do not. Parameter commands trigger parameter deltas unless a parameter changes module topology/quality in a way marked `requiresCompile`.

## 5. Module definition model

```ts
type ModuleScope = 'VOICE' | 'GLOBAL' | 'EFFECT' | 'UTILITY';
type SignalClass = 'AUDIO' | 'CONTROL' | 'PITCH' | 'GATE' | 'TRIGGER' | 'CLOCK' | 'EVENT';

interface ModuleDefinition {
  type: string;
  version: number;
  title: string;
  category: string;
  tier: 'CORE' | 'STANDARD' | 'ADVANCED' | 'EXPERIMENTAL' | 'FUTURE';
  defaultScope: ModuleScope;
  allowedScopes: ModuleScope[];
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  parameters: ParameterDefinition[];
  cpuClass: 1 | 2 | 3 | 4 | 5;
  latencySamples(params): number;
  createsCausalBreak: boolean;
  educational: EducationalMetadata;
  runtimeFactoryId: string;
}
```

Every instance stores `moduleVersion`; migrations are performed before compilation.

## 6. Port model

```ts
interface PortDefinition {
  id: string;
  name: string;
  signal: SignalClass;
  direction: 'IN' | 'OUT';
  channels: 'MONO' | 'STEREO' | 'POLY' | 'EVENT';
  required: boolean;
  multiConnect: boolean;
  mixPolicy?: 'SUM' | 'LAST' | 'MAX' | 'MIN' | 'ERROR';
  polarity?: 'BIPOLAR' | 'UNIPOLAR' | 'EITHER';
  rate?: 'AUDIO' | 'CONTROL' | 'EVENT';
}
```

Connection validation checks signal class, channel shape, scope, multiplicity and any module-specific constraints.

### Fan-out

Outputs may fan out to any number of destinations subject to a configurable global connection limit. The compiler shares the producer buffer where destinations are read-only.

### Fan-in

Audio inputs marked `multiConnect` sum connected sources into an input mix buffer. Control fan-in uses the destination's declared mix policy. Gate/trigger/event fan-in merges timestamped events in stable source-order for identical timestamps.

## 7. Connection compatibility

Default rules:

| Source | Destination | Result |
|---|---|---|
| AUDIO | AUDIO | legal if mono/stereo adaptation is defined |
| CONTROL | CONTROL | legal |
| CONTROL | parameter modulation port | legal if destination modulatable |
| PITCH | PITCH | legal |
| GATE | GATE | legal |
| TRIGGER | TRIGGER | legal |
| CLOCK | CLOCK | legal |
| EVENT | EVENT | legal when event schema accepted |
| AUDIO | CONTROL | illegal by default; use Envelope Follower/Audio-to-Control |
| CONTROL | AUDIO | illegal by default; use explicit DC/Control-to-Audio utility if supported |
| GATE/TRIGGER/CLOCK | CONTROL | illegal unless explicit converter |

Adapters may be compiler-generated only for unambiguous channel conversion such as mono audio -> stereo duplication. Semantic signal conversion requires a visible utility module.

## 8. Graph compiler

Input: validated `PatchDocument` + compile options.

Output: `GraphIR` or structured compile errors/warnings.

### Compile algorithm

```text
compilePatch(patch):
  normalized = migrateAndNormalize(patch)
  errors = schemaValidate(normalized)
  if errors: return failure(errors)

  defs = resolveModuleDefinitions(normalized.modules)
  validatePortsAndParameters(defs, normalized)
  validateConnections(defs, normalized.connections)

  scoped = analyzeVoiceAndGlobalDomains(normalized, defs)
  validateScopeCrossings(scoped)

  graph = buildDirectedGraph(scoped)
  sccs = stronglyConnectedComponents(graph)

  for each scc in sccs:
      if scc is cyclic and !containsPositiveDelayOperator(scc):
          error ZERO_DELAY_CYCLE

  schedule = causalSchedule(graph, sccs)
  latency = annotateLatencies(schedule)
  probeOps = insertRequestedProbeOperators(schedule, patch.probes)
  bufferPlan = planReusableBuffers(schedule, probeOps)
  params = compileParameterTable(normalized)
  voicePlan = compileVoiceTemplate(schedule)
  globalPlan = compileGlobalSchedule(schedule)

  return GraphIR(version, moduleOps, schedule, voicePlan, globalPlan,
                 bufferPlan, params, probes, eventRoutes, latency)
```

The compiler must emit errors with involved module/connection IDs so the UI can highlight the cause.

## 9. GraphIR

GraphIR is immutable after construction.

```ts
interface GraphIR {
  irVersion: number;
  patchRevision: number;
  sampleRate: number;
  moduleOps: CompiledModuleOp[];
  voiceSchedule: number[];
  voiceMix: VoiceMixPlan;
  globalSchedule: number[];
  buffers: BufferPlan[];
  parameters: CompiledParameter[];
  connections: CompiledRoute[];
  probes: ProbePlan[];
  eventRoutes: EventRoute[];
  latency: LatencyPlan;
}
```

GraphIR uses numeric indices rather than string lookup inside the sample loop. Stable user IDs remain attached for state transfer and diagnostics.

## 10. Runtime graph manager

The worklet owns `activeGraph` and optional `pendingGraph`.

Topology update sequence:

```text
UI edit
 -> compile revision N+1
 -> send GraphIR + state-transfer hints
 -> worklet constructs pending runtime outside inner sample loop
 -> transfer compatible runtime state by stable module ID/type
 -> at next safe render boundary set pendingGraph ready
 -> crossfade active/pending outputs for swap window
 -> retire old graph after crossfade
 -> acknowledge revision
```

If the new graph cannot instantiate, the old graph continues running and the worklet reports a structured error.

## 11. Runtime state transfer

State transfer is module-defined:

```ts
interface StateTransferPolicy {
  canTransfer(oldDef, newDef, oldParams, newParams): boolean;
  transfer(oldRuntime, newRuntime): void;
}
```

Examples:

- oscillator: phase/noise PRNG state transfers;
- LFO: phase transfers;
- envelope: current segment/value transfers if envelope topology compatible;
- biquad/SVF: filter integrator state transfers if algorithm/mode compatible;
- delay: circular buffer transfers only when max delay/storage layout compatible, otherwise clear with fade;
- sequencer: step/phase transfers;
- reverb: may reset tail when algorithm quality/topology changes.

## 12. Polyphonic architecture

### Voice template

The compiler generates one logical `VoiceTemplate` from VOICE-scoped operators. Runtime instantiates DSP state per voice while reusing read-only definitions/tables.

```ts
interface VoiceRuntime {
  voiceId: number;
  noteId: number;
  midiNote: number;
  frequencyHz: number;
  velocity: number;
  gate: boolean;
  sustained: boolean;
  ageFrames: number;
  energyEstimate: number;
  moduleState: VoiceModuleState[];
}
```

### Voice allocation pseudocode

```text
noteOn(note, velocity, timestamp):
  if mode == MONO:
      voice = monoVoice
      update note stack
      if legato and voice.gate:
          glide pitch; retrigger envelopes only if policy says so
      else:
          start/retrigger voice
      return

  voice = findFreeVoice()
  if none:
      voice = chooseStealCandidate(
          released voices ordered by envelope energy then age,
          else active voices ordered by energy then age)
      applyShortDeClickRelease(voice)

  initializeVoice(voice, note, velocity, timestamp)
```

### Note off/sustain

A note-off sets gate false unless sustain pedal is down. If sustain is active, mark `sustained=true`. On sustain release, release all sustained voices whose physical keys are no longer held.

### Voice mix

Each active voice renders its VOICE schedule into a stereo voice bus. Voice buses are accumulated in 64-bit accumulator variables where practical, normalized/headroom-managed, then converted to float output for the global graph.

The default mix does not divide by active voice count because that changes instrument dynamics. Instead factory patches use sane oscillator gains and the master has headroom protection. An optional `Auto Headroom` utility may estimate peak contribution.

## 13. Scope/domain crossing

### VOICE -> GLOBAL audio

Legal. Compiler inserts a voice-sum boundary. The UI may show a small `Σ voices` marker on the destination cable or module border.

### GLOBAL -> VOICE control

Legal. Value is broadcast to every voice. Typical for global LFO/macros/XY.

### VOICE -> GLOBAL control

Illegal without explicit reducer because there is no single correct semantic answer. Use `Voice Reduce` with modes `sum`, `mean`, `min`, `max`, `latest`, `highest-note`, `lowest-note`, `selected-voice`.

### GLOBAL -> VOICE audio

Deferred by default. Use an explicit `Audio Broadcast` utility if introduced later so CPU multiplication is visible.

## 14. Parameter architecture

```ts
interface ParameterDefinition {
  id: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  curve: 'LINEAR' | 'LOG' | 'EXP' | 'DB' | 'BIPOLAR' | 'ENUM';
  step?: number;
  enumValues?: string[];
  modulatable: boolean;
  automatable: boolean;
  midiMappable: boolean;
  defaultRate: 'AUDIO' | 'CONTROL';
  allowAudioRate: boolean;
  smoothing: {type:'NONE'|'ONE_POLE'|'LINEAR_RAMP'; timeMs:number};
  clampMode: 'HARD' | 'WRAP' | 'FOLD';
  requiresCompile?: boolean;
  education: string;
}
```

### Effective value pipeline

For continuous parameter `p`:

```text
base = stored patch value
if automation active: base = automation(t)
mod = Σ applyCurve(source_i * amount_i)
effective = transformDomain(base, mod)
effective = clamp/wrap/fold(effective)
effective = smoothing(effective) unless marked sample-exact
```

For logarithmic frequency parameters, modulation is performed in a perceptual/log domain when declared by the parameter rather than blindly adding Hz.

## 15. Parameter messages

UI edits are batched:

```ts
interface ParameterDeltaBatch {
  patchRevision: number;
  targetFrame?: number;
  changes: Array<{moduleIndex:number; parameterIndex:number; value:number}>;
}
```

Pointer movement may generate many DOM events. The engine client limits transmission to a practical rate while preserving the final value. Audio-rate modulation is never streamed from the UI; it is generated inside the graph.

## 16. Musical event timing

The engine owns a frame clock tied to `AudioContext.currentTime` and reported worklet frame position.

Events are represented as:

```ts
interface EngineEvent {
  frame: number;
  type: 'NOTE_ON'|'NOTE_OFF'|'PITCH_BEND'|'CC'|'AFTERTOUCH'|'SUSTAIN'|'CLOCK'|'TRIGGER';
  channel?: number;
  a?: number;
  b?: number;
  sourceId: string;
  sequence: number;
}
```

Events are ordered by frame then sequence. Late events are applied at the next available frame and counted in diagnostics.

## 17. Feedback architecture

Cycle detection uses strongly connected components.

A module marks `createsCausalBreak=true` only if its output for sample `n` does not depend on its input at sample `n` (for example Unit Delay, delay line with minimum delay >= 1 sample).

### Feedback evaluation

For a cyclic SCC with a delay:

1. delayed operators expose their stored previous output;
2. downstream operators compute current sample;
3. delayed operator consumes its new input and updates storage for future samples.

This produces deterministic causal behavior.

`FeedbackDelay` defaults to 1 sample for educational DSP feedback and offers longer delay values. A `Feedback Safe` option may add soft saturation but is never a substitute for finite-value guards.

## 18. Bypass/mute semantics

`mute`: output becomes zero/event-silent while module internal state may continue unless the module definition says `freezeWhenMuted`.

`bypass`: for one-in/one-out compatible processors, routes input to output with short crossfade while internal state may continue. Generators have no generic bypass and use enable/mute instead.

`disable`: removes module processing from runtime only when compiler can safely substitute defined behavior; otherwise acts as bypass/mute according to module category.

## 19. Audio engine startup pseudocode

```text
startAudioEngine():
  require user gesture
  if AudioContext absent:
      context = new AudioContext({latencyHint:'interactive'})
  await context.resume()
  if worklet module not loaded:
      await context.audioWorklet.addModule(resolvedWorkletURL)
  create AudioWorkletNode('visualsynth-engine', stereo out)
  create master gain guard / destination wiring
  attach processor error handler
  compile current patch for context.sampleRate
  send GraphIR
  wait for READY acknowledgement with timeout
  ramp master from silence to patch master gain
```

## 20. Module insertion pseudocode

```text
insertModule(type, position):
  def = registry.get(type)
  instance = createDefaultInstance(def, newStableId())
  candidate = patch.withModule(instance, position)
  validate schema
  apply AddModuleCommand(candidate)
  if module affects DSP graph:
      requestCompile(candidate.revision)
```

## 21. Module deletion pseudocode

```text
deleteModule(moduleId):
  attached = all connections touching moduleId
  probes = probes attached to those connections/module
  candidate = remove module + attached routes + attached probes
  validate candidate
  commit one DeleteModuleCommand containing removed data
  compile candidate
```

Undo restores the module, exact connections, probes and UI layout.

## 22. Connection creation pseudocode

```text
connect(sourcePort, destinationPort):
  result = validateConnection(sourcePort, destinationPort, patch)
  if result.error:
      show reason; do not mutate patch
  else:
      candidate = patch.addConnection(newStableId(), source, destination)
      compile candidate
      if compile succeeds:
          commit ConnectCommand
      else:
          display compile error and retain current patch/runtime
```

For responsive UX, structural validation runs immediately; full compile can follow asynchronously. The live engine stays on the last valid graph until the new revision is accepted.

## 23. Panic pseudocode

```text
panic():
  main thread:
    cancel scheduled UI automation preview
    send PANIC with highest message priority
    set outer master GainNode immediately toward zero

  worklet:
    clear musical event queue
    mark all voices inactive
    reset envelopes/gates
    clear unstable feedback/filter state
    zero all output buffers
    reset finite-value error counters
    acknowledge PANIC
```

The outer gain guard provides a second silence path if the worklet is unhealthy.

## 24. Diagnostics

Worklet sends compact diagnostics at low rate, e.g. 2–4 Hz:

- current patch revision;
- active voices;
- processed frames;
- render quantum size;
- average/max estimated processing time or budget ratio where safely measurable;
- late event count;
- finite-value guard activations;
- graph swap count/failures;
- probe count;
- dropped analysis messages.

Main thread adds:

- browser/user agent summary;
- sample rate;
- baseLatency/outputLatency if exposed;
- AudioContext state;
- MIDI availability/devices;
- visualization scheduler frame/drop stats;
- build/app version.

No patch content or personally identifying data is included by default.

## 25. Error recovery

### Compile failure

Keep the previous graph active. Highlight offending patch objects. Undo remains possible.

### Processor error

Immediately mute outer gain, mark engine faulted, retain editable patch state, offer `Restart Audio Engine`. Restart creates a new worklet node and recompiles the patch without reloading the page.

### Module runtime fault

Each module's process boundary is protected by finite-value checks. Repeated faults from one module cause that module runtime to enter fail-silent state and report its stable ID/type. The entire audio engine should not crash because one module produced invalid data.

### Unknown imported module

Load as `MissingModulePlaceholder` preserving raw state and connections. It emits silence/no events. UI explains the missing type. If the module becomes available in a later version, migration can restore it.

## 26. Offline architecture

Offline rendering reuses:

- patch migration;
- graph compiler;
- GraphIR;
- module DSP implementations;
- event scheduler;
- voice allocator;
- safety layer.

It substitutes an `OfflineEngineAdapter` for AudioWorklet globals and runs blocks in a Web Worker as fast as possible. Output chunks are passed to WAV encoder logic. Rendering can be cancelled between blocks.

## 27. Dependency rules

- `dsp/` must not import DOM APIs.
- `worklet/` must not import UI/DOM code.
- `graph/` must be deterministic and unit-testable in Node.
- `modules/definitions` may describe UI metadata but DSP runtime factories resolve through IDs to keep worklet bundles clean.
- UI does not mutate DSP objects directly.
- Persistence serializes patch model only, never GraphIR or runtime state.

## 28. Architectural invariants

1. Last valid graph always remains runnable during editing.
2. No topology mutation occurs inside the sample loop.
3. Stable IDs are required for module/connection/probe serialization and state transfer.
4. Audio/control/event signal classes are not silently coerced semantically.
5. Voice/global domain crossings are explicit and deterministic.
6. Zero-delay cycles are impossible in a compiled graph.
7. Visual analysis is optional instrumentation and may never block audio.
8. Patch files remain forward-diagnosable even when modules are unknown.
9. UI complexity mode never alters DSP meaning.
10. Offline and realtime engines interpret GraphIR identically.
