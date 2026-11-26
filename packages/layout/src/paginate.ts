/**
 * Pagination engine: turns a ScreenplayDocument into pages of positioned lines.
 *
 * Screenplay fonts are monospaced (10 characters per inch at 12 pt, 6 lines
 * per inch), so all layout is done in character columns and line numbers.
 * Nothing here depends on a browser or the OS. The editor, PDF and print use
 * the same output, so they always agree.
 *
 * Behaviour follows measurements of Fade In 4.1.1 output; see
 * docs/FADE-IN-REFERENCE.md §2.0a. Rules not yet confirmed by a sample are
 * marked ASSUMPTION and are configurable through LayoutOptions.
 */
import {
  StyleSheet,
  blockText,
  styleSheetFor,
  characterBaseName,
  type Block,
  type ResolvedStyle,
  type ScreenplayDocument,
} from '../../core/src/index.ts';
import { sentenceBreaks, wrap, type LineRange } from './wrap.ts';

export interface LayoutOptions {
  /** ASSUMPTION: minimum lines of a split paragraph left on the first page. */
  minLinesBeforeBreak: number;
  /** ASSUMPTION: minimum lines of a split paragraph carried to the next page. */
  minLinesAfterBreak: number;
  /** Header line position relative to body line 1 (measured: 3.5 lines above line 1). */
  headerLine: number;
  /**
   * Measured: whole paragraphs may use every body line (54 of 54), but when a
   * paragraph is split across pages its first part ends one line higher. For
   * dialogue that last line holds (MORE); for action it stays empty.
   */
  splitLeavesLastLine: boolean;
}

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  minLinesBeforeBreak: 2,
  minLinesAfterBreak: 2,
  headerLine: -2.5,
  splitLeavesLastLine: true,
};

export type LineKind = 'text' | 'more' | 'continued-cue' | 'header' | 'footer';

export interface LayoutLine {
  /** 1-based body line; 0 = the line above line 1 (continued cue); negative = header area. */
  line: number;
  /** Column from the left page margin, in characters (may be fractional when centred). */
  col: number;
  text: string;
  kind: LineKind;
  /** Element style name, for rendering (bold, underline, …). */
  style?: string;
  /** Source block, and the range of its display text shown on this line. */
  blockIndex?: number;
  start?: number;
  end?: number;
  titlePage?: boolean;
}

export interface LayoutPage {
  /** Printed page number ("1", "2", …) or null for the title page. */
  number: string | null;
  isTitlePage: boolean;
  lines: LayoutLine[];
}

export interface Layout {
  pages: LayoutPage[];
  linesPerPage: number;
  /** Characters per inch for the body font. */
  cpi: number;
}

// ---------------------------------------------------------------------------

interface Geometry {
  cpi: number;
  linesPerPage: number;
  textWidthIn: number;
}

interface Piece {
  blockIndex: number;
  style: ResolvedStyle;
  /** Full display text of the block (caps applied, brackets added, (cont'd) appended). */
  display: string;
  from: number;
  to: number;
  lines: LineRange[];
  indentCols: number;
  widthCols: number;
}

interface Unit {
  kind: 'block' | 'dialogue';
  pieces: Piece[];
  spaceBefore: number;
  keepWithNext: boolean;
  pageBreakBefore: boolean;
  /** Dialogue: the cue as printed, used for the continued cue on the next page. */
  cue?: string;
  cueCol?: number;
}

const DIALOGUE_PARTS = new Set(['Parenthetical', 'Dialogue']);

export function layoutDocument(doc: ScreenplayDocument, opts: Partial<LayoutOptions> = {}): Layout {
  const o = { ...DEFAULT_LAYOUT_OPTIONS, ...opts };
  const sheet = styleSheetFor(doc.styles);
  const s = doc.settings;
  const size = sheet.resolve('Normal Text').size || 12;
  const g: Geometry = {
    cpi: 120 / size,
    linesPerPage: Math.floor((s.pageHeight - s.marginTop - s.marginBottom) * s.linesPerInch + 1e-6),
    textWidthIn: s.pageWidth - s.marginLeft - s.marginRight,
  };
  const pages: LayoutPage[] = [];

  if (doc.titlePage.some((b) => blockText(b).trim() !== '')) {
    pages.push(layoutTitlePage(doc, sheet, g));
  }

  const units = buildUnits(doc, sheet, g);
  const body = paginate(units, doc, g, o);
  let n = doc.settings.pageNumberStart;
  for (const p of body) {
    const pg: LayoutPage = { number: String(n), isTitlePage: false, lines: p };
    const first = n === doc.settings.pageNumberStart;
    if (s.pageHeader && (!first || s.headerFirstPage)) {
      const text = formatHeader(s.pageHeader, n);
      pg.lines.unshift({ line: o.headerLine, col: alignCol(text.length, 0, Math.floor(g.textWidthIn * g.cpi + 1e-6), s.headerAlign), text, kind: 'header' });
    }
    pages.push(pg);
    n++;
  }
  return { pages, linesPerPage: g.linesPerPage, cpi: g.cpi };
}

