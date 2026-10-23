import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CollectionConfigError,
  checkMintGate,
  editionPlanFromCollection,
  fixtureAllowlistSnapshot,
  fixtureCollection,
  parseCollectionConfig,
  resolveActiveStage,
  validateCollectionConfig,
} from '../src/index.js';
import {
  buildDropFromCollectionConfig,
  loadCollectionConfig,
  validateDrop,
} from '../src/drop-node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.resolve(__dirname, '../../../examples');

describe('collection config', () => {
  it('loads JSON demo config and validates tiers + stages', () => {
    const cfg = loadCollectionConfig(path.join(examplesDir, 'nodeling-demo.collection.json'));
    expect(cfg.maxEdition).toBe(8);
    expect(cfg.maxSupply).toBe(8);
    expect(cfg.tiers.map((t) => t.count).reduce((a, b) => a + b, 0)).toBe(8);
    expect(cfg.stages[0]!.kind).toBe('allowlist');
    expect(cfg.stages[1]!.kind).toBe('public');
  });

  it('loads YAML twin', () => {
    const json = loadCollectionConfig(path.join(examplesDir, 'nodeling-demo.collection.json'));
    const yaml = loadCollectionConfig(path.join(examplesDir, 'nodeling-demo.collection.yaml'));
    expect(yaml.collectionId).toBe(json.collectionId);
    expect(yaml.maxEdition).toBe(json.maxEdition);
    expect(yaml.stages.map((s) => s.id)).toEqual(json.stages.map((s) => s.id));
  });

  it('rejects tier sum mismatch', () => {
    expect(() =>
      parseCollectionConfig({
        name: 'X',
        symbol: 'X',
        creator: 'c',
        maxEdition: 3,
        tiers: [{ key: 'a', name: 'A', count: 2 }],
        stages: [{ id: 'p', name: 'Public', kind: 'public' }],
      }),
    ).toThrow(CollectionConfigError);
  });

  it('accepts whitelist as allowlist alias', () => {
    const cfg = parseCollectionConfig({
      name: 'X',
      symbol: 'X',
      creator: 'c',
      maxSupply: 1,
      tiers: [{ key: 'a', name: 'A', count: 1 }],
      stages: [{ id: 'w', name: 'WL', kind: 'whitelist', priceHbar: 1 }],
    });
    expect(cfg.stages[0]!.kind).toBe('allowlist');
    expect(cfg.maxEdition).toBe(1);
  });

  it('rejects unordered stage starts', () => {
    expect(() =>
      parseCollectionConfig({
        name: 'X',
        symbol: 'X',
        creator: 'c',
        maxEdition: 1,
        tiers: [{ key: 'a', name: 'A', count: 1 }],
        stages: [
          { id: 'b', name: 'B', kind: 'public', start: '2026-10-20T00:00:00.000Z' },
          { id: 'a', name: 'A', kind: 'public', start: '2026-10-01T00:00:00.000Z' },
        ],
      }),
    ).toThrow(/ordered by start/);
  });

  it('edition plan expands tiers in order', () => {
    const plan = editionPlanFromCollection(fixtureCollection());
    expect(plan).toHaveLength(8);
    expect(plan.filter((p) => p.rarity === 'Common')).toHaveLength(5);
    expect(plan[7]!.rarity).toBe('Legendary');
  });

  it('resolveActiveStage: manual selector and time window', () => {
    const cfg = fixtureCollection();
    expect(resolveActiveStage(cfg.stages, { stageId: 'pub' }).id).toBe('pub');
    expect(
      resolveActiveStage(cfg.stages, { now: '2026-10-05T12:00:00.000Z' }).id,
    ).toBe('wl');
    expect(
      resolveActiveStage(cfg.stages, { now: '2026-10-20T12:00:00.000Z' }).id,
    ).toBe('pub');
  });
});

describe('mint gate (dry-run)', () => {
  const snap = fixtureAllowlistSnapshot();
  const cfg = fixtureCollection();

  it('allowlist stage denies stranger', () => {
    const r = checkMintGate({
      minterAccount: '0.0.9999',
      stageId: 'wl',
      config: cfg,
      snapshot: snap,
      now: '2026-10-05T12:00:00.000Z',
    });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/not on the allowlist/);
    expect(r.stage.kind).toBe('allowlist');
  });

  it('allowlist stage allows member', () => {
    const r = checkMintGate({
      minterAccount: '0.0.2001',
      stageId: 'wl',
      config: cfg,
      snapshot: snap,
      now: '2026-10-05T12:00:00.000Z',
    });
    expect(r.allowed).toBe(true);
  });

  it('public stage allows any valid account', () => {
    const r = checkMintGate({
      minterAccount: '0.0.9999',
      stageId: 'pub',
      config: cfg,
      snapshot: snap,
      now: '2026-10-20T12:00:00.000Z',
    });
    expect(r.allowed).toBe(true);
    expect(r.stage.kind).toBe('public');
  });

  it('public stage still rejects invalid account id', () => {
    const r = checkMintGate({
      minterAccount: 'not-an-account',
      stageId: 'pub',
      config: cfg,
    });
    expect(r.allowed).toBe(false);
  });
});

describe('buildDropFromCollectionConfig', () => {
  it('builds demo drop from fixture collection', () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeling-cfg-'));
    const cfg = fixtureCollection();
    validateCollectionConfig(cfg);
    const result = buildDropFromCollectionConfig(cfg, {
      outDir: out,
      folder: 'drop',
      clean: true,
    });
    expect(result.entries).toHaveLength(8);
    const v = validateDrop(result.folder, {
      expect: { Common: 5, Rare: 2, Legendary: 1 },
    });
    expect(v.ok).toBe(true);
  });
});
