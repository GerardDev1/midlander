# Midlander — Phase 1 Specification

Status: **DRAFT, awaiting approval**  ·  Last updated: 2026-11-26

Midlander is an independent, cross-platform desktop screenwriting application. The goal is for it to feel **instantly familiar to a Fade In user**: same writing workflow, same keyboard rhythm, same mental model of menus and panels. It is not meant to be a visual clone. All code, icons, names and artwork are original.

This document covers the six Phase 1 deliverables:

1. Feature inventory (§2)
2. Interface breakdown (§3)
3. Keyboard shortcuts (§4)
4. Technical assessment per feature (§5)
5. Recommended technology stack (§6)
6. Development roadmap (§7)

### How to read the "Source" column

| Tag | Meaning |
|---|---|
| **DOC** | Confirmed from Fade In's public website, knowledge base or changelogs |
| **3P** | From a third-party tutorial or review (likely right, not authoritative) |
| **TBC** | Not yet confirmed. Needs a screenshot or test from Gerard's installed copy (see `REFERENCE-CHECKLIST.md`) |
| **STD** | A screenwriting-industry or macOS platform convention, not specific to Fade In |

Nothing marked TBC gets built as "Fade In behaviour" until it's confirmed.

---

## 1. Guiding principles

1. **Workflow familiarity beats pixel familiarity.** Element flow (Tab and Enter), shortcuts, menu locations and panel concepts should match Fade In, so a Fade In user never has to think. The visual style is Midlander's own: clean, restrained, built for long sessions.
2. **The screenplay is structured data, not rich text.** Each paragraph is a typed element (§5.1). The editor is just one view of that model.
3. **Pagination is deterministic and ours.** Page breaks are calculated by Midlander's own layout engine, never by the browser or the operating system. The editor, PDF and print output always agree, on every platform.
4. **No fake features.** Every menu item either works or isn't shown. `STATUS.md` tracks what is done, partial or planned.
5. **Open formats first.** Fountain, Final Draft XML (.fdx) and Fade In's Open Screenplay Format (.fadein) are all text/XML-based, so Midlander can read and write them properly.

---

## 2. Feature inventory

Priority: **P0** = needed for the first usable version (v0.x "write a whole script"), **P1** = needed for v1.0, **P2** = after v1.0.

### 2.1 Writing and formatting

