# Fade In reference notes

Behaviour notes on Fade In **4.1.1**, written in our own words. Sources:
- the help manual and templates bundled with Gerard's installed copy (supplied 2026-11-26);
- Fade In's public knowledge base.

These notes record *what Fade In does*, so Midlander can behave the same way. No Fade In files, text, icons or code are stored in this repo. Keyboard shortcuts are in `SHORTCUTS.md`.

---

## 1. Element styles

Eight built-in styles. All are based on **Normal Text** (also called Unformatted Text); change Normal Text's font and all of them change.

### 1.1 Element flow (Enter and Tab)

Each style has three "next style" settings: **Enter**, **Tab on an empty line** ("tab before") and **Tab at end of a line** ("tab after"). A blank setting means "stay the same style". All three are editable per style in Modify Element Style.

| Style | Enter → | Tab on empty line → | Tab at end of text → | Caps | Keep with next |
|---|---|---|---|---|---|
| Scene Heading | Action | (none) | Action | yes | yes |
| Action | (Action) | Character | (none) ¹ | no | no |
| Character | Dialogue | Action | Parenthetical | yes | yes |
| Parenthetical | Dialogue | Dialogue | Dialogue | no | yes |
| Dialogue | Action | Parenthetical | Parenthetical | no | no |
| Transition | Scene Heading | (none) | Action | yes | no |
| Shot | Action | (none) | Action | yes | yes |

Values come from a script saved by Gerard's Fade In 4.1.1 and match the help manual.

¹ Action has no "tab after" setting in 4.1.1, which fits the help's description: Tab at the end of a non-empty Action paragraph acts like Enter. (An older template from Fade In 2.0 had Character here.)

### 1.2 Other element behaviours

- Scene headings get **two** blank lines before them by default; most other elements get one. Parenthetical and Dialogue get none.
- **Auto-detection** (Preferences > Editing, "reformat character names, transitions, etc."): typing `int. study - day` on a blank line turns it into a Scene Heading; obvious transitions and character names are reformatted as you type.
- Deleting across elements is prevented from accidentally merging different element types.
- **Enter on a blank line can pop up an element menu** (an optional preference).
- **Act breaks**: a style can be marked as an act break, which ends the current scene for numbering purposes (TV templates use "New Act", "End of Act").
- **Custom styles**: created per document and based on another style. Each has a name, font, size, bold/italic/underline, colour, left/right indent, alignment, space before, line spacing, keep-with-next, page-break-before, act break and the Enter/Tab settings. Built-in styles can't be deleted.
- Per-word formatting: bold, italic, underline, strikethrough, highlight (several colours, searchable), font, case toggle.
- **Adjust line length**: a per-paragraph indent override, shown with the ruler. **Auto Adjust Lines** finds paragraphs where a slightly longer line would pull a single orphaned word back up.
- **Keep With Next** and **Page Break Before** are per-paragraph options.
- **Dual dialogue**: applied to the selected character + dialogue and the immediately following character + dialogue.
- **Quick Reformat**: a dialog for quickly reformatting all or part of a document. On Mac it uses number keys, needing "keyboard navigation of all controls" enabled.

## 2. Page layout (Fade In 4.1.1 screenplay)

Values are from a script saved by Gerard's 4.1.1 (`saved_with="4.1.1.1038"`). Fade In stores lengths in **tenths of a millimetre**. Indents are measured from the page margins.

