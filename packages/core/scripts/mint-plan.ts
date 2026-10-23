/**
 * Print Hashinal TokenCreate + first TokenMint dry-run payloads after drop verify context.
 * Usage: npm run mint:plan
 */
import {
  FIXTURE_IMAGE_BYTES,
  fixtureAllowlistSnapshot,
  fixtureCollection,
  fixtureClaim,
  buildAuthenticityReceipt,
  FIXTURE_IMAGE_HASH,
  planHashinalMint,
  formatHashinalMintPlan,
  verifyAllowlistMembership,
} from '../src/index.js';

function main(): void {
  console.log('Nodeling — Hashinal mint plan (dry-run only)\n');

  const collection = fixtureCollection();
  const snapshot = fixtureAllowlistSnapshot();
  collection.allowlistSnapshotHash = snapshot.snapshotHash;

  const claim = fixtureClaim();
  const receipt = buildAuthenticityReceipt({
    claim,
    observedContentHash: FIXTURE_IMAGE_HASH,
    allowlistMember: verifyAllowlistMembership(snapshot, claim.minterAccount!),
    timestamp: 1_700_000_000_001,
  });

  const plan = planHashinalMint({
    collection,
    // Demo shows create + first mint; still plans all editions for supply check
    editions: undefined,
    hrl: `hcs://1/${collection.hrlTopic ?? '0.0.900001'}`,
    treasuryAccountId: collection.royalty?.collectorAccount ?? '0.0.8001',
    inscriptionContent: FIXTURE_IMAGE_BYTES,
    inscriptionMimeType: 'image/png',
    minterAccount: '0.0.2001',
    stageId: 'wl',
    snapshot,
    now: '2026-10-05T12:00:00.000Z',
    receipts: [receipt],
  });

  console.log(formatHashinalMintPlan(plan));
  console.log('\n--- TokenCreate payload (JSON) ---');
  console.log(JSON.stringify(plan.tokenCreate, null, 2));
  console.log('\n--- First TokenMint payload (JSON) ---');
  console.log(JSON.stringify(plan.tokenMints[0] ?? null, null, 2));
  console.log('\n--- Registry anchor stub (first) ---');
  console.log(JSON.stringify(plan.registryAnchors[0] ?? null, null, 2));

  if (plan.refused) {
    console.error('\nUnexpected REFUSED in demo mint:plan');
    process.exit(1);
  }
  if (!plan.tokenCreate || plan.tokenCreate.maxSupply !== collection.maxEdition) {
    console.error('maxSupply mismatch');
    process.exit(1);
  }
  if (!plan.tokenMints[0] || plan.tokenMints[0].metadata !== plan.hrl) {
    console.error('first mint metadata must equal HRL');
    process.exit(1);
  }

  console.log('\nLive HCS-1 / TokenCreate / TokenMint / registry: stubbed. See docs/going-to-testnet.md.');
}

main();
