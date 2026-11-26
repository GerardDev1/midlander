# Midlander

A professional desktop screenwriting application for macOS and Windows, designed to feel instantly familiar to writers who know Fade In.

**Status:** Phase 3. You can write a screenplay the Fade In way (elements, Enter/Tab flow, Fade In's shortcuts, autocomplete, live pagination with (MORE) and (cont'd), undo) and save it as a Midlander script. Fade In scripts open for editing and are never overwritten. Panels, Find and the Navigator come in Phase 4.

## Trying the app

Builds are made by GitHub Actions on every change to `main`:

1. Open the repository's **Actions** tab, then the latest **Build app** run.
2. Under **Artifacts**, download **Midlander-macos** (or **Midlander-windows**) and unzip it.
3. On a Mac, open the `.dmg` and drag Midlander to Applications.
4. The app isn't notarised by Apple yet, so the first time, **right-click Midlander > Open**, then **Open** again. After that it opens normally.

- [Specification](docs/SPEC.md): features, interface, shortcuts, architecture, roadmap
- [Status](docs/STATUS.md): what's done and what's planned
- [Fade In reference notes](docs/FADE-IN-REFERENCE.md) and [default keymap](docs/SHORTCUTS.md)

## For developers

Requires Node.js 22.18 or later. No installs are needed to run the tests:

```sh
npm test            # unit tests
npm run typecheck   # needs typescript + @types/node (npm install)
npm run test:e2e    # editor tests in Google Chrome, with Mac and Windows key bindings (npm install first)
```

Compare Midlander's layout of a .fadein script with a PDF exported from Fade In:

```sh
python3 tools/extract-pdf-lines.py script.pdf > script.lines.json   # needs pdfplumber
node tools/compare-layout.ts script.fadein script.lines.json --verbose
```

| Package | Contents |
|---|---|
| `packages/core` | Screenplay document model (no UI dependency) |
| `packages/formats` | .fadein import, .midlander save/open; zip/XML utilities; more formats to come |
| `packages/editor` | Editing: typing, element flow, undo, clipboard, auto-detect, autocomplete (no UI dependency) |
| `packages/layout` | Pagination engine: pages of positioned lines, shared by editor, PDF and print |
| `app` | Desktop app: React page view (`app/src`) and Tauri shell with native menus (`app/src-tauri`) |

Run the interface in a browser while developing (`npm run app:dev`, then open http://localhost:1420). Building the desktop app locally needs Rust; see [Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/), then `cd app && npx tauri dev`.

Midlander is independently developed and is not affiliated with or endorsed by Fade In or its developers.
