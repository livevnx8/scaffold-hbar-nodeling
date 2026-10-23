/**
 * Hashinal NFT + authenticity domain types.
 *
 * Hashinals are HCS-5 NFTs whose file/metadata live in HCS-1 topic chunks.
 * NFT metadata points at an HRL: hcs://1/<topicId>.
 */

export type ReceiptVersion = '1.0';

export interface MediaFileRef {
  /** Offline: fixture://... ; live: hcs://1/<topic> or https://... */
  uri: string;
  type: string;
  metadata?: Record<string, string>;
}

/** General Hashinal NFT metadata (canonicalized for hashing). */
export interface HashinalNftMetadata {
  name: string;
  description: string;
  creator: string;
  type: string;
  format: string;
  image: string;
  files: MediaFileRef[];
  edition: number;
  maxEdition: number;
  /** sha256 of primary image/file bytes */
  contentHash: string;
  /** HRL pointing at HCS-1 inscription topic */
  hrl: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
}

/** Mint stage kind — allowlist (gated) or public. */
export type MintStageKind = 'allowlist' | 'public';

/** One mint stage (whitelist round or public). Offline / dry-run. */
export interface CollectionStage {
  id: string;
  name: string;
  kind: MintStageKind;
  /** ISO datetime; open start if omitted */
  start?: string;
  /** ISO datetime; open end if omitted */
  end?: string;
  priceHbar?: string | number;
  /** Path or id of allowlist snapshot (allowlist stages) */
  snapshotRef?: string;
}

export interface CollectionRarityTier {
  key: string;
  name: string;
  count: number;
}

export interface CollectionRoyalty {
  percent?: number;
  collectorAccount?: string;
}

/**
 * Collection config (sentx-drop YAML-shaped, JSON canonical).
 * Drives drop:build tiers, mint-pad stages, and dry-run mint gate.
 */
export interface CollectionConfig {
  collectionId: string;
  name: string;
  symbol: string;
  creator: string;
  description?: string;
  /** Max edition / supply */
  maxEdition: number;
  /** TokenCreate alias; always equals maxEdition after parse */
  maxSupply: number;
  royalty?: CollectionRoyalty;
  /** HCS topic placeholder, e.g. 0.0.pending */
  hrlTopic?: string;
  nameTemplate?: string;
  tiers: CollectionRarityTier[];
  /** Default attributes applied to every edition */
  attributes?: Array<{ trait_type: string; value: string | number }>;
  /** Ordered mint stages */
  stages: CollectionStage[];
  /** Default snapshot path/ref for allowlist stages */
  allowlistSnapshotRef?: string;
  /** Optional published allowlist snapshot hash */
  allowlistSnapshotHash?: string;
}

/** Dry-run mint gate decision. */
export interface MintGateResult {
  allowed: boolean;
  reason: string;
  stage: CollectionStage;
  /** Whether the stage window contains `now` */
  activeByTime: boolean;
}

/** Claim bound into an authenticity receipt. */
export interface AuthenticityClaim {
  claimId: string;
  collectionId: string;
  creator: string;
  edition: number;
  maxEdition: number;
  contentHash: string;
  /** sha256(canonicalize(metadata)) */
  metadataHash: string;
  hrl: string;
  /** Optional published allowlist snapshot hash */
  allowlistSnapshotHash?: string;
  /** Account asserting membership (0.0.x) */
  minterAccount?: string;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  detail: string;
}

export type AuthenticityVerdict = 'verified' | 'rejected';

export interface AuthenticityReceipt {
  version: ReceiptVersion;
  timestamp: number;
  claimId: string;
  taskHash: string;
  decisionHash: string;
  verdict: AuthenticityVerdict;
  checks: CheckResult[];
  /** Echo of claim fields needed for independent re-verify */
  claim: AuthenticityClaim;
}

export interface VerificationResult {
  ok: boolean;
  checks: CheckResult[];
  recomputedTaskHash?: string;
  recomputedDecisionHash?: string;
}

export interface AllowlistEntry {
  accountId: string;
  collectionId: string;
}

export interface AllowlistSnapshot {
  /** Sorted unique account ids included */
  accounts: string[];
  /** Collections merged into this snapshot */
  collections: string[];
  /** sha256 of canonical snapshot body */
  snapshotHash: string;
  publishedAt: number;
}

/** Offline HCS-1 chunk (fixture / dry-run only). */
export interface Hcs1Chunk {
  index: number;
  total: number;
  /** base64 payload fragment */
  data: string;
}

export interface Hcs1InscriptionPlan {
  /** Placeholder topic until live inscription */
  topicIdPlaceholder: string;
  hrl: string;
  contentHash: string;
  mimeType: string;
  chunks: Hcs1Chunk[];
  /** Clear stub: live path not executed in demo */
  liveInscription: 'stubbed';
}

