# Midlander — Phase 1 Specification

Status: **DRAFT v2, awaiting approval**  ·  Last updated: 2026-11-26

Midlander is an independent, cross-platform desktop screenwriting application. The goal is for it to feel **instantly familiar to a Fade In user**: same writing workflow, same keyboard rhythm, same mental model of menus and panels. It is not meant to be a visual clone. All code, icons, names and artwork are original.

This document covers the six Phase 1 deliverables:

1. Feature inventory (§2)
2. Interface breakdown (§3)
3. Keyboard shortcuts (§4 → full list in `SHORTCUTS.md`)
4. Technical assessment per feature (§5)
5. Recommended technology stack (§6)
6. Development roadmap (§7)

Companion documents:
- `FADE-IN-REFERENCE.md`: detailed notes on how Fade In 4.1.1 behaves.
- `SHORTCUTS.md`: Midlander's default keymap.
- `REFERENCE-CHECKLIST.md`: what's still needed from Gerard.
- `STATUS.md`: progress.

### How to read the "Source" column

| Tag | Meaning |
|---|---|
| **REF** | Confirmed from the help manual or templates bundled with Gerard's Fade In 4.1.1 |
| **DOC** | Confirmed from Fade In's public website, knowledge base or changelogs |
| **TBC** | Still to confirm from screenshots or tests (see `REFERENCE-CHECKLIST.md`) |
| **STD** | A screenwriting-industry or macOS convention |

---

## 1. Guiding principles

1. **Workflow familiarity beats pixel familiarity.** Element flow (Tab and Enter), shortcuts, menu names and item locations, and panel concepts match Fade In. The visual style is Midlander's own: clean, restrained, built for long sessions.
2. **The screenplay is structured data, not rich text.** Each paragraph is a typed element (§5.1). The editor is just one view of that model.
3. **Pagination is deterministic and ours.** Page breaks are calculated by Midlander's own layout engine, never by the browser or the operating system. The editor, PDF and print output always agree, on every platform.
4. **No fake features.** Every menu item either works or isn't shown. `STATUS.md` tracks what is done, partial or planned.
5. **Open formats first, and your existing scripts come with you.** .fadein import is a first-release (P0) feature, so Gerard's existing scripts open in Midlander from day one.

---

## 2. Feature inventory

Priority:
- **P0**: first usable version ("write and deliver a whole script").
- **P1**: v1.0.
- **P2**: after v1.0.

Details of each behaviour are in `FADE-IN-REFERENCE.md` (section numbers shown as §R…).

### 2.1 Writing and formatting

