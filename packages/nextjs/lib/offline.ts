/**
 * Server-safe helpers wrapping @nodeling/core for API routes / UI.
 */
import {
  FIXTURE_IMAGE_HASH,
  buildAuthenticityReceipt,
  fixtureAllowlistSnapshot,
  fixtureClaim,
  fixtureCollection,
  fixtureInscription,
  fixtureMetadata,
  isValidHrl,
  looksLikeReceiptsSidecar,
  metadataHashFor,
  parseHrl,
  planTokenCreate,
  planTokenMint,
  verifyAllowlistMembership,
  verifyAuthenticityReceipt,
  verifyReceiptsSidecar,
  verifySnapshotIntegrity,
  type AuthenticityReceipt,
  type DropReceiptsSidecar,
} from '@nodeling/core';

export function getFixtureBundle() {
  const collection = fixtureCollection();
  const inscription = fixtureInscription();
  const metadata = fixtureMetadata();
  const snapshot = fixtureAllowlistSnapshot();
  const claim = fixtureClaim();
  const receipt = buildAuthenticityReceipt({
    claim,
    observedContentHash: FIXTURE_IMAGE_HASH,
    allowlistMember: verifyAllowlistMembership(snapshot, claim.minterAccount!),
    timestamp: 1_700_000_000_001,
  });
  return {
    collection,
    inscription,
    metadata,
    metadataHash: metadataHashFor(metadata),
    snapshot,
    claim,
    receipt,
    tokenCreate: planTokenCreate(collection, inscription.hrl),
    tokenMint: planTokenMint({ metadataHrl: inscription.hrl }),
  };
}

export type VerifyPayloadResult = {
  ok: boolean;
  kind: 'receipt' | 'hrl' | 'receipts_package' | 'error';
  result?: ReturnType<typeof verifyAuthenticityReceipt>;
  packageResult?: ReturnType<typeof verifyReceiptsSidecar>;
  hrl?: ReturnType<typeof parseHrl>;
  message?: string;
  fixtureHint?: AuthenticityReceipt;
};

function packageResponse(sidecar: DropReceiptsSidecar): VerifyPayloadResult {
  const packageResult = verifyReceiptsSidecar(sidecar);
  return {
    ok: packageResult.ok,
    kind: 'receipts_package',
    packageResult,
    message: packageResult.ok
      ? `All ${packageResult.editions.length} editions GREEN`
      : `Package RED — ${packageResult.editions.filter((e) => !e.ok).length} edition(s) failed`,
  };
}

export function verifyPayload(body: {
  receipt?: AuthenticityReceipt | DropReceiptsSidecar;
  receiptsPackage?: DropReceiptsSidecar;
  hrl?: string;
}): VerifyPayloadResult {
  if (body.receiptsPackage) {
    if (!looksLikeReceiptsSidecar(body.receiptsPackage)) {
      return { ok: false, kind: 'error', message: 'Not a Nodeling receipts package' };
    }
    return packageResponse(body.receiptsPackage);
  }

  if (body.receipt) {
    if (looksLikeReceiptsSidecar(body.receipt)) {
      return packageResponse(body.receipt);
    }
    const result = verifyAuthenticityReceipt(body.receipt as AuthenticityReceipt);
    return { ok: result.ok, kind: 'receipt', result };
  }

  if (body.hrl) {
    if (!isValidHrl(body.hrl)) {
      return { ok: false, kind: 'error', message: `Invalid HRL: ${body.hrl}` };
    }
    const parsed = parseHrl(body.hrl);
    const fixture = getFixtureBundle();
    const matchesFixture = body.hrl === fixture.inscription.hrl;
    return {
      ok: matchesFixture,
      kind: 'hrl',
      hrl: parsed,
      message: matchesFixture
        ? 'HRL matches offline fixture inscription (live HCS-1 fetch stubbed)'
        : 'HRL parsed OK; live HCS-1 fetch stubbed — paste a receipt JSON for full verify',
      fixtureHint: matchesFixture ? fixture.receipt : undefined,
    };
  }

  return {
    ok: false,
    kind: 'error',
    message: 'Provide receipt JSON, receipts package JSON, or hrl',
  };
}

export {
  verifySnapshotIntegrity,
  fixtureAllowlistSnapshot,
  verifyAllowlistMembership,
  looksLikeReceiptsSidecar,
};
