export const EngineMessageType = Object.freeze({
  INITIALIZE: 'initialize',
  GRAPH_SWAP: 'graphSwap',
  NOTE: 'note',
  PARAMETER: 'parameter',
  PANIC: 'panic',
  TRANSPORT: 'transport',
  TELEMETRY: 'telemetry',
  DIAGNOSTICS: 'diagnostics'
});

const KNOWN_TYPES = new Set(Object.values(EngineMessageType));

export function createEngineMessage(type, payload = {}) {
  if (!KNOWN_TYPES.has(type)) throw new Error(`Unknown engine message type: ${type}`);
  return { type, payload: payload ?? {} };
}

export function validateEngineMessage(message) {
  const errors = [];
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return { valid: false, errors: ['Message must be an object'] };
  }
  if (!KNOWN_TYPES.has(message.type)) errors.push(`Unknown engine message type: ${String(message.type)}`);
  if (message.payload !== undefined && (message.payload === null || typeof message.payload !== 'object' || Array.isArray(message.payload))) {
    errors.push('Message payload must be an object');
  }

  const payload = message.payload ?? {};
  if (message.type === EngineMessageType.GRAPH_SWAP) {
    if (!Number.isInteger(payload.revision) || payload.revision < 1) errors.push('graphSwap revision must be a positive integer');
    if (!payload.graph || typeof payload.graph !== 'object') errors.push('graphSwap graph is required');
  }
  if (message.type === EngineMessageType.PARAMETER) {
    if (typeof payload.moduleId !== 'string' || typeof payload.parameterId !== 'string') errors.push('parameter moduleId and parameterId are required');
    if (!Number.isFinite(payload.value)) errors.push('parameter value must be finite');
  }
  if (message.type === EngineMessageType.NOTE) {
    if (!payload.event || typeof payload.event !== 'object') errors.push('note event is required');
  }

  return { valid: errors.length === 0, errors };
}
