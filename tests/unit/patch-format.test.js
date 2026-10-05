import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { parsePatch, serializePatch } from '../../src/persistence/patch-schema.js';

function makePatch() {
  return {
    formatVersion: 1,
    name: 'Round Trip',
    settings: { polyphony: 8 },
    modules: {
      osc: {
        id: 'osc',
        type: 'core.oscillator',
        moduleVersion: 1,
        scope: 'voice',
        position: { x: 100, y: 50 },
        parameters: { waveform: 2, amplitude: 0.25 }
      },
      sum: {
        id: 'sum',
        type: 'core.voice-sum',
        moduleVersion: 1,
        scope: 'global',
        position: { x: 350, y: 50 },
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

describe('patch schema', () => {
  beforeEach(() => {
    clearModuleRegistry();
    registerCoreModuleTypes();
  });

  test('serializes deterministically and round-trips editable patch state', () => {
    const patch = makePatch();
    const first = serializePatch(patch);
    const second = serializePatch(patch);

    expect(first).toBe(second);
    expect(JSON.parse(first)).toMatchObject({ format: 'visualsynth-patch', schemaVersion: 1, name: 'Round Trip' });
    expect(parsePatch(first)).toEqual(patch);
  });

  test('rejects invalid top-level format and future schema versions', () => {
    expect(() => parsePatch(JSON.stringify({ format: 'other', schemaVersion: 1 }))).toThrow(/format/i);
    expect(() => parsePatch(JSON.stringify({ format: 'visualsynth-patch', schemaVersion: 99 }))).toThrow(/schema/i);
  });

  test('rejects unknown module types', () => {
    const document = JSON.parse(serializePatch(makePatch()));
    document.modules[0].type = 'future.unknown-module';
    expect(() => parsePatch(JSON.stringify(document))).toThrow(/unknown module type/i);
  });

  test('rejects connections with missing endpoints', () => {
    const document = JSON.parse(serializePatch(makePatch()));
    document.connections[0].destination.moduleId = 'missing';
    expect(() => parsePatch(JSON.stringify(document))).toThrow(/endpoint|module/i);
  });

  test('rejects non-finite numeric values', () => {
    const document = JSON.parse(serializePatch(makePatch()));
    document.modules[0].parameters.amplitude = 'NaN';
    expect(() => parsePatch(JSON.stringify(document))).toThrow(/parameter|number|value/i);
  });
});
