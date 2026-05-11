# Release Checklist

Use this checklist before publishing a Leviathan release candidate or stable release.

## Versioning

- Choose the target version tag.
- Update release notes and changelog.
- Confirm the daemon artifact manifest version matches the release tag.

## Verification

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Installers

- Run panel installer `--dry-run`.
- Run daemon installer `--dry-run`.
- Confirm update and uninstall scripts have dry-run support.
- Confirm Ubuntu/Debian are still the only fully targeted distro paths in the docs.

## Security

- Review [Security Checklist](./security-checklist.md).
- Confirm secrets are encrypted and redacted.
- Confirm one-time secret display flows are still one-time only.
- Confirm rate-limited routes still behave correctly.

## Operations

- Confirm Redis/BullMQ production queue settings are documented.
- Confirm S3 backup settings are documented.
- Confirm daemon update docs are current.
- Confirm Cloudflare and reverse proxy docs match the current UI/runtime.

## Release Notes

For the first Leviathan release candidate, see:

- [Leviathan 0.1.0 RC1 Example Notes](./release-notes-0.1.0-rc1.md)
