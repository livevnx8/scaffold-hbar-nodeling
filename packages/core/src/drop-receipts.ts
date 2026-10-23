/**
 * Authenticity receipts for DreamForge drop packages (pure — no fs).
 * Sidecar is written *next to* the drop folder so sentx-drop validate stays clean.
 */

import { buildHashinalMetadata, metadataHashFor } from './metadata.js';
import { buildAuthenticityReceipt } from './receipt.js';
import { verifyAuthenticityReceipt } from './verify.js';
import { isHex64 } from './hash.js';
import { isValidHrl } from './hrl.js';
import type {
  AuthenticityClaim,
  AuthenticityReceipt,
  CheckResult,
  DreamForgeMetadataEntry,
  DropEditionReceiptSummary,
  DropHashesSidecar,
  DropReceiptsSidecar,
  HashinalNftMetadata,
} from './types.js';

export const DEFAULT_RECEIPT_TIMESTAMP = 1_700_000_100_000;

/** Stable collection id from display name (e.g. "Nodeling Demo" → "nodeling-demo"). */
export function collectionIdFromName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'collection';
}

export function hrlFromDreamForgeEntry(entry: DreamForgeMetadataEntry): string {
  if (typeof entry.hrl === 'string' && entry.hrl) return entry.hrl;
  const prop = entry.properties?.hrl;
  return typeof prop === 'string' ? prop : '';
}

/** Map a DreamForge metadata row + content hash into Hashinal metadata for hashing. */
export function hashinalMetaFromDreamForgeEntry(
  entry: DreamForgeMetadataEntry,
  maxEdition: number,
  contentHash: string,
): HashinalNftMetadata {
  const hrl = hrlFromDreamForgeEntry(entry);
  return buildHashinalMetadata({
    name: entry.name,
    description: entry.description,
    creator: entry.creator,
    image: entry.image,
    contentHash,
    hrl,
    edition: entry.edition,
    maxEdition,
    type: 'image',
    format: entry.type,
    attributes: entry.attributes,
    files: entry.files?.map((f) => ({ uri: f.uri, type: f.type })),
  });
}

export function claimFromDropEdition(input: {
  collectionId: string;
  entry: DreamForgeMetadataEntry;
  maxEdition: number;
  contentHash: string;
  allowlistSnapshotHash?: string;
  minterAccount?: string;
}): AuthenticityClaim {
  const meta = hashinalMetaFromDreamForgeEntry(input.entry, input.maxEdition, input.contentHash);
  return {
    claimId: `drop-edition-${input.entry.edition}`,
    collectionId: input.collectionId,
    creator: input.entry.creator,
    edition: input.entry.edition,
    maxEdition: input.maxEdition,
    contentHash: input.contentHash,
    metadataHash: metadataHashFor(meta),
    hrl: meta.hrl,
    allowlistSnapshotHash: input.allowlistSnapshotHash,
    minterAccount: input.minterAccount,
  };
}

export function buildEditionReceiptSummary(input: {
  collectionId: string;
  entry: DreamForgeMetadataEntry;
  maxEdition: number;
  contentHash: string;
  timestamp: number;
  allowlistSnapshotHash?: string;
  minterAccount?: string;
  allowlistMember?: boolean;
}): DropEditionReceiptSummary {
  const claim = claimFromDropEdition(input);
  const receipt = buildAuthenticityReceipt({
    claim,
    observedContentHash: input.contentHash,
    allowlistMember: input.allowlistMember,
    timestamp: input.timestamp,
  });
  return {
    edition: input.entry.edition,
    image: input.entry.image,
    contentHash: input.contentHash,
    metadataHash: claim.metadataHash,
    hrl: claim.hrl,
    taskHash: receipt.taskHash,
    decisionHash: receipt.decisionHash,
    verdict: receipt.verdict,
    claimId: receipt.claimId,
    receipt,
  };
}

