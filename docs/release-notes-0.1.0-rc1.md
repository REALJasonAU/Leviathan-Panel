# Leviathan 0.1.0 RC1 Example Release Notes

Leviathan 0.1.0 RC1 is the first release-candidate milestone for the rebranded platform.

## Included

- Leviathan panel rebrand and abyss-themed UI refresh
- Local-account auth and MariaDB-backed control-plane foundation
- Docker-managed server lifecycle scaffolding
- File operations and daemon transfer streaming paths
- Local and S3 backup support
- Scoped API keys and sub-user permissions
- Cloudflare route management and reverse proxy config generation
- Daemon installer and panel installer with dry-run/update/uninstall flows

## Operator Notes

- Ubuntu and Debian are the fully targeted production installer paths.
- Fedora, Rocky Linux, AlmaLinux, CentOS Stream, and Arch Linux are best-effort.
- Full production SFTP network serving remains partial.
- Root-level firewall enforcement should be staged carefully before broad production rollout.

## Upgrade Guidance

1. Back up environment files.
2. Back up the panel MariaDB database or export control-plane data.
3. Update panel/API first.
4. Validate panel health.
5. Update daemon nodes in maintenance windows.
6. Validate backup, Cloudflare, and proxy flows after rollout.
