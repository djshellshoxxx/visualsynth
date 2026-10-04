import { describe, expect, test } from 'vitest';
import { ComputerKeyboardInput, shouldIgnoreKeyboardTarget } from '../../src/input/computer-keyboard.js';

class FakeTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) { for (const handler of this.listeners.get(type) ?? []) handler({ type, preventDefault() {}, ...event }); }
}

describe('ComputerKeyboardInput', () => {
  test('ignores editable targets and modifier shortcuts', () => {
    expect(shouldIgnoreKeyboardTarget({ tagName: 'INPUT' })).toBe(true);
    expect(shouldIgnoreKeyboardTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(shouldIgnoreKeyboardTarget({ isContentEditable: true })).toBe(true);
    expect(shouldIgnoreKeyboardTarget({ tagName: 'DIV' })).toBe(false);
  });

  test('emits normalized notes and suppresses repeated keydown', () => {
    const target = new FakeTarget();
    const events = [];
    const input = new ComputerKeyboardInput({ onEvent: event => events.push(event), frameProvider: () => 123 });
    input.attach(target);
    target.dispatch('keydown', { code: 'KeyA', target: { tagName: 'DIV' } });
    target.dispatch('keydown', { code: 'KeyA', repeat: true, target: { tagName: 'DIV' } });
    target.dispatch('keyup', { code: 'KeyA', target: { tagName: 'DIV' } });
    expect(events).toEqual([
      { type: 'note-on', note: 60, velocity: 0.8, frame: 123, source: 'computer-keyboard' },
      { type: 'note-off', note: 60, frame: 123, source: 'computer-keyboard' }
    ]);
  });

  test('uses Z/X octave shortcuts and releases held notes on blur', () => {
    const target = new FakeTarget();
    const events = [];
    const input = new ComputerKeyboardInput({ onEvent: event => events.push(event), frameProvider: () => 5 });
    input.attach(target);
    target.dispatch('keydown', { code: 'KeyX', target: { tagName: 'DIV' } });
    target.dispatch('keydown', { code: 'KeyA', target: { tagName: 'DIV' } });
    target.dispatch('blur');
    expect(events[0].note).toBe(72);
    expect(events[1]).toMatchObject({ type: 'note-off', note: 72 });
  });

  test('does not consume typing or modifier shortcuts', () => {
    const target = new FakeTarget();
    const events = [];
    const input = new ComputerKeyboardInput({ onEvent: event => events.push(event) });
    input.attach(target);
    target.dispatch('keydown', { code: 'KeyA', target: { tagName: 'INPUT' } });
    target.dispatch('keydown', { code: 'KeyA', ctrlKey: true, target: { tagName: 'DIV' } });
    expect(events).toEqual([]);
  });
});
