import { describe, expect, test } from 'vitest';
import { VoiceEngine } from '../../src/engine/voice-engine.js';

describe('VoiceEngine', () => {
  test('dispatches queued note events at their target frames', () => {
    const engine = new VoiceEngine({ maxVoices: 8 });
    engine.enqueue({ frame: 4, type: 'note-on', note: 60, velocity: 0.75 });
    engine.enqueue({ frame: 12, type: 'note-off', note: 60 });

    const first = engine.processRange(0, 8);
    expect(first.dispatched.map(e => e.type)).toEqual(['note-on']);
    expect(engine.voices()[0].gate).toBe(true);

    const second = engine.processRange(8, 16);
    expect(second.dispatched.map(e => e.type)).toEqual(['note-off']);
    expect(engine.voices()[0].gate).toBe(false);
  });

  test('applies sustain, pitch bend, and panic events', () => {
    const engine = new VoiceEngine({ maxVoices: 8 });
    engine.enqueue({ frame: 0, type: 'note-on', note: 60, velocity: 1 });
    engine.enqueue({ frame: 1, type: 'sustain', down: true });
    engine.enqueue({ frame: 2, type: 'note-off', note: 60 });
    engine.enqueue({ frame: 3, type: 'pitch-bend', semitones: 1.5 });
    engine.processRange(0, 4);

    expect(engine.voices()[0].gate).toBe(true);
    expect(engine.pitchBendSemitones).toBe(1.5);

    engine.enqueue({ frame: 4, type: 'panic' });
    engine.processRange(4, 5);
    expect(engine.voices()).toEqual([]);
    expect(engine.pitchBendSemitones).toBe(0);
  });

  test('exposes pitch in semitone domain including bend', () => {
    const engine = new VoiceEngine();
    engine.enqueue({ frame: 0, type: 'note-on', note: 69, velocity: 1 });
    engine.enqueue({ frame: 1, type: 'pitch-bend', semitones: 2 });
    engine.processRange(0, 2);
    expect(engine.voiceSignals()[0]).toMatchObject({ pitch: 71, gate: 1, velocity: 1 });
  });
});
