import { getModuleType } from '../graph/registry.js';
import { PatchRandomizer } from '../random/randomizer.js';
import { LESSONS } from '../learning/lessons.js';
import { traceSignalPath, compareSnapshots } from '../analysis/signal-tools.js';
import { serializePatch, parsePatch } from '../persistence/patch-schema.js';
import { compilePatchGraph } from '../graph/compile.js';
import { OfflineRenderer } from '../render/offline-renderer.js';
import { MidiInput } from '../input/midi.js';
import { MidiLearnMap } from '../input/midi-learn.js';

function button(label, onClick) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.setAttribute('aria-label', label);
  element.addEventListener('click', onClick);
  return element;
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function semanticSnapshot(patch) {
  const clone = structuredClone(patch);
  for (const module of Object.values(clone.modules ?? {})) delete module.position;
  delete clone.ui;
  return clone;
}
function numericParameters(patch) {
  const result = {};
  for (const [moduleId, module] of Object.entries(patch.modules ?? {})) {
    for (const [parameterId, value] of Object.entries(module.parameters ?? {})) {
      if (Number.isFinite(value)) result[`${moduleId}.${parameterId}`] = value;
    }
  }
  return result;
}

export class BetaToolsView {
  constructor({ root, workspace, engine, visualizationScheduler, recordEvent = () => {} } = {}) {
    if (!root || !workspace) throw new Error('Beta tools require root and workspace');
    this.root = root;
    this.workspace = workspace;
    this.engine = engine;
    this.visualizationScheduler = visualizationScheduler;
    this.recordEvent = recordEvent;
    this.randomSeed = 1;
    this.compareA = null;
    this.compareB = null;
    this.learningOpen = false;
    this.midiMap = new MidiLearnMap(workspace.patch.midiMappings ?? []);
    this.midi = new MidiInput({
      frameProvider: () => engine?.diagnostics?.().processor?.diagnostics?.currentFrame ?? 0,
      onEvent: event => this.#onMidi(event)
    });
    this.render();
  }

