import type { FastifyInstance } from "fastify";
import { z } from "zod";
import path from "node:path";
import { Readable } from "node:stream";

import {
  ConsoleCommandInputSchema,
  CreateBackupInputSchema,
  CreateDomainMappingInputSchema,
  CreateFirewallRuleInputSchema,
  CreateScheduledTaskInputSchema,
  CreateServerMemberInputSchema,
  CreateServerInputSchema,
  FileArchiveInputSchema,
  FileCopyInputSchema,
  FileCreateFolderInputSchema,
  FileDeleteInputSchema,
  FileExtractInputSchema,
  FileListQuerySchema,
  FileMoveInputSchema,
  FileReadQuerySchema,
  FileRenameInputSchema,
  FileWriteInputSchema,
  FirewallApplyInputSchema,
  IdParamSchema,
  PaginationQuerySchema,
  RestoreBackupInputSchema,
  ServerPowerActionInputSchema,
  UpdateScheduledTaskInputSchema,
  UpdateServerEnvironmentInputSchema,
  UpdateServerMemberInputSchema,
  maskSecretValues,
  validateEnvironmentValues,
} from "@voltan/shared";

import { canAccessServer, memberHasServerPermission } from "../lib/access.js";
import { AppError } from "../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../lib/http.js";
import { enqueueScheduledTaskJob } from "../lib/job-queue.js";
import { decryptSecret } from "../lib/secrets.js";
import { type AuthContext, store } from "../lib/store.js";
import { dispatchWebhookEvent } from "../lib/webhook-dispatcher.js";
import { requirePermission, resolveAuthFromToken } from "../plugins/auth.js";

const ServerMemberParamSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
});

const serializeServer = (
  server: NonNullable<Awaited<ReturnType<typeof store.getServer>>>,
) => ({
  ...server,
  environment: maskSecretValues(
    server.environmentDefinitions,
    server.environment,
  ),
});

const redactSftpCredential = <T extends { password?: string }>(
  credential: T,
) => ({
  ...credential,
  password: credential.password ? "[redacted]" : credential.password,
});

const requireServer = async (
  request: { auth?: AuthContext },
  serverId: string,
) => {
  const server = await store.getServer(serverId);
  if (!server || !request.auth || !canAccessServer(request.auth, server)) {
    throw new AppError(404, "SERVER_NOT_FOUND", "Server not found");
  }
  return server;
};

const requireServerFeature = (
  request: {
    auth?: NonNullable<Awaited<ReturnType<typeof store.upsertUserFromAuth>>>;
  },
  server: NonNullable<Awaited<ReturnType<typeof store.getServer>>>,
  globalPermission: Parameters<typeof requirePermission>[1],
  serverPermission: string,
) => {
  if (
    request.auth &&
    (request.auth.permissions.includes("*") ||
      request.auth.permissions.includes(globalPermission))
  ) {
    return;
  }
  if (
    !request.auth ||
    !memberHasServerPermission(request.auth, server, serverPermission)
  ) {
    throw new AppError(403, "FORBIDDEN", "Missing permission");
  }
};

const resolveBackupTarget = async (
  provider: "local" | "s3",
  targetId?: string,
) => {
  if (targetId) {
    const target = await store.getBackupTarget(targetId);
    if (!target || target.provider !== provider || !target.enabled) {
      throw new AppError(
        404,
        "BACKUP_TARGET_NOT_FOUND",
        "Backup target not found",
      );
    }
    return target;
  }
  if (provider !== "s3") {
    return null;
  }
  const settings = await store.getSettings();
  if (!settings.backup.defaultTargetId) {
    throw new AppError(
      422,
      "BACKUP_TARGET_REQUIRED",
      "S3 backups require a backup target",
    );
  }
  const target = await store.getBackupTarget(settings.backup.defaultTargetId);
  if (!target || target.provider !== "s3" || !target.enabled) {
    throw new AppError(
      422,
      "BACKUP_TARGET_INVALID",
      "Configured S3 backup target is unavailable",
    );
  }
  return target;
};

