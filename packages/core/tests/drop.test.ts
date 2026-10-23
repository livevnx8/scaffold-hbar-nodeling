import fs from 'fs';
import os from 'os';
import path from 'path';
import { fixtureAllowlistSnapshot, formatHoldersTxt } from '../src/index.js';
import {
  buildDrop,
  buildTinyPng,
  formatValidateDropResult,
  validateDrop,
  writeAllowlistExport,
  zipDropFolder,
} from '../src/drop-node.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nodeling-drop-'));
}

describe('buildDrop + validateDrop', () => {
  it('builds a DreamForge-compatible image drop that validates PASS', () => {
    const out = tmpDir();
    const result = buildDrop({
      name: 'Test',
      creator: 'Vera',
      outDir: out,
      folder: 'drop',
      hrl: 'hcs://1/0.0.900001',
      editions: [1, 2, 3].map((n) => ({
        edition: n,
        rarity: n === 3 ? 'Rare' : 'Common',
        image: { bytes: buildTinyPng(n), ext: 'png' },
      })),
    });

    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]!.image).toBe('1.png');
    expect(result.entries[0]!.image.length).toBeLessThanOrEqual(32);
    expect(result.entries[0]!.type).toBe('image/png');
    expect(result.entries[0]!.format).toBe('HIP412@2.0.0');
    expect(result.entries[0]!.hrl).toBe('hcs://1/0.0.900001');
    expect(result.entries[0]!.properties?.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fs.existsSync(path.join(result.folder, 'metadata.json'))).toBe(true);
    expect(fs.existsSync(path.join(result.folder, '1.png'))).toBe(true);
    expect(result.validation.ok).toBe(true);
    expect(result.receiptsPath).toBeDefined();
    expect(fs.existsSync(result.receiptsPath!)).toBe(true);
    expect(fs.readdirSync(result.folder).some((f) => f.includes('nodeling-receipts'))).toBe(false);

    const v = validateDrop(result.folder, { expect: { Common: 2, Rare: 1 } });
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
    expect(formatValidateDropResult(result.folder, v)).toContain('PASS');

    const zip = zipDropFolder(result.folder);
    expect(zip.length).toBeGreaterThan(100);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  });

  it('writes allowlist holders.txt in sentx-drop style', () => {
    const out = tmpDir();
    const snap = fixtureAllowlistSnapshot();
    const paths = writeAllowlistExport(snap, out, 'holders');
    const txt = fs.readFileSync(paths.txtPath, 'utf8');
    expect(txt).toBe(formatHoldersTxt(snap.accounts));
    expect(txt.split('\n').filter(Boolean)[0]).toMatch(/^0\.0\.\d+$/);
    const csv = fs.readFileSync(paths.csvPath, 'utf8');
    expect(csv.startsWith('account,balance\n')).toBe(true);
    const snapJson = JSON.parse(fs.readFileSync(paths.snapshotPath, 'utf8'));
    expect(snapJson.snapshotHash).toBe(snap.snapshotHash);
  });

  it('FAIL: missing referenced image', () => {
    const out = tmpDir();
    const folder = path.join(out, 'bad');
    fs.mkdirSync(folder);
    fs.writeFileSync(
      path.join(folder, 'metadata.json'),
      JSON.stringify([{ edition: 1, name: 'x', creator: 'c', description: 'd', image: 'missing.png', type: 'image/png', format: 'HIP412@2.0.0' }]),
    );
    const v = validateDrop(folder);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('referenced file missing'))).toBe(true);
  });

  it('FAIL: duplicate editions', () => {
    const out = tmpDir();
    const folder = path.join(out, 'dup');
    fs.mkdirSync(folder);
    const png = buildTinyPng(1);
    fs.writeFileSync(path.join(folder, '1.png'), png);
    fs.writeFileSync(
      path.join(folder, 'metadata.json'),
      JSON.stringify([
        { edition: 1, name: 'a', creator: 'c', description: 'd', image: '1.png', type: 'image/png', format: 'HIP412@2.0.0' },
        { edition: 1, name: 'b', creator: 'c', description: 'd', image: '1.png', type: 'image/png', format: 'HIP412@2.0.0' },
      ]),
    );
    const v = validateDrop(folder);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('duplicate editions'))).toBe(true);
  });

  it('FAIL: filename >32 chars', () => {
    const out = tmpDir();
    const folder = path.join(out, 'long');
    fs.mkdirSync(folder);
    const long = 'a'.repeat(29) + '.png';
    expect(long.length).toBe(33);
    fs.writeFileSync(path.join(folder, long), buildTinyPng(0));
    fs.writeFileSync(
      path.join(folder, 'metadata.json'),
      JSON.stringify([{ edition: 1, name: 'a', creator: 'c', description: 'd', image: long, type: 'image/png', format: 'HIP412@2.0.0' }]),
    );
    const v = validateDrop(folder);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('filename >32'))).toBe(true);
  });

  it('FAIL: expect tier mismatch', () => {
    const out = tmpDir();
    const result = buildDrop({
      name: 'T',
      creator: 'c',
      outDir: out,
      folder: 'tiers',
      editions: [
        { edition: 1, rarity: 'Common', image: { bytes: buildTinyPng(1), ext: 'png' } },
        { edition: 2, rarity: 'Common', image: { bytes: buildTinyPng(2), ext: 'png' } },
      ],
    });
    const v = validateDrop(result.folder, { expect: { Common: 99 } });
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes('tier Common'))).toBe(true);
  });

  it('WARN: type mismatch vs extension', () => {
    const out = tmpDir();
    const folder = path.join(out, 'typemismatch');
    fs.mkdirSync(folder);
    fs.writeFileSync(path.join(folder, '1.png'), buildTinyPng(1));
    fs.writeFileSync(
      path.join(folder, 'metadata.json'),
      JSON.stringify([
        {
          edition: 1,
          name: 'a',
          creator: 'c',
          description: 'd',
          image: '1.png',
          type: 'image/jpeg',
          format: 'HIP412@2.0.0',
        },
      ]),
    );
    const v = validateDrop(folder);
    expect(v.ok).toBe(true);
    expect(v.warnings.some((w) => w.includes('type'))).toBe(true);
  });

  it('rejects non-contiguous editions at build time', () => {
    const out = tmpDir();
    expect(() =>
      buildDrop({
        name: 'T',
        creator: 'c',
        outDir: out,
        editions: [
          { edition: 1, image: { bytes: buildTinyPng(1), ext: 'png' } },
          { edition: 3, image: { bytes: buildTinyPng(3), ext: 'png' } },
        ],
      }),
    ).toThrow(/contiguous/);
  });
});
