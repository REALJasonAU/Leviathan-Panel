import type { FastifyInstance } from "fastify";

import { MeResponseSchema } from "@voltan/shared";

export const registerAuthRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/v1/me", async (request) => {
    if (!request.auth) {
      throw fastify.httpErrors.unauthorized();
    }

    return MeResponseSchema.parse(request.auth);
  });
};
