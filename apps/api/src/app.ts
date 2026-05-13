import os from "node:os";

import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";

import { config } from "./config.js";
import { closeDatabase } from "./lib/db.js";
import { asAppError } from "./lib/errors.js";
import { startTaskScheduler } from "./lib/scheduler.js";
import { loadPluginDirectory } from "./lib/plugin-loader.js";
import { authPlugin } from "./plugins/auth.js";
import { daemonBusPlugin } from "./plugins/daemon-bus.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerIntegrationRoutes } from "./routes/integrations.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerDashboardRoutes } from "./routes/dashboard.js";
import { registerNodeRoutes } from "./routes/nodes.js";
import { registerTemplateRoutes } from "./routes/templates.js";
import { registerServerRoutes } from "./routes/servers.js";
import { registerDaemonRoutes } from "./routes/daemon.js";

const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);

const detectPublicHost = () => {
  const hostList = process.env.LEVIATHAN_PUBLIC_HOSTS?.trim();
  if (hostList) {
    const override = hostList
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .find((item) => !loopbackHosts.has(item));
    if (override) {
      return override;
    }
  }

  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }
      if (!loopbackHosts.has(entry.address)) {
        return entry.address;
      }
    }
  }

  return null;
};

export const buildApp = async () => {
  const allowedOrigins = new Set([
    config.PANEL_ORIGIN,
    ...config.PANEL_EXTRA_ORIGINS,
  ]);

  try {
    const panelOrigin = new URL(config.PANEL_ORIGIN);
    if (loopbackHosts.has(panelOrigin.hostname)) {
      const detectedHost = detectPublicHost();
      if (detectedHost) {
        const origin = `${panelOrigin.protocol}//${detectedHost}:${panelOrigin.port || "4173"}`;
        allowedOrigins.add(origin);
      }
    }
  } catch {
    // Ignore malformed origins here; validation happens in config parsing.
  }

  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  await app.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (
        allowedOrigins.has(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(`Origin ${origin} is not allowed by Leviathan API CORS`),
        false,
      );
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(sensible);
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.FILE_UPLOAD_LIMIT_MB * 1024 * 1024,
      files: 1,
    },
  });
  await app.register(websocket);
  await app.register(authPlugin);
  await app.register(daemonBusPlugin);

  app.setErrorHandler((error, request, reply) => {
    const appError = asAppError(error);
    request.log.error(
      {
        err: error,
        code: appError.code,
      },
      appError.message,
    );
    reply.status(appError.statusCode).send({
      error: {
        code: appError.code,
        message: appError.message,
        details: appError.details,
        requestId: request.id,
      },
    });
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerDashboardRoutes(app);
  await registerNodeRoutes(app);
  await registerTemplateRoutes(app);
  await registerServerRoutes(app);
  await registerAdminRoutes(app);
  await registerDaemonRoutes(app);
  await registerIntegrationRoutes(app);
  await loadPluginDirectory(app);
  startTaskScheduler(app);
  app.addHook("onClose", async () => {
    await closeDatabase();
  });

  return app;
};
