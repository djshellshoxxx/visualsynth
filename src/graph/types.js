export const SignalType = Object.freeze({
  AUDIO: 'audio',
  CONTROL: 'control',
  EVENT: 'event',
  TRIGGER: 'trigger',
  PITCH: 'pitch',
  GATE: 'gate'
});

export const VoiceScope = Object.freeze({
  VOICE: 'voice',
  GLOBAL: 'global'
});

export const PortDirection = Object.freeze({
  INPUT: 'input',
  OUTPUT: 'output'
});

export function defineParameter(definition) {
  const parameter = {
    id: definition.id,
    label: definition.label ?? definition.id,
    min: definition.min ?? 0,
    max: definition.max ?? 1,
    defaultValue: definition.defaultValue ?? 0,
    curve: definition.curve ?? 'linear',
    smoothingMs: definition.smoothingMs ?? 0,
    unit: definition.unit ?? null,
    choices: definition.choices ? [...definition.choices] : undefined,
    modulatable: definition.modulatable ?? true
  };

  if (parameter.min > parameter.max) throw new Error(`Invalid parameter range for ${parameter.id}`);
  if (parameter.defaultValue < parameter.min || parameter.defaultValue > parameter.max) {
    throw new Error(`Default value out of range for ${parameter.id}`);
  }

  if (parameter.choices) Object.freeze(parameter.choices);
  return Object.freeze(parameter);
}

export function definePort(definition) {
  if (!Object.values(PortDirection).includes(definition.direction)) {
    throw new Error(`Invalid port direction for ${definition.id}`);
  }
  if (!Object.values(SignalType).includes(definition.signalType)) {
    throw new Error(`Invalid signal type for ${definition.id}`);
  }

  return Object.freeze({
    id: definition.id,
    label: definition.label ?? definition.id,
    direction: definition.direction,
    signalType: definition.signalType,
    polyphonic: definition.polyphonic ?? false,
    multiple: definition.multiple ?? false,
    optional: definition.optional ?? false
  });
}

export function defineModule(definition) {
  const ports = Object.freeze((definition.ports ?? []).map(definePort));
  const parameters = Object.freeze((definition.parameters ?? []).map(defineParameter));
  const allowedScopes = Object.freeze([...(definition.allowedScopes ?? [VoiceScope.VOICE])]);

  if (!allowedScopes.includes(definition.defaultScope)) {
    throw new Error(`Default scope is not allowed for ${definition.typeId}`);
  }

  return Object.freeze({
    typeId: definition.typeId,
    title: definition.title,
    classification: definition.classification ?? 'CORE',
    description: definition.description ?? '',
    allowedScopes,
    defaultScope: definition.defaultScope,
    ports,
    parameters
  });
}
