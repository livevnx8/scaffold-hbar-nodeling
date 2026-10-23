# Nodeling testnet HCS-1 inscription log

Public ids only — no keys.

| Field | Value |
|-------|-------|
| When (UTC) | 2026-10-23T17:31:01.860Z |
| Network | testnet |
| Operator | `0.0.10729262` |
| Topic | [`0.0.11144977`](https://hashscan.io/testnet/topic/0.0.11144977) |
| HRL | `hcs://1/0.0.11144977` |
| Memo | `05fe3924838f8954e89000a338bb699f59a41f5c9233790df91cd665c0632a04:zstd:base64` |
| Content sha256 | `05fe3924838f8954e89000a338bb699f59a41f5c9233790df91cd665c0632a04` |
| MIME | `image/png` (16×16 PNG, 79 bytes raw → 88 zstd) |
| Chunks | 1 |
| TopicCreate tx | [0.0.10729262@1792776649.750573014](https://hashscan.io/testnet/transaction/0.0.10729262%401792776649.750573014) |
| Fees (approx) | **0.2557 HBAR** (TopicCreate + 1 submits) |
| Balance | 7.8415 → **7.5845 HBAR** |
| Mirror verify | **PASS** — PASS: 1 chunks, sha256 matches memo, mime=image/png, bytes=79 |

## HOL compliance

- Topic memo = `<sha256_of_raw>:zstd:base64`
- Submit key set; **no** admin key
- Messages: JSON `{"o":index,"c":"..."}`; `o=0` starts with `data:image/png;base64,`
- Pipeline: zstd(level 10) → base64 → chunk ≤960 chars (JSON ≤1024 bytes) → `TopicMessageSubmitTransaction`

## Related (prior smoke, unchanged)

- Token `0.0.11144787` / topic `0.0.11144786` / registry `0xF19e3390933b318808a0df5Ed4fbD18783f10234`

Gated: `npm run inscribe:live -- --live`. Result JSON (gitignored): `packages/core/tmp/testnet-hcs1-result.json`