| Feature | Fade In location | Shortcut (Mac) | How Midlander reproduces it | Pri | Src |
|---|---|---|---|---|---|
| 7 screenplay elements + Normal Text | Format menu, Format panel | Cmd+1…7, Cmd+0 | Typed blocks; style table drives layout | P0 | REF |
| Element flow on Enter / Tab-empty / Tab-after (§R1.1) | Built in, per style | Enter, Tab | Per-style `enter`, `tabBefore`, `tabAfter`; defaults from Fade In's table | P0 | REF |
| Auto-detect elements as you type (`int.` → Scene Heading, transitions, character names) | Preferences > Editing | — | Input rules in the editor | P0 | REF |
| Automatic caps (Scene Heading, Character, Transition, Shot) | Style property | — | `allCaps` style flag, applied at render; stored text keeps what was typed | P0 | REF |
| Autocomplete: characters, intros, locations, times, extensions, transitions (§R3) | Popup | ↑↓, Enter/Tab, Esc | Popup driven by document lists | P0 | REF |
| Guess next speaker | Preferences > Editing | — | Alternation heuristic | P1 | REF |
| Character/location lists: auto-add, edit, sort, rebuild, retain, gender | Format/Roster panel; Document > Manage Lists | Shift+Option+Cmd+C / L | Lists in the document model | P1 | REF |
| Bold, italic, underline, strikethrough | Format menu / panel | Cmd+B/I/U, Shift+Cmd+X | Inline marks | P0 | REF |
| Align left / centre / right | Format menu / panel | Cmd+L/E/R | Paragraph attribute | P1 | REF |
| Highlight (several colours, find next/previous) | Format > Highlighting | Shift+Cmd+H, Shift+Cmd+. / , | Highlight mark | P1 | REF |
| Upper/lower (/title) case | Format menu | Cmd+K, Shift+Cmd+K | Text transform | P1 | REF |
| Soft return, non-breaking space/hyphen | Typing | Shift+Enter, Shift+Cmd+Space / Hyphen | Editor nodes | P0 | REF |
| Reformat element as above | Format | Option+Cmd+0–7 | Command | P1 | REF |
| Apply / Insert element from a list | Format > Element Styles | Shift+Cmd+E, Shift+Cmd+Enter | Quick picker | P1 | REF |
| Quick Reformat dialog | Format menu | Shift+Cmd+T | Dialog | P1 | REF |
| Modify / create / delete element styles (all properties, §R1.2) | Format > Element Styles | Option+Cmd+E; custom styles Ctrl+Cmd+1–8 | Style editor; styles saved in the document | P1 | REF |
| Enter on a blank line → element menu (optional) | Preferences > Editing | — | Option | P1 | REF |
| Dual dialogue | Format > Make Dual Dialogue | Cmd+D | `dualGroup` on paired blocks | P1 | REF |
| Keep With Next, Page Break Before | Format menu | — | Block flags | P1 | REF |
| Adjust line length, ruler, Auto Adjust Lines, find adjusted lines | Format > Adjust Line Length | Cmd+J, Shift+Cmd+J, Option+Cmd+J | Per-block indent override | P2 | REF |
| Format Font, remove font substitution | Format menu | Option+Shift+Cmd+F | Font mark | P2 | REF |
| Act-break styles (TV templates) | Style property | — | `actBreak` flag | P1 | REF |
| Templates: Screenplay, Half-Hour Sitcom, One-Hour Drama, Stage Play | File > Templates | Shift+Cmd+N | Our own templates (styles + layout + lists), written from scratch | P1 | REF |
| Change Document Font | Document menu | — | Changes Normal Text | P1 | REF |
| Spell check, document and global dictionaries, languages | Document > Check Spelling | Option+Cmd+K | System spell checker + user dictionaries | P1 | REF |
| Autocorrect, autocapitalise, DOuble CAps, smart quotes, smart selection | Preferences > Editing | — | Editor input rules | P1 | REF |
| Online tools (dictionary/thesaurus URLs) | Document > Online Tools | Option+Shift+Cmd+K | Opens browser with `%s` URL | P2 | REF |
| Images in script/title page | Document > Images | — | Image block | P2 | REF |
| Fountain copy/paste/edit | Edit > Fountain | Shift+Cmd+C / V | Uses the Fountain converter | P1 | REF |

### 2.2 Page layout and output

