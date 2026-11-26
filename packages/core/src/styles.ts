import { DEFAULT_FONT } from './defaults.ts';
import type { Block, ElementStyle, ResolvedStyle, StyleName } from './types.ts';

const BASE: ResolvedStyle = {
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
};

/**
 * Resolves styles through their `basedOn` chain. Unknown style names fall
 * back to Normal Text so a document with a missing style still lays out.
 */
export class StyleSheet {
  private readonly byName = new Map<string, ElementStyle>();
  private readonly cache = new Map<string, ResolvedStyle>();

  constructor(styles: ElementStyle[]) {
    for (const s of styles) this.byName.set(s.name, s);
  }

  has(name: StyleName): boolean {
    return this.byName.has(name);
  }

  resolve(name: StyleName): ResolvedStyle {
    const hit = this.cache.get(name);
    if (hit) return hit;
    const chain: ElementStyle[] = [];
    const seen = new Set<string>();
    let cur = this.byName.get(name);
    while (cur && !seen.has(cur.name)) {
      seen.add(cur.name);
      chain.unshift(cur);
      cur = cur.basedOn ? this.byName.get(cur.basedOn) : undefined;
    }
    const out: ResolvedStyle = { ...BASE, name, builtin: chain.at(-1)?.builtin ?? false };
    for (const s of chain) {
      for (const [k, v] of Object.entries(s)) {
        if (v !== undefined && k !== 'name' && k !== 'builtin') (out as unknown as Record<string, unknown>)[k] = v;
      }
    }
    // Enter/Tab behaviour is not inherited: it belongs to the style itself.
    const own = this.byName.get(name);
    out.enter = own?.enter;
    out.tabBefore = own?.tabBefore;
    out.tabAfter = own?.tabAfter;
    out.basedOn = own?.basedOn;
    this.cache.set(name, out);
    return out;
  }

  /** The block's style with its per-paragraph overrides applied. */
  forBlock(block: Block): ResolvedStyle {
    const base = this.resolve(block.style);
    const o = block.overrides;
    if (!o) return base;
    return {
      ...base,
      align: o.align ?? base.align,
      leftIndent: o.leftIndent ?? base.leftIndent,
      rightIndent: o.rightIndent ?? base.rightIndent,
      keepWithNext: o.keepWithNext ?? base.keepWithNext,
      pageBreakBefore: o.pageBreakBefore ?? base.pageBreakBefore,
    };
  }
}
