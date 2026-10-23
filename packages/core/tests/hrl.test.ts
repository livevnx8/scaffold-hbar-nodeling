import { buildHrl, isValidHrl, parseHrl } from '../src/hrl.js';

describe('hrl', () => {
  it('builds and parses hcs://1/<topic>', () => {
    const hrl = buildHrl('0.0.900001');
    expect(hrl).toBe('hcs://1/0.0.900001');
    expect(parseHrl(hrl)).toEqual({ protocol: 'hcs', version: 1, topicId: '0.0.900001' });
    expect(isValidHrl(hrl)).toBe(true);
  });

  it('rejects bad HRLs', () => {
    expect(isValidHrl('https://example.com')).toBe(false);
    expect(isValidHrl('hcs://2/0.0.1')).toBe(false);
    expect(() => buildHrl('not-a-topic')).toThrow(/Invalid topic/);
  });
});
