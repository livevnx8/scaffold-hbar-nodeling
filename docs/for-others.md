# How others utilize Nodeling

Audience-first runbook. **Hashinal** is the protocol; **Nodeling** is Vera Labs’ authenticity + mint pad. Prep here, list on SentX DreamForge / HashPack — not a marketplace competitor.

**Story in one line:** prove the art → stage the drop → dry-run the HRL mint → list on SentX.

Canonical product/protocol spec: [NODELING-HASHINAL.md](./NODELING-HASHINAL.md). Code: `describeNodelingUtilize()` / `describeNodelingHashinal()` in `@nodeling/core`. UI: [`/start`](../packages/nextjs/app/start/page.tsx) · [`/about`](../packages/nextjs/app/about/page.tsx).

---

## Day-one checklist

1. `npm install && npm run build` (Node ≥ 20.18.3)
2. `npm run demo` — confirm **GREEN/RED** authenticity + Tinies **DROP PASS** + **VERIFY-FROM-PACKAGE GREEN**
3. `npm run drop:build` — inspect `examples/tinies-drop/` and `*-nodeling-receipts.json` **beside** the folder
4. `npm run mint:plan` — dry-run HCS-1 → TokenCreate → TokenMint (metadata = UTF-8 HRL)
5. `npm run dev --workspace=@nodeling/nextjs` — open **`/start`** first (Getting started; also the primary CTA on `/`), then `/`, `/verify`, `/allowlist`, `/about`
6. Export a drop from the mint pad; paste receipts on `/verify` → **GREEN**
7. Read [NODELING-HASHINAL.md](./NODELING-HASHINAL.md) + this file
8. When ready for chain: `npm run mint:live -- --live --hrl hcs://1/<topic>` after `inscribe:live` ([going-to-testnet.md](./going-to-testnet.md); testnet + keys only). Canonical linked demo already live: NFT `0.0.11146645` → `hcs://1/0.0.11144977` — re-proof with `npm run verify:testnet` or `/verify` → Load canonical HRL. Public CI runs on every push to `main`.

Longer operator walkthrough: [walkthrough.md](./walkthrough.md). Architecture: [how-it-works.md](./how-it-works.md).

---

## Path A — Creator / drop ops

**Goal:** Ship a SentX-ready DreamForge drop with authenticity sidecars you can prove.

1. **Configure collection** — mint pad **Collection config**, or edit `examples/*.collection.json` (name, symbol, creator, `maxEdition`, rarity tiers, optional `hrlTopic`).
2. **Stages** — whitelist vs public rounds (`start` / `end` / `priceHbar` / snapshot ref). Dry-run the mint gate with a minter account.
3. **Build** — `npm run drop:build` (Tinies default) or mint pad **Export drop package**. Also: `COLLECTION=nodlings|demo|all`.
4. **Validate** — offline `validateDrop(folder)` / demo **DROP PASS** (short filenames, contiguous editions, type↔ext).
5. **Verify sidecars** — `*-nodeling-receipts.json` and `*-nodeling-hashes.json` sit **beside** the folder (never inside the upload set). Check with `verifyDropPackage` or `/verify`.
6. **List on SentX** — upload **only** the drop folder or zip in DreamForge / HashPack. Nodeling never calls SentX write APIs.

| Artifact | Role |
|----------|------|
| `examples/tinies-drop/` | DreamForge media + `metadata.json` |
| `examples/tinies-drop.zip` | Same, zipped |
| `examples/tinies-drop-nodeling-receipts.json` | Authenticity receipts **sidecar** |
| `examples/tinies-drop-nodeling-hashes.json` | Content hashes **sidecar** |

---

## Path B — Collector / partner

**Goal:** Trust the package without trusting a screenshot.

1. Receive `*-nodeling-receipts.json` (or a single authenticity receipt) from the operator — the sidecar that sits **beside** the DreamForge folder, not inside the SentX zip.
2. Open **`/verify`** — paste the full JSON, use Upload JSON…, paste an HRL `hcs://1/<topicId>`, or try **Load canonical HRL** (testnet demo `hcs://1/0.0.11144977` → NFT [`0.0.11146645`](https://hashscan.io/testnet/token/0.0.11146645)).
3. Read the verdict:
   - **GREEN** — content hashes, editions, and `taskHash` / `decisionHash` recompute cleanly.
   - **RED** — tampered file, wrong edition, forged allowlist, or broken receipt.
4. Optional: **`/allowlist`** — published snapshot hash + membership for whitelist rounds.

Offline: `verifyDropPackage(dropDir)` from `@nodeling/core/drop`, or `verifyAuthenticityReceipt(receipt)` from `@nodeling/core`.

---

## Path C — Builder / agent

**Goal:** Run cold, fork the core, keep live chain gated.

```bash
# from scaffold root
npm install && npm run build
npm run demo          # GREEN/RED + DROP PASS + VERIFY-FROM-PACKAGE GREEN
npm test && npm run lint
npm run dev --workspace=@nodeling/nextjs
```

### Core APIs (start here)

| API | Package | Role |
|-----|---------|------|
| `describeNodelingHashinal()` | `@nodeling/core` | Canonical product/protocol description |
| `describeNodelingUtilize()` | `@nodeling/core` | Three audience paths + day-one checklist |
| `buildAuthenticityReceipt` / `verifyAuthenticityReceipt` | `@nodeling/core` | GREEN/RED receipts |
| `parseCollectionConfig` / `checkMintGate` / `planHashinalMint` | `@nodeling/core` | Config, stages, dry-run mint plan |
| `buildDrop` / `validateDrop` / `verifyDropPackage` | `@nodeling/core/drop` | DreamForge folder + sidecars (Node only) |

### Fork points

- Receipt checks (`receipt.ts` / `verify.ts`)
- Collection + stages (`collection-config.ts`)
- Drop validate rules (`validate-drop.ts`)
- Mint plan steps (`mint.ts`)
- `AuthenticityRegistry.sol` (Hardhat)

### Stubbed vs live

| Offline / never from UI | Live (CLI, opt-in `--live`) |
|-------------------------|------------------------------|
| `planHashinalMint` / dry-run helpers | `npm run inscribe:live -- --live` — HOL HCS-1 ([testnet-hcs1-inscribe-log.md](./testnet-hcs1-inscribe-log.md)) |
| Browser signing | `npm run mint:live -- --live --hrl …` (linked Hashinal — pitch this) or topic-as-HRL without `--hrl` ([testnet-smoke-log.md](./testnet-smoke-log.md)) |
| — | `npm run anchor:live -- --live` — AuthenticityRegistry |
| — | `npm run verify:testnet` — read-only re-proof |
| SentX writes | **Never** from this template — operator uploads manually |
| Browser private keys | **Never** |
| Mainnet | **Refused** by live CLIs |

Scaffold-HBAR fork shape: see root [AGENTS.md](../AGENTS.md) and [README.md](../README.md).

---

## Guardrails

- No network or credentials in `@nodeling/core` unit paths.
- No private keys in the browser.
- No SentX write APIs.
- Live Hedera only behind env + explicit opt-in.
- NFT-first; music drops are Phase 2.
