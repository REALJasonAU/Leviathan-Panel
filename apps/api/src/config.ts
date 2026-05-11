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
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
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
