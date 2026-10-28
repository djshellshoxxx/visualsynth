import { createNodeDsp, resetNodeDsp, processNodeDsp, finite, noiseSeed } from './node-dsp.js';
import { AVAILABLE_MODULE_DEFINITIONS } from '../modules/available-definitions.js';
import { sanitizeSample } from '../dsp/safety.js';

const supportedTypes = new Set(AVAILABLE_MODULE_DEFINITIONS.map(definition => definition.typeId));
const LANES = 33; // global lane plus the supported 32 voices
const polyphonic = node => node.scope === 'voice' || node.type === 'core.note-input';

// Owns prepared routing, lane buffers and DSP state. No per-sample Maps/arrays are built.
export class GraphRenderer {
  constructor(graph, sampleRate, previous = null) {
    this.sampleRate = sampleRate;
    this.records = [];
    this.byId = new Map();
    this.live = new Uint8Array(LANES);
    this.voiceIds = new Float64Array(LANES);
    this.startedFrames = new Float64Array(LANES).fill(-1);
    this.activeCount = 0;
    this.releaseFrames = 0;
    this.pitchBend = 0;
    for (const node of graph.nodes) {
      if (!node || typeof node.id !== 'string' || typeof node.type !== 'string') throw new Error('Invalid runtime node');
      if (!supportedTypes.has(node.type)) throw new Error('Unknown runtime node type');
      if (this.byId.has(node.id)) throw new Error('Duplicate runtime node');
      const old = previous?.byId.get(node.id);
      const reusable = old && old.node.type === node.type && old.node.scope === node.scope;
      const record = {
        node, parameters: { ...node.parameters },
        smoothing: (node.parameterDefinitions ?? []).filter(p => p.smoothingMs > 0).map(p => ({ id: p.id, alpha: 1 - Math.exp(-1 / (p.smoothingMs * sampleRate / 1000)) })),
        inputs: new Map(), modulations: new Map(), outputs: new Map(),
        states: reusable ? old.states : Array.from({ length: node.scope === 'voice' ? LANES : 1 }, (_, lane) => createNodeDsp(node, sampleRate, lane)),
        gates: reusable ? old.gates : new Float64Array(LANES),
        reset: reusable ? old.reset : new Float64Array(LANES),
        retriggers: reusable ? old.retriggers : new Float64Array(LANES)
      };
      for (const port of ['audioOut', 'controlOut', 'pitchOut', 'gateOut', 'velocityOut']) record.outputs.set(port, new Float64Array(LANES));
      if (reusable) for (const p of record.smoothing) record.parameters[p.id] = finite(old.parameters[p.id], node.parameters[p.id]);
      record.outputBuffers = [...record.outputs.values()];
      this.records.push(record); this.byId.set(node.id, record);
    }
    if (previous) { this.voiceIds.set(previous.voiceIds); this.startedFrames.set(previous.startedFrames); }
    const connect = (source, destination, modulation) => {
      const from = this.byId.get(source?.moduleId); const to = this.byId.get(destination?.moduleId);
      if (!from || !to || !from.outputs.has(source.portId) && source.portId !== 'eventOut') throw new Error('Invalid runtime edge');
      if (this.records.indexOf(from) >= this.records.indexOf(to)) throw new Error('Runtime graph must be topologically ordered');
      const target = modulation ? to.modulations : to.inputs;
      if (!target.has(destination.portId)) target.set(destination.portId, []);
      target.get(destination.portId).push({ from, port: source.portId, modulation });
    };
    for (const edge of graph.connections) if (edge.enabled !== false) connect(edge.from, edge.to, null);
    for (const route of graph.modulations ?? []) connect(route.source, route.destination, route);
    this.updateRelease();
  }

  updateRelease() {
    this.releaseFrames = 0;
    for (const r of this.records) if (r.node.type === 'core.adsr' && r.node.scope === 'voice') {
      this.releaseFrames = Math.max(this.releaseFrames, Math.ceil(Math.min(30, Math.max(0, finite(r.node.parameters?.release, 0.25))) * this.sampleRate));
    }
  }

  source(route, lane) {
    const values = route.from.outputs.get(route.port);
    if (!values) return 0;
    if (!polyphonic(route.from.node)) return values[0];
    if (lane > 0) return values[lane];
    let value = 0;
    for (let i = 1; i < LANES; i++) if (this.live[i]) value += values[i];
    // Audio only crosses scope at the sum boundary; keep existing equal-power normalization.
    return route.port === 'audioOut' ? value / Math.sqrt(Math.max(1, this.activeCount)) : value;
  }

