import { AudioEngine } from './engine/audio-engine.js';
import { compilePatchGraph } from './graph/compile.js';
import { ComputerKeyboardInput } from './input/computer-keyboard.js';
import { PatchStore } from './persistence/patch-store.js';
import { IndexedPatchLibrary } from './persistence/indexed-patch-library.js';
import { DiagnosticsView, collectDiagnostics } from './ui/diagnostics-view.js';
import { KeyboardView } from './ui/keyboard-view.js';
import { MasterView } from './ui/master-view.js';
import { BetaToolsView } from './ui/beta-tools-view.js';
import { WorkspaceController } from './ui/workspace.js';
import { VisualizationScheduler } from './visual/scheduler.js';
import { DEFAULT_EXAMPLE_ID, EXAMPLE_PATCHES, INIT_EXAMPLE_ID, getExamplePatch } from './presets/example-patches.js';

const SAVED_PATCH_ID = 'saved';

function setGuide(example) {
  const guide = document.querySelector('#wiring-guide strong');
  const description = document.querySelector('#example-description');
  if (guide) guide.textContent = example.title;
  if (description) description.textContent = `${example.explanation} Click Start audio, then play the computer keyboard.`;
}

export async function bootApp({ engine = new AudioEngine() } = {}) {
  const shell = document.querySelector('.app-shell');
  if (!shell) throw new Error('Application shell not found');

  const startButton = document.querySelector('#audio-start');
  const status = document.querySelector('#audio-status');
  const workspaceRoot = document.querySelector('#workspace');
  const libraryRoot = document.querySelector('#module-library');
  const keyboardRoot = document.querySelector('#keyboard');
  const masterRoot = document.querySelector('#master-monitor');
  const exampleSelect = document.querySelector('#example-patch');
  const newButton = document.querySelector('#patch-new');
  const saveButton = document.querySelector('#patch-save');
  const loadButton = document.querySelector('#patch-load');
  const diagnosticsToggle = document.querySelector('#diagnostics-toggle');
  const diagnosticsRoot = document.querySelector('#diagnostics-panel');
  const betaToolsRoot = document.querySelector('#beta-tools');
  const meter = masterRoot?.querySelector('[role="meter"]');
  const meterFill = meter?.querySelector('span');
  const voicesLabel = document.querySelector('#master-voices');
  const peakLabel = document.querySelector('#master-peak');
  const recentEvents = [];
  const recordEvent = (type, detail = '') => {
    recentEvents.push({ type, detail });
    if (recentEvents.length > 20) recentEvents.splice(0, recentEvents.length - 20);
  };

  const starter = getExamplePatch(DEFAULT_EXAMPLE_ID);
  setGuide(starter);

  if (exampleSelect) {
    exampleSelect.replaceChildren();
    for (const example of EXAMPLE_PATCHES) {
      const option = document.createElement('option');
      option.value = example.id;
      option.textContent = example.title;
      option.title = example.explanation;
      exampleSelect.append(option);
    }
    exampleSelect.value = starter.id;
  }

  let workspace = null;
  if (workspaceRoot && libraryRoot) {
    workspace = new WorkspaceController({
      root: workspaceRoot,
      library: libraryRoot,
      initialPatch: starter.patch,
      onPatchChange: (patch, change = { kind: 'topology' }) => {
        if (!engine.diagnostics().started) return;
        try {
          if (change.kind === 'parameter' || change.kind === 'parameter-preview') {
            engine.setParameter(change.moduleId, change.parameterId, change.value);
            return;
          }
          if (change.kind === 'layout') return;
          const revision = engine.applyCompiledGraph(compilePatchGraph(patch));
          recordEvent('graphSwap', `revision ${revision}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          recordEvent('graphError', message);
          workspace?.setStatus(message, 'error');
        }
      }
    });
  }

  const patchStore = new PatchStore();
  const patchLibrary = new IndexedPatchLibrary();

  const loadPreset = (id, statusPrefix = 'Loaded preset') => {
    if (!workspace) return false;
    const example = getExamplePatch(id);
    const loaded = workspace.replacePatch(example.patch, `${statusPrefix}: ${example.title}`);
    if (loaded) {
      if (exampleSelect) exampleSelect.value = example.id;
      setGuide(example);
      recordEvent('preset', example.title);
    }
    return loaded;
  };

  exampleSelect?.addEventListener('change', () => loadPreset(exampleSelect.value));
  newButton?.addEventListener('click', () => loadPreset(INIT_EXAMPLE_ID, 'New patch'));
  saveButton?.addEventListener('click', async () => {
    if (!workspace) return;
    try {
      patchStore.save(SAVED_PATCH_ID, workspace.patch);
      await patchLibrary.save(SAVED_PATCH_ID, workspace.patch);
      recordEvent('save', 'IndexedDB patch saved');
      workspace.setStatus('Saved patch in this browser');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordEvent('saveError', message);
      workspace.setStatus(`Could not save patch: ${message}`, 'error');
    }
  });
  loadButton?.addEventListener('click', async () => {
    if (!workspace) return;
    try {
      const patch = await patchLibrary.load(SAVED_PATCH_ID) ?? patchStore.load(SAVED_PATCH_ID);
      if (!patch) {
        workspace.setStatus('No saved patch found in this browser', 'error');
        return;
      }
      if (workspace.replacePatch(patch, `Loaded saved patch: ${patch.name ?? 'Untitled Patch'}`)) {
        recordEvent('load', patch.name ?? 'saved patch');
        if (exampleSelect) exampleSelect.value = '';
        const guide = document.querySelector('#wiring-guide strong');
        const description = document.querySelector('#example-description');
        if (guide) guide.textContent = patch.name ?? 'Saved patch';
        if (description) description.textContent = 'Saved custom patch loaded. Hover or focus modules, ports, and controls for guidance.';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordEvent('loadError', message);
      workspace.setStatus(`Could not load patch: ${message}`, 'error');
    }
  });

  const currentFrame = () => engine.diagnostics().processor?.diagnostics?.currentFrame ?? 0;
  const sendPerformanceEvent = event => {
    if (!engine.diagnostics().started) return;
    try { engine.sendNote(event); } catch { /* Ignore input while unavailable/restarting. */ }
  };

  const keyboard = new ComputerKeyboardInput({ frameProvider: currentFrame, onEvent: sendPerformanceEvent });
  keyboard.attach(globalThis);
  const keyboardView = keyboardRoot ? new KeyboardView({ root: keyboardRoot, frameProvider: currentFrame, onEvent: sendPerformanceEvent }) : null;
  const masterView = masterRoot ? new MasterView({ root: masterRoot, engine, initialGain: 0.8 }) : null;

  const visualizationScheduler = new VisualizationScheduler();
  visualizationScheduler.register(() => {
    const telemetry = engine.diagnostics().telemetry;
    const peak = Math.max(0, Math.min(1, Number.isFinite(telemetry.peak) ? telemetry.peak : 0));
    const activeVoices = Number.isInteger(telemetry.activeVoices) ? telemetry.activeVoices : 0;
    if (meter) meter.setAttribute('aria-valuenow', String(peak));
    if (meterFill) meterFill.style.height = `${Math.max(2, peak * 100)}%`;
    if (voicesLabel) voicesLabel.textContent = String(activeVoices);
    if (peakLabel) peakLabel.textContent = peak.toFixed(2);
  }, 'high');

  const betaToolsView = betaToolsRoot && workspace ? new BetaToolsView({
    root: betaToolsRoot,
    workspace,
    engine,
    visualizationScheduler,
    recordEvent
  }) : null;

  const diagnosticsView = diagnosticsRoot ? new DiagnosticsView({
    root: diagnosticsRoot,
    toggle: diagnosticsToggle,
    getDocument: () => collectDiagnostics({
      engine: engine.diagnostics(),
      patch: workspace?.patch,
      visualization: visualizationScheduler.diagnostics(),
      recentEvents,
      environment: {
        userAgent: globalThis.navigator?.userAgent ?? '',
        platform: globalThis.navigator?.platform ?? '',
        language: globalThis.navigator?.language ?? ''
      }
    })
  }) : null;

  const visualizationFrame = timestamp => {
    visualizationScheduler.frame(timestamp);
    globalThis.requestAnimationFrame?.(visualizationFrame);
  };
  globalThis.requestAnimationFrame?.(visualizationFrame);

  if (startButton && status) {
    startButton.addEventListener('click', async () => {
      if (startButton.disabled) return;
      startButton.disabled = true;
      startButton.textContent = 'Starting…';
      status.textContent = 'starting';
      try {
        await engine.start();
        if (workspace) engine.applyCompiledGraph(compilePatchGraph(workspace.patch));
        engine.setParameter('__master__', 'gain', masterView?.gain ?? 0.8);
        engine.requestDiagnostics();
        recordEvent('audio', 'started');
        status.textContent = 'running';
        startButton.textContent = 'Audio running';
        shell.dataset.audioState = 'running';
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        recordEvent('audioError', message);
        status.textContent = 'unavailable';
        startButton.textContent = 'Retry audio';
        startButton.disabled = false;
        shell.dataset.audioState = 'error';
        shell.dataset.audioError = message;
      }
    });
  }

  shell.dataset.appState = 'ready';
  shell.visualSynthEngine = engine;
  shell.visualSynthWorkspace = workspace;
  shell.visualSynthPatchStore = patchStore;
  shell.visualSynthPatchLibrary = patchLibrary;
  shell.visualSynthKeyboard = keyboard;
  shell.visualSynthKeyboardView = keyboardView;
  shell.visualSynthMasterView = masterView;
  shell.visualSynthVisualizationScheduler = visualizationScheduler;
  shell.visualSynthDiagnosticsView = diagnosticsView;
  shell.visualSynthBetaToolsView = betaToolsView;
  shell.visualSynthLoadExample = loadPreset;
  shell.visualSynthLoadPreset = loadPreset;
  return { engine, workspace, patchStore, patchLibrary, keyboard, keyboardView, masterView, visualizationScheduler, diagnosticsView, betaToolsView, loadExample: loadPreset, loadPreset };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootApp(), { once: true });
} else {
  void bootApp();
}
