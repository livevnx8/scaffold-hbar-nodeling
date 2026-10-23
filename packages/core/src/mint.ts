/**
 * Hashinal TokenCreate / TokenMint dry-run payload builders.
 *
 * Hashinal pattern: after HCS-1 inscription of file/metadata, the NFT's on-chain
 * metadata is the HRL string `hcs://1/<topicId>` encoded as UTF-8 bytes.
 *
 * Never signs or submits transactions. Live Hedera SDK path is reserved for
 * an explicit `--live` / env-gated path (see docs/going-to-testnet.md).
 */

import { checkMintGate } from './collection-config.js';
import { planHcs1Inscription } from './hcs1.js';
import { buildHrl, isValidHrl, isValidTopicId, parseHrl } from './hrl.js';
import type {
  AllowlistSnapshot,
  AuthenticityReceipt,
  CollectionConfig,
  DropEditionInput,
  HashinalMetadataEncoding,
  HashinalMintPlan,
  HashinalMintPlanStep,
  MintGateResult,
  RegistryAnchorCallStub,
  StubHcs1InscriptionResult,
  TokenCreatePayload,
  TokenCreatePlan,
  TokenMintPayload,
  TokenMintPlan,
} from './types.js';

/** Documented encoding for Hashinal NFT metadata bytes. */
export const HASHINAL_METADATA_ENCODING_NOTE =
  'Hedera NFT metadata bytes = UTF-8 encoding of the HRL string hcs://1/<topicId> (Hashinal / HCS-5 pattern).';

export class MintPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MintPlanError';
  }
}

/** Encode an HRL as UTF-8 metadata bytes (hex + length). */
export function encodeHrlAsNftMetadata(hrl: string): HashinalMetadataEncoding {
  if (!isValidHrl(hrl)) {
    throw new MintPlanError(`Invalid HRL for NFT metadata: ${hrl}`);
  }
  const buf = Buffer.from(hrl, 'utf8');
  return {
    metadataUtf8: hrl,
    metadataUtf8Hex: buf.toString('hex'),
    metadataByteLength: buf.length,
    encoding: 'utf8',
    note: HASHINAL_METADATA_ENCODING_NOTE,
  };
}

function resolveTopicAndHrl(input: {
  hrl?: string;
  topicId?: string;
  collection?: CollectionConfig;
}): { topicId: string; hrl: string } {
  if (input.hrl) {
    const { topicId } = parseHrl(input.hrl);
    return { topicId, hrl: buildHrl(topicId) };
  }
  const topic =
    input.topicId ??
    input.collection?.hrlTopic ??
    '0.0.999999';
  if (!isValidTopicId(topic)) {
    throw new MintPlanError(`Invalid topicId: ${topic}`);
  }
  return { topicId: topic, hrl: buildHrl(topic) };
}

function resolveEditions(
  collection: CollectionConfig,
  editions?: Array<number | DropEditionInput>,
): number[] {
  if (!editions || editions.length === 0) {
    return Array.from({ length: collection.maxEdition }, (_, i) => i + 1);
  }
  const nums = editions.map((e) => (typeof e === 'number' ? e : e.edition ?? 0));
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > collection.maxEdition) {
      throw new MintPlanError(
        `edition ${n} out of range 1..${collection.maxEdition}`,
      );
    }
  }
  // Deterministic order: ascending unique
  return [...new Set(nums)].sort((a, b) => a - b);
}

/**
 * Legacy thin TokenCreate plan (kept for fixtures / offline bundle).
 */
export function planTokenCreate(
  collection: CollectionConfig,
  metadataHrl: string,
): TokenCreatePlan {
  return {
    name: collection.name,
    symbol: collection.symbol,
    maxSupply: collection.maxSupply,
    metadataHrl,
    dryRun: true,
  };
}

/**
 * Legacy thin TokenMint plan (kept for fixtures / offline bundle).
 */
