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
  return { formatVersion: 1, name, modules: Object.fromEntries(modules.map(item => [item.id, item])), connections, settings: { description } };
}

const note = (x = 30, y = 90) => module('note', 'core.note-input', 'global', x, y, { maxVoices: 8, transpose: 0 });
const sum = (x = 650, y = 90) => module('sum', 'core.voice-sum', 'global', x, y, { gain: 1 });
const master = (x = 880, y = 90) => module('master', 'core.master-output', 'global', x, y, { gain: 0.8 });

export const EXAMPLE_PATCHES = Object.freeze([
  {
    id: 'basic-saw',
    title: 'Basic Saw',
    explanation: 'Note Input sends pitch to the voice Oscillator. Oscillator audio is combined by Voice Sum, then sent to Master Output.',
    patch: patch('Basic Saw', 'The simplest playable subtractive-synth signal path.', [
      note(),
      module('osc', 'core.oscillator', 'voice', 270, 90, { waveform: 2, octave: 0, semitone: 0, cents: 0, amplitude: 0.25, pulseWidth: 0.5 }),
      sum(), master()
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'osc', 'audioOut', 'sum', 'audioIn'),
      cable('c3', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  },
  {
    id: 'filtered-subtractive',
    title: 'Filtered Saw',
    explanation: 'Pitch drives a saw Oscillator. Its audio passes through a voice Filter before Voice Sum and Master Output. Lower the filter cutoff to hear harmonics being removed.',
    patch: patch('Filtered Saw', 'Classic oscillator into low-pass filter.', [
      note(),
      module('osc', 'core.oscillator', 'voice', 250, 70, { waveform: 2, octave: 0, semitone: 0, cents: 0, amplitude: 0.28, pulseWidth: 0.5 }),
      module('filter', 'core.filter', 'voice', 475, 70, { cutoff: 2800, resonance: 0.22, drive: 0 }),
      sum(700, 70), master(925, 70)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'osc', 'audioOut', 'filter', 'audioIn'),
      cable('c3', 'filter', 'audioOut', 'sum', 'audioIn'),
      cable('c4', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  },
  {
    id: 'dual-oscillator',
    title: 'Dual Oscillator',
    explanation: 'One Note Input drives two oscillators. Their voice audio is combined at Voice Sum before Master Output. Slight detuning makes the sound wider and more animated.',
    patch: patch('Dual Oscillator', 'Two pitched oscillators summed into one output.', [
      note(25, 120),
      module('oscA', 'core.oscillator', 'voice', 260, 30, { waveform: 2, octave: 0, semitone: 0, cents: -7, amplitude: 0.16, pulseWidth: 0.5 }),
      module('oscB', 'core.oscillator', 'voice', 260, 300, { waveform: 4, octave: 0, semitone: 0, cents: 7, amplitude: 0.12, pulseWidth: 0.5 }),
      sum(570, 150), master(820, 150)
    ], [
      cable('c1', 'note', 'pitchOut', 'oscA', 'pitchIn'),
      cable('c2', 'note', 'pitchOut', 'oscB', 'pitchIn'),
      cable('c3', 'oscA', 'audioOut', 'sum', 'audioIn'),
      cable('c4', 'oscB', 'audioOut', 'sum', 'audioIn'),
      cable('c5', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  },
  {
    id: 'sub-bass',
    title: 'Sub Bass',
    explanation: 'A low sine oscillator is filtered gently, summed across active voices, and sent to Master. Use the oscillator octave control to compare sub and mid-range fundamentals.',
    patch: patch('Sub Bass', 'Simple low sine patch.', [
      note(),
      module('osc', 'core.oscillator', 'voice', 260, 80, { waveform: 0, octave: -2, semitone: 0, cents: 0, amplitude: 0.38, pulseWidth: 0.5 }),
      module('filter', 'core.filter', 'voice', 490, 80, { cutoff: 900, resonance: 0.08, drive: 0 }),
      sum(720, 80), master(940, 80)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'osc', 'audioOut', 'filter', 'audioIn'),
      cable('c3', 'filter', 'audioOut', 'sum', 'audioIn'),
      cable('c4', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  },
  {
    id: 'pulse-color',
    title: 'Pulse Color',
    explanation: 'A pulse oscillator demonstrates how pulse width changes harmonic color. Pitch comes from Note Input; audio crosses the Voice Sum boundary and reaches Master Output.',
    patch: patch('Pulse Color', 'Pulse-width timbre example.', [
      note(),
      module('osc', 'core.oscillator', 'voice', 280, 90, { waveform: 5, octave: 0, semitone: 0, cents: 0, amplitude: 0.22, pulseWidth: 0.28 }),
      sum(610, 90), master(850, 90)
    ], [
      cable('c1', 'note', 'pitchOut', 'osc', 'pitchIn'),
      cable('c2', 'osc', 'audioOut', 'sum', 'audioIn'),
      cable('c3', 'sum', 'audioOut', 'master', 'audioIn')
    ])
  }
]);

export const DEFAULT_EXAMPLE_ID = 'basic-saw';

export function getExamplePatch(id = DEFAULT_EXAMPLE_ID) {
  const example = EXAMPLE_PATCHES.find(item => item.id === id) ?? EXAMPLE_PATCHES[0];
  return { ...example, patch: structuredClone(example.patch) };
}
