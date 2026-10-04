export async function bootApp() {
  const shell = document.querySelector('.app-shell');
  if (!shell) throw new Error('Application shell not found');
  shell.dataset.appState = 'ready';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootApp(), { once: true });
} else {
  void bootApp();
}
