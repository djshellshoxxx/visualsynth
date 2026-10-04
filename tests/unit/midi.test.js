import { describe, expect, test } from 'vitest';
import { MidiInput, normalizeMidiMessage } from '../../src/input/midi.js';

describe('normalizeMidiMessage', () => {
  test('normalizes note on/off including velocity-zero note-off', () => {
    expect(normalizeMidiMessage([0x90, 60, 100])).toMatchObject({ type: 'note-on', note: 60 });
    expect(normalizeMidiMessage([0x90, 60, 0])).toEqual({ type: 'note-off', note: 60, velocity: 0, channel: 0 });
    expect(normalizeMidiMessage([0x80, 61, 64])).toEqual({ type: 'note-off', note: 61, velocity: 64 / 127, channel: 0 });
  });

  test('normalizes pitch bend to bipolar value and semitones', () => {
    expect(normalizeMidiMessage([0xE0, 0, 64], { pitchBendRange: 2 })).toMatchObject({ type: 'pitch-bend', value: 0, semitones: 0 });
    const high = normalizeMidiMessage([0xE0, 127, 127], { pitchBendRange: 2 });
    expect(high.value).toBeGreaterThan(0.99);
    expect(high.semitones).toBeGreaterThan(1.9);
  });

  test('normalizes sustain, CC and aftertouch', () => {
    expect(normalizeMidiMessage([0xB0, 64, 127])).toEqual({ type: 'sustain', down: true, channel: 0 });
    expect(normalizeMidiMessage([0xB0, 1, 64])).toMatchObject({ type: 'cc', controller: 1, channel: 0 });
    expect(normalizeMidiMessage([0xD0, 100, 0])).toMatchObject({ type: 'aftertouch', channel: 0 });
  });
});

class FakeInput {
  constructor(id = 'midi-1') { this.id = id; this.state = 'connected'; this.onmidimessage = null; }
  send(data) { this.onmidimessage?.({ data }); }
}

function fakeAccess(inputs = []) {
  return { inputs: new Map(inputs.map(input => [input.id, input])), onstatechange: null };
}

describe('MidiInput', () => {
  test('reports unavailable instead of throwing when MIDI permission is denied', async () => {
    const midi = new MidiInput({ requestMIDIAccess: async () => { throw new Error('denied'); } });
    await expect(midi.connect()).resolves.toMatchObject({ available: false, status: 'unavailable' });
    expect(midi.status).toBe('unavailable');
  });

  test('forwards normalized events from connected devices', async () => {
    const device = new FakeInput();
    const events = [];
    const midi = new MidiInput({ requestMIDIAccess: async () => fakeAccess([device]), onEvent: event => events.push(event), frameProvider: () => 77 });
    await midi.connect();
    device.send([0x90, 64, 127]);
    expect(events[0]).toMatchObject({ type: 'note-on', note: 64, frame: 77, source: 'midi' });
  });

  test('emits panic when an active MIDI input disconnects', async () => {
    const device = new FakeInput();
    const access = fakeAccess([device]);
    const events = [];
    const midi = new MidiInput({ requestMIDIAccess: async () => access, onEvent: event => events.push(event), frameProvider: () => 9 });
    await midi.connect();
    access.onstatechange({ port: { id: device.id, type: 'input', state: 'disconnected' } });
    expect(events.at(-1)).toEqual({ type: 'panic', frame: 9, source: 'midi' });
  });
});
