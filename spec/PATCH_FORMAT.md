# VisualSynth Patch Format Specification

## 1. Goals

The patch format is a portable, human-inspectable, versioned JSON document. It stores user intent and editable patch state, not compiled GraphIR or transient DSP runtime state.

Requirements:

- deterministic round-trip;
- schema validation before use;
- sequential migrations;
- stable IDs;
- preservation of unknown future module data where possible;
- safe import without executing code;
- no arbitrary JavaScript expressions;
- no dependency on backend IDs;
- suitable for IndexedDB, downloaded files, factory presets and compressed URL fragments.

## 2. Top-level schema

Illustrative v1 document:

```json
{
  "format": "visualsynth-patch",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "id": "patch_01J...",
  "name": "Basic Subtractive",
  "description": "Two oscillator subtractive example",
  "author": "Circuit Drift Labs",
  "createdAt": "2026-10-04T00:00:00.000Z",
  "modifiedAt": "2026-10-04T00:00:00.000Z",
  "tags": ["subtractive", "educational"],
  "seed": 123456789,
  "settings": {},
  "transport": {},
  "modules": [],
  "connections": [],
  "modulations": [],
  "automation": [],
  "probes": [],
  "midiMappings": [],
  "performanceView": {},
  "ui": {},
  "extensions": {}
}
```

Timestamps are metadata only; DSP determinism must not depend on them.

## 3. Stable IDs

IDs are opaque strings generated locally. UUIDv4/UUIDv7, ULID or a collision-resistant project-specific ID is acceptable.

IDs required for:

- patch;
- module instances;
- connections;
- modulation routes if separate from connections;
- automation lanes;
- probes;
- macro assignments;
- user presets where locally stored.

The engine never derives meaning from ID format.

## 4. Settings

```json
{
  "polyphony": 16,
  "voiceMode": "poly",
  "quality": "normal",
  "a4Hz": 440,
  "tuningId": "12tet",
  "masterGainDb": -6,
  "autoStartTransport": false
}
```

UI-only global preferences such as theme or preferred cable style belong to application preferences unless they are intentionally patch-specific.

## 5. Transport

```json
{
  "bpm": 120,
  "timeSignature": [4, 4],
  "swing": 0,
  "loop": null
}
```

Live playhead/frame position is not saved by default.

## 6. Module instance

```json
{
  "id": "mod_osc1",
  "type": "core.oscillator",
  "moduleVersion": 1,
  "name": "OSC 1",
  "scope": "VOICE",
  "enabled": true,
  "bypass": false,
  "muted": false,
  "parameters": {
    "waveform": "saw",
    "octave": 0,
    "semitone": 0,
    "cents": 0,
    "levelDb": -12,
    "pulseWidth": 0.5,
    "phaseDeg": 0,
    "retrigger": true
  },
  "state": {},
  "ui": {
    "x": 320,
    "y": 220,
    "widthClass": "M",
    "collapsed": false,
    "expandedEditor": false
  }
}
```

`parameters` contains values defined by central parameter metadata. `state` contains module-specific editable persistent structures such as wavetable source frames, harmonic partial arrays, sequencer steps or envelope breakpoints.

Runtime state such as phase, filter memory and delay buffers is never serialized into a normal patch.

## 7. Connection

```json
{
  "id": "conn_1",
  "source": {"moduleId": "mod_osc1", "portId": "audioOut"},
  "destination": {"moduleId": "mod_filter1", "portId": "audioIn"},
  "signal": "AUDIO",
  "enabled": true,
  "ui": {
    "label": "",
    "routeStyle": null
  }
}
```

The stored `signal` is validated against current module definitions; it is not trusted blindly.

## 8. Parameter modulation route

Cable-based modulation may be represented in the connection list when destination is an explicit modulation port. Direct parameter assignments are normalized to a modulation object:

```json
{
  "id": "modroute_1",
  "source": {"moduleId": "mod_lfo1", "portId": "controlOut"},
  "destination": {"moduleId": "mod_filter1", "parameterId": "cutoff"},
  "amount": 12,
  "amountUnit": "semitones",
  "polarity": "bipolar",
  "curve": {"type": "linear", "amount": 1},
  "inputRange": [-1, 1],
  "enabled": true
}
```

The compiler resolves modulation domain according to the destination parameter definition.

## 9. Automation lane

```json
{
  "id": "auto_1",
  "target": {"moduleId": "mod_filter1", "parameterId": "cutoff"},
  "timeBase": "beats",
  "enabled": true,
  "points": [
    {"t": 0, "v": 400, "shape": "linear"},
    {"t": 4, "v": 8000, "shape": "curve", "curve": 0.6}
  ]
}
```

Supported time bases initially: `beats`, `seconds`. Conversion occurs through transport/frame clock.

