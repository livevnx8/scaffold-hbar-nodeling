/**
 * Nodeling — offline demo (no credentials, no network)
 *
 * GREEN: fixture NFT → Hashinal metadata with HRL → authenticity receipt verified
 * RED:   tampered file hash
 * RED:   wrong edition
 * RED:   forged allowlist membership
 *
 * Usage: npm run demo
 */

import {
  FIXTURE_IMAGE_BYTES,
  FIXTURE_IMAGE_HASH,
  buildAuthenticityReceipt,
  fixtureAllowlistSnapshot,
  fixtureClaim,
  fixtureCollection,
  fixtureInscription,
  fixtureMetadata,
  formatHashinalMintPlan,
  metadataHashFor,
  planHashinalMint,
  planTokenCreate,
  planTokenMint,
  sha256,
  verifyAllowlistMembership,
  verifyAuthenticityReceipt,
  verifySnapshotIntegrity,
} from '../src/index.js';
import type { AuthenticityReceipt } from '../src/index.js';

function printReceipt(label: string, color: 'GREEN' | 'RED', receipt: AuthenticityReceipt): void {
  console.log(`\n=== ${color}: ${label} ===`);
  for (const c of receipt.checks) {
    console.log(`  [${c.ok ? 'PASS' : 'FAIL'}] ${c.name}: ${c.detail}`);
  }
  console.log(`\nReceipt ${receipt.claimId}: verdict=${receipt.verdict}`);
  console.log(`  taskHash:     ${receipt.taskHash}`);
  console.log(`  decisionHash: ${receipt.decisionHash}`);
  const v = verifyAuthenticityReceipt(receipt);
  console.log(`Independent verify: ${v.ok ? 'OK' : 'FAIL'}`);
  if (color === 'RED') {
    console.log(
      '(RED) Refusal is the feature: a tampered file, bad edition, or forged allowlist cannot silently become verified.',
    );
  }
}

