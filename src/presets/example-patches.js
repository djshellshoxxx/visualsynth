const module = (id, type, scope, x, y, parameters = {}) => ({ id, type, scope, moduleVersion: 1, position: { x, y }, parameters });
const cable = (id, fromModule, fromPort, toModule, toPort) => ({ id, from: { moduleId: fromModule, portId: fromPort }, to: { moduleId: toModule, portId: toPort } });
function patch(name, description, modules, connections) { return { formatVersion: 1, name, modules: Object.fromEntries(modules.map(item => [item.id, item])), connections, settings: { description } }; }
const note = () => module('note', 'core.note-input', 'global', 20, 120, { maxVoices: 8, transpose: 0 });
const osc = (id, x, y, parameters = {}) => module(id, 'core.oscillator', 'voice', x, y, { waveform: 2, octave: 0, semitone: 0, cents: 0, amplitude: 0.22, pulseWidth: 0.5, ...parameters });
const sum = x => module('sum', 'core.voice-sum', 'global', x, 120, { gain: 1 });
const master = x => module('master', 'core.master-output', 'global', x, 120, { gain: 0.68 });

function effectModule(id, type, x, parameters = {}) {
  const defaults = {
    'core.filter': { mode: 0, cutoff: 5000, resonance: 0.15, drive: 0 },
    'core.distortion': { drive: 3, tone: 0.65, mix: 0.7 },
    'core.delay': { time: 0.25, feedback: 0.3, damping: 0.25, mix: 0.35 },
    'core.echo': { time: 0.36, feedback: 0.58, damping: 0.42, mix: 0.42 }
  };
  return module(id, type, 'global', x, 120, { ...(defaults[type] ?? {}), ...parameters });
}

function makePreset({ id, title, description, explanation, oscillators, effects = [] }) {
  const modules = [note()];
  const connections = [];
  let cableIndex = 1;
  oscillators.forEach((parameters, index) => {
    const oscId = index === 0 ? 'osc' : `osc${index + 1}`;
    modules.push(osc(oscId, 250, 45 + index * 210, parameters));
    connections.push(cable(`c${cableIndex++}`, 'note', 'pitchOut', oscId, 'pitchIn'));
  });
  modules.push(sum(510));
  oscillators.forEach((_parameters, index) => {
    const oscId = index === 0 ? 'osc' : `osc${index + 1}`;
    connections.push(cable(`c${cableIndex++}`, oscId, 'audioOut', 'sum', 'audioIn'));
  });
  let previous = 'sum';
  effects.forEach((effect, index) => {
    const fxId = `fx${index + 1}`;
    modules.push(effectModule(fxId, effect.type, 750 + index * 230, effect.parameters));
    connections.push(cable(`c${cableIndex++}`, previous, 'audioOut', fxId, 'audioIn'));
    previous = fxId;
  });
  modules.push(master(750 + effects.length * 230));
  connections.push(cable(`c${cableIndex++}`, previous, 'audioOut', 'master', 'audioIn'));
  return { id, title, explanation, patch: patch(title, description, modules, connections) };
}

const P = (id, title, oscillators, effects, explanation) => makePreset({ id, title, oscillators, effects, description: explanation, explanation });
const fx = (type, parameters) => ({ type, parameters });

