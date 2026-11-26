/**
 * Developer tool: compare Midlander's layout of a .fadein file against the
 * lines of a reference PDF (extracted with tools/extract-pdf-lines.py).
 *
 * Usage: node tools/compare-layout.ts script.fadein reference-lines.json [--verbose]
 *
 * Positions are compared in screenplay units, not points: body line numbers
 * (6 per inch) and character columns (10 per inch) from the left margin, so
 * the font's side bearings don't matter. Exit code 0 = identical.
 */
import { readFileSync } from 'node:fs';
import { readFadeIn } from '../packages/formats/src/index.ts';
import { layoutDocument, type LayoutLine } from '../packages/layout/src/index.ts';

interface PdfLine {
  top: number;
  x0: number;
  x1: number;
  text: string;
  font: string;
}

const [, , fadeinPath, jsonPath, flag] = process.argv;
if (!fadeinPath || !jsonPath) {
  console.error('usage: node tools/compare-layout.ts script.fadein reference-lines.json [--verbose]');
  process.exit(2);
}
const verbose = flag === '--verbose';

const doc = await readFadeIn(new Uint8Array(readFileSync(fadeinPath)));
const layout = layoutDocument(doc);
const ref = JSON.parse(readFileSync(jsonPath, 'utf8')) as { pages: { lines: PdfLine[] }[] };

// Calibrate from the reference itself: the left-most x of body text = column 0,
// and the first body line's top = line 1. Character width/line height from the layout.
const ptPerCol = 72 / layout.cpi;
const ptPerLine = 72 / doc.settings.linesPerInch;
const isNoise = (l: PdfLine) => /demonstration version/i.test(l.text);
const allBody = ref.pages.flatMap((p) => p.lines.filter((l) => !isNoise(l)));
const x0 = Math.min(...allBody.map((l) => l.x0));
// Line 1 = the first line of the first script page (it has no header and can't start with a continued cue).
const firstScriptPage = layout.pages.findIndex((p) => !p.isTitlePage);
const top1 = ref.pages[firstScriptPage].lines.filter((l) => !isNoise(l))[0].top;

type Row = { line: number; col: number; text: string };
const key = (r: Row) => `${r.line.toFixed(1)}|${r.col.toFixed(1)}|${r.text.replace(/\s+/g, ' ').trim()}`;

let pageDiffs = 0;
let lineDiffs = 0;
const n = Math.max(ref.pages.length, layout.pages.length);
for (let i = 0; i < n; i++) {
  const refRows: Row[] = (ref.pages[i]?.lines ?? [])
    .filter((l) => !isNoise(l))
    .map((l) => ({
      line: Math.round(((l.top - top1) / ptPerLine + 1) * 2) / 2,
      col: Math.round(((l.x0 - x0) / ptPerCol) * 2) / 2,
      text: l.text,
    }));
  const ours: Row[] = (layout.pages[i]?.lines ?? [])
    .filter((l: LayoutLine) => l.text.trim() !== '')
    .map((l) => ({ line: l.line, col: Math.round(l.col * 2) / 2, text: l.text }));
  const a = new Set(refRows.map(key));
  const b = new Set(ours.map(key));
  const missing = [...a].filter((k) => !b.has(k));
  const extra = [...b].filter((k) => !a.has(k));
  const label = layout.pages[i]?.isTitlePage ? 'title page' : `page ${layout.pages[i]?.number ?? '?'}`;
  if (missing.length || extra.length) {
    pageDiffs++;
    lineDiffs += Math.max(missing.length, extra.length);
    console.log(`✗ PDF page ${i + 1} (${label}): ${missing.length} reference lines not matched, ${extra.length} Midlander lines not matched`);
    if (verbose) {
      for (const k of missing) console.log(`    Fade In  : ${k}`);
      for (const k of extra) console.log(`    Midlander: ${k}`);
    }
  } else {
    console.log(`✓ PDF page ${i + 1} (${label}): ${refRows.length} lines identical`);
  }
}
console.log(
  pageDiffs === 0
    ? `\nAll ${n} pages match line for line.`
    : `\n${pageDiffs} of ${n} pages differ (${lineDiffs} lines). Run with --verbose for details.`,
);
process.exit(pageDiffs === 0 ? 0 : 1);
