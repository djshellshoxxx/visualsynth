# VisualSynth GUI / Workspace Specification

## 1. UI goals

The interface must feel like constructing and operating an instrument rather than editing a generic node graph. The patch workspace is the primary surface; educational assistance, inspectors, analyzers and preset browsing are secondary panels layered around it.

The visual language is Circuit Drift Labs: dark, technical, electronic, clean, modular-hardware influenced, with color reserved mainly for signal type, modulation activity, warnings and visualized signal content. Avoid fake 3D hardware, excessive gradients, generic AI styling and decorative animation.

## 2. Primary layout

Desktop default:

```text
+--------------------------------------------------------------------------------+
| Top Bar: Patch | Save | Undo Redo | Transport | CPU | MIDI | Learning | Panic |
+----------------------+-----------------------------------------+---------------+
| Module Library       |                                         | Inspector     |
| Search/Categories    |            PATCH WORKSPACE              | Parameter     |
| Templates            |                                         | Routing       |
| Presets              |                                         | Learn/Help    |
|                      |                                         | Diagnostics   |
+----------------------+-----------------------------------------+---------------+
| Performance Strip: on-screen keys / macros / XY / master meters              |
+--------------------------------------------------------------------------------+
```

Panels may collapse. Workspace receives maximum area. On laptop/tablet, side panels become drawers.

## 3. Workspace

The workspace is a pan/zoom canvas containing DOM-based module panels and one cable-render layer.

Requirements:

- pan with middle mouse, space+drag, touch two-finger gesture, or minimap navigation;
- zoom centered on pointer, with bounded scale;
- selectable grid/snap;
- multi-select modules;
- drag modules as a group;
- box selection;
- copy/paste/duplicate selected modules including internal connections;
- optional minimap for large patches;
- `Frame All`, `Frame Selection`, `Go to Master` commands;
- modules preserve logical positions independently of viewport zoom.

DOM panels are preferred to drawing entire UI on one canvas because controls need accessibility, text selection, focus and responsive layout.

## 4. Module panel anatomy

```text
+--------------------------------------------------+
| [type icon] OSCILLATOR 1          [scope][...][x]|
| IN: pitch fm pm                    OUT: audio ○   |
|                                                  |
|  [ live waveform / main visualization ]          |
|                                                  |
| Wave [Saw v]    Oct [0]    Fine [0.0c]           |
| Shape [knob]    Level [knob]   Pan [knob]        |
|                                                  |
| mod indicators / CPU badge / help indicator      |
+--------------------------------------------------+
```

Every module has:

- title/type and optional user name;
- stable port locations;
- scope badge when relevant;
- enable/bypass/mute controls appropriate to type;
- duplicate/delete context actions;
- collapse/expand state when module supports it;
- meaningful visualization;
- key parameters visible in Normal mode;
- Advanced inspector for secondary parameters.

## 5. Module sizing

Modules use a small set of standardized width classes (`S`, `M`, `L`, `XL`) rather than arbitrary free resize by default. Free resizing is useful only for analyzer/editor modules and therefore is allowed for:

- scopes/spectra;
- wavetable/harmonic editors;
- sequencers;
- multi-stage envelope;
- mixer;
- master analyzer.

Resizable modules have min/max dimensions and persistent size. Standard synth modules remain fixed-class to keep cable alignment manageable.

## 6. Add Module system

Open by:

- left library panel;
- double-click empty workspace;
- keyboard shortcut;
- right-click `Add Module`.

Search must match module title, category, concept synonyms and educational tags (`filter`, `low pass`, `vcf`).

Categories:

- Sources
- Oscillators
- Filters
- Envelopes
- Modulation
- Mixing/VCA
- Effects
- Sequencing
- MIDI/Performance
- Analysis
- Stereo
- Utilities
- Experimental

Beginner mode filters the library to Core + selected Standard modules. Hidden modules already in a patch remain represented, not deleted.

## 7. Patch ports

Ports have:

- shape/icon by signal class;
- color by signal class;
- text tooltip/name;
- hover-compatible target highlighting;
- live activity marker when enabled;
- accessible label such as `Oscillator 1 audio output`.

