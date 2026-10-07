import { describe, expect, test } from 'vitest';
import { AutomationLane } from '../../src/automation/automation.js';
import { TransportClock, StepSequencer, euclideanPattern } from '../../src/sequencing/sequencers.js';
import { PatchRandomizer } from '../../src/random/randomizer.js';
import { encodeWav } from '../../src/render/wav.js';
import { LESSONS } from '../../src/learning/lessons.js';

describe('frame-timed sequencing and automation', () => {
  test('transport advances deterministically in engine frames', () => {
    const transport = new TransportClock({ sampleRate: 48000, bpm: 120 });
    expect(transport.framesPerBeat).toBe(24000);
    expect(transport.positionAt(48000).beat).toBe(2);
  });

  test('step sequencer emits deterministic steps', () => {
    const sequencer = new StepSequencer({ steps: [60, 62, 64, 67], framesPerStep: 12000 });
    expect(sequencer.stepAt(0)).toMatchObject({ index: 0, value: 60 });
    expect(sequencer.stepAt(36000)).toMatchObject({ index: 3, value: 67 });
  });

  test('euclidean rhythm distributes the requested pulse count', () => {
    const pattern = euclideanPattern(5, 16, 3);
    expect(pattern).toHaveLength(16);
    expect(pattern.reduce((sum, value) => sum + value, 0)).toBe(5);
  });

  test('automation interpolates independently of UI refresh', () => {
    const lane = new AutomationLane([{ frame: 0, value: 0 }, { frame: 100, value: 1 }]);
    expect(lane.valueAt(50)).toBeCloseTo(.5, 5);
  });
});

describe('randomization, rendering and lessons', () => {
  test('safe randomization honors locks and declared safe ranges', () => {
    const randomizer = new PatchRandomizer({ seed: 123 });
    const parameters = { cutoff: 1000, resonance: .2 };
    const metadata = {
      cutoff: { min: 20, max: 20000, safeMin: 120, safeMax: 9000 },
      resonance: { min: 0, max: 1, safeMin: 0, safeMax: .7 }
    };
    const result = randomizer.parameters(parameters, metadata, { locks: ['resonance'], mode: 'safe' });
    expect(result.resonance).toBe(.2);
    expect(result.cutoff).toBeGreaterThanOrEqual(120);
    expect(result.cutoff).toBeLessThanOrEqual(9000);
  });

  test('WAV encoder writes RIFF/WAVE headers for all beta formats', () => {
    for (const format of ['pcm16','pcm24','float32']) {
      const wav = encodeWav(new Float32Array([0, .25, -.25, 0]), { sampleRate: 48000, channels: 1, format });
      const bytes = new Uint8Array(wav);
      expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
      expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    }
  });

  test('ships the twenty required initial learning topics', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(20);
    const topics = LESSONS.map(lesson => lesson.topic);
    for (const required of ['waveform','frequency','amplitude','harmonics','phase','detune','filter','resonance','adsr','lfo','fm','am','pwm','subtractive','additive','wavetable','routing','effects','patch-building']) {
      expect(topics).toContain(required);
    }
  });
});