| Feature | Fade In location | Shortcut | Midlander approach | Pri | Src |
|---|---|---|---|---|---|
| Page layout: paper, margins, line handling, element spacing; inches/cm | Document > Page Layout | — | Layout settings; Letter and A4; defaults match Fade In (§R2) | P0 | REF |
| (MORE) / (cont'd) / CONTINUED, editable or blank to disable | Document > More and Continued | — | Generated by the pagination engine, never stored as text | P0 | REF |
| Header/footer with full token language (§R2.2) | Document > Header and Footer | — | Same tokens | P0 basic (#, page), P1 full | REF |
| Title page with bookmarks (Title, Author, Contact…) | Document > Title Page | Option+Cmd+T | Separate sub-document | P0 | REF |
| Create PDF | File > Create PDF | — | Own PDF writer fed by the pagination engine | P0 | REF |
| Print with Midlander's own dialog first (A-page ranges, revisions, sides), then system dialog | File > Print | Cmd+P | Generate PDF of chosen pages → system print | P1 | REF |
| Print Preview | File | — | PDF preview window | P1 | REF |
| Batch watermark (secure, one copy per name) | File > Batch Watermark | — | Loop in the PDF writer | P2 | REF |
| Show invisibles | View | Option+Cmd+V | Editor decoration | P1 | REF |

### 2.3 Navigation and organisation

| Feature | Fade In location | Shortcut | Midlander approach | Pri | Src |
|---|---|---|---|---|---|
| Navigator: scene list following the current scene; Enter/double-click to jump | View > Navigator | Option+Cmd+G | Live view of the scene index | P0 | REF |
| Navigator: multi-select, cut/copy/paste, drag-and-drop | Navigator | — | Model operation `moveScenes` (undoable) | P0 | REF |
| Navigator: show synopsis; length in eighths or running time | Navigator Show button | — | Options | P1 | REF |
| Navigator folders (nested scenes, flatten) | Navigator drag | — | Tree overlay over scenes | P1 | REF |
| Navigator notes and bookmarks | Navigator | — | Extra sections | P1 | DOC |
| Index cards view | Document > Index Cards | Option+Cmd+I (+ card keys) | Card grid view over the same model | P1 | REF |
| Synopsis on any paragraph, with colour categories | Document > Synopsis | Option+Cmd+Y | Overlay anchored to block id | P1 | REF |
| Notes (sticky, not printed), find next/previous | Document > Notes | Option+Cmd+N, Option+Cmd+. / , | Overlay | P1 | REF |
| Bookmarks and links (internal, URL; Cmd-click follows) | Document > Bookmarks and Links | Option+Cmd+B, Option+Cmd+\ | Overlay + link mark | P1 | REF |
| Find panel; Find and Replace dialog; wrap-around | Edit | Cmd+F, Shift+Cmd+F, Cmd+G | Search over the model | P0 | REF |
| Go To scene / page / bookmark | Edit > Go To | Cmd+T | Dialog | P0 | REF |

### 2.4 Views and modes

| Feature | Fade In location | Shortcut | Midlander approach | Pri | Src |
|---|---|---|---|---|---|
| View modes: Normal, Page View, Continuous, Side by Side | View | Shift+Cmd+M cycles | Page renderer modes | P0 Page View, P1 others | REF |
| Zoom (100% reset) | View > Zoom | Cmd+plus / minus, Option+Shift+Cmd+0 | Scale | P0 | REF |
| Full screen / Full screen minimal | View | Option+Enter / Option+Shift+Enter | Native full screen ± hide chrome | P0 | REF |
| Focus current text | View | Option+Cmd+U | Dim other blocks | P1 | REF |
| Custom view colours (dark mode) | View; Preferences > User Interface | Option+Cmd+R | Theme + page colours | P1 | REF |
| Document tabs, split/join, document list, next/previous | View | Shift+Cmd+\, Shift+Cmd+] / [ | Tab groups | P1 | REF |
| Dockable panels; layout presets; saved custom layout | View > Layout | — | Dock system; layout saved | P1 | REF |
| Customisable toolbar | Right-click toolbar | — | Toolbar from the command registry | P1 | REF |
| Keep typing centred, block cursor, always show ruler | Preferences > User Interface | — | Options | P1 | REF |
| Start page (new from template / recent) | Help > Start Page | — | Welcome window | P1 | REF |

### 2.5 Production and revisions

| Feature | Fade In location | Shortcut | Midlander approach | Pri | Src |
|---|---|---|---|---|---|
| Scene numbering: show, format, lock, relock, edit, renumber | Production > Scene Numbering | — | Numbering engine | P1 | REF |
| Page number locking, A-pages, edit, renumber, unlock current page | Production > Page Numbering | — | Locked pagination | P1 | REF |
| Numbering modes 1AB, 1A2, AB2, BA2, XIV, xiv | Production | — | Numbering engine | P1 | REF |
| Additional element numbering (e.g. dialogue) | Production > Additional Numbering | — | Same engine | P2 | REF |
| Revisions: colours, revision mode, mark/unmark, show options, document vs current revision, modify | Production > Revisions | Cmd+] / [, Option+Cmd+] / [ | Revision marks on text runs; revision set table | P1 | REF |
| Omit / unomit scene | Production > Omit Scene | — | `omitted` flag | P1 | REF |
| Scene Versions | Production | — | Stored scene snapshots | P2 | REF |
| Alternates (per-element versions, inline `//`) | Production > Alternates | Option+Shift+Cmd+= / -, Option+Cmd+= / - | Alt list on a block | P2 | REF |
| Tagging window, categories, Tag All, Auto Tag | Production > Tagging Window | Shift+Cmd+A | Tag marks | P2 | REF |
| Reports: Scene, Cast, Character, Dialogue, Gender, Location, Notes, Synopsis, Revisions, Tagging, Element, Statistics; print/HTML/CSV | Production > Reports | — | Report engine reading the model | P1 (Scene, Cast, Character, Location, Statistics), P2 rest | REF |
| This Session: time, words, net pages, timer | File > This Session | Shift+Cmd+I | Session tracker | P1 | REF |
| Change Character Name | Document menu | — | Model-level rename with preview | P1 | REF |
| Dialogue Tuner | Document menu | — | Filtered, live-editable view | P1 | REF |
| Compare to Previous (highlight or as revisions) | Document menu | — | Model diff | P2 | REF |
| Find Errors (configurable checks) | Document menu | Option+Shift+Cmd+. / , | Lint pass | P2 | REF |
| Table Read | Document menu | Shift+Cmd+R | System text-to-speech | P2 | REF |

### 2.6 Files

| Feature | Fade In location | Shortcut | Midlander approach | Pri | Src |
|---|---|---|---|---|---|
| New, Open, Open Recent, Close, Save, Save As, Save All, Revert to Saved | File | Cmd+N/O/W/S, Shift+Cmd+S, Option+Cmd+S | Native dialogs | P0 | REF |
| Autosave backups + Recover Backup | File; Preferences > General | — | Timed snapshots in app data; recovery on launch | P0 | REF |
| Reopen last document / all tabs / editing position | Preferences > General | — | Session restore | P1 | REF |
| Find File on Disk | File | — | Reveal in Finder | P1 | REF |
| Document password | File > Password | — | Encrypted container | P2 | REF |
| Extract pages / join documents | File > Extract and Join | — | Model operations | P2 | REF |
| **.fadein import** | File > Open | — | Zip + Open Screenplay Format XML reader (§5.5) | **P0** | REF |
| .fadein export | File > Save | — | OSF writer, so scripts can go back to Fade In | P1 | REF |
| Final Draft .fdx import/export | Import/Export | — | FDX reader/writer | P0 | REF |
| Fountain import/export | Import/Export | — | Fountain reader/writer | P0 | REF |
| Formatted and unformatted text | Import/Export | — | — | P1 | REF |
| HTML import/export | Import/Export | — | — | P1 | REF |
| RTF / Word .docx | Import/Export | — | Export first, import later | P2 | REF/DOC |
| Screenplay PDF import | Import | — | Best-effort heuristics | P2 | REF |
| EPUB, Avid, Open Scheduling Format, Scrivener exports | Export | — | Later | P2 | REF |
| Adobe Story, Celtx, Highland, Scrivener, .fdr imports | Import | — | Not planned unless requested | — | REF |

### 2.7 Out of scope (for now)

- **Realtime collaboration and chat (Collaborate menu), Fade In Access** (cloud sync and web editing). These need servers. Midlander works with any synced folder (iCloud Drive, Dropbox) instead. Revisit after v1.0.
- **Mobile apps.**
- **Third-party "Extensions"** (Edit menu): they send your text to outside websites.
- **Registration/licensing UI**: depends on the licence decision.

---

## 3. Interface breakdown

The layout follows Fade In's *concepts*. Colours, icons and styling are Midlander's own.

```
┌───────────────────────────────────────────────────────────────────────┐
│ macOS menu bar: Midlander  File  Edit  View  Format  Document         │
│                 Production  Window  Help                              │
├───────────────────────────────────────────────────────────────────────┤
│ Toolbar (customisable): New Open Save | Undo Redo | Find | element ▾ │
├───────────────────────────────────────────────────────────────────────┤
│ Tabs:  [ My Script ] [ Draft 2 ]                                      │
├────────────────────────────────────────────────┬──────────────────────┤
│                                                │ FORMAT/ROSTER        │
│        ┌──────────────────┐                    │ [Format|Char|Loc|Oth]│
│        │  page            │                    │ ▸ Scene Heading      │
│        │  INT. STATION…   │                    │   Action             │
│        │                  │                    │   Character …        │
│        └──────────────────┘                    │ B I U S  ≡ ≡ ≡       │
│        ┌──────────────────┐                    ├──────────────────────┤
│        │  page 2          │                    │ NAVIGATOR            │
│                                                │  1 INT. … p1  1 3/8  │
│                                                │  2 EXT. … p2    4/8  │
├────────────────────────────────────────────────┴──────────────────────┤
│ Status bar: Page 3 of 104 · Scene 12 · Action · 23,410 words · 100%   │
└───────────────────────────────────────────────────────────────────────┘
```

| Area | Fade In concept | Midlander plan | Src |
|---|---|---|---|
| Menu bar | File, Edit, View, Format, Document, Production, Collaborate, Help; Preferences under the app menu on Mac | Same menus and item positions (full map in §R8–10), minus Collaborate; a standard macOS Window menu added | REF |
| Format/Roster panel | One panel with Format, Characters, Locations and Other tabs; formatting buttons; double-click to apply; right-click a style to modify | Same | REF/DOC |
| Navigator | Scenes, synopses, eighths/running time, folders, notes, bookmarks | Same | REF/DOC |
| Panel placement | Layout presets put the Format/Roster and Navigator panels on the side opposite the main window; dock, float, resize | Default: both panels docked on the right (as drawn); presets for the other arrangements | REF |
| Find | Panel (Esc closes); Find and Replace is a dialog | Same | REF |
| Page view | Page-accurate; four view modes | Same; the editor *is* the page view | REF |
| Index cards | Alternative main view | Same | REF |
| Tabs | Document tabs, split side by side | Same | REF |
| Status bar | TBC (screenshot C7) | Page, scene, element, word count, zoom | TBC |
| Toolbar contents | TBC (screenshot C6) | Generated from the command registry | TBC |
| Preferences | General, Editing, User Interface (incl. Shortcut Keys) | Same sections and options (§R9) | REF |

---

## 4. Keyboard shortcuts

**Fully confirmed.** Fade In 4.1.1's complete default list is transcribed into `SHORTCUTS.md` as Midlander's default keymap: about 110 commands.

Policy:
- Every command lives in one **command registry** (id, title, menu location, default shortcut). Menus, the toolbar, the shortcut editor and the help list are generated from it, so they can't drift apart.
- Users can rebind any command in Preferences > User Interface > Shortcut Keys; conflicts are warned about. Bindings are saved as JSON.
- Windows/Linux get Fade In's Windows defaults.
- Commands for features not yet built don't appear in menus. Their shortcuts do nothing, and the shortcut editor shows them as "coming later".

---

## 5. Technical assessment

### 5.1 Document model (the core)

```
Document
 ├─ meta:       title page (paragraphs + bookmarks), uuid
 ├─ settings:   page layout, header/footer, more/cont'd, numbering, locks
 ├─ styles:     element style table (built-in + custom; inherits via basedOn)
 ├─ lists:      characters (+gender, retain), locations, intros, times,
 │              extensions, transitions, revision colours, tag categories
 ├─ revisions:  revision sets, current + document revision, show mode
 ├─ blocks[]:   ordered paragraphs
 │    { id, style: "Scene Heading" | "Action" | … | custom,
 │      runs: [{ text, marks: bold|italic|underline|strike|highlight|
 │                            link|tag|revision }],
 │      overrides?: align, indent adjust, keepWithNext, breakBefore,
 │      sceneNumber?, omitted?, dualGroup?, alts? }
 └─ overlays:   synopses, notes, bookmarks, folders (anchored by block id)
```

- The model deliberately mirrors Open Screenplay Format's structure (styles with `basedOn`; paragraphs with a style and text runs). That makes .fadein import and export close to lossless.
- Changing an element's type changes `style` only; the text is untouched.
- The **scene index** (scenes, folders, characters per scene, locations) is derived from blocks and updated incrementally on every edit. The Navigator, reports, autocomplete and lists all read from it.
- Every edit is a **transaction**, which gives undo/redo (unlimited, as in Fade In), autosave and, later, revision mode.
- It lives in `@midlander/core`, a pure TypeScript package with **no UI dependency**, fully unit-tested.

### 5.2 Editor

**ProseMirror** (MIT licence) with a custom screenplay schema: one node type per element style. It already provides cursor, selection, IME input, history, clipboard and accessibility.

- Element flow, autocomplete, auto-detection, smart caps and shortcuts are ProseMirror **keymaps and plugins** that read the style table. That makes them configurable, as in Fade In.
- The core model stays the source of truth; ProseMirror is a synchronised view of it.

### 5.3 Pagination and layout engine

Screenplays use a monospaced font (Courier 12pt: 10 characters per inch, 6 lines per inch). So Midlander lays out every line itself, without asking the browser to measure text. This makes page breaks identical on macOS, Windows and in PDF, and fast enough to repaginate on every keystroke (worker thread, incremental from the edited page).

**Steps:**
1. Wrap each block to its width: page width minus margins minus style indents (Fade In's defaults are in §R2).
2. Apply space-before.
3. Fill pages to the line limit.
4. Apply the break rules below.

**Break rules:**
- **Keep With Next** (Scene Heading, Character, Parenthetical and Shot have it by default).
- **Dialogue split** with (MORE)/(cont'd), optionally only at sentence boundaries ("break on sentences" setting).
- **Action split** with a minimum number of lines on each side.
- **Page Break Before.**
- **Locked pages**: overflow becomes A-pages using the selected numbering mode.

Exact minimum-line thresholds will be tuned against Gerard's Fade In PDFs (checklist F2).

The editor shows those page breaks as page gaps, page numbers and (MORE)/(cont'd) decorations, so what you see while writing is the final page.

**Font:** ship **Courier Prime** (SIL Open Font Licence, free to bundle) as the default. It's also one of the fonts Fade In's knowledge base recommends. Any installed Courier can be chosen instead.

### 5.4 PDF and print

Own PDF generation (`pdf-lib`, MIT) from the layout engine's output: exact positions, embedded font, selectable text, scene bookmarks, revision colours and asterisks, watermarks.

Print works like Fade In's:
1. Midlander's own print dialog (page ranges with A-pages, revisions, character sides).
2. Midlander generates the PDF.
3. The system print dialog.

### 5.5 Import / export

| Format | Difficulty | Notes |
|---|---|---|
| **.fadein** | Medium | Confirmed: a **zip containing `document.xml`** in Open Screenplay Format. Lengths are in tenths of a millimetre; styles carry `basestylename`, `style_enter`, `style_tab_before`, `style_tab_after`, indents, spacing and caps; paragraphs carry a style and text runs. We write our own reader/writer, tested against files Gerard exports, and handle several format versions (version 20 in the bundled templates; a third-party example shows 40; your 4.1.1 sample will confirm) |
| Fountain | Low | Public open spec (fountain.io). Round-trips notes, synopses and sections |
| FDX | Medium | XML; widely implemented. Paragraph types, title page, revisions, dual dialogue, scene numbers |
| Plain text / HTML | Low | — |
| RTF / DOCX | Medium | Export first; import later |
| PDF import | High | Best-effort heuristics; late |

Every importer gets a **round-trip test**: import → export → re-import → compare models.

### 5.6 Storage, autosave, recovery

- **Native format `.midlander`**: a zip containing `document.json` plus any images, with a format version number. Being JSON makes it easy to keep stable and to diff. (Using .fadein as the native format was considered, but Midlander needs room to add its own features without breaking Fade In compatibility. .fadein stays fully supported for open and save.)
- **Autosave**: on an interval chosen in Preferences, to `~/Library/Application Support/Midlander/autosave`. Recovery is offered on launch and from **File > Recover Backup**.
- **Safe saves**: write to a temporary file, then atomically rename.
- **No SQLite** for v1: documents are files and preferences are JSON.

### 5.7 Preferences

JSON in the app data folder, with schema and defaults. Sections and options mirror Fade In's General / Editing / User Interface (§R9).

### 5.8 Reports and tools

All reports are pure functions over the document model → table → on-screen view, HTML, CSV or PDF. Fade In's definitions are followed, e.g.:
- the Cast report counts lines at 50 letters per line;
- the Scene report shows length in eighths and marks a character's first appearance in bold italic.

### 5.9 Known hard parts and risks

| Risk | Mitigation |
|---|---|
| Exact page-break parity with Fade In | Page-by-page comparison against Gerard's Fade In PDFs; adjustable thresholds |
| Revisions + locked pages + A-pages + numbering modes | Built after core pagination is stable; dedicated test scripts |
| Typing performance on long scripts | Incremental layout in a worker; benchmark with a 150-page script from day one |
| macOS Monterey ages out of toolchains | Build on GitHub's current macOS machines; keep the app's minimum macOS at 12 for as long as Tauri allows |
| .fadein format versions | Test files from Gerard's 4.1.1 plus the bundled templates' older version |

---

## 6. Recommended technology stack

| Layer | Choice | Why |
|---|---|---|
| Desktop shell | **Tauri 2** (Rust) | Small, fast apps (~10 MB vs ~150 MB); runs on macOS 12. **Electron is ruled out: v44+ requires macOS 13** |
| UI | **TypeScript + React** | Mature, well known, good for menus/panels/dialogs |
| Editor | **ProseMirror** | Best-in-class structured editor; schema = screenplay elements |
| Layout/pagination | Own TypeScript engine (in a Web Worker) | Deterministic, monospaced-aware, same on every platform |
| PDF | **pdf-lib** | Precise placement, font embedding |
| Native menus, dialogs, files | Tauri APIs | A real macOS menu bar |
| Tests | Vitest (unit), Playwright (UI), golden PDF comparisons | — |
| Build & release | **GitHub Actions** on macOS + Windows runners | Downloadable .dmg / .exe on every release |
| Monorepo | pnpm workspaces | Separate packages (below) |

Tauri uses each system's own web engine, so text measurement could differ between Mac and Windows. That doesn't matter here, because Midlander never relies on the browser for pagination (§5.3).

### Repository layout

```
midlander/
  packages/
    core/       document model, transactions, scene index, lists (no UI)
    layout/     pagination engine
    formats/    fadein (OSF), fountain, fdx, txt, html, rtf/docx
    pdf/        PDF writer
    reports/    reports and statistics
    editor/     ProseMirror schema, keymaps, plugins
  app/          Tauri + React application (menus, panels, dialogs)
  test-scripts/ sample screenplays + golden PDFs (only scripts Gerard is happy to publish)
  docs/         spec, reference notes, shortcuts, status, decisions
```

---

## 7. Development roadmap

Each phase ends with something Gerard can download and try on his Mac, plus an updated `STATUS.md`.

| Phase | Delivers | Gerard's part |
|---|---|---|
| **1. Research & spec** (now) | This document, reference notes, keymap | Approve or amend; send the remaining checklist items; enable package installs in Claude settings |
| **2. Architecture & skeleton** | Monorepo; core model with tests; .fadein reader proven on your sample; Tauri app with native menus; GitHub Actions producing a downloadable `.dmg` | Download, open on Monterey, report whether it launches |
| **3. Core editor** | All elements; Enter/Tab flow; Cmd+1–7; auto-detect; autocomplete; caps; live pagination with (MORE)/(cont'd); undo/redo; Page View; zoom | Write a few pages the Fade In way; report anything that feels "off" |
| **4. Interface** | Format/Roster panel, Navigator, Find/Replace, Go To, toolbar, status bar, full screen modes, focus, dark mode, tabs, Preferences, shortcut editor | Side-by-side comparison with Fade In |
| **5. Files** | .midlander save/open, autosave, recovery, recent files; .fadein, FDX, Fountain, text import/export; title page; header/footer; Create PDF; Print | Open your real scripts; compare PDFs with Fade In's |
| **6. Advanced** | Element style editor, templates, dual dialogue, synopses, notes, bookmarks, folders, index cards, scene/page numbering and locking, revisions, omit, reports, Dialogue Tuner, rename character, This Session, spelling | Test with a production-style script |
| **7. Testing & refinement** | Full test screenplay; page-by-page PDF comparison; keyboard workflow tests; long-script performance; fixes | Final comparison against Fade In |
| **8. Release prep** | App icon, signed + notarised builds, website/README, licence, auto-update | Apple Developer account; licence decision |

**Definition of done for v1.0:**
- All P0 and P1 features work, with no placeholder items.
- The test screenplay paginates within one line of Fade In's PDF on every page.
- Round-trip tests pass for .fadein, FDX and Fountain.

---

## 8. Decisions needed from Gerard

1. **Approve this spec** (or tell me what to change).
2. **Licence**: open source (e.g. GPL-3.0 or MIT) or closed/commercial. Needed before the first public release.
3. **Default paper size**: US Letter (Fade In's default, industry standard) or A4. Both are supported.
4. **Repo visibility**: currently **public**.
