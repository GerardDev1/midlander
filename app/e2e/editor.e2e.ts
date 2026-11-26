/**
 * Keyboard and mouse tests of the editor, run in a real browser (Google
 * Chrome) against the development build. Each test runs twice: once as a Mac
 * (Cmd and Option shortcuts) and once as Windows/Linux (Ctrl).
 *
 *   npm run test:e2e
 *
 * Skipped if Google Chrome isn't installed.
 */
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import { writeZip } from '../../packages/formats/src/index.ts';

const appDir = fileURLToPath(new URL('..', import.meta.url));

let server: ViteDevServer;
let browser: Browser | null = null;
let url = '';

before(async () => {
  server = await createServer({ configFile: join(appDir, 'vite.config.ts'), root: appDir, server: { port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const addr = server.httpServer!.address();
  url = `http://localhost:${typeof addr === 'object' && addr ? addr.port : 1420}`;
  try {
    browser = await chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
  } catch {
    browser = null;
  }
});

after(async () => {
  await browser?.close();
  await server?.close();
});

interface Block {
  style: string;
  runs: { text: string; bold?: boolean }[];
}

async function open(platform: 'mac' | 'pc'): Promise<Page> {
  const ctx = await browser!.newContext({ viewport: { width: 1000, height: 900 }, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: url });
  if (platform === 'mac') await ctx.addInitScript(() => Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' }));
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as Page & { errors: string[] }).errors = errors;
  await page.goto(url);
  return page;
}

const focused = (page: Page) => page.waitForFunction(() => document.activeElement?.classList.contains('input-sink'));

async function newScript(page: Page) {
  await page.getByRole('button', { name: 'New Script' }).click();
  await page.waitForSelector('.page');
  await focused(page);
}

const blocks = (page: Page) =>
  page.evaluate(() => {
    const m = (window as unknown as { __midlander: { editor: { doc: { blocks: Block[] } } } }).__midlander;
    return m.editor.doc.blocks.map((b) => ({ style: b.style, runs: b.runs }));
  });
const shape = async (page: Page) => (await blocks(page)).map((b) => `${b.style}: ${b.runs.map((r) => r.text).join('')}`);
const pageText = (page: Page) => page.locator('.page .line').allInnerTexts();

/** Clicks just after the given character of the first line containing `text`. */
async function clickAfterChar(page: Page, text: string, chars: number, shift = false) {
  const line = page.locator('.page .line', { hasText: text }).first();
  await line.scrollIntoViewIfNeeded();
  const box = (await line.boundingBox())!;
  const lineText = await line.innerText();
  const charW = box.width / lineText.length;
  const start = lineText.indexOf(text);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(box.x + (start + chars) * charW + charW * 0.1, box.y + box.height / 2);
  if (shift) await page.keyboard.up('Shift');
}

for (const platform of ['mac', 'pc'] as const) {
  const mod = platform === 'mac' ? 'Meta' : 'Control';
  const word = platform === 'mac' ? 'Alt' : 'Control';
  // Copy and paste come from the system's Edit menu on a Mac; in this Linux test browser they are on Ctrl.
  const clip = 'Control';

  describe(`editor (${platform === 'mac' ? 'Mac' : 'Windows/Linux'} keys)`, () => {
    test('writing a scene the Fade In way: Enter/Tab flow, capitals, brackets, autocomplete, (cont\'d)', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      const k = page.keyboard;
      await k.type('int. lighthouse - night');
      await k.press('Enter');
      await k.type('Rain hammers the glass.');
      await k.press('Enter');
      await k.press('Tab');
      await k.type('mara');
      await k.press('Tab');
      await k.type('whispering');
      await k.press('Enter');
      await k.type('Still turning.');
      await k.press('Enter');
      await k.type('She waits.');
      await k.press('Enter');
      await k.press('Tab');
      await k.type('m');
      assert.deepEqual(await page.locator('.autocomplete li').allInnerTexts(), ['MARA']);
      await k.press('Enter'); // accept MARA
      await k.press('Enter'); // → Dialogue
      await k.type('Who lit it?');
      await k.press('Enter');
      await k.type('CUT TO:');
      await k.press('Enter');
      await k.type('ext. cliff - ');
      await k.type('d');
      assert.deepEqual(await page.locator('.autocomplete li').allInnerTexts(), ['DAY']);
      await k.press('Tab');

      assert.deepEqual(await shape(page), [
        'Scene Heading: int. lighthouse - night',
        'Action: Rain hammers the glass.',
        'Character: mara',
        'Parenthetical: whispering',
        'Dialogue: Still turning.',
        'Action: She waits.',
        'Character: MARA',
        'Dialogue: Who lit it?',
        'Transition: CUT TO:',
        'Scene Heading: ext. cliff - DAY',
      ]);
      const text = await pageText(page);
      for (const l of ['INT. LIGHTHOUSE - NIGHT', 'MARA', '(whispering)', "MARA (cont'd)", 'CUT TO:', 'EXT. CLIFF - DAY']) {
        assert.ok(text.includes(l), `page shows ${l}`);
      }
      assert.equal(await page.locator('.status').innerText().then((s) => s.includes('Scene Heading')), true);
      assert.deepEqual((page as Page & { errors: string[] }).errors, []);
      await page.context().close();
    });

    test('mouse: click places the caret, double-click selects a word, drag selects, shift-click extends', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      await page.keyboard.type('int. hall - day');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Rain hammers the glass.');

      await clickAfterChar(page, 'Rain hammers', 4);
      await page.keyboard.type('X');
      assert.equal((await shape(page))[1], 'Action: RainX hammers the glass.');

      const line = page.locator('.page .line', { hasText: 'RainX' }).first();
      const box = (await line.boundingBox())!;
      const charW = box.width / (await line.innerText()).length;
      await page.mouse.dblclick(box.x + charW * 8, box.y + box.height / 2);
      await page.keyboard.type('pounds');
      assert.equal((await shape(page))[1], 'Action: RainX pounds the glass.');

      // Drag from "the" to the end of the line, then delete.
      const b2 = (await line.boundingBox())!;
      const w2 = b2.width / (await line.innerText()).length;
      await page.mouse.move(b2.x + w2 * 13.1, b2.y + b2.height / 2);
      await page.mouse.down();
      await page.mouse.move(b2.x + w2 * 30, b2.y + b2.height / 2, { steps: 4 });
      await page.mouse.up();
      await page.keyboard.press('Backspace');
      assert.equal((await shape(page))[1], 'Action: RainX pounds ');

      // Shift-click extends from the caret.
      await clickAfterChar(page, 'RainX', 0);
      await clickAfterChar(page, 'RainX', 5, true);
      await page.keyboard.type('Hail');
      assert.equal((await shape(page))[1], 'Action: Hail pounds ');
      await page.context().close();
    });

    test('keyboard: arrows across wrapped lines, word and line movement, deleting, selection', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      const k = page.keyboard;
      await k.press(`${mod}+3`);
      await k.type('ANNA');
      await k.press('Enter');
      // Wraps after "has" (35-character dialogue lines).
      await k.type('It is still turning. Nobody has climbed up here in years.');
      // Up from the end of the second line lands on the first line at the same column.
      await k.press('ArrowUp');
      await k.type('#');
      const d = (await shape(page))[1];
      assert.equal(d, 'Dialogue: It is still turning. Nobo#dy has climbed up here in years.');
      await k.press('Backspace');

      // Line start/end.
      if (platform === 'mac') await k.press('Meta+ArrowLeft');
      else await k.press('Home');
      await k.type('[');
      if (platform === 'mac') await k.press('Meta+ArrowRight');
      else await k.press('End');
      await k.type(']');
      assert.equal((await shape(page))[1], 'Dialogue: [It is still turning. Nobody has] climbed up here in years.');

      // Word delete (takes the punctuation with the word, as macOS does), word movement and shift-selection.
      await k.press(`${word}+Backspace`);
      assert.equal((await shape(page))[1], 'Dialogue: [It is still turning. Nobody  climbed up here in years.');
      await k.press(`${word}+ArrowLeft`);
      await k.press(`Shift+${word}+ArrowRight`);
      await k.type('Someone');
      assert.equal((await shape(page))[1], 'Dialogue: [It is still turning. Someone  climbed up here in years.');

      // Down past the last line goes to the end; Backspace at the start of a paragraph joins it to the one above.
      await k.press('ArrowUp');
      await k.press('ArrowUp');
      await k.press('ArrowDown');
      if (platform === 'mac') await k.press('Meta+ArrowLeft');
      else await k.press('Home');
      assert.deepEqual(await page.evaluate(() => (window as unknown as { __midlander: { editor: { sel: { head: unknown } } } }).__midlander.editor.sel.head), { block: 1, offset: 0 });
      await k.press('Backspace');
      assert.deepEqual(await shape(page), ['Character: ANNA[It is still turning. Someone  climbed up here in years.']);
      await page.context().close();
    });

    test('undo and redo, element shortcuts, bold', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      const k = page.keyboard;
      await k.press(`${mod}+2`);
      await k.type('Hello there');
      await k.press('Enter');
      await k.type('World');
      await k.press(`${mod}+z`);
      assert.deepEqual(await shape(page), ['Action: Hello there', 'Action: ']);
      await k.press(`${mod}+z`);
      await k.press(`${mod}+z`);
      assert.deepEqual(await shape(page), ['Action: ']);
      await k.press(`${mod}+Shift+z`);
      await k.press(platform === 'mac' ? 'Meta+Shift+z' : 'Control+y');
      assert.deepEqual(await shape(page), ['Action: Hello there', 'Action: ']);

      await k.press('ArrowUp');
      await k.press(`${mod}+1`);
      assert.deepEqual((await shape(page))[0], 'Scene Heading: Hello there');
      assert.ok((await pageText(page)).includes('HELLO THERE'));
      await k.press(`${mod}+2`);

      // Select "there" and make it bold.
      await k.press(platform === 'mac' ? 'Meta+ArrowRight' : 'End');
      await k.press(`Shift+${word}+ArrowLeft`);
      await k.press(`${mod}+b`);
      const b = await blocks(page);
      assert.deepEqual(b[0].runs, [{ text: 'Hello ' }, { text: 'there', bold: true }]);
      const weight = await page.locator('.page .line span', { hasText: 'there' }).evaluate((el) => getComputedStyle(el).fontWeight);
      assert.equal(weight, '700');
      await page.context().close();
    });

    test('copy and paste keep elements; plain text pastes as paragraphs', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      const k = page.keyboard;
      await k.press(`${mod}+3`);
      await k.type('ANNA');
      await k.press('Enter');
      await k.type('Hi.');
      await k.press(`${mod}+a`);
      await k.press(`${clip}+c`);
      await k.press(platform === 'mac' ? 'Meta+ArrowDown' : 'Control+End');
      await k.press('Enter');
      await k.press('Enter');
      await k.press(`${clip}+v`);
      assert.deepEqual(await shape(page), ['Character: ANNA', 'Dialogue: Hi.', 'Action: ', 'Character: ANNA', 'Dialogue: Hi.']);
      assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'ANNA\nHi.');

      await page.evaluate(() => navigator.clipboard.writeText('One.\nTwo.'));
      await k.press('Enter');
      await k.press('Enter');
      await k.press(`${clip}+v`);
      assert.deepEqual((await shape(page)).slice(-2), ['Action: One.', 'Action: Two.']);
      await page.context().close();
    });

    test('live pagination: dialogue running off the page gets (MORE) and a continued cue', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      const k = page.keyboard;
      await k.type('int. hall - day');
      await k.press('Enter');
      const filler = Array.from({ length: 24 }, (_, i) => `Line ${i + 1}.`).join('\n');
      await page.evaluate((t) => navigator.clipboard.writeText(t), filler);
      await k.press(`${clip}+v`);
      await k.press('Enter');
      await k.press('Tab');
      await k.type('BEN');
      await k.press('Enter');
      await k.type('One more thing. '.repeat(30));
      await page.waitForTimeout(50);
      assert.equal(await page.locator('section.page').count(), 2);
      const text = await pageText(page);
      assert.ok(text.includes('(MORE)'));
      assert.ok(text.includes("BEN (cont'd)"));
      assert.ok(text.includes('2.'));
      // The caret follows onto page 2.
      assert.ok((await page.locator('.status').innerText()).includes('Page 2'));
      await page.context().close();
    });

    test('unsaved changes: New asks first; Save downloads a .midlander that opens again', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      await page.keyboard.type('int. hall - day');
      await page.keyboard.press(`${mod}+n`);
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Cancel' }).click();
      assert.deepEqual(await shape(page), ['Scene Heading: int. hall - day']);

      const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press(`${mod}+s`)]);
      assert.equal(download.suggestedFilename(), 'Untitled.midlander');
      const dir = mkdtempSync(join(tmpdir(), 'midlander-e2e-'));
      const saved = join(dir, 'Saved.midlander');
      await download.saveAs(saved);
      assert.ok(!(await page.locator('.status').innerText()).includes('Edited'));

      await page.keyboard.press(`${mod}+n`);
      assert.equal(await page.getByRole('alertdialog').count(), 0, 'no question once saved');
      assert.deepEqual(await shape(page), ['Scene Heading: ']);

      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press(`${mod}+o`)]);
      await chooser.setFiles(saved);
      await page.waitForFunction(() => (window as unknown as { __midlander: { file: { name: string } } }).__midlander.file?.name === 'Saved.midlander');
      assert.deepEqual(await shape(page), ['Scene Heading: int. hall - day']);

      // Opening another script with unsaved changes asks once, after the file is picked.
      await focused(page);
      await page.keyboard.press(platform === 'mac' ? 'Meta+ArrowDown' : 'Control+End');
      await page.keyboard.type('!');
      const [again] = await Promise.all([page.waitForEvent('filechooser'), page.keyboard.press(`${mod}+o`)]);
      assert.equal(await page.getByRole('alertdialog').count(), 0);
      await again.setFiles(saved);
      await page.getByRole('alertdialog').waitFor();
      await page.getByRole('button', { name: 'Don’t Save' }).click();
      await focused(page);
      assert.deepEqual(await shape(page), ['Scene Heading: int. hall - day']);
      await page.keyboard.type('x');
      assert.deepEqual(await shape(page), ['Scene Heading: xint. hall - day']);
      await page.context().close();
    });

    test('accents: composed characters are typed once; press-and-hold replaces the held letter', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const page = await open(platform);
      await newScript(page);
      await page.keyboard.press(`${mod}+2`);
      await page.keyboard.type('caf');
      // Option+E, E on a Mac: a composition that commits "é", which some engines then repeat as typed text.
      await page.evaluate(() => {
        const ta = document.querySelector('.input-sink')!;
        ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
        ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'é' }));
        ta.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: 'é' }));
      });
      await page.keyboard.type(' ole');
      // Holding E and picking é from the accent menu.
      await page.evaluate(() => {
        const ta = document.querySelector('.input-sink')!;
        ta.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertReplacementText', data: 'é' }));
      });
      assert.deepEqual(await shape(page), ['Action: café olé']);
      await page.context().close();
    });

    test('a Fade In script opens for editing; the title page stays as it is', async (t) => {
      if (!browser) return t.skip('Google Chrome is not installed');
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<document type="Open Screenplay Format document" version="41">
  <info uuid="E2E"/>
  <paragraphs>
    <para><style basestyle="Scene Heading"/><text>ext. pier - dawn</text></para>
    <para><style basestyle="Action"/><text>Gulls argue over a </text><text bold="1">chip</text><text>.</text></para>
  </paragraphs>
  <titlepage><para bookmark="Title"><style basestyle="Normal Text" align="center"/><text>THE PIER</text></para></titlepage>
</document>`;
      const dir = mkdtempSync(join(tmpdir(), 'midlander-e2e-'));
      const fadein = join(dir, 'Pier.fadein');
      writeFileSync(fadein, await writeZip([{ name: 'document.xml', data: new TextEncoder().encode(xml) }]));
      const page = await open(platform);
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open Script…' }).click()]);
      await chooser.setFiles(fadein);
      await page.waitForSelector('.page');
      await focused(page);
      assert.equal(await page.locator('section.page').count(), 2);
      const weight = await page.locator('.page .line span', { hasText: 'chip' }).evaluate((el) => getComputedStyle(el).fontWeight);
      assert.equal(weight, '700', 'inline bold from the file is drawn');
      await clickAfterChar(page, 'Gulls', 5);
      await page.keyboard.type(' still');
      assert.equal((await shape(page))[1], 'Action: Gulls still argue over a chip.');
      // Saving never writes the Fade In file: it suggests a new Midlander file.
      const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press(`${mod}+s`)]);
      assert.equal(download.suggestedFilename(), 'Pier.midlander');
      assert.equal(readFileSync(fadein).length > 0, true);
      await page.context().close();
    });
  });
}
