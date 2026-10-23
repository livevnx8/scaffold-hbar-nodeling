# Walkthrough

Audience-first paths (creator · collector · builder): [for-others.md](./for-others.md). UI: `/start`.


## Configure collection → stages → export → verify → list on SentX

1. **Configure collection** — edit `examples/nodeling-demo.collection.json` (YAML twin:
   `nodeling-demo.collection.yaml`) or use the mint pad **Collection config** card.
   Set name, symbol, creator, `maxEdition`, rarity `tiers` (counts must sum to supply),
   optional royalty / `hrlTopic`, and ordered **stages** (`allowlist` | `public` with
   optional `start` / `end` / `priceHbar` / `snapshotRef`).
2. **Stages + dry-run mint gate** — pick the active stage (manual selector or mock time).
   Allowlist stages require membership in the published snapshot; public stages allow any
   `0.0.x` account. No chain calls.
3. **Export** — `npm run drop:build` or mint pad **Export drop package**. Writes a DreamForge
   folder + zip; authenticity / hash sidecars sit **beside** the folder (never inside).
4. **Verify** — `verifyDropPackage` offline, or paste `*-nodeling-receipts.json` on `/verify`.
5. **List on SentX** — upload only the drop folder/zip in DreamForge / HashPack. Nodeling
   never writes to SentX or signs Hedera txs. Live HCS-1 / TokenCreate / TokenMint stay stubbed.

```bash
npm install && npm run build
npm run drop:build    # loads examples/nodeling-demo.collection.json
```

## 1. Offline demo

```bash
npm run demo
```

You should see one GREEN receipt and three RED refusals (tampered file, wrong edition,
forged allowlist), plus allowlist snapshot integrity, then a DreamForge drop build with
**DROP VALIDATE: PASS** and **VERIFY-FROM-PACKAGE: GREEN**.

## 2. DreamForge drop package

```bash
npm run drop:build
```

Writes:

- `examples/nodeling-demo.collection.json` / `.yaml` — collection + tiers + stages
- `examples/nodeling-demo-drop/metadata.json` — HIP-412 entries
- `examples/nodeling-demo-drop/1.png` … `8.png`
- `examples/nodeling-demo-drop.zip`
- `examples/nodeling-demo-drop-nodeling-hashes.json` / `*-receipts.json` (sidecars)
- `examples/nodeling-demo-holders.txt` — allowlist (sentx-drop holders style)
- `examples/allowlist-snapshot.json`

Validate with Nodeling or sentx-drop:

```bash
/workspace/sentx-drop/sentx_drop.py validate examples/nodeling-demo-drop --expect Common=5,Rare=2,Legendary=1
```

### Core APIs

| API | Role |
|-----|------|
| `loadCollectionConfig(path)` | JSON or YAML subset → `CollectionConfig` |
| `parseCollectionConfig` / `validateCollectionConfig` | schema + tier sum + stage order |
| `resolveActiveStage` / `checkMintGate` | dry-run allow/deny |
| `buildDropFromCollectionConfig` | tiers → DreamForge drop |

## 3. UI

```bash
npm run dev --workspace=@nodeling/nextjs
```

1. Open `/` — edit collection fields, tiers, and stages; select **active** stage.
2. Set mock now + minter; **Check mint gate** — allowlist denies `0.0.9999`, public allows.
3. **Export drop package** — zip from the current config.
4. **Build authenticity receipt** — GREEN for `0.0.2001` with allowlist on.
5. `/verify` — load fixture or receipts package.
6. `/allowlist` — snapshot hash + membership.

## 4. Tests

```bash
npm test
npm run lint
```

## Phase 2 note

Music-specific UX (audio player, ISRC, stems) is deferred. Core stays general NFT.
