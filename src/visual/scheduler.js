const DEFAULT_RATES = Object.freeze({ high: 60, normal: 30, low: 10 });
const PRIORITY_ORDER = Object.freeze({ high: 0, normal: 1, low: 2 });

export class VisualizationScheduler {
  constructor({ rates = DEFAULT_RATES, hiddenRate = 1, frameBudgetMs = 6, now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
    this.rates = { ...DEFAULT_RATES, ...rates };
    this.hiddenRate = hiddenRate;
    this.frameBudgetMs = frameBudgetMs;
    this.now = now;
    this.views = new Map();
    this.nextId = 1;
    this.frozen = false;
    this.degradedFrames = 0;
  }

  register(view, priority = 'normal') {
    if (typeof view !== 'function') throw new Error('Visualization view must be a function');
    if (!(priority in PRIORITY_ORDER)) throw new Error(`Unknown visualization priority: ${priority}`);
    const id = this.nextId++;
    this.views.set(id, { view, priority, visible: true, lastTimestamp: -Infinity, updates: 0, skipped: 0 });
    return id;
  }

  unregister(id) {
    return this.views.delete(id);
  }

  setVisibility(id, visible) {
    const record = this.views.get(id);
    if (!record) return false;
    record.visible = Boolean(visible);
    return true;
  }

  setPriority(id, priority) {
    const record = this.views.get(id);
    if (!record || !(priority in PRIORITY_ORDER)) return false;
    record.priority = priority;
    return true;
  }

  freeze(value = true) {
    this.frozen = Boolean(value);
  }

  frame(timestamp, { frameStart = this.now() } = {}) {
    if (this.frozen) return { updated: 0, skipped: this.views.size, degraded: false };
    const records = [...this.views.entries()].sort((a, b) => PRIORITY_ORDER[a[1].priority] - PRIORITY_ORDER[b[1].priority] || a[0] - b[0]);
    let updated = 0;
    let skipped = 0;
    let degraded = false;

    for (const [, record] of records) {
      const rate = record.visible ? this.rates[record.priority] : this.hiddenRate;
      const interval = rate > 0 ? 1000 / rate : Infinity;
      if (timestamp - record.lastTimestamp < interval) {
        record.skipped += 1;
        skipped += 1;
        continue;
      }

      const elapsed = this.now() - frameStart;
      if (record.priority !== 'high' && elapsed > this.frameBudgetMs) {
        record.skipped += 1;
        skipped += 1;
        degraded = true;
        continue;
      }

      record.view(timestamp);
      record.lastTimestamp = timestamp;
      record.updates += 1;
      updated += 1;
    }

    if (degraded) this.degradedFrames += 1;
    return { updated, skipped, degraded };
  }

  diagnostics() {
    return {
      registeredViews: this.views.size,
      frozen: this.frozen,
      degradedFrames: this.degradedFrames,
      views: [...this.views.entries()].map(([id, record]) => ({
        id,
        priority: record.priority,
        visible: record.visible,
        updates: record.updates,
        skipped: record.skipped
      }))
    };
  }
}
