import type { DomainMappingRecord, ServerRecord } from "@voltan/shared";
import fs from "fs-extra";

export const generateCaddyConfig = (
  server: ServerRecord,
  mappings: DomainMappingRecord[],
) =>
  mappings
    .filter((mapping) => mapping.enabled && mapping.provider === "caddy")
    .map((mapping) => {
      const targetAllocation = server.allocations.find(
        (allocation) => allocation.primary,
      );
      const targetHost = targetAllocation?.ip ?? "127.0.0.1";
      return `${mapping.domain} {\n  reverse_proxy ${targetHost}:${mapping.targetPort}\n}`;
    })
    .join("\n\n");

export const reloadProxyConfig = async (
  server: ServerRecord,
  mappings: DomainMappingRecord[],
) => {
  const body = generateCaddyConfig(server, mappings);
  const configPath =
    process.env.LEVIATHAN_PROXY_CONFIG_PATH ??
    process.env.VOLTAN_PROXY_CONFIG_PATH;
  if (!configPath) {
    return {
      provider: "caddy",
      config: body,
      reloaded: false,
      applied: false,
      message:
        "Caddy config generated. Configure LEVIATHAN_PROXY_CONFIG_PATH to enable daemon-side writes/reload.",
    };
  }

  const previousPath = `${configPath}.previous`;
  if (await fs.pathExists(configPath)) {
    await fs.copy(configPath, previousPath, {
      overwrite: true,
    });
  }
  try {
    await fs.outputFile(configPath, `${body}\n`);
    return {
      provider: "caddy",
      config: body,
      reloaded: true,
      applied: true,
      rollbackPath: previousPath,
    };
  } catch (error) {
    if (await fs.pathExists(previousPath)) {
      await fs.copy(previousPath, configPath, {
        overwrite: true,
      });
    }
    throw error;
  }
};
