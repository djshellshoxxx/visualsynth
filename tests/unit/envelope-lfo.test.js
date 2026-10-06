import { describe, expect, test } from 'vitest';
import { ADSREnvelope, EnvelopeStage } from '../../src/dsp/envelope.js';
import { LFO } from '../../src/dsp/lfo.js';

describe('ADSR envelope', () => {
  test('moves through attack decay sustain and release', () => {
    const env = new ADSREnvelope({ sampleRate: 1000, attack: 0.01, decay: 0.01, sustain: 0.5, release: 0.01 });
    env.gateOn();
    const attack = env.renderBlock(10);
    expect(attack.at(-1)).toBeCloseTo(1, 4);
    const decay = env.renderBlock(10);
    expect(decay.at(-1)).toBeCloseTo(0.5, 4);
    expect(env.stage).toBe(EnvelopeStage.SUSTAIN);
    env.gateOff();
    const release = env.renderBlock(10);
    expect(release.at(-1)).toBeCloseTo(0, 4);
    expect(env.stage).toBe(EnvelopeStage.IDLE);
  });

  test('release begins from current value and reset retrigger restarts from zero', () => {
    const env = new ADSREnvelope({ sampleRate: 1000, attack: 0.1, decay: 0, sustain: 0.8, release: 0.1 });
    env.gateOn();
    env.renderBlock(20);
    const before = env.value;
    env.gateOff();
    expect(env.nextSample()).toBeLessThan(before);
    env.gateOn('reset');
    expect(env.value).toBe(0);
    expect(env.stage).toBe(EnvelopeStage.ATTACK);
  });

  test('zero-time stages do not divide by zero', () => {
    const env = new ADSREnvelope({ sampleRate: 48000, attack: 0, decay: 0, sustain: 0.25, release: 0 });
    env.gateOn();
    expect(Number.isFinite(env.nextSample())).toBe(true);
    expect(env.nextSample()).toBeCloseTo(0.25, 6);
    env.gateOff();
    expect(env.nextSample()).toBe(0);
  });
});

describe('LFO', () => {
  test('is deterministic and supports bipolar and unipolar output', () => {
    const bipolar = new LFO({ sampleRate: 100, waveform: 'sine', frequency: 1, phase: 0, polarity: 'bipolar' });
    const a = bipolar.renderBlock(25);
    expect(a[0]).toBeCloseTo(0, 6);
    expect(a.at(-1)).toBeGreaterThan(0.9);

    const unipolar = new LFO({ sampleRate: 100, waveform: 'sine', frequency: 1, phase: 0, polarity: 'unipolar' });
    const b = unipolar.renderBlock(100);
    expect(Math.min(...b)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...b)).toBeLessThanOrEqual(1);
  });

  test('supports reverse saw and deterministic stepped/random LFO shapes', () => {
    for (const waveform of ['reverse-saw', 'sample-hold', 'smooth-random', 'stepped-random']) {
      const a = new LFO({ sampleRate: 1000, waveform, frequency: 5, phase: 0, seed: 99 }).renderBlock(300);
      const b = new LFO({ sampleRate: 1000, waveform, frequency: 5, phase: 0, seed: 99 }).renderBlock(300);
      expect([...a]).toEqual([...b]);
      expect([...a].every(Number.isFinite)).toBe(true);
    }
  });

  test('reset restores deterministic phase', () => {
    const lfo = new LFO({ sampleRate: 100, waveform: 'triangle', frequency: 2, phase: 0.125 });
    const first = lfo.renderBlock(8);
    lfo.renderBlock(15);
    lfo.reset(0.125);
    const second = lfo.renderBlock(8);
    expect([...second]).toEqual([...first]);
  });
});
