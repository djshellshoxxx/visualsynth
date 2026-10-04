export class FrameEventQueue {
  constructor() {
    this.events = [];
    this.sequence = 0;
  }

  get size() {
    return this.events.length;
  }

  push(event) {
    if (!event || !Number.isFinite(event.frame)) throw new Error('Event requires a finite frame');
    this.events.push({ ...event, __sequence: this.sequence++ });
    this.events.sort((a, b) => (a.frame - b.frame) || (a.__sequence - b.__sequence));
  }

  takeRange(startFrame, endFrame) {
    const taken = [];
    const future = [];

    for (const event of this.events) {
      if (event.frame < endFrame) {
        const frame = event.frame < startFrame ? startFrame : event.frame;
        const { __sequence, ...publicEvent } = event;
        taken.push({ ...publicEvent, frame });
      } else {
        future.push(event);
      }
    }

    this.events = future;
    return taken;
  }

  clear() {
    this.events = [];
  }
}
