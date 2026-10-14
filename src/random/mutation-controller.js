import { PatchRandomizer } from './randomizer.js';
import { Actions } from '../state/actions.js';

// Main-thread only: plans setParameter PatchCommands (never touches worklet state) and their inverse for undo.
export function planMutation(patch, getDefinition, { amount = 0.25, mode = 'safe', seed = 1, locks = [], excludeIds = [] } = {}) {
  const randomizer = new PatchRandomizer({ seed });
  const commands = [], undo = [], changes = [];
  const skip = new Set(excludeIds);
  const lockSet = new Set(locks);
  for (const module of Object.values(patch.modules ?? {})) {
    if (skip.has(module.id)) continue;
    let definition;
    try { definition = getDefinition(module.type); } catch { continue; }
    const metadata = {};
    for (const p of definition.parameters ?? []) {
      if (p.curve === 'choice' || p.curve === 'integer' || p.modulatable === false) continue;
      if (lockSet.has(`${module.id}.${p.id}`)) continue;
      const span = p.max - p.min;
      metadata[p.id] = { min: p.min, max: p.max, safeMin: p.safeMin ?? p.min + span * 0.08, safeMax: p.safeMax ?? p.max - span * 0.08 };
    }
    const before = module.parameters ?? {};
    const after = randomizer.parameters(before, metadata, { locks: module.state?.randomLocks ?? [], mode });
    for (const id of Object.keys(metadata)) {
      const from = before[id] ?? definition.parameters.find(p => p.id === id).defaultValue;
      if (!Number.isFinite(after[id])) continue;
      // amount blends the old value toward the random target; unchanged values emit no command
      const next = from + (after[id] - from) * Math.max(0, Math.min(1, amount));
      if (next === from) continue;
      commands.push(Actions.setParameter(module.id, id, next));
      undo.push(Actions.setParameter(module.id, id, from));
      changes.push({ moduleId: module.id, parameterId: id, from, to: next });
    }
  }
  return { commands, undo: undo.reverse(), changes };
}
