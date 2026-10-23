/**
 * HRL (Hedera Resource Locator) helpers for Hashinals.
 * Form: hcs://1/<topicId>  where topicId is 0.0.<num>
 */

const HRL_RE = /^hcs:\/\/1\/(0\.0\.\d+)$/;
const TOPIC_RE = /^0\.0\.\d+$/;

export function isValidTopicId(topicId: string): boolean {
  return TOPIC_RE.test(topicId);
}

export function buildHrl(topicId: string): string {
  if (!isValidTopicId(topicId)) {
    throw new Error(`Invalid topic id for HRL: ${topicId}`);
  }
  return `hcs://1/${topicId}`;
}

export function parseHrl(hrl: string): { protocol: 'hcs'; version: 1; topicId: string } {
  const m = HRL_RE.exec(hrl.trim());
  if (!m) {
    throw new Error(`Invalid HRL (expected hcs://1/0.0.<n>): ${hrl}`);
  }
  return { protocol: 'hcs', version: 1, topicId: m[1] };
}

export function isValidHrl(hrl: string): boolean {
  try {
    parseHrl(hrl);
    return true;
  } catch {
    return false;
  }
}