function main(): void {
  console.log('Nodeling — offline Hashinal authenticity demo');
  console.log('Plan: GREEN (fixture) → RED (tampered file) → RED (wrong edition) → RED (forged allowlist)');

  const collection = fixtureCollection();
  const inscription = fixtureInscription();
  const meta = fixtureMetadata();
  const snapshot = fixtureAllowlistSnapshot();

  console.log('\n--- Collection / inscription plan (dry-run) ---');
  console.log(`Collection: ${collection.name} (${collection.symbol}) maxSupply=${collection.maxSupply}`);
  console.log(`Stages: ${collection.stages.map((s) => `${s.name}/${s.kind}@${s.priceHbar}ℏ`).join(', ')}`);
  console.log(`HCS-1 plan: hrl=${inscription.hrl} chunks=${inscription.chunks.length} live=${inscription.liveInscription}`);
  console.log(`Image contentHash: ${FIXTURE_IMAGE_HASH}`);
  console.log(`Metadata hash:     ${metadataHashFor(meta)}`);

  const createPlan = planTokenCreate(collection, inscription.hrl);
  const thinMint = planTokenMint({ metadataHrl: inscription.hrl, serialPlaceholder: 1 });
  console.log(`TokenCreate (dry-run): ${createPlan.name}/${createPlan.symbol} dryRun=${createPlan.dryRun}`);
  console.log(`TokenMint   (dry-run): token=${thinMint.tokenIdPlaceholder} serial=#${thinMint.serialPlaceholder}`);

  console.log('\n--- Multi-collection allowlist ---');
  console.log(`Collections merged: ${snapshot.collections.join(', ')}`);
  console.log(`Unique accounts:    ${snapshot.accounts.length}`);
  console.log(`Snapshot sha256:    ${snapshot.snapshotHash}`);
  console.log(`Integrity:          ${verifySnapshotIntegrity(snapshot) ? 'OK' : 'FAIL'}`);
  console.log(`0.0.2001 member?:   ${verifyAllowlistMembership(snapshot, '0.0.2001')}`);
  console.log(`0.0.9999 member?:   ${verifyAllowlistMembership(snapshot, '0.0.9999')}`);

  const claim = fixtureClaim();
  const green = buildAuthenticityReceipt({
    claim,
    observedContentHash: FIXTURE_IMAGE_HASH,
    allowlistMember: verifyAllowlistMembership(snapshot, claim.minterAccount!),
    timestamp: 1_700_000_000_001,
  });
  printReceipt('Valid fixture Nodeling Hashinal NFT', 'GREEN', green);
  if (green.verdict !== 'verified') throw new Error('Expected GREEN case to verify');

  const tamperedHash = sha256(Buffer.from('tampered-bytes', 'utf8'));
  const redFile = buildAuthenticityReceipt({
    claim: { ...claim, claimId: 'claim-tiny-001-tampered-file' },
    observedContentHash: tamperedHash,
    allowlistMember: true,
    timestamp: 1_700_000_000_002,
  });
  printReceipt('Tampered file content hash', 'RED', redFile);
  if (redFile.verdict !== 'rejected') throw new Error('Expected RED tampered file');

  const redEdition = buildAuthenticityReceipt({
    claim: { ...claim, claimId: 'claim-tiny-001-bad-edition', edition: 9999 },
    observedContentHash: FIXTURE_IMAGE_HASH,
    allowlistMember: true,
    timestamp: 1_700_000_000_003,
  });
  printReceipt('Wrong edition (out of range)', 'RED', redEdition);
  if (redEdition.verdict !== 'rejected') throw new Error('Expected RED wrong edition');

  const redAllow = buildAuthenticityReceipt({
    claim: {
      ...claim,
      claimId: 'claim-tiny-001-forged-allowlist',
      minterAccount: '0.0.9999',
    },
    observedContentHash: FIXTURE_IMAGE_HASH,
    allowlistMember: verifyAllowlistMembership(snapshot, '0.0.9999'),
    timestamp: 1_700_000_000_004,
  });
  printReceipt('Forged allowlist membership', 'RED', redAllow);
  if (redAllow.verdict !== 'rejected') throw new Error('Expected RED forged allowlist');

  const forgedSnap = { ...snapshot, snapshotHash: 'a'.repeat(64) };
  console.log(`\nForged snapshot integrity: ${verifySnapshotIntegrity(forgedSnap) ? 'OK (bad)' : 'FAIL (expected)'}`);

  // Hashinal mint plan (dry-run) after authenticity checks
  const mintCollection = { ...collection, allowlistSnapshotHash: snapshot.snapshotHash };
  const hashinalPlan = planHashinalMint({
    collection: mintCollection,
    editions: [1, 2, 3],
    hrl: inscription.hrl,
    treasuryAccountId: collection.royalty?.collectorAccount ?? '0.0.8001',
    inscriptionContent: FIXTURE_IMAGE_BYTES,
    inscriptionMimeType: 'image/png',
    minterAccount: '0.0.2001',
    stageId: 'wl',
    snapshot,
    now: '2026-10-05T12:00:00.000Z',
    receipts: [green],
  });
  console.log('\n' + formatHashinalMintPlan(hashinalPlan));
  console.log('CREATE payload maxSupply=', hashinalPlan.tokenCreate?.maxSupply);
  console.log('FIRST MINT metadata=', hashinalPlan.tokenMints[0]?.metadata);
  if (hashinalPlan.refused || hashinalPlan.tokenMints[0]?.metadata !== inscription.hrl) {
    throw new Error('Expected successful mint plan with HRL metadata');
  }

  console.log('\n=== Demo complete ===');
  console.log(`Fixture image bytes: ${FIXTURE_IMAGE_BYTES.length} (deterministic placeholder)`);
  console.log('Live HCS-1 inscription + TokenCreate/TokenMint: stubbed (dry-run). Phase 2: music drops.');
  console.log('List on SentX DreamForge / HashPack after mint — this pad is not a marketplace.');
  console.log('Next: npm run drop:build (default COLLECTION=tinies real art) → examples/tinies-drop/ + receipts.');
  console.log('Also: COLLECTION=nodlings|demo|all npm run drop:build');
  console.log('Also: npm run mint:plan — full create + first mint JSON payloads.');
}



main();
