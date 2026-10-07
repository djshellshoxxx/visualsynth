import { sanitizeSample } from './safety.js';

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

// Wavefolder: folds the signal back on itself when drive pushes it past +/-1.
export function wavefold(sample, drive = 1, symmetry = 0) {
  let x = finite(sample) * Math.max(0.01, finite(drive, 1)) + finite(symmetry);
  // Triangle fold into [-1, 1]
  x = ((x + 1) % 4 + 4) % 4;
  return sanitizeSample(x < 2 ? x - 1 : 3 - x);
}

// Bit crusher / sample-rate reducer.
export class BitCrusher {
  constructor({ bits = 8, downsample = 1, mix = 1 } = {}) {
    this.set({ bits, downsample, mix });
    this.counter = 0;
    this.held = 0;
  }

  set({ bits, downsample, mix }) {
    this.bits = Math.max(1, Math.min(24, Math.round(finite(bits, 8))));
    this.downsample = Math.max(1, Math.min(64, Math.round(finite(downsample, 1))));
    this.mix = Math.max(0, Math.min(1, finite(mix, 1)));
  }

  processSample(input) {
    const dry = finite(input);
    if (this.counter % this.downsample === 0) {
      const levels = 2 ** (this.bits - 1);
      this.held = Math.round(Math.max(-1, Math.min(1, dry)) * levels) / levels;
    }
    this.counter = (this.counter + 1) % this.downsample;
    return sanitizeSample(dry * (1 - this.mix) + this.held * this.mix);
  }
}

// Slew limiter: bounded rate of change with separate rise/fall times (seconds per unit).
export class SlewLimiter {
  constructor({ sampleRate = 48000, rise = 0.05, fall = 0.05 } = {}) {
    this.sampleRate = sampleRate;
    this.value = 0;
    this.primed = false;
    this.set({ rise, fall });
  }

  set({ rise, fall }) {
    this.rise = Math.max(0, finite(rise, 0.05));
    this.fall = Math.max(0, finite(fall, 0.05));
  }

  processSample(input) {
    const target = finite(input);
    if (!this.primed) { this.value = target; this.primed = true; return this.value; }
    const delta = target - this.value;
    const seconds = delta >= 0 ? this.rise : this.fall;
    const maxStep = seconds <= 0 ? Infinity : 1 / (seconds * this.sampleRate);
    this.value += Math.max(-maxStep, Math.min(maxStep, delta));
    return sanitizeSample(this.value);
  }
}

// Sample & hold: samples `input` on each rising edge of `trigger`; optional slew.
export class SampleAndHold {
  constructor() { this.value = 0; this.lastTrigger = 0; }

  processSample(input, trigger) {
    const t = finite(trigger);
    if (t > 0.5 && this.lastTrigger <= 0.5) this.value = finite(input);
    this.lastTrigger = t;
    return sanitizeSample(this.value);
  }
}

// Comparator with hysteresis. Output: gate (1/0) and trigger on rising edge.
export class Comparator {
  constructor() { this.state = 0; }

  processSample(input, threshold = 0, hysteresis = 0.02) {
    const x = finite(input), h = Math.max(0, finite(hysteresis));
    const previous = this.state;
    if (previous === 0 && x > finite(threshold) + h) this.state = 1;
    else if (previous === 1 && x < finite(threshold) - h) this.state = 0;
    return { gate: this.state, trigger: this.state === 1 && previous === 0 ? 1 : 0 };
  }
}

// Four-pole ladder low-pass (Huovilainen-style, tanh per stage) with resonance feedback.
export class LadderFilter {
  constructor({ sampleRate = 48000, cutoff = 1000, resonance = 0.3, drive = 1 } = {}) {
    this.sampleRate = sampleRate;
    this.stages = [0, 0, 0, 0];
    this.set({ cutoff, resonance, drive });
  }