export function buildReceiptsSidecar(input: {
  compiler: string;
  collectionId: string;
  hrl: string | null;
  maxEdition: number;
  timestamp: number;
  entries: DreamForgeMetadataEntry[];
  contentHashes: Record<string, string>;
}): DropReceiptsSidecar {
  const editions: DropEditionReceiptSummary[] = input.entries.map((entry) => {
    const contentHash = input.contentHashes[entry.image];
    if (!contentHash) {
      throw new Error(`missing contentHash for image ${entry.image}`);
    }
    return buildEditionReceiptSummary({
      collectionId: input.collectionId,
      entry,
      maxEdition: input.maxEdition,
      contentHash,
      timestamp: input.timestamp + entry.edition,
    });
  });
  return {
    compiler: input.compiler,
    version: '1.0',
    collectionId: input.collectionId,
    hrl: input.hrl,
    maxEdition: input.maxEdition,
    timestamp: input.timestamp,
    editions,
  };
}

function isReceiptsSidecar(value: unknown): value is DropReceiptsSidecar {
  if (!value || typeof value !== 'object') return false;
  const v = value as DropReceiptsSidecar;
  return Array.isArray(v.editions) && typeof v.collectionId === 'string' && typeof v.maxEdition === 'number';
}

/**
 * Verify a receipts sidecar without reading drop files:
 * recompute each receipt from embedded claim + contentHash, check task/decision hashes.
 */
export function verifyReceiptsSidecar(sidecar: DropReceiptsSidecar): {
  ok: boolean;
  verdict: 'GREEN' | 'RED';
  editions: Array<{ edition: number; ok: boolean; checks: CheckResult[]; receipt?: AuthenticityReceipt }>;
  checks: CheckResult[];
} {
  const checks: CheckResult[] = [];
  if (!isReceiptsSidecar(sidecar)) {
    checks.push({ name: 'shape', ok: false, detail: 'not a Nodeling receipts sidecar' });
    return { ok: false, verdict: 'RED', editions: [], checks };
  }
  if (sidecar.version !== '1.0') {
    checks.push({
      name: 'version',
      ok: false,
      detail: `unsupported sidecar version: ${String(sidecar.version)}`,
    });
  } else {
    checks.push({ name: 'version', ok: true, detail: 'version 1.0' });
  }

  const editionResults: Array<{
    edition: number;
    ok: boolean;
    checks: CheckResult[];
    receipt?: AuthenticityReceipt;
  }> = [];

  for (const row of sidecar.editions) {
    const edChecks: CheckResult[] = [];
    const receipt = row.receipt;
    if (!receipt) {
      edChecks.push({ name: 'receipt', ok: false, detail: 'missing embedded receipt' });
      editionResults.push({ edition: row.edition, ok: false, checks: edChecks });
      continue;
    }

    // Recompute from claim with observed = claim.contentHash (self-consistent package)
    const rebuilt = buildAuthenticityReceipt({
      claim: receipt.claim,
      observedContentHash: receipt.claim.contentHash,
      allowlistMember: receipt.claim.allowlistSnapshotHash
        ? receipt.checks.find((c) => c.name === 'allowlist')?.ok
        : undefined,
      timestamp: receipt.timestamp,
    });

    const contentOk = row.contentHash === receipt.claim.contentHash && isHex64(row.contentHash);
    edChecks.push({
      name: 'content_hash',
      ok: contentOk,
      detail: contentOk
        ? 'sidecar contentHash matches claim'
        : 'sidecar contentHash ≠ claim.contentHash',
    });

    const metaOk = row.metadataHash === receipt.claim.metadataHash && isHex64(row.metadataHash);
    edChecks.push({
      name: 'metadata_hash',
      ok: metaOk,
      detail: metaOk ? 'sidecar metadataHash matches claim' : 'metadataHash mismatch',
    });

    const hrlOk = row.hrl === receipt.claim.hrl && isValidHrl(row.hrl);
    edChecks.push({
      name: 'hrl',
      ok: hrlOk,
      detail: hrlOk ? `hrl=${row.hrl}` : `hrl mismatch or invalid: ${row.hrl}`,
    });

    const taskOk = row.taskHash === rebuilt.taskHash && row.taskHash === receipt.taskHash;
    edChecks.push({
      name: 'task_hash',
      ok: taskOk,
      detail: taskOk ? 'taskHash matches recompute' : 'taskHash mismatch vs recompute',
    });

    const decisionOk =
      row.decisionHash === rebuilt.decisionHash && row.decisionHash === receipt.decisionHash;
    edChecks.push({
      name: 'decision_hash',
      ok: decisionOk,
      detail: decisionOk ? 'decisionHash matches recompute' : 'decisionHash mismatch vs recompute',
    });

    const verdictOk = row.verdict === rebuilt.verdict && row.verdict === receipt.verdict;
    edChecks.push({
      name: 'verdict',
      ok: verdictOk,
      detail: verdictOk ? `verdict=${row.verdict}` : `verdict mismatch: row=${row.verdict} rebuilt=${rebuilt.verdict}`,
    });

    const independent = verifyAuthenticityReceipt(receipt);
    edChecks.push({
      name: 'receipt_integrity',
      ok: independent.ok,
      detail: independent.ok ? 'embedded receipt hashes consistent' : 'embedded receipt forged/inconsistent',
    });

    const editionOk =
      row.edition === receipt.claim.edition &&
      Number.isInteger(row.edition) &&
      row.edition >= 1 &&
      row.edition <= sidecar.maxEdition;
    edChecks.push({
      name: 'edition',
      ok: editionOk,
      detail: editionOk
        ? `edition ${row.edition}/${sidecar.maxEdition}`
        : `edition ${row.edition} invalid for maxEdition ${sidecar.maxEdition}`,
    });

    editionResults.push({
      edition: row.edition,
      ok: edChecks.every((c) => c.ok),
      checks: edChecks,
      receipt,
    });
  }

  const countOk = sidecar.editions.length === sidecar.maxEdition;
  checks.push({
    name: 'edition_count',
    ok: countOk,
    detail: countOk
      ? `${sidecar.editions.length} editions`
      : `editions.length ${sidecar.editions.length} ≠ maxEdition ${sidecar.maxEdition}`,
  });

  const allOk = checks.every((c) => c.ok) && editionResults.every((e) => e.ok);
  return {
    ok: allOk,
    verdict: allOk ? 'GREEN' : 'RED',
    editions: editionResults,
    checks,
  };
}

