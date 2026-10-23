import { NextResponse } from 'next/server';
import {
  FIXTURE_IMAGE_BYTES,
  checkMintGate,
  fixtureAllowlistSnapshot,
  fixtureCollection,
  formatHashinalMintPlan,
  parseCollectionConfig,
  planHashinalMint,
  type CollectionConfig,
  type DropEditionInput,
} from '@nodeling/core';

/**
 * POST /api/mint/plan — Hashinal TokenCreate/TokenMint dry-run plan.
 * Never signs or submits. Body may include collection, hrl/topicId, editions, minterAccount, stageId, now.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      collection?: unknown;
      hrl?: string;
      topicId?: string;
      editions?: Array<number | DropEditionInput>;
      treasuryAccountId?: string;
      minterAccount?: string;
      stageId?: string;
      now?: string;
      skipMintGate?: boolean;
      tokenIdPlaceholder?: string;
    };

    const config: CollectionConfig = body.collection
      ? parseCollectionConfig(body.collection)
      : fixtureCollection();

    const snapshot = fixtureAllowlistSnapshot();
    if (!config.allowlistSnapshotHash) {
      config.allowlistSnapshotHash = snapshot.snapshotHash;
    }

    const hrl =
      body.hrl ??
      (body.topicId
        ? `hcs://1/${body.topicId}`
        : config.hrlTopic
          ? `hcs://1/${config.hrlTopic}`
          : 'hcs://1/0.0.900001');

    const plan = planHashinalMint({
      collection: config,
      editions: body.editions,
      hrl,
      topicId: body.topicId,
      treasuryAccountId: body.treasuryAccountId,
      minterAccount: body.minterAccount,
      stageId: body.stageId,
      now: body.now,
      snapshot,
      skipMintGate: body.skipMintGate,
      tokenIdPlaceholder: body.tokenIdPlaceholder,
      inscriptionContent: FIXTURE_IMAGE_BYTES,
      inscriptionMimeType: 'image/png',
    });

    // Also surface gate alone for UI convenience when minter omitted
    const gatePreview =
      body.minterAccount && !body.skipMintGate
        ? plan.gate
        : body.minterAccount
          ? checkMintGate({
              minterAccount: body.minterAccount,
              stageId: body.stageId,
              config,
              snapshot,
              now: body.now,
            })
          : undefined;

    return NextResponse.json({
      plan,
      summary: formatHashinalMintPlan(plan),
      gatePreview,
      dryRun: true as const,
      liveSubmission: 'stubbed' as const,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

/** GET — fixture plan with placeholder HRL (offline demo). */
export async function GET() {
  const collection = fixtureCollection();
  const snapshot = fixtureAllowlistSnapshot();
  collection.allowlistSnapshotHash = snapshot.snapshotHash;
  const hrl = `hcs://1/${collection.hrlTopic ?? '0.0.900001'}`;
  const plan = planHashinalMint({
    collection,
    editions: [1],
    hrl,
    treasuryAccountId: collection.royalty?.collectorAccount ?? '0.0.8001',
    inscriptionContent: FIXTURE_IMAGE_BYTES,
    inscriptionMimeType: 'image/png',
    minterAccount: '0.0.2001',
    stageId: 'wl',
    snapshot,
    now: '2026-10-05T12:00:00.000Z',
  });
  return NextResponse.json({
    plan,
    summary: formatHashinalMintPlan(plan),
    dryRun: true as const,
    liveSubmission: 'stubbed' as const,
  });
}
