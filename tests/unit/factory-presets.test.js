import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { validatePatchGraph } from '../../src/graph/validate.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { DEFAULT_EXAMPLE_ID, EXAMPLE_PATCHES, getExamplePatch } from '../../src/presets/example-patches.js';
import { createStarterPatch } from '../../src/presets/starter-patch.js';

const EXPECTED_PRESETS = [
  'basic-saw', 'warm-analog', 'sub-bass', 'reese-bass', 'pluck', 'soft-pad', 'acid-bass', 'pulse-lead', 'bright-lead',
  'deep-house-bass', 'detuned-saw', 'chip-lead', 'organ', 'drone', 'filtered-square', 'highpass-lead', 'bandpass-radio',
  'distorted-bass', 'crunch-lead', 'slap-delay-lead', 'dub-echo', 'space-pad', 'industrial-pulse', 'init-patch'
];

describe('factory presets', () => {
  beforeEach(() => {
    clearModuleRegistry();
    registerCoreModuleTypes();
  });

  test('ships the complete quick-setup preset set', () => {
    expect(EXAMPLE_PATCHES.map(preset => preset.id)).toEqual(EXPECTED_PRESETS);
    expect(DEFAULT_EXAMPLE_ID).toBe('basic-saw');
  });

  test.each(EXPECTED_PRESETS)('%s is a valid, immediately playable graph', id => {
    const { patch } = getExamplePatch(id);
    expect(validatePatchGraph(patch)).toEqual({ valid: true, errors: [] });
    const noteInputs = Object.values(patch.modules).filter(module => module.type === 'core.note-input');
    const oscillators = Object.values(patch.modules).filter(module => module.type === 'core.oscillator');
    const masters = Object.values(patch.modules).filter(module => module.type === 'core.master-output');
    expect(noteInputs).toHaveLength(1);
    expect(oscillators.length).toBeGreaterThanOrEqual(1);
    expect(masters).toHaveLength(1);
    for (const oscillator of oscillators) {
      expect(patch.connections).toContainEqual(expect.objectContaining({
        from: { moduleId: noteInputs[0].id, portId: 'pitchOut' },
        to: { moduleId: oscillator.id, portId: 'pitchIn' }
      }));
    }
  });

  test('effect presets use actual effect modules', () => {
    expect(Object.values(getExamplePatch('distorted-bass').patch.modules).some(module => module.type === 'core.distortion')).toBe(true);
    expect(Object.values(getExamplePatch('slap-delay-lead').patch.modules).some(module => module.type === 'core.delay')).toBe(true);
    expect(Object.values(getExamplePatch('dub-echo').patch.modules).some(module => module.type === 'core.echo')).toBe(true);
  });

  test('returns an isolated clone so editing a preset never mutates the factory copy', () => {
    const first = getExamplePatch('warm-analog');
    first.patch.name = 'Edited';
    first.patch.modules.osc.parameters.cents = 99;
    const second = getExamplePatch('warm-analog');
    expect(second.patch.name).toBe('Warm Analog');
    expect(second.patch.modules.osc.parameters.cents).not.toBe(99);
  });

  test('legacy starter helper delegates to the canonical init patch', () => {
    expect(createStarterPatch()).toEqual(getExamplePatch('init-patch').patch);
  });
});
