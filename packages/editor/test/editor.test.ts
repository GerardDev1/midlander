import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, blockText, createDocument, type Block } from '../../core/src/index.ts';
import {
  acceptSuggestion,
  caret,
  createEditorState,
  deleteBackward,
  deleteForward,
  enter,
  fragmentText,
  insertText,
  isDirty,
  markSaved,
  moveHorizontal,
  pasteFragment,
  pasteText,
  pos,
  redo,
  select,
  selectedFragment,
  setElement,
  softReturn,
  suggestions,
  tab,
  toggleMark,
  undo,
  type EditorState,
} from '../src/index.ts';

const at = (blocks: Block[], b = 0, o?: number): EditorState => {
  const s = createEditorState(createDocument(blocks));
  return select(s, caret(pos(b, o ?? blockText(blocks[b]).length)));
};
const type = (s: EditorState, text: string) => [...text].reduce((st, ch) => insertText(st, ch), s);
const shape = (s: EditorState) => s.doc.blocks.map((b) => `${b.style}: ${blockText(b)}`);

test('typing goes into the paragraph and keeps the caret after it', () => {
  const s = type(at([block('Action', '')]), 'Rain.');
  assert.deepEqual(shape(s), ['Action: Rain.']);
  assert.deepEqual(s.sel.head, pos(0, 5));
});

test('Enter follows the element flow: Scene Heading → Action, Character → Dialogue → Action', () => {
  let s = type(at([block('Scene Heading', '')]), 'int. pier - dawn');
  s = enter(s);
  s = type(s, 'Gulls.');
  s = enter(s);
  s = setElement(s, 'Character');
  s = type(s, 'mara');
  s = enter(s);
  s = type(s, 'Too early.');
  s = enter(s);
  assert.deepEqual(shape(s), ['Scene Heading: int. pier - dawn', 'Action: Gulls.', 'Character: mara', 'Dialogue: Too early.', 'Action: ']);
});

test('Enter in the middle splits the paragraph; at the start it opens a line above', () => {
  let s = enter(at([block('Action', 'One two')], 0, 3));
  assert.deepEqual(shape(s), ['Action: One', 'Action:  two']);
  assert.deepEqual(s.sel.head, pos(1, 0));
  s = enter(at([block('Dialogue', 'Hi')], 0, 0));
  assert.deepEqual(shape(s), ['Dialogue: ', 'Dialogue: Hi']);
  assert.deepEqual(s.sel.head, pos(1, 0));
});

test('Tab: empty Action ↔ Character, end of Character → Parenthetical → Dialogue, end of Action acts like Enter', () => {
  let s = tab(at([block('Action', '')]))!;
  assert.deepEqual(shape(s), ['Character: ']);
  s = tab(s)!;
  assert.deepEqual(shape(s), ['Action: ']);
  s = tab(s)!;
  s = type(s, 'BEN');
  s = tab(s)!;
  assert.deepEqual(shape(s), ['Character: BEN', 'Parenthetical: ']);
  s = type(s, 'quietly');
  s = tab(s)!;
  assert.deepEqual(shape(s), ['Character: BEN', 'Parenthetical: quietly', 'Dialogue: ']);
  s = tab(at([block('Action', 'He waits.')]))!;
  assert.deepEqual(shape(s), ['Action: He waits.', 'Action: ']);
  // Tab in the middle of text does nothing.
  assert.equal(tab(at([block('Action', 'He waits.')], 0, 2)), null);
});

test('auto-detect: "int." starts a scene heading, "CUT TO:" a transition, "(" in empty dialogue a parenthetical', () => {
  let s = type(at([block('Action', '')]), 'int.');
  assert.deepEqual(shape(s), ['Scene Heading: int.']);
  // The reformat is its own undo step.
  assert.deepEqual(shape(undo(s)!), ['Action: int.']);
  s = type(at([block('Action', '')]), 'CUT TO:');
  assert.deepEqual(shape(s), ['Transition: CUT TO:']);
  s = type(at([block('Action', '')]), 'He went to:');
  assert.deepEqual(shape(s), ['Action: He went to:']);
  s = type(at([block('Dialogue', '')]), '(beat');
  assert.deepEqual(shape(s), ['Parenthetical: beat']);
  // A closing bracket is added automatically, so typing one does nothing.
  assert.deepEqual(shape(type(s, ')')), ['Parenthetical: beat']);
});

