/**
 * The page view, editable. What you type is laid out by Midlander's own
 * pagination engine on every change, so the pages you write on are the
 * printed pages: same line breaks, page breaks, (MORE) and (cont'd).
 *
 * The browser draws text where the layout says and nothing else. Keystrokes
 * arrive through a hidden text field (which also gives the system's input
 * methods and clipboard somewhere to work); the caret and selection are drawn
 * from layout positions.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  acceptSuggestion,
  currentElement,
  deleteBackward,
  deleteForward,
  deleteTo,
  enter,
  fragmentText,
  insertText,
  isCollapsed,
  moveDocument,
  moveHorizontal,
  moveParagraph,
  moveTo,
  paragraphAt,
  pasteFragment,
  pasteText,
  select,
  selectedFragment,
  setElement,
  softReturn,
  suggestions,
  tab,
  wordAt,
  type EditorState,
  type Fragment,
  type Pos,
} from '../../packages/editor/src/index.ts';
import { blockText } from '../../packages/core/src/index.ts';
import type { MenuCommand } from './bridge.ts';
import {
  buildRenderModel,
  caretPlace,
  hitTest,
  lineEdge,
  pageOf,
  selectionRects,
  verticalMove,
  type RenderModel,
  type RenderPage,
  type SelectionRect,
} from './pageModel.ts';

const PX_PER_IN = 96;
const PAGE_GAP_PX = 24;
const CLIPBOARD_TYPE = 'application/x-midlander-fragment+json';
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export type Command = MenuCommand | 'open';

/** Fade In's shortcuts for commands that also live in the menus. */
export function shortcutFor(e: { key: string; code: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, mac = isMac): Command | null {
  const mod = mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!mod) return null;
  const k = e.key.toLowerCase();
  const digit = /^Digit([0-7])$/.exec(e.code)?.[1];
  if (e.altKey) {
    if (e.shiftKey && e.code === 'Digit0') return 'zoom-reset';
    return null;
  }
  if (e.shiftKey) {
    if (k === 'z') return 'redo';
    if (k === 's') return 'save-as';
    if (k === '+' || e.code === 'Equal') return 'zoom-in';
    return null;
  }
  if (digit) return `element-${digit}` as Command;
  const plain: Record<string, Command> = {
    b: 'bold',
    i: 'italic',
    u: 'underline',
    z: 'undo',
    y: 'redo',
    a: 'select-all',
    n: 'new',
    o: 'open',
    s: 'save',
    w: 'close',
    q: 'quit',
    '=': 'zoom-in',
    '+': 'zoom-in',
    '-': 'zoom-out',
  };
  return plain[k] ?? null;
}

interface Props {
  state: EditorState;
  apply(next: EditorState): void;
  zoom: number;
  runCommand(cmd: Command, source: 'key' | 'menu' | 'ui'): void;
  onStatus(status: { page: number; element: string }): void;
  /** True while a dialog is open over the page. */
  blocked?: boolean;
}