function formatHeader(template: string, page: number): string {
  // Full token language (§R2.2) comes later; "#" (page number) and "\#" for now.
  return template.replace(/\\#|#/g, (m) => (m === '\\#' ? '#' : String(page)));
}

function alignCol(len: number, indentCols: number, widthCols: number, align: string): number {
  if (align === 'right') return indentCols + widthCols - len;
  if (align === 'center') return indentCols + (widthCols - len) / 2;
  return indentCols;
}

function geometryFor(style: ResolvedStyle, g: Geometry) {
  const indentCols = Math.round(style.leftIndent * g.cpi * 100) / 100;
  const widthCols = Math.floor((g.textWidthIn - style.leftIndent - style.rightIndent) * g.cpi + 1e-6);
  return { indentCols, widthCols };
}

/**
 * A paragraph's text as printed, and how offsets in the stored text map to
 * it. Printing applies capitals (stored text keeps what was typed) and adds
 * brackets around parentheticals (stored without them, as Fade In does).
 */
export interface DisplayMap {
  text: string;
  /** Stored-text offset → printed-text offset. */
  toDisplay(offset: number): number;
  /** Printed-text offset → stored-text offset. */
  toStored(offset: number): number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function displayMap(b: Block, style: ResolvedStyle): DisplayMap {
  let t = blockText(b);
  const len = t.length;
  // Upper-case letter by letter so offsets never shift (e.g. "ß" stays one character).
  if (style.allCaps) t = Array.from(t, (c) => (c.toUpperCase().length === c.length ? c.toUpperCase() : c)).join('');
  if (b.style === 'Parenthetical' && t.trim() !== '' && !t.trimStart().startsWith('(')) {
    const lead = t.length - t.trimStart().length;
    const inner = t.trim().length;
    return {
      text: `(${t.trim()})`,
      toDisplay: (o) => clamp(o - lead, 0, inner) + 1,
      toStored: (d) => clamp(d - 1, 0, inner) + lead,
    };
  }
  return { text: t, toDisplay: (o) => clamp(o, 0, len), toStored: (d) => clamp(d, 0, len) };
}

function displayText(b: Block, style: ResolvedStyle): string {
  return displayMap(b, style).text;
}

/**
 * Wrapping every paragraph on every keystroke is most of the work of laying
 * out a long script. Paragraphs are never changed in place (an edit replaces
 * the paragraph object), so a paragraph's wrapped lines are kept with it and
 * reused until its text, style or width changes.
 */
interface CachedPiece {
  style: ResolvedStyle;
  suffix: string;
  width: number;
  display: string;
  lines: LineRange[];
}
const pieceCache = new WeakMap<Block, CachedPiece>();

function blockPiece(blockIndex: number, b: Block, style: ResolvedStyle, g: Geometry, suffix = ''): Piece {
  const { indentCols, widthCols } = geometryFor(style, g);
  const c = pieceCache.get(b);
  if (c && c.style === style && c.suffix === suffix && c.width === widthCols) {
    return { blockIndex, style, display: c.display, from: 0, to: c.display.length, lines: c.lines, indentCols, widthCols };
  }
  const display = displayText(b, style) + suffix;
  const piece = makePiece(blockIndex, style, display, g);
  pieceCache.set(b, { style, suffix, width: widthCols, display, lines: piece.lines });
  return piece;
}

function makePiece(blockIndex: number, style: ResolvedStyle, display: string, g: Geometry, from = 0, to = display.length): Piece {
  const { indentCols, widthCols } = geometryFor(style, g);
  const lines = wrap(display.slice(from, to), widthCols).map((r) => ({ start: r.start + from, end: r.end + from }));
  return { blockIndex, style, display, from, to, lines, indentCols, widthCols };
}

function buildUnits(doc: ScreenplayDocument, sheet: StyleSheet, g: Geometry): Unit[] {
  const units: Unit[] = [];
  const sp = (st: ResolvedStyle) => Math.round(st.spaceBefore * doc.settings.elementSpacing);
  let lastSpeaker: string | null = null;
  const blocks = doc.blocks;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const st = sheet.forBlock(b);
    if (b.style === 'Scene Heading' || st.actBreak) lastSpeaker = null;

    if (b.style === 'Character') {
      const base = displayText(b, st);
      const speaker = characterBaseName(blockText(b));
      const cont = doc.settings.contText;
      const suffix = doc.settings.dialogueContinues && cont && speaker && speaker === lastSpeaker && !base.includes(cont) ? ` ${cont}` : '';
      lastSpeaker = speaker || lastSpeaker;
      const pieces = [blockPiece(i, b, st, g, suffix)];
      const cue = pieces[0].display;
      while (i + 1 < blocks.length && DIALOGUE_PARTS.has(blocks[i + 1].style)) {
        i++;
        const bs = sheet.forBlock(blocks[i]);
        pieces.push(blockPiece(i, blocks[i], bs, g));
      }
      units.push({
        kind: 'dialogue',
        pieces,
        spaceBefore: sp(st),
        keepWithNext: false,
        pageBreakBefore: st.pageBreakBefore,
        cue,
        cueCol: pieces[0].indentCols,
      });
      continue;
    }
    units.push({
      kind: 'block',
      pieces: [blockPiece(i, b, st, g)],
      spaceBefore: sp(st),
      keepWithNext: st.keepWithNext,
      pageBreakBefore: st.pageBreakBefore,
    });
  }
  return units;
}

const unitLines = (u: Unit) => u.pieces.reduce((a, p) => a + p.lines.length, 0);

type Fit =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'split'; first: Unit; rest: Unit };

