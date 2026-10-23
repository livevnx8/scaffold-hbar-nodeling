import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { fixtureAllowlistSnapshot, fixtureCollection, parseCollectionConfig } from '@nodeling/core';
import { loadCollectionConfig } from '@nodeling/core/drop';

export const runtime = 'nodejs';

function repoRoot(): string {
  // packages/nextjs → repo root
  return path.resolve(process.cwd(), '../..');
}

function loadPreset(preset: string) {
  const root = repoRoot();
  const map: Record<string, string> = {
    tinies: 'tinies.collection.json',
    nodlings: 'nodlings.collection.json',
    demo: 'nodeling-demo.collection.json',
  };
  const file = map[preset];
  if (!file) return null;
  const abs = path.join(root, 'examples', file);
  if (!fs.existsSync(abs)) return null;
  return loadCollectionConfig(abs);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const preset = (url.searchParams.get('preset') ?? 'tinies').toLowerCase();
  const snapshot = fixtureAllowlistSnapshot();

  let collection;
  try {
    collection = loadPreset(preset) ?? (preset === 'demo' ? fixtureCollection() : loadPreset('tinies'));
    if (!collection) collection = fixtureCollection();
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // Attach live snapshot hash for mint-gate checks
  collection = {
    ...collection,
    allowlistSnapshotHash: snapshot.snapshotHash,
  };

  let art: { collectionId: string; editions: unknown[] } | null = null;
  if (preset === 'tinies' || preset === 'nodlings' || collection.collectionId === 'tinies' || collection.collectionId === 'nodlings') {
    const key = preset === 'demo' ? collection.collectionId : preset;
    const manifestPath = path.join(repoRoot(), 'fixtures', key, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      art = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        collectionId: string;
        editions: unknown[];
      };
    }
  }

  return NextResponse.json({
    preset: collection.collectionId === 'nodeling-demo' ? 'demo' : collection.collectionId,
    collection,
    art,
    snapshot: {
      snapshotHash: snapshot.snapshotHash,
      accounts: snapshot.accounts,
      collections: snapshot.collections,
      publishedAt: snapshot.publishedAt,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { collection?: unknown };
    if (!body.collection) {
      return NextResponse.json({ error: 'collection required' }, { status: 400 });
    }
    const collection = parseCollectionConfig(body.collection);
    return NextResponse.json({ collection });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
