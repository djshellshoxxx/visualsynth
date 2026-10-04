import { AudioEngine } from './engine/audio-engine.js';
import { compilePatchGraph } from './graph/compile.js';
import { ComputerKeyboardInput } from './input/computer-keyboard.js';
import { WorkspaceController } from './ui/workspace.js';
import { VisualizationScheduler } from './visual/scheduler.js';

export async function bootApp({ engine = new AudioEngine() } = {}) {
  const shell = document.querySelector('.app-shell');
  if (!shell) throw new Error('Application shell not found');

  const startButton = document.querySelector('#audio-start');
  const status = document.querySelector('#audio-status');
  const workspaceRoot = document.querySelector('#workspace');
  const libraryRoot = document.querySelector('#module-library');
  const meter = document.querySelector('#master-monitor [role="meter"]');
  const meterFill = meter?.querySelector('span');
  const voicesLabel = document.querySelector('#master-voices');
  const peakLabel = document.querySelector('#master-peak');

  let workspace = null;
  if (workspaceRoot && libraryRoot) {
    workspace = new WorkspaceController({
      root: workspaceRoot,
      library: libraryRoot,
      onPatchChange: (patch, change = { kind: 'topology' }) => {
        if (!engine.diagnostics().started) return;
        try {
          if (change.kind === 'parameter' || change.kind === 'parameter-preview') {
            engine.setParameter(change.moduleId, change.parameterId, change.value);
            return;
          }
          if (change.kind === 'layout') return;
          engine.applyCompiledGraph(compilePatchGraph(patch));
        } catch (error) {
          workspace?.setStatus(error instanceof Error ? error.message : String(error), 'error');
        }
      }
    });
  }

  const keyboard = new ComputerKeyboardInput({
    frameProvider: () => engine.diagnostics().processor?.diagnostics?.currentFrame ?? 0,
    onEvent: event => {
      if (!engine.diagnostics().started) return;
      try { engine.sendNote(event); } catch { /* Ignore input while unavailable/restarting. */ }
    }
  });
  keyboard.attach(globalThis);

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
        status.textContent = 'running';
        startButton.textContent = 'Audio running';
        shell.dataset.audioState = 'running';
      } catch (error) {
        status.textContent = 'unavailable';
        startButton.textContent = 'Retry audio';
        startButton.disabled = false;
        shell.dataset.audioState = 'error';
        shell.dataset.audioError = error instanceof Error ? error.message : String(error);
      }
    });
  }

  shell.dataset.appState = 'ready';
  shell.visualSynthEngine = engine;
  shell.visualSynthWorkspace = workspace;
  shell.visualSynthKeyboard = keyboard;
  shell.visualSynthVisualizationScheduler = visualizationScheduler;
  return { engine, workspace, keyboard, visualizationScheduler };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootApp(), { once: true });
} else {
  void bootApp();
}
