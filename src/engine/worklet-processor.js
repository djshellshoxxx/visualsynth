import { Oscillator } from '../dsp/oscillator.js';
import { ADSREnvelope } from '../dsp/envelope.js';
import { LFO } from '../dsp/lfo.js';
import { NoiseGenerator } from '../dsp/noise.js';
import { StateVariableFilter } from '../dsp/filters.js';
import { DistortionEffect, DelayEffect, EchoEffect } from '../dsp/effects.js';
import { AdditiveOscillator, SupersawOscillator, WavetableOscillator } from '../dsp/advanced-oscillators.js';
import { ChorusEffect, CompressorEffect, ParametricEqEffect, PhaserEffect, ReverbEffect } from '../dsp/beta-effects.js';
import { applyVca } from '../dsp/vca.js';
import { sanitizeSample } from '../dsp/safety.js';
import { VoiceEngine } from './voice-engine.js';
import { EngineMessageType, validateEngineMessage } from './protocol.js';

const WAVEFORMS = ['sine', 'triangle', 'saw', 'reverse-saw', 'square', 'pulse', 'sine'];
const NOISE_TYPES = ['white', 'pink', 'brown'];
const FILTER_MODES = ['lowpass', 'highpass', 'bandpass', 'notch'];

function waveformFrom(value) {
  if (typeof value === 'string') return value;
  if (Number.isInteger(value)) return WAVEFORMS[value] ?? 'sine';
  return 'sine';
}
function noiseTypeFrom(value) {
  if (typeof value === 'string') return NOISE_TYPES.includes(value) ? value : 'white';
  if (Number.isInteger(value)) return NOISE_TYPES[value] ?? 'white';
  return 'white';
}
function filterModeFrom(value) {
  if (typeof value === 'string') return FILTER_MODES.includes(value) ? value : 'lowpass';
  return FILTER_MODES[Math.round(value)] ?? 'lowpass';
}
function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
function cloneGraph(graph) { return typeof structuredClone === 'function' ? structuredClone(graph) : JSON.parse(JSON.stringify(graph)); }
function midiNoteToHz(note) { return 440 * (2 ** ((finite(note, 69) - 69) / 12)); }
function voiceSeed(baseSeed, voiceId) {
  let hash = Math.trunc(finite(baseSeed, 1)) >>> 0;
  const text = String(voiceId ?? 0);
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619) >>> 0;
  return hash || 1;
}

export class WorkletRuntime {
  constructor({ sampleRate = 48000, maxVoices = 8 } = {}) {
    this.sampleRate = sampleRate;
    this.revision = 0;
    this.graph = null;
    this.nodeState = new Map();
    this.voiceNodeState = new Map();
    this.voiceEngine = new VoiceEngine({ maxVoices });
    this.currentFrame = 0;
    this.parameterUpdates = 0;
    this.graphSwaps = 0;
    this.rejectedGraphSwaps = 0;
    this.panicLatched = false;
    this.lastPeak = 0;
    this.masterGain = 1;
  }

