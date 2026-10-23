/**
 * Gated Hedera TESTNET HCS-1 file inscription (HOL / hiero).
 *
 * Refuses unless:
 *   - argv contains exact `--live`
 *   - HEDERA_NETWORK=testnet
 *   - HEDERA_OPERATOR_ID + HEDERA_OPERATOR_KEY are set
 *
 * Does NOT TokenCreate / TokenMint (expensive). TopicCreate + TopicMessageSubmit only.
 *
 * Usage: npm run inscribe:live -- --live
 */
import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  Status,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from '@hashgraph/sdk';
import type { Hcs1MessageChunk } from '../src/index.js';
import {
  decodeHcs1Messages,
  encodeHcs1Payload,
  serializeHcs1Message,
} from '../src/hcs1-hol.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(CORE_ROOT, '../..');
const NEXTJS_ENV = resolve(REPO_ROOT, 'packages/nextjs/.env');
const TMP_DIR = resolve(CORE_ROOT, 'tmp');
const RESULT_JSON = join(TMP_DIR, 'testnet-hcs1-result.json');
const DOCS_LOG = resolve(REPO_ROOT, 'docs/testnet-hcs1-inscribe-log.md');
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const HASHSCAN = 'https://hashscan.io/testnet';
const MIN_REMAINING_HBAR = 2;

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === '') {
      process.env[key] = val;
    }
  }
}

function refuse(msg: string, code = 2): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(code);
}

function assertLiveGate(argv: string[]): void {
  if (!argv.includes('--live')) {
    refuse(
      'missing exact --live flag. Usage: npm run inscribe:live -- --live',
    );
  }
}

function assertEnv(): { operatorId: string; operatorKeyRaw: string } {
  const network = (process.env.HEDERA_NETWORK || '').trim().toLowerCase();
  if (network !== 'testnet') {
    refuse(
      `HEDERA_NETWORK must be "testnet" (got "${process.env.HEDERA_NETWORK ?? ''}"). Mainnet refused.`,
    );
  }
  const operatorId = (process.env.HEDERA_OPERATOR_ID || '').trim();
  const operatorKeyRaw = (process.env.HEDERA_OPERATOR_KEY || '').trim();
  const keyType = (process.env.HEDERA_KEY_TYPE || 'ECDSA').trim().toUpperCase();
  if (!operatorId || !/^0\.0\.\d+$/.test(operatorId)) {
    refuse('HEDERA_OPERATOR_ID missing or invalid');
  }
  if (!operatorKeyRaw) {
    refuse('HEDERA_OPERATOR_KEY missing');
  }
  if (keyType !== 'ECDSA') {
    refuse(`Only ECDSA keys supported (got ${keyType})`);
  }
  return { operatorId, operatorKeyRaw };
}

function parseEcdsaKey(raw: string): PrivateKey {
  const hex = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw;
  return PrivateKey.fromStringECDSA(hex);
}

async function mirrorBalanceHbar(accountId: string): Promise<number> {
  const r = await fetch(`${MIRROR}/accounts/${accountId}`);
  if (!r.ok) throw new Error(`mirror account HTTP ${r.status}`);
  const d = (await r.json()) as { balance?: { balance?: number } };
  return (d.balance?.balance ?? 0) / 1e8;
}

async function mirrorBalanceSettled(
  accountId: string,
  prior: number,
  attempts = 10,
): Promise<number> {
  let last = await mirrorBalanceHbar(accountId);
  for (let i = 0; i < attempts; i++) {
    if (last < prior - 0.0001) return last;
    await new Promise((r) => setTimeout(r, 1500));
    last = await mirrorBalanceHbar(accountId);
  }
  return last;
}

function feeHbarFromRecord(rec: {
  transactionFee: { toBigNumber: () => { toNumber: () => number } };
}): number {
  return rec.transactionFee.toBigNumber().toNumber();
}

function txLink(txId: string): string {
  return `${HASHSCAN}/transaction/${encodeURIComponent(txId)}`;
}

