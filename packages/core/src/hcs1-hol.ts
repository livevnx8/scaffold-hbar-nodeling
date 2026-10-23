/**
 * HOL HCS-1 encode/decode with zstd — **Node only** (native @mongodb-js/zstd).
 * Do not import from Next.js client bundles. Use `@nodeling/core/hcs1-hol`.
 *
 * Spec: https://hol.org/docs/standards/hcs-1/
 */
import { compress as zstdCompress, decompress as zstdDecompress } from '@mongodb-js/zstd';
import { sha256 } from './hash.js';
import {
  buildHcs1Memo,
  hcs1DataPrefix,
  parseHcs1Memo,
} from './hcs1.js';
import type {
  Hcs1DecodedPayload,
  Hcs1EncodedPayload,
  Hcs1MessageChunk,
} from './types.js';

/** HOL: `c` field max so entire JSON message stays ≤ 1024-byte HCS limit. */
export const HCS1_MAX_CHUNK_CONTENT_CHARS = 960;

export const HCS1_ZSTD_LEVEL = 10;

export class Hcs1Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'Hcs1Error';
  }
}

/**
 * HOL encode: zstd(level 10) → base64 → chunk into {"o","c"} with data: prefix on o=0.
 */
export async function encodeHcs1Payload(input: {
  content: Buffer | string;
  mimeType: string;
  maxChunkContentChars?: number;
  zstdLevel?: number;
}): Promise<Hcs1EncodedPayload> {
  const raw =
    typeof input.content === 'string' ? Buffer.from(input.content, 'utf8') : input.content;
  const mimeType = input.mimeType;
  const maxC = input.maxChunkContentChars ?? HCS1_MAX_CHUNK_CONTENT_CHARS;
  const level = input.zstdLevel ?? HCS1_ZSTD_LEVEL;

  const contentHash = sha256(raw);
  const memo = buildHcs1Memo(contentHash);
  const compressed = Buffer.from(await zstdCompress(raw, level));
  const b64 = compressed.toString('base64');
  const stream = `${hcs1DataPrefix(mimeType)}${b64}`;

  const messages: Hcs1MessageChunk[] = [];
  for (let offset = 0, o = 0; offset < stream.length; o++) {
    let take = Math.min(maxC, stream.length - offset);
    while (take > 0) {
      const candidate: Hcs1MessageChunk = { o, c: stream.slice(offset, offset + take) };
      const json = JSON.stringify(candidate);
      if (Buffer.byteLength(json, 'utf8') <= 1024) {
        messages.push(candidate);
        offset += take;
        break;
      }
      take -= 16;
    }
    if (take <= 0) {
      throw new Hcs1Error('Unable to fit HCS-1 chunk under 1024-byte message limit');
    }
  }

  return {
    contentHash,
    memo,
    mimeType,
    rawByteLength: raw.length,
    compressedByteLength: compressed.length,
    base64Length: b64.length,
    streamLength: stream.length,
    messages,
    chunkCount: messages.length,
  };
}

/**
 * Reassemble HOL chunks: sort by o, concat c, strip data: prefix, base64-decode, zstd-decompress.
 */
export async function decodeHcs1Messages(input: {
  messages: Hcs1MessageChunk[];
  memo?: string;
  expectedMimeType?: string;
}): Promise<Hcs1DecodedPayload> {
  if (!input.messages.length) {
    throw new Hcs1Error('No HCS-1 messages to decode');
  }
  const ordered = [...input.messages].sort((a, b) => a.o - b.o);
  for (let i = 0; i < ordered.length; i++) {
    if (ordered[i].o !== i) {
      throw new Hcs1Error(`Missing or duplicate chunk order at expected o=${i}`);
    }
    if (typeof ordered[i].c !== 'string') {
      throw new Hcs1Error(`Chunk o=${i} missing string c`);
    }
  }

  const combined = ordered.map((m) => m.c).join('');
  const dataMatch = /^data:([^;]+);base64,/.exec(combined);
  if (!dataMatch) {
    throw new Hcs1Error('HCS-1 stream missing data:<mime>;base64, prefix on reassembled c');
  }
  const mimeType = dataMatch[1];
  if (input.expectedMimeType && input.expectedMimeType !== mimeType) {
    throw new Hcs1Error(
      `MIME mismatch: expected ${input.expectedMimeType}, got ${mimeType}`,
    );
  }
  const b64 = combined.slice(dataMatch[0].length);
  let compressed: Buffer;
  try {
    compressed = Buffer.from(b64, 'base64');
  } catch {
    throw new Hcs1Error('HCS-1 base64 decode failed');
  }
  const raw = Buffer.from(await zstdDecompress(compressed));
  const contentHash = sha256(raw);

  if (input.memo) {
    const parsed = parseHcs1Memo(input.memo);
    if (parsed.algo !== 'zstd' || parsed.encoding !== 'base64') {
      throw new Hcs1Error(`Unsupported HCS-1 memo algo/encoding: ${input.memo}`);
    }
    if (parsed.contentHash !== contentHash) {
      throw new Hcs1Error(
        `HCS-1 checksum mismatch: memo=${parsed.contentHash} actual=${contentHash}`,
      );
    }
  }

  return { raw, contentHash, mimeType };
}

export function serializeHcs1Message(chunk: Hcs1MessageChunk): string {
  return JSON.stringify({ o: chunk.o, c: chunk.c });
}

// Re-export pure helpers for Node consumers of this entry
export {
  buildHcs1Memo,
  hcs1DataPrefix,
  isValidHcs1Memo,
  parseHcs1Memo,
} from './hcs1.js';
