/**
 * Canonical description of a Nodeling Hashinal:
 * protocol Hashinal (HCS-5 + HCS-1 HRL) plus Vera Labs authenticity / drop layer.
 * Pure documentation helper — no network, no signing.
 */

/** Ordered dry-run mint-plan step kinds (matches HashinalMintPlanStep). */
export const NODELING_MINT_FLOW_STEPS = [
  'inscribe_hcs1',
  'token_create',
  'token_mint',
  'registry_anchor',
] as const;

export type NodelingMintFlowStep = (typeof NODELING_MINT_FLOW_STEPS)[number];

/** High-level product / protocol layers. */
export const NODELING_HASHINAL_LAYERS = [
  'protocol_hashinal',
  'authenticity_receipts',
  'dreamforge_drop_sidecars',
  'collection_stages_allowlists',
  'public_verify',
  'list_on_sentx',
] as const;

export type NodelingHashinalLayer = (typeof NODELING_HASHINAL_LAYERS)[number];

export const NODELING_HRL_METADATA_NOTE =
  'Hedera NFT metadata bytes = UTF-8 encoding of the HRL string hcs://1/<topicId> (Hashinal / HCS-5 pattern).';

export interface NodelingHashinalDescription {
  product: 'Nodeling';
  protocol: 'Hashinal';
  org: 'Vera Labs';
  hrlForm: 'hcs://1/<topicId>';
  metadataEncoding: typeof NODELING_HRL_METADATA_NOTE;
  layers: readonly NodelingHashinalLayer[];
  mintFlow: readonly NodelingMintFlowStep[];
  positioning: string;
  phase: { nftFirst: true; music: 'phase_2_deferred' };
  defaults: { dryRun: true; liveHedera: false; sentxWrites: false };
  whyCool: readonly string[];
  summary: string;
}

/**
 * Return a plain object describing Nodeling's Hashinal on Hedera.
 * Stable shape for demos, `/about`, and agent briefings.
 */
export function describeNodelingHashinal(): NodelingHashinalDescription {
  return {
    product: 'Nodeling',
    protocol: 'Hashinal',
    org: 'Vera Labs',
    hrlForm: 'hcs://1/<topicId>',
    metadataEncoding: NODELING_HRL_METADATA_NOTE,
    layers: NODELING_HASHINAL_LAYERS,
    mintFlow: NODELING_MINT_FLOW_STEPS,
    positioning:
      'Prep + authenticity + DreamForge packaging; list on SentX DreamForge / HashPack — not a marketplace competitor.',
    phase: { nftFirst: true, music: 'phase_2_deferred' },
    defaults: { dryRun: true, liveHedera: false, sentxWrites: false },
    whyCool: [
      'Prove authenticity offline (GREEN/RED receipts)',
      'Real Hashinal HRL pattern, not random metadata',
      'DreamForge-ready without competing with SentX',
      'Stages and allowlists for drop ops',
      'Forkable Scaffold-HBAR offline demo',
    ],
    summary:
      "Nodeling is Vera Labs' Hashinal authenticity + mint pad: HCS-5 NFT with HCS-1 media, NFT metadata = UTF-8 HRL, authenticity receipts, DreamForge sidecars, stages/allowlists, and public verify. Dry-run default; list on SentX.",
  };
}
