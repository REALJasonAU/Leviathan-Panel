import type { FastifyInstance } from "fastify";

import { AppError } from "./errors.js";
import { store } from "./store.js";

export const runScheduledTask = async (
  fastify: FastifyInstance,
  taskId: string,
  actorId = "system",
) => {
  const task = await store.getScheduledTask(taskId);
  if (!task) {
    throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
  }

  const server = await store.getServer(task.serverId);
  if (!server) {
    throw new AppError(404, "SERVER_NOT_FOUND", "Server not found");
  }

  if (!fastify.daemonBus.hasNodeConnection(server.nodeId)) {
    throw new AppError(409, "NODE_OFFLINE", "Node is offline");
  }

  const execution = {
    id: `exec_${Date.now()}`,
    startedAt: new Date().toISOString(),
    status: "running" as const,
    message: "Running",
  };
  await store.appendTaskExecution(task.id, execution);

  try {
    switch (task.action.type) {
      case "power":
        await fastify.daemonBus.sendCommand(
          server.nodeId,
          `server.${task.action.powerAction}`,
          {
            serverId: server.id,
          },
        );
        break;
      case "command":
        await fastify.daemonBus.sendCommand(
          server.nodeId,
          "server.console.command",
          {
            serverId: server.id,
            command: task.action.command,
          },
        );
        break;
      case "backup":
        await fastify.daemonBus.sendCommand(
          server.nodeId,
          "server.backup.create",
          {
            serverId: server.id,
            backupId: `task_${task.id}_${Date.now()}`,
            backupName: `${server.name}-scheduled`,
            provider: "local",
          },
        );
        break;
      case "file_cleanup":
        await fastify.daemonBus.sendCommand(
          server.nodeId,
          "server.files.cleanup",
          {
            serverId: server.id,
            path: task.action.path,
            olderThanDays: task.action.olderThanDays,
          },
        );
        break;
    }

    await store.appendTaskExecution(task.id, {
      ...execution,
      completedAt: new Date().toISOString(),
      status: "completed",
      message: "Completed",
    });
    await store.appendAuditLog({
      actorId,
      actorType: actorId === "system" ? "system" : "user",
      action: "task.run",
      targetType: "task",
      targetId: task.id,
      metadata: {
        serverId: server.id,
      },
    });
    return { executed: true };
  } catch (error) {
    await store.appendTaskExecution(task.id, {
      ...execution,
      completedAt: new Date().toISOString(),
      status: "failed",
      message: error instanceof Error ? error.message : "Task failed",
    });
    throw error;
  }
};
