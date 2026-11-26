# Midlander

A professional desktop screenwriting application for macOS and Windows, designed to feel instantly familiar to writers who know Fade In.

**Status:** Phase 2. The core engine (document model, .fadein import, page layout) is verified against Fade In's output. The first desktop app opens .fadein scripts read-only and shows them page by page. Writing and editing come in Phase 3.

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
```

Compare Midlander's layout of a .fadein script with a PDF exported from Fade In:

```sh
python3 tools/extract-pdf-lines.py script.pdf > script.lines.json   # needs pdfplumber
node tools/compare-layout.ts script.fadein script.lines.json --verbose
```

| Package | Contents |
|---|---|
| `packages/core` | Screenplay document model (no UI dependency) |
| `packages/formats` | .fadein import; zip/XML utilities; more formats to come |
| `packages/layout` | Pagination engine: pages of positioned lines, shared by editor, PDF and print |
| `app` | Desktop app: React page view (`app/src`) and Tauri shell with native menus (`app/src-tauri`) |

Run the interface in a browser while developing (`npm run app:dev`, then open http://localhost:1420). Building the desktop app locally needs Rust; see [Tauri's prerequisites](https://v2.tauri.app/start/prerequisites/), then `cd app && npx tauri dev`.

Midlander is independently developed and is not affiliated with or endorsed by Fade In or its developers.
