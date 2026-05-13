import type { SessionResponse } from "./api";

type SessionLike =
  | Pick<SessionResponse, "roles" | "permissions">
  | null
  | undefined;

export const isAdminSession = (session: SessionLike): boolean => {
  if (!session) {
    return false;
  }

  if (session.permissions.includes("*")) {
    return true;
  }

  return session.roles.some(
    (role) =>
      role.id === "admin" ||
      role.name.toLowerCase().includes("administrator") ||
      role.permissions.includes("*"),
  );
};
