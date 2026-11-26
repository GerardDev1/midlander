# 0001: Core architecture: dependency-free TypeScript core, own layout engine

Date: 2026-11-26 · Status: accepted

## Context

Midlander's hardest requirement is producing page breaks identical to Fade In's, in the editor, in PDF and in print, on macOS and Windows. Browser text layout differs between WebKit (macOS Tauri) and Chromium (Windows WebView2), so it can't be trusted for pagination.

## Decision

1. **`packages/core`**: the screenplay document model, pure TypeScript with no UI or platform dependency. Lengths in inches. Structure mirrors Open Screenplay Format (styles with `basedOn`, paragraphs with a style and text runs), so .fadein import and export are close to lossless.
2. **`packages/layout`**: Midlander's own pagination engine. Screenplay fonts are monospaced, so layout works in character columns (10 per inch) and line numbers (6 per inch). The output is a list of pages of positioned lines. The editor, PDF writer and printing all consume this same output.
3. **`packages/formats`**: importers and exporters, with small built-in zip and XML implementations. They use the standard `CompressionStream` API, so the same code runs in Node (tests) and in the app's webview.
4. **No third-party runtime dependencies in these three packages.** The code runs directly in Node 22+ (native TypeScript type stripping). Tests use `node:test`.
5. **Fade In behaviour is verified, not guessed.** `tools/compare-layout.ts` lays out a .fadein file and compares every line (line number, column, text) with a PDF exported from Fade In. Rules that haven't been confirmed against a sample are marked `ASSUMPTION` in code and are configurable.

## Consequences

- Cross-package imports currently use relative paths (`../../core/src/index.ts`). They'll become workspace package names (`@midlander/core`) once package installs are available.
- The editor (ProseMirror) and the app shell (Tauri) are built on top of this core in later steps.
- Private reference scripts are never committed. Automated tests use original content written for the project.