test('auto-detect on Enter: an all-caps known name or a name with an extension becomes a Character cue', () => {
  const blocks = [block('Character', 'MARA'), block('Dialogue', 'Hi.'), block('Action', 'MARA')];
  let s = enter(at(blocks, 2));
  assert.deepEqual(shape(s).slice(2), ['Character: MARA', 'Dialogue: ']);
  s = enter(at([block('Action', 'JONAH (V.O.)')]));
  assert.deepEqual(shape(s), ['Character: JONAH (V.O.)', 'Dialogue: ']);
  // An unknown all-caps line stays Action.
  s = enter(at([block('Action', 'BANG!')]));
  assert.deepEqual(shape(s), ['Action: BANG!', 'Action: ']);
  s = enter(at([block('Action', 'FADE OUT')]));
  assert.deepEqual(shape(s), ['Transition: FADE OUT', 'Scene Heading: ']);
});

test('Backspace merges paragraphs; an empty paragraph above is removed without changing this one', () => {
  let s = deleteBackward(at([block('Action', 'One'), block('Action', 'Two')], 1, 0))!;
  assert.deepEqual(shape(s), ['Action: OneTwo']);
  assert.deepEqual(s.sel.head, pos(0, 3));
  s = deleteBackward(at([block('Action', ''), block('Dialogue', 'Hi')], 1, 0))!;
  assert.deepEqual(shape(s), ['Dialogue: Hi']);
  s = deleteBackward(at([block('Action', 'Hello there')]), 'word')!;
  assert.deepEqual(shape(s), ['Action: Hello ']);
  s = deleteForward(at([block('Action', 'ab'), block('Action', 'cd')], 0))!;
  assert.deepEqual(shape(s), ['Action: abcd']);
  assert.equal(deleteBackward(at([block('Action', 'x')], 0, 0)), null);
});

test('deleting a selection from the start of a paragraph keeps the element of the text that remains', () => {
  const s0 = at([block('Character', 'MARA'), block('Dialogue', 'Hello there.')]);
  const s = deleteBackward(select(s0, { anchor: pos(0, 0), head: pos(1, 6) }))!;
  assert.deepEqual(shape(s), ['Dialogue: there.']);
});

test('undo/redo: a typed word is one step; Enter is its own step; unsaved state follows undo', () => {
  let s = markSaved(at([block('Action', '')]));
  s = type(s, 'Hello');
  s = enter(s);
  s = type(s, 'World');
  assert.equal(isDirty(s), true);
  s = undo(s)!;
  assert.deepEqual(shape(s), ['Action: Hello', 'Action: ']);
  s = undo(s)!;
  assert.deepEqual(shape(s), ['Action: Hello']);
  s = undo(s)!;
  assert.deepEqual(shape(s), ['Action: ']);
  assert.equal(isDirty(s), false);
  assert.equal(undo(s), null);
  s = redo(redo(s)!)!;
  assert.deepEqual(shape(s), ['Action: Hello', 'Action: ']);
  assert.deepEqual(s.sel.head, pos(1, 0));
});

test('moving the caret ends the typing undo group', () => {
  let s = type(at([block('Action', '')]), 'ab');
  s = moveHorizontal(s, -1, 'char', false);
  s = type(s, 'X');
  assert.deepEqual(shape(undo(s)!), ['Action: ab']);
});

test('Cmd+B on a selection toggles bold; with no selection it applies to what you type next', () => {
  let s = select(at([block('Action', 'one two')]), { anchor: pos(0, 4), head: pos(0, 7) });
  s = toggleMark(s, 'bold');
  assert.deepEqual(s.doc.blocks[0].runs, [{ text: 'one ' }, { bold: true, text: 'two' }]);
  s = toggleMark(s, 'bold');
  assert.deepEqual(s.doc.blocks[0].runs, [{ text: 'one two' }]);
  s = toggleMark(at([block('Action', 'a')]), 'italic');
  s = type(s, 'bc');
  assert.deepEqual(s.doc.blocks[0].runs, [{ text: 'a' }, { italic: true, text: 'bc' }]);
});

