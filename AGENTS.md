# AGENTS.md: nodeling template

## What this is

A Scaffold-HBAR external template: **Nodeling** — Vera Labs’ Hashinal authenticity + NFT
mint pad on Hedera. Offline-first collection prep, authenticity receipts, and
multi-collection allowlists. Compatible with listing on SentX DreamForge / HashPack —
**not** a marketplace competitor.

Hashinal / HCS-1 / HCS-5 / HRL are protocol terms; **Nodeling** is the product name.

Canonical Hashinal definition: `docs/NODELING-HASHINAL.md` (`describeNodelingHashinal()` in `@nodeling/core`). How others use it: `docs/for-others.md` (`describeNodelingUtilize()`).

Path: `scaffold-hbar-nodeling`. Product name in `template.json` is `nodeling`.
Phase 2 may add music drops; v0 is general NFT.

Forkable via:

```bash
npm create scaffold-hbar@latest -- my-nodeling \
  --template <owner>/scaffold-hbar-nodeling \
  --ci --solidity-framework hardhat --package-manager npm
```


## For Scaffold-HBAR consumers / agents

Cold path (no Hedera account, no keys): `npm install && npm run build && npm run demo` → expect
GREEN/RED authenticity, Tinies **DROP PASS**, **VERIFY-FROM-PACKAGE GREEN**. Then
`npm run dev --workspace=@nodeling/nextjs` and open **`/start`**.

Audience runbook: **`docs/for-others.md`** (creator · collector · builder + day-one checklist).
Canonical Hashinal spec: `docs/NODELING-HASHINAL.md`. Utilize helper:
`describeNodelingUtilize()` in `@nodeling/core`. Do not call SentX write APIs; do not put
private keys in the browser; live Hedera stays env-gated (see `docs/going-to-testnet.md`).

## Layout

- `packages/core/`: pure TypeScript core. HRL parse/build, metadata canonicalize,
  authenticity receipts (`taskHash` / `decisionHash`), allowlist snapshot hash + membership,
  collection config + mint stages + dry-run mint gate, DreamForge drop `buildDrop` /
  `buildDropFromCollectionConfig` / `validateDrop` / `verifyDropPackage` (+ receipts sidecar),
  real-art loaders (`art-fixtures`), utilize paths (`describeNodelingUtilize`), HCS-1 chunk fixtures, Hashinal `planHashinalMint` /
  `dryRunTokenCreate` / `dryRunTokenMint` (metadata = UTF-8 HRL). **No network, no credentials,
  no randomness in `src/`** (synthetic PNG seeds are deterministic).
- `fixtures/`: lean Vera Labs art — Tinies (4) + Nodlings sample (8 of 673). Full sets stay outside.
- `packages/hardhat/`: `AuthenticityRegistry.sol` (receipt anchors + collection pointers).
- `packages/nextjs/`: App Router mint pad (Tinies/Nodlings/Demo presets), `/start`, `/verify`, `/allowlist`, `/about`.
- `packages/x402-hooks/`: dry-run spend-cap interfaces for agent mint (no signing).
- `template.json`: Scaffold-HBAR manifest (`name`: `nodeling`).

## Commands

```bash
npm install
npm run build
npm run demo                       # GREEN/RED + Tinies real-art DROP PASS + mint plan
npm run drop:build                 # default COLLECTION=tinies → examples/tinies-drop/
COLLECTION=nodlings|demo|all npm run drop:build
npm run mint:plan                  # TokenCreate + first TokenMint dry-run JSON
npm test
npm run lint
npm run deploy:testnet --workspace @nodeling/hardhat   # only with keys + opt-in
npm run dev --workspace @nodeling/nextjs
```

Clean-checkout note: workspace packages import compiled `dist/`. Run `npm run build`
before workspace-scoped tests.

## Conventions

- Deterministic core: same claim in → same receipt out. Hedera I/O is stubbed / env-gated;
  unit tests never hit the network.
- Receipts: `taskHash = sha256(canonicalize(claim))`;
  `decisionHash = sha256(canonicalize({ v, taskHash, verdict, checks }))`.
- Never commit secrets. Only `.env.example` ships.
- No private keys in the browser.
- Do not call SentX write APIs from this template.
- Node/fs drop APIs are on subpath `@nodeling/core/drop` so the Next.js client
  bundle stays browser-safe (`buildDrop`, `validateDrop`, `zipDropFolder`,
  `writeAllowlistExport`).

## Phase 2 (deferred)

Music drops: audio player, ISRC, stems/lossless file lists. Do not block v0 on these.
