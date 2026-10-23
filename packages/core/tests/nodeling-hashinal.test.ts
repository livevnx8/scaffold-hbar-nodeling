import {
  NODELING_HASHINAL_LAYERS,
  NODELING_MINT_FLOW_STEPS,
  describeNodelingHashinal,
} from '../src/nodeling-hashinal.js';

describe('nodeling-hashinal', () => {
  it('describeNodelingHashinal returns protocol + Nodeling layers', () => {
    const d = describeNodelingHashinal();
    expect(d.product).toBe('Nodeling');
    expect(d.protocol).toBe('Hashinal');
    expect(d.hrlForm).toBe('hcs://1/<topicId>');
    expect(d.layers).toEqual(NODELING_HASHINAL_LAYERS);
    expect(d.mintFlow).toEqual(NODELING_MINT_FLOW_STEPS);
    expect(d.mintFlow[0]).toBe('inscribe_hcs1');
    expect(d.mintFlow).toContain('token_create');
    expect(d.mintFlow).toContain('token_mint');
    expect(d.defaults.dryRun).toBe(true);
    expect(d.defaults.liveHedera).toBe(false);
    expect(d.defaults.sentxWrites).toBe(false);
    expect(d.phase.nftFirst).toBe(true);
    expect(d.phase.music).toBe('phase_2_deferred');
    expect(d.summary).toMatch(/Hashinal/);
    expect(d.whyCool.length).toBeGreaterThanOrEqual(4);
    expect(d.metadataEncoding).toMatch(/UTF-8/);
  });
});
