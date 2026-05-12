import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { MeResponseSchema } from "@voltan/shared";

import { config } from "../config.js";
import { parseBody } from "../lib/http.js";
import { store } from "../lib/store.js";

const LoginInputSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export const registerAuthRoutes = async (fastify: FastifyInstance) => {
  const setSessionCookie = (reply: FastifyReply, sessionId: string) =>
    reply.setCookie(config.SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.PANEL_ORIGIN.startsWith("https://"),
      path: "/",
      maxAge: config.SESSION_TTL_HOURS * 60 * 60,
    });

  fastify.post("/v1/auth/login", async (request, reply) => {
    const input = parseBody(request, LoginInputSchema);
    const auth = await store.authenticateLocalUser(
      input.identifier,
      input.password,
    );
    if (!auth) {
      throw fastify.httpErrors.unauthorized("Invalid credentials");
    }
    const sessionId = await store.createSession(auth.user.uid);
    setSessionCookie(reply, sessionId);
    return MeResponseSchema.parse(auth);
  });

  fastify.post("/v1/auth/logout", async (request, reply) => {
    const sessionId = request.cookies?.[config.SESSION_COOKIE_NAME];
    if (sessionId) {
      await store.deleteSession(sessionId);
    }
    reply.clearCookie(config.SESSION_COOKIE_NAME, {
      path: "/",
      sameSite: "lax",
      secure: config.PANEL_ORIGIN.startsWith("https://"),
    });
    return { ok: true };
  });

  fastify.get("/v1/auth/me", async (request) => {
    if (!request.auth) {
      throw fastify.httpErrors.unauthorized();
    }

    return MeResponseSchema.parse(request.auth);
  });

  fastify.get("/v1/me", async (request) => {
    if (!request.auth) {
      throw fastify.httpErrors.unauthorized();
    }

    return MeResponseSchema.parse(request.auth);
  });
};
