/**
 * Everything the UI needs from the desktop shell, in one place.
 *
 * Inside the Tauri app, opening files, menus and the window title go through
 * the Rust side (src-tauri). In a plain browser (`npm run dev`, used for
 * development and screenshots) the same functions fall back to a file input,
 * so the UI can be worked on without building the desktop app.
 */
import type { ScreenplayDocument } from '../../packages/core/src/index.ts';
import { readFadeIn, readOsfXml } from '../../packages/formats/src/index.ts';

export interface OpenedScript {
  name: string;
  doc: ScreenplayDocument;
}

export type MenuCommand = 'close' | 'zoom-in' | 'zoom-out' | 'zoom-reset';

export interface ShellHandlers {
  onOpened(script: OpenedScript): void;
  onError(message: string): void;
  onMenu(command: MenuCommand): void;
}

interface RawScript {
  name: string;
  xml: string;
}

export const inDesktopApp = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const parse = (raw: RawScript): OpenedScript => ({ name: raw.name, doc: readOsfXml(raw.xml) });

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
      const path = e.payload.paths.find((p) => p.toLowerCase().endsWith('.fadein'));
      if (!path) {
        if (e.payload.paths.length) h.onError('Midlander can open Fade In scripts (.fadein) so far.');
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

/** Shows the Open dialog. In the desktop app the result arrives through onOpened. */
export async function showOpenDialog(h: ShellHandlers): Promise<void> {
  if (inDesktopApp) {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_script');
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.fadein';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      h.onOpened({ name: file.name, doc: await readFadeIn(new Uint8Array(await file.arrayBuffer())) });
    } catch (e) {
      h.onError(`${file.name} couldn't be read: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  input.click();
}

/** Keeps the window title and the File > Close menu item in step with the UI. */
export async function documentChanged(name: string | null): Promise<void> {
  document.title = name ? `${name} – Midlander` : 'Midlander';
  if (!inDesktopApp) return;
  const { invoke } = await import('@tauri-apps/api/core');
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await Promise.all([invoke('set_document_open', { open: name !== null }), getCurrentWindow().setTitle(document.title)]);
}
