import { KeyboardNoteMapper } from './keyboard-input.js';

export function shouldIgnoreKeyboardTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = String(target.tagName ?? '').toUpperCase();
  return target.isContentEditable === true || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export class ComputerKeyboardInput {
  constructor({ mapper = new KeyboardNoteMapper(), onEvent = () => {}, frameProvider = () => 0 } = {}) {
    this.mapper = mapper;
    this.onEvent = onEvent;
    this.frameProvider = frameProvider;
    this.target = null;
    this.boundKeyDown = event => this.#onKeyDown(event);
    this.boundKeyUp = event => this.#onKeyUp(event);
    this.boundBlur = () => this.releaseAll();
  }

  attach(target = globalThis) {
    if (!target?.addEventListener) return false;
    if (this.target) this.detach();
    this.target = target;
    target.addEventListener('keydown', this.boundKeyDown);
    target.addEventListener('keyup', this.boundKeyUp);
    target.addEventListener('blur', this.boundBlur);
    return true;
  }

  detach() {
    if (!this.target) return;
    this.target.removeEventListener?.('keydown', this.boundKeyDown);
    this.target.removeEventListener?.('keyup', this.boundKeyUp);
    this.target.removeEventListener?.('blur', this.boundBlur);
    this.releaseAll();
    this.target = null;
  }

  #emit(event) {
    if (!event) return;
    this.onEvent({ ...event, frame: this.frameProvider(), source: 'computer-keyboard' });
  }

  #blocked(event) {
    return Boolean(event?.ctrlKey || event?.metaKey || event?.altKey || shouldIgnoreKeyboardTarget(event?.target));
  }

  #onKeyDown(event) {
    if (this.#blocked(event)) return;
    if (event.code === 'KeyZ') {
      if (!event.repeat) this.mapper.shiftOctave(-1);
      event.preventDefault?.();
      return;
    }
    if (event.code === 'KeyX') {
      if (!event.repeat) this.mapper.shiftOctave(1);
      event.preventDefault?.();
      return;
    }
    if (event.repeat) return;
    const noteEvent = this.mapper.keyDown(event.code);
    if (!noteEvent) return;
    event.preventDefault?.();
    this.#emit(noteEvent);
  }

  #onKeyUp(event) {
    if (shouldIgnoreKeyboardTarget(event?.target)) return;
    const noteEvent = this.mapper.keyUp(event.code);
    if (!noteEvent) return;
    event.preventDefault?.();
    this.#emit(noteEvent);
  }

  releaseAll() {
    for (const event of this.mapper.releaseAll()) this.#emit(event);
  }
}
