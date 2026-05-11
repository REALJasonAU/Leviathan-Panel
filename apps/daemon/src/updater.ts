import { createHash, verify } from "node:crypto";
import path from "node:path";
import fs from "fs-extra";
import type { DaemonUpdateManifest } from "@voltan/shared";

export const verifyChecksum = (data: Buffer, expectedSha256: string) =>
  createHash("sha256").update(data).digest("hex") === expectedSha256;

export const manifestSigningPayload = (manifest: DaemonUpdateManifest) =>
  JSON.stringify({
    version: manifest.version,
    url: manifest.url,
    sha256: manifest.sha256,
    publishedAt: manifest.publishedAt,
  });

export const verifyUpdateManifest = (
  manifest: DaemonUpdateManifest,
  publicKeyPem: string,
) =>
  verify(
    "sha256",
    Buffer.from(manifestSigningPayload(manifest)),
    publicKeyPem,
    Buffer.from(manifest.signature, "base64"),
  );

export const planDaemonUpdate = async (input: {
  manifest?: DaemonUpdateManifest;
  publicKeyPem?: string;
}) => {
  if (!input.manifest || !input.publicKeyPem) {
    return {
      accepted: false,
      reason:
        "A signed manifest and public key are required before daemon self-update can run.",
    };
  }
  if (!verifyUpdateManifest(input.manifest, input.publicKeyPem)) {
    return {
      accepted: false,
      reason: "Manifest signature verification failed.",
    };
  }

  return {
    accepted: true,
    version: input.manifest.version,
    url: input.manifest.url,
    sha256: input.manifest.sha256,
    steps: [
      "download",
      "verify checksum",
      "stage with previous version snapshot",
      "stop service",
      "replace package",
      "restart service",
      "health check",
      "rollback if health check fails",
    ],
    automaticExecution: false,
  };
};

export const executeDaemonUpdate = async (input: {
  manifest: DaemonUpdateManifest;
  publicKeyPem: string;
  healthUrl?: string;
}) => {
  const plan = await planDaemonUpdate(input);
  if (!plan.accepted) {
    return plan;
  }
  const applyEnabled = process.env.DAEMON_UPDATE_APPLY_ENABLED === "true";
  const targetPath = process.env.DAEMON_UPDATE_TARGET_PATH;
  const stagingDir =
    process.env.DAEMON_UPDATE_STAGING_DIR ?? "/var/lib/leviathan/updates";
  if (!applyEnabled || !targetPath) {
    return {
      ...plan,
      applied: false,
      message:
        "Update verified but not applied. Set DAEMON_UPDATE_APPLY_ENABLED=true and DAEMON_UPDATE_TARGET_PATH to enable replacement.",
    };
  }

  await fs.ensureDir(stagingDir);
  const response = await fetch(input.manifest.url);
  if (!response.ok) {
    throw new Error(`Update artifact download failed: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!verifyChecksum(bytes, input.manifest.sha256)) {
    throw new Error("Update artifact checksum verification failed");
  }

  const stagedPath = path.join(stagingDir, `daemon-${input.manifest.version}`);
  const rollbackPath = `${targetPath}.rollback`;
  await fs.writeFile(stagedPath, bytes, { mode: 0o755 });
  if (await fs.pathExists(targetPath)) {
    await fs.copy(targetPath, rollbackPath, {
      overwrite: true,
    });
  }

  try {
    await fs.copy(stagedPath, targetPath, {
      overwrite: true,
    });
    if (input.healthUrl) {
      const health = await fetch(input.healthUrl);
      if (!health.ok) {
        throw new Error(`Health check failed: ${health.status}`);
      }
    }
    return {
      ...plan,
      applied: true,
      rollbackPath,
    };
  } catch (error) {
    if (await fs.pathExists(rollbackPath)) {
      await fs.copy(rollbackPath, targetPath, {
        overwrite: true,
      });
    }
    throw error;
  }
};
