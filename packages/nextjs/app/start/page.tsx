import Link from 'next/link';
import { describeNodelingUtilize } from '@nodeling/core';

export const metadata = {
  title: 'Getting started — Nodeling',
  description:
    'How creators, collectors, and builders utilize Nodeling: prove art, stage drop, dry-run HRL mint, list on SentX.',
};

export default function StartPage() {
  const u = describeNodelingUtilize();

  return (
    <>
      <header className="hero">
        <h1>Getting started</h1>
        <p className="lede">{u.story}</p>
        <p>
          Nodeling is Vera Labs’ Hashinal authenticity + mint pad — not a SentX competitor.
          This page is the home funnel for cold visitors (primary CTA from <Link href="/">/</Link>).
          Pick your path below, or jump to the{' '}
          <Link href="/">mint pad</Link>, <Link href="/verify">verify</Link>, or{' '}
          <Link href="/about">about</Link> pages.
        </p>
      </header>

      <div className="card">
        <h2>Day-one checklist</h2>
        <ol className="checklist-ol">
          {u.dayOneChecklist.map((step) => (
            <li key={step}>
              <code className="wrap-code">{step}</code>
            </li>
          ))}
        </ol>
        <p className="muted" style={{ marginTop: '0.75rem' }}>
          Full runbook in the repo: <code>docs/for-others.md</code> · Spec:{' '}
          <code>docs/NODELING-HASHINAL.md</code>
        </p>
      </div>

      {u.paths.map((path) => (
        <div className="card" key={path.id}>
          <h2>
            {path.title}{' '}
            <span className="badge green" style={{ fontWeight: 600 }}>
              {path.id}
            </span>
          </h2>
          <p>{path.oneLiner}</p>
          <ol>
            {path.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p className="muted">
            UI:{' '}
            {path.primaryUi.map((href, i) => (
              <span key={href}>
                {i > 0 ? ' · ' : ''}
                <Link href={href}>{href}</Link>
              </span>
            ))}
          </p>
          {path.cliHints.length > 0 && (
            <ul className="mono muted">
              {path.cliHints.map((c) => (
                <li key={c}>
                  <code>{c}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}

      <div className="card">
        <h2>Canonical testnet demo</h2>
        <p>
          Linked Hashinal already on Hedera testnet (the demo to pitch — not the historical
          empty-topic smoke):
        </p>
        <ul>
          <li>
            NFT{' '}
            <a
              href="https://hashscan.io/testnet/token/0.0.11146645/1"
              target="_blank"
              rel="noreferrer"
            >
              0.0.11146645#1
            </a>
          </li>
          <li>
            Metadata HRL{' '}
            <a
              href="https://hashscan.io/testnet/topic/0.0.11144977"
              target="_blank"
              rel="noreferrer"
            >
              hcs://1/0.0.11144977
            </a>
          </li>
          <li>
            Re-proof: <code>npm run verify:testnet</code> · UI:{' '}
            <Link href="/verify">/verify</Link> → Load canonical HRL
          </li>
        </ul>
        <p className="muted">
          Offline Tinies / Nodlings / Demo presets on the mint pad stay unchanged.
        </p>
      </div>

      <div className="card">
        <h2>Offline-first vs live (opt-in CLI)</h2>
        <div className="row">
          <div>
            <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>Offline / never from UI</h3>
            <ul>
              {u.stubbedVsLive.stubbed.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem' }}>
              Live (proven on testnet, opt-in CLI)
            </h3>
            <ul>
              {u.stubbedVsLive.liveLater.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="hero-ctas">
        <Link className="btn" href="/">
          Open mint pad
        </Link>
        <Link className="btn secondary" href="/verify">
          Verify a package
        </Link>
        <Link className="btn secondary" href="/about">
          What is a Nodeling Hashinal?
        </Link>
      </p>
    </>
  );
}
