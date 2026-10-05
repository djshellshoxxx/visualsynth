import { parsePatch, serializePatch } from './patch-schema.js';

const DEFAULT_PREFIX = 'visualsynth.patch.';

function requireId(id) {
  if (typeof id !== 'string' || !id.trim()) throw new Error('Patch id must be a non-empty string');
  if (!/^[A-Za-z0-9._-]+$/.test(id)) throw new Error('Patch id contains unsupported characters');
  return id;
}

export class PatchStore {
  constructor({ storage = globalThis.localStorage, prefix = DEFAULT_PREFIX } = {}) {
    if (!storage) throw new Error('Patch storage is unavailable');
    this.storage = storage;
    this.prefix = prefix;
  }

  key(id) {
    return `${this.prefix}${requireId(id)}`;
  }

  save(id, patch) {
    const key = this.key(id);
    const serialized = serializePatch(patch);
    this.storage.setItem(key, serialized);
    return structuredClone(patch);
  }

  load(id) {
    const serialized = this.storage.getItem(this.key(id));
    return serialized == null ? null : parsePatch(serialized);
  }

  delete(id) {
    this.storage.removeItem(this.key(id));
  }

  list() {
    const items = [];
    for (let index = 0; index < this.storage.length; index += 1) {
      const key = this.storage.key(index);
      if (!key?.startsWith(this.prefix)) continue;
      const id = key.slice(this.prefix.length);
      if (!id) continue;
      try {
        const serialized = this.storage.getItem(key);
        if (serialized == null) continue;
        const patch = parsePatch(serialized);
        items.push({ id, name: patch.name ?? 'Untitled Patch' });
      } catch {
        // Corrupt entries remain untouched but are not offered as loadable patches.
      }
    }
    return items.sort((a, b) => a.id.localeCompare(b.id));
  }
}
