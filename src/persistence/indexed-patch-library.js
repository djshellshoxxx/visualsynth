import { parsePatch, serializePatch } from './patch-schema.js';

function openBackend({ indexedDB = globalThis.indexedDB, dbName = 'visualsynth', storeName = 'patches' } = {}) {
  if (!indexedDB) throw new Error('IndexedDB is unavailable');
  let dbPromise;
  const db = () => dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
  });
  const tx = async (mode, fn) => {
    const database = await db();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;
      try { result = fn(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => resolve(result?.result ?? result ?? null);
      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
      transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
    });
  };
  return {
    put: (id, value) => tx('readwrite', store => store.put(value, id)),
    get: id => tx('readonly', store => store.get(id)),
    delete: id => tx('readwrite', store => store.delete(id)),
    list: async () => {
      const database = await db();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.openCursor();
        const result = [];
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          result.push({ id: String(cursor.key), value: cursor.value });
          cursor.continue();
        };
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB list failed'));
      });
    }
  };
}

function requireId(id){ if(typeof id!=='string'||!id.trim()) throw new Error('Patch id must be a non-empty string'); return id; }

export class IndexedPatchLibrary {
  constructor({ backend } = {}) { this.backend = backend ?? openBackend(); }
  async save(id, patch) { const serialized = serializePatch(patch); await this.backend.put(requireId(id), serialized); return structuredClone(patch); }
  async load(id) { const serialized = await this.backend.get(requireId(id)); return serialized == null ? null : parsePatch(serialized); }
  async delete(id) { await this.backend.delete(requireId(id)); }
  async list() {
    const rows = await this.backend.list();
    const result = [];
    for (const row of rows) {
      try { const patch = parsePatch(row.value); result.push({ id: String(row.id), name: patch.name ?? 'Untitled Patch' }); } catch {}
    }
    return result.sort((a,b)=>a.id.localeCompare(b.id));
  }
}