/**
 * Cross-check hashes sidecar edition rows against a receipts sidecar (pure).
 */
export function crossCheckHashesAndReceipts(
  hashes: DropHashesSidecar,
  receipts: DropReceiptsSidecar,
): CheckResult[] {
  const checks: CheckResult[] = [];
  const byEd = new Map(receipts.editions.map((e) => [e.edition, e]));
  for (const h of hashes.editions) {
    const r = byEd.get(h.edition);
    if (!r) {
      checks.push({
        name: `edition_${h.edition}`,
        ok: false,
        detail: 'present in hashes sidecar but missing from receipts',
      });
      continue;
    }
    const contentOk = h.contentHash === r.contentHash;
    const imageOk = h.image === r.image;
    const hrlOk = String(h.hrl ?? '') === r.hrl;
    const ok = contentOk && imageOk && hrlOk;
    checks.push({
      name: `edition_${h.edition}`,
      ok,
      detail: ok
        ? 'hashes↔receipts match'
        : `mismatch content=${contentOk} image=${imageOk} hrl=${hrlOk}`,
    });
  }
  for (const r of receipts.editions) {
    if (!hashes.editions.some((h) => h.edition === r.edition)) {
      checks.push({
        name: `edition_${r.edition}`,
        ok: false,
        detail: 'present in receipts sidecar but missing from hashes',
      });
    }
  }
  return checks;
}

/** Detect receipts sidecar JSON (for /verify paste). */
export function looksLikeReceiptsSidecar(value: unknown): value is DropReceiptsSidecar {
  return isReceiptsSidecar(value);
}