test('soft return stays in the paragraph', () => {
  const s = type(softReturn(type(at([block('Action', '')]), 'a')), 'b');
  assert.deepEqual(shape(s), ['Action: a\nb']);
});

test('copy keeps elements; paste into an empty paragraph adopts them; plain text paste splits lines', () => {
  const src = select(at([block('Character', 'mara'), block('Dialogue', 'Hi.')]), { anchor: pos(0, 0), head: pos(1, 3) });
  const frag = selectedFragment(src);
  assert.equal(fragmentText(src, frag), 'MARA\nHi.');
  let s = pasteFragment(at([block('Action', 'x'), block('Action', '')], 1), frag);
  assert.deepEqual(shape(s), ['Action: x', 'Character: mara', 'Dialogue: Hi.']);
  s = pasteText(at([block('Action', 'ab')], 0, 1), 'X\nY');
  assert.deepEqual(shape(s), ['Action: aX', 'Action: Yb']);
  assert.deepEqual(s.sel.head, pos(1, 1));
});

test('autocomplete: intros, locations from earlier scenes, times, characters and extensions', () => {
  const blocks = [
    block('Scene Heading', 'INT. LIGHTHOUSE - NIGHT'),
    block('Character', 'MARA'),
    block('Dialogue', 'Hi.'),
    block('Scene Heading', ''),
  ];
  let s = type(at(blocks, 3), 'i');
  let sug = suggestions(s)!;
  assert.deepEqual(sug.items, ['INT.', 'INT./EXT.']);
  s = acceptSuggestion(s, sug, 0);
  assert.equal(blockText(s.doc.blocks[3]), 'INT. ');
  assert.equal(suggestions(s), null);
  s = type(s, 'li');
  sug = suggestions(s)!;
  assert.deepEqual(sug.items, ['LIGHTHOUSE']);
  s = acceptSuggestion(s, sug, 0);
  s = type(s, 'ni');
  s = acceptSuggestion(s, suggestions(s)!, 0);
  assert.equal(blockText(s.doc.blocks[3]), 'INT. LIGHTHOUSE - NIGHT');

  s = type(enter(s), '');
  s = setElement(enter(s), 'Character');
  s = type(s, 'm');
  assert.deepEqual(suggestions(s)!.items, ['MARA']);
  s = acceptSuggestion(s, suggestions(s)!, 0);
  s = type(s, ' (v');
  assert.deepEqual(suggestions(s)!.items, ['(V.O.)']);
  // Nothing is suggested when the text already matches.
  assert.equal(suggestions(type(at([block('Character', '')]), 'MARA')), null);
});

test('saving records new characters and locations in the lists', async () => {
  const { withScriptLists } = await import('../src/index.ts');
  const doc = createDocument([block('Scene Heading', 'ext. quay - dusk'), block('Character', 'mara (O.S.)'), block('Character', 'MARA')]);
  const out = withScriptLists(doc);
  assert.deepEqual(out.lists.characters, [{ name: 'MARA' }]);
  assert.deepEqual(out.lists.locations, ['quay']);
  assert.equal(withScriptLists(out), out);
});

test('redo puts the caret back where the edit left it, not where the selection was before an earlier step', () => {
  let s = type(at([block('Action', 'abc')]), 'd');
  s = select(s, { anchor: pos(0, 0), head: pos(0, 4) });
  s = type(s, 'X'); // replaces everything
  s = undo(undo(s)!)!;
  s = redo(s)!;
  assert.deepEqual(shape(s), ['Action: abcd']);
  assert.deepEqual(s.sel, caret(pos(0, 4)));
  s = redo(s)!;
  assert.deepEqual(shape(s), ['Action: X']);
  assert.deepEqual(s.sel, caret(pos(0, 1)));
  assert.deepEqual(undo(s)!.sel, { anchor: pos(0, 0), head: pos(0, 4) });
});
