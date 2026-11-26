# 0003: Editor: Midlander's own editor on top of its own page layout, not ProseMirror

Date: 2026-11-26 · Status: accepted (replaces the editor choice in spec §5.2)

## Context

The spec (§5.2) planned a ProseMirror editor with a screenplay schema. Building Phase 3 showed a conflict with the spec's own core rule (§1.3, §5.3): page breaks are calculated by Midlander's layout engine, never by the browser, and "the editor *is* the page view".

ProseMirror edits through the browser's `contenteditable`, which wraps lines with the browser's own text layout. To show Fade In-accurate pages while typing, every line break, page break, (MORE) and (cont'd) would have to be forced onto that browser layout and kept in step with it. The two would disagree whenever the browser wrapped a line differently from the layout engine, and WebKit on macOS and WebView2 on Windows wrap differently.

## Decision

1. **The editor draws the layout engine's output and nothing else.** Every keystroke updates the document model and re-runs the pagination engine; the page view shows exactly the lines it produces. What you write on is the printed page.
2. **Screenplay text is monospaced, so the caret needs no text measurement.** A position is a paragraph and an offset; the layout says which line and column that offset sits on (`app/src/pageModel.ts`). Clicks, Up/Down, line start/end and selection highlights are all worked out from columns.
3. **Editing logic lives in `packages/editor`** (pure TypeScript, no browser code, unit-tested): typing, deleting, Enter/Tab element flow, element changes, bold/italic/underline, undo/redo, clipboard fragments, auto-detection and autocomplete. The React component only turns keys and clicks into these commands.
4. **Keystrokes arrive through a hidden text field** that sits at the caret. It gives the system's input methods (accents, dead keys, other alphabets) and the clipboard somewhere to work. Its contents are never shown; typed text is taken from `beforeinput` and composition events.
5. **Undo history stores whole paragraph arrays.** Paragraphs are never changed in place, so a step costs one array copy. Typing a run of text is one undo step; moving the caret starts a new one. Each step remembers the selection before and after it.
6. **Shortcuts can arrive twice** (from the key press and from the native menu item with the same accelerator, depending on the platform). Commands run once: a repeat of the same command from the other source within 150 ms is ignored.
7. **Saving uses Midlander's own format (`.midlander`, spec §5.6).** Fade In scripts are only ever read: the first save of a script opened from a .fadein file always asks for a new .midlander file, and the Rust side refuses to write to any path that isn't a .midlander file. Saves go to a temporary file first and are then renamed into place.
8. **Performance:** layout results are cached per paragraph (paragraph objects are immutable), and pages whose lines didn't change keep their objects, so React only redraws changed pages. A 200-page script takes about 30 ms per keystroke in the production build; a typical feature-length script is faster.

## Consequences

- No ProseMirror dependency. Cursor movement, selection and clipboard are Midlander's own code, covered by unit tests (`packages/editor/test`, `app/test`) and browser tests that run with both Mac and Windows key bindings (`app/e2e`).
- Input methods work through the hidden field, but the not-yet-committed part of a composition (e.g. the accent after Option+E, before the letter) isn't drawn on the page until it's committed.
- Right-to-left text and proportional fonts aren't supported by this design. Neither is part of screenplay formatting.
- If the layout gets slow on very long scripts, the next step is incremental pagination from the edited page onwards (spec §5.10).
