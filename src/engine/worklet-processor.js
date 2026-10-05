import { Oscillator } from '../dsp/oscillator.js';
import { StateVariableFilter } from '../dsp/filters.js';
import { DistortionEffect, DelayEffect, EchoEffect } from '../dsp/effects.js';
import { applyVca } from '../dsp/vca.js';
import { sanitizeSample } from '../dsp/safety.js';
import { VoiceEngine } from './voice-engine.js';
import { EngineMessageType, validateEngineMessage } from './protocol.js';

const WAVEFORMS = ['sine', 'triangle', 'saw', 'reverse-saw', 'square', 'pulse', 'sine'];
const FILTER_MODES = ['lowpass', 'highpass', 'bandpass', 'notch'];
function waveformFrom(value) { if (typeof value === 'string') return value; if (Number.isInteger(value)) return WAVEFORMS[value] ?? 'sine'; return 'sine'; }
function filterModeFrom(value) { if (typeof value === 'string') return FILTER_MODES.includes(value) ? value : 'lowpass'; return FILTER_MODES[Math.round(value)] ?? 'lowpass'; }
function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
function cloneGraph(graph) { return typeof structuredClone === 'function' ? structuredClone(graph) : JSON.parse(JSON.stringify(graph)); }
function midiNoteToHz(note) { return 440 * (2 ** ((finite(note, 69) - 69) / 12)); }

export class WorkletRuntime {
  constructor({ sampleRate = 48000, maxVoices = 8 } = {}) {
    this.sampleRate = sampleRate; this.revision = 0; this.graph = null; this.nodeState = new Map(); this.voiceNodeState = new Map();
    this.voiceEngine = new VoiceEngine({ maxVoices }); this.currentFrame = 0; this.parameterUpdates = 0; this.graphSwaps = 0; this.rejectedGraphSwaps = 0;
    this.panicLatched = false; this.lastPeak = 0; this.masterGain = 1;
  }

