export function createPatchState(overrides = {}) {
  return {
    formatVersion: 1,
    name: 'Untitled Patch',
    modules: {},
    connections: [],
    settings: {},
    ...structuredClone(overrides)
  };
}

function requireModule(state, moduleId) {
  const module = state.modules[moduleId];
  if (!module) throw new Error(`Unknown module: ${moduleId}`);
  return module;
}

export function reducePatch(state, action) {
  switch (action.type) {
    case 'module/add': {
      if (state.modules[action.module.id]) throw new Error(`Module already exists: ${action.module.id}`);
      return {
        ...state,
        modules: { ...state.modules, [action.module.id]: structuredClone(action.module) }
      };
    }

    case 'module/remove': {
      requireModule(state, action.moduleId);
      const modules = { ...state.modules };
      delete modules[action.moduleId];
      return {
        ...state,
        modules,
        connections: state.connections.filter((connection) =>
          connection.from.moduleId !== action.moduleId && connection.to.moduleId !== action.moduleId
        )
      };
    }

    case 'module/move': {
      const module = requireModule(state, action.moduleId);
      return {
        ...state,
        modules: {
          ...state.modules,
          [action.moduleId]: { ...module, position: { ...action.position } }
        }
      };
    }

    case 'module/duplicate': {
      const source = requireModule(state, action.sourceId);
      if (state.modules[action.newId]) throw new Error(`Module already exists: ${action.newId}`);
      const copy = structuredClone(source);
      copy.id = action.newId;
      copy.position = { ...action.position };
      return { ...state, modules: { ...state.modules, [action.newId]: copy } };
    }

    case 'parameter/set': {
      const module = requireModule(state, action.moduleId);
      return {
        ...state,
        modules: {
          ...state.modules,
          [action.moduleId]: {
            ...module,
            parameters: { ...(module.parameters ?? {}), [action.parameterId]: action.value }
          }
        }
      };
    }

    case 'connection/add': {
      if (state.connections.some((connection) => connection.id === action.connection.id)) {
        throw new Error(`Connection already exists: ${action.connection.id}`);
      }
      requireModule(state, action.connection.from.moduleId);
      requireModule(state, action.connection.to.moduleId);
      return { ...state, connections: [...state.connections, structuredClone(action.connection)] };
    }

    case 'connection/remove':
      return { ...state, connections: state.connections.filter((connection) => connection.id !== action.connectionId) };

    case 'patch/replace':
      return createPatchState(action.patch);

    default:
      throw new Error(`Unknown patch action: ${action.type}`);
  }
}
