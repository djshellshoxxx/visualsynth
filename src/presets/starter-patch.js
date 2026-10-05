import { INIT_EXAMPLE_ID, getExamplePatch } from './example-patches.js';

export function createStarterPatch() {
  return getExamplePatch(INIT_EXAMPLE_ID).patch;
}
