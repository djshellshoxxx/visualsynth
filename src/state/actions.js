const withMeta = (action, meta) => meta ? { ...action, meta: { ...meta } } : action;

export const Actions = Object.freeze({
  addModule(module, meta) {
    return withMeta({ type: 'module/add', module: structuredClone(module) }, meta);
  },
  removeModule(moduleId, meta) {
    return withMeta({ type: 'module/remove', moduleId }, meta);
  },
  moveModule(moduleId, position, meta) {
    return withMeta({ type: 'module/move', moduleId, position: { ...position } }, meta);
  },
  duplicateModule(sourceId, newId, position, meta) {
    return withMeta({ type: 'module/duplicate', sourceId, newId, position: { ...position } }, meta);
  },
  setParameter(moduleId, parameterId, value, meta) {
    return withMeta({ type: 'parameter/set', moduleId, parameterId, value }, meta);
  },
  addConnection(connection, meta) {
    return withMeta({ type: 'connection/add', connection: structuredClone(connection) }, meta);
  },
  removeConnection(connectionId, meta) {
    return withMeta({ type: 'connection/remove', connectionId }, meta);
  },
  replacePatch(patch, meta) {
    return withMeta({ type: 'patch/replace', patch: structuredClone(patch) }, meta);
  }
});
