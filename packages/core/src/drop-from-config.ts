/**
 * Build a DreamForge drop from a CollectionConfig (tiers → editions).
 * Supports synthetic tiny PNGs or real Vera Labs art fixtures.
 */

import path from 'path';
import { buildHrl } from './hrl.js';
import { editionsFromCollectionConfig } from './collection-config.js';
import { buildDrop, buildTinyPng } from './drop.js';
import { editionsFromArtDir } from './art-fixtures.js';
import type { CollectionConfig, DropBuildResult, DropEditionInput, ValidateDropResult } from './types.js';

export interface BuildDropFromConfigOptions {
  outDir: string;
  folder?: string;
  /** Override HRL; default from config.hrlTopic */
  hrl?: string;
  clean?: boolean;
  writeReceipts?: boolean;
  receiptTimestamp?: number;
  /** Image factory; default deterministic tiny PNG from edition number */
  imageSeed?: (edition: number) => number;
  /**
   * Absolute path to fixtures/{tinies|nodlings}.
   * When set, loads real PNGs (+ traits) instead of synthetic tiny PNGs.
   */
  artDir?: string;
  /** Fully built editions; wins over artDir / synthetic. */
  editions?: DropEditionInput[];
}

export function hrlFromCollection(config: CollectionConfig): string | undefined {
  if (!config.hrlTopic) return undefined;
  return buildHrl(config.hrlTopic);
}

/**
 * Expand collection tiers into editions and call buildDrop.
 */
export function buildDropFromCollectionConfig(
  config: CollectionConfig,
  opts: BuildDropFromConfigOptions,
): DropBuildResult & { validation: ValidateDropResult; config: CollectionConfig } {
  const hrl = opts.hrl ?? hrlFromCollection(config);

  let editions: DropEditionInput[];
  if (opts.editions) {
    editions = opts.editions;
  } else if (opts.artDir) {
    editions = editionsFromArtDir(config, opts.artDir);
  } else {
    const seed = opts.imageSeed ?? ((edition: number) => edition);
    editions = editionsFromCollectionConfig(config, (edition) => ({
      bytes: buildTinyPng(seed(edition)),
      ext: 'png',
    }));
  }

  const result = buildDrop({
    name: config.name,
    creator: config.creator,
    description: config.description,
    nameTemplate: config.nameTemplate ?? `${config.name} #{n}`,
    outDir: opts.outDir,
    folder: opts.folder ?? 'drop',
    mode: 'image',
    hrl,
    commonAttributes: config.attributes,
    editions,
    collectionId: config.collectionId,
    clean: opts.clean,
    writeReceipts: opts.writeReceipts,
    receiptTimestamp: opts.receiptTimestamp,
  });

  return { ...result, config };
}

/** Resolve example config path relative to a known root. */
export function defaultDemoCollectionPath(repoRoot: string): string {
  return path.join(repoRoot, 'examples', 'nodeling-demo.collection.json');
}

export function collectionPathForKey(
  repoRoot: string,
  key: 'tinies' | 'nodlings' | 'demo',
): string {
  const base =
    key === 'tinies'
      ? 'tinies.collection.json'
      : key === 'nodlings'
        ? 'nodlings.collection.json'
        : 'nodeling-demo.collection.json';
  return path.join(repoRoot, 'examples', base);
}
