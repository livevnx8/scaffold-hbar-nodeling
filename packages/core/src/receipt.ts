import { canonicalize, isHex64, sha256 } from './hash.js';
import { isValidHrl } from './hrl.js';
import type {
  AuthenticityClaim,
  AuthenticityReceipt,
  AuthenticityVerdict,
  CheckResult,
  ReceiptVersion,
} from './types.js';

export const CURRENT_RECEIPT_VERSION: ReceiptVersion = '1.0';

export function taskHashFor(claim: AuthenticityClaim): string {
  return sha256(canonicalize(claim));
}

export function decisionHashFor(
  taskHash: string,
  checks: CheckResult[],
  verdict: AuthenticityVerdict,
  version: ReceiptVersion = CURRENT_RECEIPT_VERSION,
): string {
  return sha256(
    canonicalize({
      v: version,
      taskHash,
      verdict,
      checks: checks
        .map((c) => ({
          name: c.name.normalize('NFC'),
          ok: c.ok ? 1 : 0,
          detail: c.detail.normalize('NFC'),
        }))
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
    }),
  );
}

export interface BuildReceiptInput {
  claim: AuthenticityClaim;
  /** Actual file bytes hash to compare against claim.contentHash */
  observedContentHash: string;
  /** Whether minterAccount is in the published allowlist (if snapshot present) */
  allowlistMember?: boolean;
  /** Fixed timestamp for deterministic tests; defaults to Date.now() */
  timestamp?: number;
}

/**
 * Run authenticity checks and bind them into a tamper-evident receipt.
 * Pure / deterministic given the same inputs (except default timestamp).
 */
export function buildAuthenticityReceipt(input: BuildReceiptInput): AuthenticityReceipt {
  const { claim } = input;
  const checks: CheckResult[] = [];

  // 1. content hash
  const contentOk =
    isHex64(claim.contentHash) &&
    isHex64(input.observedContentHash) &&
    claim.contentHash === input.observedContentHash;
  checks.push({
    name: 'content_hash',
    ok: contentOk,
    detail: contentOk
      ? 'observed file hash matches claim.contentHash'
      : `content hash mismatch: claim=${claim.contentHash.slice(0, 12)}… observed=${input.observedContentHash.slice(0, 12)}…`,
  });

  // 2. edition range
  const editionOk =
    Number.isInteger(claim.edition) &&
    Number.isInteger(claim.maxEdition) &&
    claim.maxEdition >= 1 &&
    claim.edition >= 1 &&
    claim.edition <= claim.maxEdition;
  checks.push({
    name: 'edition',
    ok: editionOk,
    detail: editionOk
      ? `edition ${claim.edition}/${claim.maxEdition} in range`
      : `edition ${claim.edition} invalid for maxEdition ${claim.maxEdition}`,
  });

  // 3. creator present
  const creatorOk = typeof claim.creator === 'string' && claim.creator.trim().length > 0;
  checks.push({
    name: 'creator',
    ok: creatorOk,
    detail: creatorOk ? `creator=${claim.creator}` : 'creator missing',
  });

  // 4. HRL well-formed
  const hrlOk = isValidHrl(claim.hrl);
  checks.push({
    name: 'hrl',
    ok: hrlOk,
    detail: hrlOk ? `hrl=${claim.hrl}` : `invalid hrl: ${claim.hrl}`,
  });

  // 5. metadata hash shape
  const metaOk = isHex64(claim.metadataHash);
  checks.push({
    name: 'metadata_hash',
    ok: metaOk,
    detail: metaOk ? 'metadataHash is 64-hex' : 'metadataHash must be 64-char lowercase hex',
  });

  // 6. allowlist (optional)
  if (claim.allowlistSnapshotHash) {
    const snapOk = isHex64(claim.allowlistSnapshotHash);
    const memberOk = input.allowlistMember === true;
    const ok = snapOk && memberOk;
    checks.push({
      name: 'allowlist',
      ok,
      detail: !snapOk
        ? 'allowlistSnapshotHash must be 64-hex'
        : memberOk
          ? `minter ${claim.minterAccount ?? '(none)'} is on snapshot ${claim.allowlistSnapshotHash.slice(0, 12)}…`
          : `minter ${claim.minterAccount ?? '(none)'} NOT on allowlist snapshot`,
    });
  }

  const verdict: AuthenticityVerdict = checks.every((c) => c.ok) ? 'verified' : 'rejected';
  const taskHash = taskHashFor(claim);
  const decisionHash = decisionHashFor(taskHash, checks, verdict);

  return {
    version: CURRENT_RECEIPT_VERSION,
    timestamp: input.timestamp ?? Date.now(),
    claimId: claim.claimId,
    taskHash,
    decisionHash,
    verdict,
    checks,
    claim: { ...claim },
  };
}
