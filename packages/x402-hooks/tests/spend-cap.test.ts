import { checkSpendCap } from '../src/spend-cap.js';

describe('checkSpendCap', () => {
  it('allows mint within cap', () => {
    const d = checkSpendCap(
      { agentId: 'a1', maxSpendTinybar: '1000', spentTinybar: '100', currency: 'HBAR' },
      {
        collectionId: 'tinies',
        edition: 1,
        priceTinybar: '200',
        minterAccount: '0.0.1',
      },
    );
    expect(d.allowed).toBe(true);
    expect(d.remainingTinybar).toBe('700');
  });

  it('rejects over-cap mint', () => {
    const d = checkSpendCap(
      { agentId: 'a1', maxSpendTinybar: '100', spentTinybar: '90', currency: 'HBAR' },
      {
        collectionId: 'tinies',
        edition: 1,
        priceTinybar: '20',
        minterAccount: '0.0.1',
      },
    );
    expect(d.allowed).toBe(false);
  });
});