export function planTokenMint(input: {
  tokenIdPlaceholder?: string;
  serialPlaceholder?: number;
  metadataHrl: string;
}): TokenMintPlan {
  return {
    tokenIdPlaceholder: input.tokenIdPlaceholder ?? '0.0.TOKEN_PENDING',
    serialPlaceholder: input.serialPlaceholder ?? 1,
    metadataHrl: input.metadataHrl,
    dryRun: true,
  };
}

export interface DryRunTokenCreateInput {
  collection: CollectionConfig;
  hrl: string;
  treasuryAccountId?: string;
  tokenIdMemo?: string;
  tokenIdPlaceholder?: string;
}

/** Structured dry-run TokenCreateTransaction payload. Never signs. */
export function dryRunTokenCreate(input: DryRunTokenCreateInput): TokenCreatePayload {
  if (!isValidHrl(input.hrl)) {
    throw new MintPlanError(`Invalid HRL: ${input.hrl}`);
  }
  const treasury =
    input.treasuryAccountId ??
    input.collection.royalty?.collectorAccount ??
    '0.0.TREASURY_PENDING';
  const maxSupply = input.collection.maxSupply;
  const memo =
    input.tokenIdMemo ??
    `nodeling:${input.collection.collectionId}`;
  const summary =
    `TokenCreate NON_FUNGIBLE_UNIQUE FINITE maxSupply=${maxSupply} ` +
    `name="${input.collection.name}" symbol=${input.collection.symbol} ` +
    `treasury=${treasury} memo="${memo}" (dry-run; Hashinal metadata set at mint = ${input.hrl})`;

  return {
    dryRun: true,
    transactionType: 'TokenCreateTransaction',
    name: input.collection.name,
    symbol: input.collection.symbol,
    treasuryAccountId: treasury,
    tokenType: 'NON_FUNGIBLE_UNIQUE',
    supplyType: 'FINITE',
    maxSupply,
    memo,
    collectionHrl: input.hrl,
    royaltyPercent: input.collection.royalty?.percent,
    royaltyCollectorAccount: input.collection.royalty?.collectorAccount,
    summary,
  };
}

export interface DryRunTokenMintInput {
  metadataHrl: string;
  edition: number;
  tokenIdPlaceholder?: string;
  serialPlaceholder?: number;
}

/** Structured dry-run TokenMintTransaction payload. Metadata = UTF-8 HRL. */
export function dryRunTokenMint(input: DryRunTokenMintInput): TokenMintPayload {
  const enc = encodeHrlAsNftMetadata(input.metadataHrl);
  const tokenIdPlaceholder = input.tokenIdPlaceholder ?? '0.0.TOKEN_PENDING';
  const serialPlaceholder = input.serialPlaceholder ?? input.edition;
  const summary =
    `TokenMint token=${tokenIdPlaceholder} serial=#${serialPlaceholder} ` +
    `edition=${input.edition} metadata(utf8)="${enc.metadataUtf8}" ` +
    `bytes=${enc.metadataByteLength} hex=${enc.metadataUtf8Hex.slice(0, 24)}… (dry-run)`;

  return {
    dryRun: true,
    transactionType: 'TokenMintTransaction',
    tokenIdPlaceholder,
    serialPlaceholder,
    edition: input.edition,
    metadata: enc.metadataUtf8,
    metadataHrl: enc.metadataUtf8,
    metadataUtf8: enc.metadataUtf8,
    metadataUtf8Hex: enc.metadataUtf8Hex,
    metadataByteLength: enc.metadataByteLength,
    encoding: 'utf8',
    summary,
  };
}