  set({ cutoff, resonance, drive }) {
    const hz = Math.max(20, Math.min(this.sampleRate * 0.45, finite(cutoff, 1000)));
    this.g = 1 - Math.exp(-2 * Math.PI * hz / this.sampleRate);
    this.k = Math.max(0, Math.min(1, finite(resonance, 0.3))) * 3.9;
    this.drive = Math.max(0.1, Math.min(8, finite(drive, 1)));
  }

  processSample(input) {
    const s = this.stages;
    let x = Math.tanh((finite(input) - this.k * s[3]) * this.drive);
    for (let i = 0; i < 4; i += 1) {
      s[i] += this.g * (Math.tanh(x) - Math.tanh(s[i]));
      x = s[i];
    }
    return sanitizeSample(s[3]);
  }
}

function lcg(seed) {
  let state = (Math.round(finite(seed, 1)) >>> 0) || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

// Bounded random walk in [-1, 1], stepping on each trigger (or free-running when unpatched).
export class RandomWalk {
  constructor({ seed = 1 } = {}) { this.rand = lcg(seed); this.value = 0; this.lastTrigger = 0; }

  step(stepSize) {
    this.value = Math.max(-1, Math.min(1, this.value + (this.rand() * 2 - 1) * Math.max(0, finite(stepSize, 0.1))));
    return this.value;
  }

  processSample(trigger, stepSize) {
    const t = finite(trigger);
    if (t > 0.5 && this.lastTrigger <= 0.5) this.step(stepSize);
    this.lastTrigger = t;
    return sanitizeSample(this.value);
  }
}

// Logistic-map chaos generator, iterated at `rate` Hz; output scaled to [-1, 1].
export class ChaosGenerator {
  constructor({ sampleRate = 48000, rate = 10, r = 3.9, seed = 1 } = {}) {
    this.sampleRate = sampleRate;
    this.x = 0.1 + 0.8 * lcg(seed)();
    this.phase = 0;
    this.set({ rate, r });
  }

  set({ rate, r }) {
    this.rate = Math.max(0.01, Math.min(this.sampleRate / 2, finite(rate, 10)));
    this.r = Math.max(2.5, Math.min(4, finite(r, 3.9)));
  }

  processSample() {
    this.phase += this.rate / this.sampleRate;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      this.x = this.r * this.x * (1 - this.x);
      if (!(this.x > 1e-6 && this.x < 1 - 1e-6)) this.x = 0.5;
    }
    return sanitizeSample(this.x * 2 - 1);
  }
}

const clampRange = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// FM/PM operator utility: pure domain scaling. Modes: pm-cycles, fm-hz, fm-semitones, fm-octaves.
export const FM_MODES = Object.freeze(['pm-cycles', 'fm-hz', 'fm-semitones', 'fm-octaves']);
const FM_LIMITS = [64, 20000, 120, 10];
export function fmOperator(mod, mode = 0, depth = 1, bias = 0, polarity = 1) {
  const index = clampRange(Math.round(finite(mode, 0)), 0, FM_MODES.length - 1);
  const sign = finite(polarity, 1) < 0 ? -1 : 1;
  const limit = FM_LIMITS[index];
  return sanitizeSample(clampRange(finite(mod) * finite(depth, 1) * sign + finite(bias), -limit, limit));
}
// Converts an exponential-domain excursion to a frequency ratio (extreme depths are clamped).
export function fmExcursionToRatio(value, mode) {
  if (mode === 2) return 2 ** (clampRange(finite(value), -120, 120) / 12);
  if (mode === 3) return 2 ** clampRange(finite(value), -10, 10);
  return 1;
}