## 10. Probe

```json
{
  "id": "probe_1",
  "type": "scope",
  "attachment": {"connectionId": "conn_1"},
  "view": "waveform",
  "settings": {
    "timeMs": 20,
    "fftSize": 2048,
    "freeze": false,
    "polyView": "selected",
    "selectedVoice": null
  },
  "ui": {"x": 700, "y": 100, "w": 360, "h": 220}
}
```

Frozen captured sample data is not persisted in ordinary patches.

## 11. MIDI mapping

```json
{
  "id": "mmap_1",
  "target": {"moduleId": "mod_filter1", "parameterId": "cutoff"},
  "source": {
    "kind": "cc",
    "deviceFingerprint": null,
    "channel": 1,
    "cc": 74
  },
  "min": 40,
  "max": 18000,
  "curve": "log",
  "invert": false
}
```

Mappings should not require a specific ephemeral browser device ID. If a device fingerprint is stored, it is advisory and privacy-conscious (e.g. user-approved manufacturer/name tuple), and the mapping may fall back to any device/channel depending on user settings.

## 12. Performance View

```json
{
  "controls": [
    {"type": "macro", "moduleId": "mod_macro1"},
    {"type": "parameter", "moduleId": "mod_filter1", "parameterId": "cutoff"}
  ],
  "keyboardVisible": true
}
```

Pinned controls reference original patch targets rather than duplicate values.

## 13. UI state

Patch-specific UI state may include:

```json
{
  "viewport": {"x": 0, "y": 0, "zoom": 1},
  "selectedModuleIds": [],
  "complexityModeHint": "normal",
  "cableVisibility": "all"
}
```

Selection state may be omitted from downloaded exports if desired. UI hints never change DSP meaning.

## 14. Wavetable state

User-defined wavetable source data is stored compactly as normalized frames or harmonic representation.

Preferred v1 representation:

```json
{
  "frames": [
    {"harmonics": [1, 0.5, 0.33], "phases": [0, 0, 0]}
  ],
  "normalization": "peak"
}
```

Large generated mipmaps are caches and are not serialized.

If direct sample frames are allowed, impose strict points/frame and frame-count limits and validate every numeric value.

## 15. Additive state

```json
{
  "partials": [
    {"ratio": 1, "amplitude": 1, "phase": 0},
    {"ratio": 2, "amplitude": 0.5, "phase": 0}
  ],
  "normalization": "sum"
}
```

Ratio is allowed to be noninteger in Advanced mode, but educational harmonic mode defaults to integer ratios.

## 16. Multi-stage envelope state

```json
{
  "segments": [
    {"target": 1, "duration": 0.1, "curve": 0},
    {"target": 0.7, "duration": 0.3, "curve": 0},
    {"target": 0.7, "duration": 1.0, "curve": 0, "hold": true},
    {"target": 0, "duration": 0.5, "curve": 0}
  ],
  "loopStart": null,
  "loopEnd": null,
  "mode": "gate"
}
```

## 17. Sequencer state

```json
{
  "length": 16,
  "direction": "forward",
  "seed": 42,
  "steps": [
    {"pitch": 60, "gate": 0.8, "velocity": 0.8, "probability": 1, "tie": false}
  ]
}
```

Step arrays are bounded by module definition limits.

## 18. Custom function state

Arbitrary JavaScript source is forbidden.

Safe expression representation:

```json
{
  "ast": {
    "op": "mul",
    "args": [
      {"op": "sin", "args": [{"var": "phase"}]},
      {"const": 0.5}
    ]
  }
}
```

Validator accepts only whitelisted operators/functions, bounded AST depth/node count and finite constants.

## 19. Missing module placeholder

If an imported patch contains an unknown `type`, preserve raw module data:

```json
{
  "id": "mod_unknown",
  "type": "future.unknownThing",
  "moduleVersion": 4,
  "missing": true,
  "raw": {"...": "original sanitized object"},
  "ui": {"x": 1, "y": 2}
}
```

Connections remain visible but inactive where endpoint semantics cannot be resolved.

## 20. Validation stages

Import pipeline:

```text
raw text
 -> JSON parse with size limit
 -> top-level format/schema validation
 -> primitive finite-number validation
 -> migration to current schema
 -> module-type migration
 -> module/parameter/port validation
 -> graph structural validation
 -> graph compilation in staging
 -> user preview/warnings
 -> replace/open current patch only on success
```

At no stage is patch data evaluated as code.

## 21. File size limits

Implementation establishes conservative limits to prevent accidental/malicious memory exhaustion. Suggested initial values:

- patch JSON import: 10 MB hard cap;
- modules: 1000 hard cap, with practical UI warning far lower;
- connections/mod routes: 5000 hard cap;
- automation points: 100,000 aggregate hard cap;
- custom waveform/wavetable arrays bounded by module schema;
- string fields length-bounded.

