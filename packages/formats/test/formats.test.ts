import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseXml, serializeXml, textOf, child, readZip, writeZip, crc32, readFadeIn, readOsfXml } from '../src/index.ts';
import { StyleSheet, blockText } from '../../core/src/index.ts';

test('xml: attributes, entities, text, self-closing, comments', () => {
  const el = parseXml(
    `<?xml version="1.0"?>\n<!-- c --><a x="1 &amp; 2" y='q'><b/><c>Tom &amp; Jerry&#39;s &lt;3</c><![CDATA[<raw>]]></a>`,
  );
  assert.equal(el.name, 'a');
  assert.deepEqual(el.attrs, { x: '1 & 2', y: 'q' });
  assert.equal(textOf(child(el, 'c')), "Tom & Jerry's <3");
  assert.ok(el.children.includes('<raw>'));
  const again = parseXml(serializeXml(el));
  assert.deepEqual(again.attrs, el.attrs);
  assert.equal(textOf(child(again, 'c')), "Tom & Jerry's <3");
});

test('xml: keeps whitespace and newlines inside text', () => {
  const el = parseXml('<t><text>Draft\ninformation  </text></t>');
  assert.equal(textOf(child(el, 'text')), 'Draft\ninformation  ');
});

test('zip: write then read round-trips, CRC is standard', async () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const data = new TextEncoder().encode('<document>hello hello hello hello</document>');
  const zip = await writeZip([{ name: 'document.xml', data }]);
  const back = await readZip(zip);
  assert.equal(back.length, 1);
  assert.equal(back[0].name, 'document.xml');
  assert.deepEqual(back[0].data, data);
});

// A small original OSF document in the v41 shape (basestyle) with one v20-style paragraph.
const OSF = `<?xml version="1.0" encoding="UTF-8"?>
<document type="Open Screenplay Format document" version="41">
  <info uuid="ABC" pagecount="1"/>
  <settings page_width="2159" page_height="2794" margin_top="266" margin_bottom="228" margin_left="317" margin_right="317"
    normal_linesperinch="6.0" element_spacing="1.00" break_on_sentences="true" cont_text="(cont'd)" more_text="(MORE)"
    page_header="#." header_alignment="3" header_first_page="false"/>
  <styles>
    <style name="Normal Text" builtin="1" font="Courier New" size="12"/>
    <style name="Scene Heading" builtin="1" basestyle="Normal Text" style_enter="Action" bold="1" spacebefore="2.0" keepwithnext="1" allcaps="1"/>
    <style name="Character" builtin="1" basestyle="Normal Text" style_enter="Dialogue" leftindent="635" allcaps="1"/>
    <style name="Dialogue" builtin="1" basestyle="Normal Text" leftindent="330" rightindent="254"/>
    <style name="Song" basestylename="Dialogue" italic="1"/>
  </styles>
  <paragraphs>
    <para><style basestyle="Scene Heading"/><text>int. lighthouse - night</text></para>
    <para><style basestyle="Action"/><text>The lamp turns. </text><text italic="1">Slowly.</text></para>
    <para><style basestyle="Character" dualdialogue="1"/><text>keeper (V.O.)</text></para>
    <para><style basestyle="Parenthetical"/><text>quietly</text></para>
    <para><style basestylename="Song" align="center"/><text>Row, row.</text></para>
  </paragraphs>
  <titlepage>
    <para bookmark="Title"><style basestyle="Normal Text" align="center"/><text underline="1">THE LAMP</text></para>
    <para><style basestyle="Normal Text"/><text>Contact
line two</text></para>
  </titlepage>
  <lists>
    <characters><character name="keeper"/><character name="Ada" gender="F"/></characters>
    <locations><location name="lighthouse"/></locations>
    <scene_intros><scene_intro name="INT."/><scene_intro name="EXT."/></scene_intros>
  </lists>
</document>`;

