/**
 * Everything the UI needs from the desktop shell, in one place.
 *
 * Inside the Tauri app, opening and saving files, menus and the window title
 * go through the Rust side (src-tauri). In a plain browser (`npm run dev`,
 * used for development and automated tests) the same functions fall back to
 * a file input and a download, so the UI can be worked on without building
 * the desktop app.
 */
import type { ScreenplayDocument } from '../../packages/core/src/index.ts';
import { readFadeIn, readMidlander, readOsfXml, parseMidlanderJson, serializeMidlanderJson, writeMidlander } from '../../packages/formats/src/index.ts';

export type ScriptKind = 'fadein' | 'midlander' | 'new';

export interface OpenedScript {
  name: string;
  doc: ScreenplayDocument;
  kind: ScriptKind;
  /** Where the script lives on disk (desktop app only). */
  path?: string;
}

export const MENU_COMMANDS = [
  'new',
  'open',
  'close',
  'save',
  'save-as',
  'quit',
  'close-window',
  'undo',
  'redo',
  'select-all',
  'zoom-in',
  'zoom-out',
  'zoom-reset',
  'element-0',
  'element-1',
  'element-2',
  'element-3',
  'element-4',
  'element-5',
  'element-6',
  'element-7',
  'bold',
  'italic',
  'underline',
] as const;
export type MenuCommand = (typeof MENU_COMMANDS)[number];

export interface ShellHandlers {
  onOpened(script: OpenedScript): void;
  onError(message: string): void;
  onMenu(command: MenuCommand): void;
}

interface RawScript {
  name: string;
  path: string;
  kind: 'fadein' | 'midlander';
  /** Open Screenplay Format XML for .fadein, Midlander JSON for .midlander. */
  content: string;
}

export interface SavedScript {
  name: string;
  path?: string;
}

export const inDesktopApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const parse = (raw: RawScript): OpenedScript => ({
  name: raw.name,
  path: raw.path,
  kind: raw.kind,
  doc: raw.kind === 'midlander' ? parseMidlanderJson(raw.content) : readOsfXml(raw.content),
});

const SCRIPT_EXT = /\.(fadein|midlander)$/i;

/** Subscribes to shell events. Returns an unsubscribe function. */
export async function connectShell(h: ShellHandlers): Promise<() => void> {
  if (!inDesktopApp) return () => {};
  const { listen } = await import('@tauri-apps/api/event');
  const { getCurrentWebview } = await import('@tauri-apps/api/webview');
  const { invoke } = await import('@tauri-apps/api/core');

  const safely = (raw: RawScript) => {
    try {
      h.onOpened(parse(raw));
    } catch (e) {
      h.onError(`${raw.name} couldn't be read: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const offs = await Promise.all([
    listen<RawScript>('script-opened', (e) => safely(e.payload)),
    listen<string>('script-open-failed', (e) => h.onError(e.payload)),
    listen<MenuCommand>('menu', (e) => h.onMenu(e.payload)),
    getCurrentWebview().onDragDropEvent(async (e) => {
      if (e.payload.type !== 'drop') return;
      const path = e.payload.paths.find((p) => SCRIPT_EXT.test(p));
      if (!path) {
        if (e.payload.paths.length) h.onError('Midlander can open Midlander (.midlander) and Fade In (.fadein) scripts.');
        return;
      }
      try {
        safely(await invoke<RawScript>('load_script', { path }));
      } catch (err) {
        h.onError(String(err));
      }
    }),
  ]);
  return () => offs.forEach((off) => off());
}

/** Shows the Open dialog. The result arrives through onOpened. */
export async function showOpenDialog(h: ShellHandlers): Promise<void> {
  if (inDesktopApp) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_script');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.fadein,.midlander';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const midlander = /\.midlander$/i.test(file.name);
      h.onOpened({ name: file.name, kind: midlander ? 'midlander' : 'fadein', doc: midlander ? await readMidlander(bytes) : await readFadeIn(bytes) });
    } catch (e) {
      h.onError(`${file.name} couldn't be read: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  input.click();
}

/**
 * Saves as a Midlander script. With no path, asks where to save first.
 * Returns null if the person cancelled. Fade In files are never written to.
 */
export async function saveScript(doc: ScreenplayDocument, path: string | undefined, suggestedName: string): Promise<SavedScript | null> {
  if (inDesktopApp) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<SavedScript | null>('save_script', { path: path ?? null, suggestedName, json: serializeMidlanderJson(doc) });
  }
  // Browser preview: download the file.
  const bytes = await writeMidlander(doc);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { name: suggestedName };
}

export interface MenuState {
  open: boolean;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
}

let lastMenuState = '';
/** Keeps the window title and menu items (Close, Save, Undo…) in step with the UI. */
export async function updateShell(title: string, state: MenuState): Promise<void> {
  document.title = title;
  if (!inDesktopApp) return;
  const key = JSON.stringify([title, state]);
  if (key === lastMenuState) return;
  lastMenuState = key;
  const { invoke } = await import('@tauri-apps/api/core');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await Promise.all([invoke('set_menu_state', { state }), getCurrentWindow().setTitle(title)]);
}

/** Closes the app after the UI has dealt with unsaved changes. */
export async function quitApp(): Promise<void> {
  if (!inDesktopApp) return;
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('quit_app');
}
