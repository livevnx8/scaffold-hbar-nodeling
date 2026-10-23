import {
  NODELING_UTILIZE_AUDIENCES,
  describeNodelingUtilize,
} from '../src/utilize.js';

describe('utilize', () => {
  it('describeNodelingUtilize exposes three audience paths + day-one checklist', () => {
    const u = describeNodelingUtilize();
    expect(u.paths.map((p) => p.id)).toEqual([...NODELING_UTILIZE_AUDIENCES]);
    expect(u.story).toMatch(/SentX/);
    expect(u.dayOneChecklist.length).toBeGreaterThanOrEqual(5);
    expect(u.dayOneChecklist.length).toBeLessThanOrEqual(8);
    for (const path of u.paths) {
      expect(path.steps.length).toBeGreaterThanOrEqual(4);
      expect(path.oneLiner.length).toBeGreaterThan(20);
    }
    expect(u.stubbedVsLive.stubbed).toContain('SentX write APIs (never called)');
    expect(u.docLinks.some((d) => d.path.includes('for-others'))).toBe(true);
  });
});