// Waveshaper. Modes: soft(tanh), hard(clip), saturation(x/(1+|x|)), rectify, custom (uniform curve over [-1,1]).
export const WAVESHAPER_MODES = Object.freeze(['soft', 'hard', 'saturation', 'rectify', 'custom']);
export function waveshape(sample, mode = 0, drive = 1, bias = 0, curve = null) {
  const x = finite(sample) * clampRange(finite(drive, 1), 0, 64) + finite(bias);
  let y;
  switch (WAVESHAPER_MODES[clampRange(Math.round(finite(mode, 0)), 0, 4)]) {
    case 'hard': y = clampRange(x, -1, 1); break;
    case 'saturation': y = x / (1 + Math.abs(x)); break;
    case 'rectify': y = clampRange(Math.abs(x), 0, 1); break;
    case 'custom': {
      if (!Array.isArray(curve) || curve.length < 2) { y = clampRange(x, -1, 1); break; }
      const pos = (clampRange(x, -1, 1) + 1) / 2 * (curve.length - 1);
      const i = Math.min(curve.length - 2, Math.floor(pos)), f = pos - i;
      y = finite(curve[i]) * (1 - f) + finite(curve[i + 1]) * f;
      break;
    }
    default: y = Math.tanh(x);
  }
  return sanitizeSample(y);
}

// Probability router: routes each rising-edge trigger to one output (exclusive) or each output independently.
export class ProbabilityRouter {
  constructor({ seed = 1, outputs = 4 } = {}) { this.rand = lcg(seed); this.outputs = outputs; this.last = 0; }

  processSample(trigger, weights, exclusive = true) {
    const t = finite(trigger);
    const out = new Array(this.outputs).fill(0);
    const edge = t > 0.5 && this.last <= 0.5;
    this.last = t;
    if (!edge) return out;
    const w = Array.from({ length: this.outputs }, (_, i) => Math.max(0, finite(weights?.[i], 0)));
    if (exclusive) {
      const total = w.reduce((a, b) => a + b, 0);
      const r = this.rand();
      if (total <= 0) return out;
      let acc = 0;
      for (let i = 0; i < w.length; i += 1) { acc += w[i] / total; if (r < acc || i === w.length - 1) { if (w[i] > 0) { out[i] = 1; break; } } }
    } else {
      for (let i = 0; i < w.length; i += 1) if (this.rand() < Math.min(1, w[i])) out[i] = 1;
    }
    return out;
  }
}

// Custom function generator: constrained expression AST (never executable source).
const FUNCTIONS = { sin: [1, Math.sin], cos: [1, Math.cos], abs: [1, Math.abs], tanh: [1, Math.tanh], pow: [2, Math.pow] };
const VARIABLES = new Set(['phase', 't', 'in']);
const CONSTANTS = { pi: Math.PI, e: Math.E };
export const EXPRESSION_LIMITS = Object.freeze({ maxNodes: 64, maxDepth: 12, maxLength: 256 });

export function validateExpressionAst(ast) {
  let count = 0;
  const walk = (n, depth) => {
    if (++count > EXPRESSION_LIMITS.maxNodes || depth > EXPRESSION_LIMITS.maxDepth || !n || typeof n !== 'object') return false;
    switch (n.type) {
      case 'num': return Number.isFinite(n.value);
      case 'var': return VARIABLES.has(n.name);
      case 'neg': return walk(n.arg, depth + 1);
      case 'bin': return ['+', '-', '*', '/'].includes(n.op) && walk(n.left, depth + 1) && walk(n.right, depth + 1);
      case 'call': return Object.hasOwn(FUNCTIONS, n.name) && Array.isArray(n.args) && n.args.length === FUNCTIONS[n.name][0] && n.args.every(a => walk(a, depth + 1));
      default: return false;
    }
  };
  return walk(ast, 0);
}

