import { describe, expect, test } from 'vitest';
import { PatchStore } from '../../src/persistence/patch-store.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const patch = {
  formatVersion: 1,
  name: 'Stored Patch',
  settings: {},
  modules: {},
  connections: []
};

describe('PatchStore', () => {
  test('saves, lists, loads and deletes named patches', () => {
    const store = new PatchStore({ storage: new MemoryStorage(), prefix: 'test.patch.' });
    store.save('alpha', patch);

    expect(store.list()).toEqual([{ id: 'alpha', name: 'Stored Patch' }]);
    expect(store.load('alpha')).toEqual(patch);

    store.delete('alpha');
    expect(store.list()).toEqual([]);
    expect(store.load('alpha')).toBeNull();
  });

  test('rejects unsafe empty patch ids', () => {
    const store = new PatchStore({ storage: new MemoryStorage() });
    expect(() => store.save('', patch)).toThrow(/id/i);
  });
});
