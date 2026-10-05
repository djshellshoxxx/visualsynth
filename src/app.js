import { AudioEngine } from './engine/audio-engine.js';
import { compilePatchGraph } from './graph/compile.js';
import { ComputerKeyboardInput } from './input/computer-keyboard.js';
import { KeyboardView } from './ui/keyboard-view.js';
import { MasterView } from './ui/master-view.js';
import { WorkspaceController } from './ui/workspace.js';
import { VisualizationScheduler } from './visual/scheduler.js';
import { PatchStore } from './persistence/patch-store.js';
import { DEFAULT_EXAMPLE_ID, EXAMPLE_PATCHES, INIT_EXAMPLE_ID, getExamplePatch } from './presets/example-patches.js';

const SAVED_PATCH_ID = 'saved';
const LEGACY_SAVED_PATCH_KEY = 'visualsynth.savedPatch.v1';

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
  const meter = masterRoot?.querySelector('[role="meter"]');
  const meterFill = meter?.querySelector('span');
  const voicesLabel = document.querySelector('#master-voices');
  const peakLabel = document.querySelector('#master-peak');
  const patchStore = new PatchStore();

  const starter = getExamplePatch(DEFAULT_EXAMPLE_ID);
  setGuide(starter);
  if (exampleSelect) {
    exampleSelect.replaceChildren();
    for (const example of EXAMPLE_PATCHES) {
      const option = document.createElement('option');
      option.value = example.id; option.textContent = example.title; option.title = example.explanation; exampleSelect.append(option);
    }
    exampleSelect.value = starter.id;
  }

  let workspace = null;
  if (workspaceRoot && libraryRoot) {
    workspace = new WorkspaceController({
      root: workspaceRoot, library: libraryRoot, initialPatch: starter.patch,
      onPatchChange: (patch, change = { kind: 'topology' }) => {
        if (!engine.diagnostics().started) return;
        try {
          if (change.kind === 'parameter' || change.kind === 'parameter-preview') { engine.setParameter(change.moduleId, change.parameterId, change.value); return; }
          if (change.kind === 'layout') return;
          engine.applyCompiledGraph(compilePatchGraph(patch));
        } catch (error) { workspace?.setStatus(error instanceof Error ? error.message : String(error), 'error'); }
      }
    });
  }

  const loadPreset = (id, statusPrefix = 'Loaded preset') => {
    if (!workspace) return false;
    const example = getExamplePatch(id);
    const loaded = workspace.replacePatch(example.patch, `${statusPrefix}: ${example.title}`);
    if (loaded) { if (exampleSelect) exampleSelect.value = example.id; setGuide(example); }
    return loaded;
  };
  const showCustomPatchGuide = patch => {
    if (exampleSelect) exampleSelect.value = '';
    const guide = document.querySelector('#wiring-guide strong');
    const description = document.querySelector('#example-description');
    if (guide) guide.textContent = patch.name ?? 'Saved patch';
    if (description) description.textContent = 'Saved custom patch loaded. Hover or focus modules, ports, effects, and controls for guidance.';
  };

  exampleSelect?.addEventListener('change', () => loadPreset(exampleSelect.value));
  newButton?.addEventListener('click', () => loadPreset(INIT_EXAMPLE_ID, 'New patch'));
  saveButton?.addEventListener('click', () => {
    if (!workspace) return;
    try {
      patchStore.save(SAVED_PATCH_ID, workspace.patch);
      workspace.setStatus('Saved versioned patch in this browser');
    } catch (error) { workspace.setStatus(`Could not save patch: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  });
  loadButton?.addEventListener('click', () => {
    if (!workspace) return;
    try {
      let saved = patchStore.load(SAVED_PATCH_ID);
      if (!saved) {
        const legacy = localStorage.getItem(LEGACY_SAVED_PATCH_KEY);
        if (legacy) saved = JSON.parse(legacy);
      }
      if (!saved) { workspace.setStatus('No saved patch found in this browser', 'error'); return; }
      if (workspace.replacePatch(saved, `Loaded saved patch: ${saved.name ?? 'Untitled Patch'}`)) showCustomPatchGuide(saved);
    } catch (error) { workspace.setStatus(`Could not load patch: ${error instanceof Error ? error.message : String(error)}`, 'error'); }
  });

  const currentFrame = () => engine.diagnostics().processor?.diagnostics?.currentFrame ?? 0;
  const sendPerformanceEvent = event => { if (!engine.diagnostics().started) return; try { engine.sendNote(event); } catch { /* Ignore input while unavailable/restarting. */ } };
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
  const visualizationFrame = timestamp => { visualizationScheduler.frame(timestamp); globalThis.requestAnimationFrame?.(visualizationFrame); };
  globalThis.requestAnimationFrame?.(visualizationFrame);

  if (startButton && status) {
    startButton.addEventListener('click', async () => {
      if (startButton.disabled) return;
      startButton.disabled = true; startButton.textContent = 'Starting…'; status.textContent = 'starting';
      try {
        await engine.start(); if (workspace) engine.applyCompiledGraph(compilePatchGraph(workspace.patch)); engine.setParameter('__master__', 'gain', masterView?.gain ?? 0.8);
        status.textContent = 'running'; startButton.textContent = 'Audio running'; shell.dataset.audioState = 'running';
      } catch (error) {
        status.textContent = 'unavailable'; startButton.textContent = 'Retry audio'; startButton.disabled = false; shell.dataset.audioState = 'error'; shell.dataset.audioError = error instanceof Error ? error.message : String(error);
      }
    });
  }

  shell.dataset.appState = 'ready';
  shell.visualSynthEngine = engine; shell.visualSynthWorkspace = workspace; shell.visualSynthKeyboard = keyboard; shell.visualSynthKeyboardView = keyboardView; shell.visualSynthMasterView = masterView; shell.visualSynthVisualizationScheduler = visualizationScheduler; shell.visualSynthLoadExample = loadPreset; shell.visualSynthLoadPreset = loadPreset;
  return { engine, workspace, keyboard, keyboardView, masterView, visualizationScheduler, loadExample: loadPreset, loadPreset };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void bootApp(), { once: true });
else void bootApp();
