import { describe, expect, test } from 'vitest';
import { FrameEventQueue } from '../../src/engine/event-queue.js';

describe('FrameEventQueue', () => {
  test('returns events in deterministic frame and insertion order', () => {
    const queue = new FrameEventQueue();
    queue.push({ frame: 20, type: 'note-off', note: 60 });
    queue.push({ frame: 10, type: 'note-on', note: 60 });
    queue.push({ frame: 10, type: 'pitch-bend', value: 1 });

    expect(queue.takeRange(0, 21).map(e => e.type)).toEqual(['note-on', 'pitch-bend', 'note-off']);
    expect(queue.size).toBe(0);
  });

  test('keeps future events queued and excludes end frame', () => {
    const queue = new FrameEventQueue();
    queue.push({ frame: 127, type: 'note-on', note: 64 });
    queue.push({ frame: 128, type: 'note-off', note: 64 });

    expect(queue.takeRange(0, 128)).toHaveLength(1);
    expect(queue.size).toBe(1);
    expect(queue.takeRange(128, 256)[0].type).toBe('note-off');
  });

  test('normalizes late events to the requested current frame', () => {
    const queue = new FrameEventQueue();
    queue.push({ frame: 5, type: 'note-on', note: 60 });
    expect(queue.takeRange(10, 20)[0].frame).toBe(10);
  });

  test('clear removes all pending events', () => {
    const queue = new FrameEventQueue();
    queue.push({ frame: 1, type: 'note-on', note: 60 });
    queue.clear();
    expect(queue.size).toBe(0);
  });
});
