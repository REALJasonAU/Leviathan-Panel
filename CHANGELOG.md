# Changelog

All notable changes to Leviathan will be documented in this file.

## Unreleased

- Panel installer hardened with distro detection, dry-run/update/uninstall flows, runtime validation, and clearer troubleshooting output.
- Daemon installer health validation corrected to use `/health`.
- Release-candidate deployment, security, installer, and update documentation expanded.
- GitHub Actions CI added for format, lint, typecheck, test, build, and Playwright E2E runs.
- API key prefix updated to `lvk_` with backward compatibility for legacy `vtk_` keys.

## 0.1.0-rc.1

- Leviathan rebrand across the panel, docs, installers, and examples.
- Abyss-inspired dark theme for the panel.
- Firebase-backed control-plane foundation.
- Daemon runtime, streaming transfers, backup, Cloudflare, plugin, and update scaffolding from Phases 1-5.
