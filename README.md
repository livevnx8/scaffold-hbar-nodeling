# Nodeling (Scaffold-HBAR)

> **Nodeling** — Vera Labs’ Hashinal authenticity + NFT mint pad. Not a SentX competitor —
> prepare collections offline-first, prove authenticity, then mint on Hedera testnet (gated CLI)
> and list on SentX DreamForge or HashPack. NFT-first; Phase 2: music drops.
>
> [![CI](https://github.com/livevnx8/scaffold-hbar-nodeling/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/livevnx8/scaffold-hbar-nodeling/actions/workflows/ci.yml)

**Hashinal** is the protocol (HCS-5 NFTs whose media/metadata are inscribed via HCS-1; the
NFT metadata is an HRL `hcs://1/<topicId>`). **Nodeling** is our product name for this pad.

Canonical definition: [docs/NODELING-HASHINAL.md](./docs/NODELING-HASHINAL.md) · How others use it: [docs/for-others.md](./docs/for-others.md) · UI: `/start` · `/about`.

This template mirrors the Scaffold-HBAR monorepo shape (Next.js + Hardhat workspaces,
`template.json`, offline `npm run demo`) with a Nodeling core.

## Quick start

**New here?** Open the mint pad at **`/start`** (Getting started), or read [docs/for-others.md](./docs/for-others.md) (creator · collector · builder + day-one checklist).


```bash
npm install          # Node >= 20.18.3
npm run build
npm run demo         # authenticity GREEN/RED + Tinies real-art drop PASS
npm run drop:build              # default: Tinies (real art) → examples/tinies-drop/
COLLECTION=nodlings npm run drop:build
COLLECTION=demo npm run drop:build      # synthetic tiny PNGs
COLLECTION=all npm run drop:build       # demo + tinies + nodlings
npm run mint:plan    # Hashinal TokenCreate + first TokenMint dry-run JSON
npm test
npm run lint
```

### Demo output (expected)

1. **GREEN** — fixture NFT metadata + HRL → authenticity receipt `verified`
2. **RED** — tampered file content hash → `rejected`
3. **RED** — wrong edition → `rejected`
4. **RED** — forged allowlist membership → `rejected`
5. **DROP PASS** — builds `examples/tinies-drop/` from real Vera Labs Tinies art
   (DreamForge `metadata.json` + short `1.png`… filenames) and validates offline
6. **VERIFY-FROM-PACKAGE GREEN** — re-hashes files vs `*-nodeling-receipts.json`, then
   shows **RED** after a temporary PNG tamper (restored before exit)

Plus a multi-collection allowlist snapshot (wolves + tinies fixtures) with sha256
integrity and membership checks. Offline `planHashinalMint` stays dry-run
(`dryRun: true` / `liveInscription: 'stubbed'`).

**Gated live smoke (testnet + operator env only)** — see
[docs/going-to-testnet.md](./docs/going-to-testnet.md) and
[docs/testnet-smoke-log.md](./docs/testnet-smoke-log.md):

| Command | Role |
|---------|------|
| `npm run inscribe:live -- --live` | HCS-1 *file* inscription (HOL zstd/base64 chunks) |
| `npm run mint:live -- --live --hrl hcs://1/<topic>` | **Pitch this** — linked Hashinal (metadata HRL → file topic) |
| `npm run mint:live -- --live` | Topic-as-HRL only (empty topic; fine for plumbing, not the demo) |
| `npm run anchor:live -- --live` | AuthenticityRegistry anchor |
| `npm run verify:testnet` | Read-only re-proof of the canonical linked demo |

Canonical linked Hashinal already on testnet: NFT [`0.0.11146645`](https://hashscan.io/testnet/token/0.0.11146645) → [`hcs://1/0.0.11144977`](https://hashscan.io/testnet/topic/0.0.11144977).

## Prep → validate → authenticity sidecar → list on SentX

1. **Build** a drop with `@nodeling/core` `buildDrop()` or `npm run drop:build`
2. **Validate** offline with `validateDrop(folder)` (mirrors sentx-drop rules: ≤32-char
   names, contiguous unique editions, type↔extension, no missing refs)
3. **Authenticity sidecar** — `*-nodeling-receipts.json` (and hashes) sit **next to** the
   DreamForge folder so they never break SentX validate. Check with
   `verifyDropPackage(folder)` or paste the receipts JSON on `/verify`
4. **Upload** only the drop folder/zip in SentX DreamForge / HashPack (this repo never
   calls SentX write APIs or signs Hedera txs)

Example artifact after `npm run drop:build`:

| Path | Role |
|------|------|
| `examples/nodeling-demo.collection.json` | Collection + tiers + mint stages (canonical) |
| `examples/nodeling-demo.collection.yaml` | Same config (YAML subset twin) |
| `examples/nodeling-demo-drop/` | DreamForge media + `metadata.json` |
| `examples/nodeling-demo-drop.zip` | Same, zipped (DreamForge only) |
| `examples/nodeling-demo-drop-nodeling-hashes.json` | Content hashes + HRL sidecar |
| `examples/nodeling-demo-drop-nodeling-receipts.json` | Per-edition authenticity receipts |
| `examples/nodeling-demo-holders.txt` | Allowlist (sentx-drop holders style) |
| `examples/allowlist-snapshot.json` | Published snapshot hash |

## Real-art fixtures

Local Vera Labs art under `fixtures/` (lean sample — **not** full production sets):

| Path | Role |
|------|------|
| `fixtures/tinies/` | All 4 Tinies PNGs + contact sheet (sheet = docs only) |
| `fixtures/nodlings/` | 8 PNG+JSON sample from the 673 DreamForge zip |
| `fixtures/brand/nodling-hero.png` | Brand/hero concept |
| `examples/tinies.collection.json` | Tinies collection + stages (default drop) |
| `examples/nodlings.collection.json` | Nodlings sample (maxEdition 8) |
| `examples/nodeling-demo.collection.json` | Synthetic demo fallback |

Upstream sources stay outside the scaffold (`hedera-nft/tinies/`, `43v3r/43v3r-nodlings-673.zip`).
Do not unpack the full Nodlings zip into this repo.

Example after `npm run drop:build` (Tinies default):

| Path | Role |
|------|------|
| `examples/tinies-drop/` | DreamForge media + `metadata.json` |
| `examples/tinies-drop.zip` | Same, zipped |
| `examples/tinies-drop-nodeling-hashes.json` | Content hashes sidecar |
| `examples/tinies-drop-nodeling-receipts.json` | Authenticity receipts sidecar |


## Testnet status (public)

Read-only re-proof: `npm run verify:testnet`. Evidence + HashScan links:
[docs/testnet-e2e-checklist.md](./docs/testnet-e2e-checklist.md) ·
[docs/testnet-smoke-log.md](./docs/testnet-smoke-log.md) ·
[docs/testnet-hcs1-inscribe-log.md](./docs/testnet-hcs1-inscribe-log.md) ·
[docs/testnet-anchor-log.md](./docs/testnet-anchor-log.md).

### Canonical demo — linked Hashinal (gap CLOSED)

| | Id | HashScan |
|---|-----|----------|
| Linked smoke NFT | `0.0.11146645` serial 1 | [token](https://hashscan.io/testnet/token/0.0.11146645) · [NFT #1](https://hashscan.io/testnet/token/0.0.11146645/1) |
| Metadata HRL | `hcs://1/0.0.11144977` → file topic with HOL bytes | [topic](https://hashscan.io/testnet/topic/0.0.11144977) |
| TokenCreate | `0.0.10729262@1792786827.056233975` | [tx](https://hashscan.io/testnet/transaction/0.0.10729262%401792786827.056233975) |
| TokenMint | `0.0.10729262@1792786831.874170255` | [tx](https://hashscan.io/testnet/transaction/0.0.10729262%401792786831.874170255) |
| Registry | `0xF19e3390933b318808a0df5Ed4fbD18783f10234` | [contract](https://hashscan.io/testnet/contract/0xF19e3390933b318808a0df5Ed4fbD18783f10234) |

Command that closed the link: `npm run mint:live -- --live --hrl hcs://1/0.0.11144977` (funded with 12 HBAR from `0.0.9034044`). Full table: [docs/testnet-smoke-log.md](./docs/testnet-smoke-log.md).

**Historical only** (superseded empty-topic smoke): NFT `0.0.11144787` → empty topic `0.0.11144786` — do not pitch as the demo Hashinal.

### Verification boundaries (do not overclaim)

- `verifyAuthenticityReceipt(receipt)` — **self-consistency only** (recomputes `taskHash` / `decisionHash`). It does **not** re-hash files on disk.
- Package / file re-check — `verifyDropPackage(folder)` (or verify-from-package / `/verify` with a receipts package + local files via drop tooling).
- **Allowlist misuse risk:** the allowlist check runs only when `claim.allowlistSnapshotHash` is set. Omitting the snapshot hash skips membership (optional by design). When a snapshot *is* set, build requires `allowlistMember === true`, but build does **not** call `verifyAllowlistMembership` itself — callers who pass `allowlistMember: true` without checking can mint a green receipt; `verifyAuthenticityReceipt` will still pass that forged membership flag. Always pass `allowlistMember: verifyAllowlistMembership(snapshot, minter)`.

Public CI (badge above): [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs `npm ci` → `npm test` → `npm run lint` → `npm run build` → `npm run demo` on every push/PR to `main`.

## Packages

| Package | Role |
|---------|------|
| `@nodeling/core` | HRL, metadata, receipts, allowlists, **DreamForge drop build/validate**, **Hashinal mint payloads** (dry-run) |
| `@nodeling/hardhat` | `AuthenticityRegistry.sol` + tests |
| `@nodeling/nextjs` | Mint pad UI, `/start`, `/verify`, `/allowlist`, `/about`, `/api/drop/export` |
| `@nodeling/x402-hooks` | Dry-run agent spend-cap interfaces (no signing) |

## UI

```bash
npm run dev --workspace=@nodeling/nextjs
```

- `/start` — **Getting started** — creator / collector / builder paths + day-one checklist
- `/` — **Tinies / Nodlings / Demo presets**, preview real art, edit tiers/stages, mint gate, mint plan, export
- `/verify` — paste receipt JSON, receipts package, or HRL; upload `*-nodeling-receipts.json`
- `/allowlist` — published snapshot hash + membership check
- `/about` — what is a Nodeling Hashinal?
- Screenshots (reference): `docs/screenshots/mint-tinies.png`, `mint-nodlings.png`, `verify.png`, `allowlist.png` — capture `/start` locally after `npm run dev` if you need a Getting started shot
- `GET/POST /api/drop/export?preset=tinies` — zip from real art or POSTed collection config
- `GET /api/collection?preset=tinies|nodlings|demo` — collection config + art manifest
- `GET /api/art?collection=tinies&edition=1` — serve fixture PNG
- `POST /api/mint-gate` — dry-run allow/deny for stage + minter

## Docs

- [How others utilize Nodeling](./docs/for-others.md) — creator · collector · builder + day-one checklist
- [Nodeling Hashinal (canonical)](./docs/NODELING-HASHINAL.md)
- [How it works](./docs/how-it-works.md)
- [Going to testnet](./docs/going-to-testnet.md)
- [Testnet E2E checklist](./docs/testnet-e2e-checklist.md) — offline + HashScan + known gap
- [Walkthrough](./docs/walkthrough.md)

## Positioning

List minted Hashinals on **SentX DreamForge** / **HashPack**. Nodeling owns inscription
prep, authenticity receipts, DreamForge packaging, and allowlists — not marketplace trading.

## License

MIT
