export class MasterView {
  constructor({ root, engine, initialGain = 0.8 } = {}) {
    if (!root) throw new Error('Master root is required');
    if (!engine) throw new Error('Audio engine is required');
    this.root = root;
    this.engine = engine;
    this.gain = initialGain;
    this.lastUnmutedGain = initialGain || 0.8;
    this.muted = false;
    this.renderControls();
  }

  #sendGain(value) {
    this.gain = Math.max(0, Math.min(1.5, Number(value) || 0));
    try { this.engine.setParameter('master-output', 'gain', this.gain); } catch { /* no compiled master yet */ }
  }

  renderControls() {
    let controls = this.root.querySelector('.master-controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'master-controls';
      this.root.append(controls);
    }
    controls.replaceChildren();

    const gainLabel = document.createElement('label');
    gainLabel.className = 'master-gain-control';
    const heading = document.createElement('span');
    heading.textContent = 'Master gain';
    const value = document.createElement('output');
    value.id = 'master-gain-value';
    value.textContent = this.gain.toFixed(2);
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1.5';
    slider.step = '0.01';
    slider.value = String(this.gain);
    slider.setAttribute('aria-label', 'Master gain');
    slider.addEventListener('input', () => {
      this.muted = false;
      this.#sendGain(Number(slider.value));
      this.lastUnmutedGain = this.gain || this.lastUnmutedGain;
      value.textContent = this.gain.toFixed(2);
      this.renderControls();
    });
    gainLabel.append(heading, value, slider);

    const mute = document.createElement('button');
    mute.type = 'button';
    mute.textContent = this.muted ? 'Unmute' : 'Mute';
    mute.setAttribute('aria-label', this.muted ? 'Unmute master' : 'Mute master');
    mute.addEventListener('click', () => {
      if (this.muted) {
        this.muted = false;
        this.#sendGain(this.lastUnmutedGain);
      } else {
        this.lastUnmutedGain = this.gain || this.lastUnmutedGain;
        this.muted = true;
        this.#sendGain(0);
      }
      this.renderControls();
    });

    const panic = document.createElement('button');
    panic.type = 'button';
    panic.textContent = 'Panic';
    panic.setAttribute('aria-label', 'Panic all notes off');
    panic.addEventListener('click', () => {
      try { this.engine.panic(); } catch { /* engine may not be started yet */ }
    });

    controls.append(gainLabel, mute, panic);
  }
}
