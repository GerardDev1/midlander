/**
 * Editing commands. Each takes an EditorState and returns the new state, or
 * null when the command doesn't apply (so the caller can let the key do
 * something else, or ignore it).
 *
 * Element behaviour follows Fade In 4.1.1 (docs/FADE-IN-REFERENCE.md §1):
 * Enter and Tab move between elements using each style's Enter / Tab settings.
 */
import {
  StyleSheet,
  blockText,
  characterBaseName,
  newBlockId,
  type Block,
  type Marks,
  type Run,
  type StyleName,
} from '../../core/src/index.ts';
import { displayMap } from '../../layout/src/index.ts';
import {
  deleteText,
  hasMark,
  insertRuns,
  marksAt,
  normalizeRuns,
  runsText,
  setMark,
  sliceRuns,
  type MarkKey,
} from './runs.ts';
import {
  blockLength,
  caret,
  clampPos,
  commit,
  comparePos,
  isCollapsed,
  ordered,
  pos,
  select,
  type EditKind,
  type EditorState,
  type Pos,
  type Selection,
} from './state.ts';

// ---------------------------------------------------------------------------
// Helpers

const sheetCache = new WeakMap<object, StyleSheet>();
export function styleSheet(s: EditorState): StyleSheet {
  let sh = sheetCache.get(s.doc.styles);
  if (!sh) {
    sh = new StyleSheet(s.doc.styles);
    sheetCache.set(s.doc.styles, sh);
  }
  return sh;
}

const withBlock = (blocks: Block[], i: number, b: Block): Block[] => {
  const out = blocks.slice();
  out[i] = b;
  return out;
};

const emptyBlock = (style: StyleName, marks: Marks = {}): Block => ({ id: newBlockId(), style, runs: [{ ...marks, text: '' }] });

/** Style a paragraph becomes on Enter at its end (blank setting = same style). */
export function enterStyle(s: EditorState, style: StyleName): StyleName {
  return styleSheet(s).resolve(style).enter || style;
}

/** Steps over a whole UTF-16 surrogate pair. */
function stepChar(text: string, offset: number, dir: 1 | -1): number {
  if (dir > 0) {
    const c = text.charCodeAt(offset);
    return offset + (c >= 0xd800 && c <= 0xdbff && offset + 1 < text.length ? 2 : 1);
  }
  const c = text.charCodeAt(offset - 1);
  return offset - (c >= 0xdc00 && c <= 0xdfff && offset >= 2 ? 2 : 1);
}

