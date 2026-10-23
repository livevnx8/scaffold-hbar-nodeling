'use client';

import { useEffect, useState } from 'react';

type Snapshot = {
  accounts: string[];
  collections: string[];
  snapshotHash: string;
  publishedAt: number;
};

export function AllowlistPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [integrity, setIntegrity] = useState<boolean | null>(null);
  const [account, setAccount] = useState('0.0.2001');
  const [member, setMember] = useState<boolean | null>(null);

  async function refresh(acct?: string) {
    const q = acct ? `?account=${encodeURIComponent(acct)}` : '';
    const data = await fetch(`/api/allowlist${q}`).then((r) => r.json());
    setSnapshot(data.snapshot);
    setIntegrity(data.integrity);
    setMember(data.membership ? data.membership.member : null);
  }

  useEffect(() => {
    void refresh(account);
  }, []);

  return (
    <>
      <header className="hero">
        <h1>Multi-collection allowlist</h1>
        <p>
          Offline snapshot of merged holder lists (e.g. wolves + tinies). Check whether an
          account is on the published allowlist before a whitelist mint stage — no chain writes.
        </p>
        <p className="muted">
          Enter a Hedera account id like <code>0.0.2001</code> (fixture member) or{' '}
          <code>0.0.9999</code> (not on list), then <strong>Check membership</strong>.{' '}
          <strong>Integrity OK</strong> = snapshot hash matches; <strong>FAIL</strong> = forged
          or corrupted snapshot. Collector path:{' '}
          <a href="/start">Getting started → Collector / partner</a>.
        </p>
      </header>

      <div className="card">
        <h2>Published snapshot</h2>
        {snapshot ? (
          <>
            <p>
              Collections: <strong>{snapshot.collections.join(', ')}</strong>
            </p>
            <p>
              Accounts: <strong>{snapshot.accounts.length}</strong>
            </p>
            <p className="mono">snapshotHash: {snapshot.snapshotHash}</p>
            <p>
              Integrity:{' '}
              <span className={`badge ${integrity ? 'green' : 'red'}`}>
                {integrity ? 'OK' : 'FAIL'}
              </span>
            </p>
            <ul className="mono muted">
              {snapshot.accounts.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">Loading published snapshot… If this never appears, run <code>npm run demo</code> from the scaffold root (builds fixture holders), then refresh. New here? <a href="/start">/start</a>.</p>
        )}
      </div>

      <div className="card">
        <h2>Membership check</h2>
        <label>Account id</label>
        <input value={account} onChange={(e) => setAccount(e.target.value)} />
        <button className="btn" type="button" onClick={() => void refresh(account)}>
          Check membership
        </button>
        {member === null && snapshot && (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            No check yet — try fixture member <code>0.0.2001</code> (expect ON ALLOWLIST) or{' '}
            <code>0.0.9999</code> (expect NOT ON ALLOWLIST).
          </p>
        )}
        {member !== null && (
          <p style={{ marginTop: '0.75rem' }}>
            {account}{' '}
            <span className={`badge ${member ? 'green' : 'red'}`}>
              {member ? 'ON ALLOWLIST' : 'NOT ON ALLOWLIST'}
            </span>
          </p>
        )}
      </div>
    </>
  );
}
