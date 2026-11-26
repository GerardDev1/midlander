/**
 * Operations on a paragraph's formatted text runs. Offsets are positions in
 * the paragraph's stored text (all runs joined). Every function returns new
 * arrays; inputs are never changed.
 */
import type { Marks, Run } from '../../core/src/index.ts';

export const MARK_KEYS = ['bold', 'italic', 'underline', 'strike', 'highlight'] as const;
export type MarkKey = (typeof MARK_KEYS)[number];

export function marksOf(r: Marks): Marks {
  const m: Marks = {};
  if (r.bold) m.bold = true;
  if (r.italic) m.italic = true;
  if (r.underline) m.underline = true;
  if (r.strike) m.strike = true;
  if (r.highlight) m.highlight = r.highlight;
  return m;
}

export function sameMarks(a: Marks, b: Marks): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike &&
    (a.highlight ?? '') === (b.highlight ?? '')
  );
}

export const runsText = (runs: Run[]): string => runs.map((r) => r.text).join('');

/** Merges neighbouring runs with the same marks and drops empty runs (keeping one if all are empty). */
export function normalizeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    if (r.text === '') continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last, r)) out[out.length - 1] = { ...marksOf(last), text: last.text + r.text };
    else out.push({ ...marksOf(r), text: r.text });
  }
  if (out.length === 0) return [{ ...marksOf(runs[0] ?? {}), text: '' }];
  return out;
}

export function sliceRuns(runs: Run[], from: number, to: number): Run[] {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    const a = Math.max(from, pos);
    const b = Math.min(to, end);
    if (b > a) out.push({ ...marksOf(r), text: r.text.slice(a - pos, b - pos) });
    pos = end;
  }
  return out;
}

/** Marks that newly typed text at `offset` takes: those of the character before it (or after, at the start). */
export function marksAt(runs: Run[], offset: number): Marks {
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (offset > pos && offset <= end) return marksOf(r);
    pos = end;
  }
  return marksOf(runs.find((r) => r.text !== '') ?? runs[0] ?? {});
}

export function insertRuns(runs: Run[], offset: number, inserted: Run[]): Run[] {
  const len = runsText(runs).length;
  return normalizeRuns([...sliceRuns(runs, 0, offset), ...inserted, ...sliceRuns(runs, offset, len)]);
}

export function insertTextInRuns(runs: Run[], offset: number, text: string, marks?: Marks): Run[] {
  return insertRuns(runs, offset, [{ ...(marks ?? marksAt(runs, offset)), text }]);
}

export function deleteText(runs: Run[], from: number, to: number): Run[] {
  const len = runsText(runs).length;
  const kept = [...sliceRuns(runs, 0, from), ...sliceRuns(runs, to, len)];
  // An emptied paragraph keeps the marks it had, so typing continues in the same style.
  return kept.length ? normalizeRuns(kept) : [{ ...marksAt(runs, from), text: '' }];
}

/** True if every character in [from, to) has the mark. */
export function hasMark(runs: Run[], from: number, to: number, key: MarkKey): boolean {
  const part = sliceRuns(runs, from, to);
  return part.length > 0 && part.every((r) => !!r[key]);
}

export function setMark(runs: Run[], from: number, to: number, key: MarkKey, on: boolean): Run[] {
  const len = runsText(runs).length;
  const mid = sliceRuns(runs, from, to).map((r) => {
    const n: Run = { ...r };
    if (key === 'highlight') {
      if (on) n.highlight = n.highlight ?? '#FFFF00';
      else delete n.highlight;
    } else if (on) n[key] = true;
    else delete n[key];
    return n;
  });
  return normalizeRuns([...sliceRuns(runs, 0, from), ...mid, ...sliceRuns(runs, to, len)]);
}
