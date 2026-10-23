# Nodeling testnet smoke log

Public ids only — no keys.

| Field | Value |
|-------|-------|
| When (UTC) | 2026-10-23T17:06:51.708Z |
| Network | testnet |
| Operator | `0.0.10729262` |
| Topic | [`0.0.11144786`](https://hashscan.io/testnet/topic/0.0.11144786) |
| HRL | `hcs://1/0.0.11144786` |
| Token | [`0.0.11144787`](https://hashscan.io/testnet/token/0.0.11144787) (`Nodeling Smoke` / `NDLS`, maxSupply=1) |
| Serials | 1 (treasury `0.0.10729262`; metadata UTF-8 HRL verified on mirror) |
| Topic tx | [0.0.10729262@1792775205.015292685](https://hashscan.io/testnet/transaction/0.0.10729262%401792775205.015292685) |
| TokenCreate tx | [0.0.10729262@1792775206.499383914](https://hashscan.io/testnet/transaction/0.0.10729262%401792775206.499383914) |
| TokenMint tx | [0.0.10729262@1792775205.928351319](https://hashscan.io/testnet/transaction/0.0.10729262%401792775205.928351319) |
| Fees (approx) | TopicCreate 0.1265 + TokenCreate **12.6536** + TokenMint 0.2531 ≈ **13.0332 HBAR** |
| Balance | 22.3111 → **9.2741 HBAR** after smoke → **7.8415 HBAR** after registry deploy (+10 faucet before smoke) |
| Registry deploy | **yes** — `AuthenticityRegistry` at [`0xF19e3390933b318808a0df5Ed4fbD18783f10234`](https://hashscan.io/testnet/contract/0xF19e3390933b318808a0df5Ed4fbD18783f10234) |

## Notes

- This smoke uses **topic-as-HRL** (`hcs://1/0.0.11144786`) - the topic has **no file chunks**. HOL file inscription is a separate proof: topic [`0.0.11144977`](https://hashscan.io/testnet/topic/0.0.11144977) ([testnet-hcs1-inscribe-log.md](./testnet-hcs1-inscribe-log.md)).
- To mint an NFT whose metadata points at the file topic: fund >= ~15 HBAR, then `npm run mint:live -- --live --hrl hcs://1/0.0.11144977`.
- NFT metadata bytes = UTF-8 encoding of the HRL string (Hashinal pattern). Mirror confirmed serial 1 metadata.
- No custom royalty fees (lean smoke). TokenCreate is still ~$1 USD (~12.6 HBAR at Oct 23 2026 testnet FX).
- Gated: `npm run mint:live -- --live` (+ optional `--hrl`) + `HEDERA_NETWORK=testnet` + operator env.
- Read-only re-proof: `npm run verify:testnet`.
- Result JSON (gitignored): `packages/core/tmp/testnet-smoke-result.json`
- Earlier TopicCreate-only topics from fee-cap retries: `0.0.11144764`, `0.0.11144766`, `0.0.11144770` (unused by final mint).
