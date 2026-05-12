import "dotenv/config";

import { z } from "zod";

const ConfigSchema = z.object({
  DAEMON_HOST: z.string().default("0.0.0.0"),
  DAEMON_PORT: z.coerce.number().default(4100),
  PANEL_URL: z.string().url(),
  NODE_ID: z.string().min(1),
  BOOTSTRAP_TOKEN: z.string().optional(),
  DAEMON_TOKEN: z.string().optional(),
  DAEMON_BASE_DIR: z.string().default("/var/lib/leviathan"),
  DOCKER_SOCKET_PATH: z.string().default("/var/run/docker.sock"),
  FIREWALL_APPLY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  LEVIATHAN_PROXY_CONFIG_PATH: z.string().optional(),
  VOLTAN_PROXY_CONFIG_PATH: z.string().optional(),
  DAEMON_UPDATE_APPLY_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DAEMON_UPDATE_TARGET_PATH: z.string().optional(),
  DAEMON_UPDATE_STAGING_DIR: z.string().default("/var/lib/leviathan/updates"),
  DAEMON_DB_DRIVER: z.enum(["memory", "mysql"]).default("memory"),
  DAEMON_DB_HOST: z.string().default("127.0.0.1"),
  DAEMON_DB_PORT: z.coerce.number().int().positive().default(3306),
  DAEMON_DB_NAME: z.string().default("leviathan_daemon"),
  DAEMON_DB_USER: z.string().default("leviathan"),
  DAEMON_DB_PASSWORD: z.string().default("leviathan"),
  DAEMON_DB_NAMESPACE: z.string().default("daemon"),
});

export const config = ConfigSchema.parse(process.env);
