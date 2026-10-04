const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11, 12];

export class KeyboardView {
  constructor({ root, baseNote = 60, onEvent = () => {}, frameProvider = () => 0 } = {}) {
    if (!root) throw new Error('Keyboard root is required');
    this.root = root;
    this.baseNote = baseNote;
    this.octaveOffset = 0;
    this.onEvent = onEvent;
    this.frameProvider = frameProvider;
    this.activePointers = new Map();
    this.render();
  }

  #emit(type, note, velocity = 0.85) {
    this.onEvent({ type, note, velocity, frame: this.frameProvider(), source: 'on-screen-keyboard' });
  }

  shiftOctave(delta) {
    this.octaveOffset = Math.max(-3, Math.min(3, this.octaveOffset + delta));
    this.releaseAll();
    this.render();
  }

  releaseAll() {
    for (const note of new Set(this.activePointers.values())) this.#emit('note-off', note, 0);
    this.activePointers.clear();
  }

  render() {
    this.root.replaceChildren();
    const controls = document.createElement('div');
    controls.className = 'keyboard-controls';
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '− Oct';
    down.setAttribute('aria-label', 'Keyboard octave down');
    down.addEventListener('click', () => this.shiftOctave(-1));
    const label = document.createElement('span');
    label.className = 'keyboard-octave';
    label.textContent = `C${4 + this.octaveOffset}`;
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '+ Oct';
    up.setAttribute('aria-label', 'Keyboard octave up');
    up.addEventListener('click', () => this.shiftOctave(1));
    controls.append(down, label, up);

    const keys = document.createElement('div');
    keys.className = 'keys playable-keys';
    for (const offset of WHITE_OFFSETS) {
      const note = Math.max(0, Math.min(127, this.baseNote + this.octaveOffset * 12 + offset));
      const key = document.createElement('button');
      key.type = 'button';
      key.className = 'piano-key';
      key.dataset.note = String(note);
      key.setAttribute('aria-label', `Play MIDI note ${note}`);
      key.setAttribute('aria-pressed', 'false');
      key.addEventListener('pointerdown', event => {
        if (event.button !== 0 && event.pointerType !== 'touch') return;
        key.setPointerCapture?.(event.pointerId);
        this.activePointers.set(event.pointerId, note);
        key.setAttribute('aria-pressed', 'true');
        this.#emit('note-on', note);
        event.preventDefault();
      });
      const release = event => {
        const activeNote = this.activePointers.get(event.pointerId);
        if (activeNote === undefined) return;
        this.activePointers.delete(event.pointerId);
        this.#emit('note-off', activeNote, 0);
        key.setAttribute('aria-pressed', 'false');
        event.preventDefault();
      };
      key.addEventListener('pointerup', release);
      key.addEventListener('pointercancel', release);
      key.addEventListener('lostpointercapture', event => {
        if (this.activePointers.has(event.pointerId)) release(event);
      });
      keys.append(key);
    }

    this.root.append(controls, keys);
  }
}
