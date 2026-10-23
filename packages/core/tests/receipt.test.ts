import {
  FIXTURE_IMAGE_HASH,
  buildAuthenticityReceipt,
  fixtureAllowlistSnapshot,
  fixtureClaim,
  sha256,
  verifyAllowlistMembership,
  verifyAuthenticityReceipt,
} from '../src/index.js';

describe('authenticity receipt', () => {
  const snapshot = fixtureAllowlistSnapshot();
  const claim = fixtureClaim();

  it('GREEN: fixture claim verifies and re-verifies', () => {
    const receipt = buildAuthenticityReceipt({
      claim,
      observedContentHash: FIXTURE_IMAGE_HASH,
      allowlistMember: verifyAllowlistMembership(snapshot, claim.minterAccount!),
      timestamp: 42,
    });
    expect(receipt.verdict).toBe('verified');
    expect(receipt.checks.every((c) => c.ok)).toBe(true);
    const v = verifyAuthenticityReceipt(receipt);
    expect(v.ok).toBe(true);
    expect(v.recomputedTaskHash).toBe(receipt.taskHash);
    expect(v.recomputedDecisionHash).toBe(receipt.decisionHash);
  });

  it('RED: tampered file', () => {
    const receipt = buildAuthenticityReceipt({
      claim: { ...claim, claimId: 't' },
      observedContentHash: sha256(Buffer.from('x')),
      allowlistMember: true,
      timestamp: 1,
    });
    expect(receipt.verdict).toBe('rejected');
    expect(receipt.checks.find((c) => c.name === 'content_hash')?.ok).toBe(false);
  });

  it('RED: wrong edition', () => {
    const receipt = buildAuthenticityReceipt({
      claim: { ...claim, edition: 0 },
      observedContentHash: FIXTURE_IMAGE_HASH,
      allowlistMember: true,
      timestamp: 1,
    });
    expect(receipt.verdict).toBe('rejected');
  });

  it('detects forged decisionHash', () => {
    const receipt = buildAuthenticityReceipt({
      claim,
      observedContentHash: FIXTURE_IMAGE_HASH,
      allowlistMember: true,
      timestamp: 1,
    });
    const forged = { ...receipt, decisionHash: 'b'.repeat(64) };
    expect(verifyAuthenticityReceipt(forged).ok).toBe(false);
  });
});
