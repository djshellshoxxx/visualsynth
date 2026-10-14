import { describe, expect, test } from 'vitest';
import { VoiceAllocator } from '../../src/engine/voice-allocator.js';

describe('VoiceAllocator', () => {
  test('allocates and releases independent polyphonic voices', () => {
    const allocator = new VoiceAllocator({ maxVoices: 4 });
    const a = allocator.noteOn(60, 0.8, 10);
    const b = allocator.noteOn(64, 0.6, 20);

    expect(a.voiceId).not.toBe(b.voiceId);
    expect(allocator.activeVoices()).toHaveLength(2);

    allocator.noteOff(60, 30);
    expect(allocator.activeVoices().find(v => v.note === 60)?.gate).toBe(false);
    expect(allocator.activeVoices().find(v => v.note === 64)?.gate).toBe(true);
  });

  test('steals the oldest active voice when capacity is exhausted', () => {
    const allocator = new VoiceAllocator({ maxVoices: 2 });
    allocator.noteOn(60, 1, 10);
    allocator.noteOn(62, 1, 20);
    const stolen = allocator.noteOn(64, 1, 30);

    expect(stolen.stolenNote).toBe(60);
    expect(allocator.activeVoices().map(v => v.note).sort()).toEqual([62, 64]);
  });

  test('prefers the lower-energy voice before age when all candidates are held', () => {
    const allocator = new VoiceAllocator({ maxVoices: 2 });
    allocator.noteOn(60, 1, 10);
    allocator.noteOn(62, .15, 20);
    const stolen = allocator.noteOn(64, 1, 30);
    expect(stolen.stolenNote).toBe(62);
  });

  test('holds note-off voices while sustain is down and releases them when sustain lifts', () => {
    const allocator = new VoiceAllocator({ maxVoices: 4 });
    allocator.noteOn(60, 1, 0);
    allocator.setSustain(true, 10);
    allocator.noteOff(60, 20);

    expect(allocator.activeVoices()[0].gate).toBe(true);
    expect(allocator.activeVoices()[0].sustained).toBe(true);

    allocator.setSustain(false, 30);
    expect(allocator.activeVoices()[0].gate).toBe(false);
    expect(allocator.activeVoices()[0].sustained).toBe(false);
  });

  test('panic clears all active voice runtime state', () => {
    const allocator = new VoiceAllocator({ maxVoices: 4 });
    allocator.noteOn(60, 1, 0);
    allocator.noteOn(67, 1, 1);
    allocator.setPitchBend(2);
    allocator.panic(5);

    expect(allocator.activeVoices()).toEqual([]);
    expect(allocator.pitchBendSemitones).toBe(0);
  });

  test('mono legato reuses one voice and returns to the previous held note', () => {
    const allocator = new VoiceAllocator({ maxVoices: 8, mode: 'mono', legato: true });
    const first = allocator.noteOn(60, 0.8, 0);
    const second = allocator.noteOn(64, 0.7, 10);

    expect(second.voiceId).toBe(first.voiceId);
    expect(second.retrigger).toBe(false);
    expect(allocator.activeVoices()[0].note).toBe(64);

    allocator.noteOff(64, 20);
    expect(allocator.activeVoices()[0].note).toBe(60);
    expect(allocator.activeVoices()[0].gate).toBe(true);
  });
});
