// Number guard: every money amount and percentage in the model's prose must appear (allowing rounding and
// fi-FI / en formatting) in some tool result of this turn or in the snapshot.

/** All finite numbers inside a JSON-like value. */
export function collectNumbers(v: unknown, out: number[] = [], depth = 0): number[] {
  if (depth > 12) return out;
  if (typeof v === "number") {
    if (Number.isFinite(v)) out.push(v);
  } else if (Array.isArray(v)) for (const x of v) collectNumbers(x, out, depth + 1);
  else if (v && typeof v === "object") for (const x of Object.values(v)) collectNumbers(x, out, depth + 1);
  else if (typeof v === "string" && v.length < 400) {
    // numbers embedded in server-written strings (basis lines, concept examples, display values)
    for (const m of extractFigures(v)) out.push(m.value);
  }
  return out;
}

export interface Figure {
  raw: string;
  value: number;
  kind: "eur" | "pct";
  decimals: number;
}

const NUM = String.raw`\d{1,3}(?:[   ]\d{3})+(?:[.,]\d{1,2})?|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;
const MONEY_AFTER = new RegExp(String.raw`(?<![\w.,])([-−]?)(${NUM})\s?(?:€|EUR\b|euroa?\b|euros?\b|e\b)`, "gi");
const MONEY_BEFORE = new RegExp(String.raw`(?:€|EUR)\s?([-−]?)(${NUM})(?![\d])`, "gi");
const PERCENT = new RegExp(String.raw`(?<![\w.,])([-−]?)(${NUM})\s?(?:%|percent\b|per cent\b|prosenttia\b|prosentin\b|procent\b)`, "gi");

function parseNum(s: string): { value: number; decimals: number } {
  let t = s.replace(/[   ]/g, "");
  const lastComma = t.lastIndexOf(",");
  const lastDot = t.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    const dec = lastComma > lastDot ? "," : ".";
    const thou = dec === "," ? "." : ",";
    t = t.split(thou).join("").replace(dec, ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const parts = t.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length > 2 || tail.length === 3) t = parts.join(""); // thousands separator
    else t = parts.join(".");
  }
  const dec = t.includes(".") ? t.split(".")[1].length : 0;
  return { value: Number(t), decimals: dec };
}

export function extractFigures(text: string): Figure[] {
  const out: Figure[] = [];
  const seen = new Set<string>();
  const push = (raw: string, sign: string, num: string, kind: Figure["kind"], index: number) => {
    const key = `${kind}:${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const p = parseNum(num);
    if (!Number.isFinite(p.value)) return;
    out.push({ raw: raw.trim(), value: (sign ? -1 : 1) * p.value, kind, decimals: p.decimals });
  };
  for (const m of text.matchAll(MONEY_AFTER)) push(m[0], m[1], m[2], "eur", m.index! + m[0].indexOf(m[2]));
  for (const m of text.matchAll(MONEY_BEFORE)) push(m[0], m[1], m[2], "eur", m.index! + m[0].indexOf(m[2]));
  for (const m of text.matchAll(PERCENT)) push(m[0], m[1], m[2], "pct", m.index! + m[0].indexOf(m[2]));
  return out;
}

/** Check figures in `prose` against the numbers available this turn. Returns the raw strings that do not match. */
export function checkProse(prose: string, sources: unknown[]): { verified: boolean; unverified: string[] } {
  const figs = extractFigures(prose);
  if (!figs.length) return { verified: true, unverified: [] };
  const nums: number[] = [];
  for (const s of sources) collectNumbers(s, nums);
  const abs = nums.map(Math.abs);
  const cands = new Set<number>();
  for (const a of abs) {
    cands.add(a);
    if (a <= 1.5) cands.add(a * 100); // shares 0..1 shown as percentages
  }
  const list = [...cands];
  const unverified: string[] = [];
  for (const f of figs) {
    const x = Math.abs(f.value);
    if (x === 0) continue;
    const tol = f.decimals === 0 ? 0.5 + 1e-6 : f.decimals === 1 ? 0.05 + 1e-6 : 0.006;
    // allow "about 1 300 €" only when the source rounds to it within 0.5% (a rounded mention, not new maths)
    const ok = list.some((v) => Math.abs(v - x) <= tol || (f.decimals === 0 && x >= 100 && x % 10 === 0 && Math.abs(v - x) / x <= 0.005));
    if (!ok) unverified.push(f.raw);
  }
  return { verified: unverified.length === 0, unverified: [...new Set(unverified)] };
}
