# Midlander — feature status

Running list of completed, partial and planned work. Updated at the end of every development session.

Legend: ✅ done and tested · 🟡 partial (see notes) · ⬜ planned · ❌ out of scope

## Phase 1 — Research & spec ✅

Spec approved (PR #1). Reference notes, keymap and layout measurements: `FADE-IN-REFERENCE.md`, `SHORTCUTS.md`.

## Phase 2 — Architecture & core engine ✅

Confirmed by Gerard on 2026-11-26: the Mac build launches on macOS 12 and opens his .fadein script.

| Item | Status | Notes |
|---|---|---|
| Monorepo skeleton, TypeScript, tests | ✅ | No external runtime dependencies in the packages; `npm test` runs the unit tests with Node 22+ |
| Document model (`packages/core`) | ✅ | Blocks, runs, styles with inheritance, page settings, lists, Fade In 4.1.1 defaults |
| Element flow table (Enter / Tab) | ✅ | Data only; keyboard handling comes with the editor |
| Scene index (scenes, speakers) | ✅ | Feeds the Navigator and reports later |
| Zip and XML (`packages/formats`) | ✅ | Own implementations; read and write zip |
| **.fadein import** | ✅ | OSF v41 (Fade In 4.x) and v20; styles, settings, paragraphs, inline formatting, title page, lists, dual-dialogue flag |
| .fadein export | ⬜ | Phase 5 |
| Fountain / FDX import & export | ⬜ | |
| **Layout engine** (`packages/layout`) | 🟡 | See below |
| Layout comparison tool | ✅ | `tools/compare-layout.ts` + `tools/extract-pdf-lines.py` |
| Tauri app shell (`app/`) | ✅ | Opens .fadein scripts read-only and shows them page by page with Midlander's own layout; title page; status bar (page, page count, scenes, zoom); drag and drop; clear error messages. Confirmed working on Gerard's Mac (macOS 12) |
| Native menus | ✅ | File (Open, Close), Edit (Copy, Select All), View (Zoom In/Out/100%), macOS app and Window menus. Only working items are shown |
| CI: tests on every push | ✅ | `.github/workflows/ci.yml`: unit tests, type check, web build, browser tests, Rust tests |
| CI: downloadable builds | ✅ | `.github/workflows/build-app.yml`: universal macOS .dmg (macOS 12+) and Windows installer |

### Layout engine: verified against Fade In

Gerard's three private samples, compared line by line (line number, column and text) with PDFs from Fade In 4.1.1:

| Sample | Result |
|---|---|
| 5-page script | ✅ all 6 pages identical |
| + dialogue split with (MORE) | ✅ all 6 pages identical |
| + 18-line action split, dual dialogue test | 🟡 6 of 7 pages identical; the page with dual dialogue differs (dual dialogue not implemented yet) |

Implemented: word wrap; element indents and widths; spacing (none at the top of a page); 54-line pages; keep-with-next; sentence-based splitting of dialogue and action; (MORE); continued cue `NAME (cont'd)` above line 1; automatic `(cont'd)`; parenthetical brackets; right-aligned transitions; `#.` page header from page 2; centred title page; soft returns; empty paragraphs.

Not yet:
- **Dual dialogue** (needs a proper side-by-side sample).
- Header/footer tokens other than `#`.
- Scene numbers, locked pages, A-pages, revisions.
- Scene CONTINUED.
- Inline formatting positions (data is there; the renderer will use it).
- Eighths of a page.

Assumptions still to confirm with the golden test script: minimum 2 lines each side of a split; what counts as a sentence end.

### App shell: not yet (still true after Phase 3)

- Double-clicking a .fadein in Finder, Open Recent, more than one script at a time.
- A bundled screenplay font (uses Courier New, Courier Prime or Courier from the system).
- Code signing and notarisation (ad-hoc signed only; first launch needs right-click > Open).

See `docs/decisions/0002-app-shell.md`.

## Phase 3 — Core editor (built; waiting to be tried on Gerard's Mac)

Midlander is now a writer, not just a viewer. Design: `docs/decisions/0003-editor.md` (Midlander's own editor drawn from its own layout, instead of ProseMirror).

| Item | Status | Notes |
|---|---|---|
| Typing on the real page view | ✅ | Every keystroke repaginates with Midlander's layout engine, so what you write on is the printed page: line and page breaks, (MORE), continued cues, automatic (cont'd), the page-number header |
| All 7 elements + Unformatted Text | ✅ | Cmd+1 to 7, Cmd+0, Cmd+Enter (Scene Heading); Format menu |
| Enter / Tab element flow | ✅ | From each style's Enter / Tab-before / Tab-after settings (Fade In 4.1.1 values); Tab at the end of Action acts like Enter |
| Automatic capitals and parenthetical brackets | ✅ | Stored as typed; capitals and ( ) are added on the page, as in Fade In. Typing ( in empty dialogue starts a parenthetical; typing the brackets yourself is ignored |
| Auto-detect elements | ✅ | `int.` / `ext.` / `int./ext.` / `est.` / `i/e.` start a Scene Heading; an all-caps line ending `TO:` becomes a Transition as you type; on Enter, an all-caps Action line that's a known character (or has an extension like (V.O.)) becomes a Character cue, and one matching the Transitions list becomes a Transition. Each reformat is its own undo step |
| Autocomplete | ✅ | Scene intros, locations (from the list and earlier scenes), times, character names (from the list and the script), extensions, transitions. Up/Down, Enter or Tab to accept, Esc to hide, Esc again to show; click to pick |
| Characters and locations lists | 🟡 | New names are suggested straight away and added to the lists when you save. The Format/Roster panel to view and edit lists comes in Phase 4 |
| Caret, selection, mouse | ✅ | Click, drag, double-click (word), triple-click (paragraph), Shift-click; selection drawn from the layout |
| Keyboard movement | ✅ | Arrows (Up/Down keep the column across wrapped lines and pages), Option+Left/Right (word), Cmd+Left/Right (line), Option+Up/Down (paragraph), Cmd+Up/Down (start/end), Page Up/Down, Home/End; Shift extends. Windows: Ctrl for words, Home/End, Ctrl+Home/End |
| Deleting | ✅ | Backspace/Delete, Option (word), Cmd+Backspace (to line start). Deleting an empty paragraph above keeps this paragraph's element |
| Soft return, non-breaking space | ✅ | Shift+Enter; Shift+Cmd+Space |
| Undo / Redo | ✅ | Cmd+Z, Shift+Cmd+Z, Cmd+Y; unlimited within the session (capped at 1,000 steps). A run of typing is one step |
| Bold / Italic / Underline | ✅ | Cmd+B/I/U on a selection, or for what you type next; drawn on the page, including formatting from imported .fadein files |
| Cut / Copy / Paste | ✅ | Copying between Midlander scripts keeps elements and formatting; other apps get plain text as it looks on the page (capitals, brackets). Pasted plain text: one paragraph per line, in the current element |
| New / Save / Save As | ✅ | Midlander's own `.midlander` format (a zip with the script as JSON). Saves are atomic (temporary file, then rename) |
| Fade In scripts stay untouched | ✅ | A script opened from .fadein is never written to: the first save asks for a new .midlander file. The shell refuses to write anything but .midlander |
| Unsaved changes | ✅ | Window title shows "Edited"; New, Open, Close, Quit and closing the window ask Save / Don't Save / Cancel. Undoing back to the saved state clears "Edited" |
| Status bar | ✅ | Page of the caret, current element, scene count, Edited, zoom |
| Menus | ✅ | File (New, Open, Close, Save, Save As), Edit (Undo, Redo, Cut, Copy, Paste, Select All), View (zoom), Format (elements, Bold, Italic, Underline). Items are disabled when they can't do anything |
| Tests | ✅ | 43 unit tests (`npm test`), 18 browser tests run with Mac and with Windows key bindings (`npm run test:e2e`, Google Chrome), 5 Rust tests. Also tried in the real desktop app on Linux |

### Performance

Layout results are kept per paragraph and only changed pages are redrawn. Production build, 200-page test script: about 30 ms per keystroke. Typical feature scripts (90–120 pages) are faster. Incremental pagination is the next step if long scripts feel slow.

### Fade In behaviour I've assumed (please check against Fade In)

- **Enter on an empty paragraph** follows the element flow (e.g. empty Character → Dialogue). Fade In has an optional "element menu on Enter in a blank line", not built yet.
- **Enter in the middle of a paragraph** splits it; both halves keep the element.
- **Backspace at the start of a paragraph** joins it to the one above, which keeps its element (unless the one above is empty: then that empty one is removed).
- **Accepting a location** in autocomplete adds " - " so the time list comes up next.
- **Undo** treats a run of typing as one step.

### Not in this phase

- Editing the title page (it's shown, read-only). Comes with Document > Title Page.
- Dual dialogue, Find/Replace, Navigator, Format/Roster panel, Go To, Preferences (Phase 4); autosave and backups, .fadein/FDX/Fountain export, PDF (Phase 5).
- Open Recent, several scripts at once, double-clicking a script in Finder.
- Strikethrough and highlight shortcuts (formatting from files is shown; the commands come later).
- Accents (Option+E then E, and press-and-hold) are handled, tested with simulated keyboard events; please check them on your Mac. The not-yet-finished part of a composed character (the accent after Option+E) isn't shown until the letter is typed.
