# 0002: App shell: Tauri 2, React page view, menus in Rust, builds on GitHub Actions

Date: 2026-11-26 · Status: accepted

## Context

Phase 2 needs a real desktop app Gerard can download and open on macOS 12 (Monterey), built without his Mac doing any compiling. The spec (§6) chose Tauri 2 and React. This record covers the choices made while building the shell.

## Decision

1. **`app/`** holds the desktop app: a Vite + React web interface (`app/src`) and the Tauri shell (`app/src-tauri`, Rust). It imports the existing packages directly (`../../packages/...`); it adds no runtime dependencies to them.
2. **The page view draws, it doesn't lay out.** `app/src/pageModel.ts` converts the layout engine's output (line numbers and character columns) into inch positions, and React places each line absolutely. The browser never decides where a line or page breaks, so the screen matches the comparison tool and, later, the PDF.
3. **The .fadein zip is opened in Rust, not in the webview.** The TypeScript zip reader relies on `DecompressionStream`, which WebKit only gained in Safari 16.4. A Monterey Mac may still have an older Safari, so the Rust side unzips the file (`zip` crate) and passes the XML to the existing, tested `readOsfXml`. The TypeScript zip reader stays for tests, tools and the browser preview.
4. **Native menus are built in Rust** (`app/src-tauri/src/lib.rs`), with Fade In's shortcuts from `SHORTCUTS.md`. Only working items are included (rule 2): Open, Close, Quit/Exit, Copy, Select All, Zoom In/Out/100%, About, and the standard macOS app and Window items. File > Close is disabled when no script is open. Full screen is left out until the full-screen modes are built, because Fade In uses Option+Enter rather than the macOS default.
5. **Builds run on GitHub Actions.** `build-app.yml` makes one *universal* macOS `.dmg` (Intel and Apple silicon) with `minimumSystemVersion` 12.0, plus a Windows installer. `ci.yml` runs all tests on every push and pull request.
6. **Ad-hoc code signing** (`signingIdentity: "-"`) until there is an Apple Developer account (Phase 8). Apple silicon refuses unsigned code, and an ad-hoc signature is enough to run locally, but Gatekeeper still treats the app as "from an unidentified developer". The first launch needs right-click > Open.
7. **Browser preview.** `npm run app:dev` runs the same interface in a normal browser with a file picker in place of the native dialog. It's used for development and automated screenshots only.

## Consequences

- Opening a file twice in a row, double-clicking a .fadein file in Finder, and "Open Recent" are not wired up yet. File associations need care so Midlander doesn't take over .fadein files from Fade In, so it is a deliberate later choice.
- Fonts: the page view asks for each style's font (Courier New in Fade In's defaults), then Courier Prime and Courier. Line positions don't depend on the font, but glyph shapes do. Bundling a licensed screenplay font is a Phase 5 item, alongside the PDF writer.
- Inline formatting (bold or italic words within a line) is in the document model but not drawn yet. Lines use their element style only.
