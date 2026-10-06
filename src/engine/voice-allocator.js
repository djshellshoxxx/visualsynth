const cloneVoice = voice => ({ ...voice });

export class VoiceAllocator {
  constructor({ maxVoices = 8, mode = 'poly', legato = false } = {}) {
    this.maxVoices = Math.max(1, Math.floor(maxVoices));
    this.mode = mode;
    this.legato = legato;
    this.voices = [];
    this.heldNotes = [];
    this.sustain = false;
    this.pitchBendSemitones = 0;
    this.nextVoiceId = 1;
  }

  activeVoices() {
    return this.voices.map(cloneVoice);
  }

  noteOn(note, velocity = 1, frame = 0) {
    if (this.mode === 'mono') return this.#monoNoteOn(note, velocity, frame);

    const existingIndex = this.voices.findIndex(v => v.note === note && v.gate);
    if (existingIndex >= 0) this.voices[existingIndex].gate = false;

    let stolenNote = null;
    let voice;
    if (this.voices.length >= this.maxVoices) {
      const candidates = [...this.voices].sort((a, b) => {
        if (a.gate !== b.gate) return a.gate ? 1 : -1;
        const energyA = Math.abs(Number.isFinite(a.energy) ? a.energy : a.velocity ?? 0);
        const energyB = Math.abs(Number.isFinite(b.energy) ? b.energy : b.velocity ?? 0);
        if (Math.abs(energyA - energyB) > 0.05) return energyA - energyB;
        return a.startedFrame - b.startedFrame;
      });
      const victim = candidates[0];
      stolenNote = victim.note;
      voice = victim;
      Object.assign(voice, this.#voiceState(voice.voiceId, note, velocity, frame));
    } else {
      voice = this.#voiceState(this.nextVoiceId++, note, velocity, frame);
      this.voices.push(voice);
    }

    this.#hold(note, velocity, frame);
    return { ...cloneVoice(voice), stolenNote, retrigger: true };
  }

  noteOff(note, frame = 0) {
    this.heldNotes = this.heldNotes.filter(item => item.note !== note);

    if (this.mode === 'mono') return this.#monoNoteOff(note, frame);
    const voice = this.voices.find(v => v.note === note && v.gate);
    if (!voice) return null;
    voice.releasedFrame = frame;
    if (this.sustain) {
      voice.sustained = true;
    } else {
      voice.gate = false;
    }
    return cloneVoice(voice);
  }

  setSustain(enabled, frame = 0) {
    this.sustain = Boolean(enabled);
    if (!this.sustain) {
      const held = new Set(this.heldNotes.map(item => item.note));
      for (const voice of this.voices) {
        if (voice.sustained && !held.has(voice.note)) {
          voice.sustained = false;
          voice.gate = false;
          voice.releasedFrame = frame;
        }
      }
    }
  }

  setPitchBend(semitones = 0) {
    this.pitchBendSemitones = Number.isFinite(semitones) ? semitones : 0;
    return this.pitchBendSemitones;
  }

  panic(frame = 0) {
    for (const voice of this.voices) {
      voice.gate = false;
      voice.sustained = false;
      voice.releasedFrame = frame;
    }
    this.voices = [];
    this.heldNotes = [];
    this.sustain = false;
    this.pitchBendSemitones = 0;
  }

  #voiceState(voiceId, note, velocity, frame) {
    return {
      voiceId,
      note,
      velocity: Math.min(1, Math.max(0, Number.isFinite(velocity) ? velocity : 0)),
      energy: Math.min(1, Math.max(0, Number.isFinite(velocity) ? velocity : 0)),
      gate: true,
      sustained: false,
      startedFrame: frame,
      releasedFrame: null
    };
  }

  #hold(note, velocity, frame) {
    this.heldNotes = this.heldNotes.filter(item => item.note !== note);
    this.heldNotes.push({ note, velocity, frame });
  }

  #monoNoteOn(note, velocity, frame) {
    this.#hold(note, velocity, frame);
    const current = this.voices[0];
    if (!current) {
      const voice = this.#voiceState(this.nextVoiceId++, note, velocity, frame);
      this.voices = [voice];
      return { ...cloneVoice(voice), stolenNote: null, retrigger: true };
    }

    const retrigger = !this.legato || !current.gate;
    current.note = note;
    current.velocity = Math.min(1, Math.max(0, velocity));
    current.gate = true;
    current.sustained = false;
    if (retrigger) current.startedFrame = frame;
    current.releasedFrame = null;
    return { ...cloneVoice(current), stolenNote: null, retrigger };
  }

  #monoNoteOff(note, frame) {
    const current = this.voices[0];
    if (!current) return null;
    if (current.note !== note) return cloneVoice(current);

    const previous = this.heldNotes[this.heldNotes.length - 1];
    if (previous) {
      current.note = previous.note;
      current.velocity = previous.velocity;
      current.gate = true;
      current.sustained = false;
      current.releasedFrame = null;
      return cloneVoice(current);
    }

    if (this.sustain) {
      current.sustained = true;
    } else {
      current.gate = false;
    }
    current.releasedFrame = frame;
    return cloneVoice(current);
  }
}
