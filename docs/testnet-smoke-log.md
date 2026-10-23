# Nodeling testnet smoke log

Public ids only — no keys.

## Canonical demo — linked Hashinal (CLOSED gap)

NFT metadata HRL points at the HCS-1 file topic that holds HOL bytes.

| Field | Value |
|-------|-------|
| When (UTC) | 2026-10-23T20:20:36.356Z |
| Network | testnet |
| Operator | `0.0.10729262` |
| File topic (HCS-1 HOL) | [`0.0.11144977`](https://hashscan.io/testnet/topic/0.0.11144977) |
| Metadata HRL | `hcs://1/0.0.11144977` |
| Token | [`0.0.11146645`](https://hashscan.io/testnet/token/0.0.11146645) (`Nodeling Smoke` / `NDLS`, maxSupply=1) |
| NFT serial | [1](https://hashscan.io/testnet/token/0.0.11146645/1) (treasury `0.0.10729262`; metadata UTF-8 HRL verified on mirror) |
| TopicCreate | skipped — reused existing `--hrl` |
| TokenCreate tx | [0.0.10729262@1792786827.056233975](https://hashscan.io/testnet/transaction/0.0.10729262%401792786827.056233975) |
| TokenMint tx | [0.0.10729262@1792786831.874170255](https://hashscan.io/testnet/transaction/0.0.10729262%401792786831.874170255) |
| Fees (approx) | TokenCreate 12.742370 + TokenMint 0.254847 ≈ **12.9972 HBAR** |
| Funding | 12 HBAR transferred `0.0.9034044` → `0.0.10729262`, tx [0.0.9034044@1792786813.724555420](https://hashscan.io/testnet/transaction/0.0.9034044%401792786813.724555420) |
| Balance | 19.5044 → 6.7621 HBAR after mint |
| Registry | [`0xF19e3390933b318808a0df5Ed4fbD18783f10234`](https://hashscan.io/testnet/contract/0xF19e3390933b318808a0df5Ed4fbD18783f10234) (prior deploy) |

### Notes

- **Linked:** metadata HRL = file topic. Pair with [testnet-hcs1-inscribe-log.md](./testnet-hcs1-inscribe-log.md) for HOL bytes / hash `05fe3924…2a04`.
- NFT metadata bytes = UTF-8 encoding of the HRL string (Hashinal pattern).
- No custom royalty fees (lean smoke).
- Command used: `npm run mint:live -- --live --hrl hcs://1/0.0.11144977`
- Read-only re-proof: `npm run verify:testnet` (defaults to this linked mint).
- Result JSON (gitignored): `packages/core/tmp/testnet-smoke-result.json`

## Historical — empty-topic smoke (superseded)

Earlier topic-as-HRL smoke (no file chunks on the metadata topic). Kept for HashScan archaeology only — **not** the demo to pitch.

| Field | Value |
|-------|-------|
| When (UTC) | 2026-10-23T17:06:51.708Z |
| Topic (empty) | [`0.0.11144786`](https://hashscan.io/testnet/topic/0.0.11144786) |
| HRL | `hcs://1/0.0.11144786` |
| Token | [`0.0.11144787`](https://hashscan.io/testnet/token/0.0.11144787) serial [1](https://hashscan.io/testnet/token/0.0.11144787/1) |
| TopicCreate tx | [0.0.10729262@1792775205.015292685](https://hashscan.io/testnet/transaction/0.0.10729262%401792775205.015292685) |
| TokenCreate tx | [0.0.10729262@1792775206.499383914](https://hashscan.io/testnet/transaction/0.0.10729262%401792775206.499383914) |
| TokenMint tx | [0.0.10729262@1792775205.928351319](https://hashscan.io/testnet/transaction/0.0.10729262%401792775205.928351319) |
| Fees (approx) | ≈ **13.0332 HBAR** |
| Unused fee-cap topics | `0.0.11144764`, `0.0.11144766`, `0.0.11144770` |