| Setting | Stored | = | Older 2.0 template |
|---|---|---|---|
| Page | 2159 × 2794 | US Letter, 8.5" × 11" | same |
| Margin top / bottom | 266 / 228 | 1.05" / 0.90" | 1.25" / 0.87" |
| Margin left / right | 317 / 317 | 1.25" / 1.25" | same |
| Text width | — | 6.0" = 60 characters of Courier 12 | same |
| Lines per inch | 6.0 | — | same |
| Character left indent | 635 | 2.50" (text starts 3.75" from page edge) | 2.70" |
| Parenthetical indent L / R | 508 / 508 | 2.00" / 2.00" → 2.0" wide (20 chars) | 2.20" / 2.00" |
| Dialogue indent L / R | 330 / 254 | 1.30" / 1.00" → 3.7" wide (37 chars) | 1.50" / 1.00" |
| Transition indent L / R | 1016 / 127 | 4.00" / 0.50", right-aligned | right-aligned only |
| Space before | — | Scene Heading 2 lines; Action, Character, Transition, Shot 1; Parenthetical, Dialogue 0 | same |
| Break dialogue on sentences | `true` | — | `false` |
| Header | `#.` right-aligned, not on page 1 | — | same |

- **Font:** Fade In 4.1.1's default is **Courier New** (confirmed by Gerard).
- **Bold scene headings:** Gerard's own choice (Modify Element Style > Scene Heading > Bold), not a default.

### 2.0a Measured from Fade In's PDF output

These are from a 5-page script (plus title page) that Gerard exported with Create PDF. The script itself is private and not in this repo.

These numbers are the layout engine's acceptance targets.