/** HOL HCS-1 JSON message body (`{"o":index,"c":"..."}`). */
export interface Hcs1MessageChunk {
  o: number;
  c: string;
}

/** Result of encodeHcs1Payload (offline; no network). */
export interface Hcs1EncodedPayload {
  contentHash: string;
  memo: string;
  mimeType: string;
  rawByteLength: number;
  compressedByteLength: number;
  base64Length: number;
  streamLength: number;
  messages: Hcs1MessageChunk[];
  chunkCount: number;
}

/** Result of decodeHcs1Messages. */
export interface Hcs1DecodedPayload {
  raw: Buffer;
  contentHash: string;
  mimeType: string;
}

/** Dry-run TokenCreate / TokenMint plan (no network). */
export interface TokenCreatePlan {
  name: string;
  symbol: string;
  maxSupply: number;
  metadataHrl: string;
  dryRun: true;
}

export interface TokenMintPlan {
  tokenIdPlaceholder: string;
  serialPlaceholder: number;
  metadataHrl: string;
  dryRun: true;
}

/** DreamForge / SentX metadata entry (HIP-412 shaped). */
export interface DreamForgeMetadataEntry {
  edition: number;
  name: string;
  creator: string;
  description: string;
  /** Relative filename in the drop folder (≤32 chars). */
  image: string;
  /** MIME type matching the image extension. */
  type: string;
  format: string;
  attributes?: Array<{ trait_type: string; value: string | number }>;
  files?: Array<{ uri: string; type: string; is_default_file?: boolean }>;
  properties?: Record<string, unknown>;
  /** Optional Hashinal HRL (also mirrored under properties.hrl). */
  hrl?: string;
}

export interface DropFileRef {
  /** Bytes for the file written into the drop folder. */
  bytes: Uint8Array | Buffer;
  /** Extension without dot, e.g. "png", "mp4". */
  ext: string;
  /** Override MIME; inferred from ext when omitted. */
  type?: string;
  /** DreamForge files[].is_default_file */
  isDefaultFile?: boolean;
  /** Optional short stem override (default: edition number or tier key). */
  stem?: string;
}

export interface DropEditionInput {
  /** Assigned 1..N if omitted when building a flat list. */
  edition?: number;
  name?: string;
  description?: string;
  /** Primary image / cover. */
  image: DropFileRef;
  /** Extra assets listed in metadata files[]. */
  files?: DropFileRef[];
  attributes?: Array<{ trait_type: string; value: string | number }>;
  /** Per-edition HRL; falls back to config.hrl. */
  hrl?: string;
  /** Rarity / tier label → Rarity attribute. */
  rarity?: string;
}

export interface DropBuildConfig {
  /** Collection display name (used in name_template default). */
  name: string;
  creator: string;
  description?: string;
  /** e.g. "Nodeling #{n}" — {n} and {tier} supported. */
  nameTemplate?: string;
  /** Absolute or relative output directory (parent of the drop folder). */
  outDir: string;
  /** Folder name inside outDir (default: "drop"). */
  folder?: string;
  /** image = stills only; files = image + extras in files[]. */
  mode?: 'image' | 'files';
  /** Shared HRL or placeholder, e.g. hcs://1/0.0.pending */
  hrl?: string;
  commonAttributes?: Array<{ trait_type: string; value: string | number }>;
  editions: DropEditionInput[];
  /** Also write N.json per edition (DreamForge per-file mode). */
  writePerEditionJson?: boolean;
  /** DreamForge limit (default 32). */
  maxFilenameLength?: number;
  /** Compiler stamp in properties (default Nodeling). */
  compiler?: string;
  /** When true (default), write *-nodeling-receipts.json next to the drop folder. */
  writeReceipts?: boolean;
  /** Collection id stamped into claims (default: slug of name). */
  collectionId?: string;
  /** Fixed timestamp for deterministic receipt hashes (default: 1700000100000). */
  receiptTimestamp?: number;
  /** Clear existing drop folder before write (default true). */
  clean?: boolean;
}

export interface DropBuildResult {
  folder: string;
  entries: DreamForgeMetadataEntry[];
  /** filename → sha256 hex of file bytes */
  contentHashes: Record<string, string>;
  /** Path to metadata.json */
  metadataPath: string;
  /** Sidecar hashes JSON next to the drop folder (not inside it). */
  hashesPath?: string;
  /** Sidecar authenticity receipts JSON next to the drop folder (not inside it). */
  receiptsPath?: string;
  fileCount: number;
}

export interface ValidateDropIssue {
  level: 'error' | 'warn';
  message: string;
}

export interface ValidateDropResult {
  ok: boolean;
  mode: 'single metadata.json' | 'per-file json' | 'empty';
  entries: number;
  files: number;
  sizeBytes: number;
  rarityCounts: Record<string, number>;
  errors: string[];
  warnings: string[];
  issues: ValidateDropIssue[];
}

