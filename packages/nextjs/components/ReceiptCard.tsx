'use client';

import type { AuthenticityReceipt } from '@nodeling/core';

export function ReceiptCard({ receipt }: { receipt: AuthenticityReceipt }) {
  const ok = receipt.verdict === 'verified';
  return (
    <div className="card">
      <h2>
        Receipt{' '}
        <span className={`badge ${ok ? 'green' : 'red'}`}>{receipt.verdict.toUpperCase()}</span>
      </h2>
      <p className="muted mono">claimId: {receipt.claimId}</p>
      <p className="mono">taskHash: {receipt.taskHash}</p>
      <p className="mono">decisionHash: {receipt.decisionHash}</p>
      <div style={{ marginTop: '0.75rem' }}>
        {receipt.checks.map((c) => (
          <div className="check" key={c.name}>
            <span className={`badge ${c.ok ? 'green' : 'red'}`}>{c.ok ? 'PASS' : 'FAIL'}</span>
            <span>
              <strong>{c.name}</strong> — {c.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
