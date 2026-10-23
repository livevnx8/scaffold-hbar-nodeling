import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

function repoRoot(): string {
  return path.resolve(process.cwd(), '../..');
}

/**
 * GET /api/art?collection=tinies&edition=1
 * GET /api/art?collection=tinies&file=tinies_sheet.png
 * GET /api/art?collection=brand&file=nodling-hero.png
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const collection = (url.searchParams.get('collection') ?? '').toLowerCase();
  const edition = url.searchParams.get('edition');
  const fileParam = url.searchParams.get('file');

  const allowed = new Set(['tinies', 'nodlings', 'brand']);
  if (!allowed.has(collection)) {
    return NextResponse.json({ error: 'collection must be tinies|nodlings|brand' }, { status: 400 });
  }

  const dir = path.join(repoRoot(), 'fixtures', collection);
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ error: 'fixtures missing' }, { status: 404 });
  }

  let fileName: string | null = null;

  if (fileParam) {
    const base = path.basename(fileParam);
    if (base !== fileParam || base.includes('..')) {
      return NextResponse.json({ error: 'bad file' }, { status: 400 });
    }
    fileName = base;
  } else if (edition) {
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json({ error: 'no manifest' }, { status: 404 });
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      editions: Array<{ edition: number; file: string }>;
    };
    const n = Number(edition);
    const row = manifest.editions.find((e) => e.edition === n);
    if (!row) {
      return NextResponse.json({ error: `edition ${edition} not found` }, { status: 404 });
    }
    fileName = row.file;
  } else {
    return NextResponse.json({ error: 'edition or file required' }, { status: 400 });
  }

  const abs = path.join(dir, fileName!);
  if (!fs.existsSync(abs) || !abs.startsWith(dir)) {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  const buf = fs.readFileSync(abs);
  const ext = path.extname(abs).toLowerCase();
  const type = ext === '.png' ? 'image/png' : ext === '.json' ? 'application/json' : 'application/octet-stream';
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=3600',
      'X-Nodeling-Art-File': fileName!,
    },
  });
}
