import { canonicalize, sha256 } from './hash.js';
import type { HashinalNftMetadata } from './types.js';

/** Canonicalize metadata for hashing (stable key order via canonicalize). */
export function canonicalizeMetadata(meta: HashinalNftMetadata): string {
  return canonicalize(meta);
}

export function metadataHashFor(meta: HashinalNftMetadata): string {
  return sha256(canonicalizeMetadata(meta));
}

/** Build Hashinal-style metadata with an HRL placeholder (offline). */
export function buildHashinalMetadata(input: {
  name: string;
  description: string;
  creator: string;
  image: string;
  contentHash: string;
  hrl: string;
  edition: number;
  maxEdition: number;
  format?: string;
  type?: string;
  files?: HashinalNftMetadata['files'];
  attributes?: HashinalNftMetadata['attributes'];
}): HashinalNftMetadata {
  if (input.edition < 1 || input.edition > input.maxEdition) {
    throw new Error(`edition ${input.edition} out of range 1..${input.maxEdition}`);
  }
  const files = input.files ?? [
    { uri: input.image, type: input.format ?? 'image/png' },
  ];
  return {
    name: input.name,
    description: input.description,
    creator: input.creator,
    type: input.type ?? 'image',
    format: input.format ?? 'image/png',
    image: input.image,
    files,
    edition: input.edition,
    maxEdition: input.maxEdition,
    contentHash: input.contentHash,
    hrl: input.hrl,
    attributes: input.attributes,
  };
}