  applyGraph(graph, revision = graph?.revision) {
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.connections)) return false;
    if (!Number.isInteger(revision) || revision <= this.revision) { this.rejectedGraphSwaps += 1; return false; }
    const nextState = new Map();
    for (const node of graph.nodes) {
      if (!node || typeof node.id !== 'string' || typeof node.type !== 'string') return false;
      const p = node.parameters ?? {};
      if (node.type === 'core.oscillator' && node.scope !== 'voice') {
        nextState.set(node.id, new Oscillator({ sampleRate: this.sampleRate, waveform: waveformFrom(p.waveform), frequency: finite(p.frequency, 220), pulseWidth: finite(p.pulseWidth, 0.5) }));
      } else if (node.type === 'core.filter') {
        nextState.set(node.id, new StateVariableFilter({ sampleRate: this.sampleRate, cutoff: finite(p.cutoff, 12000), resonance: finite(p.resonance, 0.1), mode: filterModeFrom(p.mode) }));
      } else if (node.type === 'core.distortion') {
        nextState.set(node.id, new DistortionEffect({ drive: finite(p.drive, 3), tone: finite(p.tone, 0.65), mix: finite(p.mix, 0.7) }));
      } else if (node.type === 'core.delay') {
        nextState.set(node.id, new DelayEffect({ sampleRate: this.sampleRate, time: finite(p.time, 0.25), feedback: finite(p.feedback, 0.3), damping: finite(p.damping, 0.25), mix: finite(p.mix, 0.35) }));
      } else if (node.type === 'core.echo') {
        nextState.set(node.id, new EchoEffect({ sampleRate: this.sampleRate, time: finite(p.time, 0.36), feedback: finite(p.feedback, 0.58), damping: finite(p.damping, 0.42), mix: finite(p.mix, 0.42) }));
      }
    }
    this.graph = cloneGraph(graph); this.revision = revision; this.nodeState = nextState; this.voiceNodeState = new Map(); this.graphSwaps += 1; this.panicLatched = false; return true;
  }

  setParameter(moduleId, parameterId, value) {
    if (!Number.isFinite(value)) return false;
    if (moduleId === '__master__' && parameterId === 'gain') { this.masterGain = Math.max(0, Math.min(1.5, value)); this.parameterUpdates += 1; return true; }
    if (!this.graph) return false;
    const node = this.graph.nodes.find(candidate => candidate.id === moduleId); if (!node) return false;
    node.parameters ??= {}; node.parameters[parameterId] = value;
    const updateOscillator = oscillator => {
      if (!(oscillator instanceof Oscillator)) return;
      if (parameterId === 'frequency') oscillator.setFrequency(value);
      if (parameterId === 'pulseWidth') oscillator.pulseWidth = Math.max(0.01, Math.min(0.99, value));
      if (parameterId === 'waveform') oscillator.waveform = waveformFrom(value);
    };
    const state = this.nodeState.get(moduleId);
    if (state instanceof Oscillator) updateOscillator(state);
    else if (state instanceof StateVariableFilter) {
      if (parameterId === 'cutoff') state.setCutoff(value);
      if (parameterId === 'resonance') state.setResonance(value);
      if (parameterId === 'mode') state.mode = filterModeFrom(value);
    } else if (state instanceof DistortionEffect) {
      if (parameterId === 'drive') state.setDrive(value); if (parameterId === 'tone') state.setTone(value); if (parameterId === 'mix') state.setMix(value);
    } else if (state instanceof DelayEffect) {
      if (parameterId === 'time') state.setTime(value); if (parameterId === 'feedback') state.setFeedback(value); if (parameterId === 'damping') state.setDamping(value); if (parameterId === 'mix') state.setMix(value);
    }
    for (const [key, voiceState] of this.voiceNodeState) if (key.startsWith(`${moduleId}:`)) updateOscillator(voiceState);
    this.parameterUpdates += 1; return true;
  }

  handleNote(event) {
    if (!event || typeof event !== 'object') return false;
    const normalized = { ...event, frame: Number.isInteger(event.frame) ? event.frame : this.currentFrame };
    if (normalized.type === 'note-on') this.panicLatched = false;
    this.voiceEngine.enqueue(normalized); return true;
  }
  panic(frame = this.currentFrame) { this.voiceEngine.enqueue({ type: 'panic', frame }); this.voiceEngine.processRange(frame, frame + 1); this.voiceNodeState.clear(); this.panicLatched = true; }

  #incoming(nodeId, values) {
    if (!this.graph) return [];
    const samples = [];
    for (const connection of this.graph.connections) if (connection.to?.moduleId === nodeId) samples.push(values.get(connection.from?.moduleId) ?? 0);
    return samples;
  }
  #noteTranspose() { const noteInput = this.graph?.nodes.find(node => node.type === 'core.note-input'); return finite(noteInput?.parameters?.transpose, 0); }
  #voiceOscillator(node, signal) {
    const key = `${node.id}:${signal.voiceId}`; let oscillator = this.voiceNodeState.get(key); const parameters = node.parameters ?? {};
    const pitch = signal.pitch + this.#noteTranspose() + finite(parameters.octave, 0) * 12 + finite(parameters.semitone, 0) + finite(parameters.cents, 0) / 100;
    const frequency = midiNoteToHz(pitch);
    if (!(oscillator instanceof Oscillator)) {
      oscillator = new Oscillator({ sampleRate: this.sampleRate, waveform: waveformFrom(parameters.waveform), frequency, pulseWidth: finite(parameters.pulseWidth, 0.5) }); this.voiceNodeState.set(key, oscillator);
    } else { oscillator.setFrequency(frequency); oscillator.waveform = waveformFrom(parameters.waveform); oscillator.pulseWidth = Math.max(0.01, Math.min(0.99, finite(parameters.pulseWidth, 0.5))); }
    return oscillator;
  }
  #processVoiceOscillator(node) {
    const activeSignals = this.voiceEngine.voiceSignals().filter(signal => signal.gate > 0), prefix = `${node.id}:`;
    const activeKeys = new Set(activeSignals.map(signal => `${prefix}${signal.voiceId}`));
    for (const key of this.voiceNodeState.keys()) if (key.startsWith(prefix) && !activeKeys.has(key)) this.voiceNodeState.delete(key);
    if (activeSignals.length === 0) return 0;
    const amplitude = finite(node.parameters?.amplitude, 0.25); let sum = 0;
    for (const signal of activeSignals) sum += this.#voiceOscillator(node, signal).nextSample() * amplitude * finite(signal.velocity, 1);
    return sanitizeSample(sum / Math.sqrt(activeSignals.length));
  }

  #processNode(node, values) {
    const incoming = this.#incoming(node.id, values); const input = incoming.reduce((sum, value) => sum + finite(value), 0); const p = node.parameters ?? {};
    switch (node.type) {
      case 'core.oscillator': {
        if (node.scope === 'voice') return this.#processVoiceOscillator(node);
        const oscillator = this.nodeState.get(node.id); return oscillator instanceof Oscillator ? sanitizeSample(oscillator.nextSample() * finite(p.amplitude, 0.25)) : 0;
      }
      case 'core.filter': {
        const filter = this.nodeState.get(node.id); const drive = Math.max(0, finite(p.drive, 0)); const driven = drive > 0 ? Math.tanh(input * (1 + drive)) : input;
        return filter instanceof StateVariableFilter ? filter.processSample(driven) : 0;
      }
      case 'core.distortion': { const effect = this.nodeState.get(node.id); return effect instanceof DistortionEffect ? effect.processSample(input) : sanitizeSample(input); }
      case 'core.delay': { const effect = this.nodeState.get(node.id); return effect instanceof DelayEffect ? effect.processSample(input) : sanitizeSample(input); }
      case 'core.echo': { const effect = this.nodeState.get(node.id); return effect instanceof EchoEffect ? effect.processSample(input) : sanitizeSample(input); }
      case 'core.vca': return applyVca(input, finite(p.gain, 1));
      case 'core.mixer': return sanitizeSample(input * finite(p.gain, 0.5));
      case 'core.master-output': return sanitizeSample(input * finite(p.gain, 0.8));
      default: return sanitizeSample(input);
    }
  }

  processBlock(length = 128) {
    const blockLength = Math.max(0, Math.floor(length)); const left = new Float32Array(blockLength); const right = new Float32Array(blockLength);
    if (!this.graph || this.panicLatched || blockLength === 0) { this.currentFrame += blockLength; this.lastPeak = 0; return { left, right }; }
    let peak = 0;
    for (let i = 0; i < blockLength; i += 1) {
      const frame = this.currentFrame + i; this.voiceEngine.processRange(frame, frame + 1); const values = new Map(); let master = 0;
      for (const node of this.graph.nodes) { const value = this.#processNode(node, values); values.set(node.id, value); if (node.type === 'core.master-output') master += value; }
      const sample = sanitizeSample(master * this.masterGain); left[i] = sample; right[i] = sample; peak = Math.max(peak, Math.abs(sample));
    }
    this.currentFrame += blockLength; this.lastPeak = peak; return { left, right };
  }

  diagnostics() {
    const activeVoices = this.voiceEngine.voiceSignals().filter(signal => signal.gate > 0).length;
    return { revision: this.revision, graphSwaps: this.graphSwaps, rejectedGraphSwaps: this.rejectedGraphSwaps, parameterUpdates: this.parameterUpdates, activeVoices, currentFrame: this.currentFrame, peak: this.lastPeak, panic: this.panicLatched, masterGain: this.masterGain };
  }
  handleMessage(message) {
    const validation = validateEngineMessage(message); if (!validation.valid) return { ok: false, errors: validation.errors }; const payload = message.payload ?? {};
    switch (message.type) {
      case EngineMessageType.INITIALIZE: return { ok: true, diagnostics: this.diagnostics() };
      case EngineMessageType.GRAPH_SWAP: return { ok: this.applyGraph(payload.graph, payload.revision), diagnostics: this.diagnostics() };
      case EngineMessageType.NOTE: return { ok: this.handleNote(payload.event) };
      case EngineMessageType.PARAMETER: return { ok: this.setParameter(payload.moduleId, payload.parameterId, payload.value) };
      case EngineMessageType.PANIC: this.panic(payload.frame ?? this.currentFrame); return { ok: true };
      case EngineMessageType.DIAGNOSTICS: return { ok: true, diagnostics: this.diagnostics() };
      default: return { ok: true };
    }
  }
}

