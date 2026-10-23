/**
 * Verify a DreamForge drop folder against Nodeling hashes + receipts sidecars.
 * Sidecars live *next to* the drop folder (not inside it).
 */

import fs from 'fs';
import path from 'path';
import { sha256 } from './hash.js';
import {
  crossCheckHashesAndReceipts,
  hashinalMetaFromDreamForgeEntry,
  hrlFromDreamForgeEntry,
  verifyReceiptsSidecar,
} from './drop-receipts.js';
import { metadataHashFor } from './metadata.js';
import { buildAuthenticityReceipt } from './receipt.js';
import { verifyAuthenticityReceipt } from './verify.js';
import type {
  CheckResult,
  DreamForgeMetadataEntry,
  DropHashesSidecar,
  DropPackageVerifyResult,
  DropReceiptsSidecar,
} from './types.js';

export function defaultHashesSidecarPath(dropDir: string): string {
  const base = path.basename(path.resolve(dropDir));
  return path.join(path.dirname(path.resolve(dropDir)), `${base}-nodeling-hashes.json`);
}

export function defaultReceiptsSidecarPath(dropDir: string): string {
  const base = path.basename(path.resolve(dropDir));
  return path.join(path.dirname(path.resolve(dropDir)), `${base}-nodeling-receipts.json`);
}

function loadJson<T>(fileOrObj: string | T, label: string): T {
  if (typeof fileOrObj !== 'string') return fileOrObj;
  if (!fs.existsSync(fileOrObj)) {
    throw new Error(`${label} not found: ${fileOrObj}`);
  }
  return JSON.parse(fs.readFileSync(fileOrObj, 'utf8')) as T;
}

function loadMetadata(dropDir: string): DreamForgeMetadataEntry[] {
  const metaPath = path.join(dropDir, 'metadata.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`metadata.json missing in ${dropDir}`);
  }
  const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('metadata.json must be an array');
  return raw as DreamForgeMetadataEntry[];
}

/**
 * Re-hash files on disk, recompute receipts, compare to sidecars.
 * GREEN when every edition matches; RED on any file / edition / HRL / hash mismatch.
 */
