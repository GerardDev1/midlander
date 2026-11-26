/**
 * Midlander screenplay document model.
 *
 * A screenplay is an ordered list of typed paragraphs ("blocks"), each with
 * an element style (Scene Heading, Action, …) and a list of formatted text
 * runs. All lengths are in INCHES. The structure deliberately mirrors the
 * Open Screenplay Format used by .fadein files, so import/export is lossless.
 *
 * This package has no UI dependency.
 */

/** Names of the built-in element styles. Custom styles use any other name. */
export const BUILTIN_STYLES = [
  'Normal Text',
  'Scene Heading',
  'Action',
  'Character',
  'Parenthetical',
  'Dialogue',
  'Transition',
  'Shot',
] as const;

export type BuiltinStyleName = (typeof BUILTIN_STYLES)[number];
export type StyleName = BuiltinStyleName | (string & {});

export type Alignment = 'left' | 'center' | 'right';

/** A resolved or partial element style. Undefined fields inherit from `basedOn`. */
export interface ElementStyle {
  name: StyleName;
  builtin: boolean;
  basedOn?: StyleName;
  font?: string;
  /** Point size. */
  size?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  /** Blank lines before the paragraph (multiplied by settings.elementSpacing). */
  spaceBefore?: number;
  lineSpacing?: number;
  /** Indent from the left page margin, in inches. */
  leftIndent?: number;
  /** Indent from the right page margin, in inches. */
  rightIndent?: number;
  align?: Alignment;
  allCaps?: boolean;
  keepWithNext?: boolean;
  pageBreakBefore?: boolean;
  actBreak?: boolean;
  /** Style set for the next paragraph when Enter is pressed. */
  enter?: StyleName;
  /** Style applied when Tab is pressed on an empty paragraph. */
  tabBefore?: StyleName;
  /** Style applied when Tab is pressed at the end of a non-empty paragraph. */
  tabAfter?: StyleName;
}

export interface Marks {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Highlight colour, e.g. "#FFFF00". */
  highlight?: string;
}

export interface Run extends Marks {
  /** May contain "\n" for a soft return (Shift+Enter). */
  text: string;
}

/** Per-paragraph overrides of its element style. */
export interface BlockOverrides {
  align?: Alignment;
  leftIndent?: number;
  rightIndent?: number;
  keepWithNext?: boolean;
  pageBreakBefore?: boolean;
}

export interface Block {
  id: string;
  style: StyleName;
  runs: Run[];
  overrides?: BlockOverrides;
  /** Part of a dual-dialogue pair (set on the Character block). */
  dualDialogue?: boolean;
  /** Title-page bookmark (Title, Author, Contact, …) or a user bookmark name. */
  bookmark?: string;
  sceneNumber?: string;
  omitted?: boolean;
}

export interface PageSettings {
  pageWidth: number;
  pageHeight: number;
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  linesPerInch: number;
  elementSpacing: number;
  breakOnSentences: boolean;
  /** Add "(cont'd)" when a character speaks again after only action. */
  dialogueContinues: boolean;
  /** Allow dialogue to break across pages with (MORE)/(cont'd). */
  dialoguePageBreaks: boolean;
  contText: string;
  moreText: string;
  scenesContinue: boolean;
  continuedText: string;
  sceneTimeSeparator: string;
  pageHeader: string;
  pageFooter: string;
  headerAlign: Alignment;
  footerAlign: Alignment;
  headerFirstPage: boolean;
  footerFirstPage: boolean;
  pageNumberStart: number;
}

export interface CharacterEntry {
  name: string;
  gender?: 'F' | 'M' | 'T';
  retain?: boolean;
}

export interface DocumentLists {
  characters: CharacterEntry[];
  locations: string[];
  sceneIntros: string[];
  sceneTimes: string[];
  extensions: string[];
  transitions: string[];
}

export interface ScreenplayDocument {
  /** Format version of Midlander's own document model. */
  version: 1;
  uuid: string;
  settings: PageSettings;
  styles: ElementStyle[];
  blocks: Block[];
  titlePage: Block[];
  lists: DocumentLists;
  /** Anything read from another format that Midlander doesn't model yet, kept for round-tripping. */
  extra?: Record<string, unknown>;
}

/** A style with every layout-relevant field filled in. */
export interface ResolvedStyle extends Required<Omit<ElementStyle, 'basedOn' | 'enter' | 'tabBefore' | 'tabAfter' | 'color' | 'font'>> {
  basedOn?: StyleName;
  enter?: StyleName;
  tabBefore?: StyleName;
  tabAfter?: StyleName;
  font: string;
  color: string;
}