Suggested non-color cues:

- AUDIO: circular port, solid cable;
- CONTROL: diamond port, dashed or fine cable;
- PITCH: hex/triangle-coded port, double-stripe cable;
- GATE: square port;
- TRIGGER: small lightning/pulse icon;
- CLOCK: clock tick icon;
- EVENT: packet/note icon.

Exact colors belong in theme tokens, not the specification.

## 8. Cable interaction

Create connection:

1. pointer down on output port;
2. drag temporary cable;
3. compatible targets illuminate;
4. incompatible targets remain dim and show reason on hover;
5. drop on compatible target;
6. structural validation runs immediately;
7. full graph compile follows;
8. if accepted, cable becomes active; if rejected, animate brief error and return to previous graph.

Alternative keyboard flow:

- focus source port;
- invoke Connect;
- cycle/filter compatible destinations;
- confirm.

Disconnect:

- select cable then Delete/Backspace;
- context menu `Disconnect`;
- drag destination end away and release into empty space.

Cable selection reveals inspector with source/destination, signal class, scope transition, modulation amount/curve where applicable, latency and probe controls.

## 9. Cable routing visualization

Default cables are smooth bezier or orthogonal-curved paths. A global preference can choose `Curved`, `Straight`, or `Compact/Orthogonal`.

Cable organizer features:

- optional cable dimming except selected/hovered;
- `Show modulation only`;
- `Show audio only`;
- cable bundling visual hint for parallel routes;
- selected cable always brought to foreground;
- crossings receive no interactive node unless user explicitly inserts a junction/utility.

Cable animation is subtle and optional. Activity is shown through moving dashes/brightness or small source-to-destination pulses at <= 15–30 Hz visual update. Reduced-motion disables motion and uses static intensity/value badges.

## 10. Parameter controls

Supported widgets:

- knob;
- vertical/horizontal slider;
- numeric field;
- dropdown/segmented enum;
- toggle;
- envelope graph;
- XY pad;
- harmonic bars;
- curve editor;
- step sequencer cells.

All continuous widgets support:

- drag;
- Shift or configured modifier for fine adjustment;
- double-click reset to default;
- direct numeric entry;
- keyboard arrows when focused;
- context menu for MIDI Learn, automation, modulation assignments, copy/paste value, reset;
- visible units.

Wheel adjustment is disabled by default unless control is focused to avoid accidental patch changes while scrolling.

## 11. Modulation UI

Modulation is represented through the same underlying routes as cables.

### Cable method

Connect an LFO/envelope/control output to a module's modulation port or directly to a parameter target handle.

### Direct assignment shortcut

Dragging a modulation source badge onto a control creates an implicit parameter modulation connection. The resulting assignment is visible as:

- a small source badge around/beside the control;
- colored/banded arc showing modulation range;
- live effective-value marker;
- entry in the parameter's modulation inspector.

The shortcut never creates hidden semantics that cannot be exposed as a route.

### Modulation amount

After drop, dragging outward/inward or using inspector sets amount. Invert/polarity, curve and range are inspector options.

## 12. Parameter value visualization

A modulated control displays:

- base value indicator;
- full possible modulation range;
- live effective value;
- clipping at parameter min/max when occurring;
- source badges.

For cutoff, pitch and time, range display follows logarithmic/perceptual scale where appropriate.

## 13. Module visualization interaction

Visuals are not passive whenever direct manipulation is useful.

Examples:

- oscillator: drag pulse-width line or harmonic bars;
- filter: drag cutoff/resonance point on response curve;
- ADSR: drag A/D/S/R breakpoints;
- multi-envelope: add/move/delete points;
- EQ: drag band nodes;
- waveshaper: edit transfer curve;
- wavetable: scrub frame position and edit selected frame;
- sequencer: paint steps;
- delay: drag repeat spacing/feedback envelope in editor mode.

Every direct visual edit updates the same parameter/state model as conventional controls.

## 14. Inspector panel

