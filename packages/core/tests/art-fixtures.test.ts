import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  artDirFor,
  buildDropFromCollectionConfig,
  loadArtManifest,
  loadCollectionConfig,
  validateDrop,
  verifyDropPackage,
} from '../src/drop-node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const examplesDir = path.join(repoRoot, 'examples');

describe('real-art fixtures', () => {
  it('loads tinies manifest (4 editions)', () => {
    const dir = artDirFor(repoRoot, 'tinies');
    const m = loadArtManifest(dir);
    expect(m.editions).toHaveLength(4);
    expect(m.editions.map((e) => e.trait)).toEqual(['Beanie', 'Shades', 'Astro', 'Holo']);
    for (const e of m.editions) {
      expect(fs.existsSync(path.join(dir, e.file))).toBe(true);
      expect(e.file.length).toBeLessThanOrEqual(32);
    }
    // sheet is docs-only
    expect(fs.existsSync(path.join(dir, 'tinies_sheet.png'))).toBe(true);
  });

  it('loads nodlings sample manifest (8 editions)', () => {
    const dir = artDirFor(repoRoot, 'nodlings');
    const m = loadArtManifest(dir);
    expect(m.editions).toHaveLength(8);
    expect(m.editions[0]!.sourceId).toBe(10);
    expect(m.editions[0]!.attributes?.length).toBeGreaterThan(0);
  });

  it('builds tinies-drop that validates + verifies GREEN', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeling-tinies-'));
    const config = loadCollectionConfig(path.join(examplesDir, 'tinies.collection.json'));
    const built = buildDropFromCollectionConfig(config, {
      outDir: out,
      folder: 'tinies-drop',
      artDir: artDirFor(repoRoot, 'tinies'),
      writeReceipts: true,
    });
    expect(built.entries).toHaveLength(4);
    expect(built.entries[0]!.image).toBe('1.png');
    expect(built.entries[0]!.name).toMatch(/Beanie|Tiny/i);
    expect(fs.statSync(path.join(built.folder, '1.png')).size).toBeGreaterThan(10_000);
    const expectRarity: Record<string, number> = {};
    for (const t of config.tiers) expectRarity[t.name] = t.count;
    const v = validateDrop(built.folder, { expect: expectRarity });
    expect(v.ok).toBe(true);
    const pkg = verifyDropPackage(built.folder, built.hashesPath, built.receiptsPath);
    expect(pkg.ok).toBe(true);
    expect(pkg.verdict).toBe('GREEN');
  });

  it('builds nodlings-drop sample with source traits', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeling-nodlings-'));
    const config = loadCollectionConfig(path.join(examplesDir, 'nodlings.collection.json'));
    const built = buildDropFromCollectionConfig(config, {
      outDir: out,
      folder: 'nodlings-drop',
      artDir: artDirFor(repoRoot, 'nodlings'),
      writeReceipts: true,
    });
    expect(built.entries).toHaveLength(8);
    const attrs = built.entries[0]!.attributes ?? [];
    expect(attrs.some((a) => a.trait_type === 'Source Id' && a.value === 10)).toBe(true);
    expect(attrs.some((a) => a.trait_type === 'Background')).toBe(true);
    expect(validateDrop(built.folder).ok).toBe(true);
    expect(verifyDropPackage(built.folder).ok).toBe(true);
  });
});