const WORD = /[\p{L}\p{N}_'’]/u;
function wordBoundary(text: string, offset: number, dir: 1 | -1): number {
  let i = offset;
  if (dir > 0) {
    while (i < text.length && !WORD.test(text[i])) i++;
    while (i < text.length && WORD.test(text[i])) i++;
  } else {
    while (i > 0 && !WORD.test(text[i - 1])) i--;
    while (i > 0 && WORD.test(text[i - 1])) i--;
  }
  return i;
}

const isAllCaps = (t: string) => /\p{L}/u.test(t) && t === t.toUpperCase();

/** Names of characters already in the script or its Characters list. */
export function knownCharacters(s: EditorState, exceptBlock = -1): Set<string> {
  const out = new Set<string>();
  for (const c of s.doc.lists.characters) out.add(characterBaseName(c.name));
  s.doc.blocks.forEach((b, i) => {
    if (i !== exceptBlock && b.style === 'Character') {
      const n = characterBaseName(blockText(b));
      if (n) out.add(n);
    }
  });
  out.delete('');
  return out;
}

// ---------------------------------------------------------------------------
// Replacing a range with a fragment of paragraphs (typing, deleting, pasting)

export interface Fragment {
  style?: StyleName;
  runs: Run[];
}

/**
 * Replaces [from, to) with the fragment. With one fragment paragraph the text
 * is spliced in; with several, the first joins the start of `from`'s
 * paragraph and the last joins the rest of `to`'s paragraph.
 *
 * Styles: when a deletion starts at the very beginning of a paragraph and
 * spans paragraphs, what's left keeps the style of the paragraph it came
 * from, so deleting never turns dialogue into a character cue by accident.
 * `adoptStyles` (internal paste) lets pasted paragraphs keep their styles.
 */
function replaceRange(s: EditorState, from: Pos, to: Pos, frag: Fragment[], adoptStyles = false): { blocks: Block[]; end: Pos } {
  const blocks = s.doc.blocks;
  const fb = blocks[from.block];
  const tb = blocks[to.block];
  const before = sliceRuns(fb.runs, 0, from.offset);
  const after = sliceRuns(tb.runs, to.offset, blockLength(s, to.block));
  const beforeEmpty = from.offset === 0;
  const keepStyle =
    beforeEmpty && to.block > from.block && (blockLength(s, to.block) > to.offset || frag.every((f) => runsText(f.runs) === ''))
      ? tb.style
      : fb.style;

  const pieces = frag.length ? frag : [{ runs: [] }];
  const out: Block[] = [];
  pieces.forEach((f, k) => {
    const first = k === 0;
    const last = k === pieces.length - 1;
    let runs = f.runs;
    if (first) runs = [...before, ...runs];
    if (last) runs = [...runs, ...after];
    let style: StyleName;
    if (first) style = adoptStyles && beforeEmpty && f.style ? f.style : keepStyle;
    else style = f.style ?? fb.style;
    const base = first ? fb : { id: newBlockId() };
    const merged = normalizeRuns(runs.length ? runs : [{ ...marksAt(fb.runs, from.offset), text: '' }]);
    const b: Block = { ...(base as Block), style, runs: merged };
    if (!first) {
      delete b.overrides;
      delete b.dualDialogue;
      delete b.sceneNumber;
      delete b.bookmark;
    }
    out.push(b);
  });
  const lastLen = runsText(pieces[pieces.length - 1].runs).length;
  const end = pos(from.block + pieces.length - 1, (pieces.length === 1 ? from.offset : 0) + lastLen);
  return { blocks: [...blocks.slice(0, from.block), ...out, ...blocks.slice(to.block + 1)], end };
}

function edit(s: EditorState, sel: Selection, frag: Fragment[], kind: EditKind, adoptStyles = false): EditorState {
  const { from, to } = ordered(sel);
  const { blocks, end } = replaceRange(s, from, to, frag, adoptStyles);
  return commit(s, blocks, caret(end), kind);
}

// ---------------------------------------------------------------------------
// Typing

/** Types text at the selection (replacing any selected text), then applies auto-detection. */
export function insertText(s: EditorState, text: string): EditorState {
  if (text === '') return s;
  const { from } = ordered(s.sel);
  const b = s.doc.blocks[from.block];

  // Parentheticals get their brackets automatically.
  if (isCollapsed(s.sel)) {
    const t = blockText(b);
    if (b.style === 'Dialogue' && t === '' && text === '(') return setElement(s, 'Parenthetical');
    if (b.style === 'Parenthetical' && !t.trimStart().startsWith('(')) {
      if (text === '(' && from.offset === 0) return s;
      if (text === ')' && from.offset === t.length) return s;
    }
  }

  const marks = s.storedMarks ?? marksAt(b.runs, from.offset);
  const runs = [{ ...marks, text }];
  const typed = edit(s, s.sel, [{ runs }], text.length === 1 ? 'type' : 'other');
  return autoDetectWhileTyping(typed, text);
}

/** Shift+Enter: a new line inside the same paragraph. */
export function softReturn(s: EditorState): EditorState {
  const { from } = ordered(s.sel);
  const marks = marksAt(s.doc.blocks[from.block].runs, from.offset);
  return edit(s, s.sel, [{ runs: [{ ...marks, text: '\n' }] }], 'other');
}

/**
 * Fade In reformats obvious elements as you type ("int." starts a scene
 * heading; "CUT TO:" becomes a transition). The reformat is its own undo
 * step, so Cmd+Z puts the paragraph back the way it was typed.
 */
function autoDetectWhileTyping(s: EditorState, typed: string): EditorState {
  const p = s.sel.head;
  const b = s.doc.blocks[p.block];
  if (b.style !== 'Action' && b.style !== 'Normal Text') return s;
  const t = blockText(b);
  if (p.offset !== t.length) return s;
  const upper = t.toUpperCase();
  const intros = new Set([...s.doc.lists.sceneIntros.map((i) => i.toUpperCase()), 'EST.', 'I/E.']);
  if (typed === '.' && intros.has(upper)) return restyle(s, p.block, 'Scene Heading');
  if (typed === ':' && isAllCaps(t) && /(^|\s)TO:$/.test(t)) return restyle(s, p.block, 'Transition');
  return s;
}

function restyle(s: EditorState, i: number, style: StyleName): EditorState {
  const b = s.doc.blocks[i];
  if (b.style === style) return s;
  return commit(s, withBlock(s.doc.blocks, i, { ...b, style }), s.sel, 'other');
}

/** On Enter at the end of an all-caps Action line: is it really a character cue or a transition? */
function detectOnEnter(s: EditorState, i: number): StyleName | null {
  const b = s.doc.blocks[i];
  if (b.style !== 'Action' && b.style !== 'Normal Text') return null;
  const t = blockText(b).trim();
  if (!t || !isAllCaps(t) || t.includes('\n')) return null;
  const transitions = new Set(s.doc.lists.transitions.map((x) => x.toUpperCase()));
  if (transitions.has(t) || /(^|\s)TO:$/.test(t)) return 'Transition';
  const ext = s.doc.lists.extensions.some((e) => t.endsWith(` ${e.toUpperCase()}`));
  const name = characterBaseName(t);
  if (name.length <= 38 && (ext || knownCharacters(s, i).has(name))) return 'Character';
  return null;
}

// ---------------------------------------------------------------------------
// Enter, Tab, element changes

/** Enter: start the next element (Fade In's element flow), or split the paragraph. */
export function enter(s: EditorState): EditorState {
  let st = s;
  if (!isCollapsed(st.sel)) st = edit(st, st.sel, [], 'other');
  const p = st.sel.head;
  const b = st.doc.blocks[p.block];
  const len = blockLength(st, p.block);

  if (p.offset === len) {
    const detected = len > 0 ? detectOnEnter(st, p.block) : null;
    const style = detected ?? b.style;
    const cur = detected ? { ...b, style } : b;
    const next = emptyBlock(enterStyle(st, style));
    const blocks = [...st.doc.blocks.slice(0, p.block), cur, next, ...st.doc.blocks.slice(p.block + 1)];
    return commit(st, blocks, caret(pos(p.block + 1, 0)), 'other');
  }
  if (p.offset === 0) {
    const blocks = [...st.doc.blocks.slice(0, p.block), emptyBlock(b.style), ...st.doc.blocks.slice(p.block)];
    return commit(st, blocks, caret(pos(p.block + 1, 0)), 'other');
  }
  const { blocks } = replaceRange(st, p, p, [{ runs: [] }, { style: b.style, runs: [] }]);
  return commit(st, blocks, caret(pos(p.block + 1, 0)), 'other');
}

/**
 * Tab: on an empty paragraph, switch it to the style's "Tab before" element;
 * at the end of a paragraph, start a new "Tab after" element (or act like
 * Enter when the style has none, as Action does in Fade In 4.1.1).
 */
export function tab(s: EditorState): EditorState | null {
  if (!isCollapsed(s.sel)) return null;
  const p = s.sel.head;
  const b = s.doc.blocks[p.block];
  const st = styleSheet(s).resolve(b.style);
  const len = blockLength(s, p.block);
  if (len === 0) {
    if (!st.tabBefore || st.tabBefore === b.style) return null;
    return restyle(s, p.block, st.tabBefore);
  }
  if (p.offset !== len) return null;
  if (!st.tabAfter) return enter(s);
  const next = emptyBlock(st.tabAfter);
  const blocks = [...s.doc.blocks.slice(0, p.block + 1), next, ...s.doc.blocks.slice(p.block + 1)];
  return commit(s, blocks, caret(pos(p.block + 1, 0)), 'other');
}

/** Cmd+1…7 and Cmd+0: change every selected paragraph to this element. Text is unchanged. */
export function setElement(s: EditorState, style: StyleName): EditorState {
  const { from, to } = ordered(s.sel);
  const blocks = s.doc.blocks.slice();
  let changed = false;
  for (let i = from.block; i <= to.block; i++) {
    if (blocks[i].style !== style) {
      blocks[i] = { ...blocks[i], style };
      changed = true;
    }
  }
  return changed ? commit(s, blocks, s.sel, 'other') : s;
}

/** Element of the paragraph with the caret. */
export const currentElement = (s: EditorState): StyleName => s.doc.blocks[s.sel.head.block]?.style ?? 'Action';

// ---------------------------------------------------------------------------
// Deleting

export type DeleteUnit = 'char' | 'word';

export function deleteSelection(s: EditorState): EditorState | null {
  return isCollapsed(s.sel) ? null : edit(s, s.sel, [], 'other');
}

/** Backspace (char), Option+Backspace (word). */
export function deleteBackward(s: EditorState, unit: DeleteUnit = 'char'): EditorState | null {
  if (!isCollapsed(s.sel)) return deleteSelection(s);
  const p = s.sel.head;
  if (p.offset === 0) {
    if (p.block === 0) return null;
    const prevLen = blockLength(s, p.block - 1);
    // An empty paragraph above is simply removed, and this one keeps its element.
    if (prevLen === 0 && blockLength(s, p.block) > 0) {
      const blocks = [...s.doc.blocks.slice(0, p.block - 1), ...s.doc.blocks.slice(p.block)];
      return commit(s, blocks, caret(pos(p.block - 1, 0)), 'other');
    }
    return edit(s, { anchor: pos(p.block - 1, prevLen), head: p }, [], 'other');
  }
  const t = blockText(s.doc.blocks[p.block]);
  const start = unit === 'word' ? wordBoundary(t, p.offset, -1) : stepChar(t, p.offset, -1);
  return edit(s, { anchor: pos(p.block, start), head: p }, [], 'delete');
}

/** Forward delete (char), Option+Delete (word). */
export function deleteForward(s: EditorState, unit: DeleteUnit = 'char'): EditorState | null {
  if (!isCollapsed(s.sel)) return deleteSelection(s);
  const p = s.sel.head;
  const len = blockLength(s, p.block);
  if (p.offset === len) {
    if (p.block === s.doc.blocks.length - 1) return null;
    if (len === 0) {
      const blocks = [...s.doc.blocks.slice(0, p.block), ...s.doc.blocks.slice(p.block + 1)];
      return commit(s, blocks, caret(pos(p.block, 0)), 'other');
    }
    return edit(s, { anchor: p, head: pos(p.block + 1, 0) }, [], 'other');
  }
  const t = blockText(s.doc.blocks[p.block]);
  const end = unit === 'word' ? wordBoundary(t, p.offset, 1) : stepChar(t, p.offset, 1);
  return commit(s, replaceRange(s, p, pos(p.block, end), []).blocks, caret(p), 'delete');
}

/** Deletes from the caret to `target` (e.g. Cmd+Backspace to the start of the line). */
export function deleteTo(s: EditorState, target: Pos): EditorState | null {
  if (!isCollapsed(s.sel)) return deleteSelection(s);
  const t = clampPos(s, target);
  if (comparePos(t, s.sel.head) === 0) return null;
  return edit(s, { anchor: t, head: s.sel.head }, [], 'other');
}

// ---------------------------------------------------------------------------
// Bold / italic / underline

export function toggleMark(s: EditorState, key: MarkKey): EditorState {
  const { from, to } = ordered(s.sel);
  if (isCollapsed(s.sel)) {
    const cur = s.storedMarks ?? marksAt(s.doc.blocks[from.block].runs, from.offset);
    const next: Marks = { ...cur };
    if (next[key]) delete next[key];
    else (next as Record<string, unknown>)[key] = key === 'highlight' ? '#FFFF00' : true;
    return { ...s, storedMarks: next, lastEdit: null };
  }
  const ranges: [number, number, number][] = [];
  for (let i = from.block; i <= to.block; i++) {
    const a = i === from.block ? from.offset : 0;
    const z = i === to.block ? to.offset : blockLength(s, i);
    if (z > a) ranges.push([i, a, z]);
  }
  const allOn = ranges.length > 0 && ranges.every(([i, a, z]) => hasMark(s.doc.blocks[i].runs, a, z, key));
  const blocks = s.doc.blocks.slice();
  for (const [i, a, z] of ranges) blocks[i] = { ...blocks[i], runs: setMark(blocks[i].runs, a, z, key, !allOn) };
  return commit(s, blocks, s.sel, 'other');
}

/** Whether the mark is on at the caret (or across the whole selection), for menus and the status bar. */
export function markActive(s: EditorState, key: MarkKey): boolean {
  const { from, to } = ordered(s.sel);
  if (isCollapsed(s.sel)) return !!(s.storedMarks ?? marksAt(s.doc.blocks[from.block].runs, from.offset))[key];
  for (let i = from.block; i <= to.block; i++) {
    const a = i === from.block ? from.offset : 0;
    const z = i === to.block ? to.offset : blockLength(s, i);
    if (z > a && !hasMark(s.doc.blocks[i].runs, a, z, key)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Caret movement that doesn't need the page layout

export function selectAll(s: EditorState): EditorState {
  const last = s.doc.blocks.length - 1;
  return select(s, { anchor: pos(0, 0), head: pos(last, blockLength(s, last)) });
}

export function moveTo(s: EditorState, p: Pos, extend = false): EditorState {
  return select(s, { anchor: extend ? s.sel.anchor : p, head: p });
}

/** Left/Right by a character or word; collapses a selection to its edge first. */
export function moveHorizontal(s: EditorState, dir: 1 | -1, unit: 'char' | 'word', extend: boolean): EditorState {
  if (!extend && !isCollapsed(s.sel) && unit === 'char') {
    const { from, to } = ordered(s.sel);
    return moveTo(s, dir > 0 ? to : from);
  }
  const p = s.sel.head;
  const t = blockText(s.doc.blocks[p.block]);
  let next: Pos;
  if (dir > 0 && p.offset >= t.length) {
    next = p.block < s.doc.blocks.length - 1 ? pos(p.block + 1, 0) : p;
  } else if (dir < 0 && p.offset <= 0) {
    next = p.block > 0 ? pos(p.block - 1, blockLength(s, p.block - 1)) : p;
  } else {
    next = pos(p.block, unit === 'word' ? wordBoundary(t, p.offset, dir) : stepChar(t, p.offset, dir));
  }
  return moveTo(s, next, extend);
}

/** Option+Up/Down: start or end of the paragraph (then the previous/next one). */
export function moveParagraph(s: EditorState, dir: 1 | -1, extend: boolean): EditorState {
  const p = s.sel.head;
  const len = blockLength(s, p.block);
  let next: Pos;
  if (dir < 0) next = p.offset > 0 ? pos(p.block, 0) : pos(Math.max(0, p.block - 1), 0);
  else if (p.offset < len) next = pos(p.block, len);
  else {
    const b = Math.min(s.doc.blocks.length - 1, p.block + 1);
    next = pos(b, blockLength(s, b));
  }
  return moveTo(s, next, extend);
}

export function moveDocument(s: EditorState, dir: 1 | -1, extend: boolean): EditorState {
  const last = s.doc.blocks.length - 1;
  return moveTo(s, dir < 0 ? pos(0, 0) : pos(last, blockLength(s, last)), extend);
}

/** Word under a position, for double-click. */
export function wordAt(s: EditorState, p: Pos): Selection {
  const t = blockText(s.doc.blocks[p.block]);
  let a = p.offset;
  let z = p.offset;
  if (WORD.test(t[a] ?? '') || WORD.test(t[a - 1] ?? '')) {
    while (a > 0 && WORD.test(t[a - 1])) a--;
    while (z < t.length && WORD.test(t[z])) z++;
  } else if (z < t.length) z++;
  return { anchor: pos(p.block, a), head: pos(p.block, z) };
}

export const paragraphAt = (s: EditorState, i: number): Selection => ({ anchor: pos(i, 0), head: pos(i, blockLength(s, i)) });

// ---------------------------------------------------------------------------
// Clipboard

/** The selected paragraphs, with their elements, for copying. */
export function selectedFragment(s: EditorState): Fragment[] {
  const { from, to } = ordered(s.sel);
  const out: Fragment[] = [];
  for (let i = from.block; i <= to.block; i++) {
    const b = s.doc.blocks[i];
    const a = i === from.block ? from.offset : 0;
    const z = i === to.block ? to.offset : blockLength(s, i);
    out.push({ style: b.style, runs: normalizeRuns(sliceRuns(b.runs, a, z)) });
  }
  return out;
}

/**
 * Plain text of a fragment as it appears on the page: capitals applied and
 * parentheticals in brackets. Paragraphs are separated by a blank line where
 * the page would show one.
 */
export function fragmentText(s: EditorState, frag: Fragment[]): string {
  const sheet = styleSheet(s);
  return frag
    .map((f, k) => {
      const style = sheet.resolve(f.style ?? 'Action');
      const text = displayMap({ id: '', style: f.style ?? 'Action', runs: f.runs }, style).text;
      const gap = k > 0 && style.spaceBefore > 0 ? '\n' : '';
      return gap + text;
    })
    .join('\n');
}

/** Pastes paragraphs copied from Midlander, keeping their elements. */
export function pasteFragment(s: EditorState, frag: Fragment[]): EditorState {
  if (!frag.length) return s;
  return edit(s, s.sel, frag, 'other', true);
}

/** Pastes plain text: each line becomes a paragraph in the current element. */
export function pasteText(s: EditorState, text: string): EditorState {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\t/g, ' ').split('\n');
  const { from } = ordered(s.sel);
  const marks = marksAt(s.doc.blocks[from.block].runs, from.offset);
  if (lines.length === 1) return insertTextPlain(s, lines[0], marks);
  return edit(
    s,
    s.sel,
    lines.map((l) => ({ runs: [{ ...marks, text: l }] })),
    'other',
  );
}

function insertTextPlain(s: EditorState, text: string, marks: Marks): EditorState {
  if (!text) return s;
  return edit(s, s.sel, [{ runs: [{ ...marks, text }] }], 'other');
}

// Exposed for the autocomplete module.
export function replaceInBlock(s: EditorState, i: number, from: number, to: number, text: string): EditorState {
  const b = s.doc.blocks[i];
  const marks = marksAt(b.runs, from);
  const runs = insertRuns(deleteText(b.runs, from, to), from, [{ ...marks, text }]);
  return commit(s, withBlock(s.doc.blocks, i, { ...b, runs }), caret(pos(i, from + text.length)), 'other');
}

