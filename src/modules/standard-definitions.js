import { registerModuleType } from '../graph/registry.js';
import { PortDirection, SignalType, VoiceScope } from '../graph/types.js';

const input = (id, signalType, extra = {}) => ({ id, direction: PortDirection.INPUT, signalType, ...extra });
const output = (id, signalType, extra = {}) => ({ id, direction: PortDirection.OUTPUT, signalType, ...extra });
const parameter = (id, min, max, defaultValue, extra = {}) => ({ id, min, max, defaultValue, ...extra });

export const STANDARD_MODULE_DEFINITIONS = Object.freeze([
  {
    typeId: 'standard.noise',
    title: 'Noise Generator',
    classification: 'STANDARD',
    description: 'Deterministic white, pink, or brown noise source.',
    defaultScope: VoiceScope.VOICE,
    allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL],
    ports: [
      input('gateIn', SignalType.GATE, { optional: true }),
      input('resetIn', SignalType.TRIGGER, { optional: true }),
      output('audioOut', SignalType.AUDIO)
    ],
    parameters: [
      parameter('type', 0, 3, 0, {
        curve: 'choice',
        smoothingMs: 0,
        modulatable: false,
        choices: ['white', 'pink', 'brown', 'blue']
      }),
      parameter('level', 0, 1, 0.25, { smoothingMs: 8 }),
      parameter('seed', 1, 65535, 1, { curve: 'integer', smoothingMs: 0, modulatable: false })
    ]
  }
]);

export function registerStandardModuleTypes() {
  for (const definition of STANDARD_MODULE_DEFINITIONS) registerModuleType(definition);
}
