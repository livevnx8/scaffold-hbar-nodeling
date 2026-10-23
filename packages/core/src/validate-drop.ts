/**
 * Offline DreamForge / sentx-drop folder validator (pure Node fs).
 * Mirrors the important checks from sentx_drop.py cmd_validate.
 * Does NOT shell out to Python or call SentX.
 */

import fs from 'fs';
import path from 'path';
import { MAX_DREAMFORGE_FILENAME, mimeForFilename } from './mime.js';
import type { ValidateDropIssue, ValidateDropResult } from './types.js';

export interface ValidateDropOptions {
  /** Trait used for tier counts (default Rarity). */
  trait?: string;
  /** Expected tier counts, e.g. { Common: 2, Rare: 1 }. */
  expect?: Record<string, number>;
  /** Treat non-contiguous editions as errors (default false = warn, like sentx-drop). */
  strictContiguous?: boolean;
  /** Treat stray unreferenced files as errors (default false = warn). */
  strictNoStray?: boolean;
}

type MetaEntry = {
  edition?: number;
  image?: string;
  type?: string;
  attributes?: Array<{ trait_type?: string; value?: string | number }>;
  files?: Array<{ uri?: string; type?: string }>;
  animation_url?: string;
};

function listFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith('.'))
    .filter((f) => {
      try {
        return fs.statSync(path.join(dir, f)).isFile() || fs.statSync(path.join(dir, f)).isDirectory();
      } catch {
        return false;
      }
    });
}

function rarityOf(m: MetaEntry, trait: string): string | undefined {
  const hit = (m.attributes ?? []).find((a) => a.trait_type === trait);
  return hit?.value !== undefined ? String(hit.value) : undefined;
}

/**
 * Validate a DreamForge drop folder offline.
 * Returns ok=false when any errors are present (warnings alone still ok=true).
 */
