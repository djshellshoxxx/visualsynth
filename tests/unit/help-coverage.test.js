import { describe, expect, test } from 'vitest';
import { AVAILABLE_MODULE_DEFINITIONS } from '../../src/modules/available-definitions.js';
import { hasModuleHelp, moduleHelp } from '../../src/help/guidance.js';

describe('help coverage', () => {
  test.each(AVAILABLE_MODULE_DEFINITIONS.filter(d => !d.typeId.startsWith('system.')).map(d => d.typeId))('%s has a help entry', typeId => {
    expect(hasModuleHelp(typeId)).toBe(true);
    expect(moduleHelp(typeId).length).toBeGreaterThan(20);
  });
});
