import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { connectShell, documentChanged, inDesktopApp, showOpenDialog, type MenuCommand, type OpenedScript, type ShellHandlers } from './bridge.ts';
import { buildRenderModel, nextZoom, type RenderModel, type RenderPage } from './pageModel.ts';

const PX_PER_IN = 96;
const PAGE_GAP_PX = 24;

export function App() {
  const [script, setScript] = useState<OpenedScript | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const model = useMemo<RenderModel | null>(() => (script ? buildRenderModel(script.doc) : null), [script]);

  const onMenu = useCallback((command: MenuCommand) => {
    if (command === 'close') setScript(null);
    if (command === 'zoom-in') setZoom((z) => nextZoom(z, 1));
    if (command === 'zoom-out') setZoom((z) => nextZoom(z, -1));
    if (command === 'zoom-reset') setZoom(1);
  }, []);

  const handlers = useMemo<ShellHandlers>(
    () => ({
      onOpened: (s) => {
        setError(null);
        setScript(s);
      },
      onError: setError,
      onMenu,
    }),
    [onMenu],
  );

  useEffect(() => {
    let off = () => {};
    let cancelled = false;
    connectShell(handlers).then((f) => (cancelled ? f() : (off = f)));
    return () => {
      cancelled = true;
      off();
    };
  }, [handlers]);

  useEffect(() => {
    documentChanged(script?.name ?? null).catch(() => {});
  }, [script]);

  // In the desktop app these shortcuts belong to the native menus. In a plain
  // browser there are no menus, so handle them here.
  useEffect(() => {
    if (inDesktopApp) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const map: Record<string, MenuCommand> = { '=': 'zoom-in', '+': 'zoom-in', '-': 'zoom-out', '0': 'zoom-reset', w: 'close' };
      if (e.key === 'o') {
        e.preventDefault();
        showOpenDialog(handlers);
      } else if (map[e.key]) {
        e.preventDefault();
        onMenu(map[e.key]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handlers, onMenu]);

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
      {model && script ? (
        <ScriptView model={model} zoom={zoom} />
      ) : (
        <StartScreen onOpen={() => showOpenDialog(handlers)} />
      )}
    </div>
  );
}

function StartScreen({ onOpen }: { onOpen: () => void }) {
  return (
    <main className="start">
      <h1>Midlander</h1>
      <p className="lede">Open a Fade In script to see it laid out page by page.</p>
      <button type="button" className="primary" onClick={onOpen} autoFocus>
        Open Script…
      </button>
      <p className="hint">{inDesktopApp ? 'You can also drag a .fadein file onto this window.' : 'Development preview in a browser.'}</p>
      <p className="note">This early build shows scripts read-only. Writing and editing come in the next phase.</p>
    </main>
  );
}

function ScriptView({ model, zoom }: { model: RenderModel; zoom: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);
  const pagePx = model.heightIn * PX_PER_IN * zoom + PAGE_GAP_PX;

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const middle = el.scrollTop + el.clientHeight / 2 - PAGE_GAP_PX;
    setCurrent(Math.min(model.pages.length - 1, Math.max(0, Math.floor(middle / pagePx))));
  };

  // Keep the same page in view when zooming.
  const lastZoom = useRef(zoom);
  useEffect(() => {
    const el = scroller.current;
    if (el && lastZoom.current !== zoom) {
      el.scrollTop = el.scrollTop * (zoom / lastZoom.current);
      lastZoom.current = zoom;
    }
  }, [zoom]);

  const page = model.pages[current];
  return (
    <>
      <div className="pages" ref={scroller} onScroll={onScroll}>
        {model.pages.map((p, i) => (
          <Page key={i} page={p} model={model} zoom={zoom} />
        ))}
      </div>
      <footer className="status">
        <span>{page?.label}</span>
        <span>
          {model.scriptPageCount} {model.scriptPageCount === 1 ? 'page' : 'pages'} · {model.sceneCount}{' '}
          {model.sceneCount === 1 ? 'scene' : 'scenes'}
        </span>
        <span>Read-only · {Math.round(zoom * 100)}%</span>
      </footer>
    </>
  );
}

function Page({ page, model, zoom }: { page: RenderPage; model: RenderModel; zoom: number }) {
  const u = PX_PER_IN * zoom;
  return (
    <section
      className="page"
      aria-label={page.label}
      style={{ width: model.widthIn * u, height: model.heightIn * u, marginBottom: PAGE_GAP_PX }}
    >
      {page.lines.map((l, i) => (
        <div
          key={i}
          className="line"
          style={{
            top: l.top * u,
            left: l.left * u,
            fontFamily: `"${l.font}", "Courier Prime", Courier, monospace`,
            fontSize: (l.size / 72) * u,
            lineHeight: `${(1 / 6) * u}px`,
            fontWeight: l.bold ? 700 : 400,
            fontStyle: l.italic ? 'italic' : 'normal',
            textDecoration: l.underline ? 'underline' : 'none',
          }}
        >
          {l.text}
        </div>
      ))}
    </section>
  );
}
