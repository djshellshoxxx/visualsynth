import {CURRENT_PATCH_SCHEMA_VERSION,migratePatchDocument} from './migrations.js';
export const PATCH_SCHEMA_VERSION=CURRENT_PATCH_SCHEMA_VERSION;
export function serializePatch(patch){return JSON.stringify({schemaVersion:PATCH_SCHEMA_VERSION,app:'VisualSynth',patch})}
export function deserializePatch(raw){let d;try{d=typeof raw==='string'?JSON.parse(raw):raw}catch{throw Error('Invalid patch JSON')}d=migratePatchDocument(d);if(!d.patch||!Array.isArray(d.patch.modules)||!Array.isArray(d.patch.connections))throw Error('Invalid patch structure');return d}