These are safety caps, not performance promises.

## 22. Schema migrations

Top-level `schemaVersion` is an integer.

```text
migratePatch(doc):
  verify doc.format
  while doc.schemaVersion < CURRENT_SCHEMA:
      fn = migration[doc.schemaVersion -> doc.schemaVersion+1]
      if missing fn: fail
      doc = fn(deepClone(doc))
      validate migration result
  if doc.schemaVersion > CURRENT_SCHEMA:
      open read-only/compatibility preview or reject with preserved file
  return doc
```

Migrations must be pure/deterministic and individually unit-tested with fixtures.

## 23. Module migrations

After top-level migration, each known module type may migrate its own persistent state:

```text
while module.moduleVersion < definition.version:
  module = definition.migrate[moduleVersion](module)
```

A missing migration is a load error for that module; the rest of the patch may be offered with a placeholder rather than data loss.

## 24. Canonical serialization

For tests and URL sharing, serializer outputs canonical order:

- known top-level keys in defined order;
- modules sorted by stable saved order or ID consistently;
- connections sorted consistently;
- object parameter keys according to module definition;
- finite numbers normalized without unnecessary precision explosions.

Canonicalization enables stable hashes and deterministic fixtures.

## 25. Share URL

URL fragments do not go to the server in normal HTTP requests.

Format concept:

`#patch=<version>.<compressed-base64url-data>`

Rules:

- validate/decompress with strict size limit;
- never auto-play audio merely because a shared URL opened;
- show patch preview before potentially expensive load if complexity high;
- if encoded URL exceeds configurable safe length, UI requires file export instead.

## 26. IndexedDB storage

Recommended stores:

- `patches` keyed by patch ID;
- `patchRevisions` optional limited recovery history;
- `assets` reserved for future local wavetable/sample assets;
- `metadata` for database/schema version.

Persistence writes are debounced and transactional. App should not block audio on IndexedDB writes.

## 27. Factory patches

Bundled factory patch files use the same schema and migration path as user patches. CI validates all factory patches by loading, migrating and compiling them.

## 28. Preset vs patch

A full patch is a complete graph.

A module preset may be stored as:

```json
{
  "format": "visualsynth-module-preset",
  "schemaVersion": 1,
  "moduleType": "core.oscillator",
  "moduleVersion": 1,
  "parameters": {},
  "state": {}
}
```

Module preset load changes only selected module and is one undoable command.

## 29. Patch hashing

Optional local patch hash is computed over canonical semantic content excluding volatile metadata (`modifiedAt`, viewport/selection). Uses Web Crypto digest where available. Hash is for duplicate detection/cache, not security authentication.

## 30. Example minimal patch

```json
{
  "format": "visualsynth-patch",
  "schemaVersion": 1,
  "appVersion": "0.1.0",
  "id": "patch_basic",
  "name": "Basic Synth",
  "seed": 1,
  "settings": {"polyphony": 8, "voiceMode": "poly", "quality": "normal", "a4Hz": 440},
  "transport": {"bpm": 120, "timeSignature": [4,4], "swing": 0},
  "modules": [
    {"id":"note","type":"core.noteInput","moduleVersion":1,"scope":"GLOBAL","parameters":{},"state":{},"ui":{"x":0,"y":0}},
    {"id":"osc","type":"core.oscillator","moduleVersion":1,"scope":"VOICE","parameters":{"waveform":"saw","levelDb":-12},"state":{},"ui":{"x":240,"y":0}},
    {"id":"env","type":"core.adsr","moduleVersion":1,"scope":"VOICE","parameters":{"attack":0.01,"decay":0.15,"sustain":0.7,"release":0.25},"state":{},"ui":{"x":240,"y":260}},
    {"id":"vca","type":"core.vca","moduleVersion":1,"scope":"VOICE","parameters":{"gain":1},"state":{},"ui":{"x":520,"y":0}},
    {"id":"master","type":"core.master","moduleVersion":1,"scope":"GLOBAL","parameters":{"gainDb":-6},"state":{},"ui":{"x":800,"y":0}}
  ],
  "connections": [],
  "modulations": [],
  "automation": [],
  "probes": [],
  "midiMappings": [],
  "performanceView": {},
  "ui": {}
}
```

The real factory patch includes validated port connections omitted here for brevity.

## 31. Round-trip acceptance

For every fixture:

```text
original -> parse -> migrate -> validate -> canonical serialize -> parse -> validate
```

must preserve semantic patch state.

No serializer may emit NaN, Infinity, functions, DOM objects, typed-array object internals, AudioNodes, AudioParams or worklet runtime state.
