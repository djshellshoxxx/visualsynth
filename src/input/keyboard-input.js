const DEFAULT_LAYOUT = Object.freeze({
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17
});

export class KeyboardNoteMapper {
  constructor({ baseNote = 60, velocity = 0.8, layout = DEFAULT_LAYOUT } = {}) {
    this.baseNote = baseNote;
    this.velocity = velocity;
    this.layout = layout;
    this.octaveOffset = 0;
    this.held = new Map();
  }

  noteForCode(code) {
    const offset = this.layout[code];
    if (offset === undefined) return null;
    return Math.min(127, Math.max(0, this.baseNote + this.octaveOffset * 12 + offset));
  }

  shiftOctave(delta) {
    this.octaveOffset = Math.max(-4, Math.min(4, this.octaveOffset + delta));
    return this.octaveOffset;
  }

  keyDown(code) {
    if (this.held.has(code)) return null;
    const note = this.noteForCode(code);
    if (note === null) return null;
    this.held.set(code, note);
    return { type: 'note-on', note, velocity: this.velocity };
  }

  keyUp(code) {
    if (!this.held.has(code)) return null;
    const note = this.held.get(code);
    this.held.delete(code);
    return { type: 'note-off', note };
  }

  releaseAll() {
    const events = [...this.held.values()].map(note => ({ type: 'note-off', note }));
    this.held.clear();
    return events;
  }
}
