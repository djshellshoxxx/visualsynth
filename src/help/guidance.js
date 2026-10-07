const MODULE_HELP = Object.freeze({
  'core.note-input': 'Note Input: Turns keyboard or MIDI notes into pitch and gate information. Start here for playable patches.',
  'core.oscillator': 'Oscillator: Creates the raw tone. Feed pitchIn from Note Input. Send audioOut to a Filter, VCA, Mixer, or Voice Sum.',
  'core.mixer': 'Mixer: Combines audio signals. Connect oscillator/filter/VCA audio outputs to its inputs, then send audioOut onward.',
  'core.filter': 'Multimode Filter: Select low-pass, high-pass, band-pass, or notch, then shape cutoff, resonance, and drive.',
  'core.distortion': 'Distortion: Adds nonlinear saturation and harmonics. Use Drive for intensity, Tone for brightness, and Mix for dry/wet balance.',
  'core.delay': 'Delay: Adds a time-shifted repeat. Time controls spacing, Feedback controls repeat count, Damping darkens repeats, and Mix blends the effect.',
  'core.echo': 'Echo: A longer, feedback-oriented delay for obvious repeating tails. Keep feedback below maximum for controlled decays.',
  'core.adsr': 'ADSR Envelope: Creates a time-varying control envelope. Feed gateIn from Note Input and route controlOut to a modulation-capable destination.',
  'core.lfo': 'LFO: Creates repeating control modulation. Route controlOut to a compatible CONTROL input such as filter cutoff modulation.',
  'core.vca': 'VCA: Controls audio level using a CONTROL signal. Feed audio into audioIn and an envelope/control source into gainIn.',
  'core.voice-sum': 'Voice Sum: Explicitly combines per-voice AUDIO into one GLOBAL audio stream. Use this before global effects or Master Output.',
  'core.master-output': 'Master Output: Final destination. Feed GLOBAL AUDIO into audioIn. This is what reaches your speakers.',
  'core.feedback-delay': 'Feedback Delay: A feedback delay line for repeats. Send audio in, then tune time, feedback, and mix.',
  'beta.additive-oscillator': 'Additive Oscillator: Builds a tone from summed harmonics. Feed pitchIn from Note Input; shape the harmonic balance with its parameters.',
  'beta.wavetable-oscillator': 'Wavetable Oscillator: Scans through stored waveforms. Feed pitchIn and modulate morphIn to sweep between tables.',
  'beta.supersaw': 'Supersaw: Stacks detuned saws for a wide, thick tone. Feed pitchIn and raise detune for more spread.',
  'beta.mseg': 'Multi-Stage Envelope: A multi-segment control envelope. Feed gateIn from Note Input and route controlOut to a modulation input.',
  'beta.ring-mod': 'Ring Modulator: Multiplies two audio signals for metallic, inharmonic tones. Use Mix to blend with the dry signal.',
  'beta.chorus': 'Chorus / Flanger: Mixes in a modulated short delay for width or sweeping comb effects.',
  'beta.phaser': 'Phaser: Sweeps all-pass notches through the audio for a swirling motion.',
  'beta.reverb': 'Reverb: Adds room-like ambience. Raise Mix for more space.',
  'beta.eq': 'Parametric EQ: Boosts or cuts a chosen frequency band. Set frequency, gain, and bandwidth.',
  'beta.compressor': 'Compressor: Reduces dynamic range. Lower the threshold or raise the ratio for stronger leveling.',
  'beta.stereo-utility': 'Stereo Utility: Adjusts stereo width, balance, or mono-summing of the audio signal.',
  'beta.envelope-follower': 'Envelope Follower: Tracks audio loudness and outputs it as a CONTROL signal for modulation.',
  'beta.transport': 'Clock / Transport: Generates tempo-based clock and reset triggers to drive sequencers and arpeggiators.',
  'beta.step-sequencer': 'Step Sequencer: Steps through stored pitches and gates on each clockIn pulse. Use resetIn to restart.',
  'beta.gate-sequencer': 'Gate / Mod Sequencer: Steps through gate and control values on each clock pulse for rhythmic modulation.',
  'beta.arpeggiator': 'Arpeggiator: Turns held notes into a repeating pattern. Connect eventIn from Note Input and a clock to clockIn.',
  'beta.euclidean': 'Euclidean / Probability: Emits trigger patterns spread evenly across steps, optionally thinned by probability.',
  'beta.voice-reduce': 'Voice Reduce: Collapses per-voice CONTROL values into one global value (for example max, min, or average).',
  'beta.macro': 'Macro: A single knob that outputs a CONTROL value. Route it to several parameters at once.',
  'beta.xy-pad': 'XY Pad: A two-axis controller with x and y CONTROL outputs for performing with two parameters at once.',
  'beta.wavefolder': 'Wavefolder: Folds the waveform back on itself when Drive pushes it past full scale, adding bright harmonics. Symmetry offsets the fold.',
  'beta.bitcrusher': 'Bit Crusher: Lowers bit depth and sample rate for lo-fi grit and aliasing.',
  'beta.slew-limiter': 'Slew Limiter: Limits how fast a CONTROL signal can rise or fall, smoothing steps into glides.',
  'beta.sample-hold': 'Sample & Hold: Captures the CONTROL input on each triggerIn and holds it until the next trigger.',
  'beta.comparator': 'Comparator: Turns a CONTROL signal into a gate or trigger when it crosses a threshold, with hysteresis to avoid chatter.',
  'beta.ladder-filter': 'Ladder Filter: A four-pole low-pass with strong resonance and warm drive. Modulate cutoff through cutoffMod.',
  'beta.random-walk': 'Random Walk: Outputs a slowly wandering CONTROL value that steps on each trigger. Seed makes it repeatable.',
  'beta.chaos': 'Chaos Generator: Outputs deterministic chaotic CONTROL motion. Chaos sets how unpredictable it is; Seed makes it repeatable.',
  'beta.fm-operator': 'FM/PM Operator: Shapes a modulator CONTROL signal into an FM/PM modulation amount with depth, bias, and polarity.',
  'beta.waveshaper': 'Waveshaper: Bends audio through soft, hard, saturation, rectify, or custom curves. Drive sets intensity; driveIn modulates it.',
  'beta.probability-router': 'Probability Router: Sends each incoming trigger to one of four outputs, chosen by weighted probability.',
  'beta.function-generator': 'Custom Function Generator: Computes a CONTROL/AUDIO signal from a math expression, optionally using controlIn.',
  'beta.audio-to-control': 'Audio to Control: Converts audio into a CONTROL signal by sampling, averaging, RMS, or envelope detection.',
  'beta.control-to-audio': 'Control to Audio: Turns a CONTROL signal into audio-rate output so it can be heard or processed as audio.',
  'beta.sample-delay': 'Sample Delay / Align: Delays audio by a whole number of samples to align parallel paths or create phase offsets.',
  'beta.harmonic-exciter': 'Harmonic Exciter: Adds emphasized upper harmonics for brightness. Connect pitchIn to track the fundamental when available.',
  'beta.event-router': 'Generative Event Router: Routes triggers to three outputs with density, route memory, and a repeat limit. Seed makes it repeatable.',
  'beta.scope-probe': 'Scope Probe: Passes audio through unchanged so you can inspect it in a scope view.',
  'beta.control-probe': 'Control Probe: Passes a CONTROL signal through unchanged so you can inspect it.',
  'beta.spectral-analyzer': 'Spectral Analyzer: Analyzes audio with an FFT and outputs low, mid, and high band energy plus spectral centroid as CONTROL signals. It has no audio output.',
  'beta.patch-mutation': 'Patch Mutation Controller: Randomizes unlocked parameters by Amount, in safe or chaos mode, with a repeatable seed. Changes are undoable.',
  'beta.phase-interference': 'Phase Interference Lab: Sums three sine sources with adjustable ratio, phase, and gain. Opposite phases cancel; near-equal ratios beat.',
  'standard.noise': 'Noise: Generates white, pink, or brown noise. Use it for percussion, texture, wind, risers, and layered synth patches.'
});

