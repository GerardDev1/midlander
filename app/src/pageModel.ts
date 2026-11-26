/**
 * Turns a ScreenplayDocument into what the page view draws: pages of lines
 * with positions in inches. All positions come from Midlander's own layout
 * engine (packages/layout); the webview only places text where it is told.
 *
 * It also answers the editor's geometry questions (where the caret goes,
 * which paragraph a click lands in, what's on the line above) from the same
 * layout. Because screenplay fonts are monospaced, a character's position is
 * just its column, so the browser never measures text.
 *
 * Kept free of React and Tauri so it can be tested with `node --test`.
 */
import { sceneIndex, styleSheetFor, type Block, type Marks, type ResolvedStyle, type ScreenplayDocument } from '../../packages/core/src/index.ts';
import { displayMap, layoutDocument, type DisplayMap, type LayoutLine } from '../../packages/layout/src/index.ts';
import type { Pos, Selection } from '../../packages/editor/src/index.ts';

/** A stretch of a line with one set of inline marks. */
export interface Segment extends Marks {
  text: string;
}

export interface RenderLine {
  /** Distance from the top of the page, in inches (top of the line box). */
  top: number;
  /** Distance from the left edge of the page, in inches. */
  left: number;
  text: string;
  /** The line's text split by inline formatting (bold words etc.). */
  segments: Segment[];
  bold: boolean;
  italic: boolean;
  underline: boolean;
  font: string;
  /** Point size. */
  size: number;
}

export interface RenderPage {
  label: string;
  isTitlePage: boolean;
  lines: RenderLine[];
}

/** A line of script text the caret can be on. */
export interface EditLine {
  page: number;
  /** Body line number (1 = first line under the top margin). */
  line: number;
  /** Column of the line's first character, from the left margin. */
  col: number;
  blockIndex: number;
  /** Range of the paragraph's printed text shown on this line. */
  start: number;
  end: number;
}

export interface RenderModel {
  widthIn: number;
  heightIn: number;
  pages: RenderPage[];
  /** Pages excluding the title page. */
  scriptPageCount: number;
  sceneCount: number;
  /** Every editable line, in reading order. */
  editLines: EditLine[];
  /** For each paragraph, the indexes of its lines in `editLines`. */
  linesOfBlock: number[][];
  maps: DisplayMap[];
  marginTop: number;
  marginLeft: number;
  lineHeight: number;
  cpi: number;
}

/** Inline marks across a paragraph's printed text. */
function markSpans(b: Block, map: DisplayMap): { from: number; to: number; marks: Marks }[] {
  const out: { from: number; to: number; marks: Marks }[] = [];
  let at = 0;
  for (const r of b.runs) {
    const end = at + r.text.length;
    const marks: Marks = {};
    if (r.bold) marks.bold = true;
    if (r.italic) marks.italic = true;
    if (r.underline) marks.underline = true;
    if (r.strike) marks.strike = true;
    if (r.highlight) marks.highlight = r.highlight;
    if (Object.keys(marks).length && end > at) out.push({ from: map.toDisplay(at), to: map.toDisplay(end), marks });
    at = end;
  }
  return out;
}

function segmentsFor(text: string, start: number, spans: { from: number; to: number; marks: Marks }[]): Segment[] {
  if (!spans.length) return [{ text }];
  const end = start + text.length;
  const cuts = new Set([start, end]);
  for (const s of spans) {
    if (s.from > start && s.from < end) cuts.add(s.from);
    if (s.to > start && s.to < end) cuts.add(s.to);
  }
  const pts = [...cuts].sort((a, z) => a - z);
  const out: Segment[] = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const z = pts[k + 1];
    const marks = spans.find((s) => s.from <= a && s.to >= z)?.marks ?? {};
    out.push({ ...marks, text: text.slice(a - start, z - start) });
  }
  return out;
}

type Spans = { from: number; to: number; marks: Marks }[];
/** Per-paragraph results kept until the paragraph changes (paragraphs are never changed in place). */
const blockCache = new WeakMap<Block, { style: ResolvedStyle; map: DisplayMap; spans: Spans }>();

function blockInfo(b: Block, style: ResolvedStyle) {
  const hit = blockCache.get(b);
  if (hit && hit.style === style) return hit;
  const map = displayMap(b, style);
  const info = { style, map, spans: markSpans(b, map) };
  blockCache.set(b, info);
  return info;
}

const sameSegments = (a: Segment[], b: Segment[]) =>
  a.length === b.length &&
  a.every((x, i) => {
    const y = b[i];
    return x.text === y.text && !!x.bold === !!y.bold && !!x.italic === !!y.italic && !!x.underline === !!y.underline && !!x.strike === !!y.strike && x.highlight === y.highlight;
  });

