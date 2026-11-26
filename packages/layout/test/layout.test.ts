import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrap, sentenceBreaks, layoutDocument, type LayoutPage } from '../src/index.ts';
import { createDocument, block, type Block } from '../../core/src/index.ts';

const lines = (t: string, w: number) => wrap(t, w).map((r) => t.slice(r.start, r.end));
const bodyText = (p: LayoutPage) => p.lines.filter((l) => l.kind !== 'header');
const at = (p: LayoutPage, line: number) => p.lines.filter((l) => l.line === line);

test('wrap: breaks at spaces, drops trailing spaces, keeps inner spacing', () => {
  assert.deepEqual(lines('one two three', 7), ['one two', 'three']);
  assert.deepEqual(lines('one two  ', 7), ['one two']);
  assert.deepEqual(lines('a  b', 10), ['a  b']);
  assert.deepEqual(lines('', 10), ['']);
  assert.deepEqual(lines('Draft\ninformation', 60), ['Draft', 'information']);
  assert.deepEqual(lines('abcdefghij', 4), ['abcd', 'efgh', 'ij']);
  // A word ending exactly at the width fits.
  assert.deepEqual(lines('abc def', 3), ['abc', 'def']);
  // No space after a full stop: one word.
  assert.deepEqual(lines('the man.Then more', 12), ['the man.Then', 'more']);
});

test('sentence breaks follow . ? ! (and closing quotes) before a space', () => {
  const t = 'One. Two? "Three!" Four.Five six';
  assert.deepEqual(
    sentenceBreaks(t).map((i) => t.slice(0, i)),
    ['One.', 'One. Two?', 'One. Two? "Three!"'],
  );
});

test('element columns and widths match Fade In 4.1.1 (60/37/20/35 characters)', () => {
  const doc = createDocument([
    block('Scene Heading', 'int. hall - day'),
    block('Action', 'x '.repeat(40)),
    block('Character', 'ann'),
    block('Parenthetical', 'quietly'),
    block('Dialogue', 'word '.repeat(10)),
    block('Transition', 'cut to:'),
  ]);
  const [p] = layoutDocument(doc).pages;
  const body = bodyText(p);
  assert.equal(body[0].text, 'INT. HALL - DAY');
  assert.equal(body[0].col, 0);
  assert.equal(body[1].text.length, 59); // "x x … x" fits in 60
  const cue = body.find((l) => l.text === 'ANN')!;
  assert.equal(cue.col, 25);
  const paren = body.find((l) => l.text === '(quietly)')!;
  assert.equal(paren.col, 20);
  const dlg = body.filter((l) => l.style === 'Dialogue');
  assert.ok(Math.abs(dlg[0].col - 13) < 0.05); // 1.3" = 12.99 columns
  assert.ok(dlg[0].text.length <= 37);
  const tr = body.find((l) => l.text === 'CUT TO:')!;
  assert.equal(tr.col + tr.text.length, 55); // right-aligned, 0.5" in from the right margin
});

test('spacing: 2 blank lines before scene headings, none at the top of a page', () => {
  const doc = createDocument([block('Scene Heading', 'INT. A - DAY'), block('Action', 'One.'), block('Scene Heading', 'EXT. B - NIGHT')]);
  const body = bodyText(layoutDocument(doc).pages[0]);
  assert.deepEqual(
    body.map((l) => [l.line, l.text]),
    [
      [1, 'INT. A - DAY'],
      [3, 'One.'],
      [6, 'EXT. B - NIGHT'],
    ],
  );
});

test("automatic (cont'd) when the same character speaks again after action, reset by a new scene", () => {
  const doc = createDocument([
    block('Scene Heading', 'INT. A - DAY'),
    block('Character', 'tom'),
    block('Dialogue', 'Hi.'),
    block('Action', 'He waits.'),
    block('Character', 'Tom'),
    block('Dialogue', 'Hello?'),
    block('Character', 'ann (O.S.)'),
    block('Dialogue', 'Yes.'),
    block('Scene Heading', 'INT. B - DAY'),
    block('Character', 'ann'),
    block('Dialogue', 'Here.'),
  ]);
  const cues = bodyText(layoutDocument(doc).pages[0])
    .filter((l) => l.style === 'Character')
    .map((l) => l.text);
  assert.deepEqual(cues, ['TOM', "TOM (cont'd)", 'ANN (O.S.)', 'ANN']);
});

