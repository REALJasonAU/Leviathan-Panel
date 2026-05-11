import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  AcknowledgeAlertInputSchema,
  CreateAlertRuleInputSchema,
  CreateApiKeyInputSchema,
  CreateBackupTargetInputSchema,
  CreateCloudflareRouteInputSchema,
  CreateRoleInputSchema,
  CreateWebhookInputSchema,
  CloudflareSyncInputSchema,
  IdParamSchema,
  PaginationQuerySchema,
  PluginInstallInputSchema,
  UpdateSettingsInputSchema,
  UpdateUserRolesInputSchema,
} from "@voltan/shared";

import { AppError } from "../lib/errors.js";
import {
  deleteCloudflareRoute,
  syncCloudflareRoute,
} from "../lib/cloudflare.js";
import { parseBody, parseParams, parseQuery } from "../lib/http.js";
import { store } from "../lib/store.js";
import { requirePermission } from "../plugins/auth.js";

const serializeApiKey = <T extends { hashedKey?: string }>(key: T) => {
  const { hashedKey: _hashedKey, ...safe } = key;
  void _hashedKey;
  return safe;
};

const serializeBackupTarget = <T extends { s3?: { secretAccessKey?: string } }>(
  target: T,
) => ({
  ...target,
  s3: target.s3
    ? {
        ...target.s3,
        secretAccessKey: "[redacted]",
      }
    : undefined,
});

const serializeSettings = <T extends { cloudflare?: { apiToken?: string } }>(
  settings: T,
) => ({
  ...settings,
  cloudflare: settings.cloudflare
    ? {
        ...settings.cloudflare,
        apiToken: settings.cloudflare.apiToken ? "[redacted]" : undefined,
      }
    : undefined,
});

