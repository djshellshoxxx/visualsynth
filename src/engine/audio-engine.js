import { EngineMessageType, createEngineMessage } from './protocol.js';

function defaultContextFactory() {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context) throw new Error('Web Audio API is unavailable');
  return new Context({ latencyHint: 'interactive' });
}

function defaultNodeFactory(context) {
  if (typeof globalThis.AudioWorkletNode !== 'function') throw new Error('AudioWorklet is unavailable');
  return new globalThis.AudioWorkletNode(context, 'visualsynth-processor', {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2]
  });
}

export class AudioEngine {
  constructor({ contextFactory = defaultContextFactory, nodeFactory = defaultNodeFactory, workletUrl = new URL('./worklet-processor.js', import.meta.url).href } = {}) {
    this.contextFactory = contextFactory;
    this.nodeFactory = nodeFactory;
    this.workletUrl = workletUrl;
    this.context = null;
    this.node = null;
    this.started = false;
    this.revision = 0;
    this.telemetry = { peak: 0, activeVoices: 0 };
    this.remoteDiagnostics = null;
  }

  async start() {
    if (!this.context) this.context = this.contextFactory();

    if (!this.node) {
      if (!this.context.audioWorklet?.addModule) throw new Error('AudioWorklet module loading is unavailable');
      await this.context.audioWorklet.addModule(this.workletUrl);
      this.node = this.nodeFactory(this.context);
      this.node.port.onmessage = event => this.#handleProcessorMessage(event.data);
      this.node.connect(this.context.destination);
      this.#post(EngineMessageType.INITIALIZE, { sampleRate: this.context.sampleRate ?? null });
    }

    if (this.context.state !== 'running' && typeof this.context.resume === 'function') await this.context.resume();
    this.started = true;
    return this;
  }

  #requireStarted() {
    if (!this.node) throw new Error('Audio engine has not been started');
  }

  #post(type, payload = {}) {
    this.#requireStarted();
    const message = createEngineMessage(type, payload);
    this.node.port.postMessage(message);
    return message;
  }

  #handleProcessorMessage(message) {
    if (!message || typeof message !== 'object') return;
    if (message.type === EngineMessageType.TELEMETRY) {
      const peak = Number.isFinite(message.payload?.peak) ? message.payload.peak : 0;
      const activeVoices = Number.isInteger(message.payload?.activeVoices) ? message.payload.activeVoices : 0;
      this.telemetry = { peak, activeVoices };
    } else if (message.type === EngineMessageType.DIAGNOSTICS) {
      this.remoteDiagnostics = message.payload ?? null;
    }
  }

  applyCompiledGraph(graph) {
    this.#requireStarted();
    this.revision += 1;
    const runtimeGraph = { ...graph, revision: this.revision };
    this.#post(EngineMessageType.GRAPH_SWAP, { revision: this.revision, graph: runtimeGraph });
    return this.revision;
  }

  sendNote(event) {
    this.#post(EngineMessageType.NOTE, { event });
  }

  setParameter(moduleId, parameterId, value) {
    this.#post(EngineMessageType.PARAMETER, { moduleId, parameterId, value });
  }

  panic(frame) {
    this.#post(EngineMessageType.PANIC, frame === undefined ? {} : { frame });
  }

  requestDiagnostics() {
    this.#post(EngineMessageType.DIAGNOSTICS, {});
  }

  diagnostics() {
    return {
      started: this.started,
      contextState: this.context?.state ?? 'uninitialized',
      sampleRate: Number.isFinite(this.context?.sampleRate) ? this.context.sampleRate : null,
      baseLatency: Number.isFinite(this.context?.baseLatency) ? this.context.baseLatency : null,
      outputLatency: Number.isFinite(this.context?.outputLatency) ? this.context.outputLatency : null,
      revision: this.revision,
      telemetry: { ...this.telemetry },
      processor: this.remoteDiagnostics
    };
  }
}