/** n action paragraphs of one line each: lines 1, 3, 5, … */
function filler(n: number): Block[] {
  return Array.from({ length: n }, (_, i) => block('Action', `Line ${i + 1}.`));
}
const sentences = (n: number, word = 'Talk') =>
  Array.from({ length: n }, (_, i) => `${word} ${'more '.repeat(5)}now ${i + 1}.`).join(' ');

test('page holds 54 lines; whole paragraphs may use line 54', () => {
  // 27 one-line actions → lines 1,3,…,53; then a 1-line action fits on line 55? No: 54 is the last.
  const doc = createDocument([...filler(27), block('Action', 'Last on page.')]);
  const pages = layoutDocument(doc).pages;
  assert.equal(pages.length, 2, '28th paragraph needs line 55 → next page');
  const doc2 = createDocument([...filler(26), block('Action', 'A two line paragraph that is long enough to wrap onto a second line here.')]);
  const p = layoutDocument(doc2).pages;
  assert.equal(p.length, 1);
  assert.equal(at(p[0], 54)[0]?.text, 'second line here.');
});

test('dialogue split: sentence boundary, (MORE) on the last line, continued cue above line 1', () => {
  // Fill to line 41, then a long speech.
  const doc = createDocument([...filler(21), block('Character', 'carol (O.S.)'), block('Dialogue', sentences(16))]);
  const [p1, p2] = layoutDocument(doc).pages;
  const more = p1.lines.find((l) => l.kind === 'more')!;
  assert.equal(more.text, '(MORE)');
  assert.equal(more.col, 25);
  const lastDlg = p1.lines.filter((l) => l.style === 'Dialogue').at(-1)!;
  assert.equal(more.line, lastDlg.line + 1);
  assert.ok(more.line <= 54);
  assert.match(lastDlg.text, /\.$/, 'first page ends at a sentence');
  const cont = p2.lines.find((l) => l.kind === 'continued-cue')!;
  assert.equal(cont.text, "CAROL (O.S.) (cont'd)");
  assert.equal(cont.line, 0);
  assert.equal(p2.lines.find((l) => l.kind === 'text')!.line, 1);
});

test('action split: sentence boundary, first part leaves line 54 empty, rest starts on line 1', () => {
  const doc = createDocument([...filler(20), block('Action', sentences(40))]);
  const [p1, p2] = layoutDocument(doc).pages;
  const last = p1.lines.filter((l) => l.kind === 'text').at(-1)!;
  assert.ok(last.line <= 53);
  assert.match(last.text, /\.$/);
  assert.equal(p1.lines.some((l) => l.kind === 'more'), false, 'no (MORE) for action');
  const first = p2.lines.find((l) => l.kind === 'text')!;
  assert.equal(first.line, 1);
  assert.match(first.text, /^Talk /);
});

test('scene heading is kept with the following paragraph', () => {
  // Fill to line 51, so a heading would land on line 54 with nothing after it.
  const doc = createDocument([...filler(25), block('Action', 'x'), block('Scene Heading', 'INT. C - DAY'), block('Action', 'Text.')]);
  const pages = layoutDocument(doc).pages;
  assert.equal(bodyText(pages[1])[0].text, 'INT. C - DAY');
  assert.equal(bodyText(pages[1])[0].line, 1);
});

test('header: "#." right-aligned from page 2, title page unnumbered', () => {
  const doc = createDocument([...filler(40)]);
  doc.titlePage = [block('Normal Text', 'MY SCRIPT', { overrides: { align: 'center' } })];
  const pages = layoutDocument(doc).pages;
  assert.equal(pages[0].isTitlePage, true);
  assert.equal(pages[0].number, null);
  assert.equal(pages[0].lines[0].col, 25.5); // (60 - 9) / 2
  assert.equal(pages[1].number, '1');
  assert.equal(pages[1].lines.some((l) => l.kind === 'header'), false);
  const h = pages[2].lines.find((l) => l.kind === 'header')!;
  assert.equal(h.text, '2.');
  assert.equal(h.col + h.text.length, 60);
});
