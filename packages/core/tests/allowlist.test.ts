import {
  HOLDERS_TINIES_CSV,
  HOLDERS_WOLVES_CSV,
  mergeAllowlists,
  parseHolderCsv,
  verifyAllowlistMembership,
  verifySnapshotIntegrity,
} from '../src/index.js';

describe('allowlist', () => {
  it('merges multi-collection holders and verifies membership', () => {
    const entries = [
      ...parseHolderCsv(HOLDERS_WOLVES_CSV),
      ...parseHolderCsv(HOLDERS_TINIES_CSV),
    ];
    const snap = mergeAllowlists(entries, 100);
    expect(snap.collections).toEqual(['tinies', 'wolves']);
    expect(snap.accounts).toContain('0.0.2001');
    expect(verifySnapshotIntegrity(snap)).toBe(true);
    expect(verifyAllowlistMembership(snap, '0.0.2001')).toBe(true);
    expect(verifyAllowlistMembership(snap, '0.0.9999')).toBe(false);
  });

  it('rejects forged snapshot hash', () => {
    const entries = parseHolderCsv(HOLDERS_TINIES_CSV);
    const snap = mergeAllowlists(entries, 1);
    expect(verifySnapshotIntegrity({ ...snap, snapshotHash: 'c'.repeat(64) })).toBe(false);
  });
});
