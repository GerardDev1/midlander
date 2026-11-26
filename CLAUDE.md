# Midlander — notes for Claude sessions

Midlander is an independent desktop screenwriting app, designed to feel instantly familiar to Fade In users (workflow, shortcuts, menu locations), **not** a visual clone. Owner: Gerard (GitHub: GerardDev1). He tests on macOS Monterey 12 and is not doing the coding; give him clear, step-by-step instructions when he needs to do something.

Read `docs/SPEC.md` (approved spec, once approved), `docs/STATUS.md` (what's done) before starting work.

## Rules (from the project brief)

1. Never copy Fade In's code, name, branding, icons or other assets. Original code and assets only.
2. No fake buttons or non-functional menu items. If it isn't implemented, it isn't shown.
3. Never describe placeholder functionality as complete.
4. Don't remove working functionality when adding features.
5. Keep it modular: `packages/core` has no UI dependency; pagination never relies on browser text measurement.
6. Document important technical decisions in `docs/decisions/`.
7. Test each major feature before moving on.
8. Update `docs/STATUS.md` at the end of each session.
9. Preserve existing files and working features.
10. Never modify Gerard's Fade In installation or his original scripts.

When you hit a technical limitation, explain it and propose an alternative rather than silently omitting the feature.

## Platform constraint

The app must keep running on macOS 12. That rules out Electron 44+ (requires macOS 13). Releases are built by GitHub Actions, not on Gerard's Mac.
