/**
 * Gated Hedera TESTNET: AuthenticityRegistry.anchorReceipt + verifyReceipt.
 * Cheap (~0.05–1 HBAR). Does not TokenCreate.
 *
 * Refuses unless:
 *   - argv contains exact `--live`
 *   - HEDERA_NETWORK=testnet
 *   - HEDERA_OPERATOR_ID + HEDERA_OPERATOR_KEY
 *   - HEDERA_REGISTRY_ADDRESS
 *
 * Usage: npm run anchor:live -- --live
 * Optional: --claim-id <id>  --decision-hash 0x…64hex
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(CORE_ROOT, '../..');
const NEXTJS_ENV = resolve(REPO_ROOT, 'packages/nextjs/.env');
const TMP_DIR = resolve(CORE_ROOT, 'tmp');
const RESULT_JSON = join(TMP_DIR, 'testnet-anchor-result.json');
const DOCS_LOG = resolve(REPO_ROOT, 'docs/testnet-anchor-log.md');
const HASHSCAN = 'https://hashscan.io/testnet';
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';

function loadDotEnv(path: string): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
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
    if (!(key in process.env) || process.env[key] === '') process.env[key] = val;
  }
}

function refuse(msg: string, code = 2): never {
  console.error(`REFUSED: ${msg}`);
  process.exit(code);
}

function argValue(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  if (i < 0) return undefined;
  return argv[i + 1];
}

async function mirrorBalanceHbar(accountId: string): Promise<number> {
  const r = await fetch(`${MIRROR}/accounts/${accountId}`);
  if (!r.ok) throw new Error(`mirror account HTTP ${r.status}`);
  const d = (await r.json()) as { balance?: { balance?: number } };
  return Number(d.balance?.balance ?? 0) / 1e8;
}

async function main(): Promise<void> {
  loadDotEnv(NEXTJS_ENV);
  const argv = process.argv.slice(2);
  if (!argv.includes('--live')) {
    refuse('missing exact --live flag. Usage: npm run anchor:live -- --live');
  }
  const network = (process.env.HEDERA_NETWORK || '').trim().toLowerCase();
  if (network !== 'testnet') {
    refuse(`HEDERA_NETWORK must be "testnet" (got "${process.env.HEDERA_NETWORK ?? ''}")`);
  }
  const operatorId = (process.env.HEDERA_OPERATOR_ID || '').trim();
  const operatorKeyRaw = (process.env.HEDERA_OPERATOR_KEY || '').trim();
  const registry = (process.env.HEDERA_REGISTRY_ADDRESS || '').trim();
  const rpc = (process.env.HEDERA_RPC_URL || 'https://testnet.hashio.io/api').trim();
  if (!operatorId || !operatorKeyRaw) refuse('operator id/key missing');
  if (!/^0x[0-9a-fA-F]{40}$/.test(registry)) {
    refuse('HEDERA_REGISTRY_ADDRESS missing or invalid');
  }

  const claimId =
    argValue(argv, '--claim-id') ||
    `nodeling-smoke-${new Date().toISOString().slice(0, 10)}`;
  let decisionHash = argValue(argv, '--decision-hash');
  if (!decisionHash) {
    decisionHash =
      '0x' +
      createHash('sha256')
        .update(`nodeling-anchor:${claimId}:${operatorId}`)
        .digest('hex');
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(decisionHash)) {
    refuse('--decision-hash must be 0x + 64 hex');
  }

  console.log('Nodeling — gated TESTNET registry anchor');
  console.log(`Operator: ${operatorId}`);
  console.log(`Registry: ${registry}`);
  console.log(`claimId:  ${claimId}`);
  console.log(`decision: ${decisionHash}`);

  const bal0 = await mirrorBalanceHbar(operatorId);
  console.log(`Balance:  ${bal0.toFixed(4)} HBAR`);
  if (bal0 < 1) refuse(`balance ${bal0} too low for contract call`);

  const require = createRequire(import.meta.url);
  const { ethers } = require('ethers') as typeof import('ethers');
  const art = JSON.parse(
    readFileSync(
      resolve(REPO_ROOT, 'packages/hardhat/artifacts/contracts/AuthenticityRegistry.sol/AuthenticityRegistry.json'),
      'utf8',
    ),
  );

  let key = operatorKeyRaw;
  if (!key.startsWith('0x')) key = '0x' + key;
  const provider = new ethers.JsonRpcProvider(rpc);
  const wallet = new ethers.Wallet(key, provider);
  console.log(`EVM from: ${wallet.address}`);

  const c = new ethers.Contract(registry, art.abi, wallet);
  const onchainOp = await c.operator();
  if (onchainOp.toLowerCase() !== wallet.address.toLowerCase()) {
    refuse(
      `wallet ${wallet.address} is not registry operator ${onchainOp}`,
    );
  }

  // Skip if already anchored
  try {
    const existing = await c.getAnchor(claimId);
    console.log('Already anchored:', existing);
    const ok = await c.verifyReceipt(claimId, decisionHash);
    const result = {
      network: 'testnet',
      timestamp: new Date().toISOString(),
      operatorId,
      registry,
      claimId,
      decisionHash,
      alreadyAnchored: true,
      verifyOk: ok,
      txHash: null as string | null,
      balanceStartHbar: bal0,
      balanceEndHbar: bal0,
    };
    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
    console.log(ok ? 'VERIFY PASS (existing)' : 'VERIFY FAIL (hash mismatch on existing claim)');
    process.exit(ok ? 0 : 1);
  } catch {
    // unknown claim — proceed to anchor
  }

  console.log('Sending anchorReceipt…');
  const tx = await c.anchorReceipt(claimId, decisionHash, { gasLimit: 500_000 });
  console.log(`tx=${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`anchor tx failed status=${receipt?.status}`);
  }

  const ok = await c.verifyReceipt(claimId, decisionHash);
  const bal1 = await mirrorBalanceHbar(operatorId);
  const result = {
    network: 'testnet',
    timestamp: new Date().toISOString(),
    operatorId,
    registry,
    claimId,
    decisionHash,
    alreadyAnchored: false,
    verifyOk: ok,
    txHash: tx.hash,
    gasUsed: receipt.gasUsed?.toString?.() ?? String(receipt.gasUsed),
    balanceStartHbar: bal0,
    balanceEndHbar: bal1,
    links: {
      registry: `${HASHSCAN}/contract/${registry}`,
      tx: `${HASHSCAN}/transaction/${tx.hash}`,
    },
  };
  mkdirSync(TMP_DIR, { recursive: true });
  writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });

  const logMd = `# Nodeling testnet registry anchor log

Public ids only — no keys.

| Field | Value |
|-------|-------|
| When (UTC) | ${result.timestamp} |
| Network | testnet |
| Operator | \`${operatorId}\` |
| Registry | [\`${registry}\`](${result.links.registry}) |
| claimId | \`${claimId}\` |
| decisionHash | \`${decisionHash}\` |
| Tx | [${tx.hash}](${result.links.tx}) |
| verifyReceipt | **${ok ? 'PASS' : 'FAIL'}** |
| Balance | ${bal0.toFixed(4)} → ${bal1.toFixed(4)} HBAR |

Gated: \`npm run anchor:live -- --live\`. Result JSON (gitignored): \`packages/core/tmp/testnet-anchor-result.json\`
`;
  writeFileSync(DOCS_LOG, logMd, 'utf8');

  console.log(ok ? '\n=== ANCHOR + VERIFY PASS ===' : '\n=== ANCHOR OK BUT VERIFY FAIL ===');
  console.log(`Wrote ${RESULT_JSON}`);
  console.log(`Wrote ${DOCS_LOG}`);
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error('anchor:live failed:', e instanceof Error ? e.message : e);
  process.exit(1);
});
