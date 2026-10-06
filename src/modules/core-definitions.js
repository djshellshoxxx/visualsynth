import { registerModuleType } from '../graph/registry.js';
import { PortDirection, SignalType, VoiceScope } from '../graph/types.js';

const input = (id, signalType, extra = {}) => ({ id, direction: PortDirection.INPUT, signalType, ...extra });
const output = (id, signalType, extra = {}) => ({ id, direction: PortDirection.OUTPUT, signalType, ...extra });
const parameter = (id, min, max, defaultValue, extra = {}) => ({ id, min, max, defaultValue, ...extra });
const audioEffectPorts = () => [input('audioIn', SignalType.AUDIO), output('audioOut', SignalType.AUDIO)];

export const CORE_MODULE_DEFINITIONS = Object.freeze([
  {
    typeId: 'system.unknown-placeholder', title: 'Unsupported Module', classification: 'SYSTEM',
    defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL, VoiceScope.EFFECT, VoiceScope.UTILITY].filter(Boolean),
    ports: [], parameters: []
  },
  {
    typeId: 'core.note-input', title: 'Note Input', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL],
    ports: [output('pitchOut', SignalType.PITCH, { polyphonic: true }), output('gateOut', SignalType.GATE, { polyphonic: true }), output('velocityOut', SignalType.CONTROL, { polyphonic: true }), output('eventOut', SignalType.EVENT)],
    parameters: [parameter('maxVoices', 1, 32, 8, { curve: 'integer', smoothingMs: 0, modulatable: false }), parameter('transpose', -48, 48, 0, { unit: 'st', smoothingMs: 5 })]
  },
  {
    typeId: 'core.oscillator', title: 'Oscillator', defaultScope: VoiceScope.VOICE, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL],
    ports: [input('pitchIn', SignalType.PITCH), input('fmIn', SignalType.CONTROL, { optional: true }), input('pmIn', SignalType.CONTROL, { optional: true }), input('resetIn', SignalType.TRIGGER, { optional: true }), output('audioOut', SignalType.AUDIO)],
    parameters: [
      parameter('waveform', 0, 6, 2, { curve: 'choice', smoothingMs: 0, modulatable: false, choices: ['sine', 'triangle', 'saw', 'reverse-saw', 'square', 'pulse', 'sub', 'variable'] }),
      parameter('octave', -4, 4, 0, { curve: 'integer', unit: 'oct', smoothingMs: 0 }), parameter('semitone', -12, 12, 0, { curve: 'integer', unit: 'st', smoothingMs: 0 }),
      parameter('cents', -100, 100, 0, { unit: 'cent', smoothingMs: 8 }), parameter('amplitude', 0, 1, 0.25, { smoothingMs: 8 }), parameter('pulseWidth', 0.02, 0.98, 0.5, { smoothingMs: 8 })
    ]
  },
  {
    typeId: 'core.mixer', title: 'Mixer', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL],
    ports: [input('audioInA', SignalType.AUDIO, { multiple: true }), input('audioInB', SignalType.AUDIO, { multiple: true }), output('audioOut', SignalType.AUDIO)],
    parameters: [parameter('gain', 0, 2, 0.5, { smoothingMs: 8 })]
  },
  {
    typeId: 'core.feedback-delay', title: 'Feedback Delay', classification: 'CORE',
    defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL],
    ports: [input('audioIn', SignalType.AUDIO, { multiple: true }), output('audioOut', SignalType.AUDIO)],
    parameters: [parameter('samples', 1, 4096, 1, { curve: 'integer', smoothingMs: 0, modulatable: false, unit: 'samples' }), parameter('feedback', -0.98, 0.98, 0.35, { smoothingMs: 8 })]
  },
  {
    typeId: 'core.filter', title: 'Multimode Filter', defaultScope: VoiceScope.VOICE, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL],
    ports: [input('audioIn', SignalType.AUDIO), input('cutoffMod', SignalType.CONTROL, { optional: true, multiple: true }), output('audioOut', SignalType.AUDIO)],
    parameters: [
      parameter('mode', 0, 3, 0, { curve: 'choice', choices: ['lowpass', 'highpass', 'bandpass', 'notch'], smoothingMs: 0, modulatable: false }),
      parameter('cutoff', 20, 20000, 12000, { curve: 'log', unit: 'Hz', smoothingMs: 12 }), parameter('resonance', 0, 1, 0.1, { smoothingMs: 12 }), parameter('drive', 0, 8, 0, { smoothingMs: 8 })
    ]
  },
  {
    typeId: 'core.distortion', title: 'Distortion', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL], ports: audioEffectPorts(),
    parameters: [parameter('drive', 1, 20, 3, { smoothingMs: 8 }), parameter('tone', 0, 1, 0.65, { smoothingMs: 8 }), parameter('mix', 0, 1, 0.7, { smoothingMs: 8 })]
  },
  {
    typeId: 'core.delay', title: 'Delay', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL], ports: audioEffectPorts(),
    parameters: [parameter('time', 0.005, 2, 0.25, { curve: 'log', unit: 's', smoothingMs: 8 }), parameter('feedback', 0, 0.92, 0.3, { smoothingMs: 8 }), parameter('damping', 0, 1, 0.25, { smoothingMs: 8 }), parameter('mix', 0, 1, 0.35, { smoothingMs: 8 })]
  },
  {
    typeId: 'core.echo', title: 'Echo', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL], ports: audioEffectPorts(),
    parameters: [parameter('time', 0.02, 2, 0.36, { curve: 'log', unit: 's', smoothingMs: 8 }), parameter('feedback', 0, 0.92, 0.58, { smoothingMs: 8 }), parameter('damping', 0, 1, 0.42, { smoothingMs: 8 }), parameter('mix', 0, 1, 0.42, { smoothingMs: 8 })]
  },
  {
    typeId: 'core.adsr', title: 'ADSR', defaultScope: VoiceScope.VOICE, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL],
    ports: [input('gateIn', SignalType.GATE), input('retriggerIn', SignalType.TRIGGER, { optional: true }), output('controlOut', SignalType.CONTROL)],
    parameters: [parameter('attack', 0.001, 20, 0.01, { curve: 'log', unit: 's', smoothingMs: 0 }), parameter('decay', 0.001, 20, 0.15, { curve: 'log', unit: 's', smoothingMs: 0 }), parameter('sustain', 0, 1, 0.7, { smoothingMs: 8 }), parameter('release', 0.001, 30, 0.25, { curve: 'log', unit: 's', smoothingMs: 0 })]
  },
  {
    typeId: 'core.lfo', title: 'LFO', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL],
    ports: [input('resetIn', SignalType.TRIGGER, { optional: true }), output('controlOut', SignalType.CONTROL)],
    parameters: [parameter('waveform', 0, 7, 0, { curve: 'choice', choices: ['sine','triangle','saw','reverse-saw','square','sample-hold','smooth-random','stepped-random'], smoothingMs: 0, modulatable: false }), parameter('rate', 0.01, 40, 1, { curve: 'log', unit: 'Hz', smoothingMs: 8 }), parameter('amount', 0, 1, 1, { smoothingMs: 8 }), parameter('seed',1,65535,1,{curve:'integer',smoothingMs:0,modulatable:false})]
  },
  { typeId: 'core.vca', title: 'VCA', defaultScope: VoiceScope.VOICE, allowedScopes: [VoiceScope.VOICE, VoiceScope.GLOBAL], ports: [input('audioIn', SignalType.AUDIO), input('gainIn', SignalType.CONTROL), output('audioOut', SignalType.AUDIO)], parameters: [parameter('gain', 0, 2, 1, { smoothingMs: 8 })] },
  { typeId: 'core.voice-sum', title: 'Voice Sum', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL], ports: [input('audioIn', SignalType.AUDIO, { multiple: true, voiceBoundary: true }), output('audioOut', SignalType.AUDIO)], parameters: [parameter('gain', 0, 2, 1, { smoothingMs: 8 })] },
  { typeId: 'core.master-output', title: 'Master Output', defaultScope: VoiceScope.GLOBAL, allowedScopes: [VoiceScope.GLOBAL], ports: [input('audioIn', SignalType.AUDIO, { multiple: true })], parameters: [parameter('gain', 0, 1.5, 0.8, { smoothingMs: 12 })] }
]);

export function registerCoreModuleTypes() { for (const definition of CORE_MODULE_DEFINITIONS) registerModuleType(definition); }
