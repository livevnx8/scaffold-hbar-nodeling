import Link from 'next/link';

export const metadata = {
  title: 'What is a Nodeling Hashinal? — Nodeling',
  description:
    "Vera Labs' Nodeling Hashinal: HCS-5 NFT with HCS-1 HRL metadata, authenticity receipts, and DreamForge-ready drops.",
};

export default function AboutPage() {
  return (
    <>
      <header className="hero">
        <h1>What is a Nodeling Hashinal?</h1>
        <p className="lede">
          <strong>Hashinal</strong> is the Hedera protocol. <strong>Nodeling</strong> is Vera
          Labs’ authenticity + mint-pad layer on top of it.
        </p>
      </header>

      <div className="card">
        <h2>Protocol Hashinal</h2>
        <ol>
          <li>Inscribe media/metadata as HCS-1 chunks on a Consensus Service topic.</li>
          <li>
            Create an HCS-5 NFT whose metadata bytes are the UTF-8 string{' '}
            <code>hcs://1/&lt;topicId&gt;</code> (the HRL).
          </li>
          <li>Anyone can resolve that HRL to the inscribed content.</li>
        </ol>
        <p className="muted">
          Not a random IPFS URI — the on-chain pointer is a first-class Hedera Resource Locator.
        </p>
      </div>

      <div className="card">
        <h2>Nodeling layer</h2>
        <ul>
          <li>
            <strong>Authenticity receipts</strong> — <code>taskHash</code> /{' '}
            <code>decisionHash</code>; GREEN when clean, RED on tamper / bad edition / forged
            allowlist.
          </li>
          <li>
            <strong>DreamForge drop</strong> — short filenames, contiguous editions; receipts and
            hashes sit <em>beside</em> the folder so SentX upload stays clean.
          </li>
          <li>
            <strong>Stages + allowlists</strong> — whitelist rounds vs public; dry-run mint gate.
          </li>
          <li>
            <strong>Public verify</strong> — paste a receipt or package on{' '}
            <Link href="/verify">/verify</Link>; no trust-me screenshots.
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Mint flow (dry-run default)</h2>
        <p>
          <code>HCS-1</code> → <code>TokenCreate</code> → <code>TokenMint</code> (metadata = UTF-8
          HRL). Live Hedera txs and SentX writes stay opt-in. No keys in the browser.
        </p>
      </div>

      <div className="card">
        <h2>Why it’s cool</h2>
        <ul>
          <li>Prove authenticity offline (GREEN/RED).</li>
          <li>Real Hashinal HRL pattern, not random metadata.</li>
          <li>DreamForge-ready without competing with SentX.</li>
          <li>Stages and allowlists for drop ops.</li>
          <li>
            Forkable Scaffold-HBAR offline demo — <code>npm run demo</code>, no Hedera account.
          </li>
        </ul>
        <p className="muted">
          NFT-first. Music drops are Phase 2. List on SentX DreamForge / HashPack — Nodeling is
          not a marketplace.
        </p>
      </div>

      <div className="card">
        <h2>How others use it</h2>
        <p>
          Three paths — creator / drop ops, collector / partner, builder / agent — plus a day-one
          checklist live on <Link href="/start">/start</Link>. Repo runbook:{' '}
          <code>docs/for-others.md</code>.
        </p>
        <p className="hero-ctas" style={{ marginTop: '0.5rem' }}>
          <Link className="btn" href="/start">
            Getting started
          </Link>
          <Link className="btn secondary" href="/">
            Mint pad
          </Link>
          <Link className="btn secondary" href="/verify">
            Verify
          </Link>
        </p>
      </div>

      <p>
        <Link href="/">← Back to mint pad</Link>
      </p>
    </>
  );
}