/** How much of `u` fits in `avail` lines (space-before already deducted). */
function fit(u: Unit, avail: number, doc: ScreenplayDocument, g: Geometry, o: LayoutOptions): Fit {
  if (unitLines(u) <= avail) return { kind: 'all' };
  if (u.kind === 'block') return splitBlock(u, avail, doc, g, o);
  return splitDialogue(u, avail, doc, g, o);
}

/** Candidate split offsets within a piece, best (latest) first. */
function splitOffsets(p: Piece, breakOnSentences: boolean): number[] {
  const text = p.display.slice(p.from, p.to);
  if (breakOnSentences) {
    return sentenceBreaks(text)
      .map((x) => x + p.from)
      .reverse();
  }
  // Line-based: split after any wrapped line.
  return p.lines
    .slice(0, -1)
    .map((l) => l.end)
    .reverse();
}

function splitPiece(p: Piece, at: number, g: Geometry): [Piece, Piece] | null {
  let restFrom = at;
  while (restFrom < p.to && p.display[restFrom] === ' ') restFrom++;
  if (restFrom >= p.to) return null;
  const first = makePiece(p.blockIndex, p.style, p.display, g, p.from, at);
  const rest = makePiece(p.blockIndex, p.style, p.display, g, restFrom, p.to);
  return [first, rest];
}

function splitBlock(u: Unit, avail: number, doc: ScreenplayDocument, g: Geometry, o: LayoutOptions): Fit {
  const p = u.pieces[0];
  if (u.keepWithNext || p.style.name === 'Scene Heading' || p.style.name === 'Transition') return { kind: 'none' };
  if (o.splitLeavesLastLine) avail -= 1;
  for (const at of splitOffsets(p, doc.settings.breakOnSentences)) {
    const parts = splitPiece(p, at, g);
    if (!parts) continue;
    const [a, b] = parts;
    if (a.lines.length <= avail && a.lines.length >= o.minLinesBeforeBreak && b.lines.length >= o.minLinesAfterBreak) {
      return {
        kind: 'split',
        first: { ...u, pieces: [a] },
        rest: { ...u, pieces: [b], spaceBefore: 0, pageBreakBefore: false },
      };
    }
  }
  return { kind: 'none' };
}

/**
 * Splits a dialogue group across pages: the first page ends with (MORE) on its
 * own line at the Character indent; the next page starts with the cue +
 * " (cont'd)" printed on line 0, above the first body line.
 */
function splitDialogue(u: Unit, avail: number, doc: ScreenplayDocument, g: Geometry, o: LayoutOptions): Fit {
  if (!doc.settings.dialoguePageBreaks) return { kind: 'none' };
  const room = avail - 1; // one line for (MORE)
  let before = 0; // lines of pieces fully placed before the one being split
  let best: Fit = { kind: 'none' };
  for (let k = 0; k < u.pieces.length; k++) {
    const p = u.pieces[k];
    if (k > 0 && p.style.name === 'Dialogue') {
      // Option A: break inside this Dialogue piece at a sentence end.
      for (const at of splitOffsets(p, doc.settings.breakOnSentences)) {
        const parts = splitPiece(p, at, g);
        if (!parts) continue;
        const [a, b] = parts;
        if (before + a.lines.length <= room && a.lines.length >= o.minLinesBeforeBreak && b.lines.length >= o.minLinesAfterBreak) {
          best = {
            kind: 'split',
            first: { ...u, pieces: [...u.pieces.slice(0, k), a] },
            rest: { ...u, pieces: [b, ...u.pieces.slice(k + 1)], spaceBefore: 0, pageBreakBefore: false },
          };
          break;
        }
      }
    }
    if (before + p.lines.length > room) break;
    before += p.lines.length;
    // Option B: break between pieces, after a complete Dialogue piece.
    if (k > 0 && k < u.pieces.length - 1 && p.style.name === 'Dialogue' && p.lines.length >= o.minLinesBeforeBreak) {
      best = {
        kind: 'split',
        first: { ...u, pieces: u.pieces.slice(0, k + 1) },
        rest: { ...u, pieces: u.pieces.slice(k + 1), spaceBefore: 0, pageBreakBefore: false },
      };
    }
  }
  if (best.kind === 'split') {
    // The rest begins with the continued cue, which doesn't use a body line.
    (best.rest as Unit & { continued?: boolean }).continued = true;
  }
  return best;
}

