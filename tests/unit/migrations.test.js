import { describe, expect, test } from 'vitest';
import { CURRENT_PATCH_SCHEMA_VERSION, migratePatch } from '../../src/persistence/migrations.js';

function legacyDocument() {
  return {
    format: 'visualsynth-patch',
    schemaVersion: 0,
    name: 'Legacy Patch',
    settings: {},
    modules: {
      osc: {
        id: 'osc',
        type: 'core.oscillator',
        moduleVersion: 1,
        scope: 'voice',
        position: { x: 10, y: 20 },
        parameters: { waveform: 2, amplitude: 0.25 }
      },
      sum: {
        id: 'sum',
        type: 'core.voice-sum',
        moduleVersion: 1,
        scope: 'global',
        position: { x: 300, y: 20 },
        parameters: { gain: 1 }
      }
    },
    connections: [
      {
        id: 'c1',
        from: { moduleId: 'osc', portId: 'audioOut' },
        to: { moduleId: 'sum', portId: 'audioIn' }
      }
    ]
  };
}

describe('patch migrations', () => {
  test('migrates synthetic schema v0 into the canonical current document', () => {
    const migrated = migratePatch(legacyDocument());

    expect(migrated.schemaVersion).toBe(CURRENT_PATCH_SCHEMA_VERSION);
    expect(Array.isArray(migrated.modules)).toBe(true);
    expect(migrated.modules.map(module => module.id)).toEqual(['osc', 'sum']);
    expect(migrated.modules[0].ui).toMatchObject({ x: 10, y: 20 });
    expect(migrated.connections[0]).toMatchObject({
      source: { moduleId: 'osc', portId: 'audioOut' },
      destination: { moduleId: 'sum', portId: 'audioIn' }
    });
  });

  test('migration is pure and does not mutate the input document', () => {
    const legacy = legacyDocument();
    const snapshot = structuredClone(legacy);
    migratePatch(legacy);
    expect(legacy).toEqual(snapshot);
  });

  test('rejects future schema versions rather than guessing', () => {
    expect(() => migratePatch({ format: 'visualsynth-patch', schemaVersion: CURRENT_PATCH_SCHEMA_VERSION + 1 })).toThrow(/newer|schema/i);
  });
});
