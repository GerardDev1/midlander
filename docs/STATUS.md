# Midlander — feature status

Running list of completed, partial and planned work. Updated at the end of every development session.

Legend: ✅ done and tested · 🟡 partial (see notes) · ⬜ planned · ❌ out of scope

## Phase 1 — Research & spec ✅

Spec approved (PR #1). Reference notes, keymap and layout measurements: `FADE-IN-REFERENCE.md`, `SHORTCUTS.md`.

## Phase 2 — Architecture & core engine (in progress)

| Item | Status | Notes |
|---|---|---|
| Monorepo skeleton, TypeScript, tests | ✅ | No external dependencies; `npm test` runs 23 tests with Node 22+ |
| Document model (`packages/core`) | ✅ | Blocks, runs, styles with inheritance, page settings, lists, Fade In 4.1.1 defaults |
| Element flow table (Enter / Tab) | ✅ | Data only; keyboard handling comes with the editor |
| Scene index (scenes, speakers) | ✅ | Feeds the Navigator and reports later |
| Zip and XML (`packages/formats`) | ✅ | Own implementations; read and write zip |
| **.fadein import** | ✅ | OSF v41 (Fade In 4.x) and v20; styles, settings, paragraphs, inline formatting, title page, lists, dual-dialogue flag |
| .fadein export | ⬜ | Next in formats |
| Fountain / FDX import & export | ⬜ | |
| **Layout engine** (`packages/layout`) | 🟡 | See below |
| Layout comparison tool | ✅ | `tools/compare-layout.ts` + `tools/extract-pdf-lines.py` |
| Tauri app shell, native menus, CI builds | ⬜ | Needs package installs (new chat) |

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
