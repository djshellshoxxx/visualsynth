function finiteOr(value, fallback = null) {
  return Number.isFinite(value) ? value : fallback;
}

function safeMidiDevice(device = {}) {
  return {
    name: String(device.name ?? ''),
    manufacturer: String(device.manufacturer ?? ''),
    state: String(device.state ?? 'unknown')
  };
}

export function collectDiagnostics({
  engine = {},
  patch = {},
  visualization = {},
  midiDevices = [],
  recentEvents = [],
  environment = {}
} = {}) {
  const processorDiagnostics = engine.processor?.diagnostics ?? {};
  const revision = Number.isInteger(engine.revision)
    ? engine.revision
    : Number.isInteger(processorDiagnostics.graphRevision)
      ? processorDiagnostics.graphRevision
      : 0;
  const activeVoices = Number.isInteger(engine.telemetry?.activeVoices)
    ? engine.telemetry.activeVoices
    : Number.isInteger(processorDiagnostics.activeVoices)
      ? processorDiagnostics.activeVoices
      : 0;

  return {
    version: 1,
    audio: {
      started: engine.started === true,
      contextState: typeof engine.contextState === 'string' ? engine.contextState : 'uninitialized',
      revision,
      sampleRate: finiteOr(engine.sampleRate),
      baseLatency: finiteOr(engine.baseLatency),
      outputLatency: finiteOr(engine.outputLatency),
      peak: finiteOr(engine.telemetry?.peak, 0),
      activeVoices,
      currentFrame: Number.isInteger(processorDiagnostics.currentFrame) ? processorDiagnostics.currentFrame : 0
    },
    patch: {
      modules: Object.keys(patch.modules ?? {}).length,
      connections: Array.isArray(patch.connections) ? patch.connections.length : 0,
      revision
    },
    visualization: {
      registered: Number.isInteger(visualization.registered) ? visualization.registered : 0,
      visible: Number.isInteger(visualization.visible) ? visualization.visible : 0,
      pressure: typeof visualization.pressure === 'string' ? visualization.pressure : 'unknown',
      targetFps: finiteOr(visualization.targetFps)
    },
    midi: {
      devices: Array.isArray(midiDevices) ? midiDevices.map(safeMidiDevice) : []
    },
    events: Array.isArray(recentEvents)
      ? recentEvents.map(event => ({ type: String(event?.type ?? ''), detail: String(event?.detail ?? '') }))
      : [],
    environment: {
      userAgent: typeof environment.userAgent === 'string' ? environment.userAgent : '',
      platform: typeof environment.platform === 'string' ? environment.platform : '',
      language: typeof environment.language === 'string' ? environment.language : ''
    }
  };
}
