/**
 * Build a Nodeling DreamForge drop from a collection config (offline).
 *
 * Usage:
 *   npm run drop:build                         # default: tinies (real art)
 *   COLLECTION=tinies npm run drop:build
 *   COLLECTION=nodlings npm run drop:build
 *   COLLECTION=demo npm run drop:build         # synthetic tiny PNGs
 *   COLLECTION=all npm run drop:build          # demo + tinies + nodlings
 *
 * Or: npx tsx scripts/build-drop.ts tinies
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fixtureAllowlistSnapshot } from '../src/index.js';
import {
  artDirFor,
  collectionConfigBasename,
  dropFolderForKey,
  holdersBasename,
  isArtCollectionKey,
  type ArtCollectionKey,
} from '../src/art-fixtures.js';
import {
  buildDropFromCollectionConfig,
  formatDropPackageVerifyResult,
  formatValidateDropResult,
  loadCollectionConfig,
  validateDrop,
  verifyDropPackage,
  writeAllowlistExport,
  zipDropFolder,
} from '../src/drop-node.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const examplesDir = path.join(repoRoot, 'examples');

function parseKeys(): ArtCollectionKey[] {
  const argv = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const env = (process.env.COLLECTION ?? '').trim().toLowerCase();
  const raw = (argv[0] ?? (env || 'tinies')).toLowerCase();
  if (raw === 'all') return ['demo', 'tinies', 'nodlings'];
  if (!isArtCollectionKey(raw)) {
    console.error(`Unknown COLLECTION=${raw}. Use tinies|nodlings|demo|all`);
    process.exit(1);
  }
  return [raw];
}

function buildOne(key: ArtCollectionKey): void {
  const configPath = path.join(examplesDir, collectionConfigBasename(key));
  const yamlPath = configPath.replace(/\.json$/, '.yaml');
  const dropFolderName = dropFolderForKey(key);

  console.log(`\n======== Nodeling drop: ${key} ========`);
  console.log('DreamForge drop build (offline) — no network / no SentX writes');

  const config = loadCollectionConfig(configPath);
  console.log(`Config: ${configPath}`);
  console.log(`Collection: ${config.name} (${config.symbol}) maxEdition=${config.maxEdition}`);
  console.log(`Tiers: ${config.tiers.map((t) => `${t.name}=${t.count}`).join(', ')}`);
  console.log(`Stages: ${config.stages.map((s) => `${s.id}/${s.kind}`).join(', ')}`);

  if (fs.existsSync(yamlPath)) {
    const fromYaml = loadCollectionConfig(yamlPath);
    if (fromYaml.collectionId !== config.collectionId || fromYaml.maxEdition !== config.maxEdition) {
      console.error('YAML twin mismatch vs JSON config');
      process.exit(1);
    }
    console.log(`YAML twin OK: ${yamlPath}`);
  }

  const artDir =
    key === 'tinies' || key === 'nodlings' ? artDirFor(repoRoot, key) : undefined;
  if (artDir) {
    console.log(`Art fixtures: ${artDir}`);
  } else {
    console.log('Art: synthetic tiny PNGs (demo fallback)');
  }

  const result = buildDropFromCollectionConfig(config, {
    outDir: examplesDir,
    folder: dropFolderName,
    clean: true,
    writeReceipts: true,
    artDir,
  });

  const snapshot = fixtureAllowlistSnapshot();
  const allow = writeAllowlistExport(snapshot, examplesDir, holdersBasename(key));

  const zipPath = path.join(examplesDir, `${dropFolderName}.zip`);
  fs.writeFileSync(zipPath, zipDropFolder(result.folder));

  console.log(`\nBuilt ${result.entries.length} editions → ${result.folder}`);
  console.log(`Hashes sidecar:   ${result.hashesPath}`);
  console.log(`Receipts sidecar: ${result.receiptsPath}`);
  console.log(`Allowlist:        ${allow.txtPath}`);
  console.log(`Snapshot:         ${allow.snapshotPath}`);
  console.log(`Zip:              ${zipPath} (${fs.statSync(zipPath).size} bytes)`);
  console.log(`HRL placeholder:  ${result.entries[0]?.hrl ?? '(none)'}`);
  console.log(`Sample image:     ${result.entries[0]?.image} (${fs.statSync(path.join(result.folder, result.entries[0]!.image)).size} bytes)`);

  const inside = fs.readdirSync(result.folder);
  if (inside.some((f) => f.includes('nodeling-receipts') || f.includes('nodeling-hashes'))) {
    console.error('FAIL: sidecar leaked into DreamForge folder');
    process.exit(1);
  }

  console.log('\n' + formatValidateDropResult(result.folder, result.validation));

  const expect: Record<string, number> = {};
  for (const t of config.tiers) expect[t.name] = t.count;
  const again = validateDrop(result.folder, { expect });
  console.log(formatValidateDropResult(result.folder, again));

  if (!again.ok) {
    console.error('Drop validate FAIL');
    process.exit(1);
  }
  console.log('\nDROP VALIDATE: PASS');

  const green = verifyDropPackage(result.folder, result.hashesPath, result.receiptsPath);
  console.log('\n' + formatDropPackageVerifyResult(green));
  if (!green.ok) {
    console.error('VERIFY-FROM-PACKAGE expected GREEN');
    process.exit(1);
  }
  console.log('VERIFY-FROM-PACKAGE: GREEN');

  const tamperEdition = Math.min(3, result.entries.length);
  const tamperPath = path.join(result.folder, `${tamperEdition}.png`);
  const original = fs.readFileSync(tamperPath);
  fs.writeFileSync(tamperPath, Buffer.concat([original, Buffer.from('TAMPER')]));
  const red = verifyDropPackage(result.folder, result.hashesPath, result.receiptsPath);
  console.log('\n' + formatDropPackageVerifyResult(red));
  if (red.ok || red.verdict !== 'RED') {
    console.error('VERIFY-FROM-PACKAGE expected RED after tamper');
    process.exit(1);
  }
  console.log(`VERIFY-FROM-PACKAGE (tampered ${tamperEdition}.png): RED (expected)`);

  fs.writeFileSync(tamperPath, original);
  const restored = verifyDropPackage(result.folder);
  if (!restored.ok) {
    console.error('Failed to restore drop after tamper demo');
    process.exit(1);
  }
  console.log(`Restored ${tamperEdition}.png — examples package left GREEN.`);
}

function main(): void {
  const keys = parseKeys();
  console.log(`Nodeling — building collection(s): ${keys.join(', ')}`);
  for (const key of keys) buildOne(key);
  console.log('\nAll requested drops built.');
}

main();
