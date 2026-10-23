/** Dry-run only — no signing, no network. */

export interface SpendCap {
  agentId: string;
  /** Tinybars as decimal string */
  maxSpendTinybar: string;
  /** Tinybars spent in window */
  spentTinybar: string;
  currency: 'HBAR' | 'USDC';
}

export interface MintIntent {
  collectionId: string;
  edition: number;
  priceTinybar: string;
  minterAccount: string;
}

export interface SpendDecision {
  allowed: boolean;
  reason: string;
  remainingTinybar: string;
}