| Measurement | Value |
|---|---|
| Character width / line height | 7.2 pt (10 per inch) / 12 pt (6 per inch) |
| Text left edge | 89.5 pt (1.25"); Action wraps at **60** characters |
| Dialogue | starts 183.1 pt (2.55"); wraps at **37** characters |
| Character cue | starts 269.5 pt (3.75") |
| Top text line | glyph tops at 73.4 pt from the page top (1.05" top margin) |
| Page capacity | **54 lines** (9.05" ÷ 1/6"), confirmed: (MORE) printed on line 54 (709.4 pt) |
| Page number | `2.` right-aligned to the right margin (ends at 7.25"), about 0.44" from the top. **None on page 1** (header_first_page=false) |
| Title page | Unnumbered and doesn't count towards page numbers. Script page 1 is PDF page 2 |
| Wrapping | Word wrap at spaces only; trailing spaces ignored. A missing space after `.)` stays joined (`up.)She`) |

**Observed pagination rules:**
1. **No space-before at the top of a page.** A Scene Heading or Action that starts a page sits on line 1, without its usual blank lines.
2. **A Character cue with little room left moves with its dialogue.** In one case the cue would have landed on line 53, leaving room for only one dialogue line before (MORE) on line 54. Fade In moved the whole speech instead, so a split needs **at least 2 dialogue lines** on the first page. The exact minimum is still to confirm.
3. **Scene Heading keeps with next.** A heading with no room for the first line of the following Action moved to the next page.
4. **Automatic `(cont'd)`**: "TOM (cont'd)" appears when the same character speaks again after only Action in between. It's lowercase and separated by one space.
5. **Empty paragraphs take up space.** An empty Action paragraph still takes its blank line plus one empty line.
6. **Dialogue split across a page** (second sample, a 12-line speech with the cue on line 44):
   - **Where it splits:** after the last complete **sentence** that fits ("…okay?"). The setting `break_on_sentences="true"` is on, and the split is not forced at the last line that fits. This one went 9 lines on the first page and 3 on the next.
   - **(MORE):** on its own line directly below the last dialogue line, at the **Character indent** (3.75"). That line counts within the 54: dialogue ended on line 53, (MORE) took line 54.
   - **Continued cue:** at the top of the next page, the cue is repeated as `CAROL (O.S.) (cont'd)` (extension kept, then " (cont'd)"). It's printed **one line above the normal first line**: at 61.4 pt, in the top margin. So the continued dialogue still starts on line 1 and the cue doesn't use up a body line.
   - The rest of the page then flows normally (Action after the speech gets its usual blank line).
7. **Still unknown:** the minimum number of dialogue lines on each side of a split; how Action is split (sentence boundary, minimum lines); whether a Parenthetical can end a page.

**Scene lengths in eighths** (as reported by Fade In in its FDX export) for the six scenes:
`1 3/8`, `1/8`, `4/8`, `1/8`, `5/8`, `1 6/8`.
- Each scene's length is at least 1/8.
- These values are a test oracle. The exact counting rule (which lines count, and how rounding works) will be fitted against these plus a longer sample.

### 2.0 How text is stored

- Text is stored **as typed**: `int. Bathroom cubicle - morning`. Capitals are applied when displayed. Midlander does the same.
- Character extensions are part of the Character paragraph's text: `carol (O.S.)`.
- Locations are stored without the intro and the final time, but keep other parts: `car - outside parents house`.

Other page settings stored in the file:
- break dialogue on sentences;
- dialogue continues across page breaks;
- `(cont'd)` and `(MORE)` text;
- scene CONTINUED on/off and its text;
- OMITTED text;
- scene-time separator `" - "`;
- header `#.` right-aligned, not shown on the first page;
- footer;
- page/scene numbering modes;
- locks;
- dialogue numbering;
- revision display.

### 2.1 More and Continued

- By default, dialogue split across pages gets `(MORE)` at the bottom and `NAME (cont'd)` at the top of the next page.
- A character who speaks again right after their own last speech in the same scene also gets `(cont'd)`.
- Optional `CONTINUED` at the top/bottom of pages for scenes spanning pages.
- Any of these is disabled by leaving its text blank.

### 2.2 Header and footer placeholders

| Token | Meaning |
|---|---|
| `#` | page number |
| `*` | revision of this page |
| `**` | document revision |
| `@` | current date |
| `\` before a token | literal character |
| `{Date}`, `{Filename}`, `{Page}`, `{Pages}` | as named |
| `{PageColor}`, `{PageRevision}`/`{PageRev}`, `{Revision}` | revision fields |
| `{yy-mm-dd}`, `{d-m-yyyy}`, `{mmm. d, yyyy}` | date formats |
| `{Title}`, `{Subtitle}`, `{Author}`, `{Contact}`, `{Copyright}`, `{Draft}` | from title page bookmarks |
| `{Scene Heading}` or `{Scene}` | current scene number |
| `{"Scene"<25}` | current scene heading text, truncated |
| `:0n` suffix | zero-pad, e.g. `{Scene:03}` |
| `{Field? text}` | adds "text" only if the field is non-empty |

Midlander implements the same token language, so headers from imported .fadein files keep working.

### 2.3 Title page

A separate, editable sub-document. Paragraphs can carry bookmarks: Title, Subtitle, Author, Copyright, Contact, Draft. Multi-line fields use Shift+Enter inside one paragraph.

## 3. Lists and autocomplete

- **Lists:** Characters, Locations, and "Other" (Scene Intros, Scene Times, Character Extensions, Transitions).
- **Characters** are added automatically as they're typed. Each can have a gender (F/M/T) and a "retain" flag, which keeps it through a rebuild. Setting a gender implies retain.
- **Locations** are added automatically from scene headings, after stripping the intro (INT./EXT.) and the time (- DAY).
- **Rebuild** clears non-retained items and rescans the script. **Sort** sorts alphabetically. **Reset** restores defaults (Other lists).
- **Autocomplete:**
  - Context-aware: e.g. "i" on a blank Scene Heading offers INT. and INT./EXT.
  - Up/Down to move through suggestions; Enter or Tab to accept (a single match is accepted directly).
  - Esc dismisses; Esc again re-shows.
  - Optional: guess the next speaker when two or more characters alternate.
- **Manage Lists** (Document menu) can import lists from another document.

## 4. Navigation

- **Navigator**:
  - Lists all scene headings and follows the current scene. Enter or double-click jumps there.
  - Multi-select, cut/copy/paste, drag-and-drop (only scene headings can be dragged).
  - Show options: synopses; length in **eighths of a page** or estimated running time (one minute per page).
  - **Folders**: drag a scene beneath another to nest it. The drop depth depends on the mouse's horizontal position. Moving a folder moves its contents. "Flatten This Folder" un-nests.
  - Since v5, also lists notes and bookmarks.
- **Index cards** (Document > Index Cards):
  - One card per scene, showing synopsis or scene text.
  - Optionally organised by Navigator folders, and coloured by synopsis colour.
  - Add, move, copy or delete cards. Cmd-click a card to jump to that scene in the editor.
- **Go To**: jump to a scene, page or bookmark.
- **Find**: a panel; Esc closes it. **Find and Replace**: a dialog with direction and match-case options. Find Next/Previous wraps around the document.
- **Synopses** (attachable to any paragraph, with a colour category), **notes** (sticky notes, never printed), **bookmarks** and **links** (to bookmarks or URLs; Cmd-click follows them). Each has show/hide icons; hiding also excludes them from exports.

## 5. Views

- **View modes:**
  - **Normal**: page layout without separated pages.
  - **Page View**: separated pages.
  - **Continuous**: no page breaks.
  - **Side by Side**: several pages across.
- **Layouts**: Left/Right/Top/Bottom presets; save and restore a custom layout. Panels dock, float and resize. The layout is restored on relaunch.
- **Tabs**: one document per tab. Tabs can be split side by side and joined back. A document list popup shows all open documents.
- **Format/Roster panel** with tabs: Format, Characters, Locations, Other. Double-click an item to apply it.
- **Toolbar**: customisable via right-click > Customize Toolbar.
- **Custom view colours** (dark mode), **focus current text**, **show invisibles** (spaces, hard and soft returns, column blocks), **zoom**, **full screen** (menu still visible) and **full screen minimal** (everything hidden).

## 6. Production

- **Page numbering:** Lock Page Numbers / relock / Unlock Current Page / Edit Page Number / Renumber Pages (needs locked pages).
- **Scene numbering:** show/hide and format. Lock / relock / edit / renumber. Option to skip numbering intro-less headings.
- **Additional numbering:** other elements, e.g. dialogue in animation scripts. In dual dialogue only the outside is numbered; parentheticals are never numbered.
- **Numbering modes for inserts:**
  - `1AB`: 1, 1A, 1AA, 1AB, 1B, 2 (the default)
  - `1A2`: 1, 1A, 1A1, 1A2, 1B, 2
  - `AB2`: 1, A2, AA2, AB2, B2, 2
  - `BA2`: 1, A2, AA2, BA2, B2, 2
  - `XIV`: Roman numerals, with inserts as I(A), I(B)
  - `xiv`: lowercase Roman numerals
- **Revisions:**
  - Standard colour order: White → Blue → Pink → Yellow → Green → Goldenrod → Buff → Salmon → Cherry → Tan. Names and colours are editable per document, and can be saved and loaded.
  - **Revision mode** auto-marks edits with `*` in the margin and flags the page with the revision colour.
  - **Current revision** and **document revision** can differ.
  - Show options: none, current, all, page revision (highest on the page), or selected colours.
  - Mark / Unmark selection. Modify Revisions changes one colour to another.
  - A-pages created in revision mode take the current colour.
  - Optional on-screen coloured pages and coloured revised text.
- **Omit Scene / unomit** (OMITTED placeholder).
- **Scene Versions**: saved, labelled versions of a scene that you can switch between.
- **Alternates**: several versions of one element.
  - Add, delete, next/previous.
  - Show inline as `alt1 // alt2`, separate them again, or edit them in a dialog.
- **Tagging window:**
  - Categories (cast, stunts, vehicles, props, camera, wardrobe, effects… customisable).
  - Tag the selection; Tag All (once per scene or every occurrence); Auto Tag (e.g. all characters as Cast).
- **Reports** (print, HTML or CSV):
  - **Scene**: number, heading, page, eighths, dialogue count per character; first appearance in bold italic.
  - **Cast**: dialogues, words, lines at 50 letters/line, speaking scenes, total scenes.
  - **Character**: scenes per character, speaking and optionally non-speaking.
  - **Dialogue**: all of one character's lines.
  - **Gender**: inclusivity by speaking role.
  - **Location**: by INT./EXT. with scene and page.
  - **Notes**, **Synopsis**, **Revisions**, **Tagging**.
  - **Element**: custom, by element type.
  - **Statistics**: lengths, word usage.

## 7. Document tools

- **Change Character Name** throughout the script, with correct formatting.
- **Dialogue Tuner**: view and edit all of one character's dialogue.
- **Check Spelling**: per-document and global dictionaries, choice of language.
- **Online Tools**: configurable dictionary/thesaurus URLs using `%s`.
- **Compare to Previous**: highlights additions and deletions, or marks them as revisions.
- **Find Errors**: a configurable set of formatting checks.
- **Table Read**: system voices assigned per character, with play/rewind/fast-forward.
- **Images**: insert on the title page or in the script; resize by percentage, within margins.

## 8. Files

- **Native .fadein**: a **zip archive containing `document.xml`** in Open Screenplay Format XML. The root is `<document type="Open Screenplay Format document" version="…">`, with sections:
  - `info`, `settings`, `fadein_settings`;
  - `styles` (including header/footer style);
  - `paragraphs` (each `<para>` has a `<style basestylename=…/>` and one or more `<text>` runs with formatting attributes);
  - `titlepage`;
  - `spelling`;
  - `lists` (characters, locations, scene_intros, scene_times, extensions, transitions, revision_colors, tag_categories).

  Templates are the same format with `is_template="true"`.

  **Format versions differ.** Files from 4.1.1 are `version="41"` and use `basestyle="…"`. The 2.0-era templates are `version="20"` and use `basestylename="…"`. The reader must accept both.

  Version 41 also has `info/@draft_uuid`, `a_pages`, `ab_pages`, `spelling/ignored`, `lists/highlight_rules`, and extra settings (`number_continued`, `document_revision`, `revision_mode`, `show_revisions="all"`, `selected_revisions`). The `fadein_settings` section records the saving app version and OS, the last cursor position, and Navigator / index-card view options.

- **Default lists in a new 4.1.1 script** (standard industry terms; Midlander ships equivalent defaults):
  - Scene intros: INT., EXT., INT./EXT.
  - Scene times: DAY, NIGHT, MORNING, AFTERNOON, EVENING, LATER, MOMENTS LATER, CONTINUOUS, THE NEXT DAY.
  - Extensions: (V.O.), (O.S.), (O.C.), (SUBTITLE).
  - Transitions: CUT TO:, FADE IN:, FADE OUT, FADE TO:, DISSOLVE TO:, BACK TO:, MATCH CUT TO:, JUMP CUT TO:, FADE TO BLACK.
  - Revision colours: White plus the nine standard colours, each marked `*`.
  - Tag categories: Cast, Background Actors, Stunts, Vehicles, Props, Camera, Special Effects, Wardrobe, Makeup/Hair, Animals, Animal Handler, Music (each with a colour).
- **Open:** .fadein only. Everything else goes through **Import**:
  - Adobe Story, Celtx, Final Draft (.fdx, .fdr), formatted text, Fountain, Highland, HTML, RTF, screenplay PDF, Scrivener, unformatted text, OSF .xml;
  - Word .docx (per the KB).
- **Export:**
  - Avid Script-Based Editing .txt, EPUB (book or script), FDX, formatted text, Fountain, HTML, Open Scheduling Format .xml, RTF, Scrivener (import and split) RTF, unformatted text, OSF .xml;
  - Word .docx (per the KB);
  - holding Shift or Option shows extra options such as scene numbers.
- **Other File menu items:**
  - Open Recent (count set in Preferences); Close; Revert to Saved; Save All.
  - Templates: New From, Manage, Apply, Save As (Shift skips fonts).
  - Extract pages to a new document, and join documents.
  - Find File on Disk; Recover Backup (.autosave files); document Password.
  - Create PDF; Batch Watermark; Print Setup; Print Preview.
  - **Print**: Fade In's own dialog first (A-page ranges like `1-2,3B-9A`, revisions, character sides, element highlighting), then the system dialog.
  - **This Session**: time, words typed, net new pages, and a writing timer.
- **What Fade In's exports look like** (from Gerard's sample):
  - **Fountain**:
    - Title page keys `Title`, `Author`, `Draft date` (from the Draft bookmark), `Copyright`, `Contact`; multi-line values are indented.
    - Scene headings and character cues are written in capitals.
    - Extensions are kept inline: `CAROL (O.S.)`.
    - An empty Action paragraph becomes extra blank lines.
  - **FDX**:
    - `<FinalDraft DocumentType="Script" Version="2">`.
    - Paragraph types match the element names.
    - Each Scene Heading carries `<SceneProperties Length="1 3/8" Page="1">`.
    - Styles are written as Final Draft `ElementSettings`, with absolute indents in inches: Character 3.75; Dialogue 2.55–6.25; Parenthetical 3.25–5.25 with −0.10 first-line indent; Transition 5.25–6.75, right-aligned. Space-before is in points (Scene Heading 24 = 2 lines).
    - Also written: `SmartType` lists, `MoresAndContinueds`, nine revision colours, header with a page-number label, a title page, and many Final Draft defaults (macros, table-read voices, tag categories). Midlander's FDX writer only needs the parts that carry script content and formatting.
- **Formatted Text (.txt) export:**
  - Character cue at 25 spaces, dialogue at 12 spaces.
  - Dialogue wraps at **36** characters (one fewer than the PDF's 37), and Action at 58–60.
  - Automatic (cont'd) is included; page breaks are not marked.
  - It's an approximation of the page, not an exact copy, and is low priority for matching.
- **Fade In demo version:** PDFs carry the line "(Printed with the demonstration version of Fade In)" at the top. This is ignored when comparing.
- **Fountain editing** (optional): Copy as Fountain, Paste as Fountain, Edit as Fountain.
- **Autosave** writes to `~/Library/Application Support/Fade In/autosave` on Mac, at the interval set in Preferences.

## 9. Preferences

- **General:**
  - reopen last document; reopen all tabs; remember editing position;
  - automatic backup interval; number of recent documents;
  - units (inches/cm); default font; default spelling language; update notifications.
- **Editing:**
  - autocomplete; guess next speaker; auto-reformat obvious elements;
  - spell check; autocorrect; autocapitalise first word; fix DOuble CAps; smart quotes;
  - smart selection; Fountain editing; Enter-on-blank-line element menu; online tools.
- **User Interface:**
  - brightness; theme; revision colour display; custom view colours; splash screen;
  - keep typing centred (typewriter scrolling); block cursor; always show ruler;
  - system selection colour; shortcut keys; reset user interface.

## 10. Menus at a glance

**File, Edit, View, Format, Document, Production, Collaborate, Help.** On Mac, Preferences is under the app menu.

| Menu | Main items |
|---|---|
| Edit | Undo/Redo, Cut/Copy/Paste/Delete, Fountain submenu, Select All, Find, Find and Replace, Find Next/Previous, Go To, Extensions (third-party web tools) |
| Help | Help, Start Page (new from template / recent), Shortcut Keys, Website, Support, Knowledge Base, Release Notes, Check for Updates, Register, About |
| Collaborate | Start, Join, Status, Resync, Leave, Chat (out of scope for Midlander v1) |

## 11. Still unknown (needs screenshots or tests)

- Exact visual layout: toolbar buttons, panel sizes, status bar (if any), and the Start Page.
- Minimum lines on each side of a dialogue split; how Action is split across pages. The golden test script will cover both.
- The exact rule for counting scene length in eighths.
- Contents of the Preferences dialogs, Page Layout, Header/Footer and Reports dialogs.
