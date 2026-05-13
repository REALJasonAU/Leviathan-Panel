import fp from "fastify-plugin";
import type { FastifyRequest } from "fastify";

import { hasPermission, type Permission } from "@voltan/shared";

import { config } from "../config.js";
import { AppError } from "../lib/errors.js";
import { type AuthContext, store } from "../lib/store.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

const extractBearerToken = (request: FastifyRequest) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length);
};

export const resolveAuthFromToken = async (token: string) => {
  if (token.startsWith("lvk_") || token.startsWith("vtk_")) {
    const auth = await store.validateApiKey(token);
    if (!auth) {
      throw new AppError(401, "UNAUTHORIZED", "Invalid API key");
    }
    return auth;
  }

  throw new AppError(401, "UNAUTHORIZED", "Invalid bearer token");
};

export const authPlugin = fp(async (fastify) => {
  fastify.decorateRequest("auth");

  fastify.addHook("preHandler", async (request) => {
    if (
      request.url.startsWith("/health") ||
      request.url.startsWith("/v1/auth/login") ||
      request.url.startsWith("/v1/daemon/register") ||
      request.url.startsWith("/v1/daemon/socket") ||
      request.url.startsWith("/v1/integrations/billing/")
    ) {
      return;
    }

    const token = extractBearerToken(request);
    if (token) {
      request.auth = await resolveAuthFromToken(token);
      return;
    }

    const sessionId = request.cookies?.[config.SESSION_COOKIE_NAME];
    if (sessionId) {
      const auth = await store.getAuthBySession(sessionId);
      if (auth) {
        request.auth = auth;
        return;
      }
    }

    throw new AppError(401, "UNAUTHORIZED", "Missing authentication");
  });
});

export const requirePermission = (
  request: FastifyRequest,
  permission: Permission,
) => {
  if (!request.auth) {
    throw new AppError(401, "UNAUTHORIZED", "Not authenticated");
  }

  if (!hasPermission(request.auth.permissions, permission)) {
    throw new AppError(403, "FORBIDDEN", "Missing permission");
  }
};
