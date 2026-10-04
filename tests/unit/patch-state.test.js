import { describe, expect, test } from 'vitest';
import { createPatchState, reducePatch } from '../../src/state/patch-state.js';
import { Actions } from '../../src/state/actions.js';

const oscillator = {
  id: 'osc-1',
  type: 'core.oscillator',
  moduleVersion: 1,
  scope: 'voice',
  position: { x: 100, y: 120 },
  collapsed: false,
  enabled: true,
  parameters: { amplitude: 0.25 }
};

describe('patch state reducer', () => {
  test('adds, moves, edits, duplicates and removes modules without mutating prior state', () => {
    const initial = createPatchState();
    const added = reducePatch(initial, Actions.addModule(oscillator));
    const moved = reducePatch(added, Actions.moveModule('osc-1', { x: 200, y: 240 }));
    const edited = reducePatch(moved, Actions.setParameter('osc-1', 'amplitude', 0.8));
    const duplicated = reducePatch(edited, Actions.duplicateModule('osc-1', 'osc-2', { x: 240, y: 280 }));
    const removed = reducePatch(duplicated, Actions.removeModule('osc-1'));

    expect(initial.modules).toEqual({});
    expect(added.modules['osc-1'].position).toEqual({ x: 100, y: 120 });
    expect(moved.modules['osc-1'].position).toEqual({ x: 200, y: 240 });
    expect(edited.modules['osc-1'].parameters.amplitude).toBe(0.8);
    expect(duplicated.modules['osc-2'].id).toBe('osc-2');
    expect(removed.modules['osc-1']).toBeUndefined();
    expect(removed.modules['osc-2']).toBeDefined();
  });

  test('adds and removes connections and removes attached connections with a module', () => {
    let state = createPatchState();
    state = reducePatch(state, Actions.addModule(oscillator));
    state = reducePatch(state, Actions.addModule({ ...oscillator, id: 'vca-1', type: 'core.vca' }));
    state = reducePatch(state, Actions.addConnection({
      id: 'c-1',
      from: { moduleId: 'osc-1', portId: 'audioOut' },
      to: { moduleId: 'vca-1', portId: 'audioIn' }
    }));

    expect(state.connections).toHaveLength(1);
    const withoutOsc = reducePatch(state, Actions.removeModule('osc-1'));
    expect(withoutOsc.connections).toEqual([]);
  });

  test('rejects duplicate module and connection ids', () => {
    let state = reducePatch(createPatchState(), Actions.addModule(oscillator));
    expect(() => reducePatch(state, Actions.addModule(oscillator))).toThrow(/already exists/i);

    state = reducePatch(state, Actions.addModule({ ...oscillator, id: 'vca-1' }));
    const connection = { id: 'c-1', from: { moduleId: 'osc-1', portId: 'audioOut' }, to: { moduleId: 'vca-1', portId: 'audioIn' } };
    state = reducePatch(state, Actions.addConnection(connection));
    expect(() => reducePatch(state, Actions.addConnection(connection))).toThrow(/already exists/i);
  });
});
