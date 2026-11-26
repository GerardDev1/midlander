import { DEFAULT_SETTINGS, DEFAULT_STYLES, defaultLists } from './defaults.ts';
import type { Block, Run, ScreenplayDocument, StyleName } from './types.ts';

let counter = 0;
/** Short unique block id (unique within a session; not a UUID). */
export function newBlockId(): string {
  counter += 1;
  return `b${Date.now().toString(36)}${counter.toString(36)}`;
}

export function newUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID().toUpperCase();
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`.toUpperCase();
}

export function block(style: StyleName, text: string | Run[] = '', extra: Partial<Block> = {}): Block {
  const runs = typeof text === 'string' ? [{ text }] : text;
  return { id: newBlockId(), style, runs, ...extra };
}

/** A new, empty screenplay: one Scene Heading paragraph, Fade In 4.1.1 defaults. */
export function createDocument(blocks: Block[] = [block('Scene Heading')]): ScreenplayDocument {
  return {
    version: 1,
    uuid: newUuid(),
    settings: { ...DEFAULT_SETTINGS },
    styles: DEFAULT_STYLES.map((s) => ({ ...s })),
    blocks,
    titlePage: [],
    lists: defaultLists(),
  };
}

export function blockText(b: Block): string {
  return b.runs.map((r) => r.text).join('');
}
