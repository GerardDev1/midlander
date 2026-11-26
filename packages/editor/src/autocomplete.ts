/**
 * Autocomplete, as in Fade In (docs/FADE-IN-REFERENCE.md §3): context-aware
 * suggestions from the script's lists while typing scene headings, character
 * names (and their extensions) and transitions.
 *
 * Suggestions only appear with the caret at the end of the paragraph, once
 * something has been typed, and never just repeat what's already there.
 */
import { blockText, characterBaseName, parseSceneHeading } from '../../core/src/index.ts';
import { isCollapsed, type EditorState } from './state.ts';
import { knownCharacters, replaceInBlock } from './commands.ts';

export interface Suggestions {
  block: number;
  /** The part of the paragraph's text that a suggestion replaces. */
  from: number;
  to: number;
  items: string[];
  /** Text added after an accepted item (e.g. " " after INT.). */
  suffix: string;
}

const uniq = (xs: string[]) => {
  const seen = new Set<string>();
  return xs.filter((x) => {
    const k = x.toUpperCase();
    if (!x || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

function matching(list: string[], typed: string): string[] {
  const t = typed.toUpperCase();
  if (!t) return [];
  return uniq(list).filter((x) => x.toUpperCase().startsWith(t) && x.toUpperCase() !== t);
}

/** Locations from the Locations list plus every scene heading in the script. */
export function knownLocations(s: EditorState, exceptBlock = -1): string[] {
  const sep = s.doc.settings.sceneTimeSeparator || ' - ';
  const out = [...s.doc.lists.locations];
  s.doc.blocks.forEach((b, i) => {
    if (i === exceptBlock || b.style !== 'Scene Heading') return;
    const { location } = parseSceneHeading(blockText(b), s.doc.lists.sceneIntros, sep);
    if (location) out.push(location.toUpperCase());
  });
  return uniq(out).sort((a, b) => a.localeCompare(b));
}

export function suggestions(s: EditorState): Suggestions | null {
  if (!isCollapsed(s.sel)) return null;
  const { block: i, offset } = s.sel.head;
  const b = s.doc.blocks[i];
  if (!b) return null;
  const text = blockText(b);
  if (offset !== text.length || text.trim() === '' || text.includes('\n')) return null;
  const lists = s.doc.lists;
  const res = (from: number, items: string[], suffix = ''): Suggestions | null =>
    items.length ? { block: i, from, to: text.length, items, suffix } : null;

  if (b.style === 'Scene Heading') {
    const upper = text.toUpperCase();
    const intros = [...lists.sceneIntros].sort((a, z) => z.length - a.length);
    const intro = intros.find((x) => upper.startsWith(`${x.toUpperCase()} `));
    if (!intro) return res(0, matching(lists.sceneIntros, text), ' ');
    const sep = s.doc.settings.sceneTimeSeparator || ' - ';
    const sepAt = text.lastIndexOf(sep);
    if (sepAt > intro.length) {
      const from = sepAt + sep.length;
      return res(from, matching(lists.sceneTimes, text.slice(from)));
    }
    let from = intro.length;
    while (text[from] === ' ') from++;
    return res(from, matching(knownLocations(s, i), text.slice(from)), sep);
  }

  if (b.style === 'Character') {
    const paren = text.lastIndexOf('(');
    if (paren >= 0) {
      if (text.indexOf(')', paren) >= 0) return null;
      return res(paren, matching(lists.extensions, text.slice(paren)));
    }
    const names = [...knownCharacters(s, i)].sort((a, z) => a.localeCompare(z));
    const typed = characterBaseName(text);
    if (text.trimEnd() !== text) return null;
    return res(0, matching(names, typed));
  }

  if (b.style === 'Transition') return res(0, matching(lists.transitions, text));
  return null;
}

/** Replaces the typed part with the chosen suggestion. */
export function acceptSuggestion(s: EditorState, sug: Suggestions, index: number): EditorState {
  const item = sug.items[index];
  if (item === undefined) return s;
  return replaceInBlock(s, sug.block, sug.from, sug.to, item + sug.suffix);
}
