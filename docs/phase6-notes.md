# Phase 6 Notes

Phase 6 focused on release-candidate readiness rather than new runtime surface area.

## What changed

- Reviewed the Leviathan rebrand and removed remaining low-risk branding drift in docs, fixtures, and user-facing defaults.
- Hardened the panel installer to match the daemon installer's distro-aware, dry-run-capable, service-validating flow.
- Corrected daemon installer health validation to use the real `/health` route.
- Added release-candidate docs for deployment, security, panel installer usage, update operations, release checklist, and example release notes.
- Added GitHub Actions CI for format, lint, typecheck, tests, build, and Playwright E2E runs.
- Expanded Playwright coverage for mock-admin navigation, node creation, `.env.example` import, server provisioning, console view, API key creation, SFTP rotation, and Cloudflare dry-run.
- Improved panel resilience so partial server-detail failures no longer blank the whole view when a daemon-dependent endpoint is unavailable.

## Still Partial

- Full browser-driven file upload/download and backup create/download flows still require a daemon-connected integration environment with Docker available during the E2E run.
- Ubuntu and Debian remain the only fully targeted installer paths; RPM-family distros and Arch are still best-effort.
- Full production SFTP network serving and root-level firewall enforcement remain operator-staged features rather than fully automated release-candidate defaults.
