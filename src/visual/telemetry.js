export class TelemetryBuffer {
  constructor({ capacity = 120 } = {}) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(structuredClone(item));
    if (this.items.length > this.capacity) this.items.splice(0, this.items.length - this.capacity);
  }

  latest() {
    const item = this.items.at(-1);
    return item === undefined ? null : structuredClone(item);
  }

  toArray() {
    return structuredClone(this.items);
  }

  clear() {
    this.items = [];
  }
}
