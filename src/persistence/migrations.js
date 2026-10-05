export const CURRENT_PATCH_SCHEMA_VERSION = 1;
export const PATCH_FORMAT = 'visualsynth-patch';

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value;
}

function migrateV0ToV1(document) {
  const legacy = structuredClone(document);
  const modulesObject = requireObject(legacy.modules ?? {}, 'Legacy modules');
  const modules = Object.values(modulesObject)
    .map(module => {
      const copy = structuredClone(module);
      const position = copy.position ?? { x: 0, y: 0 };
      delete copy.position;
      return {
        ...copy,
        ui: {
          x: Number.isFinite(position.x) ? position.x : 0,
          y: Number.isFinite(position.y) ? position.y : 0,
          ...(copy.ui ?? {})
        }
      };
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  const connections = (legacy.connections ?? [])
    .map(connection => ({
      id: connection.id,
      source: structuredClone(connection.source ?? connection.from),
      destination: structuredClone(connection.destination ?? connection.to),
      ...(connection.signal ? { signal: connection.signal } : {}),
      enabled: connection.enabled ?? true,
      ...(connection.ui ? { ui: structuredClone(connection.ui) } : {})
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return {
    format: PATCH_FORMAT,
    schemaVersion: 1,
    appVersion: legacy.appVersion ?? '0.1.0',
    id: legacy.id ?? 'patch_local',
    name: legacy.name ?? 'Untitled Patch',
    description: legacy.description ?? legacy.settings?.description ?? '',
    tags: Array.isArray(legacy.tags) ? [...legacy.tags] : [],
    settings: structuredClone(legacy.settings ?? {}),
    transport: structuredClone(legacy.transport ?? {}),
    modules,
    connections,
    modulations: structuredClone(legacy.modulations ?? []),
    automation: structuredClone(legacy.automation ?? []),
    probes: structuredClone(legacy.probes ?? []),
    midiMappings: structuredClone(legacy.midiMappings ?? []),
    performanceView: structuredClone(legacy.performanceView ?? {}),
    ui: structuredClone(legacy.ui ?? {}),
    extensions: structuredClone(legacy.extensions ?? {})
  };
}

const MIGRATIONS = new Map([[0, migrateV0ToV1]]);

export function migratePatch(document) {
  let current = structuredClone(requireObject(document, 'Patch document'));
  if (current.format !== PATCH_FORMAT) throw new Error(`Invalid patch format: ${current.format ?? 'missing'}`);
  if (!Number.isInteger(current.schemaVersion) || current.schemaVersion < 0) throw new Error('Patch schemaVersion must be a non-negative integer');
  if (current.schemaVersion > CURRENT_PATCH_SCHEMA_VERSION) {
    throw new Error(`Patch schema ${current.schemaVersion} is newer than supported schema ${CURRENT_PATCH_SCHEMA_VERSION}`);
  }

  while (current.schemaVersion < CURRENT_PATCH_SCHEMA_VERSION) {
    const migrate = MIGRATIONS.get(current.schemaVersion);
    if (!migrate) throw new Error(`No migration available from patch schema ${current.schemaVersion}`);
    current = migrate(current);
  }
  return current;
}
