import { NextResponse } from 'next/server';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  fixtureAllowlistSnapshot,
  fixtureCollection,
  parseCollectionConfig,
  type CollectionConfig,
} from '@nodeling/core';
import {
  artDirFor,
  buildDropFromCollectionConfig,
  dropFolderForKey,
  loadCollectionConfig,
  validateDrop,
  verifyDropPackage,
  writeAllowlistExport,
  zipDropFolder,
  type ArtCollectionKey,
} from '@nodeling/core/drop';

export const runtime = 'nodejs';

function repoRoot(): string {
  return path.resolve(process.cwd(), '../..');
}

function keyFromConfig(config: CollectionConfig): ArtCollectionKey {
  if (config.collectionId === 'tinies') return 'tinies';
  if (config.collectionId === 'nodlings') return 'nodlings';
  return 'demo';
}

function resolveConfig(
  raw: unknown | undefined,
  preset?: string,
  editionsOverride?: number,
): CollectionConfig {
  if (raw) return parseCollectionConfig(raw);
  if (preset === 'tinies' || preset === 'nodlings' || preset === 'demo') {
    const file =
      preset === 'tinies'
        ? 'tinies.collection.json'
        : preset === 'nodlings'
          ? 'nodlings.collection.json'
          : 'nodeling-demo.collection.json';
    return loadCollectionConfig(path.join(repoRoot(), 'examples', file));
  }
  const base = fixtureCollection();
  if (editionsOverride && editionsOverride !== base.maxEdition) {
    const n = Math.min(32, Math.max(1, editionsOverride));
    const common = Math.max(1, Math.ceil(n * 0.6));
    const legendary = n >= 3 ? 1 : 0;
    const rare = Math.max(0, n - common - legendary);
    const tiers = [
      { key: 'common', name: 'Common', count: common },
      ...(rare ? [{ key: 'rare', name: 'Rare', count: rare }] : []),
      ...(legendary ? [{ key: 'legendary', name: 'Legendary', count: legendary }] : []),
    ].filter((t) => t.count > 0);
    return parseCollectionConfig({
      ...base,
      maxEdition: n,
      maxSupply: n,
      tiers,
    });
  }
  return base;
}

async function buildExport(opts: {
  collectionRaw?: unknown;
  editions?: number;
  format: string;
  preset?: string;
}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodeling-export-'));
  try {
    const config = resolveConfig(opts.collectionRaw, opts.preset, opts.editions);
    const key = keyFromConfig(config);
    const folder = dropFolderForKey(key);
    const artDir =
      key === 'tinies' || key === 'nodlings' ? artDirFor(repoRoot(), key) : undefined;

    const built = buildDropFromCollectionConfig(config, {
      outDir: tmp,
      folder,
      writeReceipts: true,
      artDir,
    });

    const snapshot = fixtureAllowlistSnapshot();
    writeAllowlistExport(snapshot, tmp, 'holders');

    const expect: Record<string, number> = {};
    for (const t of config.tiers) expect[t.name] = t.count;

    const validation = validateDrop(built.folder, { expect });
    const packageVerify = verifyDropPackage(built.folder, built.hashesPath, built.receiptsPath);

    const receipts = built.receiptsPath
      ? (JSON.parse(fs.readFileSync(built.receiptsPath, 'utf8')) as unknown)
      : null;
    const hashes = built.hashesPath
      ? (JSON.parse(fs.readFileSync(built.hashesPath, 'utf8')) as unknown)
      : null;

    if (opts.format === 'json') {
      return NextResponse.json({
        folder: built.folder,
        collection: config,
        art: Boolean(artDir),
        entries: built.entries,
        contentHashes: built.contentHashes,
        validation,
        packageVerify: {
          ok: packageVerify.ok,
          verdict: packageVerify.verdict,
          editions: packageVerify.editions.map((e) => ({ edition: e.edition, ok: e.ok })),
        },
        hrl: built.entries[0]?.hrl ?? null,
        allowlistAccounts: snapshot.accounts.length,
        snapshotHash: snapshot.snapshotHash,
        hashes,
        receipts,
      });
    }

    if (opts.format === 'receipts') {
      if (!receipts) {
        return NextResponse.json({ error: 'no receipts sidecar' }, { status: 500 });
      }
      return NextResponse.json(receipts, {
        headers: {
          'Content-Disposition': `attachment; filename="${folder}-nodeling-receipts.json"`,
        },
      });
    }

    if (!validation.ok) {
      return NextResponse.json({ error: 'validate failed', validation }, { status: 500 });
    }

    const zip = zipDropFolder(built.folder);
    return new NextResponse(new Uint8Array(zip), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folder}.zip"`,
        'X-Nodeling-Validate': 'PASS',
        'X-Nodeling-Verify': packageVerify.verdict,
        'X-Nodeling-Entries': String(built.entries.length),
        'X-Nodeling-Art': artDir ? key : 'synthetic',
      },
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const n = Math.min(32, Math.max(1, Number(url.searchParams.get('editions') ?? '0') || 0));
  const format = url.searchParams.get('format') ?? 'zip';
  const preset = url.searchParams.get('preset') ?? 'tinies';
  return buildExport({
    editions: n || undefined,
    format,
    preset,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      collection?: unknown;
      editions?: number;
      format?: string;
      preset?: string;
    };
    return buildExport({
      collectionRaw: body.collection,
      editions: body.editions,
      format: body.format ?? 'zip',
      preset: body.preset,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
