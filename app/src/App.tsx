import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDocument } from '../../packages/core/src/index.ts';
import {
  createEditorState,
  isDirty,
  redo,
  selectAll,
  setElement,
  toggleMark,
  undo,
  withScriptLists,
  type EditorState,
} from '../../packages/editor/src/index.ts';
import {
  connectShell,
  inDesktopApp,
  quitApp,
  saveScript,
  showOpenDialog,
  updateShell,
  type MenuCommand,
  type OpenedScript,
  type ScriptKind,
  type ShellHandlers,
} from './bridge.ts';
import { nextZoom } from './pageModel.ts';
import { ScriptEditor, shortcutFor, type Command } from './ScriptEditor.tsx';

/** Cmd+0…7, in Fade In's order. */
const ELEMENTS = ['Normal Text', 'Scene Heading', 'Action', 'Character', 'Parenthetical', 'Dialogue', 'Transition', 'Shot'];

interface FileInfo {
  name: string;
  kind: ScriptKind;
  path?: string;
}

interface Prompt {
  name: string;
  /** What to do once changes are saved or discarded. */
  then(): void;
}

const baseName = (name: string) => name.replace(/\.(fadein|midlander)$/i, '');

export function App() {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [status, setStatus] = useState({ page: 0, element: '' });

  // Menu events and shortcuts read the latest state through refs.
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const fileRef = useRef(file);
  fileRef.current = file;
  const promptRef = useRef(prompt);
  promptRef.current = prompt;

  const dirty = editor ? isDirty(editor) : false;

  // Each script opened gets a fresh page view (scrolled to the top, keyboard focus on the page).
  const [loadId, setLoadId] = useState(0);
  const load = useCallback((s: OpenedScript) => {
    setError(null);
    setFile({ name: s.name, kind: s.kind, path: s.path });
    setEditor(createEditorState(s.doc));
    setLoadId((n) => n + 1);
  }, []);

  /** Runs `then` straight away, or after asking about unsaved changes. */
  const whenSafe = useCallback((then: () => void) => {
    const ed = editorRef.current;
    if (ed && isDirty(ed)) setPrompt({ name: fileRef.current?.name ?? 'Untitled', then });
    else then();
  }, []);

  const save = useCallback(async (as: boolean): Promise<boolean> => {
    const ed = editorRef.current;
    const f = fileRef.current;
    if (!ed || !f) return false;
    const doc = withScriptLists(ed.doc);
    // Fade In scripts are never overwritten: the first save always asks for a new Midlander file.
    const path = !as && f.kind === 'midlander' ? f.path : undefined;
    try {
      const saved = await saveScript(doc, path, `${baseName(f.name)}.midlander`);
      if (!saved) return false;
      setFile({ name: saved.name, kind: 'midlander', path: saved.path });
      // If more was typed while saving, those changes stay unsaved.
      setEditor((cur) => (cur ? { ...cur, doc: { ...cur.doc, lists: doc.lists }, savedBlocks: doc.blocks, lastEdit: null } : cur));
      return true;
    } catch (e) {
      setError(`The script couldn't be saved: ${e instanceof Error ? e.message : String(e)}`);
      return false;
    }
  }, []);

  const handlersRef = useRef<ShellHandlers | null>(null);

  const lastRun = useRef<{ cmd: Command; at: number; source: string } | null>(null);
  const runCommand = useCallback(
    (cmd: Command, source: 'key' | 'menu' | 'ui') => {
      // A shortcut can reach us twice for one key press (from the keyboard and
      // from its menu item, a few milliseconds apart); act once.
      const now = Date.now();
      const last = lastRun.current;
      if (source !== 'ui' && last && last.cmd === cmd && last.source !== source && now - last.at < 150) {
        lastRun.current = null;
        return;
      }
      lastRun.current = source === 'ui' ? null : { cmd, at: now, source };
      if (promptRef.current) return;

      const edit = (f: (s: EditorState) => EditorState | null) =>
        setEditor((cur) => {
          if (!cur) return cur;
          return f(cur) ?? cur;
        });

      switch (cmd) {
        case 'new':
          return whenSafe(() => load({ name: 'Untitled', kind: 'new', doc: createDocument() }));
        case 'open':
          // Unsaved changes are asked about once a script has been picked (see onOpened).
          if (handlersRef.current) void showOpenDialog(handlersRef.current);
          return;
        case 'close':
          if (!editorRef.current) return;
          return whenSafe(() => {
            setEditor(null);
            setFile(null);
          });
        case 'save':
        case 'save-as':
          void save(cmd === 'save-as');
          return;
        case 'quit':
        case 'close-window':
          return whenSafe(() => void quitApp());
        case 'zoom-in':
          return setZoom((z) => nextZoom(z, 1));
        case 'zoom-out':
          return setZoom((z) => nextZoom(z, -1));
        case 'zoom-reset':
          return setZoom(1);
        case 'undo':
          return edit(undo);
        case 'redo':
          return edit(redo);
        case 'select-all':
          return edit(selectAll);
        case 'bold':
        case 'italic':
        case 'underline':
          return edit((s) => toggleMark(s, cmd));
        default:
          if (cmd.startsWith('element-')) {
            const style = ELEMENTS[Number(cmd.slice(8))];
            if (style) edit((s) => setElement(s, style));
          }
      }
    },
    [load, save, whenSafe],
  );

  const handlers = useMemo<ShellHandlers>(
    () => ({
      onOpened: (s) => whenSafe(() => load(s)),
      onError: setError,
      onMenu: (c: MenuCommand) => runCommand(c, 'menu'),
    }),
    [load, runCommand, whenSafe],
  );
  handlersRef.current = handlers;

  useEffect(() => {
    let off = () => {};
    let cancelled = false;
    connectShell(handlers).then((f) => (cancelled ? f() : (off = f)));
    return () => {
      cancelled = true;
      off();
    };
  }, [handlers]);

  const title = file ? `${file.name}${dirty ? ' — Edited' : ''} – Midlander` : 'Midlander';
  useEffect(() => {
    updateShell(title, { open: !!editor, dirty, canUndo: !!editor?.undo.length, canRedo: !!editor?.redo.length }).catch(() => {});
  }, [title, editor, dirty]);

  // Shortcuts when the page view doesn't have the keyboard (start screen, browser preview).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.classList?.contains('input-sink')) return;
      const cmd = shortcutFor(e);
      if (!cmd) return;
      e.preventDefault();
      runCommand(cmd, 'key');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runCommand]);

  // Browser preview: warn before leaving with unsaved changes.
  useEffect(() => {
    if (inDesktopApp || !dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const apply = useCallback((next: EditorState) => setEditor(next), []);

  // Development builds expose the editor state to the automated UI tests (app/e2e).
  useEffect(() => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) (window as unknown as Record<string, unknown>).__midlander = { editor, file };
  }, [editor, file]);

  const answer = async (choice: 'save' | 'discard' | 'cancel') => {
    const p = promptRef.current;
    setPrompt(null);
    if (!p || choice === 'cancel') return;
    if (choice === 'save' && !(await save(false))) return;
    p.then();
  };

  const pageLabel = status.page;
  return (
    <div className="shell">
      {error && (
        <div className="banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
      {editor && file ? (
        <>
          <ScriptEditor key={loadId} state={editor} apply={apply} zoom={zoom} runCommand={runCommand} onStatus={setStatus} blocked={!!prompt} />
          <StatusBar editor={editor} page={pageLabel} element={status.element} zoom={zoom} dirty={dirty} />
        </>
      ) : (
        <StartScreen onNew={() => runCommand('new', 'ui')} onOpen={() => runCommand('open', 'ui')} />
      )}
      {prompt && <SavePrompt name={prompt.name} onAnswer={answer} />}
    </div>
  );
}

function StatusBar({ editor, page, element, zoom, dirty }: { editor: EditorState; page: number; element: string; zoom: number; dirty: boolean }) {
  // Counted from the same layout the editor shows (cheap: the editor has already laid it out).
  const counts = useMemo(() => {
    let scenes = 0;
    for (const b of editor.doc.blocks) if (b.style === 'Scene Heading') scenes++;
    return { scenes, hasTitle: editor.doc.titlePage.some((b) => b.runs.some((r) => r.text.trim())) };
  }, [editor.doc]);
  const pageNo = counts.hasTitle ? page : page + 1;
  return (
    <footer className="status">
      <span>{pageNo === 0 ? 'Title page' : `Page ${pageNo}`}</span>
      <span>{element === 'Normal Text' ? 'Unformatted Text' : element}</span>
      <span>
        {counts.scenes} {counts.scenes === 1 ? 'scene' : 'scenes'}
      </span>
      <span>
        {dirty ? 'Edited · ' : ''}
        {Math.round(zoom * 100)}%
      </span>
    </footer>
  );
}

function StartScreen({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  return (
    <main className="start">
      <h1>Midlander</h1>
      <p className="lede">Write a new screenplay, or open one you already have.</p>
      <div className="actions">
        <button type="button" className="primary" onClick={onNew} autoFocus>
          New Script
        </button>
        <button type="button" className="secondary" onClick={onOpen}>
          Open Script…
        </button>
      </div>
      <p className="hint">
        Opens Midlander (.midlander) and Fade In (.fadein) scripts.
        {inDesktopApp ? ' You can also drag one onto this window.' : ' (Development preview in a browser.)'}
      </p>
    </main>
  );
}

function SavePrompt({ name, onAnswer }: { name: string; onAnswer(choice: 'save' | 'discard' | 'cancel'): void }) {
  const saveBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => saveBtn.current?.focus(), []);
  const onKey = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') onAnswer('cancel');
    else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      onAnswer('discard');
    }
  };
  return (
    <div className="modal-backdrop" onKeyDown={onKey}>
      <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="save-q">
        <p id="save-q" className="modal-title">
          Do you want to save the changes you made to “{name}”?
        </p>
        <p className="modal-body">Your changes will be lost if you don’t save them.</p>
        <div className="modal-buttons">
          <button type="button" className="secondary" onClick={() => onAnswer('discard')}>
            Don’t Save
          </button>
          <span className="spacer" />
          <button type="button" className="secondary" onClick={() => onAnswer('cancel')}>
            Cancel
          </button>
          <button type="button" className="primary" ref={saveBtn} onClick={() => onAnswer('save')}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