function paginate(units: Unit[], doc: ScreenplayDocument, g: Geometry, o: LayoutOptions): LayoutLine[][] {
  const pages: LayoutLine[][] = [];
  let lines: LayoutLine[] = [];
  let y = 0; // body lines used on the current page
  const newPage = () => {
    pages.push(lines);
    lines = [];
    y = 0;
  };
  const cap = g.linesPerPage;
  const sb = (u: Unit) => (y === 0 ? 0 : u.spaceBefore);

  const place = (u: Unit) => {
    y += sb(u);
    if ((u as Unit & { continued?: boolean }).continued && u.cue) {
      const cont = doc.settings.contText;
      const text = u.cue.includes(cont) ? u.cue : `${u.cue} ${cont}`;
      lines.push({ line: y, col: u.cueCol ?? 0, text, kind: 'continued-cue', style: 'Character' });
    }
    for (const p of u.pieces) {
      for (const r of p.lines) {
        y += 1;
        const text = p.display.slice(r.start, r.end);
        lines.push({
          line: y,
          col: alignCol(text.length, p.indentCols, p.widthCols, p.style.align),
          text,
          kind: 'text',
          style: p.style.name,
          blockIndex: p.blockIndex,
          start: r.start,
          end: r.end,
        });
      }
    }
  };

  const queue = [...units];
  while (queue.length) {
    const u = queue.shift()!;
    if (u.pageBreakBefore && y > 0) newPage();
    const avail = cap - y - sb(u);
    const f = fit(u, avail, doc, g, o);

    if (f.kind === 'all') {
      // Keep-with-next: the next unit must be able to start on this page too.
      if (u.keepWithNext && y > 0 && queue.length) {
        const next = queue[0];
        const after = avail - unitLines(u) - next.spaceBefore;
        if (after <= 0 || fit(next, after, doc, g, o).kind === 'none') {
          newPage();
          place(u);
          continue;
        }
      }
      place(u);
    } else if (f.kind === 'split') {
      place(f.first);
      if (u.kind === 'dialogue') {
        const cueCol = u.cueCol ?? 0;
        y += 1;
        lines.push({ line: y, col: cueCol, text: doc.settings.moreText, kind: 'more', style: 'Character' });
      }
      newPage();
      queue.unshift(f.rest);
    } else if (y > 0) {
      newPage();
      queue.unshift(u);
    } else {
      // Doesn't fit even on an empty page: force a line-based split.
      const forced = fit(u, avail, { ...doc, settings: { ...doc.settings, breakOnSentences: false } }, g, {
        ...o,
        minLinesBeforeBreak: 1,
        minLinesAfterBreak: 1,
      });
      if (forced.kind === 'split') {
        place(forced.first);
        newPage();
        queue.unshift(forced.rest);
      } else {
        place(u); // last resort: overflow
        newPage();
      }
    }
  }
  if (lines.length) pages.push(lines);
  return pages;
}

function layoutTitlePage(doc: ScreenplayDocument, sheet: StyleSheet, g: Geometry): LayoutPage {
  const lines: LayoutLine[] = [];
  let y = 0;
  doc.titlePage.forEach((b) => {
    const st = sheet.forBlock(b);
    const p = makePiece(-1, st, displayText(b, st), g);
    y += y === 0 ? 0 : Math.round(st.spaceBefore * doc.settings.elementSpacing);
    for (const r of p.lines) {
      y += 1;
      const text = p.display.slice(r.start, r.end);
      if (text === '') continue;
      lines.push({
        line: y,
        col: alignCol(text.length, p.indentCols, p.widthCols, st.align),
        text,
        kind: 'text',
        style: st.name,
        start: r.start,
        end: r.end,
        titlePage: true,
      });
    }
  });
  return { number: null, isTitlePage: true, lines };
}
