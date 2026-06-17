/**
 * Tiny classname helper. Accepts strings / arrays / objects / falsy values.
 * No dependencies; predictable output.
 */
type Token = string | number | false | null | undefined | Token[] | { [k: string]: unknown };

export function cn(...tokens: Token[]): string {
  const out: string[] = [];
  const walk = (t: Token) => {
    if (!t && t !== 0) return;
    if (typeof t === 'string' || typeof t === 'number') { out.push(String(t)); return; }
    if (Array.isArray(t)) { t.forEach(walk); return; }
    if (typeof t === 'object') {
      for (const k in t) if (t[k]) out.push(k);
    }
  };
  tokens.forEach(walk);
  return out.join(' ');
}
