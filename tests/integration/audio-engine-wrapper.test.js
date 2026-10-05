import { describe, expect, test } from 'vitest';
import { AudioEngine } from '../../src/engine/audio-engine.js';

class FakePort {
  constructor() { this.messages = []; this.onmessage = null; }
  postMessage(message) { this.messages.push(message); }
}

class FakeNode {
  constructor() { this.port = new FakePort(); this.connectedTo = null; }
  connect(destination) { this.connectedTo = destination; return destination; }
}

class FakeContext {
  constructor(order = []) {
    this.state = 'suspended';
    this.destination = { id: 'destination' };
    this.order = order;
    this.audioWorklet = { modules: [], addModule: async url => {
      this.order.push('addModule');
      this.audioWorklet.modules.push(url);
    } };
    this.resumeCount = 0;
  }
  async resume() {
    this.order.push('resume');
    this.state = 'running';
    this.resumeCount += 1;
  }
}

describe('AudioEngine', () => {
  test('creates one persistent context and worklet node across repeated starts', async () => {
    let contexts = 0;
    let nodes = 0;
    const engine = new AudioEngine({
      contextFactory: () => { contexts += 1; return new FakeContext(); },
      nodeFactory: () => { nodes += 1; return new FakeNode(); },
      workletUrl: './worklet-processor.js'
    });

    await engine.start();
    await engine.start();

    expect(contexts).toBe(1);
    expect(nodes).toBe(1);
    expect(engine.diagnostics().started).toBe(true);
  });

  test('resumes the audio context before loading the worklet module', async () => {
    const order = [];
    const engine = new AudioEngine({
      contextFactory: () => new FakeContext(order),
      nodeFactory: () => new FakeNode(),
      workletUrl: './worklet-processor.js'
    });

    await engine.start();

    expect(order).toEqual(['resume', 'addModule']);
  });

  test('sends graph, note, parameter and panic protocol messages', async () => {
    const node = new FakeNode();
    const engine = new AudioEngine({ contextFactory: () => new FakeContext(), nodeFactory: () => node });
    await engine.start();

    engine.applyCompiledGraph({ formatVersion: 1, nodes: [], connections: [] });
    engine.sendNote({ type: 'note-on', note: 60, velocity: 1, frame: 0 });
    engine.setParameter('osc', 'amplitude', 0.2);
    engine.panic();

    expect(node.port.messages.map(message => message.type)).toEqual(['initialize', 'graphSwap', 'note', 'parameter', 'panic']);
    expect(engine.diagnostics().revision).toBe(1);
  });

  test('increments graph revision monotonically', async () => {
    const node = new FakeNode();
    const engine = new AudioEngine({ contextFactory: () => new FakeContext(), nodeFactory: () => node });
    await engine.start();
    engine.applyCompiledGraph({ formatVersion: 1, nodes: [], connections: [] });
    engine.applyCompiledGraph({ formatVersion: 1, nodes: [], connections: [] });
    expect(engine.diagnostics().revision).toBe(2);
    expect(node.port.messages.filter(message => message.type === 'graphSwap').map(message => message.payload.revision)).toEqual([1, 2]);
  });
});