const PORT_HELP = Object.freeze({
  pitchOut: 'PITCH output. Usually connect this to Oscillator pitchIn.', gateOut: 'GATE output. Usually connect this to ADSR gateIn.', velocityOut: 'CONTROL output representing note velocity. Connect only to CONTROL inputs.', eventOut: 'EVENT output for event-driven modules.',
  pitchIn: 'PITCH input. Connect Note Input pitchOut here so notes control oscillator pitch.', fmIn: 'CONTROL input for frequency modulation. Connect a CONTROL source such as an LFO.', pmIn: 'CONTROL input for phase modulation. Connect a compatible CONTROL source.', resetIn: 'TRIGGER input. Connect a trigger source to reset/restart this module.',
  audioOut: 'AUDIO output. Connect to an AUDIO input such as Filter, Distortion, Delay, Echo, VCA, Mixer, Voice Sum, or Master when scope allows.',
  audioIn: 'AUDIO input. Connect an AUDIO output from an oscillator or upstream audio/effect module as scope permits.', audioInA: 'AUDIO mixer input A. Connect an AUDIO output here.', audioInB: 'AUDIO mixer input B. Connect a second AUDIO output here.',
  cutoffMod: 'CONTROL input for filter cutoff modulation. Connect an LFO or another CONTROL source.', gateIn: 'GATE input. Connect Note Input gateOut here.', retriggerIn: 'TRIGGER input that restarts the envelope.', controlOut: 'CONTROL output. Connect to a compatible CONTROL input such as VCA gainIn or Filter cutoffMod.', gainIn: 'CONTROL input for VCA level. An ADSR envelope is the standard source.'
});

