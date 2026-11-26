/**
 * Editor state: the document, the selection, and undo/redo history.
 *
 * Positions are (paragraph index, offset into the paragraph's stored text).
 * Paragraph objects are never changed in place: an edit replaces the
 * paragraphs it touches, so an undo snapshot is just the previous array.
 */
import type { Block, Marks, ScreenplayDocument } from '../../core/src/index.ts';

export interface Pos {
  block: number;
  offset: number;
}

export interface Selection {
  anchor: Pos;
  head: Pos;
}

/** One undo step: the paragraphs before it, and the selection before and after it. */
interface Step {
  blocks: Block[];
  selBefore: Selection;
  selAfter: Selection;
}
/** One redo step: the paragraphs to bring back, and the selections on either side. */
interface RedoStep extends Step {
  blocksAfter: Block[];
}

/** What kind of edit made the last undo step, so that typing a word is one undo step. */
export type EditKind = 'type' | 'delete' | 'other';

export interface EditorState {
  doc: ScreenplayDocument;
  sel: Selection;
  /** Marks for the next typed text when the selection is empty (set by Cmd+B etc.). */
  storedMarks: Marks | null;
  undo: Step[];
  redo: RedoStep[];
  lastEdit: { kind: EditKind; at: number; pos: Pos } | null;
  /** The paragraphs as last saved, to tell whether there are unsaved changes. */
  savedBlocks: Block[];
}

export const UNDO_LIMIT = 1000;
/** Typing pauses longer than this start a new undo step. */
const GROUP_MS = 1500;

export const pos = (block: number, offset: number): Pos => ({ block, offset });
export const caret = (p: Pos): Selection => ({ anchor: p, head: p });

export function comparePos(a: Pos, b: Pos): number {
  return a.block - b.block || a.offset - b.offset;
}
export const samePos = (a: Pos, b: Pos) => comparePos(a, b) === 0;

export function ordered(sel: Selection): { from: Pos; to: Pos } {
  return comparePos(sel.anchor, sel.head) <= 0 ? { from: sel.anchor, to: sel.head } : { from: sel.head, to: sel.anchor };
}
export const isCollapsed = (sel: Selection) => samePos(sel.anchor, sel.head);

export function createEditorState(doc: ScreenplayDocument): EditorState {
  const blocks = doc.blocks.length ? doc.blocks : [{ id: 'b0', style: 'Scene Heading', runs: [{ text: '' }] }];
  const d = blocks === doc.blocks ? doc : { ...doc, blocks };
  return {
    doc: d,
    sel: caret(pos(0, 0)),
    storedMarks: null,
    undo: [],
    redo: [],
    lastEdit: null,
    savedBlocks: d.blocks,
  };
}

export const isDirty = (s: EditorState) => s.doc.blocks !== s.savedBlocks;
export const markSaved = (s: EditorState): EditorState => ({ ...s, savedBlocks: s.doc.blocks, lastEdit: null });

/**
 * Applies new paragraphs and selection as one edit, recording undo history.
 * Consecutive typing (or deleting) at the caret within a short time merges
 * into one undo step; anything else starts a new one.
 */
export function commit(
  s: EditorState,
  blocks: Block[],
  sel: Selection,
  kind: EditKind = 'other',
  now: number = Date.now(),
): EditorState {
  const prev = s.lastEdit;
  const merge =
    kind !== 'other' &&
    prev !== null &&
    prev.kind === kind &&
    now - prev.at < GROUP_MS &&
    samePos(prev.pos, s.sel.head) &&
    isCollapsed(s.sel) &&
    s.undo.length > 0;
  const undo = merge
    ? [...s.undo.slice(0, -1), { ...s.undo[s.undo.length - 1], selAfter: sel }]
    : [...s.undo, { blocks: s.doc.blocks, selBefore: s.sel, selAfter: sel }].slice(-UNDO_LIMIT);
  return {
    ...s,
    doc: { ...s.doc, blocks },
    sel,
    undo,
    redo: [],
    storedMarks: null,
    lastEdit: kind === 'other' ? null : { kind, at: now, pos: sel.head },
  };
}

export function undo(s: EditorState): EditorState | null {
  const step = s.undo[s.undo.length - 1];
  if (!step) return null;
  return {
    ...s,
    doc: { ...s.doc, blocks: step.blocks },
    sel: step.selBefore,
    undo: s.undo.slice(0, -1),
    redo: [...s.redo, { ...step, blocksAfter: s.doc.blocks }],
    storedMarks: null,
    lastEdit: null,
  };
}

export function redo(s: EditorState): EditorState | null {
  const step = s.redo[s.redo.length - 1];
  if (!step) return null;
  const { blocksAfter, ...undoStep } = step;
  return {
    ...s,
    doc: { ...s.doc, blocks: blocksAfter },
    sel: step.selAfter,
    redo: s.redo.slice(0, -1),
    undo: [...s.undo, undoStep],
    storedMarks: null,
    lastEdit: null,
  };
}

/** Moves the selection without editing (and ends the current typing undo group). */
export function select(s: EditorState, sel: Selection): EditorState {
  return { ...s, sel: clampSel(s, sel), storedMarks: null, lastEdit: null };
}

export function blockLength(s: EditorState, i: number): number {
  const b = s.doc.blocks[i];
  return b ? b.runs.reduce((n, r) => n + r.text.length, 0) : 0;
}

export function clampPos(s: EditorState, p: Pos): Pos {
  const block = Math.max(0, Math.min(s.doc.blocks.length - 1, p.block));
  return { block, offset: Math.max(0, Math.min(blockLength(s, block), p.offset)) };
}
const clampSel = (s: EditorState, sel: Selection): Selection => ({ anchor: clampPos(s, sel.anchor), head: clampPos(s, sel.head) });
