/**
 * Reader for Fade In documents (.fadein): a zip containing document.xml in
 * Open Screenplay Format. Handles format version 41 (Fade In 4.x, `basestyle`)
 * and version 20 (older, `basestylename`). See docs/FADE-IN-REFERENCE.md §8.
 */
import {
  DEFAULT_LISTS,
  DEFAULT_SETTINGS,
  DEFAULT_STYLES,
  defaultLists,
  newBlockId,
  newUuid,
  type Alignment,
  type Block,
  type BlockOverrides,
  type CharacterEntry,
  type DocumentLists,
  type ElementStyle,
  type PageSettings,
  type Run,
  type ScreenplayDocument,
} from '../../core/src/index.ts';
import { readZip } from './zip.ts';
import { child, childrenNamed, parseXml, textOf, type XmlElement } from './xml.ts';

/** Fade In lengths are tenths of a millimetre. */
const len = (v: string | undefined): number | undefined => (v === undefined || v === '' ? undefined : Number(v) / 254);
const num = (v: string | undefined): number | undefined => (v === undefined || v === '' ? undefined : Number(v));
const bool = (v: string | undefined): boolean | undefined =>
  v === undefined || v === '' ? undefined : v === '1' || v.toLowerCase() === 'true';
const align = (v: string | undefined): Alignment | undefined => {
  switch (v?.toLowerCase()) {
    case 'left':
    case '1':
      return 'left';
    case 'center':
    case 'centre':
    case '2':
      return 'center';
    case 'right':
    case '3':
      return 'right';
    default:
      return undefined;
  }
};

export async function readFadeIn(bytes: Uint8Array): Promise<ScreenplayDocument> {
  const entries = await readZip(bytes);
  const xmlEntry = entries.find((e) => e.name === 'document.xml') ?? entries.find((e) => e.name.endsWith('.xml'));
  if (!xmlEntry) throw new Error('This .fadein file has no document.xml inside');
  return readOsfXml(new TextDecoder().decode(xmlEntry.data));
}

/** Parses Open Screenplay Format XML (also used for Fade In's "XML (OSF)" export). */
export function readOsfXml(xml: string): ScreenplayDocument {
  const root = parseXml(xml);
  if (root.name !== 'document') throw new Error(`Not an Open Screenplay Format document (root <${root.name}>)`);
  const version = Number(root.attrs.version ?? '0');
  const info = child(root, 'info');
  const settings = readSettings(child(root, 'settings'));
  const styles = readStyles(child(root, 'styles'));
  const blocks = childrenNamed(child(root, 'paragraphs'), 'para').map(readPara);
  const titlePage = childrenNamed(child(root, 'titlepage'), 'para').map(readPara);
  const lists = readLists(child(root, 'lists'));
  return {
    version: 1,
    uuid: info?.attrs.uuid ?? newUuid(),
    settings,
    styles,
    blocks,
    titlePage,
    lists,
    extra: {
      fadein: {
        osfVersion: version,
        savedWith: child(root, 'fadein_settings')?.attrs.saved_with,
        settingsAttrs: { ...(child(root, 'settings')?.attrs ?? {}) },
      },
    },
  };
}

function readSettings(el: XmlElement | undefined): PageSettings {
  const a = el?.attrs ?? {};
  const d = DEFAULT_SETTINGS;
  return {
    pageWidth: len(a.page_width) ?? d.pageWidth,
    pageHeight: len(a.page_height) ?? d.pageHeight,
    marginTop: len(a.margin_top) ?? d.marginTop,
    marginBottom: len(a.margin_bottom) ?? d.marginBottom,
    marginLeft: len(a.margin_left) ?? d.marginLeft,
    marginRight: len(a.margin_right) ?? d.marginRight,
    linesPerInch: num(a.normal_linesperinch) ?? d.linesPerInch,
    elementSpacing: num(a.element_spacing) ?? d.elementSpacing,
    breakOnSentences: bool(a.break_on_sentences) ?? d.breakOnSentences,
    dialogueContinues: bool(a.dialogue_continues) ?? d.dialogueContinues,
    dialoguePageBreaks: bool(a.dialogue_pagebreaks) ?? d.dialoguePageBreaks,
    contText: a.cont_text ?? d.contText,
    moreText: a.more_text ?? d.moreText,
    scenesContinue: bool(a.scenes_continue) ?? d.scenesContinue,
    continuedText: a.continued_text ?? d.continuedText,
    sceneTimeSeparator: a.scene_time_separator ?? d.sceneTimeSeparator,
    pageHeader: a.page_header ?? d.pageHeader,
    pageFooter: a.page_footer ?? d.pageFooter,
    headerAlign: align(a.header_alignment) ?? d.headerAlign,
    footerAlign: align(a.footer_alignment) ?? d.footerAlign,
    headerFirstPage: bool(a.header_first_page) ?? d.headerFirstPage,
    footerFirstPage: bool(a.footer_first_page) ?? d.footerFirstPage,
    pageNumberStart: num(a.pagenumber_start) ?? d.pageNumberStart,
  };
}