/** Build AuthenticityRegistry.anchorReceipt call-data stub from a receipt. */
export function dryRunRegistryAnchor(
  receipt: Pick<AuthenticityReceipt, 'claimId' | 'decisionHash'>,
): RegistryAnchorCallStub {
  const hash = receipt.decisionHash.startsWith('0x')
    ? receipt.decisionHash
    : `0x${receipt.decisionHash}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new MintPlanError(`decisionHash must be 32-byte hex, got ${receipt.decisionHash}`);
  }
  return {
    dryRun: true,
    contract: 'AuthenticityRegistry',
    method: 'anchorReceipt',
    args: {
      claimId: receipt.claimId,
      decisionHash: hash.toLowerCase(),
    },
    summary: `AuthenticityRegistry.anchorReceipt("${receipt.claimId}", ${hash.slice(0, 10)}…) (dry-run)`,
  };
}

export interface PlanHashinalMintInput {
  collection: CollectionConfig;
  /** Edition numbers or DropEditionInput list; default 1..maxEdition */
  editions?: Array<number | DropEditionInput>;
  /** Prefer explicit HRL; else topicId / collection.hrlTopic */
  hrl?: string;
  topicId?: string;
  treasuryAccountId?: string;
  tokenIdPlaceholder?: string;
  tokenMemo?: string;
  /** Optional content for stub inscription plan */
  inscriptionContent?: Buffer | string;
  inscriptionMimeType?: string;
  /** When set, mint gate is evaluated; denied → refused plan (no mint payloads) */
  minterAccount?: string;
  stageId?: string;
  snapshot?: AllowlistSnapshot;
  now?: string | number | Date;
  /** Optional receipts to attach registry anchor stubs (matched by edition order) */
  receipts?: Array<Pick<AuthenticityReceipt, 'claimId' | 'decisionHash'>>;
  /** Skip mint-gate even if minterAccount is set */
  skipMintGate?: boolean;
}

/**
 * Ordered Hashinal mint plan:
 *   1. stub HCS-1 inscription → topicId + HRL
 *   2. TokenCreate (FINITE NFT, maxSupply = collection.maxEdition)
 *   3. per-edition TokenMint with metadata = UTF-8 HRL
 *   4. optional AuthenticityRegistry.anchorReceipt stubs
 *
 * Deterministic for the same inputs. Never signs or submits.
 */
export function planHashinalMint(input: PlanHashinalMintInput): HashinalMintPlan {
  const { collection } = input;
  const { topicId, hrl } = resolveTopicAndHrl(input);
  const editionNums = resolveEditions(collection, input.editions);
  const tokenIdPlaceholder = input.tokenIdPlaceholder ?? '0.0.TOKEN_PENDING';

  let gate: MintGateResult | undefined;
  let refused = false;
  let refusalReason: string | undefined;

  if (input.minterAccount && !input.skipMintGate) {
    gate = checkMintGate({
      minterAccount: input.minterAccount,
      stageId: input.stageId,
      config: collection,
      snapshot: input.snapshot,
      now: input.now,
    });
    if (!gate.allowed) {
      refused = true;
      refusalReason = gate.reason;
    }
  }

  const inscriptionPlan = planHcs1Inscription({
    content: input.inscriptionContent ?? `nodeling-inscribe:${collection.collectionId}:${hrl}`,
    mimeType: input.inscriptionMimeType ?? 'application/json',
    topicIdPlaceholder: topicId,
  });

  const inscription: StubHcs1InscriptionResult = {
    liveInscription: 'stubbed',
    step: 'inscribe_hcs1',
    topicId,
    hrl,
    contentHash: inscriptionPlan.contentHash,
    mimeType: inscriptionPlan.mimeType,
    chunkCount: inscriptionPlan.chunks.length,
    summary:
      `HCS-1 inscribe (stubbed) → topic=${topicId} hrl=${hrl} ` +
      `chunks=${inscriptionPlan.chunks.length} contentHash=${inscriptionPlan.contentHash.slice(0, 12)}…`,
  };

  const steps: HashinalMintPlanStep[] = [];
  const summaries: string[] = [];
  let order = 1;

  steps.push({ order, kind: 'inscribe_hcs1', result: inscription });
  summaries.push(inscription.summary);
  order += 1;

  if (refused) {
    return {
      dryRun: true,
      liveSubmission: 'stubbed',
      refused: true,
      refusalReason,
      gate,
      topicId,
      hrl,
      tokenIdPlaceholder,
      collectionId: collection.collectionId,
      maxSupply: collection.maxSupply,
      mintCount: 0,
      steps,
      inscription,
      tokenCreate: null,
      tokenMints: [],
      registryAnchors: [],
      summaries: [
        ...summaries,
        `REFUSED: ${refusalReason}`,
      ],
    };
  }

  if (collection.maxSupply !== collection.maxEdition) {
    throw new MintPlanError('collection.maxSupply must equal maxEdition');
  }

  const tokenCreate = dryRunTokenCreate({
    collection,
    hrl,
    treasuryAccountId: input.treasuryAccountId,
    tokenIdMemo: input.tokenMemo,
  });
  steps.push({ order, kind: 'token_create', payload: tokenCreate });
  summaries.push(tokenCreate.summary);
  order += 1;

  const tokenMints: TokenMintPayload[] = [];
  for (const edition of editionNums) {
    const mint = dryRunTokenMint({
      metadataHrl: hrl,
      edition,
      tokenIdPlaceholder,
      serialPlaceholder: edition,
    });
    tokenMints.push(mint);
    steps.push({ order, kind: 'token_mint', payload: mint });
    summaries.push(mint.summary);
    order += 1;
  }

  const registryAnchors: RegistryAnchorCallStub[] = [];
  if (input.receipts?.length) {
    for (const r of input.receipts) {
      const stub = dryRunRegistryAnchor(r);
      registryAnchors.push(stub);
      steps.push({ order, kind: 'registry_anchor', stub });
      summaries.push(stub.summary);
      order += 1;
    }
  }

  return {
    dryRun: true,
    liveSubmission: 'stubbed',
    refused: false,
    gate,
    topicId,
    hrl,
    tokenIdPlaceholder,
    collectionId: collection.collectionId,
    maxSupply: collection.maxSupply,
    mintCount: tokenMints.length,
    steps,
    inscription,
    tokenCreate,
    tokenMints,
    registryAnchors,
    summaries,
  };
}

/** Human-readable multi-line summary of a mint plan (for demo / CLI). */
export function formatHashinalMintPlan(plan: HashinalMintPlan): string {
  const lines: string[] = [
    '--- Hashinal mint plan (dry-run) ---',
    `collection=${plan.collectionId} hrl=${plan.hrl} topic=${plan.topicId}`,
    `maxSupply=${plan.maxSupply} mintCount=${plan.mintCount} refused=${plan.refused}`,
    `liveSubmission=${plan.liveSubmission} dryRun=${plan.dryRun}`,
    HASHINAL_METADATA_ENCODING_NOTE,
  ];
  if (plan.gate) {
    lines.push(
      `mintGate: ${plan.gate.allowed ? 'ALLOW' : 'DENY'} — ${plan.gate.reason} (stage=${plan.gate.stage.id})`,
    );
  }
  if (plan.refused) {
    lines.push(`REFUSED: ${plan.refusalReason}`);
  }
  if (plan.tokenCreate) {
    lines.push(`CREATE: ${plan.tokenCreate.summary}`);
  }
  if (plan.tokenMints[0]) {
    lines.push(`MINT[0]: ${plan.tokenMints[0].summary}`);
  }
  if (plan.tokenMints.length > 1) {
    lines.push(`… +${plan.tokenMints.length - 1} more TokenMint payload(s)`);
  }
  for (const a of plan.registryAnchors) {
    lines.push(`REGISTRY: ${a.summary}`);
  }
  lines.push(`steps: ${plan.steps.map((s) => `${s.order}:${s.kind}`).join(' → ')}`);
  return lines.join('\n');
}
