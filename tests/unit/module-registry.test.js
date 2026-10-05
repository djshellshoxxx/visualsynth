import { beforeEach, describe, expect, test } from 'vitest';
import {
  clearModuleRegistry,
  getModuleType,
  listModuleTypes,
  registerModuleType
} from '../../src/graph/registry.js';
import { SignalType, VoiceScope } from '../../src/graph/types.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';

describe('module registry', () => {
  beforeEach(() => clearModuleRegistry());

  test('rejects duplicate module type ids', () => {
    const definition = {
      typeId: 'test.module',
      title: 'Test',
      classification: 'CORE',
      allowedScopes: [VoiceScope.VOICE],
      defaultScope: VoiceScope.VOICE,
      ports: [],
      parameters: []
    };

    registerModuleType(definition);
    expect(() => registerModuleType(definition)).toThrow(/already registered/i);
  });

  test('unknown type lookup throws a useful error', () => {
    expect(() => getModuleType('missing.type')).toThrow(/unknown module type/i);
  });

  test('core definitions expose canonical signal and parameter metadata', () => {
    registerCoreModuleTypes();

    const oscillator = getModuleType('core.oscillator');
    const output = oscillator.ports.find((port) => port.id === 'audioOut');
    const amplitude = oscillator.parameters.find((parameter) => parameter.id === 'amplitude');

    expect(output.signalType).toBe(SignalType.AUDIO);
    expect(output.direction).toBe('output');
    expect(oscillator.defaultScope).toBe(VoiceScope.VOICE);
    expect(oscillator.allowedScopes).toContain(VoiceScope.GLOBAL);
    expect(amplitude).toMatchObject({
      min: 0,
      max: 1,
      defaultValue: 0.25,
      curve: 'linear',
      smoothingMs: 8
    });
  });

  test('registers the initial MVP module set in deterministic order', () => {
    registerCoreModuleTypes();

    expect(listModuleTypes().map((definition) => definition.typeId)).toEqual([
      'core.note-input',
      'core.oscillator',
      'core.mixer',
      'core.filter',
      'core.adsr',
      'core.lfo',
      'core.vca',
      'core.voice-sum',
      'core.master-output'
    ]);
  });

  test('voice sum exposes an explicit voice-audio boundary', () => {
    registerCoreModuleTypes();
    const boundary = getModuleType('core.voice-sum');
    expect(boundary.defaultScope).toBe(VoiceScope.GLOBAL);
    expect(boundary.ports.find(port => port.id === 'audioIn')).toMatchObject({ direction: 'input', signalType: SignalType.AUDIO, voiceBoundary: true });
    expect(boundary.ports.find(port => port.id === 'audioOut')).toMatchObject({ direction: 'output', signalType: SignalType.AUDIO });
  });

  test('registry protects canonical definitions from caller mutation', () => {
    registerCoreModuleTypes();
    const oscillator = getModuleType('core.oscillator');
    expect(Object.isFrozen(oscillator)).toBe(true);
    expect(Object.isFrozen(oscillator.ports)).toBe(true);
    expect(Object.isFrozen(oscillator.parameters)).toBe(true);
  });
});
