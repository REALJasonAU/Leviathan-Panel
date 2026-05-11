import type { FastifyInstance } from "fastify";

import {
  CreateTemplateInputSchema,
  ImportEnvExampleInputSchema,
  parseEnvExample,
} from "@voltan/shared";

import { store } from "../lib/store.js";
import { parseBody } from "../lib/http.js";
import { requirePermission } from "../plugins/auth.js";

export const registerTemplateRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/v1/templates", async (request) => {
    requirePermission(request, "templates.view");
    return store.listTemplates();
  });

  fastify.post("/v1/templates", async (request, reply) => {
    requirePermission(request, "templates.create");
    const input = parseBody(request, CreateTemplateInputSchema);
    const template = await store.createTemplate(input);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "template.create",
      targetType: "template",
      targetId: template.id,
      metadata: {},
    });
    return reply.code(201).send(template);
  });

  fastify.post("/v1/templates/import-env-example", async (request) => {
    requirePermission(request, "templates.create");
    const input = parseBody(request, ImportEnvExampleInputSchema);
    return {
      definitions: parseEnvExample(input.content),
    };
  });
};
