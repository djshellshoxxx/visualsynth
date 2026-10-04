import { Oscillator } from '../dsp/oscillator.js';
import { StateVariableFilter } from '../dsp/filters.js';
import { applyVca } from '../dsp/vca.js';
import { sanitizeSample } from '../dsp/safety.js';
import { VoiceEngine } from './voice-engine.js';
import { EngineMessageType, validateEngineMessage } from './protocol.js';

const WAVEFORMS = ['sine', 'triangle', 'saw', 'reverse-saw', 'square', 'pulse', 'sine'];

function waveformFrom(value) {
  if (typeof value === 'string') return value;
  if (Number.isInteger(value)) return WAVEFORMS[value] ?? 'sine';
  return 'sine';
}

function finite(value, fallback = 0) { return Number.isFinite(value) ? value : fallback; }
function cloneGraph(graph) { return typeof structuredClone === 'function' ? structuredClone(graph) : JSON.parse(JSON.stringify(graph)); }

export class WorkletRuntime {
  constructor({ sampleRate = 48000, maxVoices = 8 } = {}) {
    this.sampleRate = sampleRate;
    this.revision = 0;
    this.graph = null;
    this.nodeState = new Map();
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
      if (node.type === 'core.oscillator') {
        nextState.set(node.id, new Oscillator({
          sampleRate: this.sampleRate,
          waveform: waveformFrom(node.parameters?.waveform),
          frequency: finite(node.parameters?.frequency, 220),
          pulseWidth: finite(node.parameters?.pulseWidth, 0.5)
        }));
      } else if (node.type === 'core.filter') {
        nextState.set(node.id, new StateVariableFilter({
          sampleRate: this.sampleRate,
          cutoff: finite(node.parameters?.cutoff, 12000),
          resonance: finite(node.parameters?.resonance, 0.1),
          mode: node.parameters?.mode ?? 'lowpass'
        }));
      }
    }

    this.graph = cloneGraph(graph);
    this.revision = revision;
    this.nodeState = nextState;
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

    const state = this.nodeState.get(moduleId);
    if (state instanceof Oscillator) {
      if (parameterId === 'frequency') state.setFrequency(value);
      if (parameterId === 'pulseWidth') state.pulseWidth = Math.max(0.01, Math.min(0.99, value));
      if (parameterId === 'waveform') state.waveform = waveformFrom(value);
    } else if (state instanceof StateVariableFilter) {
      if (parameterId === 'cutoff') state.setCutoff(value);
      if (parameterId === 'resonance') state.setResonance(value);
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
    this.panicLatched = true;
  }

  #incoming(nodeId, values) {
    if (!this.graph) return [];
    const samples = [];
    for (const connection of this.graph.connections) {
      if (connection.to?.moduleId === nodeId) samples.push(values.get(connection.from?.moduleId) ?? 0);
    }
    return samples;
  }

  #processNode(node, values) {
    const incoming = this.#incoming(node.id, values);
    const input = incoming.reduce((sum, value) => sum + finite(value), 0);
    const parameters = node.parameters ?? {};
    switch (node.type) {
      case 'core.oscillator': {
        const oscillator = this.nodeState.get(node.id);
        if (!(oscillator instanceof Oscillator)) return 0;
        return sanitizeSample(oscillator.nextSample() * finite(parameters.amplitude, 0.25));
      }
      case 'core.filter': {
        const filter = this.nodeState.get(node.id);
        return filter instanceof StateVariableFilter ? filter.processSample(input) : 0;
      }
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

    this.voiceEngine.processRange(this.currentFrame, this.currentFrame + blockLength);
    let peak = 0;
    for (let i = 0; i < blockLength; i += 1) {
      const values = new Map();
      let master = 0;
      for (const node of this.graph.nodes) {
        const value = this.#processNode(node, values);
        values.set(node.id, value);
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
    return {
      revision: this.revision,
      graphSwaps: this.graphSwaps,
      rejectedGraphSwaps: this.rejectedGraphSwaps,
      parameterUpdates: this.parameterUpdates,
      activeVoices: this.voiceEngine.voices().length,
      currentFrame: this.currentFrame,
      peak: this.lastPeak,
      panic: this.panicLatched,
      masterGain: this.masterGain
    };
  }

  handleMessage(message) {
    const validation = validateEngineMessage(message);
    if (!validation.valid) return { ok: false, errors: validation.errors };
    const payload = message.payload ?? {};
    switch (message.type) {
      case EngineMessageType.INITIALIZE: return { ok: true, diagnostics: this.diagnostics() };
      case EngineMessageType.GRAPH_SWAP: return { ok: this.applyGraph(payload.graph, payload.revision), diagnostics: this.diagnostics() };
      case EngineMessageType.NOTE: return { ok: this.handleNote(payload.event) };
      case EngineMessageType.PARAMETER: return { ok: this.setParameter(payload.moduleId, payload.parameterId, payload.value) };
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
        if (!result.ok || event.data?.type === EngineMessageType.DIAGNOSTICS) {
          this.port.postMessage({ type: EngineMessageType.DIAGNOSTICS, payload: result });
        }
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
