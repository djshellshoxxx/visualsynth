import { GraphRenderer } from './graph-renderer.js';
import { sanitizeSample } from '../dsp/safety.js';
import { VoiceEngine } from './voice-engine.js';
import { EngineMessageType, validateEngineMessage } from './protocol.js';

export class WorkletRuntime {
  constructor({ sampleRate = 48000, maxVoices = 8 } = {}) {
    this.sampleRate = sampleRate;
    this.revision = 0;
    this.graph = null;
    this.renderer = null;
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
    let nextGraph;
    let renderer;
    try {
      nextGraph = typeof structuredClone === 'function' ? structuredClone(graph) : JSON.parse(JSON.stringify(graph));
      renderer = new GraphRenderer(nextGraph, this.sampleRate, this.renderer);
    } catch { this.rejectedGraphSwaps += 1; return false; }
    this.graph = nextGraph;
    this.renderer = renderer;
    this.revision = revision;
    const noteInput = graph.nodes.find(node => node.type === 'core.note-input');
    const maxVoices = noteInput?.parameters?.maxVoices;
    if (Number.isFinite(maxVoices)) {
      this.voiceEngine.allocator.maxVoices = Math.max(1, Math.min(32, Math.floor(maxVoices)));
      this.voiceEngine.allocator.voices.length = Math.min(this.voiceEngine.allocator.voices.length, this.voiceEngine.allocator.maxVoices);
    }
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
    if (!this.renderer.setParameter(moduleId, parameterId, value, this.panicLatched)) return false;
    if (parameterId === 'maxVoices' && this.graph.nodes.find(node => node.id === moduleId)?.type === 'core.note-input') {
      this.voiceEngine.allocator.maxVoices = Math.max(1, Math.min(32, Math.floor(value)));
      this.voiceEngine.allocator.voices.length = Math.min(this.voiceEngine.allocator.voices.length, this.voiceEngine.allocator.maxVoices);
    }
    this.parameterUpdates += 1;
    return true;
  }

  handleNote(event) {
    if (!event || typeof event !== 'object') return false;
    if (!['note-on', 'note-off', 'sustain', 'pitch-bend', 'panic'].includes(event.type)) return false;
    if ((event.type === 'note-on' || event.type === 'note-off') && (!Number.isFinite(event.note) || event.note < 0 || event.note > 127)) return false;
    if (event.velocity !== undefined && !Number.isFinite(event.velocity)) return false;
    if (event.semitones !== undefined && !Number.isFinite(event.semitones)) return false;
    if (event.type === 'panic') { this.panic(); return true; }
    const normalized = { ...event, frame: Number.isInteger(event.frame) ? event.frame : this.currentFrame };
    if (normalized.type === 'note-on') this.panicLatched = false;
    this.voiceEngine.enqueue(normalized);
    return true;
  }

  panic(frame = this.currentFrame) {
    this.voiceEngine.queue.clear();
    this.voiceEngine.allocator.panic(frame);
    this.renderer?.reset();
    this.panicLatched = true;
  }

  processBlock(length = 128) {
    const blockLength = Number.isFinite(length) ? Math.max(0, Math.floor(length)) : 0;
    const left = new Float32Array(blockLength);
    const right = new Float32Array(blockLength);
    this.processInto(left, right);
    return { left, right };
  }

  processInto(left, right) {
    const blockLength = left.length;
    if (!this.graph || this.panicLatched || blockLength === 0) {
      this.currentFrame += blockLength;
      this.lastPeak = 0;
      left.fill(0); right?.fill(0);
      return;
    }
    let peak = 0;
    for (let i = 0; i < blockLength; i += 1) {
      const frame = this.currentFrame + i;
      if (this.voiceEngine.queue.events[0]?.frame < frame + 1) this.voiceEngine.processRange(frame, frame + 1);
      const sample = Math.max(-1, Math.min(1, sanitizeSample(this.renderer.render(this.voiceEngine.allocator, frame) * this.masterGain)));
      left[i] = sample;
      if (right) right[i] = sample;
      peak = Math.max(peak, Math.abs(sample));
    }
    this.currentFrame += blockLength;
    this.lastPeak = peak;

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
      this.runtime.processInto(output[0], output[1]);
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
