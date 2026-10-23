/**
 * Minimal YAML subset parser for Nodeling collection configs.
 * Supports: comments, flat/nested maps (2-space indent), arrays of
 * inline `{k: v}` maps or nested maps, strings, numbers, booleans, null.
 * Not a full YAML 1.2 implementation — use JSON for complex configs.
 */

export class SimpleYamlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimpleYamlError';
  }
}

type YamlValue = null | boolean | number | string | YamlValue[] | { [k: string]: YamlValue };

function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1);
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  // bareword / unquoted
  return s;
}

/** Parse inline map: {a: 1, b: "x"} */
function parseInlineMap(s: string): Record<string, YamlValue> {
  const inner = s.trim().slice(1, -1).trim();
  const out: Record<string, YamlValue> = {};
  if (!inner) return out;
  // split on commas not inside quotes
  const parts: string[] = [];
  let cur = '';
  let q: '"' | "'" | null = null;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]!;
    if (q) {
      cur += c;
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      cur += c;
      continue;
    }
    if (c === ',') {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx < 0) throw new SimpleYamlError(`bad inline map entry: ${p}`);
    const k = p.slice(0, idx).trim();
    const v = parseScalar(p.slice(idx + 1));
    out[k] = v;
  }
  return out;
}

interface Line {
  indent: number;
  content: string;
  n: number;
}

function stripComment(line: string): string {
  let q: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") {
      q = c;
      continue;
    }
    if (c === '#') return line.slice(0, i).trimEnd();
  }
  return line.trimEnd();
}

/**
 * Parse a YAML subset document into a plain object/array.
 */
export function parseSimpleYaml(text: string): YamlValue {
  const rawLines = text.split(/\r?\n/);
  const lines: Line[] = [];
  for (let i = 0; i < rawLines.length; i++) {
    const stripped = stripComment(rawLines[i] ?? '');
    if (!stripped.trim()) continue;
    const m = /^(\s*)(.*)$/.exec(stripped)!;
    const indent = m[1]!.length;
    if (indent % 2 !== 0) {
      throw new SimpleYamlError(`line ${i + 1}: indent must be multiples of 2`);
    }
    lines.push({ indent, content: m[2]!, n: i + 1 });
  }

  let pos = 0;

  function parseBlock(minIndent: number): YamlValue {
    if (pos >= lines.length) return null;
    const first = lines[pos]!;
    if (first.indent < minIndent) return null;

    if (first.content.startsWith('- ')) {
      return parseArray(minIndent);
    }
    return parseMap(minIndent);
  }

  function parseArray(minIndent: number): YamlValue[] {
    const arr: YamlValue[] = [];
    while (pos < lines.length) {
      const line = lines[pos]!;
      if (line.indent < minIndent) break;
      if (line.indent > minIndent) {
        throw new SimpleYamlError(`line ${line.n}: unexpected indent in array`);
      }
      if (!line.content.startsWith('- ')) {
        throw new SimpleYamlError(`line ${line.n}: expected list item`);
      }
      const rest = line.content.slice(2).trim();
      pos++;
      if (!rest) {
        arr.push(parseBlock(minIndent + 2));
      } else if (rest.startsWith('{') && rest.endsWith('}')) {
        arr.push(parseInlineMap(rest));
      } else if (rest.includes(': ') || rest.endsWith(':')) {
        // inline key on same line as `- key: value` then nested
        const idx = rest.indexOf(':');
        const k = rest.slice(0, idx).trim();
        const vraw = rest.slice(idx + 1).trim();
        const obj: Record<string, YamlValue> = {};
        if (vraw === '') {
          obj[k] = parseBlock(minIndent + 2);
        } else if (vraw.startsWith('{') && vraw.endsWith('}')) {
          obj[k] = parseInlineMap(vraw);
          // also absorb nested keys at indent+2 under this list item
          Object.assign(obj, parseMapContinuation(minIndent + 2));
        } else {
          obj[k] = parseScalar(vraw);
          Object.assign(obj, parseMapContinuation(minIndent + 2));
        }
        arr.push(obj);
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  function parseMapContinuation(minIndent: number): Record<string, YamlValue> {
    // Only consume map keys at exactly minIndent (nested under a list item)
    if (pos >= lines.length) return {};
    const peek = lines[pos]!;
    if (peek.indent < minIndent || peek.content.startsWith('- ')) return {};
    if (peek.indent !== minIndent) return {};
    // reuse parseMap but it advances pos
    return parseMap(minIndent);
  }

  function parseMap(minIndent: number): Record<string, YamlValue> {
    const obj: Record<string, YamlValue> = {};
    while (pos < lines.length) {
      const line = lines[pos]!;
      if (line.indent < minIndent) break;
      if (line.indent > minIndent) {
        throw new SimpleYamlError(`line ${line.n}: unexpected indent in map`);
      }
      if (line.content.startsWith('- ')) break;
      const idx = line.content.indexOf(':');
      if (idx < 0) throw new SimpleYamlError(`line ${line.n}: expected key:`);
      const key = line.content.slice(0, idx).trim();
      const rest = line.content.slice(idx + 1).trim();
      pos++;
      if (rest === '') {
        // nested
        if (pos < lines.length && lines[pos]!.indent >= minIndent + 2) {
          if (lines[pos]!.content.startsWith('- ')) {
            obj[key] = parseArray(minIndent + 2);
          } else {
            obj[key] = parseMap(minIndent + 2);
          }
        } else {
          obj[key] = null;
        }
      } else if (rest.startsWith('{') && rest.endsWith('}')) {
        obj[key] = parseInlineMap(rest);
      } else if (rest.startsWith('[') && rest.endsWith(']')) {
        // simple inline array of scalars
        const inner = rest.slice(1, -1).trim();
        obj[key] = inner
          ? inner.split(',').map((x) => parseScalar(x.trim()))
          : [];
      } else {
        obj[key] = parseScalar(rest);
      }
    }
    return obj;
  }

  // fix unused var — remove saved
  const root = parseBlock(0);
  if (pos < lines.length) {
    throw new SimpleYamlError(`line ${lines[pos]!.n}: trailing content`);
  }
  return root;
}
