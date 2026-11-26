/**
 * Turns a ScreenplayDocument into what the page view draws: pages of lines
 * with positions in inches. All positions come from Midlander's own layout
 * engine (packages/layout); the webview only places text where it is told.
 *
 * Kept free of React and Tauri so it can be tested with `node --test`.
 */
import { StyleSheet, sceneIndex, type ScreenplayDocument } from '../../packages/core/src/index.ts';
import { layoutDocument, type LayoutLine } from '../../packages/layout/src/index.ts';

export interface RenderLine {
  /** Distance from the top of the page, in inches (top of the line box). */
  top: number;
  /** Distance from the left edge of the page, in inches. */
  left: number;
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  font: string;
  /** Point size. */
  size: number;
}

export interface RenderPage {
  label: string;
  isTitlePage: boolean;
  lines: RenderLine[];
}

export interface RenderModel {
  widthIn: number;
  heightIn: number;
  pages: RenderPage[];
  /** Pages excluding the title page. */
  scriptPageCount: number;
  sceneCount: number;
}

export function buildRenderModel(doc: ScreenplayDocument): RenderModel {
  const s = doc.settings;
  const layout = layoutDocument(doc);
  const sheet = new StyleSheet(doc.styles);
  const lineHeight = 1 / s.linesPerInch;

  const placeLine = (l: LayoutLine): RenderLine => {
    // Header/footer and continuation lines are plain body text; everything
    // else uses the element style it was laid out with.
    const style = l.style && l.kind === 'text' ? sheet.resolve(l.style) : sheet.resolve('Normal Text');
    return {
      top: s.marginTop + (l.line - 1) * lineHeight,
      left: s.marginLeft + l.col / layout.cpi,
      text: l.text,
      bold: style.bold,
      italic: style.italic,
      underline: style.underline,
      font: style.font,
      size: style.size,
    };
  };

  const pages = layout.pages.map((p, i): RenderPage => ({
    label: p.isTitlePage ? 'Title page' : `Page ${p.number ?? i + 1}`,
    isTitlePage: p.isTitlePage,
    lines: p.lines.filter((l) => l.text !== '').map(placeLine),
  }));

  return {
    widthIn: s.pageWidth,
    heightIn: s.pageHeight,
    pages,
    scriptPageCount: pages.filter((p) => !p.isTitlePage).length,
    sceneCount: sceneIndex(doc).length,
  };
}

/** Zoom steps offered by View > Zoom In / Zoom Out. */
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];

export function nextZoom(current: number, direction: 1 | -1): number {
  if (direction > 0) return ZOOM_STEPS.find((z) => z > current + 1e-9) ?? current;
  return [...ZOOM_STEPS].reverse().find((z) => z < current - 1e-9) ?? current;
}
