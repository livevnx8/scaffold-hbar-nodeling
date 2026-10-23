import {
  buildHashinalMetadata,
  canonicalize,
  metadataHashFor,
} from '../src/index.js';

describe('metadata', () => {
  it('canonical hash is stable under key insertion order', () => {
    const a = buildHashinalMetadata({
      name: 'A',
      description: 'd',
      creator: 'c',
      image: 'fixture://x',
      contentHash: 'a'.repeat(64),
      hrl: 'hcs://1/0.0.1',
      edition: 1,
      maxEdition: 10,
    });
    const b = { ...a };
    expect(metadataHashFor(a)).toBe(metadataHashFor(b));
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it('rejects out-of-range edition', () => {
    expect(() =>
      buildHashinalMetadata({
        name: 'A',
        description: 'd',
        creator: 'c',
        image: 'fixture://x',
        contentHash: 'a'.repeat(64),
        hrl: 'hcs://1/0.0.1',
        edition: 11,
        maxEdition: 10,
      }),
    ).toThrow(/out of range/);
  });
});
