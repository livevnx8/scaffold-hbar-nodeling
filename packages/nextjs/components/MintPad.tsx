'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ReceiptCard } from './ReceiptCard';
import type {
  AuthenticityReceipt,
  CollectionConfig,
  CollectionStage,
  HashinalMintPlan,
  HashinalNftMetadata,
  MintGateResult,
} from '@nodeling/core';

type FixtureBundle = {
  collection: CollectionConfig;
  metadata: HashinalNftMetadata;
  receipt: AuthenticityReceipt;
  inscription: { hrl: string; liveInscription: string; chunks: unknown[] };
  tokenCreate: { dryRun: boolean; name: string; symbol: string; maxSupply: number };
  tokenMint: { dryRun: boolean; tokenIdPlaceholder: string; serialPlaceholder: number };
  snapshot: { snapshotHash: string; accounts: string[]; collections: string[] };
};

type TierDraft = { key: string; name: string; count: number };

function emptyStage(id: string): CollectionStage {
  return { id, name: id, kind: 'public', priceHbar: '100' };
}

export function MintPad() {
  const [fixture, setFixture] = useState<FixtureBundle | null>(null);
  const [name, setName] = useState('Tiny Beanie');
  const [description, setDescription] = useState(
    'Fixture Nodeling Hashinal NFT for offline authenticity demo.',
  );
  const [creator, setCreator] = useState('Vera Labs');
  const [edition, setEdition] = useState(1);
  const [maxEdition, setMaxEdition] = useState(4);
  const [minterAccount, setMinterAccount] = useState('0.0.2001');
  const [useAllowlist, setUseAllowlist] = useState(true);
  const [receipt, setReceipt] = useState<AuthenticityReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [preset, setPreset] = useState<'tinies' | 'nodlings' | 'demo'>('tinies');
  const [artEditions, setArtEditions] = useState<
    Array<{ edition: number; file: string; name?: string; trait?: string }>
  >([]);
  const [previewEdition, setPreviewEdition] = useState(1);

  // Collection editor
  const [colName, setColName] = useState('Tinies');
  const [colSymbol, setColSymbol] = useState('TINY');
  const [colCreator, setColCreator] = useState('Vera Labs');
  const [colDescription, setColDescription] = useState('');
  const [colMaxEdition, setColMaxEdition] = useState(4);
  const [colHrlTopic, setColHrlTopic] = useState('0.0.900010');
  const [colId, setColId] = useState('tinies');
  const [tiers, setTiers] = useState<TierDraft[]>([
    { key: 'beanie', name: 'Beanie', count: 1 },
    { key: 'shades', name: 'Shades', count: 1 },
    { key: 'astro', name: 'Astro', count: 1 },
    { key: 'holo', name: 'Holo', count: 1 },
  ]);
  const [stages, setStages] = useState<CollectionStage[]>([]);
  const [activeStageId, setActiveStageId] = useState('wl');
  const [mockNow, setMockNow] = useState('2026-10-05T12:00:00.000Z');
  const [gateResult, setGateResult] = useState<MintGateResult | null>(null);
  const [gateBusy, setGateBusy] = useState(false);
  const [mintPlan, setMintPlan] = useState<HashinalMintPlan | null>(null);
  const [mintPlanSummary, setMintPlanSummary] = useState<string | null>(null);
  const [mintPlanBusy, setMintPlanBusy] = useState(false);

  const tierSum = useMemo(() => tiers.reduce((a, t) => a + (Number(t.count) || 0), 0), [tiers]);

  const draftCollection = useCallback((): CollectionConfig => {
    return {
      collectionId: colId || 'nodeling-demo',
      name: colName,
      symbol: colSymbol,
      creator: colCreator,
      description: colDescription || undefined,
      maxEdition: colMaxEdition,
      maxSupply: colMaxEdition,
      hrlTopic: colHrlTopic || undefined,
      nameTemplate: `${colName} #{n}`,
      tiers: tiers.map((t) => ({
        key: t.key,
        name: t.name,
        count: Number(t.count) || 0,
      })),
      attributes: [
        { trait_type: 'Artist', value: colCreator },
        { trait_type: 'Protocol', value: 'Hashinal' },
      ],
      stages,
      allowlistSnapshotRef: 'allowlist-snapshot.json',
      allowlistSnapshotHash: fixture?.snapshot.snapshotHash,
    };
  }, [
    colId,
    colName,
    colSymbol,
    colCreator,
    colDescription,
    colMaxEdition,
    colHrlTopic,
    tiers,
    stages,
    fixture?.snapshot.snapshotHash,
  ]);

  const applyCollection = useCallback((c: CollectionConfig) => {
    setColId(c.collectionId);
    setColName(c.name);
    setColSymbol(c.symbol);
    setColCreator(c.creator);
    setColDescription(c.description ?? '');
    setColMaxEdition(c.maxEdition);
    setColHrlTopic(c.hrlTopic ?? '');
    setTiers(c.tiers.map((t) => ({ ...t })));
    setStages(c.stages.map((s) => ({ ...s })));
    setActiveStageId(c.stages[0]?.id ?? 'wl');
    setMaxEdition(c.maxEdition);
  }, []);

  const loadPreset = useCallback(
    async (next: 'tinies' | 'nodlings' | 'demo') => {
      setError(null);
      setPreset(next);
      const data = (await fetch(`/api/collection?preset=${next}`).then((r) => r.json())) as {
        collection: CollectionConfig;
        art?: { editions?: Array<{ edition: number; file: string; name?: string; trait?: string }> };
        error?: string;
      };
      if (data.error) throw new Error(data.error);
      applyCollection(data.collection);
      const eds = data.art?.editions ?? [];
      setArtEditions(eds);
      setPreviewEdition(eds[0]?.edition ?? 1);
      if (eds[0]?.name) setName(eds[0].name);
      setCreator(data.collection.creator);
      setDescription(data.collection.description ?? '');
      setEdition(1);
    },
    [applyCollection],
  );

  useEffect(() => {
    fetch('/api/fixture')
      .then((r) => r.json())
      .then((data: FixtureBundle) => {
        setFixture(data);
        setReceipt(data.receipt);
      })
      .catch((e: Error) => setError(e.message));

    loadPreset('tinies').catch((e: Error) => setError(e.message));
  }, [loadPreset]);

  async function onBuild() {
    setError(null);
    const res = await fetch('/api/fixture');
    const data = (await res.json()) as FixtureBundle;
    const allow = await fetch(
      `/api/allowlist?account=${encodeURIComponent(minterAccount)}`,
    ).then((r) => r.json());

    const meta = {
      ...data.metadata,
      name,
      description,
      creator,
      edition,
      maxEdition,
    };

    const hashinal = await import('@nodeling/core');
    const metadataHash = hashinal.metadataHashFor(meta);
    const claim = {
      ...data.receipt.claim,
      claimId: `claim-${name.toLowerCase().replace(/\s+/g, '-')}-${edition}`,
      creator,
      edition,
      maxEdition,
      contentHash: hashinal.FIXTURE_IMAGE_HASH,
      metadataHash,
      hrl: data.inscription.hrl,
      minterAccount,
      allowlistSnapshotHash: useAllowlist ? allow.snapshot.snapshotHash : undefined,
    };
    const built = hashinal.buildAuthenticityReceipt({
      claim,
      observedContentHash: hashinal.FIXTURE_IMAGE_HASH,
      allowlistMember: useAllowlist ? Boolean(allow.membership?.member) : undefined,
    });
    setReceipt(built);
    setFixture({ ...data, metadata: meta });
  }

  async function onCheckGate() {
    setError(null);
    setGateBusy(true);
    setGateResult(null);
    try {
      const res = await fetch('/api/mint-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          minterAccount,
          stageId: activeStageId,
          now: mockNow || undefined,
          collection: draftCollection(),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'mint gate failed');
      setGateResult(body as MintGateResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGateBusy(false);
    }
  }

  async function onMintPlan() {
    setError(null);
    setMintPlanBusy(true);
    setMintPlan(null);
    setMintPlanSummary(null);
    try {
      const collection = draftCollection();
      const hrl = colHrlTopic
        ? `hcs://1/${colHrlTopic}`
        : fixture?.inscription.hrl ?? 'hcs://1/0.0.900001';
      const res = await fetch('/api/mint/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection,
          hrl,
          editions: [1],
          minterAccount,
          stageId: activeStageId,
          now: mockNow || undefined,
          treasuryAccountId: '0.0.8001',
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'mint plan failed');
      setMintPlan(body.plan as HashinalMintPlan);
      setMintPlanSummary(typeof body.summary === 'string' ? body.summary : null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMintPlanBusy(false);
    }
  }

  async function onExportDrop() {
    setError(null);
    setExportStatus('Building DreamForge zip from collection config…');
    try {
      const collection = draftCollection();
      if (tierSum !== collection.maxEdition) {
        throw new Error(`tier counts sum to ${tierSum} but maxEdition is ${collection.maxEdition}`);
      }
      const res = await fetch('/api/drop/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collection, format: 'zip', preset }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const zipName =
        preset === 'tinies'
          ? 'tinies-drop.zip'
          : preset === 'nodlings'
            ? 'nodlings-drop.zip'
            : 'nodeling-demo-drop.zip';
      a.download = zipName;
      a.click();
      URL.revokeObjectURL(url);
      const entries = res.headers.get('X-Nodeling-Entries') ?? String(collection.maxEdition);
      const art = res.headers.get('X-Nodeling-Art') ?? 'synthetic';
      setExportStatus(
        `Downloaded ${zipName} (${entries} editions, art=${art}) — validate PASS · stage ${activeStageId}`,
      );
    } catch (e) {
      setExportStatus(null);
      setError((e as Error).message);
    }
  }

  function updateStage(i: number, patch: Partial<CollectionStage>) {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function updateTier(i: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }

  const activeStage = stages.find((s) => s.id === activeStageId) ?? stages[0];

  return (
    <>
      <header className="hero">
        <h1>Nodeling</h1>
        <p className="lede">
          Prove the art → stage the drop → dry-run the HRL mint → list on SentX.
        </p>
        <p className="muted">
          Vera Labs’ Hashinal authenticity + mint pad. Offline-first; not a SentX competitor.
          New here? Start with Getting started — then come back to export a drop.
        </p>
        <p className="hero-ctas">
          <a className="btn" href="/start">
            Getting started
          </a>
          <a className="btn secondary" href="/about">
            What is a Nodeling Hashinal?
          </a>
          <a className="btn secondary" href="/verify">
            Verify a package
          </a>
        </p>
      </header>

      {error && (
        <div className="card">
          <span className="badge red">ERROR</span> {error}
        </div>
      )}

      <div className="card">
        <h2>Art preset</h2>
        <p className="muted">
          Real Vera Labs art fixtures (Tinies default). Nodlings = 8-of-673 sample. Demo =
          synthetic tiny PNGs.
        </p>
        <div className="stages" style={{ marginBottom: '0.75rem' }}>
          {(['tinies', 'nodlings', 'demo'] as const).map((p) => (
            <button
              type="button"
              key={p}
              className={`stage-chip ${preset === p ? 'active' : ''}`}
              onClick={() => void loadPreset(p).catch((e: Error) => setError(e.message))}
              style={{ cursor: 'pointer' }}
            >
              {p === 'tinies' ? 'Tinies (real)' : p === 'nodlings' ? 'Nodlings (sample)' : 'Demo (synthetic)'}
              {preset === p ? ' · ACTIVE' : ''}
            </button>
          ))}
        </div>
        {preset !== 'demo' && artEditions.length > 0 && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                gap: '0.5rem',
              }}
            >
              {artEditions.map((ed) => (
                <button
                  type="button"
                  key={ed.edition}
                  onClick={() => {
                    setPreviewEdition(ed.edition);
                    setEdition(ed.edition);
                    if (ed.name) setName(ed.name);
                  }}
                  style={{
                    border:
                      previewEdition === ed.edition
                        ? '2px solid var(--accent, #7c5cff)'
                        : '1px solid #333',
                    borderRadius: 8,
                    padding: 4,
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  {}
                  <img
                    src={`/api/art?collection=${preset}&edition=${ed.edition}`}
                    alt={ed.name ?? `#${ed.edition}`}
                    style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 4 }}
                  />
                  <span className="muted" style={{ fontSize: '0.7rem' }}>
                    #{ed.edition} {ed.trait ?? ed.name ?? ''}
                  </span>
                </button>
              ))}
            </div>
            {preset === 'tinies' && (
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                <a href="/api/art?collection=tinies&file=tinies_sheet.png" target="_blank" rel="noreferrer">
                  Tinies contact sheet
                </a>{' '}
                (docs only — not an edition)
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Collection config</h2>
        <div className="row">
          <div>
            <label>Name</label>
            <input value={colName} onChange={(e) => setColName(e.target.value)} />
            <label>Symbol</label>
            <input value={colSymbol} onChange={(e) => setColSymbol(e.target.value)} />
            <label>Creator</label>
            <input value={colCreator} onChange={(e) => setColCreator(e.target.value)} />
          </div>
          <div>
            <label>Collection id</label>
            <input value={colId} onChange={(e) => setColId(e.target.value)} />
            <label>Max edition / supply</label>
            <input
              type="number"
              min={1}
              max={32}
              value={colMaxEdition}
              onChange={(e) => setColMaxEdition(Number(e.target.value))}
            />
            <label>HRL topic placeholder</label>
            <input value={colHrlTopic} onChange={(e) => setColHrlTopic(e.target.value)} />
          </div>
        </div>
        <label>Description</label>
        <textarea value={colDescription} onChange={(e) => setColDescription(e.target.value)} />

        <h3 style={{ marginTop: '1rem', fontSize: '0.95rem' }}>Rarity tiers</h3>
        <p className="muted">
          Counts must sum to maxEdition ({colMaxEdition}). Current sum:{' '}
          <strong className={tierSum === colMaxEdition ? '' : 'badge red'}>{tierSum}</strong>
        </p>
        {tiers.map((t, i) => (
          <div className="row" key={t.key + i} style={{ marginBottom: '0.35rem' }}>
            <div>
              <label>Key</label>
              <input value={t.key} onChange={(e) => updateTier(i, { key: e.target.value })} />
            </div>
            <div>
              <label>Name</label>
              <input value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} />
            </div>
            <div>
              <label>Count</label>
              <input
                type="number"
                min={0}
                value={t.count}
                onChange={(e) => updateTier(i, { count: Number(e.target.value) })}
              />
            </div>
          </div>
        ))}
        <button
          className="btn secondary"
          type="button"
          onClick={() =>
            setTiers((prev) => [...prev, { key: `tier${prev.length + 1}`, name: 'New', count: 0 }])
          }
        >
          Add tier
        </button>

        <h3 style={{ marginTop: '1rem', fontSize: '0.95rem' }}>Mint stages</h3>
        <div className="stages">
          {stages.map((s) => (
            <button
              type="button"
              key={s.id}
              className={`stage-chip ${s.id === activeStageId ? 'active' : ''}`}
              onClick={() => setActiveStageId(s.id)}
              style={{ cursor: 'pointer' }}
            >
              {s.name} · {s.kind}
              {s.priceHbar !== undefined ? ` · ${s.priceHbar} ℏ` : ''}
              {s.id === activeStageId ? ' · ACTIVE' : ''}
            </button>
          ))}
        </div>
        {stages.map((s, i) => (
          <div
            key={s.id}
            className="card"
            style={{
              marginTop: '0.75rem',
              background: s.id === activeStageId ? 'var(--accent-soft)' : undefined,
            }}
          >
            <div className="row">
              <div>
                <label>Id</label>
                <input
                  value={s.id}
                  onChange={(e) => {
                    const id = e.target.value;
                    updateStage(i, { id });
                    if (activeStageId === s.id) setActiveStageId(id);
                  }}
                />
                <label>Name</label>
                <input value={s.name} onChange={(e) => updateStage(i, { name: e.target.value })} />
                <label>Kind</label>
                <select
                  value={s.kind}
                  onChange={(e) =>
                    updateStage(i, { kind: e.target.value as CollectionStage['kind'] })
                  }
                >
                  <option value="allowlist">allowlist</option>
                  <option value="public">public</option>
                </select>
              </div>
              <div>
                <label>Price (ℏ)</label>
                <input
                  value={s.priceHbar ?? ''}
                  onChange={(e) => updateStage(i, { priceHbar: e.target.value })}
                />
                <label>Start (ISO)</label>
                <input
                  value={s.start ?? ''}
                  onChange={(e) => updateStage(i, { start: e.target.value || undefined })}
                />
                <label>End (ISO)</label>
                <input
                  value={s.end ?? ''}
                  onChange={(e) => updateStage(i, { end: e.target.value || undefined })}
                />
                {s.kind === 'allowlist' && (
                  <>
                    <label>Snapshot ref</label>
                    <input
                      value={s.snapshotRef ?? ''}
                      onChange={(e) =>
                        updateStage(i, { snapshotRef: e.target.value || undefined })
                      }
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <button
          className="btn secondary"
          type="button"
          onClick={() =>
            setStages((prev) => [...prev, emptyStage(`stage${prev.length + 1}`)])
          }
        >
          Add stage
        </button>

        <h3 style={{ marginTop: '1rem', fontSize: '0.95rem' }}>Dry-run mint gate</h3>
        <p className="muted">
          Active stage (manual selector): <strong>{activeStage?.id ?? '—'}</strong> (
          {activeStage?.kind}). Time is mocked for offline demos.
        </p>
        <div className="row">
          <div>
            <label>Minter account</label>
            <input value={minterAccount} onChange={(e) => setMinterAccount(e.target.value)} />
          </div>
          <div>
            <label>Mock now (ISO)</label>
            <input value={mockNow} onChange={(e) => setMockNow(e.target.value)} />
          </div>
        </div>
        <label>Active stage</label>
        <select value={activeStageId} onChange={(e) => setActiveStageId(e.target.value)}>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.kind})
            </option>
          ))}
        </select>
        <button className="btn" type="button" disabled={gateBusy} onClick={() => void onCheckGate()}>
          Check mint gate
        </button>
        {gateResult && (
          <p style={{ marginTop: '0.75rem' }}>
            <span className={`badge ${gateResult.allowed ? 'green' : 'red'}`}>
              {gateResult.allowed ? 'ALLOW' : 'DENY'}
            </span>{' '}
            {gateResult.reason}
          </p>
        )}
        {fixture && (
          <p className="muted mono" style={{ marginTop: '0.75rem' }}>
            TokenCreate dry-run: {fixture.tokenCreate.name}/{fixture.tokenCreate.symbol} ·
            TokenMint dry-run: {fixture.tokenMint.tokenIdPlaceholder} #
            {fixture.tokenMint.serialPlaceholder}
          </p>
        )}

        <h3 style={{ marginTop: '1rem', fontSize: '0.95rem' }}>Mint plan (dry-run)</h3>
        <p className="muted">
          Ordered Hashinal plan (dry-run): HCS-1 → TokenCreate (FINITE) → TokenMint with metadata =
          UTF-8 HRL. Never signs or submits.
        </p>
        <button
          className="btn"
          type="button"
          disabled={mintPlanBusy}
          onClick={() => void onMintPlan()}
        >
          Mint plan (dry-run)
        </button>
        {mintPlanSummary && (
          <pre
            className="mono"
            style={{
              marginTop: '0.75rem',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              maxHeight: '12rem',
              overflow: 'auto',
            }}
          >
            {mintPlanSummary}
          </pre>
        )}
        {mintPlan && (
          <>
            <p style={{ marginTop: '0.5rem' }}>
              <span className={`badge ${mintPlan.refused ? 'red' : 'green'}`}>
                {mintPlan.refused ? 'REFUSED' : 'PLANNED'}
              </span>{' '}
              hrl={mintPlan.hrl} · mints={mintPlan.mintCount} · maxSupply={mintPlan.maxSupply}
            </p>
            <details style={{ marginTop: '0.5rem' }}>
              <summary className="muted">TokenCreate + first TokenMint JSON</summary>
              <pre
                className="mono"
                style={{ fontSize: '0.7rem', whiteSpace: 'pre-wrap', maxHeight: '16rem', overflow: 'auto' }}
              >
                {JSON.stringify(
                  {
                    tokenCreate: mintPlan.tokenCreate,
                    firstMint: mintPlan.tokenMints[0] ?? null,
                    inscription: mintPlan.inscription,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </>
        )}
      </div>

      <div className="card">
        <h2>NFT metadata (authenticity receipt)</h2>
        <div className="row">
          <div>
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
            <label>Creator</label>
            <input value={creator} onChange={(e) => setCreator(e.target.value)} />
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            {preset !== 'demo' ? (
              
              <img
                className="preview-box"
                src={`/api/art?collection=${preset}&edition=${previewEdition}`}
                alt={`Edition ${previewEdition}`}
                style={{ width: '100%', maxWidth: 280, height: 'auto', objectFit: 'contain' }}
              />
            ) : (
              <div className="preview-box">IMAGE</div>
            )}
            <p className="muted mono" style={{ marginTop: '0.5rem' }}>
              {preset === 'demo'
                ? 'synthetic fixture · contentHash bound in receipt'
                : `${preset} #${previewEdition} · real Vera Labs art`}
            </p>
            <div className="row">
              <div>
                <label>Edition</label>
                <input
                  type="number"
                  value={edition}
                  onChange={(e) => setEdition(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Max supply / edition</label>
                <input
                  type="number"
                  value={maxEdition}
                  onChange={(e) => setMaxEdition(Number(e.target.value))}
                />
              </div>
            </div>
            <label>
              <input
                type="checkbox"
                checked={useAllowlist}
                onChange={(e) => setUseAllowlist(e.target.checked)}
                style={{ width: 'auto', marginRight: '0.4rem' }}
              />
              Require allowlist membership (receipt)
            </label>
          </div>
        </div>
        {fixture && (
          <p className="muted mono" style={{ marginTop: '0.75rem' }}>
            HRL: {fixture.inscription.hrl} · inscription: {fixture.inscription.liveInscription} ·
            chunks: {fixture.inscription.chunks.length}
          </p>
        )}
        <button className="btn" type="button" onClick={() => void onBuild()}>
          Build authenticity receipt
        </button>
        <button className="btn secondary" type="button" onClick={() => void onExportDrop()}>
          Export drop package
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            if (fixture) {
              setName(fixture.metadata.name);
              setDescription(fixture.metadata.description);
              setCreator(fixture.metadata.creator);
              setEdition(fixture.metadata.edition);
              setMaxEdition(fixture.metadata.maxEdition);
              setMinterAccount('0.0.2001');
              setReceipt(fixture.receipt);
            }
          }}
        >
          Reset fixture
        </button>
        {exportStatus && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            {exportStatus}
          </p>
        )}
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Export uses the collection config above (tiers → editions). Sidecars stay beside the
          DreamForge folder. Live mint/inscribe/anchor are CLI-gated (`mint:live --hrl …` for linked Hashinal / `inscribe:live` / `anchor:live`). Canonical testnet demo on `/verify`.
        </p>
      </div>

      {receipt && <ReceiptCard receipt={receipt} />}

      <p className="muted">
        Phase 2: music drops (audio player, ISRC, stems). v0 is general NFT authenticity.
      </p>
    </>
  );
}
