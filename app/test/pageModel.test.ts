import { test } from 'node:test';
import assert from 'node:assert/strict';
import { block, createDocument } from '../../packages/core/src/index.ts';
import { readOsfXml } from '../../packages/formats/src/index.ts';
import { buildRenderModel, nextZoom } from '../src/pageModel.ts';

// Original sample text written for these tests.
const OSF = `<?xml version="1.0" encoding="UTF-8"?>
<document type="Open Screenplay Format document" version="41">
  <info uuid="T1" pagecount="1"/>
  <settings page_width="2159" page_height="2794" margin_top="266" margin_bottom="228" margin_left="381" margin_right="254"
    normal_linesperinch="6.0" element_spacing="1.00" page_header="#." header_alignment="3" header_first_page="false"/>
  <styles>
    <style name="Normal Text" builtin="1" font="Courier New" size="12"/>
    <style name="Scene Heading" builtin="1" basestyle="Normal Text" style_enter="Action" bold="1" spacebefore="2.0" keepwithnext="1" allcaps="1"/>
  </styles>
  <paragraphs>
    <para><style basestyle="Scene Heading"/><text>ext. pier - dawn</text></para>
    <para><style basestyle="Action"/><text>Gulls argue over a chip.</text></para>
  </paragraphs>
  <titlepage>
    <para bookmark="Title"><style basestyle="Normal Text" align="center"/><text>THE PIER</text></para>
  </titlepage>
</document>`;

test('render model: page size, title page and line positions in inches', () => {
  const m = buildRenderModel(readOsfXml(OSF));
  assert.ok(Math.abs(m.widthIn - 8.5) < 0.01, `width ${m.widthIn}`);
  assert.ok(Math.abs(m.heightIn - 11) < 0.01, `height ${m.heightIn}`);
  assert.equal(m.pages[0].isTitlePage, true);
  assert.equal(m.scriptPageCount, 1);
  assert.equal(m.sceneCount, 1);

  const page1 = m.pages.find((p) => !p.isTitlePage)!;
  assert.equal(page1.label, 'Page 1');
  const heading = page1.lines.find((l) => l.text === 'EXT. PIER - DAWN')!;
  assert.ok(heading, 'scene heading is in capitals');
  assert.equal(heading.bold, true);
  // First line of page 1 sits on the top margin, at the left margin.
  assert.ok(Math.abs(heading.top - 266 / 254) < 0.01, `top ${heading.top}`);
  assert.ok(Math.abs(heading.left - 1.5) < 0.01, `left ${heading.left}`);
  const action = page1.lines.find((l) => l.text.startsWith('Gulls'))!;
  assert.equal(action.bold, false);
  assert.ok(Math.abs(action.top - heading.top - 2 / 6) < 0.01, 'one blank line between heading and action');
});

test('render model: long scripts produce numbered pages', () => {
  const blocks = [block('Scene Heading', 'INT. ROOM - DAY')];
  for (let i = 0; i < 80; i++) blocks.push(block('Action', `Line ${i + 1} of the test action.`));
  const m = buildRenderModel(createDocument(blocks));
  assert.ok(m.scriptPageCount >= 2);
  assert.equal(m.pages.at(-1)!.label, `Page ${m.scriptPageCount}`);
  // Page 2 carries the "2." header above the body.
  const p2 = m.pages.filter((p) => !p.isTitlePage)[1];
  assert.ok(p2.lines.some((l) => l.text.trim() === '2.' && l.top < p2.lines[1].top));
});

test('zoom steps', () => {
  assert.equal(nextZoom(1, 1), 1.1);
  assert.equal(nextZoom(1, -1), 0.9);
  assert.equal(nextZoom(3, 1), 3);
  assert.equal(nextZoom(0.5, -1), 0.5);
});

test('caret geometry: columns come from the layout, parenthetical brackets are skipped, clicks map back to text', async () => {
  const { caretPlace, hitTest, verticalMove, lineEdge, selectionRects } = await import('../src/pageModel.ts');
  const doc = createDocument([
    block('Scene Heading', 'int. hall - day'),
    block('Character', 'ann'),
    block('Parenthetical', 'quietly'),
    block('Dialogue', 'It is still turning. Nobody has climbed up here in years.'),
  ]);
  const m = buildRenderModel(doc);
  // The dialogue's second line starts at "climbed" (offset 32); offset 33 is one column in.
  const second = m.editLines[m.linesOfBlock[3][1]];
  assert.equal(second.start, 32);
  const c = caretPlace(m, doc, { block: 3, offset: 33 })!;
  assert.equal(c.col, second.col + 1);
  assert.ok(Math.abs(c.left - (m.marginLeft + (second.col + 1) / 10)) < 1e-9);
  // In "(quietly)" offset 0 sits after the opening bracket.
  const p = caretPlace(m, doc, { block: 2, offset: 0 })!;
  const paren = m.editLines[m.linesOfBlock[2][0]];
  assert.equal(p.col, paren.col + 1);
  // Clicking on that line, left of the bracket, lands at the start of the stored text.
  assert.deepEqual(hitTest(m, 0, m.marginLeft + paren.col / 10, p.top + 0.01), { block: 2, offset: 0 });
  // Up from the second dialogue line keeps the column.
  const up = verticalMove(m, doc, { block: 3, offset: 33 + 5 }, -1, null)!;
  assert.deepEqual(up.pos, { block: 3, offset: 6 });
  assert.deepEqual(lineEdge(m, doc, { block: 3, offset: 5 }, 1), { block: 3, offset: 31 });
  // A selection across two lines gives one rectangle per line.
  assert.equal(selectionRects(m, { anchor: { block: 3, offset: 2 }, head: { block: 3, offset: 40 } }).length, 2);
});
