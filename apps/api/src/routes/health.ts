import type { FastifyInstance } from "fastify";

export const registerHealthRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/health", async () => ({
    status: "ok",
    service: "leviathan-api",
    time: new Date().toISOString(),
  }));
};
