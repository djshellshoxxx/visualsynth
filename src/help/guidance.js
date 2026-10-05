const MODULE_HELP = Object.freeze({
  'core.note-input': 'Turns keyboard or MIDI notes into pitch and gate information. Start here for playable patches.',
  'core.oscillator': 'Creates the raw tone. Feed pitchIn from Note Input. Send audioOut to a Filter, VCA, Mixer, or Voice Sum.',
  'core.mixer': 'Combines audio signals. Connect oscillator/filter/VCA audio outputs to its inputs, then send audioOut onward.',
  'core.filter': 'Shapes tone by removing or emphasizing frequencies. Connect AUDIO into audioIn and send audioOut onward.',
  'core.adsr': 'Creates a time-varying control envelope. Feed gateIn from Note Input and route controlOut to a modulation-capable destination.',
  'core.lfo': 'Creates repeating control modulation. Route controlOut to a compatible CONTROL input such as filter cutoff modulation.',
  'core.vca': 'Controls audio level using a CONTROL signal. Feed audio into audioIn and an envelope/control source into gainIn.',
  'core.voice-sum': 'Explicitly combines per-voice AUDIO into one GLOBAL audio stream. Use this before Master Output when a voice-scoped audio chain ends.',
  'core.master-output': 'Final destination. Feed GLOBAL AUDIO into audioIn. This is what reaches your speakers.'
});

const PORT_HELP = Object.freeze({
  pitchOut: 'PITCH output. Usually connect this to Oscillator pitchIn.',
  gateOut: 'GATE output. Usually connect this to ADSR gateIn.',
  velocityOut: 'CONTROL output representing note velocity. Connect only to CONTROL inputs.',
  eventOut: 'EVENT output for event-driven modules.',
  pitchIn: 'PITCH input. Connect Note Input pitchOut here so notes control oscillator pitch.',
  fmIn: 'CONTROL input for frequency modulation. Connect a CONTROL source such as an LFO.',
  pmIn: 'CONTROL input for phase modulation. Connect a compatible CONTROL source.',
  resetIn: 'TRIGGER input. Connect a trigger source to reset/restart this module.',
  audioOut: 'AUDIO output. Connect to an AUDIO input such as Filter, VCA, Mixer, Voice Sum, or Master when scope allows.',
  audioIn: 'AUDIO input. Connect an AUDIO output from an oscillator, filter, VCA, mixer, or Voice Sum as scope permits.',
  audioInA: 'AUDIO mixer input A. Connect an AUDIO output here.',
  audioInB: 'AUDIO mixer input B. Connect a second AUDIO output here.',
  cutoffMod: 'CONTROL input for filter cutoff modulation. Connect an LFO or another CONTROL source.',
  gateIn: 'GATE input. Connect Note Input gateOut here.',
  retriggerIn: 'TRIGGER input that restarts the envelope.',
  controlOut: 'CONTROL output. Connect to a compatible CONTROL input such as VCA gainIn or Filter cutoffMod.',
  gainIn: 'CONTROL input for VCA level. An ADSR envelope is the standard source.'
});

const PARAMETER_HELP = Object.freeze({
  maxVoices: 'Maximum simultaneous notes before older voices are reused.',
  transpose: 'Moves incoming notes up or down in semitones.',
  waveform: 'Selects the oscillator waveform and harmonic character.',
  octave: 'Moves oscillator pitch by whole octaves.',
  semitone: 'Fine musical transposition in semitone steps.',
  cents: 'Fine detune in hundredths of a semitone.',
  amplitude: 'Oscillator output level before downstream processing.',
  pulseWidth: 'Changes the duty cycle and harmonic color of pulse waves.',
  gain: 'Controls this module’s output level.',
  cutoff: 'Filter cutoff frequency. Lower values remove more high-frequency content.',
  resonance: 'Emphasizes frequencies around the filter cutoff.',
  drive: 'Adds level/saturation before or within the filter.',
  attack: 'Time for the envelope to rise after a note starts.',
  decay: 'Time for the envelope to fall from its peak to sustain level.',
  sustain: 'Envelope level held while the note remains pressed.',
  release: 'Time for the envelope to fall after the note is released.',
  rate: 'LFO cycle speed.',
  amount: 'Overall LFO modulation depth.'
});

export function moduleHelp(typeId) {
  return MODULE_HELP[typeId] ?? 'Synth module. Connect outputs to inputs with matching signal types and compatible voice/global scope.';
}

export function portHelp(port) {
  const specific = PORT_HELP[port.id];
  if (specific) return specific;
  return `${String(port.signalType).toUpperCase()} ${port.direction}. Connect only to a matching ${String(port.signalType).toUpperCase()} ${port.direction === 'input' ? 'output' : 'input'}.`;
}

export function parameterHelp(parameter) {
  return PARAMETER_HELP[parameter.id] ?? `Adjusts ${parameter.label ?? parameter.id}. Range: ${parameter.min ?? 0} to ${parameter.max ?? 1}${parameter.unit ? ` ${parameter.unit}` : ''}.`;
}

export function wiringMismatchHelp(fromPort, toPort) {
  if (!fromPort || !toPort) return 'Choose one output and one input. Signal types must match.';
  if (fromPort.direction === toPort.direction) return `Both selected ports are ${fromPort.direction}s. Select one output and one input.`;
  if (fromPort.signalType !== toPort.signalType) return `Signal mismatch: ${String(fromPort.signalType).toUpperCase()} cannot connect to ${String(toPort.signalType).toUpperCase()}. Choose a ${String(fromPort.signalType).toUpperCase()} destination.`;
  return 'These ports cannot be connected in this scope. Voice audio must pass through Voice Sum before entering a global audio chain.';
}
