import type {
  ApiKeyRecord,
  AlertEventRecord,
  BackupTargetRecord,
  AuditLogRecord,
  BackupRecord,
  DashboardSummary,
  DomainMappingRecord,
  FirewallRuleRecord,
  JobRecord,
  FileEntryRecord,
  MetricPointRecord,
  NodeRecord,
  RoleRecord,
  ScheduledTaskRecord,
  ServerRecord,
  SettingsRecord,
  SftpCredentialRecord,
  TemplateRecord,
  UserRecord,
  WebhookRecord,
  WebhookDeliveryRecord,
  PluginManifest,
  CloudflareRouteRecord,
} from "@voltan/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type RequestOptions = {
  token: string;
  method?: string;
  body?: unknown;
};

const request = async <T>(
  path: string,
  options: RequestOptions,
): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${options.token}`,
      "content-type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }
    throw new Error(JSON.stringify(payload));
  }

  return response.json() as Promise<T>;
};

const requestBlob = async (path: string, token: string) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.blob();
};

const uploadForm = async <T>(path: string, token: string, body: FormData) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
};

export const consoleSocketUrl = (token: string, serverId: string) =>
  `${apiBaseUrl.replace(/^http/, "ws")}/v1/servers/${serverId}/console/socket?token=${encodeURIComponent(token)}`;

export type SessionResponse = {
  user: {
    uid: string;
    email?: string;
    displayName: string;
  };
  roles: Array<{
    id: string;
    name: string;
    permissions: string[];
  }>;
  permissions: string[];
};

export type FileContentResponse = {
  path: string;
  content: string;
  encoding: "utf8" | "base64";
};

export const api = {
  me: (token: string) => request<SessionResponse>("/v1/me", { token }),
  dashboard: (token: string) =>
    request<DashboardSummary>("/v1/dashboard", { token }),
  nodes: {
    list: (token: string) => request<NodeRecord[]>("/v1/nodes", { token }),
    create: (token: string, body: Record<string, unknown>) =>
      request<{ node: NodeRecord; bootstrapToken: string }>("/v1/nodes", {
        token,
        method: "POST",
        body,
      }),
    metrics: (token: string, nodeId: string) =>
      request<MetricPointRecord[]>(`/v1/nodes/${nodeId}/metrics?limit=48`, {
        token,
      }),
    config: (token: string, nodeId: string) =>
      request<{
        env: Record<string, string>;
        node: Pick<NodeRecord, "id" | "name" | "publicAddress" | "region">;
      }>(`/v1/nodes/${nodeId}/config`, { token }),
    maintenance: (token: string, nodeId: string, maintenanceMode: boolean) =>
      request<NodeRecord>(`/v1/nodes/${nodeId}/maintenance`, {
        token,
        method: "PATCH",
        body: { maintenanceMode },
      }),
  },
  templates: {
    list: (token: string) =>
      request<TemplateRecord[]>("/v1/templates", { token }),
    create: (token: string, body: Record<string, unknown>) =>
      request<TemplateRecord>("/v1/templates", {
        token,
        method: "POST",
        body,
      }),
    importEnvExample: (token: string, content: string) =>
      request<{ definitions: TemplateRecord["environmentDefinitions"] }>(
        "/v1/templates/import-env-example",
        {
          token,
          method: "POST",
          body: { content },
        },
      ),
  },
  servers: {
    list: (token: string) => request<ServerRecord[]>("/v1/servers", { token }),
    get: (token: string, serverId: string) =>
      request<ServerRecord>(`/v1/servers/${serverId}`, { token }),
    create: (token: string, body: Record<string, unknown>) =>
      request<ServerRecord>("/v1/servers", {
        token,
        method: "POST",
        body,
      }),
    remove: (token: string, serverId: string) =>
      request<{ deleted: boolean }>(`/v1/servers/${serverId}`, {
        token,
        method: "DELETE",
      }),
    updateEnvironment: (
      token: string,
      serverId: string,
      values: Record<string, string>,
    ) =>
      request<ServerRecord>(`/v1/servers/${serverId}/environment`, {
        token,
        method: "PATCH",
        body: { values },
      }),
    power: (token: string, serverId: string, action: string) =>
      request(`/v1/servers/${serverId}/power`, {
        token,
        method: "POST",
        body: { action },
      }),
    consoleCommand: (token: string, serverId: string, command: string) =>
      request(`/v1/servers/${serverId}/console/command`, {
        token,
        method: "POST",
        body: { command },
      }),
    files: {
      list: (token: string, serverId: string, path = ".") =>
        request<{ entries: FileEntryRecord[] }>(
          `/v1/servers/${serverId}/files?path=${encodeURIComponent(path)}`,
          { token },
        ),
      read: (token: string, serverId: string, path: string) =>
        request<FileContentResponse>(
          `/v1/servers/${serverId}/files/content?path=${encodeURIComponent(path)}`,
          { token },
        ),
      write: (
        token: string,
        serverId: string,
        path: string,
        content: string,
        encoding: "utf8" | "base64" = "utf8",
      ) =>
        request(`/v1/servers/${serverId}/files/content`, {
          token,
          method: "PUT",
          body: { path, content, encoding },
        }),
      upload: (token: string, serverId: string, path: string, file: File) => {
        const body = new FormData();
        body.append("path", path);
        body.append("file", file);
        return uploadForm(`/v1/servers/${serverId}/files/upload`, token, body);
      },
      downloadStream: (token: string, serverId: string, path: string) =>
        requestBlob(
          `/v1/servers/${serverId}/files/download?path=${encodeURIComponent(path)}`,
          token,
        ),
      remove: (token: string, serverId: string, path: string) =>
        request(`/v1/servers/${serverId}/files`, {
          token,
          method: "DELETE",
          body: { path },
        }),
      createFolder: (token: string, serverId: string, path: string) =>
        request(`/v1/servers/${serverId}/files/folder`, {
          token,
          method: "POST",
          body: { path },
        }),
      move: (
        token: string,
        serverId: string,
        sourcePath: string,
        destinationPath: string,
      ) =>
        request(`/v1/servers/${serverId}/files/move`, {
          token,
          method: "POST",
          body: { sourcePath, destinationPath },
        }),
      copy: (
        token: string,
        serverId: string,
        sourcePath: string,
        destinationPath: string,
      ) =>
        request(`/v1/servers/${serverId}/files/copy`, {
          token,
          method: "POST",
          body: { sourcePath, destinationPath },
        }),
      rename: (
        token: string,
        serverId: string,
        sourcePath: string,
        newName: string,
      ) =>
        request(`/v1/servers/${serverId}/files/rename`, {
          token,
          method: "POST",
          body: { sourcePath, newName },
        }),
      archive: (
        token: string,
        serverId: string,
        sourcePath: string,
        archivePath: string,
      ) =>
        request(`/v1/servers/${serverId}/files/archive`, {
          token,
          method: "POST",
          body: { sourcePath, archivePath },
        }),
      extract: (
        token: string,
        serverId: string,
        archivePath: string,
        destinationPath: string,
      ) =>
        request(`/v1/servers/${serverId}/files/extract`, {
          token,
          method: "POST",
          body: { archivePath, destinationPath },
        }),
    },
    backups: {
      list: (token: string, serverId: string) =>
        request<BackupRecord[]>(`/v1/servers/${serverId}/backups`, { token }),
      create: (token: string, serverId: string, name?: string) =>
        request<BackupRecord>(`/v1/servers/${serverId}/backups`, {
          token,
          method: "POST",
          body: { name, provider: "local" },
        }),
      restore: (token: string, backupId: string) =>
        request(`/v1/backups/${backupId}/restore`, {
          token,
          method: "POST",
          body: { overwrite: true },
        }),
      remove: (token: string, backupId: string) =>
        request(`/v1/backups/${backupId}`, {
          token,
          method: "DELETE",
        }),
      download: (token: string, backupId: string) =>
        request<{ fileName: string; contentBase64: string; sizeBytes: number }>(
          `/v1/backups/${backupId}/download`,
          { token },
        ),
      downloadStream: (token: string, backupId: string) =>
        requestBlob(`/v1/backups/${backupId}/stream`, token),
    },
    tasks: {
      list: (token: string, serverId: string) =>
        request<ScheduledTaskRecord[]>(`/v1/servers/${serverId}/tasks`, {
          token,
        }),
      create: (
        token: string,
        serverId: string,
        body: Record<string, unknown>,
      ) =>
        request<ScheduledTaskRecord>(`/v1/servers/${serverId}/tasks`, {
          token,
          method: "POST",
          body,
        }),
      update: (token: string, taskId: string, body: Record<string, unknown>) =>
        request<ScheduledTaskRecord>(`/v1/tasks/${taskId}`, {
          token,
          method: "PATCH",
          body,
        }),
      run: (token: string, taskId: string) =>
        request(`/v1/tasks/${taskId}/run`, {
          token,
          method: "POST",
        }),
      remove: (token: string, taskId: string) =>
        request(`/v1/tasks/${taskId}`, {
          token,
          method: "DELETE",
        }),
    },
    metrics: (token: string, serverId: string) =>
      request<MetricPointRecord[]>(`/v1/servers/${serverId}/metrics?limit=48`, {
        token,
      }),
    members: {
      list: (token: string, serverId: string) =>
        request<ServerRecord["members"]>(`/v1/servers/${serverId}/members`, {
          token,
        }),
      create: (
        token: string,
        serverId: string,
        body: Record<string, unknown>,
      ) =>
        request<ServerRecord["members"]>(`/v1/servers/${serverId}/members`, {
          token,
          method: "POST",
          body,
        }),
      update: (
        token: string,
        serverId: string,
        userId: string,
        body: Record<string, unknown>,
      ) =>
        request<ServerRecord["members"]>(
          `/v1/servers/${serverId}/members/${userId}`,
          {
            token,
            method: "PATCH",
            body,
          },
        ),
      remove: (token: string, serverId: string, userId: string) =>
        request<ServerRecord["members"]>(
          `/v1/servers/${serverId}/members/${userId}`,
          {
            token,
            method: "DELETE",
          },
        ),
    },
    domains: {
      list: (token: string, serverId: string) =>
        request<DomainMappingRecord[]>(`/v1/servers/${serverId}/domains`, {
          token,
        }),
      create: (
        token: string,
        serverId: string,
        body: Record<string, unknown>,
      ) =>
        request<DomainMappingRecord>(`/v1/servers/${serverId}/domains`, {
          token,
          method: "POST",
          body,
        }),
    },
    firewall: {
      list: (token: string, serverId: string) =>
        request<FirewallRuleRecord[]>(
          `/v1/servers/${serverId}/firewall-rules`,
          { token },
        ),
      create: (
        token: string,
        serverId: string,
        body: Record<string, unknown>,
      ) =>
        request<FirewallRuleRecord>(`/v1/servers/${serverId}/firewall-rules`, {
          token,
          method: "POST",
          body,
        }),
      apply: (token: string, serverId: string, dryRun = true) =>
        request(`/v1/servers/${serverId}/firewall-rules/apply`, {
          token,
          method: "POST",
          body: { serverId, dryRun },
        }),
    },
    sftp: (token: string, serverId: string) =>
      request<SftpCredentialRecord>(`/v1/servers/${serverId}/sftp`, { token }),
    rotateSftp: (token: string, serverId: string) =>
      request<SftpCredentialRecord>(`/v1/servers/${serverId}/sftp/rotate`, {
        token,
        method: "POST",
      }),
  },
  admin: {
    users: (token: string) => request<UserRecord[]>("/v1/users", { token }),
    updateUser: (token: string, userId: string, roleIds: string[]) =>
      request<UserRecord>(`/v1/users/${userId}`, {
        token,
        method: "PATCH",
        body: { roleIds },
      }),
    roles: (token: string) => request<RoleRecord[]>("/v1/roles", { token }),
    createRole: (token: string, body: Record<string, unknown>) =>
      request<RoleRecord>("/v1/roles", {
        token,
        method: "POST",
        body,
      }),
    auditLogs: (token: string) =>
      request<AuditLogRecord[]>("/v1/audit-logs?limit=50", { token }),
    settings: {
      get: (token: string) =>
        request<SettingsRecord>("/v1/settings", { token }),
      update: (token: string, body: Record<string, unknown>) =>
        request<SettingsRecord>("/v1/settings", {
          token,
          method: "PATCH",
          body,
        }),
    },
    apiKeys: {
      list: (token: string) =>
        request<ApiKeyRecord[]>("/v1/api-keys", { token }),
      create: (token: string, name: string, scopes: string[]) =>
        request<{ record: ApiKeyRecord; plainTextKey: string }>(
          "/v1/api-keys",
          {
            token,
            method: "POST",
            body: { name, scopes },
          },
        ),
      revoke: (token: string, keyId: string) =>
        request<ApiKeyRecord>(`/v1/api-keys/${keyId}`, {
          token,
          method: "DELETE",
        }),
    },
    webhooks: {
      list: (token: string) =>
        request<WebhookRecord[]>("/v1/webhooks", { token }),
      create: (token: string, body: Record<string, unknown>) =>
        request<WebhookRecord>("/v1/webhooks", {
          token,
          method: "POST",
          body,
        }),
    },
    webhookDeliveries: (token: string) =>
      request<WebhookDeliveryRecord[]>("/v1/webhook-deliveries?limit=50", {
        token,
      }),
    jobs: (token: string) =>
      request<JobRecord[]>("/v1/jobs?limit=100", { token }),
    backupTargets: {
      list: (token: string) =>
        request<BackupTargetRecord[]>("/v1/backup-targets", { token }),
      create: (token: string, body: Record<string, unknown>) =>
        request<BackupTargetRecord>("/v1/backup-targets", {
          token,
          method: "POST",
          body,
        }),
    },
    alerts: {
      events: (token: string) =>
        request<AlertEventRecord[]>("/v1/alerts/events?limit=100", { token }),
      acknowledge: (
        token: string,
        alertId: string,
        status: "acknowledged" | "resolved" = "acknowledged",
      ) =>
        request<AlertEventRecord>(`/v1/alerts/events/${alertId}`, {
          token,
          method: "PATCH",
          body: { status },
        }),
    },
    cloudflare: {
      routes: (token: string) =>
        request<CloudflareRouteRecord[]>("/v1/cloudflare/routes", { token }),
      createRoute: (token: string, body: Record<string, unknown>) =>
        request<CloudflareRouteRecord>("/v1/cloudflare/routes", {
          token,
          method: "POST",
          body,
        }),
      syncRoute: (token: string, routeId: string, dryRun = true) =>
        request(`/v1/cloudflare/routes/${routeId}/sync`, {
          token,
          method: "POST",
          body: { dryRun },
        }),
      deleteRoute: (token: string, routeId: string) =>
        request(`/v1/cloudflare/routes/${routeId}`, {
          token,
          method: "DELETE",
        }),
    },
    plugins: {
      list: (token: string) =>
        request<PluginManifest[]>("/v1/plugins", { token }),
      install: (token: string, manifest: PluginManifest) =>
        request<PluginManifest>("/v1/plugins", {
          token,
          method: "POST",
          body: { manifest },
        }),
    },
  },
};
