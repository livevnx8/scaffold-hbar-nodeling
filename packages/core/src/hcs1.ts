/**
 * Offline HCS-1 inscription helpers (fixtures / dry-run only).
 * Browser-safe — no native zstd. HOL encode/decode: see ./hcs1-hol.js (Node).
 */
import { sha256 } from './hash.js';
import { buildHrl } from './hrl.js';
import type { Hcs1Chunk, Hcs1InscriptionPlan } from './types.js';

/** Default chunk size for fixture planning (bytes of raw content). */
export const DEFAULT_CHUNK_BYTES = 1024;

export const HCS1_MEMO_SUFFIX = ':zstd:base64';

/**
 * Split content into base64 HCS-1-style chunks (offline fixture helper).
 * Does not talk to Hedera.
 */
export function chunkContent(
  content: Buffer | string,
  chunkBytes = DEFAULT_CHUNK_BYTES,
): Hcs1Chunk[] {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  if (buf.length === 0) {
    return [{ index: 0, total: 1, data: Buffer.alloc(0).toString('base64') }];
  }
  const total = Math.ceil(buf.length / chunkBytes);
  const chunks: Hcs1Chunk[] = [];
  for (let i = 0; i < total; i++) {
    const slice = buf.subarray(i * chunkBytes, (i + 1) * chunkBytes);
    chunks.push({
      index: i,
      total,
      data: slice.toString('base64'),
    });
  }
  return chunks;
}

export function reassembleChunks(chunks: Hcs1Chunk[]): Buffer {
  const ordered = [...chunks].sort((a, b) => a.index - b.index);
  if (ordered.length === 0) return Buffer.alloc(0);
  const total = ordered[0].total;
  if (ordered.length !== total) {
    throw new Error(`chunk count ${ordered.length} != total ${total}`);
  }
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].index !== i || ordered[i].total !== total) {
      throw new Error(`chunk index/total mismatch at ${i}`);
    }
  }
  return Buffer.concat(ordered.map((c) => Buffer.from(c.data, 'base64')));
}

/**
 * Plan an HCS-1 inscription. Always returns liveInscription: 'stubbed'.
 */
export function planHcs1Inscription(input: {
  content: Buffer | string;
  mimeType: string;
  topicIdPlaceholder?: string;
  chunkBytes?: number;
}): Hcs1InscriptionPlan {
  const buf = typeof input.content === 'string' ? Buffer.from(input.content, 'utf8') : input.content;
  const topicIdPlaceholder = input.topicIdPlaceholder ?? '0.0.999999';
  const chunks = chunkContent(buf, input.chunkBytes ?? DEFAULT_CHUNK_BYTES);
  return {
    topicIdPlaceholder,
    hrl: buildHrl(topicIdPlaceholder),
    contentHash: sha256(buf),
    mimeType: input.mimeType,
    chunks,
    liveInscription: 'stubbed',
  };
}

/** Build HCS-1 topic memo: `<sha256_hex>:zstd:base64` (pure; no zstd). */
export function buildHcs1Memo(contentHashHex: string): string {
  const hash = contentHashHex.startsWith('0x') ? contentHashHex.slice(2) : contentHashHex;
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
    throw new Error(`Invalid content hash for HCS-1 memo: ${contentHashHex}`);
  }
  return `${hash.toLowerCase()}${HCS1_MEMO_SUFFIX}`;
}

export function parseHcs1Memo(memo: string): {
  contentHash: string;
  algo: string;
  encoding: string;
} {
  const parts = memo.split(':');
  if (parts.length !== 3) {
    throw new Error(`Invalid HCS-1 memo (want hash:algo:encoding): ${memo}`);
  }
  const [contentHash, algo, encoding] = parts;
  if (!/^[0-9a-fA-F]{64}$/.test(contentHash)) {
    throw new Error(`Invalid HCS-1 memo hash: ${contentHash}`);
  }
  return { contentHash: contentHash.toLowerCase(), algo, encoding };
}

export function isValidHcs1Memo(memo: string): boolean {
  try {
    const p = parseHcs1Memo(memo);
    return p.algo === 'zstd' && p.encoding === 'base64';
  } catch {
    return false;
  }
}

/** `data:<mimeType>;base64,` prefix for chunk o=0 */
export function hcs1DataPrefix(mimeType: string): string {
  if (!mimeType || /[\s,]/.test(mimeType)) {
    throw new Error(`Invalid mimeType for HCS-1: ${mimeType}`);
  }
  return `data:${mimeType};base64,`;
}