  input(record, port, lane) {
    let value = 0;
    const routes = record.inputs.get(port);
    if (routes) for (let i = 0; i < routes.length; i++) value += this.source(routes[i], lane);
    return sanitizeSample(value);
  }

  modulation(record, port, lane) {
    let value = 0;
    const routes = record.modulations.get(port);
    if (routes) for (let i = 0; i < routes.length; i++) {
      const route = routes[i]; const m = route.modulation;
      const min = finite(m.inputRange?.[0], m.polarity === 'unipolar' ? 0 : -1);
      const max = finite(m.inputRange?.[1], 1);
      let sample = Math.max(min, Math.min(max, this.source(route, lane)));
      if (m.polarity === 'unipolar') sample = Math.max(0, sample);
      value += sample * finite(m.amount, 1);
    }
    return sanitizeSample(value);
  }

  reset() {
    this.voiceIds.fill(0); this.startedFrames.fill(-1);
    for (const r of this.records) {
      r.gates.fill(0); r.reset.fill(0); r.retriggers.fill(0);
      for (const state of r.states) {
        resetNodeDsp(state);
        if (state?.buffer) { state.buffer.fill(0); state.filteredFeedback = 0; state.writeIndex = 0; }
        if (state && 'low' in state) state.low = 0;
      }
    }
  }

  setParameter(moduleId, parameterId, value, immediate = false) {
    const r = this.byId.get(moduleId);
    if (!r) return false;
    r.node.parameters ??= {};
    r.node.parameters[parameterId] = value;
    if (immediate || !r.smoothing.some(p => p.id === parameterId)) r.parameters[parameterId] = value;
    if (r.node.type === 'standard.noise' && parameterId === 'seed') r.states.forEach((s, lane) => { s.seed = noiseSeed(value, lane); s.reset(); });
    if (parameterId === 'release') this.updateRelease();
    return true;
  }

  render(allocator, frame) {
    const voices = allocator.voices;
    this.pitchBend = allocator.pitchBendSemitones;
    this.live.fill(0); this.activeCount = 0;
    for (let i = 0; i < Math.min(voices.length, 32); i++) {
      const voice = voices[i]; const lane = i + 1;
      this.live[lane] = voice.gate || (voice.releasedFrame !== null && frame - voice.releasedFrame < this.releaseFrames) ? 1 : 0;
      this.activeCount += this.live[lane];
      if (voice.voiceId !== this.voiceIds[lane] || voice.startedFrame !== this.startedFrames[lane]) {
        this.voiceIds[lane] = voice.voiceId; this.startedFrames[lane] = voice.startedFrame;
        for (const r of this.records) if (r.node.scope === 'voice') {
          resetNodeDsp(r.states[lane]); r.gates[lane] = 0; r.reset[lane] = 0; r.retriggers[lane] = 0;
        }
      }
    }
    let master = 0;
    for (const r of this.records) {
      const node = r.node;
      for (let i = 0; i < r.smoothing.length; i++) {
        const p = r.smoothing[i];
        const target = finite(node.parameters?.[p.id]);
        const current = finite(r.parameters[p.id], target);
        r.parameters[p.id] = Math.abs(target - current) < 1e-9 ? target : current + p.alpha * (target - current);
      }
      for (let i = 0; i < r.outputBuffers.length; i++) r.outputBuffers[i].fill(0);
      if (node.enabled === false || node.muted) continue;
      if (node.type === 'core.note-input') {
        for (let i = 0; i < Math.min(voices.length, 32); i++) {
          const v = voices[i]; const lane = i + 1;
          r.outputs.get('pitchOut')[lane] = v.note + this.pitchBend + finite(r.parameters.transpose);
          r.outputs.get('gateOut')[lane] = v.gate ? 1 : 0;
          r.outputs.get('velocityOut')[lane] = v.velocity;
        }
        continue;
      }
      const first = node.scope === 'voice' ? 1 : 0;
      const last = node.scope === 'voice' ? Math.min(voices.length, 32) : 0;
      for (let lane = first; lane <= last; lane++) {
        if (lane && !this.live[lane]) continue;
        const value = sanitizeSample(node.bypass ? this.input(r, 'audioIn', lane) : processNodeDsp(r, r.states[lane], lane, lane ? voices[lane - 1] : null, frame, this));
        r.outputs.get(node.type === 'core.adsr' || node.type === 'core.lfo' ? 'controlOut' : 'audioOut')[lane] = value;
        if (node.type === 'core.master-output') master += value;
      }
    }
    return sanitizeSample(master);
  }
}
