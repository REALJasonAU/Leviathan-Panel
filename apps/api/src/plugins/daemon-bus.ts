import fp from "fastify-plugin";
import type { RawData, WebSocket } from "ws";
import { randomUUID } from "node:crypto";

import { ConsoleEventSchema, DaemonEnvelopeSchema } from "@voltan/shared";
import type { MetricPointRecord } from "@voltan/shared";

import { createSystemAlert, evaluateMetricAlerts } from "../lib/alerts.js";
import { store } from "../lib/store.js";
import { generateId, nowIso } from "../lib/utils.js";

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timeout: NodeJS.Timeout;
};

declare module "fastify" {
  interface FastifyInstance {
    daemonBus: {
      registerConnection: (nodeId: string, socket: WebSocket) => void;
      sendCommand: (
        nodeId: string,
        type: string,
        payload: Record<string, unknown>,
      ) => Promise<unknown>;
      hasNodeConnection: (nodeId: string) => boolean;
      subscribeConsole: (serverId: string, socket: WebSocket) => void;
      publishConsole: (serverId: string, chunk: string) => void;
    };
  }
}

export const daemonBusPlugin = fp(async (fastify) => {
  const sockets = new Map<string, WebSocket>();
  const pending = new Map<string, PendingCommand>();
  const consoleSubscribers = new Map<string, Set<WebSocket>>();

  const publishConsole = (serverId: string, chunk: string) => {
    const subscribers = consoleSubscribers.get(serverId);
    if (!subscribers) {
      return;
    }

    const event = ConsoleEventSchema.parse({
      serverId,
      chunk,
      timestamp: nowIso(),
    });

    for (const socket of subscribers) {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify(event));
      }
    }
  };

  const handleMessage = async (nodeId: string, raw: RawData) => {
    const parsed = DaemonEnvelopeSchema.parse(JSON.parse(raw.toString()));

    if (parsed.type === "command.result" && parsed.requestId) {
      const command = pending.get(parsed.requestId);
      if (command) {
        clearTimeout(command.timeout);
        pending.delete(parsed.requestId);
        command.resolve(parsed.payload);
      }
      return;
    }

    if (parsed.type === "daemon.ready") {
      await store.touchNodeHeartbeat(nodeId, "online", {
        fingerprint:
          typeof parsed.payload.fingerprint === "string"
            ? parsed.payload.fingerprint
            : undefined,
        version:
          typeof parsed.payload.version === "string"
            ? parsed.payload.version
            : undefined,
      });
      return;
    }

    if (parsed.type === "server.status") {
      const serverId = String(parsed.payload.serverId ?? "");
      const status = String(parsed.payload.status ?? "offline");
      if (serverId) {
        await store.updateServerStatus(
          serverId,
          status as Parameters<typeof store.updateServerStatus>[1],
          typeof parsed.payload.lastCrashAt === "string"
            ? parsed.payload.lastCrashAt
            : undefined,
        );
        if (status === "errored") {
          await createSystemAlert({
            type: "server.crashed",
            scopeType: "server",
            scopeId: serverId,
            title: "Server crashed",
            message: `Server ${serverId} reported an errored state`,
          });
        }
      }
      return;
    }

    if (parsed.type === "server.console") {
      const serverId = String(parsed.payload.serverId ?? "");
      const chunk = String(parsed.payload.chunk ?? "");
      if (serverId && chunk) {
        publishConsole(serverId, chunk);
      }
      return;
    }

    if (parsed.type === "daemon.metrics") {
      const metrics =
        typeof parsed.payload.metrics === "object" && parsed.payload.metrics
          ? (
              parsed.payload.metrics as Parameters<
                typeof store.touchNodeHeartbeat
              >[2]
            )?.metrics
          : undefined;

      await store.touchNodeHeartbeat(nodeId, "online", {
        metrics,
      });

      const points: MetricPointRecord[] = [
        {
          id: generateId("metric"),
          scopeType: "node" as const,
          scopeId: nodeId,
          timestamp: nowIso(),
          values: metrics
            ? {
                cpuPercent: Number(metrics.cpuPercent),
                memoryUsedMb: Number(metrics.memoryUsedMb),
                memoryTotalMb: Number(metrics.memoryTotalMb),
                diskUsedMb: Number(metrics.diskUsedMb),
                diskTotalMb: Number(metrics.diskTotalMb),
                networkRxBytes: Number(metrics.networkRxBytes),
                networkTxBytes: Number(metrics.networkTxBytes),
              }
            : ({} as Record<string, number>),
        },
      ];

      const serverMetrics = Array.isArray(parsed.payload.serverMetrics)
        ? parsed.payload.serverMetrics
        : [];
      for (const metric of serverMetrics) {
        if (
          typeof metric !== "object" ||
          !metric ||
          typeof (metric as { serverId?: unknown }).serverId !== "string"
        ) {
          continue;
        }
        points.push({
          id: generateId("metric"),
          scopeType: "server" as const,
          scopeId: String((metric as { serverId: string }).serverId),
          timestamp: nowIso(),
          values: {
            cpuPercent: Number(
              (metric as { cpuPercent?: unknown }).cpuPercent ?? 0,
            ),
            memoryUsedMb: Number(
              (metric as { memoryUsedMb?: unknown }).memoryUsedMb ?? 0,
            ),
            memoryLimitMb: Number(
              (metric as { memoryLimitMb?: unknown }).memoryLimitMb ?? 0,
            ),
            networkRxBytes: Number(
              (metric as { networkRxBytes?: unknown }).networkRxBytes ?? 0,
            ),
            networkTxBytes: Number(
              (metric as { networkTxBytes?: unknown }).networkTxBytes ?? 0,
            ),
          },
        });
      }

      await store.appendMetricPoints(points);
      await evaluateMetricAlerts(points);
    }
  };

  fastify.decorate("daemonBus", {
    registerConnection: (nodeId, socket) => {
      sockets.set(nodeId, socket);
      socket.on("message", (raw: RawData) => {
        void handleMessage(nodeId, raw);
      });
      socket.on("close", () => {
        sockets.delete(nodeId);
        void store.touchNodeHeartbeat(nodeId, "offline");
        void createSystemAlert({
          type: "node.offline",
          scopeType: "node",
          scopeId: nodeId,
          title: "Node disconnected",
          message: `Daemon connection for node ${nodeId} closed`,
        });
      });
    },
    hasNodeConnection: (nodeId) => sockets.has(nodeId),
    subscribeConsole: (serverId, socket) => {
      const subscribers =
        consoleSubscribers.get(serverId) ?? new Set<WebSocket>();
      subscribers.add(socket);
      consoleSubscribers.set(serverId, subscribers);
      socket.on("close", () => {
        const current = consoleSubscribers.get(serverId);
        current?.delete(socket);
        if (current && current.size === 0) {
          consoleSubscribers.delete(serverId);
        }
      });
    },
    publishConsole,
    sendCommand: (nodeId, type, payload) =>
      new Promise((resolve, reject) => {
        const socket = sockets.get(nodeId);
        if (!socket || socket.readyState !== socket.OPEN) {
          reject(new Error(`Node ${nodeId} is not connected`));
          return;
        }

        const requestId = randomUUID();
        const timeout = setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Timed out waiting for ${type}`));
        }, 20_000);

        pending.set(requestId, { resolve, reject, timeout });
        socket.send(
          JSON.stringify({
            type,
            requestId,
            payload,
          }),
        );
      }),
  });
});
