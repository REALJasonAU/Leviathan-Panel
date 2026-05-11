import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import sensible from "@fastify/sensible";
import websocket from "@fastify/websocket";

import { config } from "./config.js";
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

export const buildApp = async () => {
  const app = Fastify({
    logger: {
      level: "info",
    },
  });

  await app.register(cors, {
    origin: config.PANEL_ORIGIN,
    credentials: true,
  });
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

  return app;
};
