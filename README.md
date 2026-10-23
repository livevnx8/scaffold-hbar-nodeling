# Nodeling (Scaffold-HBAR)

> **Nodeling** — Vera Labs’ Hashinal authenticity + NFT mint pad. Not a SentX competitor —
> prepare collections offline, mint (dry-run / later testnet), then list on SentX DreamForge
> or HashPack. NFT-first; Phase 2: music drops.

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
(`dryRun: true` / `liveInscription: 'stubbed'`). **Gated live smoke:**
`npm run mint:live -- --live` (testnet + operator env only; optional `--hrl`) — see
[docs/going-to-testnet.md](./docs/going-to-testnet.md) and
[docs/testnet-smoke-log.md](./docs/testnet-smoke-log.md). HCS-1 *file* inscription: `npm run inscribe:live -- --live` (HOL zstd/base64 chunks). Registry: `npm run anchor:live -- --live`. Read-only re-proof: `npm run verify:testnet`. Default `mint:live` is topic-as-HRL; pass `--hrl` to link an inscription.

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
- [Walkthrough](./docs/walkthrough.md)

## Positioning

List minted Hashinals on **SentX DreamForge** / **HashPack**. Nodeling owns inscription
prep, authenticity receipts, DreamForge packaging, and allowlists — not marketplace trading.

## License

MIT