/** Minimal valid 16×16 RGB PNG (solid Vera-ish purple). */
function makeTinyPng16(): Buffer {
  const width = 16;
  const height = 16;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * 3;
      raw[i] = 0x6b; // R
      raw[i + 1] = 0x2d; // G
      raw[i + 2] = 0xc2; // B
    }
  }
  const compressed = deflateSync(raw);

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  })();
  const crc32 = (buf: Buffer): number => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer): Buffer => {
    const typeBuf = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function fetchTopicMessages(
  topicId: string,
): Promise<Array<{ message?: string; sequence_number?: number }>> {
  const all: Array<{ message?: string; sequence_number?: number }> = [];
  let url: string | null =
    `${MIRROR}/topics/${topicId}/messages?limit=100&order=asc`;
  for (let page = 0; page < 20 && url; page++) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`mirror messages HTTP ${r.status}`);
    const d = (await r.json()) as {
      messages?: Array<{ message?: string; sequence_number?: number }>;
      links?: { next?: string | null };
    };
    all.push(...(d.messages ?? []));
    const next = d.links?.next;
    url = next
      ? next.startsWith('http')
        ? next
        : `${MIRROR.replace('/api/v1', '')}${next.startsWith('/') ? '' : '/'}${next}`
      : null;
    // mirror next links are often absolute or /api/v1/...
    if (next && next.startsWith('/api/v1')) {
      url = `https://testnet.mirrornode.hedera.com${next}`;
    }
  }
  return all;
}

