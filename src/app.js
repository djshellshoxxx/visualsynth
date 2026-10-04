import { AudioEngine } from './engine/audio-engine.js';

export async function bootApp({ engine = new AudioEngine() } = {}) {
  const shell = document.querySelector('.app-shell');
  if (!shell) throw new Error('Application shell not found');

  const startButton = document.querySelector('#audio-start');
  const status = document.querySelector('#audio-status');

  if (startButton && status) {
    startButton.addEventListener('click', async () => {
      if (startButton.disabled) return;
      startButton.disabled = true;
      startButton.textContent = 'Starting…';
      status.textContent = 'starting';
      try {
        await engine.start();
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
  return { engine };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootApp(), { once: true });
} else {
  void bootApp();
}