function samePage(a: RenderPage, b: RenderPage): boolean {
  if (a.label !== b.label || a.isTitlePage !== b.isTitlePage || a.lines.length !== b.lines.length) return false;
  for (let i = 0; i < a.lines.length; i++) {
    const x = a.lines[i];
    const y = b.lines[i];
    if (x.text !== y.text || x.top !== y.top || x.left !== y.left || x.bold !== y.bold || x.italic !== y.italic || x.underline !== y.underline || x.font !== y.font || x.size !== y.size || !sameSegments(x.segments, y.segments)) return false;
  }
  return true;
}

/**
 * Lays out the document. Pages that come out exactly as in `previous` keep
 * their old objects, so the page view only redraws pages that changed.
 */
export function buildRenderModel(doc: ScreenplayDocument, previous?: RenderModel | null): RenderModel {
  const model = buildFresh(doc);
  if (previous) {
    model.pages = model.pages.map((p, i) => (previous.pages[i] && samePage(previous.pages[i], p) ? previous.pages[i] : p));
  }
  return model;
}

function buildFresh(doc: ScreenplayDocument): RenderModel {
  const s = doc.settings;
  const layout = layoutDocument(doc);
  const sheet = styleSheetFor(doc.styles);
  const lineHeight = 1 / s.linesPerInch;
  const infos = doc.blocks.map((b) => blockInfo(b, sheet.forBlock(b)));
  const maps = infos.map((x) => x.map);
  const spans = infos.map((x) => x.spans);
  const editLines: EditLine[] = [];
  const linesOfBlock: number[][] = doc.blocks.map(() => []);

  const placeLine = (l: LayoutLine): RenderLine => {
    // Header/footer and continuation lines are plain body text; everything
    // else uses the element style it was laid out with.
    const style = l.style && l.kind === 'text' ? sheet.resolve(l.style) : sheet.resolve('Normal Text');
    const own = l.kind === 'text' && l.blockIndex !== undefined && l.blockIndex >= 0 ? spans[l.blockIndex] : [];
    return {
      top: s.marginTop + (l.line - 1) * lineHeight,
      left: s.marginLeft + l.col / layout.cpi,
      text: l.text,
      segments: segmentsFor(l.text, l.start ?? 0, own),
      bold: style.bold,
      italic: style.italic,
      underline: style.underline,
      font: style.font,
      size: style.size,
    };
  };

  const pages = layout.pages.map((p, i): RenderPage => {
    for (const l of p.lines) {
      if (l.kind === 'text' && l.blockIndex !== undefined && l.blockIndex >= 0) {
        linesOfBlock[l.blockIndex].push(editLines.length);
        editLines.push({ page: i, line: l.line, col: l.col, blockIndex: l.blockIndex, start: l.start ?? 0, end: l.end ?? 0 });
      }
    }
    return {
      label: p.isTitlePage ? 'Title page' : `Page ${p.number ?? i + 1}`,
      isTitlePage: p.isTitlePage,
      lines: p.lines.filter((l) => l.text !== '').map(placeLine),
    };
  });

  return {
    widthIn: s.pageWidth,
    heightIn: s.pageHeight,
    pages,
    scriptPageCount: pages.filter((p) => !p.isTitlePage).length,
    sceneCount: sceneIndex(doc).length,
    editLines,
    linesOfBlock,
    maps,
    marginTop: s.marginTop,
    marginLeft: s.marginLeft,
    lineHeight,
    cpi: layout.cpi,
  };
}

// ---------------------------------------------------------------------------
// Editor geometry

export interface CaretPlace {
  /** Index into editLines. */
  lineIndex: number;
  page: number;
  /** Column from the left margin. */
  col: number;
  /** Position on the page, in inches. */
  top: number;
  left: number;
}

/** Which of a paragraph's lines holds a printed-text offset. */
function lineFor(m: RenderModel, block: number, d: number): number {
  const idx = m.linesOfBlock[block] ?? [];
  let best = idx[0];
  for (const k of idx) if (m.editLines[k].start <= d) best = k;
  return best;
}

export function caretPlace(m: RenderModel, doc: ScreenplayDocument, p: Pos): CaretPlace | null {
  const map = m.maps[p.block];
  if (!map) return null;
  const d = map.toDisplay(p.offset);
  const k = lineFor(m, p.block, d);
  if (k === undefined) return null;
  const l = m.editLines[k];
  let col = l.col + (d - l.start);
  // An empty parenthetical shows "()" with the caret between the brackets.
  if (doc.blocks[p.block].style === 'Parenthetical' && map.text === '') col += 1;
  return {
    lineIndex: k,
    page: l.page,
    col,
    top: m.marginTop + (l.line - 1) * m.lineHeight,
    left: m.marginLeft + col / m.cpi,
  };
}