| Feature | Where it lives in Fade In | How it works | Shortcut | How Midlander reproduces it | Pri | Source |
|---|---|---|---|---|---|---|
| Standard elements: Scene Heading, Action, Character, Parenthetical, Dialogue, Transition, Shot | Format panel (top right); Format menu | Every paragraph has an element style that controls indent, caps and spacing | Cmd+number selects an element style (exact mapping TBC) | Typed blocks in the document model; style table drives the layout | P0 | DOC / 3P |
| "Normal Text" base style | Element styles | Base style the others inherit from; changing its font changes all of them | — | Style inheritance in the style table | P1 | 3P |
| Auto element flow (Enter) | Built in, set per style | Scene Heading → Action; Action → Action; Character → Dialogue; Transition → Scene Heading; Shot → Action; Dialogue → (TBC, probably Action) | Enter | Per-style `enterNext` setting | P0 | 3P / TBC |
| Auto element flow (Tab) | Built in, set per style | Separate "Tab key before" (at line start) and "Tab key after" (after text) settings. Action → Character; Character → Parenthetical; empty Parenthetical → Dialogue | Tab | Per-style `tabBefore` / `tabAfter` | P0 | DOC / 3P |
| Customisable Enter/Tab behaviour | Format > Element Styles > Modify Element Style | User sets what Enter/Tab do for each style | — | Element Style editor dialog | P1 | DOC |
| Automatic capitalisation | Element style property | Scene Heading, Character, Transition and Shot are uppercase | — | `uppercase` style flag applied at render time; stored text keeps what the user typed | P0 | 3P |
| Create / modify element styles | Format > Element Styles > Create / Modify | Name, font, indents, spacing, Tab/Enter, bold, shortcut | — | Style editor; styles saved in the document | P1 | DOC |
| Autocomplete: characters | While typing a Character | Suggests known character names | Tab/Enter to accept (TBC) | Popup driven by the character roster | P0 | DOC |
| Autocomplete: scene intros, locations, times | While typing a Scene Heading | INT./EXT./INT./EXT., locations, DAY/NIGHT etc. | TBC | Scene-heading parser plus roster lists | P0 | DOC |
| Character extensions (V.O.), (O.S.), (CONT'D) | Autocomplete lists | Suggested after the character name | TBC | Extension list in the document | P1 | DOC |
| Sortable, rebuildable character/location lists | Roster panel / Document menu (TBC) | User edits the lists; "rebuild" rescans the script | — | Roster rebuilt from the model | P1 | DOC / TBC |
| Smart character rename | TBC | Renames a character everywhere: cues, mentions, (CONT'D) | TBC | Model-level rename with preview | P1 | DOC |
| Dual dialogue | Format > Dual Dialogue (cursor on first character) | Two speeches side by side | — | `dualGroup` id on the paired dialogue blocks | P1 | DOC |
| Page break before | Format > Page Break Before | Forces a page break | — | `breakBefore` block flag | P1 | DOC |
| Adjust line length | Format menu (TBC) / ruler | Nudges one paragraph's line length, with a ruler | TBC | Per-block width override | P2 | DOC |
| Auto line-length "widow word" fix | TBC | Stops single words wrapping onto a new line | — | Optional layout pass | P2 | DOC |
| Bold, italic, underline | Edit/Format menu | Character-level styling | Cmd+B / I / U (STD) | Inline marks | P0 | STD |
| (MORE) and (CONT'D) | Document > More and Continued | Automatic dialogue continuation across pages; text editable; can be turned off | — | Generated by the pagination engine, never stored as text | P0 | DOC |
| Spell check, learn word | Document > Check Spelling; right-click > Learn | Live spell check plus custom dictionaries | — | macOS spell checker via the webview, plus a user dictionary | P1 | DOC |
| Autocorrect | Preferences > Editing | Can be turned off | — | Simple replacement table | P2 | DOC |
| Images in script/title page | Document > Images > Insert Image | Inline image block | — | Image block type | P2 | DOC |
| Templates (Screenplay, stage play, teleplay) | File > Templates (Apply / Save As / Manage) | Style sets plus page layout | — | Template = styles + layout + lists, as JSON | P1 | DOC |
| Change document font | Document > Change Document Font | Changes the whole script | — | Changes Normal Text font | P1 | DOC |

### 2.2 Page layout and output

| Feature | Where | How it works | Shortcut | Midlander approach | Pri | Source |
|---|---|---|---|---|---|---|
| Page layout (paper size, margins, line spacing, element spacing) | Document > Page Layout / Page Setup | Default left/right margins are 1.25" | — | Layout settings in the document; Letter and A4 | P0 | DOC |
| Header and footer | Document > Header and Footer | Placeholders: `#` page, `*` revision colour, `@` date, and named ones like `{Page}` | Double-click header to edit | Template string with tokens | P1 | DOC |
| Page numbers | Header | Standard top-right numbers; no number on page 1 (STD) | — | Header token | P0 | DOC / STD |
| Title page | Document > Title Page > Show Title Page | Saved with the document; optional in output | — | Separate title-page model | P0 | DOC |
| Character list / location list pages | Document > Title Page | Extra pages after the title page | — | Generated pages | P2 | DOC |
| Create PDF | File > Create PDF | Built-in PDF writer; embeds fonts; optional notes | TBC | Own PDF writer fed by the pagination engine | P0 | DOC |
| PDF/Print Setup | File > PDF Setup / Print Setup | Options including watermark | — | Output options dialog | P1 | DOC |
| Print with screenplay page ranges ("100A") | File > Print | Fade In's own print dialog understands A-pages | Cmd+P | Print = generate PDF, then hand it to the system print dialog | P1 | DOC |
| Batch watermark | File > Batch Watermark | Many PDF copies, each with a different watermark | — | Loop over names in the PDF writer | P2 | DOC |
| Show invisibles | View > Show Invisibles | Shows breaks and spaces | TBC | Editor decoration | P1 | DOC |

### 2.3 Navigation and organisation

| Feature | Where | How it works | Shortcut | Midlander approach | Pri | Source |
|---|---|---|---|---|---|---|
| Navigator: scene list | Navigator panel | Scene headings, scene numbers, page and length in eighths; click to jump | TBC | Live view of the model's scene index | P0 | 3P / DOC |
| Scene reorder by drag | Navigator | Move one or many scenes | — | Model operation `moveScenes` (undoable) | P0 | DOC |
| Copy / delete scenes | Navigator right-click | — | — | Context menu | P0 | 3P |
| Synopsis | Navigator right-click > Add Synopsis | Shows under the heading in the Navigator | double-click icon | `synopsis` field on the scene | P1 | 3P / DOC |
| Sequences (nested) | Navigator | Groups scenes; move as a block | — | Sequence ranges in the model | P1 | DOC / 3P |
| Colour coding: plot points, themes, characters | Navigator | Colour tags on scenes and ranges | — | Tags with colours | P1 | DOC |
| Bookmarks and links | Navigator (since v5) | Jump points, internal links | TBC | Bookmark blocks/marks | P1 | DOC |
| Notes / sticky notes | Navigator (since v5); inline | Notes attached to text | TBC | Note marks with side panel | P1 | DOC |
| "Select in document" | Navigator right-click | Selects the scene text | — | Context menu | P1 | DOC |
| Find / replace | Find panel | Enter repeats the find | Cmd+F (STD) | Find panel; search over the model | P0 | DOC |
| Go to page / scene | TBC | — | TBC | Dialog | P1 | TBC |

### 2.4 Views and modes

| Feature | Where | How it works | Midlander approach | Pri | Source |
|---|---|---|---|---|---|
| Full screen, page only | View > Full Screen | Page-only, full-screen writing | Native full screen plus panels hidden | P0 | DOC |
| Focus mode | View > Focus Current Text (name TBC) | Dims everything except current text | Editor decoration | P1 | DOC |
| Dark mode / custom page colours | Preferences > User Interface; View > Custom Page Colors | Custom page, text and cursor colours | Theme system: light, dark, custom | P1 | DOC |
| Zoom | View menu (TBC) | — | Scale the page view | P0 | TBC |
| Ruler | Preferences > User Interface > Always show ruler | Ruler above the page | Ruler component | P2 | DOC |
| Docking panels / layouts | Panels dock/undock; split left/right layouts | — | Resizable dock areas; saved layout | P1 | DOC |
| Large icons | Preferences > User Interface | — | Toolbar size preference | P2 | DOC |
| Multiple documents | TBC (tabs or windows) | — | Tabs inside one window, plus new-window option | P1 | TBC |

### 2.5 Production and revisions

| Feature | Where | How it works | Midlander approach | Pri | Source |
|---|---|---|---|---|---|
| Scene numbering | Production menu (TBC) | Scene numbers, A/B inserts, editable when unlocked | Numbering engine | P1 | DOC |
| Lock scenes / lock pages | Production menu | Keeps original numbers; adds A-pages after lock | Locked numbering plus A-page pagination | P1 | DOC |
| Omitted scenes | Production menu | Marked "OMITTED" and keep their number | `omitted` scene flag | P1 | DOC |
| Revisions with colours | Production > Revisions (Edit) | Revision sets (Blue, Pink…), with name and date; asterisks in margin; coloured "paper" in PDF | Revision marks on text runs; revision set table | P1 | DOC |
| Compare to previous | Document > Compare to Previous | Shows differences between versions | Model-level diff (block, then word) | P2 | DOC |
| Reports: scene, cast, location, statistics | Production > Reports | Print, HTML or CSV | Report engine reading the model | P1 | DOC |
| Statistics / word count | File > This Session; Production > Reports > Statistics | Session word count and target | Live counters plus report | P1 | DOC |
| Tagging / breakdown | Production menu (TBC) | Custom breakdown tags (props, cast, wardrobe…) | Tag marks plus breakdown report | P2 | DOC |
| Dialogue Tuner | TBC | All of one character's dialogue, editable in one place | Filtered, live-editable view of the model | P1 | DOC |
| Word-use frequency | TBC | Finds overused words | Report | P2 | DOC |
| Formatting error check | TBC | Flags formatting problems | Lint pass on the model | P2 | DOC |
| Table read (text-to-speech) | Document > Table Read | System voices per character | macOS/Windows speech | P2 | DOC |

### 2.6 Files

| Feature | Where | How it works | Midlander approach | Pri | Source |
|---|---|---|---|---|---|
| New / Open / Save / Save As / recent | File | — | Native dialogs | P0 | STD |
| Autosave and backups | File > Recover Backup | Backups in the app data folder | Timed snapshots in the app data folder; crash recovery on launch | P0 | DOC |
| "-updated" backup when opening old files | Automatic | Keeps the original when upgrading a file | Same rule for older Midlander files | P1 | DOC |
| Native format | .fadein = Open Screenplay Format XML | Open, documented XML | Midlander's own `.midlander` (zipped JSON); see §5.7 | P0 | DOC |
| Import/export Fade In (.fadein) | File > Open / Save As | — | OSF reader/writer | P1 | DOC |
| Final Draft (.fdx) | Open, edit, save | — | FDX reader/writer | P0 | DOC |
| Fountain | Import/export | Notes and synopses kept | Fountain reader/writer | P0 | DOC |
| Plain text, HTML | Import/export | — | — | P1 | DOC |
| Word (.docx), RTF | File > Import / Export; Shift/Option for scene-number options | — | DOCX/RTF writer; import later | P2 | DOC |
| PDF import | File > Import | Best-effort | Late, best-effort | P2 | DOC |
| Celtx, Scrivener, older .fdr | Import | — | Not planned (low value / proprietary) | — | DOC |

### 2.7 Out of scope (for now)

- **Fade In Access** (cloud sync, web editing) and **realtime collaboration**. These are paid server services. Midlander works with any synced folder (iCloud Drive, Dropbox) instead. Revisit after v1.0.
- **Mobile apps.**
- **Grammar checking.** Fade In doesn't have it either.

---

## 3. Interface breakdown

Everything here is the *layout concept*. The visual design (colours, icons, typography of the chrome) is Midlander's own.

```
┌───────────────────────────────────────────────────────────────────────┐
│ macOS menu bar: Midlander  File  Edit  View  Format  Document         │
│                 Production  Window  Help                              │
├───────────────────────────────────────────────────────────────────────┤
│ Toolbar: New Open Save | Undo Redo | Find | element dropdown | zoom  │
├───────────────────────────────────────────────────────────────────────┤
│ Tabs:  [ My Script ] [ Draft 2 ]                                      │
├──────────────┬────────────────────────────────────┬───────────────────┤
│ NAVIGATOR    │                                    │ FORMAT            │
│ Scenes       │        ┌──────────────────┐        │ ▸ Scene Heading   │
│  1 INT. …  1 │        │  page (white)    │        │   Action          │
│  2 EXT. …  2 │        │                  │        │   Character       │
│ Sequences    │        │  INT. STATION…   │        │   Parenthetical   │
│ Bookmarks    │        │                  │        │   Dialogue        │
│ Notes        │        └──────────────────┘        │   Transition      │
│              │        ┌──────────────────┐        │   Shot            │
│              │        │  page 2          │        ├───────────────────┤
│              │                                    │ ROSTER            │
│              │                                    │ Characters / Locs │
├──────────────┴────────────────────────────────────┴───────────────────┤
│ Status bar: Page 3 of 104 · Scene 12 · Action · 23,410 words · 100%   │
└───────────────────────────────────────────────────────────────────────┘
```

| Area | Fade In concept | Midlander plan |
|---|---|---|
| Menu bar | File, Edit, View, Format, Document, Production, Collaborate, Help (DOC: these menus are referenced in the KB) | Same menu names and item locations, except Collaborate (out of scope). On macOS, Preferences lives under the app menu (STD) |
| Format panel | Top right; lists element styles; right-click a style to modify it | Same position and behaviour |
| Roster panel | Characters / locations (DOC: "Format/Roster panel") | Same |
| Navigator | Scenes (page, eighths, synopsis), sequences, bookmarks, notes | Same tabs/sections |
| Find panel | Docked panel, not a modal | Same |
| Page view | White pages on a grey desk; page-accurate | Same; the editor *is* the page view |
| Status bar | TBC | Page, scene, element, word count, zoom |
| Preferences | General, Editing, User Interface (incl. Shortcut Keys, colours, scroll bars, ruler) | Same section names |
| Document tabs | TBC | Tabs |

---

## 4. Keyboard shortcuts

Fade In's full default list is in the app under **Help > Fade In Help > Shortcut Keys** and can be edited under **Preferences > User Interface > Shortcut Keys** (DOC). That list isn't published online, so **Gerard needs to screenshot it** (see the checklist). Until then:

### 4.1 Confirmed or near-certain

| Action | Mac | Source |
|---|---|---|
| Choose element style | Cmd+1…Cmd+n (exact order TBC) | DOC |
| Next element (context-aware) | Enter | DOC / 3P |
| Change element / parenthetical | Tab (before/after text behave differently) | DOC |
| Toggle debug logging | Cmd+Shift+Option+A | DOC (we won't copy this one) |
| New / Open / Save / Save As | Cmd+N / Cmd+O / Cmd+S / Cmd+Shift+S | STD / 3P |
| Undo / Redo | Cmd+Z / Cmd+Shift+Z | STD |
| Cut / Copy / Paste / Select All | Cmd+X / C / V / A | STD |
| Find / Find Next | Cmd+F / Cmd+G | STD |
| Print | Cmd+P | STD |
| Bold / Italic / Underline | Cmd+B / I / U | STD |
| Full screen | Ctrl+Cmd+F | STD (Fade In's own: TBC) |
| Preferences | Cmd+, | STD |

### 4.2 To be confirmed from Gerard's copy

Element shortcuts in order, zoom in/out, next/previous scene, go to page, new scene, Navigator toggle, focus mode, dual dialogue, revision mode, Create PDF, insert note, insert bookmark, Dialogue Tuner, and anything else in the help list.

### 4.3 Midlander policy

- Every command lives in one **command registry** (id, title, menu location, default shortcut). Menus, the toolbar, the shortcut editor and the help list are all generated from it, so nothing can drift out of sync.
- Default keymap = Fade In's defaults wherever they're confirmed.
- Users can rebind any command in Preferences; conflicts are warned about. Bindings are saved as JSON.
- Windows/Linux use Ctrl in place of Cmd automatically.

---

## 5. Technical assessment

### 5.1 Document model (the core)

```
Document
 ├─ meta:       title page fields, author, contact, draft date, uuid
 ├─ settings:   page layout, header/footer, more/cont'd, template id
 ├─ styles:     element style table (Scene Heading, Action, … custom)
 ├─ lists:      characters, locations, intros, times, extensions, transitions
 ├─ revisions:  revision sets (name, colour, date), current set, lock state
 ├─ blocks[]:   ordered paragraphs
 │    { id, type: "sceneHeading" | "action" | "character" | …,
 │      runs: [{ text, marks: [bold|italic|underline|note|tag|revision] }],
 │      sceneNumber?, omitted?, breakBefore?, dualGroup?, widthAdj? }
 └─ overlays:   synopses, sequences, colour tags, bookmarks, notes (anchored by block id)
```

- Changing an element's type changes `type` only; the text is untouched.
- The **scene index** (scenes, sequences, characters per scene) is derived from `blocks` and updated incrementally on every edit. The Navigator, reports and autocomplete all read from it.
- Every edit is a **transaction** (a list of steps), which gives undo/redo, autosave diffs and, later, collaboration.
- The model lives in a pure TypeScript package (`@midlander/core`) with **no UI dependency**, so it can be unit-tested headlessly.

### 5.2 Editor

**ProseMirror** (MIT licence) with a custom screenplay schema: one node type per element. ProseMirror already provides reliable cursor handling, selection, IME input, undo history, copy/paste and accessibility. Writing a text editor from scratch would cost months and still be worse. The ProseMirror document is kept in step with the core model, but the core model is the truth.

Element flow (Enter/Tab), autocomplete, smart caps and shortcuts are ProseMirror **keymaps and plugins** reading the style table. This makes them configurable, not hard-coded.

### 5.3 Pagination and layout engine

Screenplays use a **monospaced font** (Courier 12pt: 10 characters per inch, 6 lines per inch). So Midlander can lay out every line itself, without asking the browser to measure text. That makes page breaks:

- **identical** on macOS, Windows and in PDF, and
- **fast enough** to repaginate a 120-page script on every keystroke (worker thread, incremental from the edited page).

The engine: wraps each block to its style width → applies element spacing → fills pages to the line limit → applies break rules:

| Rule | Behaviour (STD; exact Fade In thresholds TBC from PDF comparison) |
|---|---|
| Scene heading | Never last on a page; pulls at least 2 lines of the next block with it |
| Character + parenthetical | Never separated from the first dialogue line |
| Dialogue split | Splits at a sentence boundary, minimum 2 lines each side; adds (MORE) at the bottom and `NAME (CONT'D)` at the top |
| Action split | Minimum 2 lines each side, at a sentence boundary where possible |
| Transition | Stays with the preceding block |
| Locked pages | Overflow becomes 12A, 12B… |

The editor then shows those page breaks visually (page gaps, page numbers, (MORE)/(CONT'D)) as decorations, so what you see while writing is the final page.

Font: ship **Courier Prime** (SIL Open Font Licence, free to bundle) as the default, with the option to use any installed Courier.

### 5.4 PDF and print

Own PDF generation (via `pdf-lib`, MIT) from the layout engine's output: exact positions, embedded font, selectable text, bookmarks per scene, revision colours, watermarks. Printing = generate PDF → open the system print dialog. This is the same approach as Fade In's "Create PDF", and it guarantees print matches screen.

### 5.5 Import / export

| Format | Difficulty | Notes |
|---|---|---|
| Fountain | Low | Public, open spec (fountain.io). Round-trips notes, synopses, sections |
| FDX | Medium | XML; widely implemented by other apps. Paragraph types, title page, revisions, dual dialogue, scene numbers |
| .fadein (OSF) | Medium | Fade In uses the Open Screenplay Format, XML-based (DOC). An open SDK exists but states no licence, so we write our own reader/writer from the format, tested against sample files Gerard exports from his own copy. Exact container (zip vs plain XML) TBC |
| Plain text / HTML | Low | — |
| DOCX / RTF | Medium | Export first; import later |
| PDF import | High | Best-effort heuristics; late |

Every importer has a **round-trip test**: import → export → re-import → compare models.

### 5.6 Storage, autosave, recovery

- Native format **`.midlander`**: a zip containing `document.json` plus any images, with a format version number. Being JSON makes it easy to keep stable and to diff.
- **Autosave**: every N seconds (default 60) and on idle, writing a snapshot to the app data folder, never over the user's file unless they've chosen "save automatically". On launch, unsaved snapshots are offered for recovery (= File > Recover Backup).
- **Safe saves**: write to a temporary file, then atomically rename, so a crash mid-save can't corrupt a script.
- **SQLite is not needed** for v1: documents are files and preferences are JSON. We can add it later if we build a script library.

### 5.7 Preferences

JSON in the app data folder, with schema and defaults; sections mirror Fade In (General, Editing, User Interface, Shortcut Keys).

### 5.8 Reports and tools

All reports are pure functions over the document model → table → render as on-screen view, HTML, CSV or PDF. That puts scene, cast, location, statistics, dialogue and word-frequency reports on one shared engine.

### 5.9 Known hard parts and risks

| Risk | Mitigation |
|---|---|
| Exact page-break parity with Fade In | Compare our output against PDFs exported from Gerard's copy, page by page; adjustable thresholds |
| Revisions + locked pages + A-pages interplay | Build after core pagination is stable; dedicated test scripts |
| Typing performance on long scripts | Incremental layout in a worker; benchmark with a 150-page script from day one |
| macOS Monterey ages out of toolchains | Build on GitHub's current macOS machines; keep the app's minimum macOS at 12 as long as Tauri allows |
| FDX/.fadein details only seen in real files | Gerard exports sample files; tests use them |

---

## 6. Recommended technology stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** (Rust) | Small, fast apps (~10 MB vs ~150 MB). Supports macOS 10.13+, so it runs on Monterey. **Electron is ruled out: Electron 44+ requires macOS 13**, which would lock Gerard's own Mac out of current versions |
| UI | **TypeScript + React** | Mature, well known, good for menus/panels/dialogs |
| Editor | **ProseMirror** | Best-in-class structured editor; schema = screenplay elements |
| Layout/pagination | Own TypeScript engine (in a Web Worker) | Deterministic, monospaced-aware, same on every platform |
| PDF | **pdf-lib** | Pure TypeScript, precise placement, font embedding |
| Native menus, file dialogs, file IO | Tauri APIs (Rust side) | Real macOS menu bar, not a fake HTML one |
| Tests | Vitest (unit), Playwright (UI), golden PDF comparisons | — |
| Build & release | **GitHub Actions** on macOS + Windows runners | Builds .dmg and .exe on every release; signing/notarising later |
| Monorepo | pnpm workspaces | `core`, `layout`, `formats`, `pdf`, `reports`, `app` as separate packages |

Why Tauri's main drawback doesn't matter here: Tauri uses each system's own web engine (WebKit on Mac, WebView2 on Windows), so text measurement could differ between platforms. Midlander never relies on the browser for pagination (§5.3), so the output is identical.

### Repository layout

```
midlander/
  packages/
    core/       document model, transactions, scene index (no UI)
    layout/     pagination engine
    formats/    fountain, fdx, osf(.fadein), txt, html, docx
    pdf/        PDF writer
    reports/    reports and statistics
    editor/     ProseMirror schema, keymaps, plugins
  app/          Tauri + React application (menus, panels, dialogs)
  test-scripts/ sample screenplays + golden PDFs
  docs/         this spec, STATUS.md, decisions
```

---

## 7. Development roadmap

Each phase ends with something Gerard can download and try on his Mac, plus an updated `STATUS.md`.

| Phase | Delivers | Gerard's part |
|---|---|---|
| **1. Research & spec** (now) | This document, reference checklist | Capture the screenshots/files in `REFERENCE-CHECKLIST.md`; approve or amend this spec; enable package installs in Claude settings |
| **2. Architecture & skeleton** | Monorepo, core model with tests, Tauri app that opens a window with native menus; GitHub Actions producing a downloadable `.dmg` | Download the build, open it on Monterey, tell me if it launches |
| **3. Core editor** | Typing with all elements, Enter/Tab flow, Cmd+number, autocomplete, smart caps, live pagination with (MORE)/(CONT'D), undo/redo | Write a few pages the way you normally do in Fade In; report anything that feels "off" |
| **4. Interface** | Navigator, Format and Roster panels, Find/Replace, toolbar, status bar, zoom, full screen, focus mode, themes, Preferences, shortcut editor | Compare side by side with Fade In |
| **5. Files** | .midlander save/open, autosave, recovery, recent files, tabs; Fountain, FDX, .fadein, text import/export; Create PDF; Print | Round-trip your own real scripts; compare PDFs with Fade In's |
| **6. Advanced** | Title page, header/footer, scene numbering, locking, omitted scenes, revisions with colours, reports (scene/cast/location/stats), Dialogue Tuner, synopses, sequences, colour tags, bookmarks, notes, dual dialogue | Test with a production-style script |
| **7. Testing & refinement** | Full test screenplay (spec §8 of the brief), page-by-page PDF comparison, keyboard workflow tests, performance on long scripts, bug fixes | Final comparison against Fade In |
| **8. Release prep** | App icon, signed + notarised builds, website/README, licence, auto-update, crash reporting (opt-in) | Apple Developer account, licence decision |

**Definition of done for v1.0:** all P0 and P1 features working with no placeholder items; the test screenplay paginates within one line of Fade In's PDF on every page; round-trip tests pass for Fountain, FDX and .fadein.

---

## 8. Decisions needed from Gerard

1. **Approve this spec** (or tell me what to change).
2. **Licence**, which affects how you can share it: open source (e.g. GPL-3.0 or MIT) or closed/commercial. It doesn't block Phase 2, but it needs settling before the first public release.
3. **Default paper size**: US Letter (industry standard for film) or A4. Both will be supported; this is just the default.
4. **Repo visibility**: `midlander` is currently **public**. Fine if open source is the plan; otherwise make it private for now.