export const EXAMPLE_PATCHES = Object.freeze([
  P('basic-saw', 'Basic Saw', [{ waveform: 2, amplitude: 0.24 }], [], 'A simple saw oscillator wired directly through Voice Sum to the master.'),
  P('warm-analog', 'Warm Analog', [{ waveform: 2, cents: -6, amplitude: 0.17 }, { waveform: 1, cents: 7, amplitude: 0.15 }], [fx('core.filter', { cutoff: 4300, resonance: 0.14, drive: 0.2 })], 'Detuned saw and triangle oscillators through a warm low-pass filter.'),
  P('sub-bass', 'Sub Bass', [{ waveform: 0, octave: -2, amplitude: 0.4 }], [fx('core.filter', { cutoff: 700, resonance: 0.05 })], 'Clean sine sub-bass with restrained low-pass filtering.'),
  P('reese-bass', 'Reese Bass', [{ waveform: 2, octave: -1, cents: -14, amplitude: 0.19 }, { waveform: 3, octave: -1, cents: 14, amplitude: 0.19 }], [fx('core.filter', { cutoff: 1900, resonance: 0.2, drive: 0.5 })], 'Opposing detuned saws create the beating movement of a classic Reese bass.'),
  P('pluck', 'Pluck', [{ waveform: 4, amplitude: 0.22 }], [fx('core.filter', { cutoff: 6200, resonance: 0.28 })], 'A bright square-based starting point with a resonant filter.'),
  P('soft-pad', 'Soft Pad', [{ waveform: 1, cents: -5, amplitude: 0.15 }, { waveform: 2, cents: 5, amplitude: 0.11 }], [fx('core.filter', { cutoff: 3400, resonance: 0.08 }), fx('core.echo', { time: 0.48, feedback: 0.38, mix: 0.24 })], 'A soft detuned layer with filtering and a restrained spacious echo.'),
  P('acid-bass', 'Acid Bass', [{ waveform: 2, octave: -1, amplitude: 0.25 }], [fx('core.filter', { cutoff: 1050, resonance: 0.78, drive: 1.2 })], 'Low saw bass through a strongly resonant driven filter.'),
  P('pulse-lead', 'Pulse Lead', [{ waveform: 5, pulseWidth: 0.27, amplitude: 0.22 }], [fx('core.filter', { cutoff: 5600, resonance: 0.24 })], 'Narrow pulse lead with focused low-pass filtering.'),
  P('bright-lead', 'Bright Lead', [{ waveform: 2, cents: -4, amplitude: 0.16 }, { waveform: 4, cents: 4, amplitude: 0.13 }], [fx('core.filter', { cutoff: 9800, resonance: 0.12 })], 'Layered saw and square oscillators with an open filter.'),
  P('deep-house-bass', 'Deep House Bass', [{ waveform: 1, octave: -1, amplitude: 0.28 }], [fx('core.filter', { cutoff: 1250, resonance: 0.12, drive: 0.35 })], 'Rounded triangle bass with a dark driven filter.'),
  P('detuned-saw', 'Detuned Saw Stack', [{ waveform: 2, cents: -11, amplitude: 0.14 }, { waveform: 2, cents: 11, amplitude: 0.14 }], [fx('core.filter', { cutoff: 7200, resonance: 0.08 })], 'Two detuned saws for an immediate wide supersaw-like foundation.'),
  P('chip-lead', 'Chip Lead', [{ waveform: 4, octave: 1, amplitude: 0.18 }], [], 'Bright octave-up square wave for chiptune-style leads.'),
  P('organ', 'Simple Organ', [{ waveform: 0, amplitude: 0.2 }, { waveform: 0, octave: 1, amplitude: 0.1 }], [fx('core.filter', { cutoff: 8500, resonance: 0.02 })], 'Fundamental and octave sine partials form a simple organ-like voice.'),
  P('drone', 'Dark Drone', [{ waveform: 2, octave: -2, cents: -8, amplitude: 0.16 }, { waveform: 1, octave: -1, cents: 8, amplitude: 0.14 }], [fx('core.filter', { cutoff: 950, resonance: 0.38, drive: 0.7 }), fx('core.echo', { time: 0.64, feedback: 0.66, mix: 0.38 })], 'Low detuned oscillators, dark filtering and long feedback echo for drones.'),
  P('filtered-square', 'Filtered Square', [{ waveform: 4, amplitude: 0.22 }], [fx('core.filter', { cutoff: 2400, resonance: 0.42 })], 'Square wave through a moderately resonant low-pass filter.'),
  P('highpass-lead', 'High-pass Lead', [{ waveform: 2, amplitude: 0.22 }], [fx('core.filter', { mode: 1, cutoff: 1800, resonance: 0.22 })], 'Saw lead through the filter high-pass mode to remove low frequencies.'),
  P('bandpass-radio', 'Band-pass Radio', [{ waveform: 4, amplitude: 0.23 }], [fx('core.filter', { mode: 2, cutoff: 2200, resonance: 0.55, drive: 0.25 })], 'Narrow band-pass filtering creates a radio-like focused spectrum.'),
  P('distorted-bass', 'Distorted Bass', [{ waveform: 2, octave: -1, amplitude: 0.22 }], [fx('core.filter', { cutoff: 1800, resonance: 0.18 }), fx('core.distortion', { drive: 7, tone: 0.42, mix: 0.78 })], 'Low saw bass filtered first and then pushed through heavy distortion.'),
  P('crunch-lead', 'Crunch Lead', [{ waveform: 4, amplitude: 0.2 }], [fx('core.distortion', { drive: 5.5, tone: 0.72, mix: 0.62 }), fx('core.filter', { cutoff: 7200, resonance: 0.12 })], 'Square lead with medium distortion followed by tone-shaping filter.'),
  P('slap-delay-lead', 'Slap Delay Lead', [{ waveform: 5, pulseWidth: 0.34, amplitude: 0.2 }], [fx('core.delay', { time: 0.095, feedback: 0.2, damping: 0.18, mix: 0.38 })], 'Pulse lead with a short slap-style delay.'),
  P('dub-echo', 'Dub Echo', [{ waveform: 2, octave: -1, amplitude: 0.2 }], [fx('core.filter', { cutoff: 1900, resonance: 0.3 }), fx('core.echo', { time: 0.46, feedback: 0.78, damping: 0.52, mix: 0.5 })], 'Dark filtered source into a long high-feedback echo for dub-style repeats.'),
  P('space-pad', 'Space Pad', [{ waveform: 1, cents: -7, amplitude: 0.14 }, { waveform: 2, cents: 7, amplitude: 0.11 }], [fx('core.filter', { cutoff: 3200, resonance: 0.12 }), fx('core.delay', { time: 0.31, feedback: 0.42, mix: 0.32 }), fx('core.echo', { time: 0.67, feedback: 0.46, mix: 0.26 })], 'Layered oscillators through filter, delay and echo for a large ambient texture.'),
  P('industrial-pulse', 'Industrial Pulse', [{ waveform: 5, octave: -1, pulseWidth: 0.18, amplitude: 0.22 }], [fx('core.distortion', { drive: 10, tone: 0.58, mix: 0.84 }), fx('core.delay', { time: 0.14, feedback: 0.48, mix: 0.3 })], 'Narrow low pulse pushed through aggressive distortion and rhythmic delay.'),
  P('init-patch', 'Init / Minimal', [{ waveform: 1, amplitude: 0.2 }], [], 'Neutral triangle oscillator with complete pitch and output routing for building from scratch.')
]);

export const DEFAULT_EXAMPLE_ID = 'basic-saw';
export const INIT_EXAMPLE_ID = 'init-patch';
export function getExamplePatch(id = DEFAULT_EXAMPLE_ID) {
  const example = EXAMPLE_PATCHES.find(item => item.id === id) ?? EXAMPLE_PATCHES.find(item => item.id === DEFAULT_EXAMPLE_ID) ?? EXAMPLE_PATCHES[0];
  return { ...example, patch: structuredClone(example.patch) };
}
