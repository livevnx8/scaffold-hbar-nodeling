/**
 * Gated Hedera TESTNET smoke: TopicCreate → TokenCreate (NFT) → TokenMint (HRL metadata).
 *
 * Refuses unless:
 *   - argv contains exact `--live`
 *   - HEDERA_NETWORK=testnet
 *   - HEDERA_OPERATOR_ID + HEDERA_OPERATOR_KEY are set
 *
 * Never invoked by `npm run demo`, unit tests, or `mint:plan`.
 * Full HCS-1 file inscription stays stubbed — this smoke uses topic-as-HRL target.
 *
 * Usage: npm run mint:live -- --live
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AccountId,
  Client,
  Hbar,
  PrivateKey,
  Status,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
  TopicCreateTransaction,
} from '@hashgraph/sdk';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CORE_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(CORE_ROOT, '../..');
const NEXTJS_ENV = resolve(REPO_ROOT, 'packages/nextjs/.env');
const TMP_DIR = resolve(CORE_ROOT, 'tmp');
const RESULT_JSON = join(TMP_DIR, 'testnet-smoke-result.json');
const DOCS_LOG = resolve(REPO_ROOT, 'docs/testnet-smoke-log.md');
const MIRROR = 'https://testnet.mirrornode.hedera.com/api/v1';
const HASHSCAN = 'https://hashscan.io/testnet';
const MIN_REMAINING_HBAR = 2;
const MAX_SPEND_HBAR = 15; // TokenCreate ~$1 USD ≈ 12+ HBAR at current testnet FX
const TOKEN_NAME = 'Nodeling Smoke';
const TOKEN_SYMBOL = 'NDLS';
const MAX_SUPPLY = 1;

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
      'missing exact --live flag. Usage: npm run mint:live -- --live',
    );
  }
}

function assertEnv(): {
  operatorId: string;
  operatorKeyRaw: string;
  keyType: string;
} {
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
    refuse(`Only ECDSA keys supported in this smoke (got ${keyType})`);
  }
  return { operatorId, operatorKeyRaw, keyType };
}

function parseEcdsaKey(raw: string): PrivateKey {
  const hex = raw.startsWith('0x') || raw.startsWith('0X') ? raw.slice(2) : raw;
  return PrivateKey.fromStringECDSA(hex);
}

async function mirrorBalanceHbar(accountId: string): Promise<number> {
  const r = await fetch(`${MIRROR}/accounts/${accountId}`);
  if (!r.ok) throw new Error(`mirror account HTTP ${r.status}`);
  const d = (await r.json()) as { balance?: { balance?: number } };
  const tiny = d.balance?.balance ?? 0;
  return tiny / 1e8;
}

async function mirrorBalanceHbarSettled(
  accountId: string,
  prior: number,
  attempts = 8,
): Promise<number> {
  let last = await mirrorBalanceHbar(accountId);
  for (let i = 0; i < attempts; i++) {
    if (last < prior - 0.0001) return last;
    await new Promise((r) => setTimeout(r, 1500));
    last = await mirrorBalanceHbar(accountId);
  }
  return last;
}

function feeHbarFromRecord(rec: { transactionFee: { toBigNumber: () => { toNumber: () => number } } }): number {
  return rec.transactionFee.toBigNumber().toNumber();
}

function txLink(txId: string): string {
  // HashScan wants @ → - and dots in account kept; transaction ids like 0.0.x@seconds.nanos
  const enc = encodeURIComponent(txId);
  return `${HASHSCAN}/transaction/${enc}`;
}

async function main(): Promise<void> {
  loadDotEnv(NEXTJS_ENV);
  assertLiveGate(process.argv.slice(2));
  const { operatorId, operatorKeyRaw } = assertEnv();

  console.log('Nodeling — gated Hedera TESTNET smoke');
  console.log(`Operator: ${operatorId}`);
  console.log('Network:  testnet');
  console.log(
    'Note: full HCS-1 file inscription stubbed; TopicCreate topic becomes HRL target.\n',
  );

  const bal0 = await mirrorBalanceHbar(operatorId);
  console.log(`Starting balance: ${bal0.toFixed(4)} HBAR`);
  if (bal0 < MIN_REMAINING_HBAR + 1) {
    refuse(
      `balance ${bal0} HBAR too low (need headroom above ${MIN_REMAINING_HBAR} HBAR)`,
    );
  }

  const privateKey = parseEcdsaKey(operatorKeyRaw);
  const accountId = AccountId.fromString(operatorId);
  const client = Client.forTestnet();
  client.setOperator(accountId, privateKey);
  client.setDefaultMaxTransactionFee(new Hbar(20));

  const fees: { step: string; hbar: number; txId: string }[] = [];
  let totalFee = 0;

  const guardSpend = (step: string, fee: number) => {
    totalFee += fee;
    fees.push({ step, hbar: fee, txId: '' });
    if (totalFee > MAX_SPEND_HBAR) {
      refuse(`spent ${totalFee.toFixed(4)} HBAR exceeds ~${MAX_SPEND_HBAR} HBAR budget`);
    }
  };

  try {
    // a) TopicCreate → HRL
    console.log('1) TopicCreateTransaction…');
    const topicTx = await new TopicCreateTransaction()
      .setTopicMemo('Nodeling smoke HRL target (HCS-1 file inscription stubbed)')
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
    guardSpend('TopicCreate', topicFee);
    fees[fees.length - 1].txId = topicTxId;
    const hrl = `hcs://1/${topicId}`;
    console.log(`   topicId=${topicId}`);
    console.log(`   hrl=${hrl}`);
    console.log(`   tx=${topicTxId} fee=${topicFee.toFixed(6)} HBAR`);

    // b) TokenCreate NON_FUNGIBLE_UNIQUE FINITE (no custom fees)
    console.log('2) TokenCreateTransaction (NFT, no custom fees)…');
    const supplyKey = privateKey.publicKey;
    const tokenTx = await new TokenCreateTransaction()
      .setTokenName(TOKEN_NAME)
      .setTokenSymbol(TOKEN_SYMBOL)
      .setTokenMemo('Nodeling Hashinal smoke — metadata = UTF-8 HRL')
      .setTokenType(TokenType.NonFungibleUnique)
      .setSupplyType(TokenSupplyType.Finite)
      .setMaxSupply(MAX_SUPPLY)
      .setTreasuryAccountId(accountId)
      .setSupplyKey(supplyKey)
      .setAutoRenewAccountId(accountId)
      .setMaxTransactionFee(new Hbar(20))
      .freezeWith(client)
      .sign(privateKey);
    const tokenResp = await tokenTx.execute(client);
    const tokenRx = await tokenResp.getReceipt(client);
    const tokenRec = await tokenResp.getRecord(client);
    if (tokenRx.status !== Status.Success || !tokenRx.tokenId) {
      throw new Error(`TokenCreate status ${tokenRx.status.toString()}`);
    }
    const tokenId = tokenRx.tokenId.toString();
    const tokenTxId = tokenResp.transactionId.toString();
    const tokenFee = feeHbarFromRecord(tokenRec);
    guardSpend('TokenCreate', tokenFee);
    fees[fees.length - 1].txId = tokenTxId;
    console.log(`   tokenId=${tokenId}`);
    console.log(`   tx=${tokenTxId} fee=${tokenFee.toFixed(6)} HBAR`);

    // c) TokenMint metadata = UTF-8 HRL
    console.log('3) TokenMintTransaction (metadata = UTF-8 HRL)…');
    const metaBytes = Buffer.from(hrl, 'utf8');
    const mintTx = await new TokenMintTransaction()
      .setTokenId(tokenRx.tokenId)
      .setMetadata([metaBytes])
      .setMaxTransactionFee(new Hbar(2))
      .freezeWith(client)
      .sign(privateKey);
    const mintResp = await mintTx.execute(client);
    const mintRx = await mintResp.getReceipt(client);
    const mintRec = await mintResp.getRecord(client);
    if (mintRx.status !== Status.Success) {
      throw new Error(`TokenMint status ${mintRx.status.toString()}`);
    }
    const serials = (mintRx.serials ?? []).map((s) =>
      typeof s === 'number' ? s : Number(s.toString()),
    );
    const mintTxId = mintResp.transactionId.toString();
    const mintFee = feeHbarFromRecord(mintRec);
    guardSpend('TokenMint', mintFee);
    fees[fees.length - 1].txId = mintTxId;
    console.log(`   serials=${JSON.stringify(serials)}`);
    console.log(`   tx=${mintTxId} fee=${mintFee.toFixed(6)} HBAR`);

    // Balance check before optional registry
    const balMid = await mirrorBalanceHbar(operatorId);
    console.log(`\nMid balance: ${balMid.toFixed(4)} HBAR (spent ~${totalFee.toFixed(4)})`);

    const registryAddress: string | null = null;
    let registryNote =
      'skipped — run separately with: npm run deploy:testnet --workspace=@nodeling/hardhat';
    const headroom = balMid - MIN_REMAINING_HBAR;
    if (headroom >= 3) {
      registryNote =
        'eligible for deploy:testnet (sufficient headroom); not auto-run from mint:live — invoke hardhat separately';
    } else {
      registryNote = `low headroom ${headroom.toFixed(2)} HBAR (keep ≥${MIN_REMAINING_HBAR}); deploy later if desired`;
    }

    const balFinal = await mirrorBalanceHbarSettled(operatorId, bal0);
    const result = {
      network: 'testnet',
      operatorId,
      timestamp: new Date().toISOString(),
      note: 'Full HCS-1 file inscription stubbed; topicId used as Hashinal HRL target.',
      topicId,
      hrl,
      tokenId,
      tokenName: TOKEN_NAME,
      tokenSymbol: TOKEN_SYMBOL,
      maxSupply: MAX_SUPPLY,
      serials,
      metadataUtf8: hrl,
      fees,
      totalFeeHbar: totalFee,
      balanceStartHbar: bal0,
      balanceEndHbar: balFinal,
      registryAddress,
      registryNote,
      links: {
        topic: `${HASHSCAN}/topic/${topicId}`,
        token: `${HASHSCAN}/token/${tokenId}`,
        topicTx: txLink(topicTxId),
        tokenTx: txLink(tokenTxId),
        mintTx: txLink(mintTxId),
        account: `${HASHSCAN}/account/${operatorId}`,
      },
    };

    mkdirSync(TMP_DIR, { recursive: true });
    writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2) + '\n', {
      mode: 0o600,
    });

    const logMd = `# Nodeling testnet smoke log

Public ids only — no keys.

| Field | Value |
|-------|-------|
| When (UTC) | ${result.timestamp} |
| Network | testnet |
| Operator | \`${operatorId}\` |
| Topic | [\`${topicId}\`](${result.links.topic}) |
| HRL | \`${hrl}\` |
| Token | [\`${tokenId}\`](${result.links.token}) (\`${TOKEN_NAME}\` / \`${TOKEN_SYMBOL}\`, maxSupply=${MAX_SUPPLY}) |
| Serials | ${serials.join(', ') || '(none)'} |
| Topic tx | [${topicTxId}](${result.links.topicTx}) |
| TokenCreate tx | [${tokenTxId}](${result.links.tokenTx}) |
| TokenMint tx | [${mintTxId}](${result.links.mintTx}) |
| Fees (approx) | TopicCreate ${topicFee.toFixed(6)} + TokenCreate ${tokenFee.toFixed(6)} + TokenMint ${mintFee.toFixed(6)} ≈ **${totalFee.toFixed(4)} HBAR** |
| Balance | ${bal0.toFixed(4)} → ${balFinal.toFixed(4)} HBAR |
| Registry deploy | ${registryNote} |

## Notes

- Full HCS-1 file inscription remains stubbed; this smoke uses **topic-as-HRL** (\`hcs://1/<topicId>\`).
- NFT metadata bytes = UTF-8 encoding of that HRL string (Hashinal pattern).
- No custom royalty fees (lean smoke).
- Gated: \`npm run mint:live -- --live\` + \`HEDERA_NETWORK=testnet\` + operator env.
- Result JSON (gitignored): \`packages/core/tmp/testnet-smoke-result.json\`
`;
    writeFileSync(DOCS_LOG, logMd, 'utf8');

    console.log('\n=== SUCCESS ===');
    console.log(JSON.stringify({
      topicId,
      hrl,
      tokenId,
      serials,
      totalFeeHbar: totalFee,
      balanceEndHbar: balFinal,
      links: result.links,
      registryNote,
      resultJson: RESULT_JSON,
      docsLog: DOCS_LOG,
    }, null, 2));
  } finally {
    client.close();
  }
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  // Never dump key material — message only
  console.error('mint:live failed:', msg);
  process.exit(1);
});
