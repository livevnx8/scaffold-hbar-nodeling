# Going to testnet

v0 defaults to **dry-run / offline**. Nodeling builds Hashinal **payloads** with
`planHashinalMint`, `dryRunTokenCreate`, `dryRunTokenMint`. Those helpers never sign or submit.

Live submit is **opt-in only**: exact `--live` plus testnet operator env.

## Hashinal mint pattern (what the dry-run models)

1. **Inscribe** file/metadata with HCS-1 (Hashgraph Online / KiloScribe) → topic id
2. Form **HRL** `hcs://1/<topicId>`
3. **TokenCreateTransaction** — `NON_FUNGIBLE_UNIQUE`, `FINITE`, `maxSupply = maxEdition`
4. **TokenMintTransaction** — NFT **metadata bytes = UTF-8 encoding of the HRL string**
5. Optional: `AuthenticityRegistry.anchorReceipt(claimId, decisionHash)`

Offline commands:

```bash
npm run mint:plan    # create + first mint JSON
npm run demo         # includes mint plan after authenticity + drop verify
```

UI: `/` → **Mint plan (dry-run)** → `POST /api/mint/plan`

## Prerequisites (live)

1. Copy `packages/nextjs/.env.example` → `packages/nextjs/.env` (gitignored)
2. Set `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (ECDSA hex, `0x` optional), `HEDERA_KEY_TYPE=ECDSA`, `HEDERA_NETWORK=testnet`
3. **Never commit keys** — `.env` is gitignored; only `.env.example` ships
4. Keep operator keys off the browser; CLI / server-side only
5. Prefer a disposable testnet account with a few HBAR (≥ ~3 HBAR headroom)

## Live smoke (`mint:live`)

Gated CLI under `@nodeling/core`:

```bash
npm run mint:live -- --live
```

Refuses unless **all** of:

- argv contains exact `--live`
- `HEDERA_NETWORK=testnet` (mainnet refused)
- `HEDERA_OPERATOR_ID` + `HEDERA_OPERATOR_KEY` present

What it does (lean, **no custom royalty fees**):

1. `TopicCreateTransaction` → topic id → HRL `hcs://1/<topicId>`
2. `TokenCreateTransaction` NFT FINITE (default maxSupply=1), treasury+supplyKey=operator
3. `TokenMintTransaction` with metadata = UTF-8 bytes of that HRL

By default `mint:live` uses topic-as-HRL (no file bytes). For real file bytes:

```bash
npm run inscribe:live -- --live
npm run mint:live -- --live --hrl hcs://1/<topicFromInscribe>
```

(TokenCreate still costs ~12+ HBAR - fund the operator first.)

Outputs (public ids only):

- console summary + HashScan links
- `packages/core/tmp/testnet-smoke-result.json` (gitignored)
- `docs/testnet-smoke-log.md` (public ids; safe to share)

Spend guard: leave ≥ ~2 HBAR. **TokenCreate alone is ~$1 USD** (often 12+ HBAR at current testnet FX) even with no custom fees — fund the operator accordingly (faucet or transfer) before `--live`.

`npm run demo`, `mint:plan`, and unit tests **never** call this path and never read operator keys.


## Live HCS-1 file inscription (`inscribe:live`)

HOL / hiero HCS-1 on testnet (no TokenCreate):

```bash
npm run inscribe:live -- --live
```

Same gates as `mint:live` (`--live` + `HEDERA_NETWORK=testnet` + operator env).

1. Build tiny payload (default: 16×16 PNG)
2. `encodeHcs1Payload` — zstd(level 10) → base64 → JSON `{"o","c"}` with `data:<mime>;base64,` on `o=0`
3. `TopicCreateTransaction` — memo=`<sha256>:zstd:base64`, **submit key** set, **no admin key**
4. `TopicMessageSubmitTransaction` per chunk
5. Mirror verify: fetch → sort by `o` → decode → sha256 vs memo

Public log: [testnet-hcs1-inscribe-log.md](./testnet-hcs1-inscribe-log.md).
Does **not** create a new NFT (TokenCreate ~$1 / 12+ HBAR).

## Read-only re-verify

```bash
npm run verify:testnet
```

Re-checks smoke topic/token/NFT metadata, HOL HCS-1 decode (zstd), and AuthenticityRegistry bytecode/operator. No keys, no txs. See [testnet-e2e-checklist.md](./testnet-e2e-checklist.md).

## Registry anchor (`anchor:live`)

After registry deploy:

```bash
npm run anchor:live -- --live
```

Writes `AuthenticityRegistry.anchorReceipt(claimId, decisionHash)` then `verifyReceipt` - cheap vs TokenCreate.

## Deploy registry (optional)

After a successful smoke, if balance allows:

```bash
npm run deploy:testnet --workspace=@nodeling/hardhat
```

Hardhat reads `packages/nextjs/.env` (`HEDERA_OPERATOR_KEY` should be `0x`-prefixed hex for ethers). Set `HEDERA_REGISTRY_ADDRESS` from the deploy output. Dry-run registry stubs still come from `dryRunRegistryAnchor(receipt)`.

## Still stubbed / out of scope

| Step | Status |
|------|--------|
| Offline `planHcs1Inscription` / `planHashinalMint` / `dryRunToken*` | Always `dryRun: true` / `liveSubmission: 'stubbed'` (by design) |
| Live HCS-1 **file** inscription (HOL) | **Live** - `npm run inscribe:live -- --live` |
| Live TokenCreate/Mint | **Live** - `npm run mint:live -- --live` (+ optional `--hrl`) |
| Registry anchor | **Live** - `npm run anchor:live -- --live` |
| Linked Hashinal (NFT metadata to file topic) | Needs >= ~15 HBAR for TokenCreate with `--hrl` after `inscribe:live` |
| SentX write APIs | Out of scope - list manually on DreamForge after mint |
| Music drops | Phase 2 |
| Mainnet | Refused by live CLIs |

## Safety

- No private keys in the browser, README, or committed files
- Unit tests and `npm run demo` / `mint:plan` never read operator keys
- Prefer dry-run payloads until you pass `--live` on purpose
- NFT-first product scope; do not add music until Phase 2
