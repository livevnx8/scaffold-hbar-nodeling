/**
 * Node/fs loaders for collection config (JSON or YAML subset).
 */

import fs from 'fs';
import path from 'path';
import { parseCollectionConfig } from './collection-config.js';
import { parseSimpleYaml } from './simple-yaml.js';
import type { CollectionConfig } from './types.js';

export function loadCollectionConfig(filePath: string): CollectionConfig {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`collection config not found: ${abs}`);
  }
  const text = fs.readFileSync(abs, 'utf8');
  const ext = path.extname(abs).toLowerCase();
  let raw: unknown;
  if (ext === '.json') {
    raw = JSON.parse(text) as unknown;
  } else if (ext === '.yaml' || ext === '.yml') {
    raw = parseSimpleYaml(text);
  } else {
    // try JSON first, then YAML
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      raw = parseSimpleYaml(text);
    }
  }
  return parseCollectionConfig(raw);
}
