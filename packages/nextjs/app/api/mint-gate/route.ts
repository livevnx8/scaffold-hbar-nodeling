import { NextResponse } from 'next/server';
import {
  checkMintGate,
  fixtureAllowlistSnapshot,
  fixtureCollection,
  parseCollectionConfig,
  type CollectionConfig,
} from '@nodeling/core';

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      minterAccount?: string;
      stageId?: string;
      now?: string;
      collection?: unknown;
    };
    if (!body.minterAccount) {
      return NextResponse.json({ error: 'minterAccount required' }, { status: 400 });
    }
    const config: CollectionConfig = body.collection
      ? parseCollectionConfig(body.collection)
      : fixtureCollection();
    const snapshot = fixtureAllowlistSnapshot();
    if (!config.allowlistSnapshotHash) {
      config.allowlistSnapshotHash = snapshot.snapshotHash;
    }
    const result = checkMintGate({
      minterAccount: body.minterAccount,
      stageId: body.stageId,
      now: body.now,
      config,
      snapshot,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
