# Midlander

A professional desktop screenwriting application for macOS and Windows, designed to feel instantly familiar to writers who know Fade In.

**Status:** Phase 2: the core engine (document model, .fadein import, page layout) is working and verified against Fade In's output. No app to download yet.

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

Midlander is independently developed and is not affiliated with or endorsed by Fade In or its developers.
