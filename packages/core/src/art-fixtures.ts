/**
 * Load Vera Labs real-art fixtures (Tinies / Nodlings sample) for DreamForge drops.
 * Fixtures live at <repo>/fixtures/{tinies,nodlings}/ — never the full 673 Nodlings set.
 */

import fs from 'fs';
import path from 'path';
import { editionPlanFromCollection } from './collection-config.js';
import type { CollectionConfig, DropEditionInput } from './types.js';

export type ArtCollectionKey = 'tinies' | 'nodlings' | 'demo';

export interface ArtEditionManifestRow {
  edition: number;
  file: string;
  name?: string;
  description?: string;
  trait?: string;
  rarity?: string;
  sourceId?: number;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  nodling_id?: number;
}

export interface ArtManifest {
  collectionId: string;
  editions: ArtEditionManifestRow[];
  source?: string;
}

export function resolveRepoRoot(fromDir: string): string {
  // packages/core/src → repo root is ../../..
  return path.resolve(fromDir, '../../..');
}

export function fixturesRoot(repoRoot: string): string {
  return path.join(repoRoot, 'fixtures');
}

export function artDirFor(repoRoot: string, key: 'tinies' | 'nodlings'): string {
  return path.join(fixturesRoot(repoRoot), key);
}

export function loadArtManifest(artDir: string): ArtManifest {
  const p = path.join(artDir, 'manifest.json');
  if (!fs.existsSync(p)) {
    throw new Error(`art manifest not found: ${p}`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as ArtManifest;
  if (!raw?.editions?.length) {
    throw new Error(`art manifest has no editions: ${p}`);
  }
  return raw;
}

function normalizeExt(file: string): string {
  const ext = path.extname(file).replace(/^\./, '').toLowerCase();
  return ext || 'png';
}

/**
 * Build DropEditionInput[] from a fixture art directory + collection config.
 * Edition count must match config.maxEdition / tier plan.
 * DreamForge filenames are remapped to contiguous `{edition}.png`.
 */
export function editionsFromArtDir(
  config: CollectionConfig,
  artDir: string,
): DropEditionInput[] {
  const manifest = loadArtManifest(artDir);
  const plan = editionPlanFromCollection(config);
  if (manifest.editions.length !== plan.length) {
    throw new Error(
      `art manifest editions (${manifest.editions.length}) != collection plan (${plan.length}) for ${config.collectionId}`,
    );
  }

  const byEdition = new Map(manifest.editions.map((e) => [e.edition, e]));
  const out: DropEditionInput[] = [];

  for (const p of plan) {
    const row = byEdition.get(p.edition);
    if (!row) {
      throw new Error(`missing art manifest row for edition ${p.edition} in ${artDir}`);
    }
    const abs = path.join(artDir, row.file);
    if (!fs.existsSync(abs)) {
      throw new Error(`art file missing: ${abs}`);
    }
    const bytes = fs.readFileSync(abs);
    const attrs: Array<{ trait_type: string; value: string | number }> = [];

    if (row.trait) {
      attrs.push({ trait_type: 'Look', value: row.trait });
    }
    if (row.sourceId !== undefined) {
      attrs.push({ trait_type: 'Source Id', value: row.sourceId });
    }
    if (row.nodling_id !== undefined) {
      attrs.push({ trait_type: 'Nodling Id', value: row.nodling_id });
    }
    // Prefer source attributes (Nodlings JSON) but drop duplicate Rarity Tier —
    // buildDrop already stamps Rarity from the collection tier plan.
    for (const a of row.attributes ?? []) {
      if (a.trait_type === 'Rarity Tier' || a.trait_type === 'Rarity') continue;
      attrs.push(a);
    }

    out.push({
      edition: p.edition,
      rarity: p.rarity,
      name: row.name,
      description: row.description,
      image: {
        bytes,
        ext: normalizeExt(row.file),
        type: 'image/png',
      },
      attributes: attrs.length ? attrs : undefined,
    });
  }

  return out;
}

export function isArtCollectionKey(v: string): v is ArtCollectionKey {
  return v === 'tinies' || v === 'nodlings' || v === 'demo';
}

/** Map collectionId / CLI key → drop folder basename. */
export function dropFolderForKey(key: ArtCollectionKey): string {
  if (key === 'tinies') return 'tinies-drop';
  if (key === 'nodlings') return 'nodlings-drop';
  return 'nodeling-demo-drop';
}

export function collectionConfigBasename(key: ArtCollectionKey): string {
  if (key === 'tinies') return 'tinies.collection.json';
  if (key === 'nodlings') return 'nodlings.collection.json';
  return 'nodeling-demo.collection.json';
}

export function holdersBasename(key: ArtCollectionKey): string {
  if (key === 'tinies') return 'tinies-holders';
  if (key === 'nodlings') return 'nodlings-holders';
  return 'nodeling-demo-holders';
}
