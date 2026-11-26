import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  StyleSheet,
  DEFAULT_STYLES,
  DEFAULT_SETTINGS,
  createDocument,
  block,
  parseSceneHeading,
  characterBaseName,
  sceneIndex,
} from '../src/index.ts';

test('Fade In 4.1.1 default page: 1.25" side margins, 6" text width', () => {
  const s = DEFAULT_SETTINGS;
  assert.equal(s.pageWidth, 8.5);
  assert.equal(s.pageHeight, 11);
  const width = s.pageWidth - s.marginLeft - s.marginRight;
  assert.ok(Math.abs(width - 6.0) < 0.01);
});

test('styles inherit from Normal Text and keep their own Enter/Tab behaviour', () => {
  const sheet = new StyleSheet(DEFAULT_STYLES);
  const dlg = sheet.resolve('Dialogue');
  assert.equal(dlg.font, 'Courier New');
  assert.equal(dlg.size, 12);
  assert.equal(dlg.spaceBefore, 0);
  assert.equal(dlg.enter, 'Action');
  assert.equal(dlg.tabBefore, 'Parenthetical');
  const sh = sheet.resolve('Scene Heading');
  assert.equal(sh.allCaps, true);
  assert.equal(sh.spaceBefore, 2);
  assert.equal(sh.keepWithNext, true);
  assert.equal(sh.enter, 'Action');
  // Action has no "tab after": Tab at the end of text behaves like Enter.
  assert.equal(sheet.resolve('Action').tabAfter, undefined);
});

test('element flow table matches Fade In', () => {
  const sheet = new StyleSheet(DEFAULT_STYLES);
  const flow = Object.fromEntries(
    ['Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot'].map((n) => {
      const s = sheet.resolve(n);
      return [n, [s.enter, s.tabBefore, s.tabAfter]];
    }),
  );
  assert.deepEqual(flow, {
    'Scene Heading': ['Action', undefined, 'Action'],
    Action: [undefined, 'Character', undefined],
    Character: ['Dialogue', 'Action', 'Parenthetical'],
    Parenthetical: ['Dialogue', 'Dialogue', 'Dialogue'],
    Dialogue: ['Action', 'Parenthetical', 'Parenthetical'],
    Transition: ['Scene Heading', undefined, 'Action'],
    Shot: ['Action', undefined, 'Action'],
  });
});

test('unknown style falls back to Normal Text', () => {
  const sheet = new StyleSheet(DEFAULT_STYLES);
  const s = sheet.resolve('Song Lyrics');
  assert.equal(s.leftIndent, 0);
  assert.equal(s.size, 12);
});

test('scene heading parsing keeps inner separators in the location', () => {
  const intros = ['INT.', 'EXT.', 'INT./EXT.'];
  assert.deepEqual(parseSceneHeading('int. car - outside parents house - lunch time', intros), {
    intro: 'int.',
    location: 'car - outside parents house',
    time: 'lunch time',
  });
  assert.deepEqual(parseSceneHeading('INT./EXT. VAN - NIGHT', intros), { intro: 'INT./EXT.', location: 'VAN', time: 'NIGHT' });
  assert.deepEqual(parseSceneHeading('EXT. FIELD', intros), { intro: 'EXT.', location: 'FIELD', time: '' });
});

test('character base names drop extensions', () => {
  assert.equal(characterBaseName('carol (O.S.)'), 'CAROL');
  assert.equal(characterBaseName("TOM (cont'd)"), 'TOM');
  assert.equal(characterBaseName('Mary Jane'), 'MARY JANE');
});

test('scene index lists speakers per scene', () => {
  const doc = createDocument([
    block('Scene Heading', 'INT. KITCHEN - DAY'),
    block('Character', 'ann'),
    block('Dialogue', 'Hello.'),
    block('Character', 'bob (V.O.)'),
    block('Dialogue', 'Hi.'),
    block('Character', 'Ann'),
    block('Dialogue', 'Again.'),
    block('Scene Heading', 'EXT. YARD - NIGHT'),
  ]);
  const scenes = sceneIndex(doc);
  assert.equal(scenes.length, 2);
  assert.deepEqual(scenes[0].speakers, ['ANN', 'BOB']);
  assert.deepEqual(scenes[1].speakers, []);
});
