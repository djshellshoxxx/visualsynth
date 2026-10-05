export function createStarterPatch() {
  return {
    formatVersion: 1,
    name: 'Starter Saw',
    modules: {
      'note-input': {
        id: 'note-input',
        type: 'core.note-input',
        scope: 'global',
        position: { x: 40, y: 60 },
        parameters: { maxVoices: 8, transpose: 0 }
      },
      osc: {
        id: 'osc',
        type: 'core.oscillator',
        scope: 'voice',
        position: { x: 300, y: 60 },
        parameters: { waveform: 2, octave: 0, semitone: 0, cents: 0, amplitude: 0.25, pulseWidth: 0.5 }
      },
      sum: {
        id: 'sum',
        type: 'core.voice-sum',
        scope: 'global',
        position: { x: 560, y: 60 },
        parameters: { gain: 1 }
      },
      master: {
        id: 'master',
        type: 'core.master-output',
        scope: 'global',
        position: { x: 820, y: 60 },
        parameters: { gain: 0.8 }
      }
    },
    connections: [
      {
        id: 'starter-osc-sum',
        from: { moduleId: 'osc', portId: 'audioOut' },
        to: { moduleId: 'sum', portId: 'audioIn' }
      },
      {
        id: 'starter-sum-master',
        from: { moduleId: 'sum', portId: 'audioOut' },
        to: { moduleId: 'master', portId: 'audioIn' }
      }
    ],
    settings: {}
  };
}
