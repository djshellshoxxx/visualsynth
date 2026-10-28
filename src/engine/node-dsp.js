import { Oscillator } from '../dsp/oscillator.js';
import { NoiseGenerator } from '../dsp/noise.js';
import { StateVariableFilter } from '../dsp/filters.js';
import { ADSREnvelope } from '../dsp/envelope.js';
import { LFO } from '../dsp/lfo.js';
import { DistortionEffect, DelayEffect, EchoEffect } from '../dsp/effects.js';
import { sanitizeSample } from '../dsp/safety.js';

export const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const waves = ['sine', 'triangle', 'saw', 'reverse-saw', 'square', 'pulse', 'sine'];
const modes = ['lowpass', 'highpass', 'bandpass', 'notch'];
const noises = ['white', 'pink', 'brown'];
const choice = (values, value) => typeof value === 'string' ? value : values[Math.round(value)] ?? values[0];
export function noiseSeed(seed, lane) { return ((Math.trunc(finite(seed, 1)) ^ Math.imul(lane, 16777619)) >>> 0) || 1; }

// Construct outside the sample loop; one state per voice lane or one global state.
export function createNodeDsp(node, sampleRate, lane) {
  const p = node.parameters ?? {};
  switch (node.type) {
    case 'core.oscillator': return new Oscillator({ sampleRate });
    case 'standard.noise': return new NoiseGenerator({ seed: noiseSeed(p.seed, lane) });
    case 'core.filter': return new StateVariableFilter({ sampleRate });
    case 'core.adsr': return new ADSREnvelope({ sampleRate });
    case 'core.lfo': return new LFO({ sampleRate });
    case 'core.distortion': return new DistortionEffect(p);
    case 'core.delay': return new DelayEffect({ ...p, sampleRate });
    case 'core.echo': return new EchoEffect({ ...p, sampleRate });
    default: return null;
  }
}

export function resetNodeDsp(state) {
  if (state instanceof ADSREnvelope) { state.stage = 'idle'; state.value = 0; state.stageSample = 0; }
  else state?.reset?.();
}

// Inputs are resolved by port before entering DSP. Control signals never enter audio sums.
export function processNodeDsp(record, state, lane, voice, frame, graph) {
  const node = record.node;
  const p = record.parameters;
  const input = graph.input(record, 'audioIn', lane);
  const gate = graph.input(record, 'gateIn', lane);
  const trigger = graph.input(record, 'resetIn', lane);
  if (trigger > 0 && record.reset[lane] <= 0) state?.reset?.();
  record.reset[lane] = trigger;
  switch (node.type) {
    case 'core.oscillator': {
      const pitch = record.inputs.has('pitchIn') ? graph.input(record, 'pitchIn', lane) : voice ? voice.note + graph.pitchBend : 57;
      const offset = finite(p.octave) * 12 + finite(p.semitone) + finite(p.cents) / 100 + graph.modulation(record, 'fmIn', lane);
      state.setFrequency((!voice && !record.inputs.has('pitchIn') ? finite(p.frequency, 220) : 440 * 2 ** ((pitch - 69) / 12)) * 2 ** (offset / 12));
      state.waveform = choice(waves, p.waveform ?? 0);
      state.pulseWidth = Math.max(0.01, Math.min(0.99, finite(p.pulseWidth, 0.5)));
      const phase = state.phase;
      state.phase = ((phase + graph.modulation(record, 'pmIn', lane)) % 1 + 1) % 1;
      const value = state.nextSample();
      state.phase = (phase + state.frequency / state.sampleRate) % 1;
      return value * finite(p.amplitude, 0.25) * (voice?.velocity ?? 1);
    }
    case 'standard.noise':
      state.type = choice(noises, p.type ?? 0);
      if (record.inputs.has('gateIn') && !gate && (!voice || graph.releaseFrames === 0)) return 0;
      return state.nextSample() * Math.max(0, Math.min(1, finite(p.level, 0.25))) * (voice?.velocity ?? 1);
    case 'core.adsr': {
      state.attack = Math.max(0, finite(p.attack, 0.01));
      state.decay = Math.max(0, finite(p.decay, 0.15));
      state.sustain = Math.max(0, Math.min(1, finite(p.sustain, 0.7)));
      state.release = Math.max(0, finite(p.release, 0.25));
      const retrigger = graph.input(record, 'retriggerIn', lane);
      if (gate > 0 && (record.gates[lane] <= 0 || (retrigger > 0 && record.retriggers[lane] <= 0))) state.gateOn();
      else if (gate <= 0 && record.gates[lane] > 0) state.gateOff();
      record.gates[lane] = gate;
      record.retriggers[lane] = retrigger;
      return state.nextSample();
    }
    case 'core.lfo':
      state.frequency = Math.max(0, Math.min(state.sampleRate * 0.499, finite(p.rate, 1)));
      state.amount = Math.max(0, Math.min(1, finite(p.amount, 1)));
      return state.nextSample();
    case 'core.filter': {
      state.setCutoff(finite(p.cutoff, 12000) * 2 ** graph.modulation(record, 'cutoffMod', lane));
      state.setResonance(finite(p.resonance, 0.1));
      state.mode = choice(modes, p.mode ?? 0);
      const drive = Math.max(0, finite(p.drive));
      return state.processSample(drive ? Math.tanh(input * (1 + drive)) : input);
    }
    case 'core.distortion':
      state.setDrive(finite(p.drive, 3)); state.setTone(finite(p.tone, 0.65)); state.setMix(finite(p.mix, 0.7));
      return state.processSample(input);
    case 'core.delay':
    case 'core.echo':
      state.setTime(finite(p.time, node.type === 'core.echo' ? 0.36 : 0.25));
      state.setFeedback(finite(p.feedback, node.type === 'core.echo' ? 0.58 : 0.3));
      state.setDamping(finite(p.damping, node.type === 'core.echo' ? 0.42 : 0.25));
      state.setMix(finite(p.mix, node.type === 'core.echo' ? 0.42 : 0.35));
      return state.processSample(input);
    case 'core.vca':
      return input * finite(p.gain, 1) * (record.modulations.has('gainIn') ? graph.modulation(record, 'gainIn', lane) : 1);
    case 'core.mixer': return (graph.input(record, 'audioInA', lane) + graph.input(record, 'audioInB', lane)) * finite(p.gain, 0.5);
    case 'core.voice-sum': return input * finite(p.gain, 1);
    case 'core.master-output': return input * finite(p.gain, 0.8);
    default: return sanitizeSample(input);
  }
}
