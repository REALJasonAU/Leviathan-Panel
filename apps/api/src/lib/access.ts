import type { AuthContext } from "./store.js";
import type { ServerRecord } from "@voltan/shared";

const legacyServerPermissionMap: Record<string, string> = {
  "servers.console.view": "console.view",
  "servers.console.command": "console.send",
  "servers.files.view": "files.read",
  "servers.files.write": "files.write",
  "servers.files.delete": "files.delete",
  "servers.backups.create": "backups.create",
  "servers.backups.restore": "backups.restore",
  "servers.backups.delete": "backups.delete",
  "servers.schedules.create": "schedules.manage",
  "servers.schedules.update": "schedules.manage",
  "servers.schedules.delete": "schedules.manage",
  "servers.network.manage": "network.manage",
  "servers.environment.manage": "env.manage",
  "servers.settings.manage": "settings.manage",
};

const serverPermissionCandidates = (permission: string) => [
  permission,
  legacyServerPermissionMap[permission] ?? permission,
];

export const canAccessServer = (
  auth: AuthContext,
  server: ServerRecord | null,
) => {
  if (!server) {
    return false;
  }

  return (
    auth.permissions.includes("*") ||
    server.ownerId === auth.user.uid ||
    auth.user.serverIds.includes(server.id) ||
    server.members.some((member) => member.userId === auth.user.uid)
  );
};

export const memberHasServerPermission = (
  auth: AuthContext,
  server: ServerRecord | null,
  permission: string,
) => {
  if (!server) {
    return false;
  }
  if (auth.permissions.includes("*") || server.ownerId === auth.user.uid) {
    return true;
  }
  return server.members.some(
    (member) =>
      member.userId === auth.user.uid &&
      serverPermissionCandidates(permission).some((candidate) =>
        member.permissions.includes(
          candidate as (typeof member.permissions)[number],
        ),
      ),
  );
};