const PARAMETER_HELP = Object.freeze({
  maxVoices: 'Maximum simultaneous notes before older voices are reused.', transpose: 'Moves incoming notes up or down in semitones.', waveform: 'Selects the oscillator waveform and harmonic character.', octave: 'Moves oscillator pitch by whole octaves.', semitone: 'Fine musical transposition in semitone steps.', cents: 'Fine detune in hundredths of a semitone.', amplitude: 'Oscillator output level before downstream processing.', pulseWidth: 'Changes the duty cycle and harmonic color of pulse waves.',
  gain: 'Controls this module’s output level.', mode: 'Selects the filter response: low-pass, high-pass, band-pass, or notch.', cutoff: 'Filter cutoff frequency.', resonance: 'Emphasizes frequencies around the filter cutoff.', drive: 'Controls saturation or nonlinear drive intensity.', tone: 'Changes distortion brightness and high-frequency emphasis.', mix: 'Dry/wet balance: 0 is dry and 1 is fully effected.', time: 'Delay or echo time in seconds.', feedback: 'Amount of delayed signal fed back for additional repeats.', damping: 'Darkens successive delay or echo repeats.',
  attack: 'Time for the envelope to rise after a note starts.', decay: 'Time for the envelope to fall from its peak to sustain level.', sustain: 'Envelope level held while the note remains pressed.', release: 'Time for the envelope to fall after the note is released.', rate: 'LFO cycle speed.', amount: 'Overall LFO modulation depth.', type: 'Selects the noise color.', level: 'Controls noise output level.', seed: 'Changes the repeatable random noise sequence.'
});

export const hasModuleHelp = typeId => Object.hasOwn(MODULE_HELP, typeId);
export function moduleHelp(typeId) { return MODULE_HELP[typeId] ?? 'Synth module. Connect outputs to inputs with matching signal types and compatible voice/global scope.'; }
export function portHelp(port) { const specific = PORT_HELP[port.id]; return specific ?? `${String(port.signalType).toUpperCase()} ${port.direction}. Connect only to a matching ${String(port.signalType).toUpperCase()} ${port.direction === 'input' ? 'output' : 'input'}.`; }
export function parameterHelp(parameter) { return PARAMETER_HELP[parameter.id] ?? `Adjusts ${parameter.label ?? parameter.id}. Range: ${parameter.min ?? 0} to ${parameter.max ?? 1}${parameter.unit ? ` ${parameter.unit}` : ''}.`; }
export function wiringMismatchHelp(fromPort, toPort) {
  if (!fromPort || !toPort) return 'Choose one output and one input. Signal types must match.';
  if (fromPort.direction === toPort.direction) return `Both selected ports are ${fromPort.direction}s. Select one output and one input.`;
  if (fromPort.signalType !== toPort.signalType) return `Signal mismatch: ${String(fromPort.signalType).toUpperCase()} cannot connect to ${String(toPort.signalType).toUpperCase()}. Choose a ${String(fromPort.signalType).toUpperCase()} destination.`;
  return 'These ports cannot be connected in this scope. Voice audio must pass through Voice Sum before entering a global audio chain.';
}