/** One edition row in a Nodeling receipts sidecar (next to DreamForge folder). */
export interface DropEditionReceiptSummary {
  edition: number;
  image: string;
  contentHash: string;
  metadataHash: string;
  hrl: string;
  taskHash: string;
  decisionHash: string;
  verdict: AuthenticityVerdict;
  claimId: string;
  /** Full receipt for paste-verify without re-entering claims. */
  receipt: AuthenticityReceipt;
}

/** Sidecar written next to the drop folder (never inside it). */
export interface DropReceiptsSidecar {
  compiler: string;
  version: ReceiptVersion;
  collectionId: string;
  hrl: string | null;
  maxEdition: number;
  timestamp: number;
  editions: DropEditionReceiptSummary[];
}

/** Optional hashes sidecar shape (already emitted by buildDrop). */
export interface DropHashesSidecar {
  compiler?: string;
  hrl?: string | null;
  files: Record<string, string>;
  editions: Array<{
    edition: number;
    image: string;
    contentHash: string;
    hrl?: string | null;
  }>;
}

export interface DropPackageEditionResult {
  edition: number;
  ok: boolean;
  checks: CheckResult[];
}

export interface DropPackageVerifyResult {
  ok: boolean;
  verdict: 'GREEN' | 'RED';
  dropDir: string;
  hashesPath?: string;
  receiptsPath?: string;
  editions: DropPackageEditionResult[];
  checks: CheckResult[];
}

/** UTF-8 encoding of the HRL used as Hedera NFT metadata bytes (Hashinal pattern). */
export interface HashinalMetadataEncoding {
  /** Metadata string exactly equal to the HRL, e.g. hcs://1/0.0.900001 */
  metadataUtf8: string;
  /** Hex of UTF-8 bytes (no 0x prefix) */
  metadataUtf8Hex: string;
  /** Byte length of UTF-8 metadata */
  metadataByteLength: number;
  encoding: 'utf8';
  note: string;
}

/** Dry-run TokenCreateTransaction fields (never signed/submitted). */
export interface TokenCreatePayload {
  dryRun: true;
  transactionType: 'TokenCreateTransaction';
  name: string;
  symbol: string;
  treasuryAccountId: string;
  tokenType: 'NON_FUNGIBLE_UNIQUE';
  supplyType: 'FINITE';
  maxSupply: number;
  memo?: string;
  /** Collection-level HRL placeholder (Hashinal metadata set per mint). */
  collectionHrl: string;
  royaltyPercent?: number;
  royaltyCollectorAccount?: string;
  summary: string;
}

/** Dry-run TokenMintTransaction — NFT metadata = UTF-8 HRL. */
export interface TokenMintPayload {
  dryRun: true;
  transactionType: 'TokenMintTransaction';
  tokenIdPlaceholder: string;
  serialPlaceholder: number;
  edition: number;
  /** Same as metadataUtf8 — the HRL string written as NFT metadata. */
  metadata: string;
  metadataHrl: string;
  metadataUtf8: string;
  metadataUtf8Hex: string;
  metadataByteLength: number;
  encoding: 'utf8';
  summary: string;
}

/** Stubbed HCS-1 inscription step result (no network). */
export interface StubHcs1InscriptionResult {
  liveInscription: 'stubbed';
  step: 'inscribe_hcs1';
  topicId: string;
  hrl: string;
  contentHash?: string;
  mimeType?: string;
  chunkCount?: number;
  summary: string;
}

/** Dry-run AuthenticityRegistry.anchorReceipt call data. */
export interface RegistryAnchorCallStub {
  dryRun: true;
  contract: 'AuthenticityRegistry';
  method: 'anchorReceipt';
  args: {
    claimId: string;
    /** 0x-prefixed 32-byte hex */
    decisionHash: string;
  };
  summary: string;
}

export type HashinalMintPlanStep =
  | { order: number; kind: 'inscribe_hcs1'; result: StubHcs1InscriptionResult }
  | { order: number; kind: 'token_create'; payload: TokenCreatePayload }
  | { order: number; kind: 'token_mint'; payload: TokenMintPayload }
  | { order: number; kind: 'registry_anchor'; stub: RegistryAnchorCallStub };

/** Full ordered Hashinal mint plan (dry-run only). */
export interface HashinalMintPlan {
  dryRun: true;
  liveSubmission: 'stubbed';
  refused: boolean;
  refusalReason?: string;
  gate?: MintGateResult;
  topicId: string;
  hrl: string;
  tokenIdPlaceholder: string;
  collectionId: string;
  maxSupply: number;
  mintCount: number;
  steps: HashinalMintPlanStep[];
  inscription: StubHcs1InscriptionResult;
  tokenCreate: TokenCreatePayload | null;
  tokenMints: TokenMintPayload[];
  registryAnchors: RegistryAnchorCallStub[];
  summaries: string[];
}
