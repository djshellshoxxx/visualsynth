import { describe, expect, test } from 'vitest';
import { collectDiagnostics } from '../../src/ui/diagnostics-view.js';

describe('collectDiagnostics', () => {
  test('collects useful runtime and patch information without private data', () => {
    const document = collectDiagnostics({
      engine: {
        started: true,
        contextState: 'running',
        revision: 7,
        sampleRate: 48000,
        baseLatency: 0.01,
        outputLatency: 0.02,
        telemetry: { peak: 0.42, activeVoices: 3 },
        processor: { diagnostics: { currentFrame: 123456, graphRevision: 7, activeVoices: 3 } }
      },
      patch: {
        modules: { a: { id: 'a' }, b: { id: 'b' } },
        connections: [{ id: 'c1' }]
      },
      visualization: { registered: 5, visible: 4, pressure: 'normal', targetFps: 30 },
      midiDevices: [{ id: 'secret-device-id', name: 'Controller', manufacturer: 'Maker', state: 'connected' }],
      recentEvents: [{ type: 'graphSwap', detail: 'revision 7' }],
      environment: { userAgent: 'Test Browser', platform: 'Test OS', language: 'en-CA' }
    });

    expect(document.version).toBe(1);
    expect(document.audio).toMatchObject({ started: true, contextState: 'running', sampleRate: 48000, activeVoices: 3 });
    expect(document.patch).toEqual({ modules: 2, connections: 1, revision: 7 });
    expect(document.visualization).toMatchObject({ registered: 5, visible: 4, pressure: 'normal' });
    expect(document.midi.devices).toEqual([{ name: 'Controller', manufacturer: 'Maker', state: 'connected' }]);
    expect(JSON.stringify(document)).not.toContain('secret-device-id');
  });

  test('is safe before audio starts and with missing optional inputs', () => {
    const document = collectDiagnostics({});
    expect(document.audio.started).toBe(false);
    expect(document.audio.contextState).toBe('uninitialized');
    expect(document.patch).toEqual({ modules: 0, connections: 0, revision: 0 });
    expect(document.midi.devices).toEqual([]);
    expect(document.events).toEqual([]);
  });
});
