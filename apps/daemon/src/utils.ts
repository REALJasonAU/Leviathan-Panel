import crypto from "node:crypto";

export const nowIso = () => new Date().toISOString();

export const fingerprintMachine = () =>
  crypto
    .createHash("sha256")
    .update(`${process.platform}:${process.arch}:${process.cwd()}`)
    .digest("hex");

export const serverContainerName = (serverId: string) =>
  `leviathan-${serverId}`;
