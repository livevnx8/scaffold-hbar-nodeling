import fs from 'fs';
import os from 'os';
import path from 'path';
import { verifyReceiptsSidecar } from '../src/index.js';
import {
  buildDrop,
  buildTinyPng,
  formatDropPackageVerifyResult,
  verifyDropPackage,
} from '../src/drop-node.js';
import type { DropReceiptsSidecar } from '../src/index.js';

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'nodeling-verify-'));
}

describe('verifyDropPackage + receipts sidecar', () => {
  it('emits receipts sidecar next to drop (not inside) and verifies GREEN', () => {
    const out = tmpDir();
    const result = buildDrop({
      name: 'Verify Demo',
      creator: 'Vera',
      outDir: out,
      folder: 'drop',
      hrl: 'hcs://1/0.0.900001',
      editions: [1, 2, 3].map((n) => ({
        edition: n,
        rarity: n === 3 ? 'Rare' : 'Common',
        image: { bytes: buildTinyPng(n), ext: 'png' },
      })),
      writeReceipts: true,
      receiptTimestamp: 1_700_000_100_000,
    });

    expect(result.receiptsPath).toBeDefined();
    expect(fs.existsSync(result.receiptsPath!)).toBe(true);
    expect(fs.existsSync(path.join(result.folder, path.basename(result.receiptsPath!)))).toBe(
      false,
    );

    const sidecar = JSON.parse(fs.readFileSync(result.receiptsPath!, 'utf8')) as DropReceiptsSidecar;
    expect(sidecar.editions).toHaveLength(3);
    expect(sidecar.collectionId).toBe('verify-demo');
    expect(sidecar.editions[0]!.verdict).toBe('verified');
    expect(sidecar.editions[0]!.taskHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sidecar.editions[0]!.decisionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(sidecar.editions[0]!.receipt.claim.contentHash).toBe(sidecar.editions[0]!.contentHash);

    const pure = verifyReceiptsSidecar(sidecar);
    expect(pure.ok).toBe(true);
    expect(pure.verdict).toBe('GREEN');

    const v = verifyDropPackage(result.folder, result.hashesPath, result.receiptsPath);
    expect(v.ok).toBe(true);
    expect(v.verdict).toBe('GREEN');
    expect(v.editions.every((e) => e.ok)).toBe(true);
    expect(formatDropPackageVerifyResult(v)).toContain('GREEN');
  });

  it('RED when a png is tampered on disk', () => {
    const out = tmpDir();
    const result = buildDrop({
      name: 'Tamper',
      creator: 'Vera',
      outDir: out,
      folder: 'drop',
      hrl: 'hcs://1/0.0.900001',
      editions: [1, 2].map((n) => ({
        edition: n,
        image: { bytes: buildTinyPng(n + 10), ext: 'png' },
      })),
    });

    fs.writeFileSync(path.join(result.folder, '1.png'), Buffer.from('not-a-png-anymore'));
    const v = verifyDropPackage(result.folder);
    expect(v.ok).toBe(false);
    expect(v.verdict).toBe('RED');
    const ed1 = v.editions.find((e) => e.edition === 1);
    expect(ed1?.ok).toBe(false);
    expect(ed1?.checks.some((c) => c.name === 'content_hash' && !c.ok)).toBe(true);
  });

  it('RED when receipts sidecar HRL is forged', () => {
    const out = tmpDir();
    const result = buildDrop({
      name: 'Forge',
      creator: 'Vera',
      outDir: out,
      folder: 'drop',
      hrl: 'hcs://1/0.0.900001',
      editions: [{ edition: 1, image: { bytes: buildTinyPng(42), ext: 'png' } }],
    });

    const sidecar = JSON.parse(fs.readFileSync(result.receiptsPath!, 'utf8')) as DropReceiptsSidecar;
    sidecar.editions[0]!.hrl = 'hcs://1/0.0.999999';
    sidecar.editions[0]!.receipt.claim.hrl = 'hcs://1/0.0.999999';
    fs.writeFileSync(result.receiptsPath!, JSON.stringify(sidecar, null, 2));

    const v = verifyDropPackage(result.folder);
    expect(v.ok).toBe(false);
    expect(v.verdict).toBe('RED');
  });

  it('writeReceipts:false skips sidecar', () => {
    const out = tmpDir();
    const result = buildDrop({
      name: 'NoReceipts',
      creator: 'Vera',
      outDir: out,
      folder: 'drop',
      editions: [{ edition: 1, image: { bytes: buildTinyPng(1), ext: 'png' } }],
      writeReceipts: false,
    });
    expect(result.receiptsPath).toBeUndefined();
    expect(fs.existsSync(path.join(out, 'drop-nodeling-receipts.json'))).toBe(false);
  });
});
