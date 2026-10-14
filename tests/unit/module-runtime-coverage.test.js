import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { AVAILABLE_MODULE_DEFINITIONS } from '../../src/modules/available-definitions.js';

describe('module runtime coverage', () => {
  const worklet = readFileSync(new URL('../../src/engine/worklet-processor.js', import.meta.url), 'utf8');
  test.each(AVAILABLE_MODULE_DEFINITIONS.filter(d => !d.typeId.startsWith('system.')).map(d => d.typeId))('%s is handled by the worklet runtime', typeId => {
    expect(worklet).toContain(`'${typeId}'`);
  });
});