const issueTransfer = async (
  fastify: FastifyInstance,
  nodeId: string,
  payload: Record<string, unknown>,
) => {
  const node = await store.getNode(nodeId);
  if (!node) {
    throw new AppError(404, "NODE_NOT_FOUND", "Node not found");
  }
  const grant = (await fastify.daemonBus.sendCommand(
    nodeId,
    "transfer.issue",
    payload,
  )) as { transferId: string; expiresAt: string };
  return {
    ...grant,
    baseUrl: node.baseUrl.replace(/\/$/, ""),
  };
};

const decryptS3Target = <T extends { secretAccessKey?: string } | undefined>(
  target: T,
) =>
  target
    ? {
        ...target,
        secretAccessKey: decryptSecret(target.secretAccessKey) ?? "",
      }
    : undefined;

export const registerServerRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/v1/servers", async (request) => {
    requirePermission(request, "servers.view");
    const servers = await store.listServers(request.auth!);
    return servers.map(serializeServer);
  });

  fastify.get("/v1/servers/:id", async (request) => {
    requirePermission(request, "servers.view");
    const { id } = parseParams(request, IdParamSchema);
    return serializeServer(await requireServer(request, id));
  });

  fastify.get("/v1/servers/:id/members", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.members.view",
      "settings.manage",
    );
    return server.members;
  });

  fastify.post("/v1/servers/:id/members", async (request, reply) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.members.manage",
      "settings.manage",
    );
    const input = parseBody(request, CreateServerMemberInputSchema);
    const updated = await store.addServerMember(id, input);
    if (!updated) {
      throw new AppError(404, "SERVER_NOT_FOUND", "Server not found");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.member.add",
      targetType: "server",
      targetId: id,
      metadata: {
        memberUserId: input.userId,
        permissions: input.permissions,
      },
    });
    return reply.code(201).send(updated.members);
  });

  fastify.patch("/v1/servers/:id/members/:userId", async (request) => {
    const { id, userId } = parseParams(request, ServerMemberParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.members.manage",
      "settings.manage",
    );
    const input = parseBody(request, UpdateServerMemberInputSchema);
    const updated = await store.updateServerMember(id, userId, input);
    if (!updated) {
      throw new AppError(
        404,
        "SERVER_MEMBER_NOT_FOUND",
        "Server member not found",
      );
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.member.update",
      targetType: "server",
      targetId: id,
      metadata: {
        memberUserId: userId,
        permissions: input.permissions,
      },
    });
    return updated.members;
  });

  fastify.delete("/v1/servers/:id/members/:userId", async (request) => {
    const { id, userId } = parseParams(request, ServerMemberParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.members.manage",
      "settings.manage",
    );
    const updated = await store.removeServerMember(id, userId);
    if (!updated) {
      throw new AppError(404, "SERVER_NOT_FOUND", "Server not found");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.member.remove",
      targetType: "server",
      targetId: id,
      metadata: { memberUserId: userId },
    });
    return updated.members;
  });

  fastify.post(
    "/v1/servers",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      requirePermission(request, "servers.create");
      const input = parseBody(request, CreateServerInputSchema);
      const template = await store.getTemplate(input.templateId);
      if (!template) {
        throw new AppError(404, "TEMPLATE_NOT_FOUND", "Template not found");
      }

      const validationErrors = validateEnvironmentValues(
        template.environmentDefinitions,
        input.environment,
      );
      if (validationErrors.length > 0) {
        throw new AppError(
          422,
          "ENVIRONMENT_VALIDATION_FAILED",
          "Environment validation failed",
          {
            errors: validationErrors,
          },
        );
      }

      const server = await store.createServer(
        input,
        template.environmentDefinitions,
      );
      await store.appendAuditLog({
        actorId: request.auth!.user.uid,
        actorType: "user",
        action: "server.create",
        targetType: "server",
        targetId: server.id,
        metadata: {
          nodeId: server.nodeId,
          templateId: server.templateId,
        },
      });

      if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
        await fastify.daemonBus.sendCommand(server.nodeId, "server.create", {
          server,
        });
      }
      await dispatchWebhookEvent("server.create", {
        serverId: server.id,
        nodeId: server.nodeId,
      });

      return reply.code(201).send(serializeServer(server));
    },
  );

  fastify.patch("/v1/servers/:id/environment", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.environment.write",
      "servers.environment.write",
    );
    const input = parseBody(request, UpdateServerEnvironmentInputSchema);
    const template = await store.getTemplate(server.templateId);
    if (!template) {
      throw new AppError(404, "TEMPLATE_NOT_FOUND", "Template not found");
    }

    const merged = {
      ...server.environment,
      ...input.values,
    };
    const validationErrors = validateEnvironmentValues(
      template.environmentDefinitions,
      merged,
    );
    if (validationErrors.length > 0) {
      throw new AppError(
        422,
        "ENVIRONMENT_VALIDATION_FAILED",
        "Environment validation failed",
        {
          errors: validationErrors,
        },
      );
    }

    const updated = await store.updateServerEnvironment(
      id,
      merged,
      request.auth!.user.uid,
    );
    if (!updated) {
      throw new AppError(404, "SERVER_NOT_FOUND", "Server not found");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.environment.update",
      targetType: "server",
      targetId: id,
      metadata: {
        changedKeys: Object.keys(input.values),
      },
    });

    if (fastify.daemonBus.hasNodeConnection(updated.nodeId)) {
      await fastify.daemonBus.sendCommand(
        updated.nodeId,
        "server.syncEnvironment",
        {
          serverId: updated.id,
          environment: updated.environment,
        },
      );
    }
    return serializeServer(updated);
  });

  fastify.post(
    "/v1/servers/:id/power",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const { id } = parseParams(request, IdParamSchema);
      const server = await requireServer(request, id);
      requireServerFeature(request, server, "servers.power", "servers.power");
      const input = parseBody(request, ServerPowerActionInputSchema);

      await store.appendAuditLog({
        actorId: request.auth!.user.uid,
        actorType: "user",
        action: `server.power.${input.action}`,
        targetType: "server",
        targetId: id,
        metadata: {},
      });

      if (!fastify.daemonBus.hasNodeConnection(server.nodeId)) {
        throw new AppError(409, "NODE_OFFLINE", "Node is offline");
      }

      const result = await fastify.daemonBus.sendCommand(
        server.nodeId,
        `server.${input.action}`,
        {
          serverId: id,
        },
      );
      await dispatchWebhookEvent(`server.power.${input.action}`, {
        serverId: id,
      });
      return result;
    },
  );

  fastify.delete("/v1/servers/:id", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(request, server, "servers.delete", "servers.delete");
    if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      await fastify.daemonBus.sendCommand(server.nodeId, "server.delete", {
        serverId: id,
      });
    }
    await store.deleteServer(id);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.delete",
      targetType: "server",
      targetId: id,
      metadata: {},
    });
    return { deleted: true };
  });

  fastify.get(
    "/v1/servers/:id/console/socket",
    { websocket: true },
    async (socket, request) => {
      const query = request.query as { token?: string };
      const auth =
        request.auth ??
        (query.token ? await resolveAuthFromToken(query.token) : undefined);
      if (!auth) {
        socket.close(1008, "Unauthorized");
        return;
      }
      const { id } = IdParamSchema.parse(request.params);
      const server = await store.getServer(id);
      if (!server || !canAccessServer(auth, server)) {
        socket.close(1008, "Missing access");
        return;
      }
      if (
        !auth.permissions.includes("*") &&
        !auth.permissions.includes("servers.console.view") &&
        !memberHasServerPermission(auth, server, "servers.console.view")
      ) {
        socket.close(1008, "Missing console permission");
        return;
      }
      fastify.daemonBus.subscribeConsole(id, socket);
      socket.send(
        JSON.stringify({
          serverId: id,
          chunk: "[connected to console]\n",
          timestamp: new Date().toISOString(),
        }),
      );
    },
  );

  fastify.post("/v1/servers/:id/console/command", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.console.command",
      "servers.console.command",
    );
    const input = parseBody(request, ConsoleCommandInputSchema);
    if (!fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      throw new AppError(409, "NODE_OFFLINE", "Node is offline");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.console.command",
      targetType: "server",
      targetId: id,
      metadata: {
        commandLength: input.command.length,
      },
    });
    return fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.console.command",
      {
        serverId: id,
        command: input.command,
      },
    );
  });

  fastify.get("/v1/servers/:id/files", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.view",
      "servers.files.view",
    );
    const { path } = parseQuery(request, FileListQuerySchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.list", {
      serverId: id,
      path,
    });
  });

  fastify.get("/v1/servers/:id/files/content", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.view",
      "servers.files.view",
    );
    const { path } = parseQuery(request, FileReadQuerySchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.read", {
      serverId: id,
      path,
    });
  });

  fastify.get("/v1/servers/:id/files/download", async (request, reply) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.download",
      "files.read",
    );
    const { path: filePath } = parseQuery(request, FileReadQuerySchema);
    const transfer = await issueTransfer(fastify, server.nodeId, {
      kind: "file-download",
      serverId: id,
      path: filePath,
    });
    const response = await fetch(
      `${transfer.baseUrl}/v1/transfers/${transfer.transferId}/file`,
    );
    if (!response.ok || !response.body) {
      throw new AppError(502, "TRANSFER_FAILED", "Daemon file stream failed");
    }
    return reply
      .header("content-type", "application/octet-stream")
      .header(
        "content-disposition",
        `attachment; filename="${path.basename(filePath).replaceAll('"', "")}"`,
      )
      .send(
        Readable.fromWeb(
          response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
        ),
      );
  });

  fastify.post(
    "/v1/servers/:id/files/upload",
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute",
        },
      },
    },
    async (request) => {
      const { id } = parseParams(request, IdParamSchema);
      const server = await requireServer(request, id);
      requireServerFeature(
        request,
        server,
        "servers.files.upload",
        "files.write",
      );
      const part = await request.file();
      if (!part) {
        throw new AppError(422, "UPLOAD_REQUIRED", "A file upload is required");
      }
      const destination =
        typeof part.fields.path === "object" &&
        "value" in part.fields.path &&
        typeof part.fields.path.value === "string"
          ? part.fields.path.value
          : part.filename;
      const transfer = await issueTransfer(fastify, server.nodeId, {
        kind: "file-upload",
        serverId: id,
        path: destination,
      });
      const uploadResponse = await fetch(
        `${transfer.baseUrl}/v1/transfers/${transfer.transferId}/file`,
        {
          method: "PUT",
          body: part.file as never,
          duplex: "half",
        } as RequestInit & { duplex: "half" },
      );
      if (!uploadResponse.ok) {
        throw new AppError(502, "TRANSFER_FAILED", "Daemon file upload failed");
      }
      await store.appendAuditLog({
        actorId: request.auth!.user.uid,
        actorType: "user",
        action: "server.files.upload",
        targetType: "server",
        targetId: id,
        metadata: { path: destination, fileName: part.filename },
      });
      return uploadResponse.json();
    },
  );

  fastify.put("/v1/servers/:id/files/content", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.write",
      "servers.files.write",
    );
    const input = parseBody(request, FileWriteInputSchema);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.files.write",
      targetType: "server",
      targetId: id,
      metadata: {
        path: input.path,
      },
    });
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.write", {
      serverId: id,
      ...input,
    });
  });

  fastify.post("/v1/servers/:id/files/folder", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.write",
      "servers.files.write",
    );
    const input = parseBody(request, FileCreateFolderInputSchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.mkdir", {
      serverId: id,
      ...input,
    });
  });

  fastify.post("/v1/servers/:id/files/move", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.write",
      "servers.files.write",
    );
    const input = parseBody(request, FileMoveInputSchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.move", {
      serverId: id,
      ...input,
    });
  });

  fastify.post("/v1/servers/:id/files/copy", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.write",
      "servers.files.write",
    );
    const input = parseBody(request, FileCopyInputSchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.copy", {
      serverId: id,
      ...input,
    });
  });

  fastify.post("/v1/servers/:id/files/rename", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.write",
      "servers.files.write",
    );
    const input = parseBody(request, FileRenameInputSchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.rename", {
      serverId: id,
      ...input,
    });
  });

  fastify.post("/v1/servers/:id/files/archive", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.archive",
      "servers.files.archive",
    );
    const input = parseBody(request, FileArchiveInputSchema);
    return fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.files.archive",
      {
        serverId: id,
        ...input,
      },
    );
  });

  fastify.post("/v1/servers/:id/files/extract", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.archive",
      "servers.files.archive",
    );
    const input = parseBody(request, FileExtractInputSchema);
    return fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.files.extract",
      {
        serverId: id,
        ...input,
      },
    );
  });

  fastify.delete("/v1/servers/:id/files", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.write",
      "servers.files.write",
    );
    const input = parseBody(request, FileDeleteInputSchema);
    return fastify.daemonBus.sendCommand(server.nodeId, "server.files.delete", {
      serverId: id,
      ...input,
    });
  });

  fastify.get("/v1/servers/:id/backups", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.backups.view",
      "servers.backups.view",
    );
    return store.listServerBackups(id);
  });

  fastify.post("/v1/servers/:id/backups", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.backups.create",
      "servers.backups.create",
    );
    const input = parseBody(request, CreateBackupInputSchema);
    if (!fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      throw new AppError(409, "NODE_OFFLINE", "Node is offline");
    }
    const target = await resolveBackupTarget(input.provider, input.targetId);
    const backup = await store.createBackupRecord({
      serverId: id,
      nodeId: server.nodeId,
      name:
        input.name ??
        `${server.name}-${new Date().toISOString().replaceAll(":", "-")}`,
      status: "running",
      provider: input.provider,
      targetId: target?.id,
      createdBy: request.auth!.user.uid,
      sizeBytes: 0,
      progressPercent: 10,
    });
    const result = (await fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.backup.create",
      {
        serverId: id,
        backupId: backup.id,
        backupName: backup.name,
        provider: input.provider,
        target:
          target?.provider === "s3" ? decryptS3Target(target.s3) : undefined,
      },
    )) as {
      fileName?: string;
      filePath?: string;
      objectKey?: string;
      sizeBytes?: number;
      error?: string;
    };

    const final = await store.updateBackupRecord(backup.id, {
      status: result.error ? "failed" : "completed",
      fileName: result.fileName,
      filePath: result.filePath,
      objectKey: result.objectKey,
      sizeBytes: result.sizeBytes ?? 0,
      progressPercent: result.error ? 0 : 100,
      errorMessage: result.error,
      completedAt: result.error ? undefined : new Date().toISOString(),
    });
    await dispatchWebhookEvent(
      result.error ? "backup.failed" : "backup.completed",
      {
        serverId: id,
        backupId: backup.id,
      },
    );
    return final;
  });

  fastify.post("/v1/backups/:id/restore", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const input = parseBody(request, RestoreBackupInputSchema);
    const backup = await store.getBackup(id);
    if (!backup) {
      throw new AppError(404, "BACKUP_NOT_FOUND", "Backup not found");
    }
    const server = await requireServer(request, backup.serverId);
    requireServerFeature(
      request,
      server,
      "servers.backups.restore",
      "servers.backups.restore",
    );
    const target = backup.targetId
      ? await store.getBackupTarget(backup.targetId)
      : null;
    return fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.backup.restore",
      {
        serverId: server.id,
        backupId: backup.id,
        provider: backup.provider,
        objectKey: backup.objectKey,
        target:
          target?.provider === "s3" ? decryptS3Target(target.s3) : undefined,
        overwrite: input.overwrite,
      },
    );
  });

  fastify.get("/v1/backups/:id/download", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const backup = await store.getBackup(id);
    if (!backup) {
      throw new AppError(404, "BACKUP_NOT_FOUND", "Backup not found");
    }
    const server = await requireServer(request, backup.serverId);
    requireServerFeature(
      request,
      server,
      "servers.backups.view",
      "servers.backups.view",
    );
    const target = backup.targetId
      ? await store.getBackupTarget(backup.targetId)
      : null;
    return fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.backup.download",
      {
        serverId: server.id,
        backupId: backup.id,
        provider: backup.provider,
        objectKey: backup.objectKey,
        target:
          target?.provider === "s3" ? decryptS3Target(target.s3) : undefined,
      },
    );
  });

  fastify.get("/v1/backups/:id/stream", async (request, reply) => {
    const { id } = parseParams(request, IdParamSchema);
    const backup = await store.getBackup(id);
    if (!backup) {
      throw new AppError(404, "BACKUP_NOT_FOUND", "Backup not found");
    }
    const server = await requireServer(request, backup.serverId);
    requireServerFeature(
      request,
      server,
      "servers.backups.view",
      "backups.create",
    );
    const target = backup.targetId
      ? await store.getBackupTarget(backup.targetId)
      : null;
    if (backup.provider === "local") {
      const transfer = await issueTransfer(fastify, server.nodeId, {
        kind: "backup-download",
        serverId: server.id,
        backupId: backup.id,
      });
      const response = await fetch(
        `${transfer.baseUrl}/v1/transfers/${transfer.transferId}/backup`,
      );
      if (!response.ok || !response.body) {
        throw new AppError(
          502,
          "TRANSFER_FAILED",
          "Daemon backup stream failed",
        );
      }
      return reply
        .header("content-type", "application/gzip")
        .header(
          "content-disposition",
          `attachment; filename="${backup.id}.tar.gz"`,
        )
        .send(
          Readable.fromWeb(
            response.body as unknown as Parameters<typeof Readable.fromWeb>[0],
          ),
        );
    }
    const result = (await fastify.daemonBus.sendCommand(
      server.nodeId,
      "server.backup.download",
      {
        serverId: server.id,
        backupId: backup.id,
        provider: backup.provider,
        objectKey: backup.objectKey,
        target:
          target?.provider === "s3" ? decryptS3Target(target.s3) : undefined,
      },
    )) as { fileName: string; contentBase64: string; sizeBytes: number };
    return reply
      .header("content-type", "application/gzip")
      .header("content-length", String(result.sizeBytes))
      .header(
        "content-disposition",
        `attachment; filename="${result.fileName}"`,
      )
      .send(Buffer.from(result.contentBase64, "base64"));
  });

  fastify.delete("/v1/backups/:id", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const backup = await store.getBackup(id);
    if (!backup) {
      throw new AppError(404, "BACKUP_NOT_FOUND", "Backup not found");
    }
    const server = await requireServer(request, backup.serverId);
    requireServerFeature(
      request,
      server,
      "servers.backups.delete",
      "servers.backups.delete",
    );
    if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      const target = backup.targetId
        ? await store.getBackupTarget(backup.targetId)
        : null;
      await fastify.daemonBus.sendCommand(
        server.nodeId,
        "server.backup.delete",
        {
          serverId: server.id,
          backupId: backup.id,
          provider: backup.provider,
          objectKey: backup.objectKey,
          target:
            target?.provider === "s3" ? decryptS3Target(target.s3) : undefined,
        },
      );
    }
    await store.deleteBackupRecord(backup.id);
    return { deleted: true };
  });

  fastify.get("/v1/servers/:id/tasks", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.schedules.view",
      "servers.schedules.view",
    );
    return store.listScheduledTasks(id);
  });

  fastify.post("/v1/servers/:id/tasks", async (request, reply) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.schedules.create",
      "servers.schedules.create",
    );
    const input = parseBody(request, CreateScheduledTaskInputSchema);
    const task = await store.createScheduledTask(
      id,
      input,
      request.auth!.user.uid,
    );
    return reply.code(201).send(task);
  });

  fastify.patch("/v1/tasks/:id", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const input = parseBody(request, UpdateScheduledTaskInputSchema);
    const task = await store.updateScheduledTask(id, input);
    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
    }
    return task;
  });

  fastify.delete("/v1/tasks/:id", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const task = await store.deleteScheduledTask(id);
    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
    }
    return { deleted: true };
  });

  fastify.post("/v1/tasks/:id/run", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const task = await store.getScheduledTask(id);
    if (!task) {
      throw new AppError(404, "TASK_NOT_FOUND", "Task not found");
    }
    const server = await requireServer(request, task.serverId);
    requireServerFeature(
      request,
      server,
      "servers.schedules.run",
      "servers.schedules.run",
    );
    return enqueueScheduledTaskJob(id, request.auth!.user.uid);
  });

  fastify.get("/v1/servers/:id/metrics", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.metrics.view",
      "servers.metrics.view",
    );
    const { limit } = parseQuery(request, PaginationQuerySchema);
    return store.listMetrics("server", id, limit);
  });

  fastify.get("/v1/servers/:id/domains", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.network.view",
      "network.manage",
    );
    return store.listDomainMappings(id);
  });

  fastify.post("/v1/servers/:id/domains", async (request, reply) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.network.manage",
      "network.manage",
    );
    const input = parseBody(request, CreateDomainMappingInputSchema);
    if (input.serverId !== id) {
      throw new AppError(
        422,
        "DOMAIN_SERVER_MISMATCH",
        "Domain mapping serverId must match the route server id",
      );
    }
    const mapping = await store.createDomainMapping(input);
    if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      await fastify.daemonBus.sendCommand(server.nodeId, "proxy.reload", {
        server,
        mappings: await store.listDomainMappings(id),
      });
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.domain.create",
      targetType: "server",
      targetId: id,
      metadata: { domain: mapping.domain },
    });
    return reply.code(201).send(mapping);
  });

  fastify.get("/v1/servers/:id/firewall-rules", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.network.view",
      "network.manage",
    );
    return store.listFirewallRules(id);
  });

  fastify.post("/v1/servers/:id/firewall-rules", async (request, reply) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.network.manage",
      "network.manage",
    );
    const input = parseBody(request, CreateFirewallRuleInputSchema);
    const rule = await store.createFirewallRule({
      ...input,
      scope: "server",
      scopeId: id,
    });
    if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      await fastify.daemonBus.sendCommand(server.nodeId, "firewall.apply", {
        dryRun: true,
        rules: await store.listFirewallRules(id),
      });
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.firewall.create",
      targetType: "server",
      targetId: id,
      metadata: {
        port: rule.port,
        protocol: rule.protocol,
        action: rule.action,
      },
    });
    return reply.code(201).send(rule);
  });

  fastify.post("/v1/servers/:id/firewall-rules/apply", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.network.manage",
      "network.manage",
    );
    const input = parseBody(request, FirewallApplyInputSchema);
    if (!fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      throw new AppError(409, "NODE_OFFLINE", "Node is offline");
    }
    const result = await fastify.daemonBus.sendCommand(
      server.nodeId,
      "firewall.apply",
      {
        dryRun: input.dryRun,
        rules: await store.listFirewallRules(id),
      },
    );
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: input.dryRun
        ? "server.firewall.dry_run"
        : "server.firewall.apply",
      targetType: "server",
      targetId: id,
      metadata: { dryRun: input.dryRun },
    });
    return result;
  });

  fastify.get("/v1/servers/:id/sftp", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(
      request,
      server,
      "servers.files.view",
      "servers.files.view",
    );
    const credential =
      (await store.getSftpCredential(id)) ??
      (await store.generateSftpCredential(id));
    return redactSftpCredential(credential);
  });

  fastify.post("/v1/servers/:id/sftp/rotate", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(request, server, "servers.files.write", "files.write");
    const credential = await store.generateSftpCredential(id);
    if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      await fastify.daemonBus.sendCommand(server.nodeId, "server.sftp.rotate", {
        serverId: id,
        credential,
      });
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.sftp.rotate",
      targetType: "server",
      targetId: id,
      metadata: { username: credential.username },
    });
    return credential;
  });

  fastify.delete("/v1/servers/:id/sftp", async (request) => {
    const { id } = parseParams(request, IdParamSchema);
    const server = await requireServer(request, id);
    requireServerFeature(request, server, "servers.files.write", "files.write");
    const credential = await store.revokeSftpCredential(id);
    if (fastify.daemonBus.hasNodeConnection(server.nodeId)) {
      await fastify.daemonBus.sendCommand(server.nodeId, "server.sftp.revoke", {
        serverId: id,
      });
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "server.sftp.revoke",
      targetType: "server",
      targetId: id,
      metadata: {},
    });
    return credential ?? { revoked: true };
  });
};
