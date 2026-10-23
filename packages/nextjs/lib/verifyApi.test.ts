import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getFixtureBundle, verifyPayload } from './offline.js';
import { buildReceiptsSidecar, type DreamForgeMetadataEntry } from '@nodeling/core';

describe('verifyPayload', () => {
  it('verifies fixture receipt', () => {
    const { receipt } = getFixtureBundle();
    const r = verifyPayload({ receipt });
    assert.equal(r.ok, true);
    assert.equal(r.kind, 'receipt');
  });

  it('parses fixture HRL', () => {
    const { inscription } = getFixtureBundle();
    const r = verifyPayload({ hrl: inscription.hrl });
    assert.equal(r.ok, true);
    assert.equal(r.kind, 'hrl');
  });

  it('verifies a receipts package GREEN', () => {
    const { inscription, receipt } = getFixtureBundle();
    const ch = receipt.claim.contentHash;
    const entry: DreamForgeMetadataEntry = {
      edition: 1,
      name: 'Demo #1',
      creator: 'Vera Labs',
      description: 'd',
      image: '1.png',
      type: 'image/png',
      format: 'HIP412@2.0.0',
      hrl: inscription.hrl,
      properties: { contentHash: ch, hrl: inscription.hrl },
    };
    const sidecar = buildReceiptsSidecar({
      compiler: 'Nodeling',
      collectionId: 'demo',
      hrl: inscription.hrl,
      maxEdition: 1,
      timestamp: 1_700_000_100_000,
      entries: [entry],
      contentHashes: { '1.png': ch },
    });
    const r = verifyPayload({ receiptsPackage: sidecar });
    assert.equal(r.kind, 'receipts_package');
    assert.equal(r.ok, true);
    assert.equal(r.packageResult?.verdict, 'GREEN');
  });

  it('rejects garbage', () => {
    const r = verifyPayload({});
    assert.equal(r.ok, false);
  });
});