Context-sensitive inspector tabs:

- `PARAMS`: detailed values/advanced settings;
- `MOD`: all modulation routes for selected module/parameter;
- `ROUTING`: ports/connections/scope/latency;
- `VISUAL`: visualization options;
- `LEARN`: explanation and related lesson;
- `DIAG`: module CPU/fault/state diagnostics in Advanced mode.

Multi-selection inspector exposes common actions and shared parameter edits only when semantically compatible.

## 15. Beginner / Normal / Advanced modes

### Beginner

- Core module library plus curated Standard set;
- larger controls/visuals;
- explanations visible by default;
- advanced ports/secondary parameters collapsed;
- invalid-routing reasons phrased educationally;
- templates prominent.

### Normal

- full common module library;
- most routing/modulation controls visible;
- explanations on demand.

### Advanced

- all available modules;
- detailed rate/quality/scope controls;
- graph/latency diagnostics;
- explicit poly/global utilities;
- advanced probes/metrics;
- unsafe-but-numerically-bounded parameter extensions where appropriate.

Mode changes never modify patch audio state.

## 16. Learning Mode

Global toggle. When enabled:

- controls gain contextual help affordance;
- hover/focus/click help explains concept and current setting;
- compatible next-step suggestions can be displayed in a nonmodal panel;
- visual signal flow can highlight relevant routes;
- lesson checkpoints can validate patch state.

Help card structure:

```text
FILTER CUTOFF
What it is: boundary frequency of this filter response.
What you hear: lowering it removes upper harmonics for low-pass mode.
What you see: the response curve moves left and spectrum above cutoff falls.
Try: hold a saw note and sweep 12 kHz -> 300 Hz.
Typical range: sound dependent; 100 Hz–10 kHz is useful for obvious demonstrations.
Related: harmonics, resonance, key tracking, envelopes.
```

## 17. Interactive lesson system

A lesson is data-driven:

```ts
interface Lesson {
  id: string;
  title: string;
  startPatch: PatchDocument | PatchReference;
  steps: LessonStep[];
}

interface LessonStep {
  instruction: string;
  highlightTargets: TargetRef[];
  expectedCondition?: PatchPredicate;
  demonstration?: PatchCommand[];
  audioCue?: 'PLAY_NOTE'|'PLAY_CHORD'|'NONE';
  allowSkip: boolean;
}
```

Lessons operate on actual patch state. A sandbox copy of the user's current patch is used unless the user explicitly chooses to replace it. Exiting offers restore/keep changes.

Initial lessons:

1. Waveforms
2. Frequency and pitch
3. Amplitude/VCA
4. Harmonics
5. Oscillator mixing/interference
6. Phase
7. Detuning/beating
8. Filters
9. Resonance
10. ADSR
11. LFO modulation
12. FM/PM
13. AM/ring modulation
14. PWM
15. Subtractive synthesis
16. Additive synthesis
17. Wavetable synthesis
18. Signal routing
19. Effects
20. Build a basic patch

## 18. Visual Signal Flow Mode

When enabled, VisualSynth identifies one or more paths from selected source to Master.

UI behavior:

- unrelated modules/cables dim;
- active route is emphasized;
- each stage can show an expanded before/after visual;
- stage order panel lists source -> transformations -> output;
- hovering a stage highlights corresponding module/cable;
- poly voice and global boundary is explicitly marked.

If multiple parallel paths exist, user selects `All`, `Shortest audible path`, or a specific branch.

## 19. Compare Mode

Compare Mode provides A/B without requiring users to duplicate complex patches manually.

Initial comparison mechanisms:

- selected module bypass A/B;
- parameter snapshot A/B;
- selected branch enable A/B;
- two saved mini-snapshots of patch parameter state.

Audio switching uses de-clicked crossfade. Visuals can display A and B overlays/frozen captures. Compare Mode never stores two independent full realtime engines unless necessary; it manipulates controlled graph state or snapshot values.

## 20. Preset browser

Preset browser includes:

