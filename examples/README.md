# Examples

`npm run drop:build` defaults to **Tinies** real art (`COLLECTION=tinies`).

| Command | Output |
|---------|--------|
| `npm run drop:build` / `COLLECTION=tinies` | `tinies-drop/` + hashes/receipts sidecars + zip |
| `COLLECTION=nodlings npm run drop:build` | `nodlings-drop/` (8-of-673 sample) |
| `COLLECTION=demo npm run drop:build` | `nodeling-demo-drop/` (synthetic PNGs) |
| `COLLECTION=all npm run drop:build` | all three |

Configs:

- `tinies.collection.json` / `.yaml`
- `nodlings.collection.json` / `.yaml`
- `nodeling-demo.collection.json` / `.yaml`

Sidecars always sit **beside** the DreamForge folder (never inside it).

```bash
node -e "import('@nodeling/core/drop').then(m => console.log(m.verifyDropPackage('examples/tinies-drop')))"
```

Or paste `*-nodeling-receipts.json` into the mint pad `/verify` page.
