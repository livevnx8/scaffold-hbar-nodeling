'use client';

import { useRef, useState } from 'react';
import { ReceiptCard } from './ReceiptCard';
import type { AuthenticityReceipt } from '@nodeling/core';

type EditionRow = {
  edition: number;
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
};

type VerifyResponse = {
  ok: boolean;
  kind: string;
  message?: string;
  result?: {
    ok: boolean;
    checks: Array<{ name: string; ok: boolean; detail: string }>;
    recomputedTaskHash?: string;
    recomputedDecisionHash?: string;
  };
  packageResult?: {
    ok: boolean;
    verdict: 'GREEN' | 'RED';
    editions: EditionRow[];
    checks: Array<{ name: string; ok: boolean; detail: string }>;
  };
  hrl?: { topicId: string };
  fixtureHint?: AuthenticityReceipt;
};

export function VerifyForm() {
  const [text, setText] = useState('');
  const [out, setOut] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadFixtureReceipt() {
    const data = await fetch('/api/fixture').then((r) => r.json());
    setText(JSON.stringify(data.receipt, null, 2));
  }

  async function loadDemoReceiptsPackage() {
    const data = await fetch('/api/drop/export?editions=4&format=json').then((r) => r.json());
    if (data.receipts) {
      setText(JSON.stringify(data.receipts, null, 2));
      return;
    }
    setError('Export did not include receipts — rebuild core');
  }

  function loadCanonicalTestnetHrl() {
    setError(null);
    setOut(null);
    setText('hcs://1/0.0.11144977');
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? '');
      setText(raw);
      setError(null);
    };
    reader.onerror = () => setError('Could not read file');
    reader.readAsText(file);
  }

  async function onVerify() {
    setError(null);
    setOut(null);
    const trimmed = text.trim();
    let body: Record<string, unknown>;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        if (
          parsed &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { editions?: unknown }).editions) &&
          'collectionId' in (parsed as object)
        ) {
          body = { receiptsPackage: parsed };
        } else {
          body = { receipt: parsed };
        }
      } catch {
        setError('Could not parse JSON');
        return;
      }
    } else {
      body = { hrl: trimmed };
    }
    const res = await fetch('/api/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as VerifyResponse;
    setOut(json);
  }

  return (
    <>
      <header className="hero">
        <h1>Public verify</h1>
        <p>
          Paste what the drop operator gave you — usually the{' '}
          <code>*-nodeling-receipts.json</code> sidecar that sits <em>beside</em> the DreamForge
          folder (not inside the SentX upload zip). You can also paste a single authenticity
          receipt JSON or an HRL like <code>hcs://1/0.0.x</code>.
        </p>
        <p className="muted">
          <strong>GREEN</strong> = hashes + editions match (package is clean).{' '}
          <strong>RED</strong> = tampered file, wrong edition, or forged allowlist. Collector
          path: <a href="/start">Getting started → Collector / partner</a>.
        </p>
      </header>

      <div className="card">
        <h2>Canonical testnet demo (linked Hashinal)</h2>
        <p className="muted">
          Already minted on Hedera testnet — NFT{' '}
          <a
            href="https://hashscan.io/testnet/token/0.0.11146645/1"
            target="_blank"
            rel="noreferrer"
          >
            0.0.11146645#1
          </a>{' '}
          metadata HRL →{' '}
          <a
            href="https://hashscan.io/testnet/topic/0.0.11144977"
            target="_blank"
            rel="noreferrer"
          >
            hcs://1/0.0.11144977
          </a>
          . Offline Tinies / Nodlings / Demo fixtures below are unchanged.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button className="btn secondary" type="button" onClick={loadCanonicalTestnetHrl}>
            Load canonical HRL
          </button>
          <a
            className="btn secondary"
            href="https://hashscan.io/testnet/token/0.0.11146645"
            target="_blank"
            rel="noreferrer"
          >
            HashScan token
          </a>
          <a
            className="btn secondary"
            href="https://hashscan.io/testnet/topic/0.0.11144977"
            target="_blank"
            rel="noreferrer"
          >
            HashScan topic
          </a>
        </div>
      </div>

      <div className="card">
        <label>Receipt JSON / receipts package / HRL</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='{"version":"1.0","editions":[...]} or single receipt or hcs://1/0.0.x'
        />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button className="btn" type="button" onClick={() => void onVerify()}>
            Verify
          </button>
          <button className="btn secondary" type="button" onClick={() => void loadFixtureReceipt()}>
            Load fixture receipt
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => void loadDemoReceiptsPackage()}
          >
            Load demo receipts package
          </button>
          <button className="btn secondary" type="button" onClick={loadCanonicalTestnetHrl}>
            Load canonical HRL
          </button>
          <button
            className="btn secondary"
            type="button"
            onClick={() => fileRef.current?.click()}
          >
            Upload JSON…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {!text.trim() && !out && !error && (
        <div className="card">
          <h2>Nothing pasted yet</h2>
          <p className="muted">
            <strong>What to paste:</strong> the full contents of{' '}
            <code>*-nodeling-receipts.json</code> (or use <em>Upload JSON…</em> /{' '}
            <em>Load demo receipts package</em> to try a fixture). Click <strong>Verify</strong>.
          </p>
          <p className="muted">
            <strong>GREEN</strong> means every edition recomputes cleanly.{' '}
            <strong>RED</strong> means something was altered — do not trust the package.
            Walkthrough: <a href="/start">/start (collector path)</a>.
          </p>
        </div>
      )}

      {error && (
        <div className="card">
          <span className="badge red">ERROR</span> {error}
        </div>
      )}

      {out && (
        <div className="card">
          <h2>
            Result{' '}
            <span className={`badge ${out.ok ? 'green' : 'red'}`}>{out.ok ? 'OK' : 'FAIL'}</span>
          </h2>
          <p className="muted">kind: {out.kind}</p>
          {out.message && <p>{out.message}</p>}
          {out.hrl && <p className="mono">topicId: {out.hrl.topicId}</p>}

          {out.packageResult && (
            <div>
              <p>
                Package{' '}
                <span className={`badge ${out.packageResult.ok ? 'green' : 'red'}`}>
                  {out.packageResult.verdict}
                </span>
              </p>
              {out.packageResult.checks.map((c) => (
                <div className="check" key={`pkg-${c.name}`}>
                  <span className={`badge ${c.ok ? 'green' : 'red'}`}>
                    {c.ok ? 'PASS' : 'FAIL'}
                  </span>
                  <span>
                    <strong>{c.name}</strong> — {c.detail}
                  </span>
                </div>
              ))}
              <h3 style={{ marginTop: '1rem' }}>Per edition</h3>
              {out.packageResult.editions.map((e) => (
                <div key={e.edition} style={{ marginBottom: '0.75rem' }}>
                  <div className="check">
                    <span className={`badge ${e.ok ? 'green' : 'red'}`}>
                      {e.ok ? 'PASS' : 'FAIL'}
                    </span>
                    <span>
                      <strong>edition #{e.edition}</strong>
                    </span>
                  </div>
                  {e.checks
                    .filter((c) => !c.ok)
                    .map((c) => (
                      <div className="check" key={`${e.edition}-${c.name}`}>
                        <span className="badge red">FAIL</span>
                        <span className="muted">
                          {c.name}: {c.detail}
                        </span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          )}

          {out.result && (
            <div>
              {out.result.checks.map((c) => (
                <div className="check" key={c.name}>
                  <span className={`badge ${c.ok ? 'green' : 'red'}`}>
                    {c.ok ? 'PASS' : 'FAIL'}
                  </span>
                  <span>
                    <strong>{c.name}</strong> — {c.detail}
                  </span>
                </div>
              ))}
              {out.result.recomputedTaskHash && (
                <p className="mono">recomputed taskHash: {out.result.recomputedTaskHash}</p>
              )}
              {out.result.recomputedDecisionHash && (
                <p className="mono">
                  recomputed decisionHash: {out.result.recomputedDecisionHash}
                </p>
              )}
            </div>
          )}
          {out.fixtureHint && <ReceiptCard receipt={out.fixtureHint} />}
        </div>
      )}
    </>
  );
}
