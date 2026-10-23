# How it works

**Nodeling** is Vera Labs’ product on top of the Hashinal protocol.

Canonical short spec: [NODELING-HASHINAL.md](./NODELING-HASHINAL.md).
How others use it (creator · collector · builder): [for-others.md](./for-others.md).

## Hashinals (short)

1. Inscribe file + metadata as HCS-1 chunks on a Hedera Consensus Service topic.
2. Create an HCS-5 NFT whose metadata is the HRL `hcs://1/<topicId>`.
3. Anyone can resolve the HRL to the inscribed content.

This template **defaults to offline dry-run** for inscription and TokenCreate/TokenMint. Live submit is CLI-gated (`inscribe:live` / `mint:live` / `anchor:live`). Offline, it still
builds the metadata shape, HRL placeholder, content hash, and authenticity receipt.

## Authenticity receipt

```
taskHash     = sha256(canonicalize(claim))
decisionHash = sha256(canonicalize({ v, taskHash, verdict, checks }))
```

Checks (v0):

- `content_hash` — observed file hash matches claim
- `edition` — `1..maxEdition`
- `creator` — non-empty
- `hrl` — well-formed `hcs://1/0.0.n`
- `metadata_hash` — 64-hex
- `allowlist` — optional membership against published snapshot

`verifyAuthenticityReceipt` recomputes `taskHash` / `decisionHash` so a **forged-after-the-fact** receipt cannot pass. That is **self-consistency only** — it does **not** re-hash files on disk or re-check allowlist membership against a snapshot. File/package re-check is `verifyDropPackage` (Node) / verify-from-package; membership is `verifyAllowlistMembership`.

## Allowlists

Holder CSVs from multiple collections are merged → sorted unique accounts →
`snapshotHash = sha256(canonicalize({ collections, accounts }))`. Membership is an
offline binary search. Forged snapshot hashes fail integrity.

**Misuse risk (by design):** the allowlist check in `buildAuthenticityReceipt` runs only when `claim.allowlistSnapshotHash` is set — omitting the snapshot hash skips membership (optional). When a snapshot *is* set, build requires `allowlistMember === true` (omitting the flag rejects), but build does **not** invoke `verifyAllowlistMembership` itself. Callers who pass `allowlistMember: true` without checking (or who omit the snapshot hash to skip the gate) can produce a green receipt; `verifyAuthenticityReceipt` will still pass because it only checks hash self-consistency. Always pass `allowlistMember: verifyAllowlistMembership(snapshot, minter)` when a snapshot is in play.


## DreamForge drop packages

`@nodeling/core/drop` (Node-only) builds SentX DreamForge-compatible folders:

- short filenames (≤32 chars)
- `metadata.json` array with unique contiguous `edition` + `image` + MIME `type`
- Hashinal `hrl` / `contentHash` in `properties` (and top-level `hrl`)
- `validateDrop(folder)` mirrors sentx-drop rules offline (no Python, no SentX API)

Sidecars (`*-nodeling-hashes.json`, `*-nodeling-receipts.json`, `holders.txt`) sit
**next to** the drop folder so the upload set stays clean.

Each receipts row binds `contentHash`, `metadataHash`, `hrl`, `taskHash`,
`decisionHash`, and `verdict` for that edition (full receipt embedded for paste-verify).

`verifyDropPackage(dropDir)` re-hashes files on disk and compares to both sidecars —
GREEN when everything matches, RED on tamper / HRL / edition mismatch.

Flow: **prep → validate → authenticity sidecar → list/mint on SentX**.

## On-chain (optional later)

`AuthenticityRegistry` stores `decisionHash` per `claimId` and optional collection
pointers (`allowlistSnapshotHash`, HTS `tokenId`). Operator-gated writes; public reads.

## Architecture boundary

| Deterministic (unit-tested) | I/O (stubbed / env-gated) |
|-----------------------------|---------------------------|
| HRL, canonicalize, receipts | Live HCS-1 inscription |
| Allowlist snapshot verify   | TokenCreate / TokenMint |
| HCS-1 chunk fixtures        | Registry deploy / anchor |
