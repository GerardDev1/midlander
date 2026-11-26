/**
 * Midlander's own file format (.midlander): a zip containing document.json,
 * the document model as JSON with a format marker and version (spec §5.6).
 * The desktop app writes the zip in Rust; these functions are shared by the
 * app, the browser preview and tests.
 */
import { DEFAULT_SETTINGS, DEFAULT_STYLES, defaultLists, newUuid, type ScreenplayDocument } from '../../core/src/index.ts';
import { readZip, writeZip } from './zip.ts';

export const MIDLANDER_FORMAT = 'midlander';
export const MIDLANDER_FORMAT_VERSION = 1;

export function serializeMidlanderJson(doc: ScreenplayDocument): string {
  return JSON.stringify({ format: MIDLANDER_FORMAT, formatVersion: MIDLANDER_FORMAT_VERSION, document: doc }, null, 1);
}

export function parseMidlanderJson(json: string): ScreenplayDocument {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('the file is damaged (its contents are not valid)');
  }
  const d = data as { format?: string; formatVersion?: number; document?: Partial<ScreenplayDocument> };
  if (d?.format !== MIDLANDER_FORMAT || !d.document) throw new Error("it isn't a Midlander script");
  if ((d.formatVersion ?? 0) > MIDLANDER_FORMAT_VERSION) {
    throw new Error('it was saved by a newer version of Midlander. Please update Midlander to open it');
  }
  const doc = d.document;
  if (!Array.isArray(doc.blocks)) throw new Error('the file is damaged (no script text)');
  const blocks = doc.blocks
    .filter((b) => b && typeof b.style === 'string' && Array.isArray(b.runs))
    .map((b, i) => ({ ...b, id: typeof b.id === 'string' ? b.id : `b${i}`, runs: b.runs.length ? b.runs : [{ text: '' }] }));
  return {
    version: 1,
    uuid: doc.uuid ?? newUuid(),
    settings: { ...DEFAULT_SETTINGS, ...(doc.settings ?? {}) },
    styles: Array.isArray(doc.styles) && doc.styles.length ? doc.styles : DEFAULT_STYLES.map((s) => ({ ...s })),
    blocks,
    titlePage: Array.isArray(doc.titlePage) ? doc.titlePage : [],
    lists: { ...defaultLists(), ...(doc.lists ?? {}) },
    ...(doc.extra ? { extra: doc.extra } : {}),
  };
}

export async function writeMidlander(doc: ScreenplayDocument): Promise<Uint8Array> {
  return writeZip([{ name: 'document.json', data: new TextEncoder().encode(serializeMidlanderJson(doc)) }]);
}

export async function readMidlander(bytes: Uint8Array): Promise<ScreenplayDocument> {
  const entries = await readZip(bytes);
  const e = entries.find((x) => x.name === 'document.json');
  if (!e) throw new Error("it isn't a Midlander script");
  return parseMidlanderJson(new TextDecoder().decode(e.data));
}
