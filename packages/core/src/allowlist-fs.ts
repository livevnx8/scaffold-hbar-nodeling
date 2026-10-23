import fs from 'fs';
import path from 'path';
import { formatHoldersCsv, formatHoldersTxt } from './allowlist.js';
import type { AllowlistSnapshot } from './types.js';

export interface AllowlistExportPaths {
  txtPath: string;
  csvPath: string;
  snapshotPath: string;
}

/**
 * Write holders.txt, holders.csv, and allowlist-snapshot.json next to a drop
 * (or any outDir). Does not put files inside the DreamForge media folder.
 */
export function writeAllowlistExport(
  snapshot: AllowlistSnapshot,
  outDir: string,
  basename = 'holders',
): AllowlistExportPaths {
  const dir = path.resolve(outDir);
  fs.mkdirSync(dir, { recursive: true });
  const txtPath = path.join(dir, `${basename}.txt`);
  const csvPath = path.join(dir, `${basename}.csv`);
  const snapshotPath = path.join(dir, 'allowlist-snapshot.json');
  fs.writeFileSync(txtPath, formatHoldersTxt(snapshot.accounts));
  fs.writeFileSync(
    csvPath,
    formatHoldersCsv(snapshot.accounts.map((account) => ({ account, balance: 1 }))),
  );
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2) + '\n');
  return { txtPath, csvPath, snapshotPath };
}