export function verifyDropPackage(
  dropDir: string,
  hashesSidecar?: string | DropHashesSidecar,
  receiptsSidecar?: string | DropReceiptsSidecar,
): DropPackageVerifyResult {
  const dir = path.resolve(dropDir);
  const hashesPath =
    typeof hashesSidecar === 'string'
      ? hashesSidecar
      : hashesSidecar
        ? undefined
        : defaultHashesSidecarPath(dir);
  const receiptsPath =
    typeof receiptsSidecar === 'string'
      ? receiptsSidecar
      : receiptsSidecar
        ? undefined
        : defaultReceiptsSidecarPath(dir);

  const checks: CheckResult[] = [];
  const editionResults: DropPackageVerifyResult['editions'] = [];

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    checks.push({ name: 'drop_dir', ok: false, detail: `not a directory: ${dir}` });
    return {
      ok: false,
      verdict: 'RED',
      dropDir: dir,
      hashesPath,
      receiptsPath,
      editions: [],
      checks,
    };
  }
  checks.push({ name: 'drop_dir', ok: true, detail: dir });

  let hashes: DropHashesSidecar;
  let receipts: DropReceiptsSidecar;
  try {
    hashes = loadJson<DropHashesSidecar>(hashesSidecar ?? defaultHashesSidecarPath(dir), 'hashes sidecar');
    receipts = loadJson<DropReceiptsSidecar>(
      receiptsSidecar ?? defaultReceiptsSidecarPath(dir),
      'receipts sidecar',
    );
  } catch (e) {
    checks.push({
      name: 'sidecars',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      verdict: 'RED',
      dropDir: dir,
      hashesPath,
      receiptsPath,
      editions: [],
      checks,
    };
  }
  checks.push({ name: 'sidecars', ok: true, detail: 'hashes + receipts loaded' });

  const sidecarVerify = verifyReceiptsSidecar(receipts);
  checks.push({
    name: 'receipts_sidecar',
    ok: sidecarVerify.ok,
    detail: sidecarVerify.ok ? 'receipts sidecar self-consistent GREEN' : 'receipts sidecar RED',
  });

  const cross = crossCheckHashesAndReceipts(hashes, receipts);
  const crossOk = cross.every((c) => c.ok);
  checks.push({
    name: 'hashes_receipts_cross',
    ok: crossOk,
    detail: crossOk ? 'hashes↔receipts aligned' : cross.filter((c) => !c.ok).map((c) => c.detail).join('; '),
  });

  let entries: DreamForgeMetadataEntry[];
  try {
    entries = loadMetadata(dir);
  } catch (e) {
    checks.push({
      name: 'metadata',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
    return {
      ok: false,
      verdict: 'RED',
      dropDir: dir,
      hashesPath: hashesPath ?? defaultHashesSidecarPath(dir),
      receiptsPath: receiptsPath ?? defaultReceiptsSidecarPath(dir),
      editions: [],
      checks,
    };
  }

  const receiptByEdition = new Map(receipts.editions.map((e) => [e.edition, e]));
  const hashByEdition = new Map(hashes.editions.map((e) => [e.edition, e]));

  for (const entry of entries) {
    const edChecks: CheckResult[] = [];
    const row = receiptByEdition.get(entry.edition);
    const href = hashByEdition.get(entry.edition);

    if (!row) {
      edChecks.push({ name: 'receipt_row', ok: false, detail: 'missing from receipts sidecar' });
      editionResults.push({ edition: entry.edition, ok: false, checks: edChecks });
      continue;
    }
    if (!href) {
      edChecks.push({ name: 'hash_row', ok: false, detail: 'missing from hashes sidecar' });
      editionResults.push({ edition: entry.edition, ok: false, checks: edChecks });
      continue;
    }

    const imagePath = path.join(dir, entry.image);
    if (!fs.existsSync(imagePath)) {
      edChecks.push({ name: 'file', ok: false, detail: `missing ${entry.image}` });
      editionResults.push({ edition: entry.edition, ok: false, checks: edChecks });
      continue;
    }

    const observed = sha256(fs.readFileSync(imagePath));
    const fileOk = observed === row.contentHash && observed === href.contentHash;
    edChecks.push({
      name: 'content_hash',
      ok: fileOk,
      detail: fileOk
        ? 'on-disk sha256 matches sidecars'
        : `on-disk=${observed.slice(0, 12)}… sidecar=${row.contentHash.slice(0, 12)}…`,
    });

    // Also check hashes.files map when present
    if (hashes.files?.[entry.image]) {
      const mapOk = hashes.files[entry.image] === observed;
      edChecks.push({
        name: 'files_map',
        ok: mapOk,
        detail: mapOk ? 'files map matches' : 'files map hash mismatch',
      });
    }

    const metaHrl = hrlFromDreamForgeEntry(entry);
    const hrlOk = metaHrl === row.hrl && metaHrl === String(href.hrl ?? '');
    edChecks.push({
      name: 'hrl',
      ok: hrlOk,
      detail: hrlOk ? `hrl=${metaHrl}` : `hrl mismatch meta=${metaHrl} receipt=${row.hrl}`,
    });

    const rebuiltMeta = hashinalMetaFromDreamForgeEntry(entry, receipts.maxEdition, observed);
    const metaHash = metadataHashFor(rebuiltMeta);
    const metaOk = metaHash === row.metadataHash;
    edChecks.push({
      name: 'metadata_hash',
      ok: metaOk,
      detail: metaOk
        ? 'metadataHash matches recompute from on-disk entry'
        : `metadataHash mismatch recomputed=${metaHash.slice(0, 12)}…`,
    });

    // Recompute against the *sidecar claim* with on-disk observed hash.
    // Tamper → content_hash fails and task/decision diverge from sidecar.
    const rebuilt = buildAuthenticityReceipt({
      claim: row.receipt.claim,
      observedContentHash: observed,
      timestamp: row.receipt.timestamp,
    });

    const taskOk = rebuilt.taskHash === row.taskHash;
    const decisionOk = rebuilt.decisionHash === row.decisionHash;
    edChecks.push({
      name: 'task_hash',
      ok: taskOk,
      detail: taskOk
        ? 'taskHash matches sidecar'
        : fileOk
          ? 'taskHash mismatch after recompute'
          : 'taskHash diverged after on-disk tamper (expected)',
    });
    edChecks.push({
      name: 'decision_hash',
      ok: decisionOk,
      detail: decisionOk
        ? 'decisionHash matches sidecar'
        : fileOk
          ? 'decisionHash mismatch after recompute'
          : `decisionHash diverged; rebuilt verdict=${rebuilt.verdict} (expected RED path)`,
    });

    const integrity = verifyAuthenticityReceipt(row.receipt);
    edChecks.push({
      name: 'receipt_integrity',
      ok: integrity.ok,
      detail: integrity.ok ? 'embedded receipt OK' : 'embedded receipt FAIL',
    });

    // Package pass requires on-disk match (GREEN). Tamper → edition ok=false.
    const editionOk = fileOk && metaOk && hrlOk && taskOk && decisionOk && integrity.ok;
    editionResults.push({ edition: entry.edition, ok: editionOk, checks: edChecks });
  }

  // Any receipt edition missing from metadata?
  for (const row of receipts.editions) {
    if (!entries.some((e) => e.edition === row.edition)) {
      editionResults.push({
        edition: row.edition,
        ok: false,
        checks: [{ name: 'metadata_row', ok: false, detail: 'in receipts but missing from metadata.json' }],
      });
    }
  }

  const allOk =
    checks.every((c) => c.ok) &&
    editionResults.length > 0 &&
    editionResults.every((e) => e.ok) &&
    sidecarVerify.ok;

  return {
    ok: allOk,
    verdict: allOk ? 'GREEN' : 'RED',
    dropDir: dir,
    hashesPath: hashesPath ?? defaultHashesSidecarPath(dir),
    receiptsPath: receiptsPath ?? defaultReceiptsSidecarPath(dir),
    editions: editionResults.sort((a, b) => a.edition - b.edition),
    checks,
  };
}

export function formatDropPackageVerifyResult(result: DropPackageVerifyResult): string {
  const lines: string[] = [
    `VERIFY-FROM-PACKAGE: ${result.verdict}`,
    `  drop:     ${result.dropDir}`,
    `  hashes:   ${result.hashesPath ?? '(inline)'}`,
    `  receipts: ${result.receiptsPath ?? '(inline)'}`,
  ];
  for (const c of result.checks) {
    lines.push(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
  }
  for (const e of result.editions) {
    lines.push(`  edition #${e.edition}: ${e.ok ? 'PASS' : 'FAIL'}`);
    for (const c of e.checks.filter((x) => !x.ok)) {
      lines.push(`    [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
    }
  }
  return lines.join('\n');
}
