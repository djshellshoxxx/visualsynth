import { CORE_MODULE_DEFINITIONS } from './core-definitions.js';
import { STANDARD_MODULE_DEFINITIONS } from './standard-definitions.js';

export const AVAILABLE_MODULE_DEFINITIONS = Object.freeze([
  ...CORE_MODULE_DEFINITIONS,
  ...STANDARD_MODULE_DEFINITIONS
]);
