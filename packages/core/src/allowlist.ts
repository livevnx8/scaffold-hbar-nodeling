import { canonicalize, sha256 } from './hash.js';
import type { AllowlistEntry, AllowlistSnapshot } from './types.js';

const ACCOUNT_RE = /^0\.0\.\d+$/;

export function normalizeAccountId(accountId: string): string {
  return accountId.trim();
}

export function isValidAccountId(accountId: string): boolean {
  return ACCOUNT_RE.test(accountId.trim());
}

/**
 * Parse a simple CSV: accountId,collectionId (header optional).
 * Lines starting with # are comments.
 */
export function parseHolderCsv(csv: string, defaultCollectionId?: string): AllowlistEntry[] {
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: AllowlistEntry[] = [];
  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const parts = line.split(',').map((p) => p.trim());
    if (parts[0]?.toLowerCase() === 'accountid' || parts[0]?.toLowerCase() === 'account') {
      continue; // header
    }
    const accountId = normalizeAccountId(parts[0] ?? '');
    const collectionId = (parts[1] || defaultCollectionId || '').trim();
    if (!accountId || !collectionId) continue;
    if (!isValidAccountId(accountId)) {
      throw new Error(`Invalid account id in allowlist CSV: ${accountId}`);
    }
    out.push({ accountId, collectionId });
  }
  return out;
}

/** Canonical body hashed into snapshotHash. */
export function snapshotBody(collections: string[], accounts: string[]): string {
  return canonicalize({
    collections: [...collections].sort(),
    accounts: [...accounts].sort(),
  });
}

/** Merge entries from multiple collections; unique accounts, sorted. */
export function mergeAllowlists(
  entries: AllowlistEntry[],
  publishedAt = 0,
): AllowlistSnapshot {
  const collections = [...new Set(entries.map((e) => e.collectionId))].sort();
  const accounts = [...new Set(entries.map((e) => e.accountId))].sort();
  return {
    accounts,
    collections,
    snapshotHash: sha256(snapshotBody(collections, accounts)),
    publishedAt,
  };
}

export function verifyAllowlistMembership(
  snapshot: AllowlistSnapshot,
  accountId: string,
): boolean {
  const id = normalizeAccountId(accountId);
  let lo = 0;
  let hi = snapshot.accounts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = snapshot.accounts[mid];
    if (v === id) return true;
    if (v < id) lo = mid + 1;
    else hi = mid - 1;
  }
  return false;
}

/** Recompute snapshot hash and compare (detects forged snapshots). */
export function verifySnapshotIntegrity(snapshot: AllowlistSnapshot): boolean {
  const expected = sha256(snapshotBody(snapshot.collections, snapshot.accounts));
  return expected === snapshot.snapshotHash;
}

/** One account per line — sentx-drop holders .txt allowlist style. */
export function formatHoldersTxt(accounts: string[]): string {
  const uniq = [...new Set(accounts.map((a) => a.trim()).filter(Boolean))].sort();
  return uniq.join('\n') + (uniq.length ? '\n' : '');
}

/** CSV with account,balance header — sentx-drop holders.csv style. */
export function formatHoldersCsv(
  rows: Array<{ account: string; balance?: number }>,
): string {
  const lines = ['account,balance'];
  for (const r of rows) {
    lines.push(`${r.account.trim()},${r.balance ?? 1}`);
  }
  return lines.join('\n') + '\n';
}
