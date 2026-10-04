import { describe, expect, test } from 'vitest';
import { Actions } from '../../src/state/actions.js';
import { HistoryController } from '../../src/state/history.js';
import { createPatchState } from '../../src/state/patch-state.js';

const module = {
  id: 'osc-1',
  type: 'core.oscillator',
  moduleVersion: 1,
  scope: 'voice',
  position: { x: 0, y: 0 },
  parameters: { amplitude: 0.25 }
};

describe('HistoryController', () => {
  test('undoes and redoes atomic patch actions', () => {
    const history = new HistoryController(createPatchState());
    history.apply(Actions.addModule(module));
    history.apply(Actions.moveModule('osc-1', { x: 100, y: 50 }));

    expect(history.state.modules['osc-1'].position).toEqual({ x: 100, y: 50 });
    history.undo();
    expect(history.state.modules['osc-1'].position).toEqual({ x: 0, y: 0 });
    history.redo();
    expect(history.state.modules['osc-1'].position).toEqual({ x: 100, y: 50 });
  });

  test('coalesces continuous parameter edits that share a history group', () => {
    const history = new HistoryController(createPatchState());
    history.apply(Actions.addModule(module));
    history.apply(Actions.setParameter('osc-1', 'amplitude', 0.4, { historyGroup: 'amp-drag' }));
    history.apply(Actions.setParameter('osc-1', 'amplitude', 0.6, { historyGroup: 'amp-drag' }));
    history.apply(Actions.setParameter('osc-1', 'amplitude', 0.9, { historyGroup: 'amp-drag' }));

    expect(history.state.modules['osc-1'].parameters.amplitude).toBe(0.9);
    history.undo();
    expect(history.state.modules['osc-1'].parameters.amplitude).toBe(0.25);
  });

  test('new edits after undo clear the redo branch', () => {
    const history = new HistoryController(createPatchState());
    history.apply(Actions.addModule(module));
    history.apply(Actions.moveModule('osc-1', { x: 10, y: 10 }));
    history.undo();
    history.apply(Actions.moveModule('osc-1', { x: 20, y: 20 }));

    expect(history.redo()).toBe(false);
    expect(history.state.modules['osc-1'].position).toEqual({ x: 20, y: 20 });
  });

  test('replace patch creates a single history boundary suitable for preset loads', () => {
    const history = new HistoryController(createPatchState());
    history.apply(Actions.addModule(module));
    const preset = createPatchState({ name: 'Preset A' });
    history.apply(Actions.replacePatch(preset));

    expect(history.state.name).toBe('Preset A');
    history.undo();
    expect(history.state.modules['osc-1']).toBeDefined();
  });
});