const ProcessorBase = globalThis.AudioWorkletProcessor;
if (typeof ProcessorBase === 'function' && typeof globalThis.registerProcessor === 'function') {
  class VisualSynthProcessor extends ProcessorBase {
    constructor(options = {}) {
      super(options); this.runtime = new WorkletRuntime({ sampleRate: globalThis.sampleRate ?? 48000 }); this.telemetryCounter = 0;
      this.port.onmessage = event => { const result = this.runtime.handleMessage(event.data); if (!result.ok || event.data?.type === EngineMessageType.DIAGNOSTICS) this.port.postMessage({ type: EngineMessageType.DIAGNOSTICS, payload: result }); };
    }
    process(_inputs, outputs) {
      const output = outputs[0]; if (!output?.length) return true; const block = this.runtime.processBlock(output[0]?.length ?? 128); output[0]?.set(block.left); if (output[1]) output[1].set(block.right);
      this.telemetryCounter += 1; if (this.telemetryCounter >= 16) { this.telemetryCounter = 0; const diagnostics = this.runtime.diagnostics(); this.port.postMessage({ type: EngineMessageType.TELEMETRY, payload: { revision: diagnostics.revision, peak: Math.min(1, diagnostics.peak), activeVoices: diagnostics.activeVoices } }); }
      return true;
    }
  }
  globalThis.registerProcessor('visualsynth-processor', VisualSynthProcessor);
}
