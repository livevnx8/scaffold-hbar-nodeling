import type { MintIntent, SpendCap, SpendDecision } from './types.js';

function parseAmount(s: string): bigint {
  if (!/^\d+$/.test(s)) throw new Error(`invalid amount: ${s}`);
  return BigInt(s);
}

/** Pure dry-run gate: would this mint stay under the agent spend cap? */
export function checkSpendCap(cap: SpendCap, intent: MintIntent): SpendDecision {
  const max = parseAmount(cap.maxSpendTinybar);
  const spent = parseAmount(cap.spentTinybar);
  const price = parseAmount(intent.priceTinybar);
  const remaining = max - spent;
  if (price > remaining) {
    return {
      allowed: false,
      reason: `price ${price} exceeds remaining ${remaining} tinybar`,
      remainingTinybar: remaining < 0n ? '0' : remaining.toString(),
    };
  }
  return {
    allowed: true,
    reason: 'within spend cap (dry-run; no payment executed)',
    remainingTinybar: (remaining - price).toString(),
  };
}
