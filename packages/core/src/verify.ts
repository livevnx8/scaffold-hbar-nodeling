import { isHex64 } from './hash.js';
import { decisionHashFor, taskHashFor } from './receipt.js';
import type { AuthenticityReceipt, CheckResult, VerificationResult } from './types.js';

/**
 * Independently recompute taskHash / decisionHash from the receipt's claim + checks.
 * Does not re-run policy checks against files — that is buildAuthenticityReceipt's job.
 * This verifies the receipt was not forged after the fact.
 */
export function verifyAuthenticityReceipt(receipt: AuthenticityReceipt): VerificationResult {
  const checks: CheckResult[] = [];

  if (receipt.version !== '1.0') {
    checks.push({
      name: 'version',
      ok: false,
      detail: `unsupported receipt version: ${String(receipt.version)}`,
    });
    return { ok: false, checks };
  }
  checks.push({ name: 'version', ok: true, detail: 'version 1.0' });

  const recomputedTaskHash = taskHashFor(receipt.claim);
  const taskOk = receipt.taskHash === recomputedTaskHash && isHex64(receipt.taskHash);
  checks.push({
    name: 'task_hash',
    ok: taskOk,
    detail: taskOk
      ? 'taskHash matches canonicalize(claim)'
      : `taskHash mismatch: receipt=${receipt.taskHash.slice(0, 12)}… recomputed=${recomputedTaskHash.slice(0, 12)}…`,
  });

  const recomputedDecisionHash = decisionHashFor(
    recomputedTaskHash,
    receipt.checks,
    receipt.verdict,
    receipt.version,
  );
  const decisionOk =
    receipt.decisionHash === recomputedDecisionHash && isHex64(receipt.decisionHash);
  checks.push({
    name: 'decision_hash',
    ok: decisionOk,
    detail: decisionOk
      ? 'decisionHash matches structured checks payload'
      : `decisionHash mismatch: receipt=${receipt.decisionHash.slice(0, 12)}… recomputed=${recomputedDecisionHash.slice(0, 12)}…`,
  });

  const claimIdOk = receipt.claimId === receipt.claim.claimId;
  checks.push({
    name: 'claim_id',
    ok: claimIdOk,
    detail: claimIdOk ? 'claimId consistent' : 'claimId does not match claim.claimId',
  });

  return {
    ok: checks.every((c) => c.ok),
    checks,
    recomputedTaskHash,
    recomputedDecisionHash,
  };
}
