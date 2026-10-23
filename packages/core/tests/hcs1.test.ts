import {
  buildHcs1Memo,
  chunkContent,
  hcs1DataPrefix,
  isValidHcs1Memo,
  parseHcs1Memo,
  planHcs1Inscription,
  reassembleChunks,
  sha256,
} from '../src/index.js';
import {
  decodeHcs1Messages,
  encodeHcs1Payload,
  serializeHcs1Message,
} from '../src/hcs1-hol.js';

describe('hcs1 fixtures', () => {
  it('chunks and reassembles', () => {
    const buf = Buffer.from('hello hashinal inscription payload');
    const chunks = chunkContent(buf, 8);
    expect(chunks.length).toBeGreaterThan(1);
    expect(reassembleChunks(chunks).equals(buf)).toBe(true);
  });

  it('plans stubbed inscription with HRL', () => {
    const content = Buffer.from('image-bytes');
    const plan = planHcs1Inscription({
      content,
      mimeType: 'image/png',
      topicIdPlaceholder: '0.0.42',
      chunkBytes: 4,
    });
    expect(plan.hrl).toBe('hcs://1/0.0.42');
    expect(plan.contentHash).toBe(sha256(content));
    expect(plan.liveInscription).toBe('stubbed');
  });
});

describe('hcs1 HOL encode/decode', () => {
  it('builds and validates memo', () => {
    const hash = 'a'.repeat(64);
    const memo = buildHcs1Memo(hash);
    expect(memo).toBe(`${hash}:zstd:base64`);
    expect(isValidHcs1Memo(memo)).toBe(true);
    expect(parseHcs1Memo(memo).contentHash).toBe(hash);
    expect(isValidHcs1Memo('nope')).toBe(false);
  });

  it('data prefix includes mime and comma', () => {
    expect(hcs1DataPrefix('image/png')).toBe('data:image/png;base64,');
    expect(hcs1DataPrefix('application/json')).toBe('data:application/json;base64,');
  });

  it('round-trips small JSON via zstd+base64 chunks', async () => {
    const raw = Buffer.from(
      JSON.stringify({
        name: 'Nodeling HCS-1 smoke',
        protocol: 'Hashinal',
        hrlPattern: 'hcs://1/<topicId>',
        note: 'offline encode/decode unit test',
      }),
      'utf8',
    );
    const encoded = await encodeHcs1Payload({
      content: raw,
      mimeType: 'application/json',
    });
    expect(encoded.contentHash).toBe(sha256(raw));
    expect(encoded.memo).toBe(`${encoded.contentHash}:zstd:base64`);
    expect(encoded.chunkCount).toBeGreaterThanOrEqual(1);
    expect(encoded.messages[0].o).toBe(0);
    expect(encoded.messages[0].c.startsWith('data:application/json;base64,')).toBe(true);
    for (const m of encoded.messages) {
      const json = serializeHcs1Message(m);
      expect(Buffer.byteLength(json, 'utf8')).toBeLessThanOrEqual(1024);
    }

    const decoded = await decodeHcs1Messages({
      messages: encoded.messages,
      memo: encoded.memo,
      expectedMimeType: 'application/json',
    });
    expect(decoded.contentHash).toBe(encoded.contentHash);
    expect(decoded.mimeType).toBe('application/json');
    expect(decoded.raw.equals(raw)).toBe(true);
  });

  it('round-trips multi-chunk payload and unsorted messages', async () => {
    const raw = Buffer.alloc(8000);
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 17 + 31) & 0xff;
    const encoded = await encodeHcs1Payload({
      content: raw,
      mimeType: 'application/octet-stream',
      maxChunkContentChars: 200,
    });
    expect(encoded.chunkCount).toBeGreaterThan(1);

    const shuffled = [...encoded.messages].reverse();
    const decoded = await decodeHcs1Messages({
      messages: shuffled,
      memo: encoded.memo,
    });
    expect(decoded.raw.equals(raw)).toBe(true);
  });

  it('fails checksum on tampered memo', async () => {
    const raw = Buffer.from('tamper-check');
    const encoded = await encodeHcs1Payload({
      content: raw,
      mimeType: 'text/plain',
    });
    const badMemo = buildHcs1Memo('b'.repeat(64));
    await expect(
      decodeHcs1Messages({ messages: encoded.messages, memo: badMemo }),
    ).rejects.toThrow(/checksum mismatch/);
  });
});
