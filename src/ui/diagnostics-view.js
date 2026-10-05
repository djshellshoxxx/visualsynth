function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}

function safeEnvironment(environment = {}) {
  return {
    userAgent: String(environment.userAgent ?? ''),
    platform: String(environment.platform ?? ''),
    language: String(environment.language ?? '')
  };
}

function safeMidiDevices(devices = []) {
  return devices.map(device => ({
    name: String(device?.name ?? 'Unknown MIDI device'),
    manufacturer: String(device?.manufacturer ?? ''),
    state: String(device?.state ?? 'unknown')
  }));
}

export function collectDiagnostics({ engine = {}, patch = {}, visualization = {}, midiDevices = [], recentEvents = [], environment = {} } = {}) {
  const telemetry = engine.telemetry ?? {};
  const processor = engine.processor?.diagnostics ?? engine.processor ?? {};
  const modules = patch.modules && typeof patch.modules === 'object' ? Object.keys(patch.modules).length : 0;
  const connections = Array.isArray(patch.connections) ? patch.connections.length : 0;
  const revision = Number.isInteger(engine.revision) ? engine.revision : 0;

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    environment: safeEnvironment(environment),
    audio: {
      started: Boolean(engine.started),
      contextState: String(engine.contextState ?? 'uninitialized'),
      sampleRate: finiteOrNull(engine.sampleRate),
      baseLatency: finiteOrNull(engine.baseLatency),
      outputLatency: finiteOrNull(engine.outputLatency),
      peak: finiteOrNull(telemetry.peak) ?? 0,
      activeVoices: Number.isInteger(telemetry.activeVoices) ? telemetry.activeVoices : (Number.isInteger(processor.activeVoices) ? processor.activeVoices : 0),
      currentFrame: Number.isFinite(processor.currentFrame) ? processor.currentFrame : null
    },
    patch: { modules, connections, revision },
    visualization: {
      registered: Number.isInteger(visualization.registered) ? visualization.registered : (Number.isInteger(visualization.registeredViews) ? visualization.registeredViews : 0),
      visible: Number.isInteger(visualization.visible) ? visualization.visible : (Array.isArray(visualization.views) ? visualization.views.filter(view => view.visible).length : 0),
      pressure: String(visualization.pressure ?? ((visualization.degradedFrames ?? 0) > 0 ? 'degraded' : 'normal')),
      targetFps: Number.isFinite(visualization.targetFps) ? visualization.targetFps : null,
      degradedFrames: Number.isInteger(visualization.degradedFrames) ? visualization.degradedFrames : 0
    },
    midi: { devices: safeMidiDevices(midiDevices) },
    events: Array.isArray(recentEvents) ? recentEvents.slice(-20).map(event => ({
      type: String(event?.type ?? 'event'),
      detail: String(event?.detail ?? '')
    })) : []
  };
}

function row(label, id) {
  const wrapper = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  if (id) dd.id = id;
  wrapper.append(dt, dd);
  return { wrapper, value: dd };
}

export class DiagnosticsView {
  constructor({ root, toggle, getDocument }) {
    if (!root) throw new Error('Diagnostics root is required');
    if (typeof getDocument !== 'function') throw new Error('Diagnostics document provider is required');
    this.root = root;
    this.toggle = toggle ?? null;
    this.getDocument = getDocument;
    this.document = null;
    this.#build();
    this.toggle?.addEventListener('click', () => this.setOpen(this.root.hidden));
  }

  #build() {
    this.root.classList.add('diagnostics-panel');
    this.root.setAttribute('aria-label', 'Diagnostics and performance');

    const header = document.createElement('div');
    header.className = 'diagnostics-header';
    const title = document.createElement('strong');
    title.textContent = 'Diagnostics';
    const actions = document.createElement('div');

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.textContent = 'Refresh';
    refresh.setAttribute('aria-label', 'Refresh runtime information');
    refresh.addEventListener('click', () => this.refresh());

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = 'Copy JSON';
    copy.setAttribute('aria-label', 'Copy runtime JSON');
    copy.addEventListener('click', () => void this.copy());

    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = 'Download JSON';
    download.setAttribute('aria-label', 'Download runtime JSON');
    download.addEventListener('click', () => this.download());
    actions.append(refresh, copy, download);
    header.append(title, actions);

    const stats = document.createElement('dl');
    stats.className = 'diagnostics-stats';
    this.fields = {};
    for (const [key, label, id] of [
      ['audio', 'Audio', 'diagnostics-audio'],
      ['sampleRate', 'Sample rate', 'diagnostics-sample-rate'],
      ['voices', 'Active voices', 'diagnostics-voices'],
      ['modules', 'Modules', 'diagnostics-modules'],
      ['connections', 'Connections', 'diagnostics-connections'],
      ['visuals', 'Visualization', 'diagnostics-visualization']
    ]) {
      const item = row(label, id);
      this.fields[key] = item.value;
      stats.append(item.wrapper);
    }

    const privacy = document.createElement('p');
    privacy.id = 'diagnostics-privacy';
    privacy.textContent = 'No private files, patch contents, storage values, URLs, or MIDI device IDs are included.';

    const pre = document.createElement('pre');
    pre.className = 'diagnostics-json';
    pre.setAttribute('aria-label', 'Diagnostics JSON preview');
    this.preview = pre;

    this.root.replaceChildren(header, stats, privacy, pre);
    this.refresh();
  }

  setOpen(open) {
    this.root.hidden = !open;
    this.toggle?.setAttribute('aria-expanded', String(Boolean(open)));
    if (open) this.refresh();
  }

  refresh() {
    this.document = this.getDocument();
    const diagnostics = this.document;
    this.fields.audio.textContent = diagnostics.audio.started ? diagnostics.audio.contextState : 'not started';
    this.fields.sampleRate.textContent = diagnostics.audio.sampleRate ? `${diagnostics.audio.sampleRate} Hz` : 'n/a';
    this.fields.voices.textContent = String(diagnostics.audio.activeVoices);
    this.fields.modules.textContent = String(diagnostics.patch.modules);
    this.fields.connections.textContent = String(diagnostics.patch.connections);
    this.fields.visuals.textContent = `${diagnostics.visualization.pressure} · ${diagnostics.visualization.registered} views`;
    this.preview.textContent = JSON.stringify(diagnostics, null, 2);
    return diagnostics;
  }

  async copy() {
    const text = JSON.stringify(this.refresh(), null, 2);
    if (globalThis.navigator?.clipboard?.writeText) await globalThis.navigator.clipboard.writeText(text);
    return text;
  }

  download() {
    const text = JSON.stringify(this.refresh(), null, 2);
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') return text;
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'visualsynth-diagnostics.json';
    anchor.click();
    URL.revokeObjectURL(url);
    return text;
  }
}
