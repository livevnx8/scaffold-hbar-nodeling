/**
 * Audience-first “how others utilize Nodeling” — stable shape for docs, /start, and agents.
 * Pure documentation helper — no network, no signing.
 */

export const NODELING_UTILIZE_AUDIENCES = ['creator', 'collector', 'builder'] as const;

export type NodelingUtilizeAudience = (typeof NODELING_UTILIZE_AUDIENCES)[number];

export interface NodelingUtilizePath {
  id: NodelingUtilizeAudience;
  title: string;
  oneLiner: string;
  steps: readonly string[];
  primaryUi: readonly string[];
  cliHints: readonly string[];
}

export interface NodelingUtilizeDescription {
  story: string;
  paths: readonly NodelingUtilizePath[];
  dayOneChecklist: readonly string[];
  docLinks: readonly { label: string; path: string }[];
  stubbedVsLive: {
    stubbed: readonly string[];
    liveLater: readonly string[];
  };
}

/**
 * How creators, collectors/partners, and builders/agents use Nodeling.
 * Keep in sync with docs/for-others.md and the mint-pad `/start` page.
 */
export function describeNodelingUtilize(): NodelingUtilizeDescription {
  return {
    story: 'Prove the art → stage the drop → dry-run the HRL mint → list on SentX.',
    paths: [
      {
        id: 'creator',
        title: 'Creator / drop ops',
        oneLiner:
          'Configure collection and stages, build a DreamForge drop, verify sidecars, upload folder/zip only to SentX.',
        steps: [
          'Configure collection (name, symbol, tiers, stages) in the mint pad or examples/*.collection.json',
          'Set whitelist vs public stages; dry-run the mint gate with a minter account',
          'Run npm run drop:build (or Export drop package) → DreamForge folder + zip',
          'Validate offline (validateDrop / DROP PASS); keep *-nodeling-receipts.json beside the folder',
          'Verify sidecars (verifyDropPackage or /verify) → GREEN before listing',
          'Upload only the drop folder or zip to SentX DreamForge / HashPack — leave sidecars out of the upload set',
        ],
        primaryUi: ['/', '/verify', '/allowlist', '/start'],
        cliHints: [
          'npm run drop:build',
          'COLLECTION=nodlings|demo|all npm run drop:build',
          'npm run mint:plan',
        ],
      },
      {
        id: 'collector',
        title: 'Collector / partner',
        oneLiner:
          'Paste receipts on /verify (or verifyDropPackage offline). GREEN = clean package; RED = tamper, bad edition, or forged allowlist.',
        steps: [
          'Get *-nodeling-receipts.json (or a single authenticity receipt) from the drop operator',
          'Open /verify — paste JSON, upload the sidecar, or paste an HRL',
          'GREEN: content hashes, editions, and receipt hashes match',
          'RED: file tampered, wrong edition, forged allowlist, or broken receipt',
          'Optional: /allowlist — check snapshot integrity + membership for whitelist rounds',
        ],
        primaryUi: ['/verify', '/allowlist', '/about'],
        cliHints: [
          'verifyDropPackage(dropDir) from @nodeling/core/drop',
          'verifyAuthenticityReceipt(receipt) from @nodeling/core',
        ],
      },
      {
        id: 'builder',
        title: 'Builder / agent',
        oneLiner:
          'Clone or copy the scaffold, npm install && npm run demo → GREEN/RED + DROP PASS; fork core APIs; live chain stays stubbed.',
        steps: [
          'Copy or clone scaffold-hbar-nodeling (Node ≥ 20.18.3)',
          'npm install && npm run build && npm run demo — expect GREEN/RED authenticity + Tinies DROP PASS + VERIFY-FROM-PACKAGE GREEN',
          'Use @nodeling/core for HRL, receipts, collection config, mint plan; @nodeling/core/drop for Node build/validate',
          'Fork points: collection-config, receipt checks, drop validate rules, mint plan steps, AuthenticityRegistry.sol',
          'Do not put keys in the browser; do not call SentX write APIs; live Hedera only behind env + explicit opt-in',
        ],
        primaryUi: ['/start', '/about', '/'],
        cliHints: [
          'npm install && npm run build && npm run demo',
          'npm test && npm run lint',
          'npm run dev --workspace=@nodeling/nextjs',
        ],
      },
    ],
    dayOneChecklist: [
      'npm install && npm run build (Node ≥ 20.18.3)',
      'npm run demo — confirm GREEN/RED + DROP PASS + VERIFY-FROM-PACKAGE GREEN',
      'npm run drop:build — inspect examples/tinies-drop/ and *-nodeling-receipts.json beside it',
      'npm run mint:plan — dry-run HCS-1 → TokenCreate → TokenMint (UTF-8 HRL)',
      'npm run dev --workspace=@nodeling/nextjs — open /start first (also primary CTA on /), then /, /verify, /allowlist, /about',
      'Export a drop from the mint pad; paste receipts on /verify → GREEN',
      'Read docs/NODELING-HASHINAL.md + docs/for-others.md',
      'When ready for chain: docs/going-to-testnet.md (keys + explicit opt-in only)',
    ],
    docLinks: [
      { label: 'For others (utilize runbook)', path: 'docs/for-others.md' },
      { label: 'Nodeling Hashinal (canonical)', path: 'docs/NODELING-HASHINAL.md' },
      { label: 'Walkthrough', path: 'docs/walkthrough.md' },
      { label: 'How it works', path: 'docs/how-it-works.md' },
      { label: 'Going to testnet', path: 'docs/going-to-testnet.md' },
    ],
    stubbedVsLive: {
      stubbed: [
        'Browser UI mint/inscribe/anchor (CLI only for live chain)',
        'Offline planHashinalMint / dryRunToken* (always dry-run)',
        'SentX write APIs (never called)',
        'Browser private keys (never)',
        'Mainnet (refused by live CLIs)',
      ],
      liveLater: [
        'npm run inscribe:live -- --live (HOL HCS-1 file bytes)',
        'npm run mint:live -- --live [--hrl hcs://1/<topic>]',
        'npm run anchor:live -- --live (AuthenticityRegistry)',
        'npm run verify:testnet (read-only re-proof)',
        'Manual list on SentX DreamForge / HashPack (operator upload)',
      ],
    },
  };
}