export function validateDrop(folder: string, opts: ValidateDropOptions = {}): ValidateDropResult {
  const dir = path.resolve(folder);
  const trait = opts.trait ?? 'Rarity';
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues: ValidateDropIssue[] = [];

  const push = (level: 'error' | 'warn', message: string) => {
    issues.push({ level, message });
    if (level === 'error') errors.push(message);
    else warnings.push(message);
  };

  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    push('error', `folder does not exist or is not a directory: ${dir}`);
    return {
      ok: false,
      mode: 'empty',
      entries: 0,
      files: 0,
      sizeBytes: 0,
      rarityCounts: {},
      errors,
      warnings,
      issues,
    };
  }

  const files = listFiles(dir);
  let sizeBytes = 0;
  for (const f of files) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      push('warn', `subfolder present: ${f}`);
      continue;
    }
    sizeBytes += st.size;
    if (f.length > MAX_DREAMFORGE_FILENAME) {
      push('error', `filename >${MAX_DREAMFORGE_FILENAME} chars: ${f} (${f.length})`);
    }
  }

  const refs = new Set<string>();
  const entries: MetaEntry[] = [];
  let mode: ValidateDropResult['mode'] = 'empty';

  if (files.includes('metadata.json')) {
    mode = 'single metadata.json';
    let data: unknown;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, 'metadata.json'), 'utf8'));
    } catch (e) {
      push('error', `metadata.json invalid JSON: ${(e as Error).message}`);
      data = null;
    }
    if (data !== null) {
      if (!Array.isArray(data)) {
        push('error', 'metadata.json must be an array');
      } else {
        const eds: number[] = [];
        data.forEach((m, i) => {
          const entry = m as MetaEntry;
          if (entry.edition === undefined || entry.edition === null) {
            push('error', `entry ${i} missing edition`);
          } else {
            eds.push(Number(entry.edition));
          }
          if (!entry.image) {
            push('error', `entry ${i} missing image`);
          } else {
            entries.push(entry);
          }
        });
        const counts = new Map<number, number>();
        for (const e of eds) counts.set(e, (counts.get(e) ?? 0) + 1);
        const dup = [...counts.entries()].filter(([, c]) => c > 1).map(([e]) => e);
        if (dup.length) push('error', `duplicate editions: ${dup.slice(0, 10).join(',')}`);
        if (eds.length) {
          const sorted = [...eds].sort((a, b) => a - b);
          const expected = Array.from({ length: eds.length }, (_, i) => i + 1);
          const contiguous = sorted.length === expected.length && sorted.every((v, i) => v === expected[i]);
          if (!contiguous) {
            const msg = 'editions are not contiguous 1..N';
            if (opts.strictContiguous) push('error', msg);
            else push('warn', msg);
          }
        }
      }
    }
    const extraJson = files.filter((f) => f.endsWith('.json') && f !== 'metadata.json');
    // ignore receipts/ subfolder already warned; only top-level
    const topExtra = extraJson.filter((f) => !f.includes(path.sep));
    if (topExtra.length) push('warn', `other .json files beside metadata.json: ${topExtra.slice(0, 5).join(',')}`);
  } else {
    mode = 'per-file json';
    const jsons = files.filter((f) => f.endsWith('.json') && fs.statSync(path.join(dir, f)).isFile());
    if (!jsons.length) {
      push('error', 'no metadata.json and no per-edition .json files');
    }
    for (const j of jsons) {
      let m: MetaEntry;
      try {
        m = JSON.parse(fs.readFileSync(path.join(dir, j), 'utf8')) as MetaEntry;
      } catch (e) {
        push('error', `${j}: invalid JSON ${(e as Error).message}`);
        continue;
      }
      const stem = j.slice(0, -5);
      if (!m.image) push('error', `${j}: missing image`);
      else {
        const imgStem = path.parse(m.image).name;
        if (imgStem !== stem && !String(m.image).startsWith('ipfs://') && !String(m.image).startsWith('http')) {
          push('warn', `${j}: image '${m.image}' does not match stem '${stem}'`);
        }
      }
      entries.push(m);
      if (!/^#?\d+/.test(stem)) {
        push('warn', `${j}: no leading number -> serial assigned alphabetically`);
      }
    }
    const mediaStems = new Set(
      files
        .filter((f) => !f.endsWith('.json') && fs.statSync(path.join(dir, f)).isFile())
        .map((f) => path.parse(f).name),
    );
    const jsonStems = new Set(jsons.map((j) => j.slice(0, -5)));
    for (const s of mediaStems) {
      if (!jsonStems.has(s)) push('warn', `media without json: ${s}`);
    }
  }

  for (const m of entries) {
    const uris: string[] = [];
    if (m.image) uris.push(m.image);
    for (const x of m.files ?? []) {
      if (x && typeof x === 'object' && x.uri) uris.push(x.uri);
    }
    if (m.animation_url) uris.push(m.animation_url);

    for (const u of uris) {
      if (!u || /^(ipfs:\/\/|https?:|ar:\/\/)/i.test(u)) continue;
      refs.add(u);
      if (!fs.existsSync(path.join(dir, u))) {
        push('error', `referenced file missing: ${u}`);
      }
    }

    if (m.type && m.image && !/^(ipfs:\/\/|https?:|ar:\/\/)/i.test(m.image)) {
      const expected = mimeForFilename(m.image);
      if (expected !== 'application/octet-stream' && m.type !== expected) {
        push('warn', `edition ${m.edition ?? '?'}: type ${m.type} != ${expected} (${m.image})`);
      }
    }
    for (const x of m.files ?? []) {
      if (x?.uri && x.type && !/^(ipfs:\/\/|https?:|ar:\/\/)/i.test(x.uri)) {
        const expected = mimeForFilename(x.uri);
        if (expected !== 'application/octet-stream' && x.type !== expected) {
          push('warn', `files.uri ${x.uri} type mismatch`);
        }
      }
    }
  }

  const stray = files.filter(
    (f) =>
      !refs.has(f) &&
      !f.endsWith('.json') &&
      fs.statSync(path.join(dir, f)).isFile(),
  );
  if (stray.length) {
    const msg = `stray (unreferenced) files: ${stray.slice(0, 10).join(',')}${stray.length > 10 ? ' ...' : ''}`;
    if (opts.strictNoStray) push('error', msg);
    else push('warn', msg);
  }

  const rarityCounts: Record<string, number> = {};
  for (const m of entries) {
    const r = rarityOf(m, trait);
    if (r !== undefined) rarityCounts[r] = (rarityCounts[r] ?? 0) + 1;
  }

  if (opts.expect) {
    for (const [k, v] of Object.entries(opts.expect)) {
      if ((rarityCounts[k] ?? 0) !== v) {
        push('error', `tier ${k}: expected ${v}, found ${rarityCounts[k] ?? 0}`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    entries: entries.length,
    files: files.filter((f) => fs.statSync(path.join(dir, f)).isFile()).length,
    sizeBytes,
    rarityCounts,
    errors,
    warnings,
    issues,
  };
}

/** Pretty-print a validation result (for CLI / demo). */
export function formatValidateDropResult(folder: string, r: ValidateDropResult): string {
  const lines = [
    `[validate] ${path.resolve(folder)}`,
    `  mode: ${r.mode}; entries: ${r.entries}; files: ${r.files}; size: ${(r.sizeBytes / 1e6).toFixed(1)} MB`,
  ];
  if (Object.keys(r.rarityCounts).length) {
    lines.push(`  Rarity counts: ${JSON.stringify(r.rarityCounts)}`);
  }
  for (const w of r.warnings) lines.push(`  WARN  ${w}`);
  for (const e of r.errors) lines.push(`  ERROR ${e}`);
  lines.push(`  RESULT: ${r.ok ? 'PASS' : 'FAIL'}`);
  return lines.join('\n');
}