export function parseExpression(source) {
  const text = String(source ?? '');
  if (text.length > EXPRESSION_LIMITS.maxLength) return null;
  const tokens = text.match(/\s*(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+|[A-Za-z_]\w*|[-+*/(),]|\S)/gi);
  if (!tokens || tokens.join('').replace(/\s/g, '').length !== text.replace(/\s/g, '').length) return null;
  const toks = tokens.map(s => s.trim());
  let pos = 0, depth = 0;
  const peek = () => toks[pos];
  const fail = () => { throw new Error('parse'); };
  const primary = () => {
    const tok = toks[pos++];
    if (tok === undefined) fail();
    if (/^(\d|\.\d)/.test(tok)) return { type: 'num', value: Number(tok) };
    if (tok === '(') { if (++depth > EXPRESSION_LIMITS.maxDepth) fail(); const e = sum(); depth -= 1; if (toks[pos++] !== ')') fail(); return e; }
    if (/^[A-Za-z_]/.test(tok)) {
      if (peek() === '(') {
        pos += 1; const args = [];
        if (peek() !== ')') { do { args.push(sum()); } while (peek() === ',' && ++pos); }
        if (toks[pos++] !== ')') fail();
        return { type: 'call', name: tok, args };
      }
      const name = tok.toLowerCase();
      if (Object.hasOwn(CONSTANTS, name)) return { type: 'num', value: CONSTANTS[name] };
      return { type: 'var', name };
    }
    return fail();
  };
  const unary = () => { if (peek() === '-') { pos += 1; return { type: 'neg', arg: unary() }; } if (peek() === '+') { pos += 1; return unary(); } return primary(); };
  const product = () => { let l = unary(); while (peek() === '*' || peek() === '/') { const op = toks[pos++]; l = { type: 'bin', op, left: l, right: unary() }; } return l; };
  const sum = () => { let l = product(); while (peek() === '+' || peek() === '-') { const op = toks[pos++]; l = { type: 'bin', op, left: l, right: product() }; } return l; };
  try {
    const ast = sum();
    return pos === toks.length && validateExpressionAst(ast) ? ast : null;
  } catch { return null; }
}

// Compiles a validated AST to a closure; returns null for invalid ASTs. Output is always finite and bounded.
export function compileExpression(ast) {
  if (!validateExpressionAst(ast)) return null;
  const run = (n, v) => {
    switch (n.type) {
      case 'num': return n.value;
      case 'var': return v[n.name];
      case 'neg': return -run(n.arg, v);
      case 'bin': {
        const a = run(n.left, v), b = run(n.right, v);
        if (n.op === '+') return a + b;
        if (n.op === '-') return a - b;
        if (n.op === '*') return a * b;
        return Math.abs(b) < 1e-12 ? 0 : a / b;
      }
      default: {
        const args = n.args.map(a => run(a, v));
        if (n.name === 'pow') return Math.pow(Math.abs(args[0]) > 1e6 ? Math.sign(args[0]) * 1e6 : args[0], clampRange(args[1], -16, 16));
        return FUNCTIONS[n.name][1](args[0]);
      }
    }
  };
  return (vars) => { const y = run(ast, vars); return Number.isFinite(y) ? clampRange(y, -1e6, 1e6) : 0; };
}

export class FunctionGenerator {
  constructor({ sampleRate = 48000, frequency = 1, ast = null } = {}) {
    this.sampleRate = sampleRate; this.phase = 0; this.time = 0;
    this.fn = compileExpression(ast) ?? compileExpression(parseExpression('sin(2*pi*phase)'));
    this.set({ frequency });
  }

  set({ frequency }) { this.frequency = clampRange(finite(frequency, 1), 0.001, this.sampleRate / 2); }

  processSample(input = 0, amount = 1) {
    const y = this.fn({ phase: this.phase, t: this.time, in: finite(input) });
    this.phase += this.frequency / this.sampleRate; this.phase -= Math.floor(this.phase);
    this.time += 1 / this.sampleRate;
    return sanitizeSample(clampRange(y * finite(amount, 1), -1, 1));
  }
}

// Audio -> control. Modes: sample, average, rms, envelope. Updates at `rate` Hz (held between updates).
export const AUDIO_TO_CONTROL_MODES = Object.freeze(['sample', 'average', 'rms', 'envelope']);
export class AudioToControl {
  constructor({ sampleRate = 48000, mode = 0, rate = 100 } = {}) {
    this.sampleRate = sampleRate; this.sum = 0; this.sumSq = 0; this.count = 0; this.phase = 0; this.peak = 0; this.value = 0;
    this.set({ mode, rate });
  }

  set({ mode, rate }) {
    this.mode = clampRange(Math.round(finite(mode, 0)), 0, 3);
    this.rate = clampRange(finite(rate, 100), 1, this.sampleRate / 2);
  }

