const module = (id, type, scope, x, y, parameters = {}) => ({
  id,
  type,
  scope,
  moduleVersion: 1,
  position: { x, y },
  parameters
});

const cable = (id, fromModule, fromPort, toModule, toPort) => ({
  id,
  from: { moduleId: fromModule, portId: fromPort },
  to: { moduleId: toModule, portId: toPort }
});

function patch(name, description, modules, connections) {
  return {
    formatVersion: 1,
    name,
    modules: Object.fromEntries(modules.map(item => [item.id, item])),
    connections,
    settings: { description }
  };
}

const note = (x = 20, y = 120) => module('note', 'core.note-input', 'global', x, y, { maxVoices: 8, transpose: 0 });
const sum = (x = 900, y = 120, gain = 1) => module('sum', 'core.voice-sum', 'global', x, y, { gain });
const master = (x = 1120, y = 120, gain = 0.75) => module('master', 'core.master-output', 'global', x, y, { gain });
const osc = (id, x, y, parameters = {}) => module(id, 'core.oscillator', 'voice', x, y, {
  waveform: 2,
  octave: 0,
  semitone: 0,
  cents: 0,
  amplitude: 0.22,
  pulseWidth: 0.5,
  ...parameters
});
const filter = (x = 540, y = 120, parameters = {}) => module('filter', 'core.filter', 'voice', x, y, {
  cutoff: 5000,
  resonance: 0.16,
  drive: 0,
  ...parameters
});
const envelope = (x = 300, y = 340, parameters = {}) => module('env', 'core.adsr', 'voice', x, y, {
  attack: 0.01,
  decay: 0.15,
  sustain: 0.7,
  release: 0.25,
  ...parameters
});
const vca = (x = 740, y = 120, gain = 1) => module('vca', 'core.vca', 'voice', x, y, { gain });