test('fadein: reads settings, styles, paragraphs, runs, title page, lists', () => {
  const doc = readOsfXml(OSF);
  assert.equal(doc.uuid, 'ABC');
  assert.ok(Math.abs(doc.settings.marginTop - 1.0472) < 0.001);
  assert.equal(doc.settings.headerAlign, 'right');
  assert.equal(doc.settings.headerFirstPage, false);
  assert.equal(doc.blocks.length, 5);
  assert.equal(doc.blocks[0].style, 'Scene Heading');
  assert.equal(blockText(doc.blocks[0]), 'int. lighthouse - night');
  assert.deepEqual(doc.blocks[1].runs, [{ text: 'The lamp turns. ' }, { text: 'Slowly.', italic: true }]);
  assert.equal(doc.blocks[2].dualDialogue, true);
  assert.equal(doc.blocks[4].style, 'Song');
  assert.equal(doc.blocks[4].overrides?.align, 'center');
  const sheet = new StyleSheet(doc.styles);
  assert.ok(Math.abs(sheet.resolve('Character').leftIndent - 2.5) < 0.001);
  assert.equal(sheet.resolve('Scene Heading').bold, true);
  const song = sheet.resolve('Song');
  assert.equal(song.italic, true);
  assert.ok(Math.abs(song.leftIndent - 1.2992) < 0.001, 'inherits Dialogue indent');
  // Built-in styles missing from the file are filled in.
  assert.ok(sheet.has('Transition'));
  assert.equal(doc.titlePage[0].bookmark, 'Title');
  assert.equal(blockText(doc.titlePage[1]), 'Contact\nline two');
  assert.deepEqual(doc.lists.characters, [{ name: 'keeper' }, { name: 'Ada', gender: 'F' }]);
  assert.deepEqual(doc.lists.sceneIntros, ['INT.', 'EXT.']);
  assert.ok(doc.lists.transitions.includes('CUT TO:'), 'missing lists get defaults');
});

test('fadein: reads a zipped .fadein', async () => {
  const zip = await writeZip([{ name: 'document.xml', data: new TextEncoder().encode(OSF) }]);
  const doc = await readFadeIn(zip);
  assert.equal(doc.blocks.length, 5);
});

// Gerard's own Fade In files are private and never committed. If present
// locally (MIDLANDER_PRIVATE=/path/to/folder), check they parse.
const priv = process.env.MIDLANDER_PRIVATE;
test('fadein: private Fade In 4.1.1 samples parse', { skip: !priv || !existsSync(priv) }, async () => {
  for (const f of ['gerard-sample.fadein', 'v3.fadein']) {
    const p = join(priv!, f);
    if (!existsSync(p)) continue;
    const doc = await readFadeIn(new Uint8Array(readFileSync(p)));
    assert.ok(doc.blocks.length > 50, `${f}: paragraphs read`);
    assert.equal(doc.blocks[0].style, 'Scene Heading');
    assert.equal((doc.extra?.fadein as { osfVersion: number }).osfVersion, 41);
  }
});

test('.midlander round trip keeps paragraphs, formatting, styles and lists', async () => {
  const { createDocument, block } = await import('../../core/src/index.ts');
  const { writeMidlander, readMidlander, parseMidlanderJson } = await import('../src/index.ts');
  const doc = createDocument([block('Scene Heading', 'int. shed - night'), block('Action', [{ text: 'A ' }, { text: 'loud', bold: true }, { text: ' bang.' }])]);
  doc.lists.characters.push({ name: 'MARA', gender: 'F' });
  const back = await readMidlander(await writeMidlander(doc));
  assert.deepEqual(back, doc);
  assert.throws(() => parseMidlanderJson('{"format":"other"}'), /isn't a Midlander script/);
  assert.throws(() => parseMidlanderJson('{"format":"midlander","formatVersion":99,"document":{"blocks":[]}}'), /newer version/);
});
