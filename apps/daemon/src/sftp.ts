import path from "node:path";

export const assertSftpPathInsideRoot = (
  rootPath: string,
  requested: string,
) => {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, requested);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("SFTP path escapes the server root");
  }
  return resolved;
};

export const provisionSftpCredential = async (input: {
  serverId: string;
  username: string;
  rootPath: string;
  revoked?: boolean;
  expiresAt?: string;
}) => {
  if (input.revoked) {
    throw new Error("Cannot provision a revoked SFTP credential");
  }
  if (input.expiresAt && new Date(input.expiresAt).getTime() <= Date.now()) {
    throw new Error("Cannot provision an expired SFTP credential");
  }
  assertSftpPathInsideRoot(input.rootPath, ".");
  return {
    serverId: input.serverId,
    username: input.username,
    rootPath: input.rootPath,
    provisioned: true,
    mode: "internal-registry",
    message:
      "Credential registered with daemon isolation checks. Enable OpenSSH ForceCommand or the internal SFTP service per docs.",
  };
};

export const revokeSftpCredential = async (serverId: string) => ({
  serverId,
  revoked: true,
});
