function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

export function normalizeMidiMessage(data, { pitchBendRange = 2 } = {}) {
  if (!data || data.length < 2) return null;
  const status = data[0];
  const command = status & 0xF0;
  const channel = status & 0x0F;
  const d1 = data[1] ?? 0;
  const d2 = data[2] ?? 0;

  switch (command) {
    case 0x80:
      return { type: 'note-off', note: d1, velocity: clamp01(d2 / 127), channel };
    case 0x90:
      if (d2 === 0) return { type: 'note-off', note: d1, velocity: 0, channel };
      return { type: 'note-on', note: d1, velocity: clamp01(d2 / 127), channel };
    case 0xA0:
      return { type: 'note-aftertouch', note: d1, value: clamp01(d2 / 127), channel };
    case 0xB0:
      if (d1 === 64) return { type: 'sustain', down: d2 >= 64, channel };
      return { type: 'cc', controller: d1, value: clamp01(d2 / 127), channel };
    case 0xD0:
      return { type: 'aftertouch', value: clamp01(d1 / 127), channel };
    case 0xE0: {
      const raw = (d2 << 7) | d1;
      const value = raw === 8192 ? 0 : Math.max(-1, Math.min(1, (raw - 8192) / (raw < 8192 ? 8192 : 8191)));
      return { type: 'pitch-bend', value, semitones: value * pitchBendRange, channel };
    }
    default:
      return null;
  }
}

export class MidiInput {
  constructor({ requestMIDIAccess = globalThis.navigator?.requestMIDIAccess?.bind(globalThis.navigator), onEvent = () => {}, frameProvider = () => 0, pitchBendRange = 2 } = {}) {
    this.requestMIDIAccess = requestMIDIAccess;
    this.onEvent = onEvent;
    this.frameProvider = frameProvider;
    this.pitchBendRange = pitchBendRange;
    this.status = 'idle';
    this.access = null;
    this.boundInputs = new Map();
  }

  #emit(event) {
    if (!event) return;
    this.onEvent({ ...event, frame: this.frameProvider(), source: 'midi' });
  }

  #bindInput(input) {
    if (!input || input.state === 'disconnected') return;
    input.onmidimessage = event => {
      const normalized = normalizeMidiMessage(event.data, { pitchBendRange: this.pitchBendRange });
      this.#emit(normalized);
    };
    this.boundInputs.set(input.id, input);
  }

  #refreshInputs() {
    this.boundInputs.clear();
    const values = this.access?.inputs?.values?.();
    if (!values) return;
    for (const input of values) this.#bindInput(input);
  }

  async connect() {
    if (typeof this.requestMIDIAccess !== 'function') {
      this.status = 'unavailable';
      return { available: false, status: this.status, reason: 'unsupported' };
    }

    this.status = 'requesting';
    try {
      this.access = await this.requestMIDIAccess({ sysex: false });
      this.#refreshInputs();
      this.access.onstatechange = event => {
        const port = event?.port;
        if (!port || port.type !== 'input') return;
        if (port.state === 'disconnected') {
          const input = this.boundInputs.get(port.id);
          if (input) input.onmidimessage = null;
          this.boundInputs.delete(port.id);
          this.#emit({ type: 'panic' });
        } else if (port.state === 'connected') {
          const input = this.access.inputs?.get?.(port.id) ?? port;
          this.#bindInput(input);
        }
      };
      this.status = 'ready';
      return { available: true, status: this.status, devices: this.boundInputs.size };
    } catch (error) {
      this.access = null;
      this.boundInputs.clear();
      this.status = 'unavailable';
      return { available: false, status: this.status, reason: error instanceof Error ? error.message : String(error) };
    }
  }

  disconnect() {
    for (const input of this.boundInputs.values()) input.onmidimessage = null;
    this.boundInputs.clear();
    if (this.access) this.access.onstatechange = null;
    this.access = null;
    this.status = 'idle';
  }
}
