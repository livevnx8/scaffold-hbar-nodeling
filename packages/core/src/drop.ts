/**
 * DreamForge / sentx-drop compatible offline drop builder.
 * Writes metadata.json (+ optional N.json), short filenames, content hashes,
 * and Hashinal HRL placeholders. No SentX writes, no live Hedera.
 */

import fs from 'fs';
import path from 'path';
import { sha256 } from './hash.js';
import { MAX_DREAMFORGE_FILENAME, mimeForExt, normalizeExt } from './mime.js';
import { validateDrop } from './validate-drop.js';
import {
  DEFAULT_RECEIPT_TIMESTAMP,
  buildReceiptsSidecar,
  collectionIdFromName,
} from './drop-receipts.js';
import type {
  DropBuildConfig,
  DropBuildResult,
  DropEditionInput,
  DropFileRef,
  DreamForgeMetadataEntry,
  ValidateDropResult,
} from './types.js';

function asBuffer(bytes: Uint8Array | Buffer): Buffer {
  return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
}

function assertFilename(name: string, max: number): void {
  if (name.length > max) {
    throw new Error(`filename exceeds ${max} chars: ${name} (${name.length})`);
  }
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`unsafe filename: ${name}`);
  }
}

function formatTemplate(tpl: string, n: number, tier: string): string {
  return tpl.replace(/\{n\}/g, String(n)).replace(/\{tier\}/g, tier);
}

function writeBinary(folder: string, filename: string, bytes: Buffer, max: number): string {
  assertFilename(filename, max);
  fs.writeFileSync(path.join(folder, filename), bytes);
  return filename;
}

function resolveFileName(ref: DropFileRef, edition: number, role: 'image' | 'extra', index: number): string {
  const ext = normalizeExt(ref.ext);
  if (ref.stem) return `${ref.stem}.${ext}`;
  if (role === 'image') return `${edition}.${ext}`;
  return `${edition}_${index}.${ext}`;
}

/**
 * Build a DreamForge-ready drop folder from edition assets.
 */
