import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry, getModuleType } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { BETA_MODULE_DEFINITIONS, registerBetaModuleTypes } from '../../src/modules/beta-definitions.js';

describe('beta module catalogue', () => {
  beforeEach(() => { clearModuleRegistry(); registerCoreModuleTypes(); registerBetaModuleTypes(); });

  test('covers the synthesis, effect, sequencing, probe and performance beta families', () => {
    const ids = BETA_MODULE_DEFINITIONS.map(definition => definition.typeId);
    expect(ids).toEqual(expect.arrayContaining([
      'beta.additive-oscillator','beta.wavetable-oscillator','beta.supersaw','beta.mseg',
      'beta.chorus','beta.phaser','beta.reverb','beta.eq','beta.compressor','beta.stereo-utility',
      'beta.envelope-follower','beta.transport','beta.step-sequencer','beta.gate-sequencer',
      'beta.arpeggiator','beta.euclidean','beta.voice-reduce','beta.macro','beta.xy-pad',
      'beta.scope-probe','beta.control-probe','beta.ring-mod'
    ]));
  });

  test('keeps typed ports and centralized parameter metadata for every module', () => {
    for (const definition of BETA_MODULE_DEFINITIONS) {
      const registered = getModuleType(definition.typeId);
      expect(registered.ports.length).toBeGreaterThan(0);
      for (const parameter of registered.parameters ?? []) {
        expect(parameter).toEqual(expect.objectContaining({
          id: expect.any(String), min: expect.any(Number), max: expect.any(Number), defaultValue: expect.any(Number)
        }));
      }
    }
  });
});