function voicedPath({
  name,
  description,
  explanation,
  oscillator,
  filterParameters,
  envelopeParameters,
  masterGain = 0.75
}) {
  return {
    title: name,
    explanation,
    patch: patch(name, description, [
      note(),
      osc('osc', 270, 80, oscillator),
      envelope(280, 330, envelopeParameters),
      filter(520, 80, filterParameters),
      vca(740, 80),
      sum(930, 80),
      master(1140, 80, masterGain)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'note', 'gateOut', 'env', 'gateIn'),
      cable('c3', 'osc', 'audioOut', 'filter', 'audioIn'),
      cable('c4', 'filter', 'audioOut', 'vca', 'audioIn'),
      cable('c5', 'env', 'controlOut', 'vca', 'gainIn'),
      cable('c6', 'vca', 'audioOut', 'sum', 'audioIn'),
      cable('c7', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  };
}

function dualOscPath({
  name,
  description,
  explanation,
  oscillatorA,
  oscillatorB,
  mixerGain = 0.6,
  filterParameters,
  envelopeParameters,
  masterGain = 0.7
}) {
  return {
    title: name,
    explanation,
    patch: patch(name, description, [
      note(20, 170),
      osc('osc', 250, 35, oscillatorA),
      osc('osc2', 250, 250, oscillatorB),
      module('mix', 'core.mixer', 'voice', 475, 125, { gain: mixerGain }),
      envelope(475, 390, envelopeParameters),
      filter(680, 125, filterParameters),
      vca(885, 125),
      sum(1080, 125),
      master(1280, 125, masterGain)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'note', 'pitchOut', 'osc2', 'pitchIn'),
      cable('c3', 'note', 'gateOut', 'env', 'gateIn'),
      cable('c4', 'osc', 'audioOut', 'mix', 'audioInA'),
      cable('c5', 'osc2', 'audioOut', 'mix', 'audioInB'),
      cable('c6', 'mix', 'audioOut', 'filter', 'audioIn'),
      cable('c7', 'filter', 'audioOut', 'vca', 'audioIn'),
      cable('c8', 'env', 'controlOut', 'vca', 'gainIn'),
      cable('c9', 'vca', 'audioOut', 'sum', 'audioIn'),
      cable('c10', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  };
}

export const EXAMPLE_PATCHES = Object.freeze([
  {
    id: 'basic-saw',
    title: 'Basic Saw',
    explanation: 'The simplest complete playable path: Note Input controls a saw Oscillator, which crosses Voice Sum and reaches Master Output.',
    patch: patch('Basic Saw', 'Simple playable saw oscillator.', [
      note(),
      osc('osc', 270, 120, { waveform: 2, amplitude: 0.24 }),
      sum(600, 120),
      master(830, 120, 0.72)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'osc', 'audioOut', 'sum', 'audioIn'),
      cable('c3', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  },
  {
    id: 'warm-analog',
    ...dualOscPath({
      name: 'Warm Analog',
      description: 'Detuned saw and triangle oscillators with a gentle filter and medium envelope.',
      explanation: 'Two slightly detuned oscillators feed a voice Mixer, warm Filter, ADSR-controlled VCA, Voice Sum and Master. This is a useful general-purpose starting synth.',
      oscillatorA: { waveform: 2, cents: -6, amplitude: 0.18 },
      oscillatorB: { waveform: 1, cents: 7, amplitude: 0.16 },
      mixerGain: 0.72,
      filterParameters: { cutoff: 4200, resonance: 0.14, drive: 0.18 },
      envelopeParameters: { attack: 0.018, decay: 0.28, sustain: 0.72, release: 0.5 },
      masterGain: 0.68
    })
  },
  {
    id: 'sub-bass',
    ...voicedPath({
      name: 'Sub Bass',
      description: 'Low sine bass with restrained filtering and a tight envelope.',
      explanation: 'A sine oscillator two octaves down passes through a low filter and a tight ADSR/VCA stage for a clean sub-bass starting point.',
      oscillator: { waveform: 0, octave: -2, amplitude: 0.42 },
      filterParameters: { cutoff: 760, resonance: 0.05, drive: 0.06 },
      envelopeParameters: { attack: 0.004, decay: 0.12, sustain: 0.82, release: 0.18 },
      masterGain: 0.7
    })
  },
  {
    id: 'reese-bass',
    ...dualOscPath({
      name: 'Reese Bass',
      description: 'Two detuned saw oscillators mixed into a dark bass patch.',
      explanation: 'Two saw oscillators are detuned in opposite directions, mixed per voice, filtered dark, shaped by ADSR and then summed to the master.',
      oscillatorA: { waveform: 2, octave: -1, cents: -13, amplitude: 0.2 },
      oscillatorB: { waveform: 3, octave: -1, cents: 13, amplitude: 0.2 },
      mixerGain: 0.68,
      filterParameters: { cutoff: 1800, resonance: 0.2, drive: 0.35 },
      envelopeParameters: { attack: 0.01, decay: 0.22, sustain: 0.78, release: 0.32 },
      masterGain: 0.64
    })
  },
  {
    id: 'pluck',
    ...voicedPath({
      name: 'Pluck',
      description: 'Bright transient patch with a fast-decaying amplitude envelope.',
      explanation: 'A bright waveform is filtered and controlled by a very short ADSR so notes strike quickly and decay like a plucked synth voice.',
      oscillator: { waveform: 4, amplitude: 0.24 },
      filterParameters: { cutoff: 6800, resonance: 0.24, drive: 0.08 },
      envelopeParameters: { attack: 0.002, decay: 0.2, sustain: 0.06, release: 0.14 },
      masterGain: 0.68
    })
  },
  {
    id: 'soft-pad',
    ...dualOscPath({
      name: 'Soft Pad',
      description: 'Slow, blended dual-oscillator patch with a soft filter and long release.',
      explanation: 'Triangle and saw waves blend through a gentle filter while a slow ADSR controls the VCA, making this configuration useful for sustained chords.',
      oscillatorA: { waveform: 1, cents: -5, amplitude: 0.15 },
      oscillatorB: { waveform: 2, cents: 5, amplitude: 0.12 },
      mixerGain: 0.72,
      filterParameters: { cutoff: 3600, resonance: 0.1, drive: 0.05 },
      envelopeParameters: { attack: 0.85, decay: 1.2, sustain: 0.78, release: 2.8 },
      masterGain: 0.66
    })
  },
  {
    id: 'acid-bass',
    ...voicedPath({
      name: 'Acid Bass',
      description: 'Saw bass with a low, resonant filter and short envelope.',
      explanation: 'A saw oscillator one octave down feeds a resonant driven filter and tight ADSR/VCA stage. Move cutoff and resonance for acid-style movement.',
      oscillator: { waveform: 2, octave: -1, amplitude: 0.26 },
      filterParameters: { cutoff: 1150, resonance: 0.72, drive: 0.42 },
      envelopeParameters: { attack: 0.003, decay: 0.16, sustain: 0.32, release: 0.11 },
      masterGain: 0.62
    })
  },
  {
    id: 'pulse-lead',
    ...voicedPath({
      name: 'Pulse Lead',
      description: 'Narrow pulse lead with a focused filter and responsive envelope.',
      explanation: 'A pulse oscillator with reduced pulse width creates a harmonically rich lead before filtering and ADSR-controlled amplification.',
      oscillator: { waveform: 5, amplitude: 0.22, pulseWidth: 0.28 },
      filterParameters: { cutoff: 5200, resonance: 0.26, drive: 0.12 },
      envelopeParameters: { attack: 0.008, decay: 0.18, sustain: 0.68, release: 0.24 },
      masterGain: 0.67
    })
  },
  {
    id: 'bright-lead',
    ...dualOscPath({
      name: 'Bright Lead',
      description: 'Layered saw and square lead with an open filter and fast envelope.',
      explanation: 'Saw and square oscillators are layered and lightly detuned, then sent through an open filter and quick ADSR for a brighter performance patch.',
      oscillatorA: { waveform: 2, cents: -4, amplitude: 0.17 },
      oscillatorB: { waveform: 4, cents: 4, amplitude: 0.14 },
      mixerGain: 0.7,
      filterParameters: { cutoff: 9200, resonance: 0.18, drive: 0.1 },
      envelopeParameters: { attack: 0.006, decay: 0.16, sustain: 0.76, release: 0.2 },
      masterGain: 0.64
    })
  },
  {
    id: 'init-patch',
    title: 'Init / Minimal',
    explanation: 'A neutral triangle oscillator with complete pitch and output routing. Use this as the clean starting point for building your own patch.',
    patch: patch('Init / Minimal', 'Minimal fully wired starting patch.', [
      note(),
      osc('osc', 270, 120, { waveform: 1, amplitude: 0.2 }),
      sum(600, 120),
      master(830, 120, 0.7)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'osc', 'audioOut', 'sum', 'audioIn'),
      cable('c3', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  }
]);

export const DEFAULT_EXAMPLE_ID = 'basic-saw';
export const INIT_EXAMPLE_ID = 'init-patch';

export function getExamplePatch(id = DEFAULT_EXAMPLE_ID) {
  const example = EXAMPLE_PATCHES.find(item => item.id === id)
    ?? EXAMPLE_PATCHES.find(item => item.id === DEFAULT_EXAMPLE_ID)
    ?? EXAMPLE_PATCHES[0];
  return { ...example, patch: structuredClone(example.patch) };
}