  processSample(input) {
    const x = finite(input);
    this.sum += x; this.sumSq += x * x; this.count += 1;
    this.peak = Math.max(Math.abs(x), this.peak * Math.exp(-1 / (4 * this.sampleRate / this.rate)));
    this.phase += this.rate / this.sampleRate;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      const m = AUDIO_TO_CONTROL_MODES[this.mode];
      this.value = m === 'sample' ? x : m === 'average' ? this.sum / this.count : m === 'rms' ? Math.sqrt(this.sumSq / this.count) : this.peak;
      this.sum = 0; this.sumSq = 0; this.count = 0;
    }
    return sanitizeSample(this.value);
  }
}

// Control -> audio: smoothed DC/control signal (one-pole, time in seconds; 0 = passthrough).
export class ControlToAudio {
  constructor({ sampleRate = 48000, smoothing = 0.005 } = {}) { this.sampleRate = sampleRate; this.value = 0; this.set({ smoothing }); }

  set({ smoothing }) { this.smoothing = Math.max(0, finite(smoothing, 0.005)); }

  processSample(input) {
    const x = finite(input);
    if (this.smoothing <= 0) this.value = x;
    else this.value += (1 - Math.exp(-1 / (this.smoothing * this.sampleRate))) * (x - this.value);
    return sanitizeSample(this.value);
  }
}

// Sample delay: exact integer-sample delay on a fixed ring buffer.
export const MAX_SAMPLE_DELAY = 4096;
export class SampleDelay {
  constructor({ delay = 0 } = {}) { this.buffer = new Float32Array(MAX_SAMPLE_DELAY + 1); this.index = 0; this.set({ delay }); }

  set({ delay }) { this.delay = clampRange(Math.round(finite(delay, 0)), 0, MAX_SAMPLE_DELAY); }

  processSample(input) {
    this.buffer[this.index] = finite(input);
    const out = this.buffer[(this.index - this.delay + this.buffer.length) % this.buffer.length];
    this.index = (this.index + 1) % this.buffer.length;
    return sanitizeSample(out);
  }
}

// Harmonic exciter: isolates content above a (pitch-tracked) harmonic, saturates it and mixes it back.
export class HarmonicExciter {
  constructor({ sampleRate = 48000, amount = 0.3, frequency = 1000, harmonic = 2, drive = 3, type = 0 } = {}) {
    this.sampleRate = sampleRate; this.lp = 0; this.aa = 0; this.cutoff = 1000;
    this.set({ amount, frequency, harmonic, drive, type });
  }

  // `pitch` is a MIDI note when tracking, or null/undefined to use `frequency` (no fundamental -> fixed fallback).
  set({ amount, frequency, harmonic, drive, type, pitch = null }) {
    this.amount = clampRange(finite(amount, 0.3), 0, 1);
    this.drive = clampRange(finite(drive, 3), 0.1, 16);
    this.type = clampRange(Math.round(finite(type, 0)), 0, 2);
    const base = Number.isFinite(pitch) ? 440 * 2 ** ((pitch - 69) / 12) : finite(frequency, 1000);
    const hz = base * clampRange(finite(harmonic, 2), 1, 16);
    this.cutoff = clampRange(hz, 100, this.sampleRate * 0.4);
    this.a = 1 - Math.exp(-2 * Math.PI * this.cutoff / this.sampleRate);
    this.b = 1 - Math.exp(-2 * Math.PI * this.sampleRate * 0.35 / this.sampleRate);
  }

  processSample(input) {
    const x = finite(input);
    this.lp += this.a * (x - this.lp);
    const band = (x - this.lp) * this.drive;
    const shaped = this.type === 0 ? Math.tanh(band) : this.type === 1 ? Math.tanh(band + 0.3 * band * band) : clampRange(Math.abs(band), 0, 1) * Math.sign(band || 1) * 0.7;
    this.aa += this.b * (shaped - this.aa);
    return sanitizeSample(x + this.amount * this.aa);
  }
}

