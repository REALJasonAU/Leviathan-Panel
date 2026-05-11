import type { FastifyInstance } from "fastify";

import {
  DaemonRegisterInputSchema,
  DaemonRegisterResponseSchema,
} from "@voltan/shared";

import { AppError } from "../lib/errors.js";
import { parseBody } from "../lib/http.js";
import { store } from "../lib/store.js";

const getBearerToken = (authorization?: string) =>
  authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;

export const registerDaemonRoutes = async (fastify: FastifyInstance) => {
  fastify.post("/v1/daemon/register", async (request) => {
    const input = parseBody(request, DaemonRegisterInputSchema);
    const daemonToken = await store.exchangeBootstrapToken(
      input.nodeId,
      input.bootstrapToken,
      {
        fingerprint: input.fingerprint,
        version: input.version,
      },
    );
    const node = await store.getNode(input.nodeId);

    if (!daemonToken || !node) {
      throw new AppError(
        401,
        "INVALID_BOOTSTRAP_TOKEN",
        "Invalid bootstrap token",
      );
    }

    await store.appendAuditLog({
      actorId: input.nodeId,
      actorType: "daemon",
      action: "daemon.register",
      targetType: "node",
      targetId: input.nodeId,
      metadata: {
        fingerprint: input.fingerprint,
      },
    });

    return DaemonRegisterResponseSchema.parse({
      daemonToken,
      node: {
        id: node.id,
        name: node.name,
        region: node.region,
        publicAddress: node.publicAddress,
      },
    });
  });

  fastify.get(
    "/v1/daemon/socket",
    { websocket: true },
    async (socket, request) => {
      const nodeId = String(
        (request.query as { nodeId?: string }).nodeId ?? "",
      );
      const token = getBearerToken(request.headers.authorization);
      if (!nodeId || !token) {
        socket.close(1008, "Missing node auth");
        return;
      }

      const node = await store.validateDaemonToken(nodeId, token);
      if (!node) {
        socket.close(1008, "Invalid node auth");
        return;
      }

      fastify.daemonBus.registerConnection(nodeId, socket);
      await store.touchNodeHeartbeat(nodeId, "online");
      socket.send(
        JSON.stringify({
          type: "daemon.hello",
          payload: {
            nodeId,
            serverTime: new Date().toISOString(),
          },
        }),
      );
    },
  );
};
