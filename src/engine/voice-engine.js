import { FrameEventQueue } from './event-queue.js';
import { VoiceAllocator } from './voice-allocator.js';

export class VoiceEngine {
  constructor(options = {}) {
    this.queue = new FrameEventQueue();
    this.allocator = new VoiceAllocator(options);
    this.currentFrame = 0;
  }

  get pitchBendSemitones() {
    return this.allocator.pitchBendSemitones;
  }

  enqueue(event) {
    this.queue.push(event);
  }

  voices() {
    return this.allocator.activeVoices();
  }

  voiceSignals() {
    return this.voices().map(voice => ({
      voiceId: voice.voiceId,
      pitch: voice.note + this.pitchBendSemitones,
      gate: voice.gate ? 1 : 0,
      velocity: voice.velocity
    }));
  }

  processRange(startFrame, endFrame) {
    const events = this.queue.takeRange(startFrame, endFrame);
    const dispatched = [];

    for (const event of events) {
      switch (event.type) {
        case 'note-on':
          this.allocator.noteOn(event.note, event.velocity ?? 1, event.frame);
          break;
        case 'note-off':
          this.allocator.noteOff(event.note, event.frame);
          break;
        case 'sustain':
          this.allocator.setSustain(event.down, event.frame);
          break;
        case 'pitch-bend':
          this.allocator.setPitchBend(event.semitones ?? 0);
          break;
        case 'panic':
          this.allocator.panic(event.frame);
          this.queue.clear();
          break;
        default:
          throw new Error(`Unsupported voice event type: ${event.type}`);
      }
      dispatched.push(event);
    }

    this.currentFrame = endFrame;
    return { dispatched, currentFrame: this.currentFrame };
  }
}
