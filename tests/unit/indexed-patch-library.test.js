import { describe, expect, test } from 'vitest';
import { IndexedPatchLibrary } from '../../src/persistence/indexed-patch-library.js';

function memoryBackend(){
  const map=new Map();
  return {
    async put(id,value){map.set(id,value)},
    async get(id){return map.get(id)??null},
    async delete(id){map.delete(id)},
    async list(){return [...map.entries()].map(([id,value])=>({id,value}))}
  };
}

describe('IndexedPatchLibrary',()=>{
  test('saves, loads, lists and deletes validated serialized patches through async storage',async()=>{
    const library=new IndexedPatchLibrary({backend:memoryBackend()});
    const patch={formatVersion:1,name:'Test',modules:{},connections:[],settings:{}};
    await library.save('one',patch);
    expect((await library.load('one')).name).toBe('Test');
    expect(await library.list()).toEqual([{id:'one',name:'Test'}]);
    await library.delete('one');
    expect(await library.load('one')).toBeNull();
  });
});
