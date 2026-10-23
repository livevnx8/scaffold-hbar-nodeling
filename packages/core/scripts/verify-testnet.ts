/**
 * Read-only Hedera TESTNET re-verify of known Nodeling smoke ids.
 * No keys required. No txs. Exit 0 iff all checks PASS.
 *
 * Usage: npm run verify:testnet
 *
 * Defaults (override via env):
 *   NODELING_SMOKE_TOPIC_ID=0.0.11144977   # HCS-1 file topic (linked)
 *   NODELING_SMOKE_TOKEN_ID=0.0.11146645   # linked Hashinal smoke NFT
 *   NODELING_SMOKE_SERIAL=1
 *   NODELING_SMOKE_HRL=hcs://1/0.0.11144977
 *   NODELING_HCS1_TOPIC_ID=0.0.11144977
 *   NODELING_HCS1_HASH=05fe3924838f8954e89000a338bb699f59a41f5c9233790df91cd665c0632a04
 *   NODELING_REGISTRY_ADDRESS=0xF19e3390933b318808a0df5Ed4fbD18783f10234
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeHcs1Messages } from '../src/hcs1-hol.js';
import type { Hcs1MessageChunk } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(__dirname, '..');
const TMP_DIR = resolve(CORE_ROOT, 'tmp');
const RESULT_JSON = join(TMP_DIR, 'testnet-verify-result.json');
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const HASHSCAN = 'https://hashscan.io/testnet';
const RPC = process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api';

const DEFAULTS = {
  // Canonical linked Hashinal (2026-10-23). Historical empty-topic smoke: 0.0.11144787 / 0.0.11144786
  smokeTopic: '0.0.11144977',
  smokeToken: '0.0.11146645',
  smokeSerial: 1,
  smokeHrl: 'hcs://1/0.0.11144977',
  hcs1Topic: '0.0.11144977',
  hcs1Hash: '05fe3924838f8954e89000a338bb699f59a41f5c9233790df91cd665c0632a04',
  registry: '0xF19e3390933b318808a0df5Ed4fbD18783f10234',
  operator: '0.0.10729262',
};

type Check = { name: string; ok: boolean; detail: string; link?: string };

function env(name: string, fallback: string): string {
  const v = (process.env[name] || '').trim();
  return v || fallback;
}

async function mirrorJson(path: string): Promise<unknown> {
  const r = await fetch(`${MIRROR}${path}`);
  if (!r.ok) throw new Error(`mirror ${path} HTTP ${r.status}`);
  return r.json();
}

async function checkSmokeTopic(topicId: string): Promise<Check> {
  const d = (await mirrorJson(`/topics/${topicId}`)) as { topic_id?: string; memo?: string };
  const ok = d.topic_id === topicId;
  return {
    name: 'smoke_topic',
    ok,
    detail: ok ? `topic exists memo=${JSON.stringify(d.memo ?? '')}` : 'topic missing',
    link: `${HASHSCAN}/topic/${topicId}`,
  };
}

async function checkSmokeNft(
  tokenId: string,
  serial: number,
  expectedHrl: string,
): Promise<Check[]> {
  const token = (await mirrorJson(`/tokens/${tokenId}`)) as {
    token_id?: string;
    name?: string;
    symbol?: string;
    type?: string;
    max_supply?: string;
    total_supply?: string;
  };
  const nft = (await mirrorJson(`/tokens/${tokenId}/nfts/${serial}`)) as {
    serial_number?: number;
    metadata?: string;
    deleted?: boolean;
    account_id?: string;
  };
  const metaUtf8 = nft.metadata
    ? Buffer.from(nft.metadata, 'base64').toString('utf8')
    : '';
  const checks: Check[] = [
    {
      name: 'smoke_token',
      ok:
        token.token_id === tokenId &&
        token.type === 'NON_FUNGIBLE_UNIQUE' &&
        token.name === 'Nodeling Smoke' &&
        token.symbol === 'NDLS',
      detail: `name=${token.name} symbol=${token.symbol} type=${token.type} supply=${token.total_supply}/${token.max_supply}`,
      link: `${HASHSCAN}/token/${tokenId}`,
    },
    {
      name: 'smoke_nft_metadata',
      ok: !nft.deleted && metaUtf8 === expectedHrl && nft.serial_number === serial,
      detail: `serial=${nft.serial_number} account=${nft.account_id} metadata_utf8=${metaUtf8}`,
      link: `${HASHSCAN}/token/${tokenId}/${serial}`,
    },
  ];
  return checks;
}

async function checkHcs1(topicId: string, expectedHash: string): Promise<Check> {
  const topic = (await mirrorJson(`/topics/${topicId}`)) as {
    topic_id?: string;
    memo?: string;
    admin_key?: unknown;
    submit_key?: unknown;
  };
  if (topic.topic_id !== topicId) {
    return { name: 'hcs1_inscription', ok: false, detail: 'topic missing', link: `${HASHSCAN}/topic/${topicId}` };
  }
  const memo = topic.memo || '';
  const msgs = (await mirrorJson(`/topics/${topicId}/messages?order=asc&limit=25`)) as {
    messages?: Array<{ message?: string }>;
  };
  const chunks: Hcs1MessageChunk[] = [];
  for (const m of msgs.messages || []) {
    if (!m.message) continue;
    try {
      const parsed = JSON.parse(Buffer.from(m.message, 'base64').toString('utf8')) as {
        o?: unknown;
        c?: unknown;
      };
      if (typeof parsed.o === 'number' && typeof parsed.c === 'string') {
        chunks.push({ o: parsed.o, c: parsed.c });
      }
    } catch {
      // skip
    }
  }
  try {
    const decoded = await decodeHcs1Messages({
      messages: chunks,
      memo,
      expectedMimeType: 'image/png',
    });
    const ok =
      decoded.contentHash === expectedHash &&
      topic.admin_key == null &&
      topic.submit_key != null;
    return {
      name: 'hcs1_inscription',
      ok,
      detail: ok
        ? `PASS chunks=${chunks.length} sha256=${decoded.contentHash} mime=${decoded.mimeType} bytes=${decoded.raw.length} memo_ok submit_key_set admin_key_absent`
        : `FAIL hash=${decoded.contentHash} expected=${expectedHash} admin=${topic.admin_key} submit=${!!topic.submit_key}`,
      link: `${HASHSCAN}/topic/${topicId}`,
    };
  } catch (e) {
    return {
      name: 'hcs1_inscription',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
      link: `${HASHSCAN}/topic/${topicId}`,
    };
  }
}

async function checkRegistry(address: string): Promise<Check[]> {
  const mirror = (await mirrorJson(`/contracts/${address}`)) as {
    contract_id?: string;
    evm_address?: string;
    deleted?: boolean;
  };
  const checks: Check[] = [
    {
      name: 'registry_mirror',
      ok: !mirror.deleted && !!mirror.contract_id,
      detail: `contract_id=${mirror.contract_id} evm=${mirror.evm_address} deleted=${mirror.deleted}`,
      link: `${HASHSCAN}/contract/${address}`,
    },
  ];

  // eth_getCode + operator() via eth_call (ethers-encoded selector)
  try {
    const codeBody = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getCode',
      params: [address, 'latest'],
    };
    const codeRes = (await (
      await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(codeBody),
      })
    ).json()) as { result?: string };
    const code = codeRes.result || '0x';
    const codeBytes = code === '0x' ? 0 : (code.length - 2) / 2;
    checks.push({
      name: 'registry_bytecode',
      ok: codeBytes > 100,
      detail: `code_bytes=${codeBytes}`,
    });

    // operator() selector = 0x570ca735
    const callBody = {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_call',
      params: [{ to: address, data: '0x570ca735' }, 'latest'],
    };
    const callRes = (await (
      await fetch(RPC, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(callBody),
      })
    ).json()) as { result?: string; error?: { message?: string } };
    if (callRes.error) {
      checks.push({
        name: 'registry_operator',
        ok: false,
        detail: callRes.error.message || 'eth_call failed',
      });
    } else {
      const raw = (callRes.result || '0x').replace(/^0x/, '');
      const op = raw.length >= 40 ? ('0x' + raw.slice(-40)) : '0x';
      checks.push({
        name: 'registry_operator',
        ok: /^0x[0-9a-fA-F]{40}$/.test(op) && op !== '0x' + '0'.repeat(40),
        detail: `operator=${op}`,
      });
    }
  } catch (e) {
    checks.push({
      name: 'registry_rpc',
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  // If a prior anchor:live result exists, verifyReceipt via eth_call
  const anchorPath = join(TMP_DIR, 'testnet-anchor-result.json');
  if (existsSync(anchorPath)) {
    try {
      const ar = JSON.parse(readFileSync(anchorPath, 'utf8')) as {
        claimId?: string;
        decisionHash?: string;
        verifyOk?: boolean;
      };
      if (ar.claimId && ar.decisionHash && /^0x[0-9a-fA-F]{64}$/.test(ar.decisionHash)) {
        const { createRequire } = await import('node:module');
        const require = createRequire(import.meta.url);
        const { Interface } = require('ethers') as typeof import('ethers');
        const iface = new Interface([
          'function verifyReceipt(string claimId, bytes32 decisionHash) view returns (bool)',
        ]);
        const data = iface.encodeFunctionData('verifyReceipt', [ar.claimId, ar.decisionHash]);
        const callRes = (await (
          await fetch(RPC, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 3,
              method: 'eth_call',
              params: [{ to: address, data }, 'latest'],
            }),
          })
        ).json()) as { result?: string };
        const word = (callRes.result || '0x').replace(/^0x/, '').padStart(64, '0');
        const ok = BigInt('0x' + word) === 1n;
        checks.push({
          name: 'registry_anchored_receipt',
          ok,
          detail: `claimId=${ar.claimId} verifyReceipt=${ok} (file verifyOk=${ar.verifyOk})`,
        });
      }
    } catch (e) {
      checks.push({
        name: 'registry_anchored_receipt',
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return checks;
}

async function main(): Promise<void> {
  const smokeTopic = env('NODELING_SMOKE_TOPIC_ID', DEFAULTS.smokeTopic);
  const smokeToken = env('NODELING_SMOKE_TOKEN_ID', DEFAULTS.smokeToken);
  const smokeSerial = Number(env('NODELING_SMOKE_SERIAL', String(DEFAULTS.smokeSerial)));
  const smokeHrl = env('NODELING_SMOKE_HRL', DEFAULTS.smokeHrl);
  const hcs1Topic = env('NODELING_HCS1_TOPIC_ID', DEFAULTS.hcs1Topic);
  const hcs1Hash = env('NODELING_HCS1_HASH', DEFAULTS.hcs1Hash);
  const registry = env('NODELING_REGISTRY_ADDRESS', DEFAULTS.registry);
  const operator = env('HEDERA_OPERATOR_ID', DEFAULTS.operator);

  console.log('Nodeling — read-only TESTNET re-verify');
  console.log(`Operator (info): ${operator}`);
  console.log('No keys used. No transactions.\n');

  const checks: Check[] = [];
  checks.push(await checkSmokeTopic(smokeTopic));
  checks.push(...(await checkSmokeNft(smokeToken, smokeSerial, smokeHrl)));
  checks.push(await checkHcs1(hcs1Topic, hcs1Hash));
  checks.push(...(await checkRegistry(registry)));

  // Linked Hashinal gap note (informational, does not fail suite)
  const linked =
    smokeHrl === `hcs://1/${hcs1Topic}`
      ? 'LINKED: smoke NFT HRL points at HCS-1 file topic'
      : `NOT LINKED: smoke NFT HRL=${smokeHrl} ≠ hcs://1/${hcs1Topic}. Historical empty-topic smoke was 0.0.11144787→0.0.11144786; canonical linked mint is 0.0.11146645→0.0.11144977.`;

  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? 'PASS' : 'FAIL';
    if (!c.ok) allOk = false;
    console.log(`${mark}  ${c.name}: ${c.detail}`);
    if (c.link) console.log(`      ${c.link}`);
  }
  console.log(`\nINFO  hashinal_link: ${linked}`);

  const result = {
    network: 'testnet',
    timestamp: new Date().toISOString(),
    ok: allOk,
    checks,
    hashinalLink: linked,
    ids: {
      smokeTopic,
      smokeToken,
      smokeSerial,
      smokeHrl,
      hcs1Topic,
      hcs1Hash,
      hcs1Hrl: `hcs://1/${hcs1Topic}`,
      registry,
      operator,
    },
  };
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nWrote ${RESULT_JSON}`);
  console.log(allOk ? '\n=== ALL CHECKS PASS ===' : '\n=== SOME CHECKS FAIL ===');
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error('verify:testnet failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