export function ScriptEditor({ state, apply, zoom, runCommand, onStatus, blocked = false }: Props) {
  const prevModel = useRef<RenderModel | null>(null);
  const model = useMemo(() => buildRenderModel(state.doc, prevModel.current), [state.doc]);
  prevModel.current = model;
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const caretEl = useRef<HTMLDivElement>(null);
  const pageEls = useRef<(HTMLElement | null)[]>([]);
  const goalCol = useRef<number | null>(null);
  const scrollToCaret = useRef(false);
  const composing = useRef(false);
  const lastComposed = useRef<{ text: string; at: number } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const modelRef = useRef(model);
  modelRef.current = model;

  const [focused, setFocused] = useState(false);
  const [blinkKey, setBlinkKey] = useState(0);
  // Autocomplete: shown while typing; Esc hides it until the text changes (Esc again re-shows).
  const [sugOn, setSugOn] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [sugIndex, setSugIndex] = useState(0);
  const sug = useMemo(() => (sugOn && !dismissed ? suggestions(state) : null), [state, sugOn, dismissed]);
  const sugKey = sug ? `${sug.block}:${sug.from}:${sug.items.join('|')}` : '';
  useEffect(() => setSugIndex(0), [sugKey]);

  const u = PX_PER_IN * zoom;
  const caret = useMemo(() => caretPlace(model, state.doc, state.sel.head), [model, state.doc, state.sel.head]);
  const rects = useMemo(() => selectionRects(model, state.sel), [model, state.sel]);

  useEffect(() => {
    onStatus({ page: pageOf(model, state.doc, state.sel.head), element: currentElement(state) });
  }, [model, state, onStatus]);

  /** Applies an edit or caret move made from the keyboard. */
  const update = useCallback(
    (next: EditorState | null, opts: { typing?: boolean; keepGoal?: boolean } = {}) => {
      if (!opts.keepGoal) goalCol.current = null;
      if (!next) return;
      if (opts.typing) {
        setSugOn(true);
        if (next.doc.blocks !== stateRef.current.doc.blocks) setDismissed(false);
      } else setSugOn(false);
      scrollToCaret.current = true;
      setBlinkKey((k) => k + 1);
      apply(next);
    },
    [apply],
  );

  // ---- keyboard -----------------------------------------------------------

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    const s = stateRef.current;
    const m = modelRef.current;
    const cmd = shortcutFor(e.nativeEvent);
    if (cmd) {
      e.preventDefault();
      setSugOn(false);
      runCommand(cmd, 'key');
      return;
    }
    const mod = isMac ? e.metaKey : e.ctrlKey;
    const word = isMac ? e.altKey : e.ctrlKey;
    const shift = e.shiftKey;
    const handled = () => e.preventDefault();

    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight': {
        handled();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        if (isMac && e.metaKey) update(moveTo(s, lineEdge(m, s.doc, s.sel.head, dir), shift));
        else update(moveHorizontal(s, dir, word ? 'word' : 'char', shift));
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown': {
        handled();
        const dir = e.key === 'ArrowDown' ? 1 : -1;
        if (sug) {
          setSugIndex((i) => (i + dir + sug.items.length) % sug.items.length);
          return;
        }
        if (isMac && e.metaKey) return update(moveDocument(s, dir, shift));
        if (isMac && e.altKey) return update(moveParagraph(s, dir, shift));
        if (!shift && !isCollapsed(s.sel)) {
          const edge = dir > 0 ? (cmpPos(s.sel.anchor, s.sel.head) > 0 ? s.sel.anchor : s.sel.head) : cmpPos(s.sel.anchor, s.sel.head) < 0 ? s.sel.anchor : s.sel.head;
          const v = verticalMove(m, s.doc, edge, dir, goalCol.current);
          if (v) goalCol.current = v.goalCol;
          return update(v ? moveTo(s, v.pos) : null, { keepGoal: true });
        }
        const v = verticalMove(m, s.doc, s.sel.head, dir, goalCol.current);
        if (v) goalCol.current = v.goalCol;
        return update(v ? moveTo(s, v.pos, shift) : null, { keepGoal: true });
      }
      case 'PageUp':
      case 'PageDown': {
        handled();
        const dir = e.key === 'PageDown' ? 1 : -1;
        const lines = Math.max(1, Math.floor((scroller.current?.clientHeight ?? 600) / (m.lineHeight * u)) - 2);
        let p = s.sel.head;
        let g = goalCol.current;
        for (let i = 0; i < lines; i++) {
          const v = verticalMove(m, s.doc, p, dir, g);
          if (!v) break;
          p = v.pos;
          g = v.goalCol;
        }
        goalCol.current = g;
        return update(moveTo(s, p, shift), { keepGoal: true });
      }
      case 'Home':
      case 'End': {
        handled();
        const dir = e.key === 'End' ? 1 : -1;
        if (mod) return update(moveDocument(s, dir, shift));
        return update(moveTo(s, lineEdge(m, s.doc, s.sel.head, dir), shift));
      }
      case 'Backspace': {
        handled();
        if (isMac && e.metaKey) return update(deleteTo(s, lineEdge(m, s.doc, s.sel.head, -1)), { typing: true });
        return update(deleteBackward(s, word ? 'word' : 'char'), { typing: true });
      }
      case 'Delete': {
        handled();
        if (isMac && e.metaKey) return update(deleteTo(s, lineEdge(m, s.doc, s.sel.head, 1)));
        return update(deleteForward(s, word ? 'word' : 'char'));
      }
      case 'Enter': {
        handled();
        if (sug && !shift && !mod) return update(acceptSuggestion(s, sug, sugIndex), { typing: true });
        if (e.altKey) return; // Option+Enter is full screen in Fade In (comes with the interface work).
        if (mod && shift) return; // Insert Element list: not built yet.
        if (mod) return update(setElement(s, 'Scene Heading'));
        if (shift) return update(softReturn(s));
        return update(enter(s));
      }
      case 'Tab': {
        handled();
        if (sug && !shift) return update(acceptSuggestion(s, sug, sugIndex), { typing: true });
        if (shift || mod || e.altKey) return;
        return update(tab(s));
      }
      case 'Escape': {
        if (sug) {
          handled();
          setDismissed(true);
        } else if (dismissed && sugOn) {
          handled();
          setDismissed(false);
        }
        return;
      }
      case ' ': {
        // Shift+Cmd+Space: non-breaking space.
        if (mod && shift) {
          handled();
          update(insertText(s, ' '), { typing: true });
        }
        return;
      }
    }
  };

  // Typed characters arrive as "beforeinput"; the hidden field itself is never changed.
  useEffect(() => {
    const ta = input.current;
    if (!ta) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.isComposing || composing.current) return;
      if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText') {
        e.preventDefault();
        const data = e.data ?? e.dataTransfer?.getData('text/plain') ?? '';
        if (!data) return;
        // Some engines repeat a just-committed composition (e.g. Option+E, E → é) as typed text.
        const last = lastComposed.current;
        lastComposed.current = null;
        if (last && last.text === data && performance.now() - last.at < 80) return;
        let s = stateRef.current;
        // macOS press-and-hold accents replace the letter that was held down (e → é).
        if (e.inputType === 'insertReplacementText' && isCollapsed(s.sel) && s.sel.head.offset > 0) {
          const t = blockText(s.doc.blocks[s.sel.head.block]);
          const prev = t[s.sel.head.offset - 1];
          if (prev && data.normalize('NFD')[0]?.toLowerCase() === prev.normalize('NFD')[0]?.toLowerCase()) {
            s = deleteBackward(s) ?? s;
          }
        }
        update(insertText(s, data), { typing: true });
        return;
      }
      // Paste, cut and drag-and-drop are handled by their own events; everything
      // else (the field's own undo, line breaks…) is ignored.
      if (e.inputType !== 'insertFromPaste' && e.inputType !== 'deleteByCut') e.preventDefault();
    };
    ta.addEventListener('beforeinput', onBeforeInput);
    return () => ta.removeEventListener('beforeinput', onBeforeInput);
  }, [update]);

  const onCompositionStart = () => {
    composing.current = true;
  };
  const onCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composing.current = false;
    const data = e.data;
    if (input.current) input.current.value = '';
    if (data) {
      lastComposed.current = { text: data, at: performance.now() };
      update(insertText(stateRef.current, data), { typing: true });
    }
  };

  // ---- clipboard ----------------------------------------------------------

  const copyTo = (e: React.ClipboardEvent) => {
    const s = stateRef.current;
    if (isCollapsed(s.sel)) return false;
    const frag = selectedFragment(s);
    e.clipboardData.setData('text/plain', fragmentText(s, frag));
    try {
      e.clipboardData.setData(CLIPBOARD_TYPE, JSON.stringify(frag));
    } catch {
      // Some web engines refuse custom types; plain text still works.
    }
    e.preventDefault();
    return true;
  };
  const onCopy = (e: React.ClipboardEvent) => {
    copyTo(e);
  };
  const onCut = (e: React.ClipboardEvent) => {
    if (copyTo(e)) update(deleteBackward(stateRef.current));
  };
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const s = stateRef.current;
    const raw = e.clipboardData.getData(CLIPBOARD_TYPE);
    if (raw) {
      try {
        const frag = JSON.parse(raw) as Fragment[];
        if (Array.isArray(frag) && frag.every((f) => Array.isArray(f.runs))) return update(pasteFragment(s, frag));
      } catch {
        // fall back to plain text
      }
    }
    const text = e.clipboardData.getData('text/plain');
    if (text) update(pasteText(s, text));
  };

  // Keep the hidden field holding the selected text, so the system's Copy and Cut are available.
  useLayoutEffect(() => {
    const ta = input.current;
    if (!ta || composing.current) return;
    const text = isCollapsed(state.sel) ? '' : fragmentText(state, selectedFragment(state)).slice(0, 100_000);
    if (ta.value !== text) ta.value = text;
    if (document.activeElement === ta) ta.select();
  }, [state]);

  // ---- mouse --------------------------------------------------------------

  const posAtPoint = (clientX: number, clientY: number): Pos | null => {
    const m = modelRef.current;
    let best = -1;
    let bestDist = Infinity;
    pageEls.current.forEach((el, i) => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = clientY < r.top ? r.top - clientY : clientY > r.bottom ? clientY - r.bottom : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    const el = pageEls.current[best];
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const scale = r.width / m.widthIn;
    const y = Math.max(0, Math.min(r.height, clientY - r.top));
    return hitTest(m, best, (clientX - r.left) / scale, y / scale);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const sc = scroller.current;
    // Leave clicks on the scroll bar alone.
    if (sc && e.clientX >= sc.getBoundingClientRect().left + sc.clientWidth) return;
    e.preventDefault();
    input.current?.focus({ preventScroll: true });
    const p = posAtPoint(e.clientX, e.clientY);
    if (!p) return;
    const s = stateRef.current;
    goalCol.current = null;
    setSugOn(false);
    setBlinkKey((k) => k + 1);
    let anchorSel = { anchor: p, head: p };
    if (e.detail === 2) anchorSel = wordAt(s, p);
    else if (e.detail >= 3) anchorSel = paragraphAt(s, p.block);
    if (e.shiftKey) apply(moveTo(s, p, true));
    else apply(select(s, anchorSel));

    const startSel = e.shiftKey ? { anchor: s.sel.anchor, head: p } : anchorSel;
    const onMove = (ev: MouseEvent) => {
      const q = posAtPoint(ev.clientX, ev.clientY);
      const sc = scroller.current;
      if (sc) {
        const r = sc.getBoundingClientRect();
        if (ev.clientY > r.bottom - 10) sc.scrollTop += 20;
        else if (ev.clientY < r.top + 10) sc.scrollTop -= 20;
      }
      if (!q) return;
      const cur = stateRef.current;
      const before = cmpPos(q, startSel.anchor) < 0;
      const { anchor, head } = startSel;
      const [lo, hi] = cmpPos(anchor, head) <= 0 ? [anchor, head] : [head, anchor];
      apply(select(cur, before ? { anchor: hi, head: q } : { anchor: lo, head: cmpPos(q, hi) > 0 ? q : hi }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // ---- scrolling and focus -------------------------------------------------

  // Take the keyboard when the page appears and whenever a dialog over it closes.
  useLayoutEffect(() => {
    if (!blocked) input.current?.focus({ preventScroll: true });
  }, [blocked]);

  useLayoutEffect(() => {
    if (!scrollToCaret.current) return;
    scrollToCaret.current = false;
    const sc = scroller.current;
    const c = caretEl.current;
    if (!sc || !c) return;
    const r = c.getBoundingClientRect();
    const box = sc.getBoundingClientRect();
    const margin = 3 * (u / 6);
    if (r.top < box.top + margin) sc.scrollTop -= box.top + margin - r.top;
    else if (r.bottom > box.bottom - margin) sc.scrollTop += r.bottom - (box.bottom - margin);
  });

  // Keep the same page in view when zooming.
  const lastZoom = useRef(zoom);
  useEffect(() => {
    const el = scroller.current;
    if (el && lastZoom.current !== zoom) {
      el.scrollTop = el.scrollTop * (zoom / lastZoom.current);
      lastZoom.current = zoom;
    }
  }, [zoom]);

  // The hidden field follows the caret so input-method windows open in the right place.
  const [inputPos, setInputPos] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const c = caretEl.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    if (r.left !== inputPos.left || r.top !== inputPos.top) setInputPos({ left: r.left, top: r.top });
  });

  const emptyParen =
    caret && state.doc.blocks[state.sel.head.block]?.style === 'Parenthetical' && blockText(state.doc.blocks[state.sel.head.block]) === ''
      ? caret
      : null;

  const setPageEl = useCallback((i: number, el: HTMLElement | null) => {
    pageEls.current[i] = el;
  }, []);
  pageEls.current.length = model.pages.length;
  const collapsed = isCollapsed(state.sel);

  return (
    <div className="pages" ref={scroller} onMouseDown={onMouseDown}>
      {model.pages.map((p, i) => {
        const here = caret?.page === i;
        const pageRects = rects.some((r) => r.page === i) ? rects.filter((r) => r.page === i) : NO_RECTS;
        return (
          <PageView
            key={i}
            index={i}
            page={p}
            widthIn={model.widthIn}
            heightIn={model.heightIn}
            u={u}
            setEl={setPageEl}
            rects={pageRects}
            rectsKey={pageRects === NO_RECTS ? '' : JSON.stringify(pageRects)}
            caretTop={here && caret ? caret.top : -1}
            caretLeft={here && caret ? caret.left : -1}
            caretVisible={here && collapsed && focused}
            caretRef={here ? caretEl : undefined}
            blinkKey={here ? blinkKey : 0}
            focused={focused}
            parenTop={emptyParen && emptyParen.page === i ? emptyParen.top : -1}
            parenLeft={emptyParen && emptyParen.page === i ? emptyParen.left - 1 / model.cpi : -1}
          />
        );
      })}
      <textarea
        ref={input}
        className="input-sink"
        aria-label="Script text"
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{ left: inputPos.left, top: inputPos.top, fontSize: (12 / 72) * u }}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onCopy={onCopy}
        onCut={onCut}
        onPaste={onPaste}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {sug && (
        <ul className="autocomplete" role="listbox" style={{ left: inputPos.left, top: inputPos.top + u / 6 + 2 }} onMouseDown={(e) => e.stopPropagation()}>
          {sug.items.map((item, k) => (
            <li
              key={item}
              role="option"
              aria-selected={k === sugIndex}
              className={k === sugIndex ? 'selected' : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                update(acceptSuggestion(stateRef.current, sug, k), { typing: true });
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function cmpPos(a: Pos, b: Pos): number {
  return a.block - b.block || a.offset - b.offset;
}

const NO_RECTS: SelectionRect[] = [];

interface PageViewProps {
  index: number;
  page: RenderPage;
  widthIn: number;
  heightIn: number;
  u: number;
  setEl(i: number, el: HTMLElement | null): void;
  rects: SelectionRect[];
  /** Changes when the selection on this page changes (rects is a new array every time). */
  rectsKey: string;
  caretTop: number;
  caretLeft: number;
  caretVisible: boolean;
  caretRef?: React.RefObject<HTMLDivElement | null>;
  blinkKey: number;
  focused: boolean;
  parenTop: number;
  parenLeft: number;
}

/** One page. Redrawn only when its own text, caret or selection changes. */
const PageView = memo(
  function PageView(p: PageViewProps) {
    const { page, u } = p;
    const lineH = u / 6;
    return (
      <section
        ref={(el) => p.setEl(p.index, el)}
        className={page.isTitlePage ? 'page title-page' : 'page'}
        aria-label={page.label}
        style={{ width: p.widthIn * u, height: p.heightIn * u, marginBottom: PAGE_GAP_PX }}
      >
        <PageText page={page} u={u} />
        {p.rects.map((r, i) => (
          <div key={i} className={p.focused ? 'sel' : 'sel inactive'} style={{ top: r.top * u, left: r.left * u, width: Math.max(2, r.width * u), height: lineH }} />
        ))}
        {p.parenTop >= 0 && (
          <div className="line ghost" style={{ top: p.parenTop * u, left: p.parenLeft * u, fontSize: (12 / 72) * u, lineHeight: `${lineH}px` }}>
            ()
          </div>
        )}
        {p.caretTop >= 0 && (
          <div key={p.blinkKey} ref={p.caretRef} className={p.caretVisible ? 'caret' : 'caret hidden'} style={{ top: p.caretTop * u, left: p.caretLeft * u - 1, height: lineH }} />
        )}
      </section>
    );
  },
  (a, b) =>
    a.page === b.page &&
    a.u === b.u &&
    a.widthIn === b.widthIn &&
    a.heightIn === b.heightIn &&
    a.rectsKey === b.rectsKey &&
    a.caretTop === b.caretTop &&
    a.caretLeft === b.caretLeft &&
    a.caretVisible === b.caretVisible &&
    a.caretRef === b.caretRef &&
    a.blinkKey === b.blinkKey &&
    (a.rects.length === 0 || a.focused === b.focused) &&
    a.parenTop === b.parenTop &&
    a.parenLeft === b.parenLeft,
);

const PageText = memo(function PageText({ page, u }: { page: RenderPage; u: number }) {
  return (
    <>
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
          {l.segments.length === 1 && !hasMarks(l.segments[0])
            ? l.text
            : l.segments.map((s, k) => (
                <span
                  key={k}
                  style={{
                    fontWeight: s.bold ? 700 : undefined,
                    fontStyle: s.italic ? 'italic' : undefined,
                    textDecoration: [s.underline && 'underline', s.strike && 'line-through'].filter(Boolean).join(' ') || undefined,
                    background: s.highlight,
                  }}
                >
                  {s.text}
                </span>
              ))}
        </div>
      ))}
    </>
  );
});

const hasMarks = (s: { bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; highlight?: string }) =>
  !!(s.bold || s.italic || s.underline || s.strike || s.highlight);

export type { RenderModel };
