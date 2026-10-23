# Testnet end-to-end checklist

Public ids only. Operator historically `0.0.10729262`.

## Offline (no keys)

```bash
npm install
npm test          # core + hardhat + nextjs + x402 - all green
npm run lint
npm run build
npm run demo      # authenticity GREEN + DROP PASS + dry-run mint plan
COLLECTION=tinies npm run drop:build
npm run mint:plan
```

Collector / partner verify-from-package (offline):

```bash
# after drop:build - sidecars next to examples/*-drop/
# UI: npm start -> /verify - paste receipts JSON -> GREEN
```

## Read-only on-chain re-proof

```bash
npm run verify:testnet
```

Expected PASS:

| Check | Id |
|-------|-----|
| Smoke topic | `0.0.11144786` |
| NFT | `0.0.11144787` serial 1 - metadata `hcs://1/0.0.11144786` |
| HCS-1 HOL | `0.0.11144977` - hash `05fe3924...2a04` |
| Registry | `0xF19e3390933b318808a0df5Ed4fbD18783f10234` |
| Anchored claim | `nodeling-smoke-2026-10-23` / `0x92c57760…7f42aa79` — verifyReceipt PASS ([log](./testnet-anchor-log.md)) |

## Live (gated `--live`, testnet only)

Prereqs: `packages/nextjs/.env` with `HEDERA_NETWORK=testnet`, operator id/key (ECDSA), registry address.

```bash
# 1) File inscription (cheap ~0.26 HBAR)
npm run inscribe:live -- --live

# 2) Registry anchor (cheap)
npm run anchor:live -- --live

# 3) NFT mint - topic-as-HRL (TokenCreate ~12+ HBAR) OR link to file topic:
npm run mint:live -- --live
# npm run mint:live -- --live --hrl hcs://1/<topicFromStep1>

# 4) Re-proof
npm run verify:testnet
```

## Creator path (story)

1. **Prove** - `npm run demo` / receipts GREEN
2. **Stage** - `COLLECTION=tinies npm run drop:build`
3. **Dry-run HRL** - `npm run mint:plan`
4. **Live** (opt-in) - `inscribe:live` -> `mint:live --hrl ...` -> `anchor:live`
5. **Verify** - `npm run verify:testnet` + `/verify` UI for packages
6. **List** - manual SentX DreamForge / HashPack (never from this template)

## Known gap (severity: medium until funded)

Smoke NFT `0.0.11144787` metadata points at empty topic `0.0.11144786`, while HOL file bytes live on `0.0.11144977`. Closing the link requires another TokenCreate (~12+ HBAR) with `--hrl hcs://1/0.0.11144977`. Operator balance at last check was ~7.58 HBAR (faucet Cloudflare-blocked from this box).