async function verifyFromMirror(
  topicId: string,
  memo: string,
  expectedHash: string,
  expectedMime: string,
): Promise<{ ok: boolean; detail: string; recoveredHash?: string }> {
  // Poll until messages appear
  let rawMessages: Array<{ message?: string }> = [];
  for (let i = 0; i < 20; i++) {
    rawMessages = await fetchTopicMessages(topicId);
    if (rawMessages.length > 0) break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!rawMessages.length) {
    return { ok: false, detail: 'no messages on mirror yet' };
  }

  const chunks: Hcs1MessageChunk[] = [];
  for (const m of rawMessages) {
    if (!m.message) continue;
    const text = Buffer.from(m.message, 'base64').toString('utf8');
    try {
      const parsed = JSON.parse(text) as { o?: unknown; c?: unknown };
      if (typeof parsed.o === 'number' && typeof parsed.c === 'string') {
        chunks.push({ o: parsed.o, c: parsed.c });
      }
    } catch {
      // skip non-JSON
    }
  }
  if (!chunks.length) {
    return {
      ok: false,
      detail: `mirror had ${rawMessages.length} msgs but none parsed as HCS-1 JSON`,
    };
  }

  try {
    const decoded = await decodeHcs1Messages({
      messages: chunks,
      memo,
      expectedMimeType: expectedMime,
    });
    if (decoded.contentHash !== expectedHash) {
      return {
        ok: false,
        detail: `hash mismatch recovered=${decoded.contentHash}`,
        recoveredHash: decoded.contentHash,
      };
    }
    return {
      ok: true,
      detail: `PASS: ${chunks.length} chunks, sha256 matches memo, mime=${decoded.mimeType}, bytes=${decoded.raw.length}`,
      recoveredHash: decoded.contentHash,
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main(): Promise<void> {
  loadDotEnv(NEXTJS_ENV);
  assertLiveGate(process.argv.slice(2));
  const { operatorId, operatorKeyRaw } = assertEnv();

  console.log('Nodeling — gated Hedera TESTNET HCS-1 file inscription');
  console.log(`Operator: ${operatorId}`);
  console.log('Network:  testnet');
  console.log('No TokenCreate/Mint — TopicCreate (submit key, no admin) + message submits.\n');

  const bal0 = await mirrorBalanceHbar(operatorId);
  console.log(`Starting balance: ${bal0.toFixed(4)} HBAR`);
  if (bal0 < MIN_REMAINING_HBAR + 0.5) {
    refuse(`balance ${bal0} too low (need headroom above ${MIN_REMAINING_HBAR} HBAR)`);
  }

  const fileBytes = makeTinyPng16();
  const mimeType = 'image/png';
  console.log(`Payload: 16×16 PNG, ${fileBytes.length} bytes uncompressed`);

  const encoded = await encodeHcs1Payload({ content: fileBytes, mimeType });
  console.log(
    `Encoded: zstd→${encoded.compressedByteLength}B, base64 ${encoded.base64Length} chars, chunks=${encoded.chunkCount}`,
  );
  console.log(`Memo: ${encoded.memo}`);
  console.log(`Hash: ${encoded.contentHash}`);

  const privateKey = parseEcdsaKey(operatorKeyRaw);
  const accountId = AccountId.fromString(operatorId);
  const client = Client.forTestnet();
  client.setOperator(accountId, privateKey);
  client.setDefaultMaxTransactionFee(new Hbar(2));

  const fees: { step: string; hbar: number; txId: string }[] = [];
  let totalFee = 0;

  const guard = (step: string, fee: number, txId: string) => {
    totalFee += fee;
    fees.push({ step, hbar: fee, txId });
    // Optimistic remaining check using start - spent (mirror lag)
    if (bal0 - totalFee < MIN_REMAINING_HBAR) {
      refuse(
        `would drop below ${MIN_REMAINING_HBAR} HBAR (spent ~${totalFee.toFixed(4)}); stopping`,
      );
    }
  };

  try {
    // TopicCreate: submit key = operator, NO admin key, memo = HCS-1
    console.log('1) TopicCreateTransaction (submit key, no admin, HCS-1 memo)…');
    const topicTx = await new TopicCreateTransaction()
      .setTopicMemo(encoded.memo)
      .setSubmitKey(privateKey.publicKey)
      // intentionally NO setAdminKey
      .setMaxTransactionFee(new Hbar(2))
      .freezeWith(client)
      .sign(privateKey);
    const topicResp = await topicTx.execute(client);
    const topicRx = await topicResp.getReceipt(client);
    const topicRec = await topicResp.getRecord(client);
    if (topicRx.status !== Status.Success || !topicRx.topicId) {
      throw new Error(`TopicCreate status ${topicRx.status.toString()}`);
    }
    const topicId = topicRx.topicId.toString();
    const topicTxId = topicResp.transactionId.toString();
    const topicFee = feeHbarFromRecord(topicRec);
    guard('TopicCreate', topicFee, topicTxId);
    const hrl = `hcs://1/${topicId}`;
    console.log(`   topicId=${topicId}`);
    console.log(`   hrl=${hrl}`);
    console.log(`   tx=${topicTxId} fee=${topicFee.toFixed(6)} HBAR`);

    // Submit each chunk (signed with submit key = operator)
    console.log(`2) TopicMessageSubmitTransaction × ${encoded.chunkCount}…`);
    const submitTxIds: string[] = [];
    for (const msg of encoded.messages) {
      const body = serializeHcs1Message(msg);
      const submitTx = await new TopicMessageSubmitTransaction()
        .setTopicId(topicRx.topicId)
        .setMessage(body)
        .setMaxTransactionFee(new Hbar(1))
        .freezeWith(client)
        .sign(privateKey);
      const submitResp = await submitTx.execute(client);
      const submitRx = await submitResp.getReceipt(client);
      const submitRec = await submitResp.getRecord(client);
      if (submitRx.status !== Status.Success) {
        throw new Error(
          `TopicMessageSubmit o=${msg.o} status ${submitRx.status.toString()}`,
        );
      }
      const txId = submitResp.transactionId.toString();
      const fee = feeHbarFromRecord(submitRec);
      guard(`TopicMessageSubmit:o=${msg.o}`, fee, txId);
      submitTxIds.push(txId);
      console.log(`   o=${msg.o} tx=${txId} fee=${fee.toFixed(6)} HBAR`);
    }

    console.log('3) Mirror verify (fetch → sort o → decode → sha256)…');
    const verify = await verifyFromMirror(
      topicId,
      encoded.memo,
      encoded.contentHash,
      mimeType,
    );
    console.log(`   ${verify.ok ? 'PASS' : 'FAIL'}: ${verify.detail}`);

    const balFinal = await mirrorBalanceSettled(operatorId, bal0);
    const result = {
      network: 'testnet',
      operatorId,
      timestamp: new Date().toISOString(),
      topicId,
      hrl,
      memo: encoded.memo,
      contentHash: encoded.contentHash,
      mimeType,
      rawByteLength: encoded.rawByteLength,
      compressedByteLength: encoded.compressedByteLength,
      chunkCount: encoded.chunkCount,
      fees,
      totalFeeHbar: totalFee,
      balanceStartHbar: bal0,
      balanceEndHbar: balFinal,
      verify: {
        ok: verify.ok,
        detail: verify.detail,
        recoveredHash: verify.recoveredHash ?? null,
      },
      links: {
        topic: `${HASHSCAN}/topic/${topicId}`,
        topicTx: txLink(topicTxId),
        submitTxs: submitTxIds.map(txLink),
        account: `${HASHSCAN}/account/${operatorId}`,
      },
      note: 'HOL HCS-1: memo=sha256:zstd:base64; submit key set; no admin key; chunks {"o","c"} with data:image/png;base64, prefix.',
    };

    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n', {
      mode: 0o600,
    });

    const logMd = `# Nodeling testnet HCS-1 inscription log

Public ids only — no keys.

| Field | Value |
|-------|-------|
| When (UTC) | ${result.timestamp} |
| Network | testnet |
| Operator | \`${operatorId}\` |
| Topic | [\`${topicId}\`](${result.links.topic}) |
| HRL | \`${hrl}\` |
| Memo | \`${encoded.memo}\` |
| Content sha256 | \`${encoded.contentHash}\` |
| MIME | \`${mimeType}\` (16×16 PNG, ${encoded.rawByteLength} bytes raw → ${encoded.compressedByteLength} zstd) |
| Chunks | ${encoded.chunkCount} |
| TopicCreate tx | [${topicTxId}](${result.links.topicTx}) |
| Fees (approx) | **${totalFee.toFixed(4)} HBAR** (TopicCreate + ${encoded.chunkCount} submits) |
| Balance | ${bal0.toFixed(4)} → **${balFinal.toFixed(4)} HBAR** |
| Mirror verify | **${verify.ok ? 'PASS' : 'FAIL'}** — ${verify.detail} |

## HOL compliance

- Topic memo = \`<sha256_of_raw>:zstd:base64\`
- Submit key set; **no** admin key
- Messages: JSON \`{"o":index,"c":"..."}\`; \`o=0\` starts with \`data:image/png;base64,\`
- Pipeline: zstd(level 10) → base64 → chunk ≤960 chars (JSON ≤1024 bytes) → \`TopicMessageSubmitTransaction\`

## Related (prior smoke, unchanged)

- Token \`0.0.11144787\` / topic \`0.0.11144786\` / registry \`0xF19e3390933b318808a0df5Ed4fbD18783f10234\`

Gated: \`npm run inscribe:live -- --live\`. Result JSON (gitignored): \`packages/core/tmp/testnet-hcs1-result.json\`
`;
    writeFileSync(DOCS_LOG, logMd, 'utf8');

    console.log('\n=== DONE ===');
    console.log(
      JSON.stringify(
        {
          topicId,
          hrl,
          contentHash: encoded.contentHash,
          chunkCount: encoded.chunkCount,
          totalFeeHbar: totalFee,
          balanceEndHbar: balFinal,
          verify: verify.ok ? 'PASS' : 'FAIL',
          verifyDetail: verify.detail,
          links: { topic: result.links.topic },
          resultJson: RESULT_JSON,
          docsLog: DOCS_LOG,
        },
        null,
        2,
      ),
    );

    if (!verify.ok) process.exit(1);
  } finally {
    client.close();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('inscribe:live failed:', msg);
  process.exit(1);
});