export const registerAdminRoutes = async (fastify: FastifyInstance) => {
  fastify.get("/v1/users", async (request) => {
    requirePermission(request, "users.view");
    return store.listUsers();
  });

  fastify.patch("/v1/users/:id", async (request) => {
    requirePermission(request, "users.update");
    const { id } = parseParams(request, IdParamSchema);
    const input = parseBody(request, UpdateUserRolesInputSchema);
    const user = await store.updateUserRoles(id, input);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "user.roles.update",
      targetType: "user",
      targetId: id,
      metadata: {
        roleIds: input.roleIds,
        disabled: input.disabled,
      },
    });
    return user;
  });

  fastify.get("/v1/roles", async (request) => {
    requirePermission(request, "roles.view");
    return store.listRoles();
  });

  fastify.post("/v1/roles", async (request, reply) => {
    requirePermission(request, "roles.create");
    const input = parseBody(request, CreateRoleInputSchema);
    const role = await store.createRole(input);
    return reply.code(201).send(role);
  });

  fastify.get("/v1/audit-logs", async (request) => {
    requirePermission(request, "audit.view");
    const { limit } = parseQuery(request, PaginationQuerySchema);
    return store.listAuditLogs(limit);
  });

  fastify.get("/v1/settings", async (request) => {
    requirePermission(request, "settings.view");
    return serializeSettings(await store.getSettings());
  });

  fastify.patch("/v1/settings", async (request) => {
    requirePermission(request, "settings.update");
    const input = parseBody(request, UpdateSettingsInputSchema);
    if (input.cloudflare?.apiToken === "[redacted]") {
      delete input.cloudflare.apiToken;
    }
    const settings = await store.updateSettings(input);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "settings.update",
      targetType: "settings",
      targetId: "global",
      metadata: input,
    });
    return serializeSettings(settings);
  });

  fastify.get("/v1/allocations", async (request) => {
    requirePermission(request, "allocations.view");
    return store.listAllocations();
  });

  fastify.post("/v1/api-keys", async (request, reply) => {
    requirePermission(request, "apiKeys.create");
    const input = parseBody(request, CreateApiKeyInputSchema);
    const created = await store.createApiKey(input, request.auth!.user.uid);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "api_key.create",
      targetType: "api_key",
      targetId: created.record.id,
      metadata: {
        scopes: input.scopes,
        expiresAt: input.expiresAt,
      },
    });
    return reply.code(201).send({
      record: serializeApiKey(created.record),
      plainTextKey: created.plainTextKey,
    });
  });

  fastify.get("/v1/api-keys", async (request) => {
    requirePermission(request, "apiKeys.view");
    const keys = await store.listApiKeys();
    return keys.map(serializeApiKey);
  });

  fastify.delete("/v1/api-keys/:id", async (request) => {
    requirePermission(request, "apiKeys.revoke");
    const { id } = parseParams(request, IdParamSchema);
    const key = await store.revokeApiKey(id);
    if (!key) {
      throw new AppError(404, "API_KEY_NOT_FOUND", "API key not found");
    }
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "api_key.revoke",
      targetType: "api_key",
      targetId: id,
      metadata: {},
    });
    return serializeApiKey(key);
  });

  fastify.post("/v1/backup-targets", async (request, reply) => {
    requirePermission(request, "backupTargets.update");
    const input = parseBody(request, CreateBackupTargetInputSchema);
    const target = await store.createBackupTarget(input);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "backup_target.create",
      targetType: "backup_target",
      targetId: target.id,
      metadata: { provider: target.provider },
    });
    return reply.code(201).send(serializeBackupTarget(target));
  });

  fastify.get("/v1/backup-targets", async (request) => {
    requirePermission(request, "backupTargets.view");
    const targets = await store.listBackupTargets();
    return targets.map(serializeBackupTarget);
  });

  fastify.post("/v1/alerts/rules", async (request, reply) => {
    requirePermission(request, "alerts.update");
    const input = parseBody(request, CreateAlertRuleInputSchema);
    const rule = await store.createAlertRule(input);
    return reply.code(201).send(rule);
  });

  fastify.get("/v1/alerts/rules", async (request) => {
    requirePermission(request, "alerts.view");
    return store.listAlertRules();
  });

  fastify.get("/v1/alerts/events", async (request) => {
    requirePermission(request, "alerts.view");
    const { limit } = parseQuery(request, PaginationQuerySchema);
    return store.listAlertEvents(limit);
  });

  fastify.post("/v1/cloudflare/routes", async (request, reply) => {
    requirePermission(request, "integrations.update");
    const input = parseBody(request, CreateCloudflareRouteInputSchema);
    const route = await store.createCloudflareRoute(input);
    return reply.code(201).send(route);
  });

  fastify.get("/v1/cloudflare/routes", async (request) => {
    requirePermission(request, "integrations.view");
    return store.listCloudflareRoutes();
  });

  fastify.post("/v1/cloudflare/routes/:id/sync", async (request) => {
    requirePermission(request, "integrations.update");
    const { id } = parseParams(request, IdParamSchema);
    const input = parseBody(request, CloudflareSyncInputSchema);
    const route = (await store.listCloudflareRoutes()).find(
      (item) => item.id === id,
    );
    if (!route) {
      throw new AppError(404, "CLOUDFLARE_ROUTE_NOT_FOUND", "Route not found");
    }
    const result = await syncCloudflareRoute(
      await store.getSettings(),
      route,
      input.dryRun,
    );
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: input.dryRun
        ? "cloudflare.route.dry_run"
        : "cloudflare.route.sync",
      targetType: "cloudflare_route",
      targetId: id,
      metadata: { hostname: route.hostname, dryRun: input.dryRun },
    });
    return result;
  });

  fastify.delete("/v1/cloudflare/routes/:id", async (request) => {
    requirePermission(request, "integrations.update");
    const { id } = parseParams(request, IdParamSchema);
    const route = await store.deleteCloudflareRoute(id);
    if (!route) {
      throw new AppError(404, "CLOUDFLARE_ROUTE_NOT_FOUND", "Route not found");
    }
    const result = await deleteCloudflareRoute(
      await store.getSettings(),
      route,
      true,
    );
    return { deleted: true, cloudflare: result };
  });

  fastify.patch("/v1/alerts/events/:id", async (request) => {
    requirePermission(request, "alerts.update");
    const { id } = parseParams(request, IdParamSchema);
    const input = parseBody(request, AcknowledgeAlertInputSchema);
    const event = await store.updateAlertEvent(id, {
      status: input.status,
      acknowledgedBy:
        input.status === "acknowledged" ? request.auth!.user.uid : undefined,
      acknowledgedAt:
        input.status === "acknowledged" ? new Date().toISOString() : undefined,
      resolvedAt:
        input.status === "resolved" ? new Date().toISOString() : undefined,
    });
    if (!event) {
      throw new AppError(404, "ALERT_NOT_FOUND", "Alert event not found");
    }
    return event;
  });

  fastify.post("/v1/webhooks", async (request, reply) => {
    requirePermission(request, "webhooks.update");
    const input = parseBody(request, CreateWebhookInputSchema);
    const webhook = await store.createWebhook(input);
    return reply.code(201).send(webhook);
  });

  fastify.get("/v1/webhooks", async (request) => {
    requirePermission(request, "webhooks.view");
    return store.listWebhooks();
  });

  fastify.get("/v1/webhook-deliveries", async (request) => {
    requirePermission(request, "webhooks.view");
    const { limit } = parseQuery(request, PaginationQuerySchema);
    return store.listWebhookDeliveries(limit);
  });

  fastify.get("/v1/jobs", async (request) => {
    requirePermission(request, "tasks.view");
    const { limit } = parseQuery(request, PaginationQuerySchema);
    return store.listJobs(limit);
  });

  fastify.post("/v1/plugins", async (request, reply) => {
    requirePermission(request, "integrations.update");
    const input = parseBody(request, PluginInstallInputSchema);
    if (!input.manifest.trusted) {
      throw new AppError(
        422,
        "PLUGIN_NOT_TRUSTED",
        "Plugins must be marked trusted by an administrator before install",
      );
    }
    const manifest = await store.upsertPluginManifest(input.manifest);
    await store.appendAuditLog({
      actorId: request.auth!.user.uid,
      actorType: "user",
      action: "plugin.install",
      targetType: "plugin",
      targetId: manifest.id,
      metadata: { name: manifest.name, version: manifest.version },
    });
    return reply.code(201).send(manifest);
  });

  fastify.get("/v1/plugins", async (request) => {
    requirePermission(request, "integrations.view");
    return store.listPluginManifests();
  });

  fastify.patch("/v1/plugins/:id", async (request) => {
    requirePermission(request, "integrations.update");
    const { id } = parseParams(request, IdParamSchema);
    const input = parseBody(request, z.object({ enabled: z.boolean() }));
    const manifest = await store.setPluginEnabled(id, input.enabled);
    if (!manifest) {
      throw new AppError(404, "PLUGIN_NOT_FOUND", "Plugin not found");
    }
    return manifest;
  });
};
