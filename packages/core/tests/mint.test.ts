import {
  FIXTURE_IMAGE_BYTES,
  encodeHrlAsNftMetadata,
  fixtureAllowlistSnapshot,
  fixtureCollection,
  fixtureClaim,
  buildAuthenticityReceipt,
  FIXTURE_IMAGE_HASH,
  dryRunTokenCreate,
  dryRunTokenMint,
  dryRunRegistryAnchor,
  planHashinalMint,
  formatHashinalMintPlan,
  verifyAllowlistMembership,
  HASHINAL_METADATA_ENCODING_NOTE,
} from '../src/index.js';

describe('Hashinal mint payloads (dry-run)', () => {
  const collection = fixtureCollection();
  const snapshot = fixtureAllowlistSnapshot();
  const hrl = 'hcs://1/0.0.900001';

  test('encodeHrlAsNftMetadata is UTF-8 of the HRL', () => {
    const enc = encodeHrlAsNftMetadata(hrl);
    expect(enc.metadataUtf8).toBe(hrl);
    expect(enc.encoding).toBe('utf8');
    expect(enc.metadataByteLength).toBe(Buffer.from(hrl, 'utf8').length);
    expect(enc.metadataUtf8Hex).toBe(Buffer.from(hrl, 'utf8').toString('hex'));
    expect(enc.note).toContain('UTF-8');
  });

  test('dryRunTokenMint puts HRL in metadata', () => {
    const mint = dryRunTokenMint({ metadataHrl: hrl, edition: 1 });
    expect(mint.dryRun).toBe(true);
    expect(mint.metadata).toBe(hrl);
    expect(mint.metadataHrl).toBe(hrl);
    expect(mint.metadataUtf8).toBe(hrl);
    expect(mint.metadataUtf8Hex).toBe(Buffer.from(hrl, 'utf8').toString('hex'));
    expect(mint.summary).toContain(hrl);
  });

  test('dryRunTokenCreate supply matches maxEdition', () => {
    const create = dryRunTokenCreate({ collection, hrl });
    expect(create.dryRun).toBe(true);
    expect(create.supplyType).toBe('FINITE');
    expect(create.tokenType).toBe('NON_FUNGIBLE_UNIQUE');
    expect(create.maxSupply).toBe(collection.maxEdition);
    expect(create.maxSupply).toBe(collection.maxSupply);
    expect(create.name).toBe(collection.name);
    expect(create.symbol).toBe(collection.symbol);
    expect(create.collectionHrl).toBe(hrl);
  });

  test('planHashinalMint is deterministic and ordered', () => {
    const a = planHashinalMint({
      collection,
      editions: [3, 1, 2],
      hrl,
      treasuryAccountId: '0.0.8001',
      inscriptionContent: FIXTURE_IMAGE_BYTES,
      inscriptionMimeType: 'image/png',
    });
    const b = planHashinalMint({
      collection,
      editions: [3, 1, 2],
      hrl,
      treasuryAccountId: '0.0.8001',
      inscriptionContent: FIXTURE_IMAGE_BYTES,
      inscriptionMimeType: 'image/png',
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.dryRun).toBe(true);
    expect(a.liveSubmission).toBe('stubbed');
    expect(a.refused).toBe(false);
    expect(a.hrl).toBe(hrl);
    expect(a.tokenCreate?.maxSupply).toBe(8);
    expect(a.tokenMints).toHaveLength(3);
    expect(a.tokenMints.map((m) => m.edition)).toEqual([1, 2, 3]);
    expect(a.tokenMints.every((m) => m.metadata === hrl)).toBe(true);
    expect(a.steps.map((s) => s.kind)).toEqual([
      'inscribe_hcs1',
      'token_create',
      'token_mint',
      'token_mint',
      'token_mint',
    ]);
    expect(a.inscription.liveInscription).toBe('stubbed');
    expect(formatHashinalMintPlan(a)).toContain(HASHINAL_METADATA_ENCODING_NOTE);
  });

  test('planHashinalMint default editions = 1..maxEdition', () => {
    const plan = planHashinalMint({ collection, topicId: '0.0.900001' });
    expect(plan.mintCount).toBe(collection.maxEdition);
    expect(plan.tokenMints).toHaveLength(8);
    expect(plan.tokenCreate?.maxSupply).toBe(8);
  });

  test('refuse mint when mint gate would deny', () => {
    const plan = planHashinalMint({
      collection: {
        ...collection,
        allowlistSnapshotHash: snapshot.snapshotHash,
      },
      editions: [1],
      hrl,
      minterAccount: '0.0.9999',
      stageId: 'wl',
      snapshot,
      now: '2026-10-05T12:00:00.000Z',
    });
    expect(plan.refused).toBe(true);
    expect(plan.mintCount).toBe(0);
    expect(plan.tokenCreate).toBeNull();
    expect(plan.tokenMints).toHaveLength(0);
    expect(plan.gate?.allowed).toBe(false);
    expect(plan.refusalReason).toMatch(/not on the allowlist/);
    expect(plan.steps.map((s) => s.kind)).toEqual(['inscribe_hcs1']);
  });

  test('allow mint when gate passes', () => {
    expect(verifyAllowlistMembership(snapshot, '0.0.2001')).toBe(true);
    const plan = planHashinalMint({
      collection: {
        ...collection,
        allowlistSnapshotHash: snapshot.snapshotHash,
      },
      editions: [1, 2],
      hrl,
      minterAccount: '0.0.2001',
      stageId: 'wl',
      snapshot,
      now: '2026-10-05T12:00:00.000Z',
    });
    expect(plan.refused).toBe(false);
    expect(plan.mintCount).toBe(2);
    expect(plan.tokenCreate).not.toBeNull();
    expect(plan.gate?.allowed).toBe(true);
  });

  test('dryRunRegistryAnchor from receipt hashes', () => {
    const claim = fixtureClaim();
    const receipt = buildAuthenticityReceipt({
      claim,
      observedContentHash: FIXTURE_IMAGE_HASH,
      allowlistMember: true,
      timestamp: 1_700_000_000_001,
    });
    const stub = dryRunRegistryAnchor(receipt);
    expect(stub.dryRun).toBe(true);
    expect(stub.contract).toBe('AuthenticityRegistry');
    expect(stub.method).toBe('anchorReceipt');
    expect(stub.args.claimId).toBe(receipt.claimId);
    expect(stub.args.decisionHash).toMatch(/^0x[0-9a-f]{64}$/);

    const withAnchors = planHashinalMint({
      collection,
      editions: [1],
      hrl,
      receipts: [receipt],
    });
    expect(withAnchors.registryAnchors).toHaveLength(1);
    expect(withAnchors.steps.some((s) => s.kind === 'registry_anchor')).toBe(true);
  });
});
