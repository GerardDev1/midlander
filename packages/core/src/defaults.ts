import type { DocumentLists, ElementStyle, PageSettings } from './types.ts';

/**
 * Defaults matching a new screenplay in Fade In 4.1.1 (see docs/FADE-IN-REFERENCE.md §2).
 * Fade In stores tenths of a millimetre; these are the same values in inches.
 */
const mm10 = (tenthsOfMm: number): number => tenthsOfMm / 254;

export const DEFAULT_SETTINGS: PageSettings = {
  pageWidth: mm10(2159), // 8.5"
  pageHeight: mm10(2794), // 11"
  marginTop: mm10(266),
  marginBottom: mm10(228),
  marginLeft: mm10(317),
  marginRight: mm10(317),
  linesPerInch: 6,
  elementSpacing: 1,
  breakOnSentences: true,
  dialogueContinues: true,
  dialoguePageBreaks: true,
  contText: "(cont'd)",
  moreText: '(MORE)',
  scenesContinue: false,
  continuedText: 'CONTINUED',
  sceneTimeSeparator: ' - ',
  pageHeader: '#.',
  pageFooter: '',
  headerAlign: 'right',
  footerAlign: 'right',
  headerFirstPage: false,
  footerFirstPage: false,
  pageNumberStart: 1,
};

export const DEFAULT_FONT = 'Courier New';

export const DEFAULT_STYLES: ElementStyle[] = [
  {
    name: 'Normal Text',
    builtin: true,
    font: DEFAULT_FONT,
    size: 12,
    bold: false,
    italic: false,
    underline: false,
    color: '#000000',
    spaceBefore: 0,
    lineSpacing: 1,
    leftIndent: 0,
    rightIndent: 0,
    align: 'left',
    allCaps: false,
    keepWithNext: false,
    pageBreakBefore: false,
    actBreak: false,
  },
  {
    name: 'Scene Heading',
    builtin: true,
    basedOn: 'Normal Text',
    spaceBefore: 2,
    keepWithNext: true,
    allCaps: true,
    enter: 'Action',
    tabAfter: 'Action',
  },
  {
    name: 'Action',
    builtin: true,
    basedOn: 'Normal Text',
    spaceBefore: 1,
    tabBefore: 'Character',
  },
  {
    name: 'Character',
    builtin: true,
    basedOn: 'Normal Text',
    spaceBefore: 1,
    keepWithNext: true,
    allCaps: true,
    leftIndent: mm10(635),
    enter: 'Dialogue',
    tabBefore: 'Action',
    tabAfter: 'Parenthetical',
  },
  {
    name: 'Parenthetical',
    builtin: true,
    basedOn: 'Normal Text',
    keepWithNext: true,
    leftIndent: mm10(508),
    rightIndent: mm10(508),
    enter: 'Dialogue',
    tabBefore: 'Dialogue',
    tabAfter: 'Dialogue',
  },
  {
    name: 'Dialogue',
    builtin: true,
    basedOn: 'Normal Text',
    leftIndent: mm10(330),
    rightIndent: mm10(254),
    enter: 'Action',
    tabBefore: 'Parenthetical',
    tabAfter: 'Parenthetical',
  },
  {
    name: 'Transition',
    builtin: true,
    basedOn: 'Normal Text',
    spaceBefore: 1,
    align: 'right',
    allCaps: true,
    leftIndent: mm10(1016),
    rightIndent: mm10(127),
    enter: 'Scene Heading',
    tabAfter: 'Action',
  },
  {
    name: 'Shot',
    builtin: true,
    basedOn: 'Normal Text',
    spaceBefore: 1,
    keepWithNext: true,
    allCaps: true,
    enter: 'Action',
    tabAfter: 'Action',
  },
];

/** Standard industry list entries (equivalent to a new Fade In script). */
export const DEFAULT_LISTS: DocumentLists = {
  characters: [],
  locations: [],
  sceneIntros: ['INT.', 'EXT.', 'INT./EXT.'],
  sceneTimes: ['DAY', 'NIGHT', 'MORNING', 'AFTERNOON', 'EVENING', 'LATER', 'MOMENTS LATER', 'CONTINUOUS', 'THE NEXT DAY'],
  extensions: ['(V.O.)', '(O.S.)', '(O.C.)', '(SUBTITLE)'],
  transitions: ['CUT TO:', 'FADE IN:', 'FADE OUT', 'FADE TO:', 'DISSOLVE TO:', 'BACK TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'FADE TO BLACK'],
};

/** A fresh copy of the default lists. (Plain copying: structuredClone needs Safari 15.4, newer than early macOS 12.) */
export function defaultLists(): DocumentLists {
  return {
    characters: [],
    locations: [],
    sceneIntros: [...DEFAULT_LISTS.sceneIntros],
    sceneTimes: [...DEFAULT_LISTS.sceneTimes],
    extensions: [...DEFAULT_LISTS.extensions],
    transitions: [...DEFAULT_LISTS.transitions],
  };
}