  applyGraph(graph, revision = graph?.revision) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.connections)) return false;
    if (!Number.isInteger(revision) || revision <= this.revision) {
      this.rejectedGraphSwaps += 1;
      return false;
    }
    const nextState = new Map();
    for (const node of graph.nodes) {
      if (!node || typeof node.id !== 'string' || typeof node.type !== 'string') return false;
      const p = node.parameters ?? {};
      if (node.type === 'core.oscillator' && node.scope !== 'voice') {
        nextState.set(node.id, new Oscillator({ sampleRate: this.sampleRate, waveform: waveformFrom(p.waveform), frequency: finite(p.frequency, 220), pulseWidth: finite(p.pulseWidth, 0.5) }));
      } else if (node.type === 'standard.noise' && node.scope !== 'voice') {
        nextState.set(node.id, new NoiseGenerator({ seed: finite(p.seed, 1), type: noiseTypeFrom(p.type) }));
      } else if (node.type === 'core.adsr' && node.scope !== 'voice') {
        nextState.set(node.id, { dsp: new ADSREnvelope({ sampleRate: this.sampleRate, attack: finite(p.attack, .01), decay: finite(p.decay, .15), sustain: finite(p.sustain, .7), release: finite(p.release, .25) }), lastGate: 0 });
      } else if (node.type === 'core.lfo' && node.scope !== 'voice') {
        nextState.set(node.id, new LFO({ sampleRate: this.sampleRate, frequency: finite(p.rate, 1), amount: finite(p.amount, 1) }));
      } else if (node.type === 'core.filter') {
        nextState.set(node.id, new StateVariableFilter({ sampleRate: this.sampleRate, cutoff: finite(p.cutoff, 12000), resonance: finite(p.resonance, 0.1), mode: filterModeFrom(p.mode) }));
      } else if (node.type === 'core.distortion') {
        nextState.set(node.id, new DistortionEffect({ drive: finite(p.drive, 3), tone: finite(p.tone, 0.65), mix: finite(p.mix, 0.7) }));
      } else if (node.type === 'core.delay') {
        nextState.set(node.id, new DelayEffect({ sampleRate: this.sampleRate, time: finite(p.time, 0.25), feedback: finite(p.feedback, 0.3), damping: finite(p.damping, 0.25), mix: finite(p.mix, 0.35) }));
      } else if (node.type === 'core.echo') {
        nextState.set(node.id, new EchoEffect({ sampleRate: this.sampleRate, time: finite(p.time, 0.36), feedback: finite(p.feedback, 0.58), damping: finite(p.damping, 0.42), mix: finite(p.mix, 0.42) }));
      } else if (node.type === 'beta.additive-oscillator' && node.scope !== 'voice') {
        const count = Math.round(finite(p.harmonics, 8));
        nextState.set(node.id, new AdditiveOscillator({ sampleRate: this.sampleRate, frequency: finite(p.frequency, 220), amplitude: finite(p.amplitude, .25), harmonics: Array.from({ length: count }, (_, i) => 1 / ((i + 1) ** Math.max(.05, -finite(p.tilt, -.6)))) }));
      } else if (node.type === 'beta.wavetable-oscillator' && node.scope !== 'voice') {
        nextState.set(node.id, new WavetableOscillator({ sampleRate: this.sampleRate, frequency: finite(p.frequency, 220), morph: finite(p.morph, 0), amplitude: finite(p.amplitude, .25) }));
      } else if (node.type === 'beta.supersaw' && node.scope !== 'voice') {
        nextState.set(node.id, new SupersawOscillator({ sampleRate: this.sampleRate, frequency: finite(p.frequency, 220), voices: finite(p.voices, 7), detune: finite(p.detune, .18), spread: finite(p.spread, .7), amplitude: finite(p.amplitude, .22) }));
      } else if (node.type === 'beta.chorus') {
        nextState.set(node.id, new ChorusEffect({ sampleRate: this.sampleRate, ...p }));
      } else if (node.type === 'beta.phaser') {
        nextState.set(node.id, new PhaserEffect({ sampleRate: this.sampleRate, ...p }));
      } else if (node.type === 'beta.reverb') {
        nextState.set(node.id, new ReverbEffect({ sampleRate: this.sampleRate, ...p }));
      } else if (node.type === 'beta.eq') {
        nextState.set(node.id, new ParametricEqEffect({ sampleRate: this.sampleRate, ...p }));
      } else if (node.type === 'beta.compressor') {
        nextState.set(node.id, new CompressorEffect({ sampleRate: this.sampleRate, ...p }));
      }
    }
    this.graph = cloneGraph(graph);
    this.revision = revision;
    this.nodeState = nextState;
    this.voiceNodeState = new Map();
    this.graphSwaps += 1;
    this.panicLatched = false;
    return true;
  }

  setParameter(moduleId, parameterId, value) {
    if (!Number.isFinite(value)) return false;
    if (moduleId === '__master__' && parameterId === 'gain') {
      this.masterGain = Math.max(0, Math.min(1.5, value));
      this.parameterUpdates += 1;
      return true;
    }
    if (!this.graph) return false;
    const node = this.graph.nodes.find(candidate => candidate.id === moduleId);
    if (!node) return false;
    node.parameters ??= {};
    node.parameters[parameterId] = value;

    const updateOscillator = oscillator => {
      if (!(oscillator instanceof Oscillator)) return;
      if (parameterId === 'frequency') oscillator.setFrequency(value);
      if (parameterId === 'pulseWidth') oscillator.pulseWidth = Math.max(0.01, Math.min(0.99, value));
      if (parameterId === 'waveform') oscillator.waveform = waveformFrom(value);
    };
    const updateNoise = noise => {
      if (!(noise instanceof NoiseGenerator)) return;
      if (parameterId === 'type') noise.type = noiseTypeFrom(value);
      if (parameterId === 'seed') {
        noise.seed = voiceSeed(value, 0);
        noise.reset();
      }
    };

    const state = this.nodeState.get(moduleId);
    if (state instanceof Oscillator) {
      updateOscillator(state);
    } else if (state instanceof NoiseGenerator) {
      updateNoise(state);
    } else if (state instanceof StateVariableFilter) {
      if (parameterId === 'cutoff') state.setCutoff(value);
      if (parameterId === 'resonance') state.setResonance(value);
      if (parameterId === 'mode') state.mode = filterModeFrom(value);
    } else if (state instanceof DistortionEffect) {
      if (parameterId === 'drive') state.setDrive(value);
      if (parameterId === 'tone') state.setTone(value);
      if (parameterId === 'mix') state.setMix(value);
    } else if (state instanceof DelayEffect) {
      if (parameterId === 'time') state.setTime(value);
      if (parameterId === 'feedback') state.setFeedback(value);
      if (parameterId === 'damping') state.setDamping(value);
      if (parameterId === 'mix') state.setMix(value);
    } else if (state instanceof AdditiveOscillator || state instanceof WavetableOscillator || state instanceof SupersawOscillator) {
      if (parameterId === 'frequency') state.setFrequency(value);
      else if (parameterId in state) state[parameterId] = value;
    } else if (state instanceof ChorusEffect || state instanceof PhaserEffect || state instanceof ReverbEffect || state instanceof ParametricEqEffect || state instanceof CompressorEffect) {
      if (parameterId in state) state[parameterId] = value;
    }

    for (const [key, voiceState] of this.voiceNodeState) {
      if (!key.startsWith(`${moduleId}:`)) continue;
      updateOscillator(voiceState);
      updateNoise(voiceState);
      if (voiceState instanceof AdditiveOscillator || voiceState instanceof WavetableOscillator || voiceState instanceof SupersawOscillator) {
        if (parameterId in voiceState) voiceState[parameterId] = value;
      }
    }
    this.parameterUpdates += 1;
    return true;
  }

  handleNote(event) {
    if (!event || typeof event !== 'object') return false;
    const normalized = { ...event, frame: Number.isInteger(event.frame) ? event.frame : this.currentFrame };
    if (normalized.type === 'note-on') this.panicLatched = false;
    this.voiceEngine.enqueue(normalized);
    return true;
  }

  panic(frame = this.currentFrame) {
    this.voiceEngine.enqueue({ type: 'panic', frame });
    this.voiceEngine.processRange(frame, frame + 1);
    this.voiceNodeState.clear();
    this.panicLatched = true;
  }

  #incoming(nodeId, values) {
    if (!this.graph) return [];
    const samples = [];
    for (const connection of this.graph.connections) if (connection.to?.moduleId === nodeId) samples.push(values.get(connection.from?.moduleId) ?? 0);
    return samples;
  }

  #noteTranspose() {
    const noteInput = this.graph?.nodes.find(node => node.type === 'core.note-input');
    return finite(noteInput?.parameters?.transpose, 0);
  }

  #voiceOscillator(node, signal) {
    const key = `${node.id}:${signal.voiceId}`;
    let oscillator = this.voiceNodeState.get(key);
    const parameters = node.parameters ?? {};
    const pitch = signal.pitch + this.#noteTranspose() + finite(parameters.octave, 0) * 12 + finite(parameters.semitone, 0) + finite(parameters.cents, 0) / 100;
    const frequency = midiNoteToHz(pitch);
    if (!(oscillator instanceof Oscillator)) {
      oscillator = new Oscillator({ sampleRate: this.sampleRate, waveform: waveformFrom(parameters.waveform), frequency, pulseWidth: finite(parameters.pulseWidth, 0.5) });
      this.voiceNodeState.set(key, oscillator);
    } else {
      oscillator.setFrequency(frequency);
      oscillator.waveform = waveformFrom(parameters.waveform);
      oscillator.pulseWidth = Math.max(0.01, Math.min(0.99, finite(parameters.pulseWidth, 0.5)));
    }
    return oscillator;
  }

  #processVoiceOscillator(node) {
    const activeSignals = this.voiceEngine.voiceSignals().filter(signal => signal.gate > 0);
    const prefix = `${node.id}:`;
    const activeKeys = new Set(activeSignals.map(signal => `${prefix}${signal.voiceId}`));
    for (const key of this.voiceNodeState.keys()) if (key.startsWith(prefix) && !activeKeys.has(key)) this.voiceNodeState.delete(key);
    if (activeSignals.length === 0) return 0;
    const amplitude = finite(node.parameters?.amplitude, 0.25);
    let sum = 0;
    for (const signal of activeSignals) sum += this.#voiceOscillator(node, signal).nextSample() * amplitude * finite(signal.velocity, 1);
    return sanitizeSample(sum / Math.sqrt(activeSignals.length));
  }

  #voiceNoise(node, signal) {
    const key = `${node.id}:${signal.voiceId}`;
    let noise = this.voiceNodeState.get(key);
    const parameters = node.parameters ?? {};
    if (!(noise instanceof NoiseGenerator)) {
      noise = new NoiseGenerator({ seed: voiceSeed(parameters.seed, signal.voiceId), type: noiseTypeFrom(parameters.type) });
      this.voiceNodeState.set(key, noise);
    } else {
      noise.type = noiseTypeFrom(parameters.type);
    }
    return noise;
  }

  #advancedVoiceOscillator(node, signal) {
    const key = `${node.id}:${signal.voiceId}`;
    let oscillator = this.voiceNodeState.get(key);
    const p = node.parameters ?? {};
    const pitch = signal.pitch + this.#noteTranspose();
    const frequency = midiNoteToHz(pitch);
    if (!oscillator) {
      if (node.type === 'beta.additive-oscillator') {
        const count = Math.round(finite(p.harmonics, 8));
        oscillator = new AdditiveOscillator({ sampleRate: this.sampleRate, frequency, amplitude: finite(p.amplitude, .25), harmonics: Array.from({ length: count }, (_, i) => 1 / (i + 1) });
      } else if (node.type === 'beta.wavetable-oscillator') {
        oscillator = new WavetableOscillator({ sampleRate: this.sampleRate, frequency, morph: finite(p.morph, 0), amplitude: finite(p.amplitude, .25) });
      } else {
        oscillator = new SupersawOscillator({ sampleRate: this.sampleRate, frequency, voices: finite(p.voices, 7), detune: finite(p.detune, .18), spread: finite(p.spread, .7), amplitude: finite(p.amplitude, .22) });
      }
      this.voiceNodeState.set(key, oscillator);
    }
    oscillator.setFrequency?.(frequency);
    if ('morph' in oscillator) oscillator.morph = finite(p.morph, oscillator.morph);
    if ('detune' in oscillator) oscillator.detune = finite(p.detune, oscillator.detune);
    if ('voices' in oscillator) oscillator.voices = Math.round(finite(p.voices, oscillator.voices));
    return oscillator;
  }

  #processAdvancedVoiceOscillator(node) {
    const activeSignals = this.voiceEngine.voiceSignals().filter(signal => signal.gate > 0);
    const prefix = `${node.id}:`;
    const activeKeys = new Set(activeSignals.map(signal => `${prefix}${signal.voiceId}`));
    for (const key of this.voiceNodeState.keys()) if (key.startsWith(prefix) && !activeKeys.has(key)) this.voiceNodeState.delete(key);
    if (!activeSignals.length) return 0;
    let sum = 0;
    for (const signal of activeSignals) sum += this.#advancedVoiceOscillator(node, signal).nextSample() * finite(signal.velocity, 1);
    return sanitizeSample(sum / Math.sqrt(activeSignals.length));
  }

  #processVoiceNoise(node) {
    const activeSignals = this.voiceEngine.voiceSignals().filter(signal => signal.gate > 0);
    const prefix = `${node.id}:`;
    const activeKeys = new Set(activeSignals.map(signal => `${prefix}${signal.voiceId}`));
    for (const key of this.voiceNodeState.keys()) if (key.startsWith(prefix) && !activeKeys.has(key)) this.voiceNodeState.delete(key);
    if (activeSignals.length === 0) return 0;
    const level = Math.max(0, Math.min(1, finite(node.parameters?.level, 0.25)));
    let sum = 0;
    for (const signal of activeSignals) sum += this.#voiceNoise(node, signal).nextSample() * level * finite(signal.velocity, 1);
    return sanitizeSample(sum / Math.sqrt(activeSignals.length));
  }

  #outputKey(moduleId, portId) { return `${moduleId}:${portId}`; }

  #voiceBundle(entries = []) { return { kind: 'voice', lanes: new Map(entries) }; }

  #isVoiceBundle(value) { return Boolean(value && value.kind === 'voice' && value.lanes instanceof Map); }

  #scalar(value) {
    if (this.#isVoiceBundle(value)) {
      const samples = [...value.lanes.values()].map(sample => finite(sample, 0));
      if (!samples.length) return 0;
      return sanitizeSample(samples.reduce((sum, sample) => sum + sample, 0) / Math.sqrt(samples.length));
    }
    return finite(value, 0);
  }

  #inputValues(nodeId, portId, outputs) {
    const result = [];
    for (const connection of this.graph?.connections ?? []) {
      if (connection.to?.moduleId !== nodeId || connection.to?.portId !== portId) continue;
      result.push(outputs.get(this.#outputKey(connection.from.moduleId, connection.from.portId)) ?? 0);
    }
    return result;
  }

  #inputValue(nodeId, portId, outputs) {
    const values = this.#inputValues(nodeId, portId, outputs);
    if (!values.length) return 0;
    if (values.some(value => this.#isVoiceBundle(value))) {
      const ids = new Set();
      for (const value of values) if (this.#isVoiceBundle(value)) for (const id of value.lanes.keys()) ids.add(id);
      return this.#voiceBundle([...ids].map(id => [id, sanitizeSample(values.reduce((sum, value) => sum + (this.#isVoiceBundle(value) ? finite(value.lanes.get(id), 0) : finite(value, 0)), 0))]));
    }
    return sanitizeSample(values.reduce((sum, value) => sum + finite(value, 0), 0));
  }

  #modulationValues(nodeId, parameterId, outputs) {
    const routes = (this.graph?.modulations ?? []).filter(route => route.destination?.moduleId === nodeId && route.destination?.parameterId === parameterId);
    return routes.map(route => ({
      route,
      value: outputs.get(this.#outputKey(route.source.moduleId, route.source.portId)) ?? 0
    }));
  }

  #lane(value, voiceId) { return this.#isVoiceBundle(value) ? finite(value.lanes.get(voiceId), 0) : finite(value, 0); }

  #modulationSum(nodeId, parameterId, outputs, voiceId = null) {
    let sum = 0;
    for (const { route, value } of this.#modulationValues(nodeId, parameterId, outputs)) {
      let source = voiceId == null ? this.#scalar(value) : this.#lane(value, voiceId);
      if (route.polarity === 'unipolar') source = Math.max(0, source);
      const amount = finite(route.amount, 1);
      if (route.curve === 'exp') source = Math.sign(source) * source * source;
      sum += source * amount;
    }
    return sanitizeSample(sum);
  }

  #voiceRuntime(node, voiceId, factory) {
    const key = `${node.id}:${voiceId}`;
    let state = this.voiceNodeState.get(key);
    if (!state) {
      state = factory();
      this.voiceNodeState.set(key, state);
    }
    return state;
  }

  #processSignalNode(node, outputs) {
    const p = node.parameters ?? {};
    const set = (portId, value) => outputs.set(this.#outputKey(node.id, portId), value);
    const voices = this.voiceEngine.voiceSignals();

    switch (node.type) {
      case 'core.note-input': {
        const transpose = finite(p.transpose, 0);
        set('pitchOut', this.#voiceBundle(voices.map(v => [v.voiceId, v.pitch + transpose])));
        set('gateOut', this.#voiceBundle(voices.map(v => [v.voiceId, v.gate])));
        set('velocityOut', this.#voiceBundle(voices.map(v => [v.voiceId, v.velocity])));
        set('eventOut', 0);
        return 0;
      }
      case 'core.oscillator': {
        if (node.scope !== 'voice') {
          const oscillator = this.nodeState.get(node.id);
          if (!(oscillator instanceof Oscillator)) { set('audioOut', 0); return 0; }
          const base = finite(p.frequency, oscillator.frequency || 220);
          const fm = this.#modulationSum(node.id, 'pitch', outputs);
          oscillator.setFrequency(base * 2 ** (fm / 12));
          const sample = sanitizeSample(oscillator.nextSample() * finite(p.amplitude, .25));
          set('audioOut', sample); return sample;
        }
        const pitchInput = this.#inputValue(node.id, 'pitchIn', outputs);
        const lanes = [];
        for (const voice of voices) {
          const pitch = (this.#isVoiceBundle(pitchInput) ? this.#lane(pitchInput, voice.voiceId) : voice.pitch)
            + finite(p.octave, 0) * 12 + finite(p.semitone, 0) + finite(p.cents, 0) / 100
            + this.#modulationSum(node.id, 'pitch', outputs, voice.voiceId);
          const oscillator = this.#voiceRuntime(node, voice.voiceId, () => new Oscillator({ sampleRate: this.sampleRate, waveform: waveformFrom(p.waveform), frequency: midiNoteToHz(pitch), pulseWidth: finite(p.pulseWidth, .5) }));
          oscillator.setFrequency(midiNoteToHz(pitch)); oscillator.waveform = waveformFrom(p.waveform); oscillator.pulseWidth = Math.max(.01, Math.min(.99, finite(p.pulseWidth, .5)));
          lanes.push([voice.voiceId, sanitizeSample(oscillator.nextSample() * finite(p.amplitude, .25) * finite(voice.velocity, 1))]);
        }
        const value = this.#voiceBundle(lanes); set('audioOut', value); return 0;
      }
      case 'standard.noise': {
        if (node.scope !== 'voice') {
          const noise = this.nodeState.get(node.id); const sample = noise instanceof NoiseGenerator ? noise.nextSample() * finite(p.level, .25) : 0; set('audioOut', sanitizeSample(sample)); return sample;
        }
        const lanes = voices.map(voice => {
          const noise = this.#voiceRuntime(node, voice.voiceId, () => new NoiseGenerator({ seed: voiceSeed(p.seed, voice.voiceId), type: noiseTypeFrom(p.type) }));
          noise.type = noiseTypeFrom(p.type);
          return [voice.voiceId, sanitizeSample(noise.nextSample() * finite(p.level, .25) * finite(voice.velocity, 1))];
        });
        set('audioOut', this.#voiceBundle(lanes)); return 0;
      }
      case 'core.adsr': {
        const gateInput = this.#inputValue(node.id, 'gateIn', outputs);
        if (node.scope === 'voice') {
          const ids = new Set(voices.map(v => v.voiceId));
          if (this.#isVoiceBundle(gateInput)) for (const id of gateInput.lanes.keys()) ids.add(id);
          const lanes = [];
          for (const id of ids) {
            const voice = voices.find(v => v.voiceId === id);
            const gate = this.#isVoiceBundle(gateInput) ? this.#lane(gateInput, id) : finite(voice?.gate, 0);
            const state = this.#voiceRuntime(node, id, () => ({ dsp: new ADSREnvelope({ sampleRate: this.sampleRate, attack: finite(p.attack,.01), decay: finite(p.decay,.15), sustain: finite(p.sustain,.7), release: finite(p.release,.25) }), lastGate: 0, lastStartedFrame: null }));
            state.dsp.attack = Math.max(0, finite(p.attack,.01)); state.dsp.decay = Math.max(0, finite(p.decay,.15)); state.dsp.sustain = Math.max(0, Math.min(1, finite(p.sustain,.7))); state.dsp.release = Math.max(0, finite(p.release,.25));
            const started = voice?.startedFrame ?? null;
            if (gate > 0 && (state.lastGate <= 0 || (started != null && started !== state.lastStartedFrame))) state.dsp.gateOn('reset');
            if (gate <= 0 && state.lastGate > 0) state.dsp.gateOff();
            state.lastGate = gate; state.lastStartedFrame = started;
            lanes.push([id, state.dsp.nextSample()]);
          }
          set('controlOut', this.#voiceBundle(lanes)); return 0;
        }
        const state = this.nodeState.get(node.id);
        if (!state?.dsp) { set('controlOut',0); return 0; }
        const gate = this.#scalar(gateInput);
        if (gate > 0 && state.lastGate <= 0) state.dsp.gateOn('reset');
        if (gate <= 0 && state.lastGate > 0) state.dsp.gateOff();
        state.lastGate = gate; set('controlOut', state.dsp.nextSample()); return 0;
      }
      case 'core.lfo': {
        if (node.scope === 'voice') {
          const lanes = voices.map(voice => {
            const lfo = this.#voiceRuntime(node, voice.voiceId, () => new LFO({ sampleRate:this.sampleRate, frequency:finite(p.rate,1), amount:finite(p.amount,1) }));
            lfo.frequency = Math.max(0, Math.min(this.sampleRate*.499, finite(p.rate,1))); lfo.amount = Math.max(0,Math.min(1,finite(p.amount,1)));
            return [voice.voiceId,lfo.nextSample()];
          });
          set('controlOut',this.#voiceBundle(lanes)); return 0;
        }
        const lfo=this.nodeState.get(node.id); if(!(lfo instanceof LFO)){set('controlOut',0);return 0;}
        lfo.frequency=Math.max(0,Math.min(this.sampleRate*.499,finite(p.rate,1)));lfo.amount=Math.max(0,Math.min(1,finite(p.amount,1)));
        set('controlOut',lfo.nextSample()); return 0;
      }
      case 'core.vca': {
        const audio=this.#inputValue(node.id,'audioIn',outputs);
        const routes=this.#modulationValues(node.id,'gain',outputs);
        if (this.#isVoiceBundle(audio) || routes.some(item=>this.#isVoiceBundle(item.value))) {
          const ids=new Set(this.#isVoiceBundle(audio)?audio.lanes.keys():voices.map(v=>v.voiceId));
          for(const item of routes) if(this.#isVoiceBundle(item.value)) for(const id of item.value.lanes.keys()) ids.add(id);
          const lanes=[...ids].map(id=>{
            const source=this.#lane(audio,id);
            let gain=finite(p.gain,1);
            if(routes.length){ let control=0; for(const {route,value} of routes) control += this.#lane(value,id)*finite(route.amount,1); gain*=Math.max(0,control); }
            return [id,applyVca(source,gain)];
          });
          set('audioOut',this.#voiceBundle(lanes)); return 0;
        }
        let gain=finite(p.gain,1); if(routes.length) gain*=Math.max(0,this.#modulationSum(node.id,'gain',outputs));
        const sample=applyVca(this.#scalar(audio),gain); set('audioOut',sample); return sample;
      }
      case 'core.voice-sum': {
        const audio=this.#inputValue(node.id,'audioIn',outputs);
        const sample=sanitizeSample(this.#scalar(audio)*finite(p.gain,1)); set('audioOut',sample); return sample;
      }
      case 'core.filter': {
        const audio=this.#inputValue(node.id,'audioIn',outputs);
        if(this.#isVoiceBundle(audio)){
          const lanes=[...audio.lanes.entries()].map(([id,input])=>{
            const filter=this.#voiceRuntime(node,id,()=>new StateVariableFilter({sampleRate:this.sampleRate,cutoff:finite(p.cutoff,12000),resonance:finite(p.resonance,.1),mode:filterModeFrom(p.mode)}));
            const cutoff=Math.max(20,Math.min(this.sampleRate*.45,finite(p.cutoff,12000)*2**this.#modulationSum(node.id,'cutoff',outputs,id)));
            filter.setCutoff(cutoff);filter.setResonance(finite(p.resonance,.1));filter.mode=filterModeFrom(p.mode);
            const drive=Math.max(0,finite(p.drive,0));const driven=drive?Math.tanh(input*(1+drive)):input;return[id,filter.processSample(driven)];
          }); set('audioOut',this.#voiceBundle(lanes));return 0;
        }
        const filter=this.nodeState.get(node.id);if(!(filter instanceof StateVariableFilter)){set('audioOut',0);return 0;}
        filter.setCutoff(Math.max(20,Math.min(this.sampleRate*.45,finite(p.cutoff,12000)*2**this.#modulationSum(node.id,'cutoff',outputs))));
        filter.setResonance(finite(p.resonance,.1));filter.mode=filterModeFrom(p.mode);const drive=Math.max(0,finite(p.drive,0));const dry=this.#scalar(audio);const sample=filter.processSample(drive?Math.tanh(dry*(1+drive)):dry);set('audioOut',sample);return sample;
      }
      case 'core.mixer': {
        const inputs=[...this.#inputValues(node.id,'audioInA',outputs),...this.#inputValues(node.id,'audioInB',outputs)];
        const value=inputs.length?this.#inputValue(node.id,'audioInA',outputs):0;
        const other=this.#inputValue(node.id,'audioInB',outputs);
        if(this.#isVoiceBundle(value)||this.#isVoiceBundle(other)){
          const ids=new Set();for(const v of [value,other])if(this.#isVoiceBundle(v))for(const id of v.lanes.keys())ids.add(id);
          const lanes=[...ids].map(id=>[id,sanitizeSample((this.#lane(value,id)+this.#lane(other,id))*finite(p.gain,.5))]);set('audioOut',this.#voiceBundle(lanes));return 0;
        }
        const sample=sanitizeSample((this.#scalar(value)+this.#scalar(other))*finite(p.gain,.5));set('audioOut',sample);return sample;
      }
      case 'beta.additive-oscillator':
      case 'beta.wavetable-oscillator':
      case 'beta.supersaw': {
        if(node.scope==='voice'){
          const lanes=voices.map(voice=>{const osc=this.#advancedVoiceOscillator(node,voice);return[voice.voiceId,sanitizeSample(osc.nextSample()*finite(voice.velocity,1))]});set('audioOut',this.#voiceBundle(lanes));return 0;
        }
        const osc=this.nodeState.get(node.id);const sample=osc?.nextSample?sanitizeSample(osc.nextSample()):0;set('audioOut',sample);return sample;
      }
      case 'core.distortion':
      case 'core.delay':
      case 'core.echo':
      case 'beta.chorus':
      case 'beta.phaser':
      case 'beta.reverb':
      case 'beta.eq':
      case 'beta.compressor': {
        const audio=this.#inputValue(node.id,'audioIn',outputs);
        const process=value=>{const effect=this.nodeState.get(node.id);return effect?.processSample?effect.processSample(value):sanitizeSample(value)};
        if(this.#isVoiceBundle(audio)){const lanes=[...audio.lanes].map(([id,v])=>[id,process(v)]);set('audioOut',this.#voiceBundle(lanes));return 0;}
        const sample=process(this.#scalar(audio));set('audioOut',sample);return sample;
      }
      case 'beta.ring-mod': {
        const a=this.#inputValue(node.id,'audioInA',outputs), b=this.#inputValue(node.id,'audioInB',outputs), mix=Math.max(0,Math.min(1,finite(p.mix,1)));
        if(this.#isVoiceBundle(a)||this.#isVoiceBundle(b)){const ids=new Set();for(const v of [a,b])if(this.#isVoiceBundle(v))for(const id of v.lanes.keys())ids.add(id);const lanes=[...ids].map(id=>{const av=this.#lane(a,id),bv=this.#lane(b,id);return[id,sanitizeSample(av*(1-mix)+av*bv*mix)]});set('audioOut',this.#voiceBundle(lanes));return 0;}
        const av=this.#scalar(a),bv=this.#scalar(b),sample=sanitizeSample(av*(1-mix)+av*bv*mix);set('audioOut',sample);return sample;
      }
      case 'beta.scope-probe': { const value=this.#inputValue(node.id,'audioIn',outputs);set('audioOut',value);return this.#scalar(value); }
      case 'beta.control-probe': { const value=this.#inputValue(node.id,'controlIn',outputs);set('controlOut',value);return 0; }
      case 'beta.envelope-follower': { const value=Math.min(1,Math.abs(this.#scalar(this.#inputValue(node.id,'audioIn',outputs)))*finite(p.gain,1));set('controlOut',value);return 0; }
      case 'beta.macro': set('controlOut',finite(p.value,.5));return 0;
      case 'beta.xy-pad': set('xOut',finite(p.x,.5));set('yOut',finite(p.y,.5));return 0;
      case 'beta.voice-reduce': { const value=this.#inputValue(node.id,'controlIn',outputs);set('controlOut',this.#scalar(value));return 0; }
      case 'beta.stereo-utility': { const value=this.#inputValue(node.id,'audioIn',outputs);set('audioOut',value);return this.#scalar(value); }
      case 'core.master-output': return sanitizeSample(this.#scalar(this.#inputValue(node.id,'audioIn',outputs))*finite(p.gain,.8));
      default: {
        const outputPort=node.ports?.find(port=>port.direction==='output');
        const inputPort=node.ports?.find(port=>port.direction==='input');
        if(outputPort){const value=inputPort?this.#inputValue(node.id,inputPort.id,outputs):0;set(outputPort.id,value);}
        return 0;
      }
    }
  }

  #processNode(node, values) {
    const incoming = this.#incoming(node.id, values);
    const input = incoming.reduce((sum, value) => sum + finite(value), 0);
    const parameters = node.parameters ?? {};
    switch (node.type) {
      case 'core.oscillator': {
        if (node.scope === 'voice') return this.#processVoiceOscillator(node);
        const oscillator = this.nodeState.get(node.id);
        if (!(oscillator instanceof Oscillator)) return 0;
        return sanitizeSample(oscillator.nextSample() * finite(parameters.amplitude, 0.25));
      }
      case 'standard.noise': {
        if (node.scope === 'voice') return this.#processVoiceNoise(node);
        const noise = this.nodeState.get(node.id);
        if (!(noise instanceof NoiseGenerator)) return 0;
        return sanitizeSample(noise.nextSample() * Math.max(0, Math.min(1, finite(parameters.level, 0.25))));
      }
      case 'beta.additive-oscillator':
      case 'beta.wavetable-oscillator':
      case 'beta.supersaw': {
        if (node.scope === 'voice') return this.#processAdvancedVoiceOscillator(node);
        const oscillator = this.nodeState.get(node.id);
        return oscillator?.nextSample ? sanitizeSample(oscillator.nextSample()) : 0;
      }
      case 'core.filter': {
        const filter = this.nodeState.get(node.id);
        const drive = Math.max(0, finite(parameters.drive, 0));
        const driven = drive > 0 ? Math.tanh(input * (1 + drive)) : input;
        return filter instanceof StateVariableFilter ? filter.processSample(driven) : 0;
      }
      case 'core.distortion': {
        const effect = this.nodeState.get(node.id);
        return effect instanceof DistortionEffect ? effect.processSample(input) : sanitizeSample(input);
      }
      case 'core.delay': {
        const effect = this.nodeState.get(node.id);
        return effect instanceof DelayEffect ? effect.processSample(input) : sanitizeSample(input);
      }
      case 'core.echo': {
        const effect = this.nodeState.get(node.id);
        return effect instanceof EchoEffect ? effect.processSample(input) : sanitizeSample(input);
      }
      case 'beta.chorus':
      case 'beta.phaser':
      case 'beta.reverb':
      case 'beta.eq':
      case 'beta.compressor': {
        const effect = this.nodeState.get(node.id);
        return effect?.processSample ? effect.processSample(input) : sanitizeSample(input);
      }
      case 'beta.ring-mod': {
        const ins = this.#incoming(node.id, values);
        return sanitizeSample((ins[0] ?? 0) * (ins[1] ?? 0) * finite(parameters.mix, 1) + (ins[0] ?? 0) * (1 - finite(parameters.mix, 1)));
      }
      case 'beta.scope-probe':
      case 'beta.control-probe':
      case 'beta.stereo-utility': return sanitizeSample(input);
      case 'beta.envelope-follower': return Math.min(1, Math.abs(sanitizeSample(input)) * finite(parameters.gain, 1));
      case 'beta.macro': return finite(parameters.value, .5);
      case 'beta.xy-pad': return finite(parameters.x, .5);
      case 'beta.voice-reduce': return sanitizeSample(input);
      case 'core.vca': return applyVca(input, finite(parameters.gain, 1));
      case 'core.mixer': return sanitizeSample(input * finite(parameters.gain, 0.5));
      case 'core.master-output': return sanitizeSample(input * finite(parameters.gain, 0.8));
      default: return sanitizeSample(input);
    }
  }

  processBlock(length = 128) {
    const blockLength = Math.max(0, Math.floor(length));
    const left = new Float32Array(blockLength);
    const right = new Float32Array(blockLength);
    if (!this.graph || this.panicLatched || blockLength === 0) {
      this.currentFrame += blockLength;
      this.lastPeak = 0;
      return { left, right };
    }
    let peak = 0;
    for (let i = 0; i < blockLength; i += 1) {
      const frame = this.currentFrame + i;
      this.voiceEngine.processRange(frame, frame + 1);
      const values = new Map();
      let master = 0;
      for (const node of this.graph.nodes) {
        const value = this.#processSignalNode(node, values);
        if (node.type === 'core.master-output') master += value;
      }
      const sample = sanitizeSample(master * this.masterGain);
      left[i] = sample;
      right[i] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    this.currentFrame += blockLength;
    this.lastPeak = peak;
    return { left, right };
  }

  diagnostics() {
    const activeVoices = this.voiceEngine.voiceSignals().filter(signal => signal.gate > 0).length;
    return { revision: this.revision, graphSwaps: this.graphSwaps, rejectedGraphSwaps: this.rejectedGraphSwaps, parameterUpdates: this.parameterUpdates, activeVoices, currentFrame: this.currentFrame, peak: this.lastPeak, panic: this.panicLatched, masterGain: this.masterGain };
  }

  handleMessage(message) {
    const validation = validateEngineMessage(message);
    if (!validation.valid) return { ok: false, errors: validation.errors };
    const payload = message.payload ?? {};
    switch (message.type) {
      case EngineMessageType.INITIALIZE: return { ok: true, diagnostics: this.diagnostics() };
      case EngineMessageType.GRAPH_SWAP: return { ok: this.applyGraph(payload.graph, payload.revision), diagnostics: this.diagnostics() };
      case EngineMessageType.NOTE: return { ok: this.handleNote(payload.event) };
      case EngineMessageType.PARAMETER: return { ok: this.setParameter(payload.moduleId, payload.parameterId, payload.value), diagnostics: this.diagnostics() };
      case EngineMessageType.PANIC:
        this.panic(payload.frame ?? this.currentFrame);
        return { ok: true };
      case EngineMessageType.DIAGNOSTICS: return { ok: true, diagnostics: this.diagnostics() };
      default: return { ok: true };
    }
  }
}

const ProcessorBase = globalThis.AudioWorkletProcessor;
if (typeof ProcessorBase === 'function' && typeof globalThis.registerProcessor === 'function') {
  class VisualSynthProcessor extends ProcessorBase {
    constructor(options = {}) {
      super(options);
      this.runtime = new WorkletRuntime({ sampleRate: globalThis.sampleRate ?? 48000 });
      this.telemetryCounter = 0;
      this.port.onmessage = event => {
        const result = this.runtime.handleMessage(event.data);
        if (!result.ok || event.data?.type === EngineMessageType.DIAGNOSTICS) this.port.postMessage({ type: EngineMessageType.DIAGNOSTICS, payload: result });
      };
    }
    process(_inputs, outputs) {
      const output = outputs[0];
      if (!output?.length) return true;
      const block = this.runtime.processBlock(output[0]?.length ?? 128);
      output[0]?.set(block.left);
      if (output[1]) output[1].set(block.right);
      this.telemetryCounter += 1;
      if (this.telemetryCounter >= 16) {
        this.telemetryCounter = 0;
        const diagnostics = this.runtime.diagnostics();
        this.port.postMessage({ type: EngineMessageType.TELEMETRY, payload: { revision: diagnostics.revision, peak: Math.min(1, diagnostics.peak), activeVoices: diagnostics.activeVoices } });
      }
      return true;
    }
  }
  globalThis.registerProcessor('visualsynth-processor', VisualSynthProcessor);
}
