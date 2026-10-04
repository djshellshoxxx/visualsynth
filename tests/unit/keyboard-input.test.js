import { describe, expect, test } from 'vitest';
import { KeyboardNoteMapper } from '../../src/input/keyboard-input.js';

describe('KeyboardNoteMapper', () => {
  test('maps the standard two-row layout to semitone offsets', () => {
    const mapper = new KeyboardNoteMapper({ baseNote: 60 });
    expect(mapper.noteForCode('KeyA')).toBe(60);
    expect(mapper.noteForCode('KeyW')).toBe(61);
    expect(mapper.noteForCode('KeyS')).toBe(62);
    expect(mapper.noteForCode('KeyK')).toBe(72);
  });

  test('changes octave without changing the configured base mapping', () => {
    const mapper = new KeyboardNoteMapper({ baseNote: 60 });
    mapper.shiftOctave(1);
    expect(mapper.noteForCode('KeyA')).toBe(72);
    mapper.shiftOctave(-2);
    expect(mapper.noteForCode('KeyA')).toBe(48);
  });

  test('suppresses keyboard auto-repeat note-on duplicates', () => {
    const mapper = new KeyboardNoteMapper({ baseNote: 60 });
    expect(mapper.keyDown('KeyA')).toMatchObject({ type: 'note-on', note: 60 });
    expect(mapper.keyDown('KeyA')).toBeNull();
    expect(mapper.keyUp('KeyA')).toMatchObject({ type: 'note-off', note: 60 });
  });

  test('releaseAll emits note-offs for every held mapped key', () => {
    const mapper = new KeyboardNoteMapper({ baseNote: 60 });
    mapper.keyDown('KeyA');
    mapper.keyDown('KeyS');
    expect(mapper.releaseAll().map(e => e.note).sort()).toEqual([60, 62]);
    expect(mapper.releaseAll()).toEqual([]);
  });
});