function posOnLine(m: RenderModel, k: number, col: number): Pos {
  const l = m.editLines[k];
  const d = l.start + Math.max(0, Math.min(l.end - l.start, Math.round(col - l.col)));
  return { block: l.blockIndex, offset: m.maps[l.blockIndex].toStored(d) };
}

/** The text position under a point on a page (inches from the page's top-left corner). */
export function hitTest(m: RenderModel, page: number, xIn: number, yIn: number): Pos | null {
  const lineNo = Math.floor((yIn - m.marginTop) / m.lineHeight) + 1;
  let best = -1;
  let bestDist = Infinity;
  m.editLines.forEach((l, k) => {
    if (l.page !== page) return;
    // Prefer the line itself, then the nearest line (the one above on a tie).
    const dist = Math.abs(l.line - lineNo) * 2 + (l.line > lineNo ? 1 : 0);
    if (dist < bestDist) {
      bestDist = dist;
      best = k;
    }
  });
  if (best < 0) {
    // Title page or an empty page: go to the nearest script line.
    const after = m.editLines.findIndex((l) => l.page > page);
    best = after >= 0 ? after : m.editLines.length - 1;
    if (best < 0) return null;
    return posOnLine(m, best, after >= 0 ? -1 : Infinity);
  }
  return posOnLine(m, best, (xIn - m.marginLeft) * m.cpi);
}

/** Up/Down: the position on the line above or below, at the remembered column. */
export function verticalMove(m: RenderModel, doc: ScreenplayDocument, p: Pos, dir: 1 | -1, goalCol: number | null): { pos: Pos; goalCol: number } | null {
  const c = caretPlace(m, doc, p);
  if (!c) return null;
  const col = goalCol ?? c.col;
  const k = c.lineIndex + dir;
  if (k < 0) return { pos: { block: 0, offset: 0 }, goalCol: col };
  if (k >= m.editLines.length) {
    const last = doc.blocks.length - 1;
    return { pos: { block: last, offset: m.maps[last].toStored(Infinity) }, goalCol: col };
  }
  return { pos: posOnLine(m, k, col), goalCol: col };
}

/** Cmd+Left / Cmd+Right: start or end of the line the caret is on. */
export function lineEdge(m: RenderModel, doc: ScreenplayDocument, p: Pos, dir: 1 | -1): Pos {
  const c = caretPlace(m, doc, p);
  if (!c) return p;
  const l = m.editLines[c.lineIndex];
  const d = dir < 0 ? l.start : l.end;
  return { block: l.blockIndex, offset: m.maps[l.blockIndex].toStored(d) };
}

export interface SelectionRect {
  page: number;
  top: number;
  left: number;
  width: number;
}

/** Highlight rectangles (inches) for a selection, one per line it touches. */
export function selectionRects(m: RenderModel, sel: Selection): SelectionRect[] {
  const [a, z] =
    sel.anchor.block < sel.head.block || (sel.anchor.block === sel.head.block && sel.anchor.offset <= sel.head.offset)
      ? [sel.anchor, sel.head]
      : [sel.head, sel.anchor];
  if (a.block === z.block && a.offset === z.offset) return [];
  const out: SelectionRect[] = [];
  const colW = 1 / m.cpi;
  for (let b = a.block; b <= z.block; b++) {
    const map = m.maps[b];
    if (!map) continue;
    const from = b === a.block ? map.toDisplay(a.offset) : 0;
    const to = b === z.block ? map.toDisplay(z.offset) : map.text.length;
    for (const k of m.linesOfBlock[b] ?? []) {
      const l = m.editLines[k];
      const s = Math.max(from, l.start);
      const e = Math.min(to, l.end);
      const continues = b < z.block || to > l.end;
      if (e < s || (e === s && !continues)) continue;
      // Show the line break as a little extra width when the selection runs on.
      const width = (e - s) * colW + (continues && e >= l.end ? colW / 2 : 0);
      out.push({ page: l.page, top: m.marginTop + (l.line - 1) * m.lineHeight, left: m.marginLeft + (l.col + s - l.start) * colW, width });
    }
  }
  return out;
}

/** The page (index into pages) the caret is on, for the status bar. */
export function pageOf(m: RenderModel, doc: ScreenplayDocument, p: Pos): number {
  return caretPlace(m, doc, p)?.page ?? 0;
}

/** Zoom steps offered by View > Zoom In / Zoom Out. */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + 1e-9) ?? current;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? current;
}
