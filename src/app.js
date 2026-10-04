import { AudioEngine } from './engine/audio-engine.js';
import { compilePatchGraph } from './graph/compile.js';
import { ComputerKeyboardInput } from './input/computer-keyboard.js';
import { WorkspaceController } from './ui/workspace.js';

export async function bootApp({ engine = new AudioEngine() } = {}) {
  const shell = document.querySelector('.app-shell');
  if (!shell) throw new Error('Application shell not found');

  const startButton = document.querySelector('#audio-start');
  const status = document.querySelector('#audio-status');
  const workspaceRoot = document.querySelector('#workspace');
  const libraryRoot = document.querySelector('#module-library');

  let workspace = null;
  if (workspaceRoot && libraryRoot) {
    workspace = new WorkspaceController({
      root: workspaceRoot,
      library: libraryRoot,
      onPatchChange: patch => {
        if (!engine.diagnostics().started) return;
        try {
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
      try {
        engine.sendNote(event);
      } catch {
        // Ignore input while the audio engine is unavailable/restarting.
      }
    }
  });
  keyboard.attach(globalThis);

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
  return { engine, workspace, keyboard };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootApp(), { once: true });
} else {
  void bootApp();
}