export function buildDrop(config: DropBuildConfig): DropBuildResult & { validation: ValidateDropResult } {
  const max = config.maxFilenameLength ?? MAX_DREAMFORGE_FILENAME;
  const mode = config.mode ?? 'image';
  const folderName = config.folder ?? 'drop';
  const outParent = path.resolve(config.outDir);
  const folder = path.join(outParent, folderName);
  const compiler = config.compiler ?? 'Nodeling';
  const nameTemplate = config.nameTemplate ?? `${config.name} #{n}`;
  const descriptionTpl = config.description ?? `${config.name} edition {n}.`;

  fs.mkdirSync(outParent, { recursive: true });
  if (config.clean !== false && fs.existsSync(folder)) {
    fs.rmSync(folder, { recursive: true, force: true });
  }
  fs.mkdirSync(folder, { recursive: true });

  const editions = config.editions.map((e, i) => ({
    ...e,
    edition: e.edition ?? i + 1,
  }));
  editions.sort((a, b) => a.edition! - b.edition!);

  // Ensure contiguous unique 1..N for DreamForge friendliness
  const eds = editions.map((e) => e.edition!);
  for (let i = 0; i < eds.length; i++) {
    if (eds[i] !== i + 1) {
      throw new Error(`editions must be contiguous 1..N after sort; got ${eds.join(',')}`);
    }
  }

  const contentHashes: Record<string, string> = {};
  const entries: DreamForgeMetadataEntry[] = [];
  const written = new Set<string>();

  const writeRef = (ref: DropFileRef, edition: number, role: 'image' | 'extra', index: number): { filename: string; type: string } => {
    const filename = resolveFileName(ref, edition, role, index);
    assertFilename(filename, max);
    const buf = asBuffer(ref.bytes);
    const type = ref.type ?? mimeForExt(ref.ext);
    if (written.has(filename)) {
      // Same bytes reused (tier shared assets) — ok if identical hash
      const existing = contentHashes[filename];
      const hash = sha256(buf);
      if (existing && existing !== hash) {
        throw new Error(`filename collision with different content: ${filename}`);
      }
      contentHashes[filename] = hash;
      return { filename, type };
    }
    writeBinary(folder, filename, buf, max);
    written.add(filename);
    contentHashes[filename] = sha256(buf);
    return { filename, type };
  };

  for (const ed of editions) {
    const n = ed.edition!;
    const tier = ed.rarity ?? 'Common';
    const img = writeRef(ed.image, n, 'image', 0);
    const fileEntries: DreamForgeMetadataEntry['files'] = [];

    if (mode === 'files' && ed.files?.length) {
      ed.files.forEach((f, i) => {
        const w = writeRef(f, n, 'extra', i + 1);
        fileEntries.push({
          uri: w.filename,
          type: w.type,
          is_default_file: f.isDefaultFile ?? i === 0,
        });
      });
    }

    const hrl = ed.hrl ?? config.hrl;
    const attrs = [
      ...(ed.rarity ? [{ trait_type: 'Rarity', value: ed.rarity }] : []),
      ...(config.commonAttributes ?? []),
      ...(ed.attributes ?? []),
    ];

    const entry: DreamForgeMetadataEntry = {
      edition: n,
      name: ed.name ?? formatTemplate(nameTemplate, n, tier),
      creator: config.creator,
      description: ed.description ?? formatTemplate(descriptionTpl, n, tier),
      image: img.filename,
      type: img.type,
      format: 'HIP412@2.0.0',
      attributes: attrs.length ? attrs : undefined,
      properties: {
        compiler,
        contentHash: contentHashes[img.filename],
        ...(hrl ? { hrl } : {}),
      },
    };
    if (hrl) entry.hrl = hrl;
    if (fileEntries.length) entry.files = fileEntries;

    entries.push(entry);

    if (config.writePerEditionJson) {
      const jf = `${n}.json`;
      assertFilename(jf, max);
      fs.writeFileSync(path.join(folder, jf), JSON.stringify(entry, null, 1));
    }
  }

  const metadataPath = path.join(folder, 'metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(entries, null, 1));

  // Sidecars next to the drop folder (NOT inside it) so DreamForge validate stays clean.
  const hashesPath = path.join(outParent, `${folderName}-nodeling-hashes.json`);
  fs.writeFileSync(
    hashesPath,
    JSON.stringify(
      {
        compiler,
        hrl: config.hrl ?? null,
        files: contentHashes,
        editions: entries.map((e) => ({
          edition: e.edition,
          image: e.image,
          contentHash: contentHashes[e.image],
          hrl: e.hrl ?? config.hrl ?? null,
        })),
      },
      null,
      2,
    ),
  );

  let receiptsPath: string | undefined;
  if (config.writeReceipts !== false) {
    const collectionId = config.collectionId ?? collectionIdFromName(config.name);
    const timestamp = config.receiptTimestamp ?? DEFAULT_RECEIPT_TIMESTAMP;
    const sidecar = buildReceiptsSidecar({
      compiler,
      collectionId,
      hrl: config.hrl ?? null,
      maxEdition: entries.length,
      timestamp,
      entries,
      contentHashes,
    });
    receiptsPath = path.join(outParent, `${folderName}-nodeling-receipts.json`);
    fs.writeFileSync(receiptsPath, JSON.stringify(sidecar, null, 2));
  }

  const validation = validateDrop(folder, {
    expect: rarityExpectFrom(editions),
  });

  return {
    folder,
    entries,
    contentHashes,
    metadataPath,
    hashesPath,
    receiptsPath,
    fileCount: written.size + 1 + (config.writePerEditionJson ? editions.length : 0),
    validation,
  };
}

function rarityExpectFrom(editions: Array<DropEditionInput & { edition: number }>): Record<string, number> | undefined {
  const counts: Record<string, number> = {};
  let any = false;
  for (const e of editions) {
    if (!e.rarity) continue;
    any = true;
    counts[e.rarity] = (counts[e.rarity] ?? 0) + 1;
  }
  return any ? counts : undefined;
}

/**
 * Build a zip Buffer (store method, no compression) of a drop folder's top-level files.
 * Excludes subfolders. Suitable for small offline demos / UI download.
 */
export function zipDropFolder(folder: string): Buffer {
  const dir = path.resolve(folder);
  const files = fs
    .readdirSync(dir)
    .filter((f) => fs.statSync(path.join(dir, f)).isFile())
    .sort();
  return buildStoreZip(
    files.map((f) => ({
      name: `${path.basename(dir)}/${f}`,
      data: fs.readFileSync(path.join(dir, f)),
    })),
  );
}

/** Minimal ZIP (store only) — no external deps. */
export function buildStoreZip(entries: Array<{ name: string; data: Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = dosDateTime(now);

  for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method store
    local.writeUInt16LE(dosTime.time, 10);
    local.writeUInt16LE(dosTime.date, 12);
    const crc = crc32(e.data);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    parts.push(local, e.data);

    const cen = Buffer.alloc(46 + nameBuf.length);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt16LE(dosTime.time, 12);
    cen.writeUInt16LE(dosTime.date, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(e.data.length, 20);
    cen.writeUInt32LE(e.data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    nameBuf.copy(cen, 46);
    central.push(cen);

    offset += local.length + e.data.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, centralBuf, end]);
}

function dosDateTime(d: Date): { time: number; date: number } {
  const time = ((d.getSeconds() / 2) | 0) + (d.getMinutes() << 5) + (d.getHours() << 11);
  const date = d.getDate() + ((d.getMonth() + 1) << 5) + ((d.getFullYear() - 1980) << 9);
  return { time, date };
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!)! & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Minimal valid 1×1 PNG. `seed` tweaks one byte so each edition gets a distinct hash.
 */
export function tinyPngBytes(seed = 0): Buffer {
  // 1x1 opaque red PNG
  const base = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8cfc0f00f0001ffff0001ffff0000000049454e44ae426082',
    'hex',
  );
  // Mutate a payload byte inside IDAT (offset ~37) by seed for unique content hashes.
  const out = Buffer.from(base);
  const idx = 37;
  out[idx] = ((out[idx] ?? 0) + (seed & 0xff)) & 0xff;
  // CRC of IDAT will be wrong after mutation — DreamForge cares about filename/type,
  // authenticity uses our sha256 of bytes. For a structurally valid PNG with unique
  // hashes, rebuild with correct CRC is nicer; use distinct uncompressed payload via
  // full rewrite for seed>0.
  if (seed === 0) return out;
  return buildTinyPng(seed);
}

/** Build a tiny valid PNG with unique RGB from seed (crc-correct). */
export function buildTinyPng(seed: number): Buffer {
  const r = (seed * 37 + 10) & 0xff;
  const g = (seed * 91 + 40) & 0xff;
  const b = (seed * 17 + 70) & 0xff;
  // Uncompressed 1x1 truecolor PNG via known structure
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(1, 0);
  ihdrData.writeUInt32BE(1, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = pngChunk('IHDR', ihdrData);
  // zlib-wrapped raw image: filter byte 0 + RGB
  const raw = Buffer.from([0, r, g, b]);
  const zlibbed = zlibStore(raw);
  const idat = pngChunk('IDAT', zlibbed);
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32LE(crc32(Buffer.concat([typeBuf, data])), 0);
  // PNG CRC is big-endian IEEE; recompute properly:
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** zlib stored (uncompressed) block wrapping `raw`. */
function zlibStore(raw: Buffer): Buffer {
  const header = Buffer.from([0x78, 0x01]); // zlib, no compression
  const block = Buffer.alloc(5 + raw.length);
  block[0] = 0x01; // final stored block
  block.writeUInt16LE(raw.length, 1);
  block.writeUInt16LE(raw.length ^ 0xffff, 3);
  raw.copy(block, 5);
  const adler = adler32(raw);
  const trail = Buffer.alloc(4);
  trail.writeUInt32BE(adler, 0);
  return Buffer.concat([header, block, trail]);
}

function adler32(buf: Buffer): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < buf.length; i++) {
    a = (a + buf[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}
