/**
 * Fade In adds characters and locations to the script's lists automatically
 * as they're typed (docs/FADE-IN-REFERENCE.md §3). Midlander suggests names
 * straight from the script while you write, and records new ones in the
 * lists when the script is saved.
 */
import { blockText, characterBaseName, parseSceneHeading, type ScreenplayDocument } from '../../core/src/index.ts';

export function withScriptLists(doc: ScreenplayDocument): ScreenplayDocument {
  const chars = new Set(doc.lists.characters.map((c) => characterBaseName(c.name)));
  const locs = new Set(doc.lists.locations.map((l) => l.toUpperCase()));
  const addChars: string[] = [];
  const addLocs: string[] = [];
  const sep = doc.settings.sceneTimeSeparator || ' - ';
  for (const b of doc.blocks) {
    if (b.style === 'Character') {
      const n = characterBaseName(blockText(b));
      if (n && !chars.has(n)) {
        chars.add(n);
        addChars.push(n);
      }
    } else if (b.style === 'Scene Heading') {
      const { location } = parseSceneHeading(blockText(b), doc.lists.sceneIntros, sep);
      const key = location.toUpperCase();
      if (location && !locs.has(key)) {
        locs.add(key);
        addLocs.push(location);
      }
    }
  }
  if (!addChars.length && !addLocs.length) return doc;
  return {
    ...doc,
    lists: {
      ...doc.lists,
      characters: [...doc.lists.characters, ...addChars.map((name) => ({ name }))],
      locations: [...doc.lists.locations, ...addLocs],
    },
  };
}