function readStyles(el: XmlElement | undefined): ElementStyle[] {
  const out: ElementStyle[] = [];
  for (const s of childrenNamed(el, 'style')) {
    const a = s.attrs;
    if (!a.name) continue;
    const style: ElementStyle = {
      name: a.name,
      builtin: a.builtin === '1',
      basedOn: a.basestyle ?? a.basestylename,
      font: a.font,
      size: num(a.size),
      bold: bool(a.bold),
      italic: bool(a.italic),
      underline: bool(a.underline),
      color: a.color,
      spaceBefore: num(a.spacebefore),
      lineSpacing: num(a.linespacing),
      leftIndent: len(a.leftindent),
      rightIndent: len(a.rightindent),
      align: align(a.align),
      allCaps: bool(a.allcaps),
      keepWithNext: bool(a.keepwithnext),
      pageBreakBefore: bool(a.pagebreakbefore),
      actBreak: bool(a.actbreak),
      enter: a.style_enter,
      tabBefore: a.style_tab_before,
      tabAfter: a.style_tab_after,
    };
    // Built-in styles are always based on Normal Text, even if the file omits it.
    if (style.name !== 'Normal Text' && !style.basedOn) style.basedOn = 'Normal Text';
    for (const k of Object.keys(style) as (keyof ElementStyle)[]) if (style[k] === undefined) delete style[k];
    out.push(style);
  }
  // Make sure every built-in style exists.
  for (const d of DEFAULT_STYLES) if (!out.some((s) => s.name === d.name)) out.push({ ...d });
  return out;
}

function readPara(p: XmlElement): Block {
  const st = child(p, 'style');
  const sa = st?.attrs ?? {};
  const runs: Run[] = childrenNamed(p, 'text').map((t) => {
    const r: Run = { text: textOf(t) };
    const a = t.attrs;
    if (bool(a.bold)) r.bold = true;
    if (bool(a.italic)) r.italic = true;
    if (bool(a.underline)) r.underline = true;
    if (bool(a.strikeout) || bool(a.strikethrough) || bool(a.strike)) r.strike = true;
    if (a.highlight || a.bgcolor) r.highlight = a.highlight ?? a.bgcolor;
    return r;
  });
  if (runs.length === 0) runs.push({ text: '' });
  const overrides: BlockOverrides = {};
  const al = align(sa.align);
  if (al) overrides.align = al;
  if (sa.leftindent) overrides.leftIndent = len(sa.leftindent);
  if (sa.rightindent) overrides.rightIndent = len(sa.rightindent);
  if (sa.keepwithnext) overrides.keepWithNext = bool(sa.keepwithnext);
  if (sa.pagebreakbefore) overrides.pageBreakBefore = bool(sa.pagebreakbefore);
  const b: Block = {
    id: newBlockId(),
    style: sa.basestyle ?? sa.basestylename ?? 'Normal Text',
    runs,
  };
  if (Object.keys(overrides).length) b.overrides = overrides;
  if (bool(sa.dualdialogue)) b.dualDialogue = true;
  if (p.attrs.bookmark) b.bookmark = p.attrs.bookmark;
  if (p.attrs.number) b.sceneNumber = p.attrs.number;
  return b;
}

function readLists(el: XmlElement | undefined): DocumentLists {
  if (!el) return defaultLists();
  const names = (tag: string, item: string, fallback: string[]): string[] => {
    const group = child(el, tag);
    if (!group) return [...fallback];
    return childrenNamed(group, item)
      .map((i) => i.attrs.name ?? textOf(i))
      .filter(Boolean);
  };
  const characters: CharacterEntry[] = childrenNamed(child(el, 'characters'), 'character').map((c) => {
    const e: CharacterEntry = { name: c.attrs.name ?? textOf(c) };
    const g = c.attrs.gender?.toUpperCase();
    if (g === 'F' || g === 'M' || g === 'T') e.gender = g;
    if (bool(c.attrs.retain)) e.retain = true;
    return e;
  });
  return {
    characters,
    locations: names('locations', 'location', []),
    sceneIntros: names('scene_intros', 'scene_intro', DEFAULT_LISTS.sceneIntros),
    sceneTimes: names('scene_times', 'scene_time', DEFAULT_LISTS.sceneTimes),
    extensions: names('extensions', 'extension', DEFAULT_LISTS.extensions),
    transitions: names('transitions', 'transition', DEFAULT_LISTS.transitions),
  };
}
