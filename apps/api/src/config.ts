import "dotenv/config";

import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  PANEL_ORIGIN: z.string().default("http://localhost:5173"),
  PANEL_EXTRA_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    ),
  MOCK_AUTH: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  MOCK_DATA: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  DB_DRIVER: z.enum(["memory", "mysql"]).default("memory"),
  DB_HOST: z.string().default("127.0.0.1"),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().default("leviathan_panel"),
  DB_USER: z.string().default("leviathan"),
  DB_PASSWORD: z.string().default("leviathan"),
  DB_NAMESPACE: z.string().default("panel"),
  SESSION_COOKIE_NAME: z.string().default("leviathan_session"),
  SESSION_TTL_HOURS: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 7),
  QUEUE_DRIVER: z.enum(["local", "bullmq"]).default("local"),
  REDIS_URL: z.string().optional(),
  RATE_LIMIT_MAX: z.coerce.number().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),
  FILE_UPLOAD_LIMIT_MB: z.coerce.number().positive().default(256),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  WHMCS_WEBHOOK_SECRET: z.string().optional(),
  PLUGINS_DIR: z.string().default("plugins"),
  SECRET_ENCRYPTION_KEY: z.string().optional(),
});

export const config = ConfigSchema.parse(process.env);
