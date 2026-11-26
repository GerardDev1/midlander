import { blockText } from './document.ts';
import type { Block, ScreenplayDocument } from './types.ts';

export interface SceneHeadingParts {
  intro: string;
  location: string;
  time: string;
}

/**
 * Splits "INT. CAR - OUTSIDE PARENTS HOUSE - LUNCH TIME" into intro, location
 * and time, the way Fade In builds its Locations list: strip the intro and
 * the final " - TIME" only.
 */
export function parseSceneHeading(text: string, intros: string[], separator = ' - '): SceneHeadingParts {
  let rest = text.trim();
  let intro = '';
  const sorted = [...intros].sort((a, b) => b.length - a.length);
  for (const i of sorted) {
    if (rest.toUpperCase().startsWith(i.toUpperCase())) {
      intro = rest.slice(0, i.length);
      rest = rest.slice(i.length).trim();
      break;
    }
  }
  let time = '';
  const idx = rest.lastIndexOf(separator);
  if (idx > 0) {
    time = rest.slice(idx + separator.length).trim();
    rest = rest.slice(0, idx).trim();
  }
  return { intro, location: rest, time };
}

/** "carol (O.S.)" → "CAROL". The name used to group a character's dialogue. */
export function characterBaseName(cue: string): string {
  return cue.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\^\s*$/, '').trim().toUpperCase();
}

export interface SceneInfo {
  index: number;
  blockIndex: number;
  heading: string;
  /** Characters with dialogue in this scene, in order of first appearance. */
  speakers: string[];
}

/** Derives the scene list (for the Navigator, reports, autocomplete). */
export function sceneIndex(doc: ScreenplayDocument): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  doc.blocks.forEach((b: Block, i: number) => {
    if (b.style === 'Scene Heading') {
      scenes.push({ index: scenes.length, blockIndex: i, heading: blockText(b), speakers: [] });
    } else if (b.style === 'Character' && scenes.length > 0) {
      const name = characterBaseName(blockText(b));
      const s = scenes[scenes.length - 1];
      if (name && !s.speakers.includes(name)) s.speakers.push(name);
    }
  });
  return scenes;
}