- category;
- tags;
- search;
- favorite/local user state;
- author/source (`Factory`, `User`);
- required app version/module compatibility;
- short description of synthesis method;
- `Load`, `Preview`, `Duplicate as User Patch`.

Factory educational presets link to relevant lessons.

## 21. Patch library

User patch library provides:

- name;
- tags/category;
- modified date;
- app/schema version;
- duplicate/rename/delete/export;
- local search/filter;
- optional small generated preview metadata (not audio unless explicitly added later).

Delete requires undoable soft-delete within current session or confirmation for persistent removal.

## 22. Save/load/import/export

`Save` writes current patch to IndexedDB and clears dirty state.

`Save As` creates new ID.

`Export` downloads versioned JSON.

`Import` validates in a staging state and shows:

- patch name/version;
- missing modules;
- migration warnings;
- estimated complexity;
- `Open`, `Open as Copy`, `Cancel`.

Current patch remains untouched until successful validation.

## 23. Share URL

For sufficiently small patches:

- canonical serialized patch is compressed/encoded into URL fragment;
- no server receives patch data;
- app displays approximate URL size before copy.

Large patches fall back to file export with a clear explanation.

## 24. Recording/export UI

Recording panel:

- realtime record button;
- elapsed time/size estimate;
- stop/cancel;
- filename;
- output format.

Offline render panel:

- duration/end condition;
- sample rate;
- bit depth/float;
- tail duration for delay/reverb;
- deterministic seed option defaults to patch seed;
- progress/cancel.

No recording starts without explicit user action.

## 25. Automation UI

Automation is secondary and hidden until used.

Parameter context menu -> `Automate` opens lane/editor in bottom drawer.

Modes:

- record knob gesture while transport runs;
- draw points;
- step lane;
- curve segments.

Automation lane shows base/automated value, while module control continues to show final modulated effective value.

## 26. MIDI UI

MIDI status button states:

- unsupported;
- permission not requested;
- permission denied;
- connected devices count;
- device disconnected/reconnected.

MIDI settings:

- input device(s);
- channel Omni/1–16;
- pitch bend range default per patch;
- velocity curve;
- aftertouch handling;
- sustain behavior;
- mappings list;
- clear mapping.

### MIDI Learn

1. user selects `MIDI Learn` on parameter;
2. parameter visibly enters learn state;
3. next eligible MIDI CC/pitch control is captured;
4. user sees device/channel/CC and can set min/max/invert/curve;
5. Escape cancels.

Note events are not accidentally captured as CC mappings.

## 27. Computer keyboard

Default chromatic layout modeled after common virtual piano mapping:

- lower letter row = white/black key arrangement;
- upper row optionally second octave;
- Z/X or configured keys shift octave;
- pressed computer keys visibly depress on-screen keys.

Editable mappings are future-friendly. Text fields suppress musical shortcuts while focused.

Key repeat must not retrigger held notes unless explicit retrigger mode requests it.

## 28. On-screen keyboard/performance strip

Supports:

- piano layout;
- optional pad/chord layout later;
- octave range;
- mouse/touch multi-pointer where browser permits;
- vertical pointer position approximating velocity in optional mode;
- pitch/mod wheels in performance view;
- sustain toggle for touch devices.

## 29. Macros/performance view

Users can pin chosen controls/macros/XY pads to a compact Performance Strip. This creates an instrument-focused view for playing after patch construction.

Pinned controls reference original parameter IDs; they are not duplicate parameters.

## 30. Randomization UI

At module level:

- Randomize
- Mutate 10/25/50/100%
- Lock parameter
- Safe/Chaos mode
- Seed/repeat mutation
- Undo immediately available

Whole-patch random routing is Advanced/Experimental and always compiles in staging before application.

## 31. Undo/redo UI

Top bar shows Undo/Redo icons and optional action text tooltip (`Undo: Move Filter`, `Redo: Randomize Oscillator`).

History panel in Advanced mode can show recent commands but does not need arbitrary time travel for MVP.

## 32. Diagnostics UI

Advanced diagnostics drawer:

- app/build version;
- browser;
- AudioContext state/sample rate/latencies;
- active voices;
- module/connection/probe counts;
- current patch revision and active engine revision;
- graph compile time;
- DSP load estimate;
- late events;
- finite-value guard count;
- visualization fps/dropped frames;
- MIDI devices;
- recent errors/warnings.

Buttons:

- Copy Diagnostics
- Download Diagnostics JSON
- Restart Audio Engine
- Panic

## 33. Performance indicator

Top bar uses concise state:

`DSP 32% | VIS 24fps | Voices 6/16`

When budget warning occurs:

- yellow/attention state before audible issue;
- offer `Reduce Visual Load` first;
- then lower quality tier if user accepts or automatic adaptive mode enabled;
- diagnostics records adaptation.

## 34. Mobile/tablet layout

### Tablet landscape

Workspace remains central; module library and inspector are slide-over drawers; performance keyboard can dock bottom.

### Phone portrait

Default to one of:

- Performance
- Patch Navigator
- Selected Module
- Learn

Large graph overview is mini-map/navigator rather than full simultaneous modules. Users can still connect ports through a two-step source/destination flow if drag cable is impractical.

## 35. Touch behavior

Use Pointer Events.

- knobs: vertical drag with optional radial mode preference;
- module move: title bar drag, not arbitrary panel drag;
- cables: large invisible hit target around ports/lines;
- pinch workspace zoom;
- long-press opens context menu;
- two-finger gestures reserved for viewport, not parameter edit.

## 36. Accessibility

- Every control is focusable in logical order.
- Knobs expose ARIA role/value text and keyboard increments.
- Canvas visualizations have concise text alternatives and neighboring numeric readouts.
- Cable/port classes have labels and patterns/icons beyond color.
- Focus rings are always visible for keyboard navigation.
- Reduced motion disables cable pulses, animated background traces and auto-scrolling scopes where not essential; a static/stepped representation remains.
- High contrast theme token set is supported.
- Screen-reader users can inspect selected module routing as a textual source/destination list.

## 37. Keyboard command set

Initial commands:

- Ctrl/Cmd+Z Undo
- Ctrl/Cmd+Shift+Z / Ctrl+Y Redo
- Ctrl/Cmd+S Save (prevent browser page save when workspace active)
- Ctrl/Cmd+C/V Duplicate/copy selected modules when no text field active
- Delete/Backspace Delete selection with platform-safe handling
- Space+drag Pan workspace
- F Frame selection
- Shift+F Frame all
- M Open module search
- L Toggle Learning Mode
- Esc cancel cable/drag/learn action
- dedicated Panic shortcut configurable and protected against accidental browser conflicts

## 38. Visual design tokens

Central tokens define:

- background levels;
- panel border/active/focus states;
- text hierarchy;
- signal class colors;
- warning/error/success states;
- module tier/category accents;
- cable thickness/pattern;
- font sizes;
- spacing/radii;
- animation durations;
- scope grid/trace styling.

No individual module hard-codes its own unrelated visual theme.

## 39. Empty/default startup choices

First launch displays choice cards:

- `Basic Synth` (recommended)
- `Beginner Lesson`
- `Empty Patch`
- `Browse Presets`

Returning users reopen last local patch only if preference enabled; otherwise show library/start options.

## 40. Default Basic Synth patch

```text
Note Input
   | pitch/gate
   v
Oscillator ---> Multimode Filter ---> VCA ---> Master
                    ^                  ^
                    |                  |
                  ADSR ---------------+

LFO -> optional cutoff modulation (visible but zero/low depth)
```

This patch demonstrates routing immediately without overwhelming the user.

## 41. UI acceptance rules

- No major sound-affecting parameter is represented only by an unlabeled icon.
- No hidden modulation route may change sound without a visible assignment indicator.
- Invalid connections explain why.
- A beginner can build oscillator -> filter -> VCA -> master without opening documentation.
- An advanced user can inspect every route, scope transition and modulation amount.
- Audio continues if visualization/UI frame rate collapses.
- The same patch can be switched across Beginner/Normal/Advanced without semantic changes.