  #status(text) {
    let output = this.root.querySelector('[data-beta-status]');
    if (!output) return;
    output.textContent = text;
  }

  #setComplexity(mode) {
    this.root.closest('.app-shell')?.setAttribute('data-complexity', mode);
    for (const item of document.querySelectorAll('.module-library-list button[data-module-type]')) {
      let definition;
      try { definition = getModuleType(item.dataset.moduleType); } catch { continue; }
      const advanced = definition.classification === 'ADVANCED';
      const system = definition.classification === 'SYSTEM';
      item.hidden = system || (mode === 'beginner' && advanced);
    }
    this.#status(`${mode[0].toUpperCase()+mode.slice(1)} view. Patch state is unchanged.`);
  }

  #mutate(mode) {
    const patch = structuredClone(this.workspace.patch);
    const randomizer = new PatchRandomizer({ seed: this.randomSeed++ });
    for (const module of Object.values(patch.modules ?? {})) {
      let definition;
      try { definition = getModuleType(module.type); } catch { continue; }
      const metadata = {};
      for (const parameter of definition.parameters ?? []) {
        if (parameter.curve === 'choice' || parameter.curve === 'integer' || parameter.modulatable === false) continue;
        metadata[parameter.id] = {
          min: parameter.min, max: parameter.max,
          safeMin: parameter.safeMin ?? parameter.min + (parameter.max - parameter.min) * .08,
          safeMax: parameter.safeMax ?? parameter.max - (parameter.max - parameter.min) * .08
        };
      }
      module.parameters = randomizer.parameters(module.parameters ?? {}, metadata, {
        locks: module.state?.randomLocks ?? [], mode
      });
    }
    this.workspace.applyPatchTransaction(patch, mode === 'safe' ? 'Safe mutation applied' : 'Chaos mutation applied');
    this.recordEvent('mutation', mode);
  }

  #trace() {
    for (const card of document.querySelectorAll('.module-card[data-signal-path]')) card.removeAttribute('data-signal-path');
    const patch = this.workspace.patch;
    const master = Object.values(patch.modules ?? {}).find(module => module.type === 'core.master-output');
    if (!master) return this.#status('No Master Output exists in this patch.');
    const sources = Object.values(patch.modules ?? {}).filter(module => (patch.connections ?? []).some(c => c.from?.moduleId === module.id));
    let path = [];
    for (const source of sources) {
      path = traceSignalPath(patch, source.id, master.id);
      if (path.length > 1) break;
    }
    for (const id of path) document.querySelector(`.module-card[data-module-id="${CSS.escape(id)}"]`)?.setAttribute('data-signal-path', 'true');
    this.#status(path.length ? `Signal path: ${path.join(' → ')}` : 'No complete source-to-master path found.');
  }

  #toggleLearning() {
    this.learningOpen = !this.learningOpen;
    const panel = this.root.querySelector('[data-learning-panel]');
    if (panel) panel.hidden = !this.learningOpen;
    this.root.querySelector('[data-learning-toggle]')?.setAttribute('aria-expanded', String(this.learningOpen));
    this.#status(this.learningOpen ? 'Learning Mode enabled.' : 'Learning Mode disabled. Patch state is unchanged.');
  }

  #captureCompare(slot) {
    const patch = structuredClone(this.workspace.patch);
    if (slot === 'A') this.compareA = patch; else this.compareB = patch;
    const other = slot === 'A' ? this.compareB : this.compareA;
    if (other) {
      const diffs = compareSnapshots(numericParameters(this.compareA), numericParameters(this.compareB));
      this.#status(`Compare A/B: ${diffs.length} parameter difference${diffs.length === 1 ? '' : 's'}.`);
    } else this.#status(`Captured compare ${slot}.`);
  }

  #recallCompare(slot) {
    const patch = slot === 'A' ? this.compareA : this.compareB;
    if (!patch) return this.#status(`Compare ${slot} is empty.`);
    this.workspace.applyPatchTransaction(patch, `Recalled compare ${slot}`);
  }

  #exportPatch() {
    downloadBlob(new Blob([serializePatch(this.workspace.patch)], { type: 'application/json' }), 'visualsynth-patch.json');
    this.#status('Patch JSON exported.');
  }

  async #importPatch(file) {
    if (!file) return;
    try {
      const patch = parsePatch(await file.text());
      this.workspace.applyPatchTransaction(patch, `Imported ${patch.name ?? 'patch'}`);
      this.#status('Patch imported and validated.');
    } catch (error) {
      this.#status(`Import rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async #renderWav() {
    try {
      const renderer = new OfflineRenderer();
      const sampleRate = Number(this.root.querySelector('[data-render-rate]')?.value ?? 48000);
      const format = this.root.querySelector('[data-render-format]')?.value ?? 'pcm16';
      this.#status('Rendering WAV…');
      const result = await renderer.render(compilePatchGraph(this.workspace.patch), {
        durationSeconds: 2, sampleRate, format,
        onProgress: progress => this.#status(`Rendering WAV ${Math.round(progress * 100)}%`)
      });
      downloadBlob(new Blob([result.wav], { type: 'audio/wav' }), `visualsynth-${sampleRate}-${format}.wav`);
      this.#status(`Rendered ${result.frames} frames; peak ${result.peak.toFixed(3)}.`);
    } catch (error) {
      this.#status(`Render failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async #connectMidi() {
    const result = await this.midi.connect();
    this.#status(result.available ? `MIDI ready: ${result.devices} input(s).` : `MIDI unavailable: ${result.reason ?? 'unsupported'}.`);
  }

  #onMidi(event) {
    const mapped = this.midiMap.apply(event);
    if (mapped) this.workspace.setParameter(mapped.moduleId, mapped.parameterId, mapped.value);
    if (['note-on','note-off','sustain','pitch-bend','panic'].includes(event.type)) {
      try { this.engine?.sendNote?.(event); } catch {}
    }
  }

  #toggleContrast() {
    const shell = this.root.closest('.app-shell');
    const enabled = shell?.dataset.highContrast !== 'true';
    if (shell) shell.dataset.highContrast = String(enabled);
    this.#status(enabled ? 'High contrast enabled.' : 'High contrast disabled.');
  }

  #setQuality(value) {
    const presets = {
      eco: { high: 30, normal: 15, low: 4, budget: 3 },
      normal: { high: 60, normal: 30, low: 10, budget: 6 },
      high: { high: 60, normal: 60, low: 20, budget: 9 }
    };
    const preset = presets[value] ?? presets.normal;
    if (this.visualizationScheduler) {
      this.visualizationScheduler.rates = { high: preset.high, normal: preset.normal, low: preset.low };
      this.visualizationScheduler.frameBudgetMs = preset.budget;
    }
    this.#status(`Quality: ${value}.`);
  }

  render() {
    this.root.className = 'beta-tools';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Beta tools');

    const row = document.createElement('div'); row.className = 'beta-tools-row';
    const complexity = document.createElement('select'); complexity.setAttribute('aria-label', 'Complexity mode');
    for (const mode of ['beginner','normal','advanced']) { const o=document.createElement('option');o.value=mode;o.textContent=mode[0].toUpperCase()+mode.slice(1);complexity.append(o); }
    complexity.value='normal'; complexity.addEventListener('change',()=>this.#setComplexity(complexity.value));

    const quality = document.createElement('select'); quality.setAttribute('aria-label','Quality tier');
    for(const value of ['eco','normal','high']){const o=document.createElement('option');o.value=value;o.textContent=`Quality: ${value}`;quality.append(o);} quality.value='normal';quality.addEventListener('change',()=>this.#setQuality(quality.value));

    const learn=button('Learning mode',()=>this.#toggleLearning()); learn.dataset.learningToggle=''; learn.setAttribute('aria-expanded','false');
    row.append(complexity,quality,learn,button('Connect MIDI',()=>void this.#connectMidi()),button('Safe mutate',()=>this.#mutate('safe')),button('Chaos mutate',()=>this.#mutate('chaos')),button('Undo patch edit',()=>this.workspace.undo()),button('Redo patch edit',()=>this.workspace.redo()),button('Trace signal flow',()=>this.#trace()),button('High contrast',()=>this.#toggleContrast()));

    const compare=document.createElement('div');compare.className='beta-tools-row';compare.append(
      button('Capture compare A',()=>this.#captureCompare('A')),button('Recall compare A',()=>this.#recallCompare('A')),
      button('Capture compare B',()=>this.#captureCompare('B')),button('Recall compare B',()=>this.#recallCompare('B'))
    );

    const io=document.createElement('div');io.className='beta-tools-row';
    const importInput=document.createElement('input');importInput.type='file';importInput.accept='.json,application/json';importInput.setAttribute('aria-label','Import patch JSON');importInput.addEventListener('change',()=>void this.#importPatch(importInput.files?.[0]));
    const rate=document.createElement('select');rate.dataset.renderRate='';rate.setAttribute('aria-label','Render sample rate');for(const v of [44100,48000,96000]){const o=document.createElement('option');o.value=String(v);o.textContent=`${v} Hz`;rate.append(o)}rate.value='48000';
    const format=document.createElement('select');format.dataset.renderFormat='';format.setAttribute('aria-label','Render WAV format');for(const v of ['pcm16','pcm24','float32']){const o=document.createElement('option');o.value=v;o.textContent=v;format.append(o)}
    io.append(button('Export patch JSON',()=>this.#exportPatch()),importInput,rate,format,button('Render WAV',()=>void this.#renderWav()));

    const learning=document.createElement('div');learning.dataset.learningPanel='';learning.className='learning-panel';learning.hidden=true;
    const lessonSelect=document.createElement('select');lessonSelect.setAttribute('aria-label','Learning lesson');
    for(const lesson of LESSONS){const o=document.createElement('option');o.value=lesson.id;o.textContent=lesson.title;lessonSelect.append(o);}
    const lessonText=document.createElement('p');
    const updateLesson=()=>{const lesson=LESSONS.find(item=>item.id===lessonSelect.value)??LESSONS[0];lessonText.textContent=lesson?.summary??'';};
    lessonSelect.addEventListener('change',updateLesson); updateLesson(); learning.append(lessonSelect,lessonText);

    const status=document.createElement('output');status.dataset.betaStatus='';status.className='beta-tools-status';status.setAttribute('aria-live','polite');status.textContent='Beta tools ready.';
    this.root.replaceChildren(row,compare,io,learning,status);
    this.#setComplexity('normal');
  }
}