// Generative event router: density gate, route memory (repeat bias) and a max-repeat constraint.
export class GenerativeRouter {
  constructor({ seed = 1, outputs = 3 } = {}) { this.rand = lcg(seed); this.outputs = outputs; this.last = 0; this.previous = -1; this.repeats = 0; }

  processSample(trigger, { density = 1, memory = 0, maxRepeats = 3 } = {}) {
    const t = finite(trigger);
    const out = new Array(this.outputs).fill(0);
    const edge = t > 0.5 && this.last <= 0.5;
    this.last = t;
    if (!edge) return out;
    if (this.rand() >= clampRange(finite(density, 1), 0, 1)) return out;
    let route = Math.min(this.outputs - 1, Math.floor(this.rand() * this.outputs));
    if (this.previous >= 0 && this.rand() < clampRange(finite(memory, 0), 0, 1)) route = this.previous;
    if (route === this.previous && this.repeats >= Math.max(1, maxRepeats)) route = (route + 1) % this.outputs;
    this.repeats = route === this.previous ? this.repeats + 1 : 1;
    this.previous = route;
    out[route] = 1;
    return out;
  }
}

// Spectral analyzer: collects a block of samples, runs a radix-2 FFT and exposes band energies + centroid (all 0..1).
export function fftMagnitudes(samples) {
  const n = samples.length, re = Float64Array.from(samples), im = new Float64Array(n);
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k), a = i + k, b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
      }
    }
  }
  const mags = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) mags[i] = Math.hypot(re[i], im[i]) * 2 / n;
  return mags;
}

export const SPECTRAL_BANDS_HZ = Object.freeze([250, 2000]);
export class SpectralAnalyzer {
  constructor({ sampleRate = 48000, size = 512 } = {}) {
    this.sampleRate = sampleRate;
    this.size = [128, 256, 512, 1024, 2048].includes(size) ? size : 512;
    this.buffer = new Float64Array(this.size); this.index = 0;
    this.window = Float64Array.from({ length: this.size }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / this.size));
    this.result = { low: 0, mid: 0, high: 0, centroid: 0 };
  }

  analyze(block) {
    const mags = fftMagnitudes(Float64Array.from(block, (v, i) => finite(v) * this.window[i]));
    const hzPerBin = this.sampleRate / this.size, nyquist = this.sampleRate / 2;
    const bands = [0, 0, 0]; let total = 0, weighted = 0;
    for (let i = 1; i < mags.length; i++) {
      const hz = i * hzPerBin, e = mags[i] * mags[i];
      bands[hz < SPECTRAL_BANDS_HZ[0] ? 0 : hz < SPECTRAL_BANDS_HZ[1] ? 1 : 2] += e;
      total += e; weighted += e * hz;
    }
    const norm = 1;
    this.result = { low: Math.min(norm, Math.sqrt(bands[0] * 2)), mid: Math.min(norm, Math.sqrt(bands[1] * 2)), high: Math.min(norm, Math.sqrt(bands[2] * 2)), centroid: total > 1e-12 ? weighted / total / nyquist : 0 };
    return this.result;
  }

  processSample(sample) {
    this.buffer[this.index++] = finite(sample);
    if (this.index >= this.size) { this.index = 0; this.analyze(this.buffer); }
    return this.result;
  }
}

// Phase interference lab: N internal sine sources with ratio/phase(cycles)/gain, summed.
export class PhaseInterference {
  constructor({ sampleRate = 48000, sources = 3 } = {}) { this.sampleRate = sampleRate; this.count = sources; this.phase = new Array(sources).fill(0); }
  processSample({ frequency = 220, ratios = [], phases = [], gains = [] } = {}) {
    let sum = 0;
    for (let i = 0; i < this.count; i++) {
      const ratio = finite(ratios[i], 1), gain = finite(gains[i], i === 0 ? 1 : 0.5);
      sum += gain * Math.sin(2 * Math.PI * (this.phase[i] + finite(phases[i], 0)));
      this.phase[i] = (this.phase[i] + Math.max(0, finite(frequency, 220)) * ratio / this.sampleRate) % 1;
    }
    return sanitizeSample(sum / this.count);
  }
}
