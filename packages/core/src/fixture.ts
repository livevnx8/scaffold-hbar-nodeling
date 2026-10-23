/**
 * Deterministic offline fixtures for demo + tests.
 * No network, no randomness.
 */

import { sha256 } from './hash.js';
import { mergeAllowlists, parseHolderCsv } from './allowlist.js';
import { buildHashinalMetadata, metadataHashFor } from './metadata.js';
import { planHcs1Inscription } from './hcs1.js';
import type {
  AllowlistSnapshot,
  AuthenticityClaim,
  CollectionConfig,
  HashinalNftMetadata,
} from './types.js';

/** Tiny deterministic PNG-like payload (not a real PNG; content hash only). */
export const FIXTURE_IMAGE_BYTES = Buffer.from(
  'hashinal-fixture-image-v0:vera-labs-tinies-001',
  'utf8',
);

export const FIXTURE_IMAGE_HASH = sha256(FIXTURE_IMAGE_BYTES);

export const FIXTURE_TOPIC_PLACEHOLDER = '0.0.900001';

export const HOLDERS_WOLVES_CSV = `# Infinity Wolves holders (fixture)
accountId,collectionId
0.0.1001,wolves
0.0.1002,wolves
0.0.1003,wolves
0.0.2001,wolves
`;

export const HOLDERS_TINIES_CSV = `# Tinies holders (fixture)
accountId,collectionId
0.0.2001,tinies
0.0.3001,tinies
0.0.3002,tinies
`;

/** Demo collection aligned with examples/nodeling-demo.collection.json (8 editions). */
export function fixtureCollection(): CollectionConfig {
  return {
    collectionId: 'nodeling-demo',
    name: 'Nodeling Demo',
    symbol: 'NODE',
    creator: 'Vera Labs',
    description:
      'Nodeling demo Hashinal-ready NFT #{n} ({tier}). Prep here → list on SentX DreamForge.',
    maxEdition: 8,
    maxSupply: 8,
    royalty: { percent: 5, collectorAccount: '0.0.8001' },
    hrlTopic: FIXTURE_TOPIC_PLACEHOLDER,
    nameTemplate: 'Nodeling Demo #{n}',
    tiers: [
      { key: 'common', name: 'Common', count: 5 },
      { key: 'rare', name: 'Rare', count: 2 },
      { key: 'legendary', name: 'Legendary', count: 1 },
    ],
    attributes: [
      { trait_type: 'Artist', value: 'Vera Labs' },
      { trait_type: 'Protocol', value: 'Hashinal' },
      { trait_type: 'Series', value: 'Demo' },
    ],
    stages: [
      {
        id: 'wl',
        name: 'Allowlist',
        kind: 'allowlist',
        start: '2026-10-01T00:00:00.000Z',
        end: '2026-10-15T00:00:00.000Z',
        priceHbar: '50',
        snapshotRef: 'allowlist-snapshot.json',
      },
      {
        id: 'pub',
        name: 'Public',
        kind: 'public',
        start: '2026-10-15T00:00:00.000Z',
        end: '2026-11-01T00:00:00.000Z',
        priceHbar: '100',
      },
    ],
    allowlistSnapshotRef: 'allowlist-snapshot.json',
  };
}

/** Legacy tinies collection used by authenticity claim fixture (max 888). */
export function fixtureTiniesCollection(): CollectionConfig {
  return {
    collectionId: 'tinies-genesis',
    name: 'Tinies Genesis',
    symbol: 'TINY',
    creator: 'Vera Labs',
    description: 'Fixture Tinies collection for authenticity receipts.',
    maxEdition: 888,
    maxSupply: 888,
    hrlTopic: FIXTURE_TOPIC_PLACEHOLDER,
    tiers: [{ key: 'genesis', name: 'Genesis', count: 888 }],
    stages: [
      { id: 'wl', name: 'Allowlist', kind: 'allowlist', priceHbar: '50' },
      { id: 'pub', name: 'Public', kind: 'public', priceHbar: '100' },
    ],
    allowlistSnapshotRef: 'allowlist-snapshot.json',
  };
}

export function fixtureAllowlistSnapshot(publishedAt = 1_700_000_000_000): AllowlistSnapshot {
  const entries = [
    ...parseHolderCsv(HOLDERS_WOLVES_CSV),
    ...parseHolderCsv(HOLDERS_TINIES_CSV),
  ];
  return mergeAllowlists(entries, publishedAt);
}

export function fixtureInscription() {
  return planHcs1Inscription({
    content: FIXTURE_IMAGE_BYTES,
    mimeType: 'image/png',
    topicIdPlaceholder: FIXTURE_TOPIC_PLACEHOLDER,
    chunkBytes: 32,
  });
}

export function fixtureMetadata(overrides?: Partial<HashinalNftMetadata>): HashinalNftMetadata {
  const inscription = fixtureInscription();
  const base = buildHashinalMetadata({
    name: 'Tiny #1',
    description: 'Fixture Hashinal NFT for offline authenticity demo.',
    creator: 'Vera Labs',
    image: `fixture://image/${FIXTURE_IMAGE_HASH.slice(0, 16)}`,
    contentHash: FIXTURE_IMAGE_HASH,
    hrl: inscription.hrl,
    edition: 1,
    maxEdition: 888,
    format: 'image/png',
    type: 'image',
    attributes: [
      { trait_type: 'Series', value: 'Genesis' },
      { trait_type: 'Rarity', value: 'Common' },
    ],
  });
  return { ...base, ...overrides };
}

export function fixtureClaim(overrides?: Partial<AuthenticityClaim>): AuthenticityClaim {
  const meta = fixtureMetadata();
  const snapshot = fixtureAllowlistSnapshot();
  const collection = fixtureTiniesCollection();
  return {
    claimId: 'claim-tiny-001',
    collectionId: collection.collectionId,
    creator: meta.creator,
    edition: meta.edition,
    maxEdition: meta.maxEdition,
    contentHash: meta.contentHash,
    metadataHash: metadataHashFor(meta),
    hrl: meta.hrl,
    allowlistSnapshotHash: snapshot.snapshotHash,
    minterAccount: '0.0.2001',
    ...overrides,
  };
}
