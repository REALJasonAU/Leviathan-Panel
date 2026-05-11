import type { FastifyInstance } from "fastify";

import {
  CreateNodeInputSchema,
  IdParamSchema,
  PaginationQuerySchema,
  RotateNodeDaemonTokenInputSchema,
  DaemonUpdateInputSchema,
  UpdateNodeMaintenanceInputSchema,
} from "@voltan/shared";

import { AppError } from "../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../lib/http.js";
import { store } from "../lib/store.js";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher.js";
import { requirePermission } from "../plugins/auth.js";

export const registerNodeRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/v1/nodes", async (request) => {
    requirePermission(request, "nodes.view");
    return store.listNodes();
  });

  fastify.post(
    "/v1/nodes",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      requirePermission(request, "nodes.create");
      const input = parseBody(request, CreateNodeInputSchema);
      const result = await store.createNode(input);
      await store.appendAuditLog({
        actorId: request.auth!.user.uid,
        actorType: "user",
        action: "node.create",
        targetType: "node",
        targetId: result.node.id,
        metadata: {
          name: result.node.name,
        },
      });
      await dispatchWebhookEvent("node.create", {
        nodeId: result.node.id,
        name: result.node.name,
      });
      return reply.code(201).send(result);
    },
  );

  fastify.post(
    "/v1/nodes/:id/rotate-token",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      requirePermission(request, "nodes.rotateTokens");
      const { id: nodeId } = parseParams(request, IdParamSchema);
      const result = await store.rotateNodeToken(nodeId);
      await store.appendAuditLog({
        actorId: request.auth!.user.uid,
        actorType: "user",
        action: "node.rotate_token",
        targetType: "node",
        targetId: nodeId,
        metadata: {},
      });
      await dispatchWebhookEvent("node.rotate_token", {
        nodeId,
      });
      return result;
    },
  );

  fastify.post(
    "/v1/nodes/:id/rotate-daemon-token",
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      requirePermission(request, "nodes.rotateTokens");
      const { id: nodeId } = parseParams(request, IdParamSchema);
      parseBody(request, RotateNodeDaemonTokenInputSchema.partial());
      const result = await store.rotateDaemonToken(nodeId);
      if (!result) {
        throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
      }
      await store.appendAuditLog({
        actorId: request.auth!.user.uid,
        actorType: "user",
        action: "node.rotate_daemon_token",
        targetType: "node",
        targetId: nodeId,
        metadata: {},
      });
      return result;
    },
  );

  fastify.patch("/v1/nodes/:id/maintenance", async (request) => {
    requirePermission(request, "nodes.maintenance");
    const { id: nodeId } = parseParams(request, IdParamSchema);
    const input = parseBody(request, UpdateNodeMaintenanceInputSchema);
    const node = await store.updateNodeMaintenance(nodeId, input);
    if (!node) {
      throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "node.maintenance.update",
      targetType: "node",
      targetId: nodeId,
      metadata: input,
    });
    return node;
  });

  fastify.get("/v1/nodes/:id/config", async (request) => {
    requirePermission(request, "nodes.config.view");
    const { id: nodeId } = parseParams(request, IdParamSchema);
    const configPayload = await store.generateDaemonConfig(nodeId);
    if (!configPayload) {
      throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
    }
    return configPayload;
  });

  fastify.get("/v1/nodes/:id/metrics", async (request) => {
    requirePermission(request, "nodes.view");
    const { id: nodeId } = parseParams(request, IdParamSchema);
    const { limit } = parseQuery(request, PaginationQuerySchema);
    return store.listMetrics("node", nodeId, limit);
  });

  fastify.post("/v1/nodes/:id/update-daemon", async (request) => {
    requirePermission(request, "nodes.updateControl");
    const { id: nodeId } = parseParams(request, IdParamSchema);
    const input = parseBody(request, DaemonUpdateInputSchema);
    const node = await store.getNode(nodeId);
    if (!node) {
      throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
    }
    if (!fastify.daemonBus.hasNodeConnection(nodeId)) {
      throw new AppError(409, "NODE_OFFLINE", "Node is offline");
    }
    const history = await store.createDaemonUpdateHistory({
      nodeId,
      fromVersion: node.daemonVersion,
      toVersion: input.manifest.version,
      status: "planned",
      message: "Update command sent to daemon",
    });
    const result = await fastify.daemonBus.sendCommand(
      nodeId,
      "node.daemon.update",
      input,
    );
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "node.daemon.update",
      targetType: "node",
      targetId: nodeId,
      metadata: { toVersion: input.manifest.version },
    });
    return { history, result };
  });

  fastify.get("/v1/nodes/:id/update-history", async (request) => {
    requirePermission(request, "nodes.updateControl");
    const { id: nodeId } = parseParams(request, IdParamSchema);
    return store.listDaemonUpdateHistory(nodeId);
  });
};
