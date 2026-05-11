import type { FastifyInstance } from "fastify";

import { DashboardSummarySchema } from "@voltan/shared";

import { store } from "../lib/store.js";
import { requirePermission } from "../plugins/auth.js";

export const registerDashboardRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/v1/dashboard", async (request) => {
    requirePermission(request, "dashboard.view");
    return DashboardSummarySchema.parse(
      await store.getDashboardSummary(request.auth!),
    );
  });
};
