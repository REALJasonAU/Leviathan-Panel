import {
  AllocationSchema,
  type AllocationRecord,
  ApiKeySchema,
  type ApiKeyRecord,
  AuditLogSchema,
  type AuditLogRecord,
  BackupSchema,
  type BackupRecord,
  BackupTargetSchema,
  type BackupTargetRecord,
  type CreateApiKeyInputSchema,
  type CreateAlertRuleInputSchema,
  type CreateBackupTargetInputSchema,
  type CreateCloudflareRouteInputSchema,
  type CreateDomainMappingInputSchema,
  type CreateFirewallRuleInputSchema,
  type CreateNodeInputSchema,
  type CreateRoleInputSchema,
  type CreateScheduledTaskInputSchema,
  type CreateServerMemberInputSchema,
  type CreateServerInputSchema,
  type CreateTemplateInputSchema,
  type CreateWebhookInputSchema,
  type DashboardSummary,
  CloudflareRouteSchema,
  type CloudflareRouteRecord,
  DaemonUpdateHistorySchema,
  type DaemonUpdateHistoryRecord,
  DomainMappingSchema,
  type DomainMappingRecord,
  type EnvironmentVariableDefinition,
  FirewallRuleSchema,
  type FirewallRuleRecord,
  JobRecordSchema,
  type JobRecord,
  MetricPointSchema,
  type MetricPointRecord,
  type NodeMetricRecord,
  type NodeRecord,
  NodeSchema,
  PluginManifestSchema,
  type PluginManifest,
  RoleSchema,
  type RoleRecord,
  ScheduledTaskSchema,
  type ScheduledTaskRecord,
  SettingsSchema,
  type SettingsRecord,
  type ServerRecord,
  ServerSchema,
  SftpCredentialSchema,
  type SftpCredentialRecord,
  type TemplateRecord,
  TemplateSchema,
  type UpdateNodeMaintenanceInputSchema,
  type UpdateServerMemberInputSchema,
  type UpdateSettingsInputSchema,
  type UpdateUserRolesInputSchema,
  type UserRecord,
  UserSchema,
  WebhookSchema,
  WebhookDeliverySchema,
  type WebhookDeliveryRecord,
  type WebhookRecord,
  redactSecrets,
  AlertRuleSchema,
  type AlertRuleRecord,
  AlertEventSchema,
  type AlertEventRecord,
} from "@voltan/shared";
import { z } from "zod";

import { config } from "../config.js";
import { databaseEnabled, firestore } from "./db.js";
import { generateSessionId, type DocumentDatabase } from "./document-db.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { encryptSecret } from "./secrets.js";
import { generateId, generateToken, hashToken, nowIso } from "./utils.js";

type CreateNodeInput = z.infer<typeof CreateNodeInputSchema>;
type CreateTemplateInput = z.infer<typeof CreateTemplateInputSchema>;
type CreateServerInput = z.infer<typeof CreateServerInputSchema>;
type CreateScheduledTaskInput = z.infer<typeof CreateScheduledTaskInputSchema>;
type CreateRoleInput = z.infer<typeof CreateRoleInputSchema>;
type CreateApiKeyInput = z.infer<typeof CreateApiKeyInputSchema>;
type CreateWebhookInput = z.infer<typeof CreateWebhookInputSchema>;
type CreateServerMemberInput = z.infer<typeof CreateServerMemberInputSchema>;
type UpdateServerMemberInput = z.infer<typeof UpdateServerMemberInputSchema>;
type CreateBackupTargetInput = z.infer<typeof CreateBackupTargetInputSchema>;
type CreateAlertRuleInput = z.infer<typeof CreateAlertRuleInputSchema>;
type CreateDomainMappingInput = z.infer<typeof CreateDomainMappingInputSchema>;
type CreateFirewallRuleInput = z.infer<typeof CreateFirewallRuleInputSchema>;
type CreateCloudflareRouteInput = z.infer<
  typeof CreateCloudflareRouteInputSchema
>;
type UpdateNodeMaintenanceInput = z.infer<
  typeof UpdateNodeMaintenanceInputSchema
>;
type UpdateUserRolesInput = z.infer<typeof UpdateUserRolesInputSchema>;
type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;
type ExternalIdentity = {
  uid?: string;
  email?: string;
  name?: string;
  picture?: string;
};

const LocalAccountSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  usernameLower: z.string().min(1),
  emailLower: z.string().email(),
  passwordHash: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const SessionRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

type LocalAccountRecord = z.infer<typeof LocalAccountSchema>;
type SessionRecord = z.infer<typeof SessionRecordSchema>;

const onlineThresholdSeconds = 45;

const adminRole = RoleSchema.parse({
  id: "admin",
  name: "Administrator",
  permissions: ["*"],
  builtin: true,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const staffRole = RoleSchema.parse({
  id: "staff",
  name: "Staff",
  permissions: [
    "dashboard.view",
    "nodes.view",
    "servers.view",
    "servers.power",
    "servers.console.view",
    "servers.console.command",
    "servers.files.view",
    "servers.files.write",
    "servers.backups.view",
    "servers.backups.create",
    "servers.schedules.view",
    "servers.schedules.create",
    "audit.view",
  ],
  builtin: true,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const userRole = RoleSchema.parse({
  id: "user",
  name: "User",
  permissions: [
    "dashboard.view",
    "servers.view",
    "servers.console.view",
    "servers.files.view",
    "servers.environment.view",
    "servers.backups.view",
    "servers.schedules.view",
    "servers.metrics.view",
    "servers.network.view",
    "servers.settings.view",
  ],
  builtin: true,
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const starterTemplate = TemplateSchema.parse({
  id: "tpl_minecraft_java",
  name: "Minecraft Java",
  category: "game",
  description: "Vanilla or Paper-ready Java server template.",
  dockerImages: [
    "itzg/minecraft-server:latest",
    "ghcr.io/papermc/paper:latest",
  ],
  startupCommand: "java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui",
  environmentDefinitions: [
    {
      key: "EULA",
      displayName: "Accept EULA",
      description: "Must be TRUE before the server can start.",
      defaultValue: "TRUE",
      required: true,
      secret: false,
      readonly: false,
      allowedValues: ["TRUE", "FALSE"],
    },
    {
      key: "VERSION",
      displayName: "Minecraft Version",
      description: "Minecraft image version tag.",
      defaultValue: "1.20.6",
      required: true,
      secret: false,
      readonly: false,
      validationRule: "^[0-9.]+$",
      allowedValues: [],
    },
  ],
  importedEnvExample: "EULA=TRUE\nVERSION=1.20.6\n",
  createdAt: nowIso(),
  updatedAt: nowIso(),
});

const defaultSettings = SettingsSchema.parse({
  id: "global",
  appName: "Leviathan",
  backup: {
    retentionCount: 3,
    defaultProvider: "local",
  },
  metrics: {
    retentionHours: 72,
  },
  alerts: {
    nodeOfflineMinutes: 2,
  },
  updatedAt: nowIso(),
});

const resolveNodeStatus = (node: NodeRecord): NodeRecord => {
  if (node.maintenanceMode) {
    return { ...node, status: "maintenance" };
  }

  if (!node.lastHeartbeatAt && !node.lastSeenAt) {
    return { ...node, status: "offline" };
  }

  const last = node.lastHeartbeatAt ?? node.lastSeenAt;
  if (!last) {
    return { ...node, status: "offline" };
  }

  const ageSeconds = Math.floor((Date.now() - new Date(last).getTime()) / 1000);
  return {
    ...node,
    status: ageSeconds > onlineThresholdSeconds ? "offline" : "online",
  };
};

const redactAuditMetadata = (metadata: Record<string, unknown>) =>
  redactSecrets(metadata);

const encryptSettingsSecrets = (input: UpdateSettingsInput) => ({
  ...input,
  cloudflare: input.cloudflare
    ? {
        ...input.cloudflare,
        apiToken: encryptSecret(input.cloudflare.apiToken),
      }
    : undefined,
});

const encryptBackupTargetSecrets = (input: CreateBackupTargetInput) => ({
  ...input,
  s3: input.s3
    ? {
        ...input.s3,
        secretAccessKey: encryptSecret(input.s3.secretAccessKey) ?? "",
      }
    : undefined,
});

const encryptWebhookSecrets = (input: CreateWebhookInput) => ({
  ...input,
  secret: encryptSecret(input.secret),
});

export type AuthContext = {
  user: UserRecord;
  roles: RoleRecord[];
  permissions: string[];
  authType?: "session" | "mock" | "apiKey";
  apiKeyId?: string;
};

export interface Store {
  upsertUserFromAuth(
    token: ExternalIdentity | null,
    mode: "admin" | "user",
  ): Promise<AuthContext>;
  createLocalUser(input: {
    username: string;
    email: string;
    password: string;
    roleIds?: string[];
    displayName?: string;
  }): Promise<UserRecord>;
  authenticateLocalUser(
    identifier: string,
    password: string,
  ): Promise<AuthContext | null>;
  createSession(userId: string): Promise<string>;
  getAuthBySession(sessionId: string): Promise<AuthContext | null>;
  deleteSession(sessionId: string): Promise<void>;
  getRolesByIds(roleIds: string[]): Promise<RoleRecord[]>;
  listRoles(): Promise<RoleRecord[]>;
  createRole(input: CreateRoleInput): Promise<RoleRecord>;
  listUsers(): Promise<UserRecord[]>;
  updateUserRoles(
    userId: string,
    input: UpdateUserRolesInput,
  ): Promise<UserRecord | null>;
  getDashboardSummary(auth: AuthContext): Promise<DashboardSummary>;
  listNodes(): Promise<NodeRecord[]>;
  createNode(
    input: CreateNodeInput,
  ): Promise<{ node: NodeRecord; bootstrapToken: string }>;
  rotateNodeToken(nodeId: string): Promise<{ bootstrapToken: string }>;
  rotateDaemonToken(nodeId: string): Promise<{ daemonToken: string } | null>;
  updateNodeMaintenance(
    nodeId: string,
    input: UpdateNodeMaintenanceInput,
  ): Promise<NodeRecord | null>;
  getNode(nodeId: string): Promise<NodeRecord | null>;
  exchangeBootstrapToken(
    nodeId: string,
    bootstrapToken: string,
    registration?: { fingerprint?: string; version?: string },
  ): Promise<string | null>;
  validateDaemonToken(
    nodeId: string,
    daemonToken: string,
  ): Promise<NodeRecord | null>;
  touchNodeHeartbeat(
    nodeId: string,
    status: NodeRecord["status"],
    extras?: {
      fingerprint?: string;
      version?: string;
      metrics?: NodeMetricRecord;
    },
  ): Promise<void>;
  generateDaemonConfig(nodeId: string): Promise<{
    env: Record<string, string>;
    node: Pick<NodeRecord, "id" | "name" | "publicAddress" | "region">;
  } | null>;
  listTemplates(): Promise<TemplateRecord[]>;
  getTemplate(templateId: string): Promise<TemplateRecord | null>;
  createTemplate(input: CreateTemplateInput): Promise<TemplateRecord>;
  listServers(auth: AuthContext): Promise<ServerRecord[]>;
  getServer(serverId: string): Promise<ServerRecord | null>;
  createServer(
    input: CreateServerInput,
    environmentDefinitions: EnvironmentVariableDefinition[],
  ): Promise<ServerRecord>;
  updateServer(
    serverId: string,
    update: Partial<ServerRecord>,
  ): Promise<ServerRecord | null>;
  updateServerEnvironment(
    serverId: string,
    values: Record<string, string>,
    changedBy: string,
  ): Promise<ServerRecord | null>;
  addServerMember(
    serverId: string,
    input: CreateServerMemberInput,
  ): Promise<ServerRecord | null>;
  updateServerMember(
    serverId: string,
    userId: string,
    input: UpdateServerMemberInput,
  ): Promise<ServerRecord | null>;
  removeServerMember(
    serverId: string,
    userId: string,
  ): Promise<ServerRecord | null>;
  updateServerStatus(
    serverId: string,
    status: ServerRecord["status"],
    lastCrashAt?: string | null,
  ): Promise<void>;
  deleteServer(serverId: string): Promise<ServerRecord | null>;
  createAllocation(
    input: Omit<AllocationRecord, "id" | "createdAt">,
  ): Promise<AllocationRecord>;
  listAllocations(nodeId?: string): Promise<AllocationRecord[]>;
  assignAllocation(
    allocationId: string,
    serverId: string | null,
  ): Promise<AllocationRecord | null>;
  createBackupRecord(
    input: Omit<BackupRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<BackupRecord>;
  updateBackupRecord(
    backupId: string,
    update: Partial<BackupRecord>,
  ): Promise<BackupRecord | null>;
  getBackup(backupId: string): Promise<BackupRecord | null>;
  listServerBackups(serverId: string): Promise<BackupRecord[]>;
  deleteBackupRecord(backupId: string): Promise<BackupRecord | null>;
  createScheduledTask(
    serverId: string,
    input: CreateScheduledTaskInput,
    createdBy: string,
  ): Promise<ScheduledTaskRecord>;
  getScheduledTask(taskId: string): Promise<ScheduledTaskRecord | null>;
  listAllScheduledTasks(): Promise<ScheduledTaskRecord[]>;
  listScheduledTasks(serverId: string): Promise<ScheduledTaskRecord[]>;
  updateScheduledTask(
    taskId: string,
    update: Partial<ScheduledTaskRecord>,
  ): Promise<ScheduledTaskRecord | null>;
  deleteScheduledTask(taskId: string): Promise<ScheduledTaskRecord | null>;
  appendTaskExecution(
    taskId: string,
    execution: ScheduledTaskRecord["executions"][number],
  ): Promise<void>;
  appendMetricPoints(points: MetricPointRecord[]): Promise<void>;
  listMetrics(
    scopeType: MetricPointRecord["scopeType"],
    scopeId: string,
    limit?: number,
  ): Promise<MetricPointRecord[]>;
  getSettings(): Promise<SettingsRecord>;
  updateSettings(input: UpdateSettingsInput): Promise<SettingsRecord>;
  createBackupTarget(
    input: CreateBackupTargetInput,
  ): Promise<BackupTargetRecord>;
  listBackupTargets(): Promise<BackupTargetRecord[]>;
  getBackupTarget(targetId: string): Promise<BackupTargetRecord | null>;
  createApiKey(
    input: CreateApiKeyInput,
    ownerId: string,
  ): Promise<{ record: ApiKeyRecord; plainTextKey: string }>;
  listApiKeys(ownerId?: string): Promise<ApiKeyRecord[]>;
  validateApiKey(plainTextKey: string): Promise<AuthContext | null>;
  revokeApiKey(keyId: string): Promise<ApiKeyRecord | null>;
  createWebhook(input: CreateWebhookInput): Promise<WebhookRecord>;
  listWebhooks(): Promise<WebhookRecord[]>;
  createWebhookDelivery(
    input: Omit<WebhookDeliveryRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<WebhookDeliveryRecord>;
  updateWebhookDelivery(
    deliveryId: string,
    update: Partial<WebhookDeliveryRecord>,
  ): Promise<WebhookDeliveryRecord | null>;
  listWebhookDeliveries(limit?: number): Promise<WebhookDeliveryRecord[]>;
  createJob(
    input: Omit<JobRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<JobRecord>;
  claimPendingJobs(workerId: string, limit?: number): Promise<JobRecord[]>;
  updateJob(
    jobId: string,
    update: Partial<JobRecord>,
  ): Promise<JobRecord | null>;
  listJobs(limit?: number): Promise<JobRecord[]>;
  createAlertRule(input: CreateAlertRuleInput): Promise<AlertRuleRecord>;
  listAlertRules(): Promise<AlertRuleRecord[]>;
  createAlertEvent(
    input: Omit<AlertEventRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<AlertEventRecord>;
  listAlertEvents(limit?: number): Promise<AlertEventRecord[]>;
  updateAlertEvent(
    alertId: string,
    update: Partial<AlertEventRecord>,
  ): Promise<AlertEventRecord | null>;
  createDomainMapping(
    input: CreateDomainMappingInput,
  ): Promise<DomainMappingRecord>;
  listDomainMappings(serverId?: string): Promise<DomainMappingRecord[]>;
  createFirewallRule(
    input: CreateFirewallRuleInput,
  ): Promise<FirewallRuleRecord>;
  listFirewallRules(scopeId?: string): Promise<FirewallRuleRecord[]>;
  createCloudflareRoute(
    input: CreateCloudflareRouteInput,
  ): Promise<CloudflareRouteRecord>;
  listCloudflareRoutes(): Promise<CloudflareRouteRecord[]>;
  deleteCloudflareRoute(routeId: string): Promise<CloudflareRouteRecord | null>;
  createDaemonUpdateHistory(
    input: Omit<DaemonUpdateHistoryRecord, "id" | "createdAt" | "updatedAt">,
  ): Promise<DaemonUpdateHistoryRecord>;
  listDaemonUpdateHistory(
    nodeId?: string,
  ): Promise<DaemonUpdateHistoryRecord[]>;
  upsertPluginManifest(manifest: PluginManifest): Promise<PluginManifest>;
  listPluginManifests(): Promise<PluginManifest[]>;
  setPluginEnabled(
    pluginId: string,
    enabled: boolean,
  ): Promise<PluginManifest | null>;
  getSftpCredential(serverId: string): Promise<SftpCredentialRecord | null>;
  generateSftpCredential(serverId: string): Promise<SftpCredentialRecord>;
  revokeSftpCredential(serverId: string): Promise<SftpCredentialRecord | null>;
  appendAuditLog(
    record: Omit<AuditLogRecord, "id" | "createdAt">,
  ): Promise<void>;
  listAuditLogs(limit?: number): Promise<AuditLogRecord[]>;
}

class MemoryStore implements Store {
  protected readonly users = new Map<string, UserRecord>();
  protected readonly roles = new Map<string, RoleRecord>([
    [adminRole.id, adminRole],
    [staffRole.id, staffRole],
    [userRole.id, userRole],
  ]);
  protected readonly nodes = new Map<string, NodeRecord>();
  protected readonly templates = new Map<string, TemplateRecord>([
    [starterTemplate.id, starterTemplate],
  ]);
  protected readonly servers = new Map<string, ServerRecord>();
  protected readonly allocations = new Map<string, AllocationRecord>();
  protected readonly backups = new Map<string, BackupRecord>();
  protected readonly backupTargets = new Map<string, BackupTargetRecord>();
  protected readonly tasks = new Map<string, ScheduledTaskRecord>();
  protected readonly jobs = new Map<string, JobRecord>();
  protected readonly metrics: MetricPointRecord[] = [];
  protected readonly apiKeys = new Map<string, ApiKeyRecord>();
  protected readonly webhooks = new Map<string, WebhookRecord>();
  protected readonly webhookDeliveries = new Map<
    string,
    WebhookDeliveryRecord
  >();
  protected readonly alertRules = new Map<string, AlertRuleRecord>();
  protected readonly alertEvents = new Map<string, AlertEventRecord>();
  protected readonly domainMappings = new Map<string, DomainMappingRecord>();
  protected readonly firewallRules = new Map<string, FirewallRuleRecord>();
  protected readonly cloudflareRoutes = new Map<
    string,
    CloudflareRouteRecord
  >();
  protected readonly daemonUpdateHistory = new Map<
    string,
    DaemonUpdateHistoryRecord
  >();
  protected readonly pluginManifests = new Map<string, PluginManifest>();
  protected readonly sftpCredentials = new Map<string, SftpCredentialRecord>();
  protected readonly localAccounts = new Map<string, LocalAccountRecord>();
  protected readonly sessions = new Map<string, SessionRecord>();
  protected readonly auditLogs: AuditLogRecord[] = [];
  protected settings = defaultSettings;
  private readonly persistence: DocumentDatabase | null;

  constructor(persistence: DocumentDatabase | null = null) {
    this.persistence = persistence;
  }

  async initialize() {
    if (!this.persistence) {
      return;
    }

    const loadMap = async <
      T extends { id?: string; uid?: string; userId?: string },
    >(
      collection: string,
      parse: (value: Record<string, unknown>) => T,
      keyResolver: (value: T) => string,
      target: Map<string, T>,
    ) => {
      target.clear();
      const snapshot = await this.persistence!.collection(collection).get();
      for (const doc of snapshot.docs) {
        const parsed = parse({
          id: doc.id,
          ...(doc.data() ?? {}),
        });
        target.set(keyResolver(parsed), parsed);
      }
    };

    const loadArray = async <T>(
      collection: string,
      parse: (value: Record<string, unknown>) => T,
      target: T[],
    ) => {
      target.length = 0;
      const snapshot = await this.persistence!.collection(collection).get();
      const values = snapshot.docs
        .map((doc) =>
          parse({
            id: doc.id,
            ...(doc.data() ?? {}),
          }),
        )
        .sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        );
      target.push(...values);
    };

    await loadMap(
      "users",
      (value) => UserSchema.parse(value),
      (value) => value.uid,
      this.users,
    );
    await loadMap(
      "roles",
      (value) => RoleSchema.parse(value),
      (value) => value.id,
      this.roles,
    );
    await loadMap(
      "nodes",
      (value) => NodeSchema.parse(value),
      (value) => value.id,
      this.nodes,
    );
    await loadMap(
      "templates",
      (value) => TemplateSchema.parse(value),
      (value) => value.id,
      this.templates,
    );
    await loadMap(
      "servers",
      (value) => ServerSchema.parse(value),
      (value) => value.id,
      this.servers,
    );
    await loadMap(
      "allocations",
      (value) => AllocationSchema.parse(value),
      (value) => value.id!,
      this.allocations,
    );
    await loadMap(
      "backups",
      (value) => BackupSchema.parse(value),
      (value) => value.id,
      this.backups,
    );
    await loadMap(
      "backupTargets",
      (value) => BackupTargetSchema.parse(value),
      (value) => value.id,
      this.backupTargets,
    );
    await loadMap(
      "scheduledTasks",
      (value) => ScheduledTaskSchema.parse(value),
      (value) => value.id,
      this.tasks,
    );
    await loadMap(
      "jobs",
      (value) => JobRecordSchema.parse(value),
      (value) => value.id,
      this.jobs,
    );
    await loadArray(
      "metrics",
      (value) => MetricPointSchema.parse(value),
      this.metrics,
    );
    await loadMap(
      "apiKeys",
      (value) => ApiKeySchema.parse(value),
      (value) => value.id,
      this.apiKeys,
    );
    await loadMap(
      "webhooks",
      (value) => WebhookSchema.parse(value),
      (value) => value.id,
      this.webhooks,
    );
    await loadMap(
      "webhookDeliveries",
      (value) => WebhookDeliverySchema.parse(value),
      (value) => value.id,
      this.webhookDeliveries,
    );
    await loadMap(
      "alertRules",
      (value) => AlertRuleSchema.parse(value),
      (value) => value.id,
      this.alertRules,
    );
    await loadMap(
      "alertEvents",
      (value) => AlertEventSchema.parse(value),
      (value) => value.id,
      this.alertEvents,
    );
    await loadMap(
      "domainMappings",
      (value) => DomainMappingSchema.parse(value),
      (value) => value.id,
      this.domainMappings,
    );
    await loadMap(
      "firewallRules",
      (value) => FirewallRuleSchema.parse(value),
      (value) => value.id,
      this.firewallRules,
    );
    await loadMap(
      "cloudflareRoutes",
      (value) => CloudflareRouteSchema.parse(value),
      (value) => value.id,
      this.cloudflareRoutes,
    );
    await loadMap(
      "daemonUpdateHistory",
      (value) => DaemonUpdateHistorySchema.parse(value),
      (value) => value.id,
      this.daemonUpdateHistory,
    );
    await loadMap(
      "pluginManifests",
      (value) => PluginManifestSchema.parse(value),
      (value) => value.id,
      this.pluginManifests,
    );
    await loadMap(
      "sftpCredentials",
      (value) => SftpCredentialSchema.parse(value),
      (value) => value.serverId,
      this.sftpCredentials,
    );
    await loadMap(
      "localAccounts",
      (value) => LocalAccountSchema.parse(value),
      (value) => value.userId,
      this.localAccounts,
    );
    await loadMap(
      "sessions",
      (value) => SessionRecordSchema.parse(value),
      (value) => value.id,
      this.sessions,
    );
    await loadArray(
      "auditLogs",
      (value) => AuditLogSchema.parse(value),
      this.auditLogs,
    );

    const settingsSnapshot = await this.persistence
      .collection("settings")
      .doc("global")
      .get();
    if (settingsSnapshot.exists) {
      this.settings = SettingsSchema.parse(settingsSnapshot.data());
    }

    if (!this.roles.size) {
      this.roles.set(adminRole.id, adminRole);
      this.roles.set(staffRole.id, staffRole);
      this.roles.set(userRole.id, userRole);
      await this.persistRole(adminRole);
      await this.persistRole(staffRole);
      await this.persistRole(userRole);
    }

    if (!this.templates.size) {
      this.templates.set(starterTemplate.id, starterTemplate);
      await this.persistTemplate(starterTemplate);
    }

    if (!settingsSnapshot.exists) {
      await this.persistence
        .collection("settings")
        .doc("global")
        .set(this.settings);
    }
  }

  private async persistDoc(
    collection: string,
    id: string,
    value: Record<string, unknown>,
  ) {
    if (!this.persistence) {
      return;
    }
    await this.persistence.collection(collection).doc(id).set(value);
  }

  private async deleteDoc(collection: string, id: string) {
    if (!this.persistence) {
      return;
    }
    await this.persistence.collection(collection).doc(id).delete();
  }

  private async replaceCollection(
    collection: string,
    values: Array<{ id: string; value: Record<string, unknown> }>,
  ) {
    if (!this.persistence) {
      return;
    }
    const existing = await this.persistence.collection(collection).get();
    const nextIds = new Set(values.map((entry) => entry.id));
    await Promise.all(
      existing.docs
        .filter((doc) => !nextIds.has(doc.id))
        .map((doc) => doc.ref.delete()),
    );
    await Promise.all(
      values.map((entry) =>
        this.persistence!.collection(collection).doc(entry.id).set(entry.value),
      ),
    );
  }

  private async persistUser(user: UserRecord) {
    await this.persistDoc("users", user.uid, user);
  }

  private async persistRole(role: RoleRecord) {
    await this.persistDoc("roles", role.id, role);
  }

  private async persistTemplate(template: TemplateRecord) {
    await this.persistDoc("templates", template.id, template);
  }

  async createLocalUser(input: {
    username: string;
    email: string;
    password: string;
    roleIds?: string[];
    displayName?: string;
  }) {
    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const usernameLower = username.toLowerCase();

    const duplicate = [...this.localAccounts.values()].find(
      (account) =>
        account.usernameLower === usernameLower || account.emailLower === email,
    );
    if (duplicate) {
      throw new Error(
        "A local account with that username or email already exists",
      );
    }

    const user = UserSchema.parse({
      uid: generateId("usr"),
      email,
      displayName: input.displayName?.trim() || username,
      roleIds: input.roleIds?.length ? input.roleIds : ["user"],
      serverIds: [],
      twoFactorRequired: false,
      disabled: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso(),
    });
    const account = LocalAccountSchema.parse({
      userId: user.uid,
      username,
      usernameLower,
      emailLower: email,
      passwordHash: await hashPassword(input.password),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    this.users.set(user.uid, user);
    this.localAccounts.set(user.uid, account);
    await this.persistUser(user);
    await this.persistDoc("localAccounts", account.userId, account);
    return user;
  }

  async authenticateLocalUser(identifier: string, password: string) {
    const needle = identifier.trim().toLowerCase();
    const account = [...this.localAccounts.values()].find(
      (entry) => entry.usernameLower === needle || entry.emailLower === needle,
    );
    if (!account) {
      return null;
    }
    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      return null;
    }
    const user = this.users.get(account.userId);
    if (!user || user.disabled) {
      return null;
    }
    const updatedUser = UserSchema.parse({
      ...user,
      lastLoginAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.users.set(updatedUser.uid, updatedUser);
    await this.persistUser(updatedUser);
    const roles = await this.getRolesByIds(updatedUser.roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
    return {
      user: updatedUser,
      roles,
      permissions,
      authType: "session" as const,
    };
  }

  async createSession(userId: string) {
    const id = generateSessionId();
    const record = SessionRecordSchema.parse({
      id,
      userId,
      expiresAt: new Date(
        Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.sessions.set(record.id, record);
    await this.persistDoc("sessions", record.id, record);
    return id;
  }

  async getAuthBySession(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      this.sessions.delete(sessionId);
      await this.deleteDoc("sessions", sessionId);
      return null;
    }
    const user = this.users.get(session.userId);
    if (!user || user.disabled) {
      return null;
    }
    const roles = await this.getRolesByIds(user.roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
    return {
      user,
      roles,
      permissions,
      authType: "session" as const,
    };
  }

  async deleteSession(sessionId: string) {
    this.sessions.delete(sessionId);
    await this.deleteDoc("sessions", sessionId);
  }

  async upsertUserFromAuth(
    token: ExternalIdentity | null,
    mode: "admin" | "user",
  ): Promise<AuthContext> {
    const uid = token?.uid ?? `dev-${mode}`;
    const existing = this.users.get(uid);
    const roleIds =
      existing?.roleIds ?? (mode === "admin" ? ["admin"] : ["user"]);
    const user = UserSchema.parse({
      uid,
      email: token?.email ?? existing?.email,
      displayName:
        token?.name ??
        existing?.displayName ??
        (mode === "admin" ? "Dev Admin" : "Dev User"),
      photoUrl: token?.picture ?? existing?.photoUrl,
      roleIds,
      serverIds: existing?.serverIds ?? [],
      twoFactorRequired: existing?.twoFactorRequired ?? false,
      disabled: existing?.disabled ?? false,
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso(),
    });
    this.users.set(uid, user);
    await this.persistUser(user);

    const roles = await this.getRolesByIds(user.roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
    return { user, roles, permissions };
  }

  async getRolesByIds(roleIds: string[]) {
    return roleIds
      .map((roleId) => this.roles.get(roleId))
      .filter((role): role is RoleRecord => Boolean(role));
  }

  async listRoles() {
    return [...this.roles.values()];
  }

  async createRole(input: CreateRoleInput) {
    const role = RoleSchema.parse({
      ...input,
      builtin: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.roles.set(role.id, role);
    return role;
  }

  async listUsers() {
    return [...this.users.values()];
  }

  async updateUserRoles(userId: string, input: UpdateUserRolesInput) {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }
    const updated = UserSchema.parse({
      ...user,
      roleIds: input.roleIds,
      disabled: input.disabled ?? user.disabled,
      updatedAt: nowIso(),
    });
    this.users.set(userId, updated);
    return updated;
  }

  async getDashboardSummary(auth: AuthContext): Promise<DashboardSummary> {
    const [nodes, servers, templates, backups, tasks] = await Promise.all([
      this.listNodes(),
      this.listServers(auth),
      this.listTemplates(),
      Promise.resolve([...this.backups.values()]),
      Promise.resolve([...this.tasks.values()]),
    ]);
    return {
      totals: {
        nodes: nodes.length,
        servers: servers.length,
        templates: templates.length,
        onlineServers: servers.filter((server) => server.status === "running")
          .length,
        backups: backups.length,
        scheduledTasks: tasks.length,
      },
      nodes,
      servers,
      templates,
    };
  }

  async listNodes() {
    return [...this.nodes.values()].map(resolveNodeStatus);
  }

  async createNode(input: CreateNodeInput) {
    const bootstrapToken = generateToken("nd_bootstrap");
    const node = NodeSchema.parse({
      id: generateId("node"),
      ...input,
      status: "offline",
      maintenanceMode: false,
      platform: "linux",
      capabilities: input.capabilities,
      bootstrapTokenHash: hashToken(bootstrapToken),
      daemonTokenHash: undefined,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.nodes.set(node.id, node);
    return { node, bootstrapToken };
  }

  async rotateNodeToken(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error("Node not found");
    }
    const bootstrapToken = generateToken("nd_bootstrap");
    this.nodes.set(nodeId, {
      ...node,
      bootstrapTokenHash: hashToken(bootstrapToken),
      updatedAt: nowIso(),
    });
    return { bootstrapToken };
  }

  async rotateDaemonToken(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }
    const daemonToken = generateToken("nd_live");
    this.nodes.set(nodeId, {
      ...node,
      daemonTokenHash: hashToken(daemonToken),
      updatedAt: nowIso(),
    });
    return { daemonToken };
  }

  async updateNodeMaintenance(
    nodeId: string,
    input: UpdateNodeMaintenanceInput,
  ) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }
    const updated = NodeSchema.parse({
      ...node,
      maintenanceMode: input.maintenanceMode,
      maintenanceMessage: input.maintenanceMessage,
      updatedAt: nowIso(),
    });
    this.nodes.set(nodeId, updated);
    return resolveNodeStatus(updated);
  }

  async getNode(nodeId: string) {
    const node = this.nodes.get(nodeId);
    return node ? resolveNodeStatus(node) : null;
  }

  async exchangeBootstrapToken(
    nodeId: string,
    bootstrapToken: string,
    registration?: { fingerprint?: string; version?: string },
  ) {
    const node = this.nodes.get(nodeId);
    if (!node || node.bootstrapTokenHash !== hashToken(bootstrapToken)) {
      return null;
    }
    const daemonToken = generateToken("nd_live");
    this.nodes.set(nodeId, {
      ...node,
      daemonTokenHash: hashToken(daemonToken),
      daemonFingerprint: registration?.fingerprint ?? node.daemonFingerprint,
      daemonVersion: registration?.version ?? node.daemonVersion,
      lastHeartbeatAt: nowIso(),
      lastSeenAt: nowIso(),
      updatedAt: nowIso(),
    });
    return daemonToken;
  }

  async validateDaemonToken(nodeId: string, daemonToken: string) {
    const node = this.nodes.get(nodeId);
    if (!node || node.daemonTokenHash !== hashToken(daemonToken)) {
      return null;
    }
    return resolveNodeStatus(node);
  }

  async touchNodeHeartbeat(
    nodeId: string,
    status: NodeRecord["status"],
    extras?: {
      fingerprint?: string;
      version?: string;
      metrics?: NodeMetricRecord;
    },
  ) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }
    this.nodes.set(nodeId, {
      ...node,
      status,
      daemonFingerprint: extras?.fingerprint ?? node.daemonFingerprint,
      daemonVersion: extras?.version ?? node.daemonVersion,
      lastHeartbeatAt: nowIso(),
      lastSeenAt: nowIso(),
      lastMetrics: extras?.metrics ?? node.lastMetrics,
      updatedAt: nowIso(),
    });
  }

  async generateDaemonConfig(nodeId: string) {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return null;
    }
    const rotation = await this.rotateDaemonToken(nodeId);
    if (!rotation) {
      return null;
    }
    return {
      env: {
        PANEL_URL: node.baseUrl,
        NODE_ID: node.id,
        DAEMON_TOKEN: rotation.daemonToken,
        DAEMON_BASE_DIR: "/var/lib/leviathan",
        DOCKER_SOCKET_PATH: "/var/run/docker.sock",
      },
      node: {
        id: node.id,
        name: node.name,
        publicAddress: node.publicAddress,
        region: node.region,
      },
    };
  }

  async listTemplates() {
    return [...this.templates.values()];
  }

  async getTemplate(templateId: string) {
    return this.templates.get(templateId) ?? null;
  }

  async createTemplate(input: CreateTemplateInput) {
    const template = TemplateSchema.parse({
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.templates.set(template.id, template);
    return template;
  }

  async listServers(auth: AuthContext) {
    const all = [...this.servers.values()];
    if (auth.permissions.includes("*")) {
      return all;
    }
    return all.filter(
      (server) =>
        server.ownerId === auth.user.uid ||
        auth.user.serverIds.includes(server.id) ||
        server.members.some((member) => member.userId === auth.user.uid),
    );
  }

  async getServer(serverId: string) {
    return this.servers.get(serverId) ?? null;
  }

  async createServer(
    input: CreateServerInput,
    environmentDefinitions: EnvironmentVariableDefinition[],
  ) {
    const server = ServerSchema.parse({
      id: generateId("srv"),
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      nodeId: input.nodeId,
      templateId: input.templateId,
      dockerImage: input.dockerImage,
      status: "offline",
      suspended: false,
      allocations: input.allocations,
      limits: input.limits,
      startup: {
        command: input.startupCommand,
      },
      environment: input.environment,
      environmentDefinitions,
      restartPolicy: input.restartPolicy,
      members: [],
      firewallRules: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastCrashAt: null,
    });

    this.servers.set(server.id, server);
    const owner = this.users.get(server.ownerId);
    if (owner) {
      this.users.set(owner.uid, {
        ...owner,
        serverIds: [...new Set([...owner.serverIds, server.id])],
        updatedAt: nowIso(),
      });
    }
    for (const allocation of server.allocations) {
      if (allocation.id && this.allocations.has(allocation.id)) {
        const existing = this.allocations.get(allocation.id)!;
        this.allocations.set(allocation.id, {
          ...existing,
          assignedServerId: server.id,
        });
      }
    }
    return server;
  }

  async updateServer(serverId: string, update: Partial<ServerRecord>) {
    const server = this.servers.get(serverId);
    if (!server) {
      return null;
    }
    const updated = ServerSchema.parse({
      ...server,
      ...update,
      updatedAt: nowIso(),
    });
    this.servers.set(serverId, updated);
    return updated;
  }

  async updateServerEnvironment(
    serverId: string,
    values: Record<string, string>,
    _changedBy: string,
  ) {
    void _changedBy;
    return this.updateServer(serverId, { environment: values });
  }

  async addServerMember(serverId: string, input: CreateServerMemberInput) {
    const server = this.servers.get(serverId);
    if (!server) {
      return null;
    }
    const members = [
      ...server.members.filter((member) => member.userId !== input.userId),
      {
        userId: input.userId,
        permissions: input.permissions,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ];
    return this.updateServer(serverId, { members });
  }

  async updateServerMember(
    serverId: string,
    userId: string,
    input: UpdateServerMemberInput,
  ) {
    const server = this.servers.get(serverId);
    if (!server) {
      return null;
    }
    const existing = server.members.find((member) => member.userId === userId);
    if (!existing) {
      return null;
    }
    const members = server.members.map((member) =>
      member.userId === userId
        ? { ...member, permissions: input.permissions, updatedAt: nowIso() }
        : member,
    );
    return this.updateServer(serverId, { members });
  }

  async removeServerMember(serverId: string, userId: string) {
    const server = this.servers.get(serverId);
    if (!server) {
      return null;
    }
    return this.updateServer(serverId, {
      members: server.members.filter((member) => member.userId !== userId),
    });
  }

  async updateServerStatus(
    serverId: string,
    status: ServerRecord["status"],
    lastCrashAt?: string | null,
  ) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    this.servers.set(serverId, {
      ...server,
      status,
      crashCount:
        status === "errored" ? server.crashCount + 1 : server.crashCount,
      lastCrashAt: lastCrashAt ?? server.lastCrashAt,
      updatedAt: nowIso(),
    });
  }

  async deleteServer(serverId: string) {
    const server = this.servers.get(serverId);
    if (!server) {
      return null;
    }
    this.servers.delete(serverId);
    return server;
  }

  async createAllocation(input: Omit<AllocationRecord, "id" | "createdAt">) {
    const allocation = AllocationSchema.parse({
      id: generateId("alloc"),
      ...input,
      createdAt: nowIso(),
    });
    this.allocations.set(allocation.id!, allocation);
    return allocation;
  }

  async listAllocations(nodeId?: string) {
    const values = [...this.allocations.values()];
    return nodeId
      ? values.filter((allocation) => allocation.nodeId === nodeId)
      : values;
  }

  async assignAllocation(allocationId: string, serverId: string | null) {
    const allocation = this.allocations.get(allocationId);
    if (!allocation) {
      return null;
    }
    const updated = AllocationSchema.parse({
      ...allocation,
      assignedServerId: serverId,
    });
    this.allocations.set(allocationId, updated);
    return updated;
  }

  async createBackupRecord(
    input: Omit<BackupRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const backup = BackupSchema.parse({
      id: generateId("bkp"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.backups.set(backup.id, backup);
    return backup;
  }

  async updateBackupRecord(backupId: string, update: Partial<BackupRecord>) {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return null;
    }
    const updated = BackupSchema.parse({
      ...backup,
      ...update,
      updatedAt: nowIso(),
    });
    this.backups.set(backupId, updated);
    return updated;
  }

  async getBackup(backupId: string) {
    return this.backups.get(backupId) ?? null;
  }

  async listServerBackups(serverId: string) {
    return [...this.backups.values()].filter(
      (backup) => backup.serverId === serverId,
    );
  }

  async deleteBackupRecord(backupId: string) {
    const backup = this.backups.get(backupId);
    if (!backup) {
      return null;
    }
    this.backups.delete(backupId);
    return backup;
  }

  async createScheduledTask(
    serverId: string,
    input: CreateScheduledTaskInput,
    createdBy: string,
  ) {
    const task = ScheduledTaskSchema.parse({
      id: generateId("task"),
      serverId,
      ...input,
      createdBy,
      executions: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.tasks.set(task.id, task);
    return task;
  }

  async getScheduledTask(taskId: string) {
    return this.tasks.get(taskId) ?? null;
  }

  async listAllScheduledTasks() {
    return [...this.tasks.values()];
  }

  async listScheduledTasks(serverId: string) {
    return [...this.tasks.values()].filter(
      (task) => task.serverId === serverId,
    );
  }

  async updateScheduledTask(
    taskId: string,
    update: Partial<ScheduledTaskRecord>,
  ) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }
    const updated = ScheduledTaskSchema.parse({
      ...task,
      ...update,
      updatedAt: nowIso(),
    });
    this.tasks.set(taskId, updated);
    return updated;
  }

  async deleteScheduledTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }
    this.tasks.delete(taskId);
    return task;
  }

  async appendTaskExecution(
    taskId: string,
    execution: ScheduledTaskRecord["executions"][number],
  ) {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }
    await this.updateScheduledTask(taskId, {
      lastRunAt: execution.startedAt,
      executions: [...task.executions.slice(-24), execution],
    });
  }

  async appendMetricPoints(points: MetricPointRecord[]) {
    const retentionHours = this.settings.metrics.retentionHours;
    const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
    this.metrics.push(...points.map((point) => MetricPointSchema.parse(point)));
    const retained = this.metrics.filter(
      (point) => new Date(point.timestamp).getTime() >= cutoff,
    );
    this.metrics.length = 0;
    this.metrics.push(...retained);
  }

  async listMetrics(
    scopeType: MetricPointRecord["scopeType"],
    scopeId: string,
    limit = 100,
  ) {
    return this.metrics
      .filter(
        (point) => point.scopeType === scopeType && point.scopeId === scopeId,
      )
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit)
      .reverse();
  }

  async getSettings() {
    return this.settings;
  }

  async updateSettings(input: UpdateSettingsInput) {
    const encryptedInput = encryptSettingsSecrets(input);
    this.settings = SettingsSchema.parse({
      ...this.settings,
      ...encryptedInput,
      backup: {
        ...this.settings.backup,
        ...encryptedInput.backup,
      },
      metrics: {
        ...this.settings.metrics,
        ...encryptedInput.metrics,
      },
      alerts: {
        ...this.settings.alerts,
        ...encryptedInput.alerts,
      },
      cloudflare: {
        ...this.settings.cloudflare,
        ...encryptedInput.cloudflare,
      },
      updatedAt: nowIso(),
    });
    return this.settings;
  }

  async createBackupTarget(input: CreateBackupTargetInput) {
    const target = BackupTargetSchema.parse({
      id: generateId("bt"),
      ...encryptBackupTargetSecrets(input),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.backupTargets.set(target.id, target);
    return target;
  }

  async listBackupTargets() {
    return [...this.backupTargets.values()];
  }

  async getBackupTarget(targetId: string) {
    return this.backupTargets.get(targetId) ?? null;
  }

  async createApiKey(input: CreateApiKeyInput, ownerId: string) {
    const plainTextKey = `lvk_${generateToken("api")}`;
    const record = ApiKeySchema.parse({
      id: generateId("key"),
      name: input.name,
      ownerId,
      keyPrefix: plainTextKey.slice(0, 12),
      scopes: input.scopes,
      hashedKey: hashToken(plainTextKey),
      revoked: false,
      expiresAt: input.expiresAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.apiKeys.set(record.id, record);
    return { record, plainTextKey };
  }

  async listApiKeys(ownerId?: string) {
    const values = [...this.apiKeys.values()];
    return ownerId ? values.filter((key) => key.ownerId === ownerId) : values;
  }

  async validateApiKey(plainTextKey: string): Promise<AuthContext | null> {
    const hashedKey = hashToken(plainTextKey);
    const key = [...this.apiKeys.values()].find(
      (record) => record.hashedKey === hashedKey,
    );
    if (!key || key.revoked) {
      return null;
    }
    if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    const user = this.users.get(key.ownerId);
    if (!user || user.disabled) {
      return null;
    }
    const updated = ApiKeySchema.parse({
      ...key,
      lastUsedAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.apiKeys.set(updated.id, updated);
    return {
      user,
      roles: [],
      permissions: key.scopes,
      authType: "apiKey",
      apiKeyId: key.id,
    };
  }

  async revokeApiKey(keyId: string) {
    const key = this.apiKeys.get(keyId);
    if (!key) {
      return null;
    }
    const updated = ApiKeySchema.parse({
      ...key,
      revoked: true,
      updatedAt: nowIso(),
    });
    this.apiKeys.set(keyId, updated);
    return updated;
  }

  async createWebhook(input: CreateWebhookInput) {
    const webhook = WebhookSchema.parse({
      id: generateId("wh"),
      ...encryptWebhookSecrets(input),
      enabled: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.webhooks.set(webhook.id, webhook);
    return webhook;
  }

  async listWebhooks() {
    return [...this.webhooks.values()];
  }

  async createWebhookDelivery(
    input: Omit<WebhookDeliveryRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const delivery = WebhookDeliverySchema.parse({
      id: generateId("whd"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.webhookDeliveries.set(delivery.id, delivery);
    return delivery;
  }

  async updateWebhookDelivery(
    deliveryId: string,
    update: Partial<WebhookDeliveryRecord>,
  ) {
    const delivery = this.webhookDeliveries.get(deliveryId);
    if (!delivery) {
      return null;
    }
    const updated = WebhookDeliverySchema.parse({
      ...delivery,
      ...update,
      updatedAt: nowIso(),
    });
    this.webhookDeliveries.set(deliveryId, updated);
    return updated;
  }

  async listWebhookDeliveries(limit = 100) {
    return [...this.webhookDeliveries.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async createJob(input: Omit<JobRecord, "id" | "createdAt" | "updatedAt">) {
    if (input.dedupeKey) {
      const existing = [...this.jobs.values()].find(
        (job) =>
          job.dedupeKey === input.dedupeKey &&
          (job.status === "pending" || job.status === "running"),
      );
      if (existing) {
        return existing;
      }
    }
    const job = JobRecordSchema.parse({
      id: generateId("job"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.jobs.set(job.id, job);
    return job;
  }

  async claimPendingJobs(workerId: string, limit = 10) {
    const now = Date.now();
    const claimed: JobRecord[] = [];
    for (const job of [...this.jobs.values()].sort((left, right) =>
      left.runAfter.localeCompare(right.runAfter),
    )) {
      if (claimed.length >= limit) {
        break;
      }
      if (job.status !== "pending") {
        continue;
      }
      if (new Date(job.runAfter).getTime() > now) {
        continue;
      }
      if (job.lockedUntil && new Date(job.lockedUntil).getTime() > now) {
        continue;
      }
      const locked = JobRecordSchema.parse({
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        lockedBy: workerId,
        lockedUntil: new Date(now + 60_000).toISOString(),
        updatedAt: nowIso(),
      });
      this.jobs.set(locked.id, locked);
      claimed.push(locked);
    }
    return claimed;
  }

  async updateJob(jobId: string, update: Partial<JobRecord>) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    const updated = JobRecordSchema.parse({
      ...job,
      ...update,
      updatedAt: nowIso(),
    });
    this.jobs.set(jobId, updated);
    return updated;
  }

  async listJobs(limit = 100) {
    return [...this.jobs.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async createAlertRule(input: CreateAlertRuleInput) {
    const rule = AlertRuleSchema.parse({
      id: generateId("alr"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.alertRules.set(rule.id, rule);
    return rule;
  }

  async listAlertRules() {
    return [...this.alertRules.values()];
  }

  async createAlertEvent(
    input: Omit<AlertEventRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const event = AlertEventSchema.parse({
      id: generateId("ale"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.alertEvents.set(event.id, event);
    return event;
  }

  async listAlertEvents(limit = 100) {
    return [...this.alertEvents.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async updateAlertEvent(alertId: string, update: Partial<AlertEventRecord>) {
    const event = this.alertEvents.get(alertId);
    if (!event) {
      return null;
    }
    const updated = AlertEventSchema.parse({
      ...event,
      ...update,
      updatedAt: nowIso(),
    });
    this.alertEvents.set(alertId, updated);
    return updated;
  }

  async createDomainMapping(input: CreateDomainMappingInput) {
    const mapping = DomainMappingSchema.parse({
      id: generateId("dom"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.domainMappings.set(mapping.id, mapping);
    return mapping;
  }

  async listDomainMappings(serverId?: string) {
    const mappings = [...this.domainMappings.values()];
    return serverId
      ? mappings.filter((mapping) => mapping.serverId === serverId)
      : mappings;
  }

  async createFirewallRule(input: CreateFirewallRuleInput) {
    const rule = FirewallRuleSchema.parse({
      id: generateId("fw"),
      ...input,
      createdAt: nowIso(),
    });
    this.firewallRules.set(rule.id, rule);
    return rule;
  }

  async listFirewallRules(scopeId?: string) {
    const rules = [...this.firewallRules.values()];
    return scopeId ? rules.filter((rule) => rule.scopeId === scopeId) : rules;
  }

  async createCloudflareRoute(input: CreateCloudflareRouteInput) {
    const route = CloudflareRouteSchema.parse({
      id: generateId("cfr"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.cloudflareRoutes.set(route.id, route);
    return route;
  }

  async listCloudflareRoutes() {
    return [...this.cloudflareRoutes.values()];
  }

  async deleteCloudflareRoute(routeId: string) {
    const route = this.cloudflareRoutes.get(routeId);
    if (!route) {
      return null;
    }
    this.cloudflareRoutes.delete(routeId);
    return route;
  }

  async createDaemonUpdateHistory(
    input: Omit<DaemonUpdateHistoryRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const record = DaemonUpdateHistorySchema.parse({
      id: generateId("upd"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    this.daemonUpdateHistory.set(record.id, record);
    return record;
  }

  async listDaemonUpdateHistory(nodeId?: string) {
    const history = [...this.daemonUpdateHistory.values()];
    return (
      nodeId ? history.filter((record) => record.nodeId === nodeId) : history
    ).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async upsertPluginManifest(manifest: PluginManifest) {
    const parsed = PluginManifestSchema.parse(manifest);
    this.pluginManifests.set(parsed.id, parsed);
    return parsed;
  }

  async listPluginManifests() {
    return [...this.pluginManifests.values()];
  }

  async setPluginEnabled(pluginId: string, enabled: boolean) {
    const manifest = this.pluginManifests.get(pluginId);
    if (!manifest) {
      return null;
    }
    const updated = PluginManifestSchema.parse({ ...manifest, enabled });
    this.pluginManifests.set(pluginId, updated);
    return updated;
  }

  async generateSftpCredential(serverId: string) {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error("Server not found");
    }
    const credential = SftpCredentialSchema.parse({
      id: generateId("sftp"),
      serverId,
      username: `srv_${serverId.slice(-8)}`,
      password: generateToken("sftp"),
      host: server.allocations[0]?.ip ?? "127.0.0.1",
      port: 2022,
      rootPath: `/var/lib/leviathan/servers/${serverId}`,
      revoked: false,
      generatedAt: nowIso(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      rotatedAt: nowIso(),
    });
    this.sftpCredentials.set(serverId, credential);
    return credential;
  }

  async getSftpCredential(serverId: string) {
    return this.sftpCredentials.get(serverId) ?? null;
  }

  async revokeSftpCredential(serverId: string) {
    const credential = this.sftpCredentials.get(serverId);
    if (!credential) {
      return null;
    }
    const updated = SftpCredentialSchema.parse({
      ...credential,
      revoked: true,
      revokedAt: nowIso(),
    });
    this.sftpCredentials.set(serverId, updated);
    return updated;
  }

  async appendAuditLog(record: Omit<AuditLogRecord, "id" | "createdAt">) {
    this.auditLogs.push({
      id: generateId("audit"),
      ...record,
      metadata: redactAuditMetadata(record.metadata),
      createdAt: nowIso(),
    });
  }

  async listAuditLogs(limit = 100) {
    return [...this.auditLogs].slice(-limit).reverse();
  }
}

class SqlStore implements Store {
  private async listCollection<T>(
    collectionName: string,
    parse: (value: Record<string, unknown>, id: string) => T,
  ) {
    const snapshot = await firestore.collection(collectionName).get();
    return snapshot.docs.map((doc) =>
      parse(doc.data() as Record<string, unknown>, doc.id),
    );
  }

  async createLocalUser(input: {
    username: string;
    email: string;
    password: string;
    roleIds?: string[];
    displayName?: string;
  }) {
    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const usernameLower = username.toLowerCase();

    const accounts = await this.listCollection("localAccounts", (data) =>
      LocalAccountSchema.parse(data),
    );
    const duplicate = accounts.find(
      (account) =>
        account.usernameLower === usernameLower || account.emailLower === email,
    );
    if (duplicate) {
      throw new Error(
        "A local account with that username or email already exists",
      );
    }

    const user = UserSchema.parse({
      uid: generateId("usr"),
      email,
      displayName: input.displayName?.trim() || username,
      roleIds: input.roleIds?.length ? input.roleIds : ["user"],
      serverIds: [],
      twoFactorRequired: false,
      disabled: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso(),
    });

    const account = LocalAccountSchema.parse({
      userId: user.uid,
      username,
      usernameLower,
      emailLower: email,
      passwordHash: await hashPassword(input.password),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    await firestore!.collection("users").doc(user.uid).set(user);
    await firestore!.collection("localAccounts").doc(user.uid).set(account);
    return user;
  }

  async authenticateLocalUser(identifier: string, password: string) {
    const needle = identifier.trim().toLowerCase();
    const accounts = await this.listCollection("localAccounts", (data) =>
      LocalAccountSchema.parse(data),
    );
    const account = accounts.find(
      (entry) => entry.usernameLower === needle || entry.emailLower === needle,
    );
    if (!account) {
      return null;
    }
    const valid = await verifyPassword(password, account.passwordHash);
    if (!valid) {
      return null;
    }
    const ref = firestore!.collection("users").doc(account.userId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    const user = UserSchema.parse(snapshot.data());
    if (user.disabled) {
      return null;
    }
    const updated = UserSchema.parse({
      ...user,
      lastLoginAt: nowIso(),
      updatedAt: nowIso(),
    });
    await ref.set(updated);
    const roles = await this.getRolesByIds(updated.roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
    return {
      user: updated,
      roles,
      permissions,
      authType: "session" as const,
    };
  }

  async createSession(userId: string) {
    const record = SessionRecordSchema.parse({
      id: generateSessionId(),
      userId,
      expiresAt: new Date(
        Date.now() + config.SESSION_TTL_HOURS * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore!.collection("sessions").doc(record.id).set(record);
    return record.id;
  }

  async getAuthBySession(sessionId: string) {
    const snapshot = await firestore!
      .collection("sessions")
      .doc(sessionId)
      .get();
    if (!snapshot.exists) {
      return null;
    }
    const session = SessionRecordSchema.parse(snapshot.data());
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await firestore!.collection("sessions").doc(sessionId).delete();
      return null;
    }
    const userSnapshot = await firestore!
      .collection("users")
      .doc(session.userId)
      .get();
    if (!userSnapshot.exists) {
      return null;
    }
    const user = UserSchema.parse(userSnapshot.data());
    if (user.disabled) {
      return null;
    }
    const roles = await this.getRolesByIds(user.roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
    return {
      user,
      roles,
      permissions,
      authType: "session" as const,
    };
  }

  async deleteSession(sessionId: string) {
    await firestore!.collection("sessions").doc(sessionId).delete();
  }

  async upsertUserFromAuth(
    token: ExternalIdentity | null,
    mode: "admin" | "user",
  ): Promise<AuthContext> {
    const uid = token?.uid ?? `dev-${mode}`;
    const ref = firestore.collection("users").doc(uid);
    const snapshot = await ref.get();
    const roleIds = snapshot.exists
      ? ((snapshot.data()?.roleIds as string[] | undefined) ?? [])
      : mode === "admin"
        ? ["admin"]
        : ["user"];

    const payload = UserSchema.parse({
      uid,
      email: token?.email ?? snapshot.data()?.email,
      displayName:
        token?.name ??
        snapshot.data()?.displayName ??
        (mode === "admin" ? "Dev Admin" : "Dev User"),
      photoUrl: token?.picture ?? snapshot.data()?.photoUrl,
      roleIds,
      serverIds: (snapshot.data()?.serverIds as string[] | undefined) ?? [],
      twoFactorRequired: snapshot.data()?.twoFactorRequired ?? false,
      disabled: snapshot.data()?.disabled ?? false,
      createdAt: snapshot.data()?.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: nowIso(),
    });
    await ref.set(payload, { merge: true });
    const roles = await this.getRolesByIds(payload.roleIds);
    const permissions = [...new Set(roles.flatMap((role) => role.permissions))];
    return { user: payload, roles, permissions, authType: "mock" };
  }

  async getRolesByIds(roleIds: string[]) {
    if (roleIds.length === 0) {
      return [];
    }
    const docs = await Promise.all(
      roleIds.map((roleId) => firestore.collection("roles").doc(roleId).get()),
    );
    return docs
      .filter((doc) => doc.exists)
      .map((doc) => RoleSchema.parse({ id: doc.id, ...doc.data() }));
  }

  async listRoles() {
    return this.listCollection("roles", (data, id) =>
      RoleSchema.parse({ id, ...data }),
    );
  }

  async createRole(input: CreateRoleInput) {
    const role = RoleSchema.parse({
      ...input,
      builtin: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("roles").doc(role.id).set(role);
    return role;
  }

  async listUsers() {
    return this.listCollection("users", (data) => UserSchema.parse(data));
  }

  async updateUserRoles(userId: string, input: UpdateUserRolesInput) {
    const ref = firestore.collection("users").doc(userId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(
      {
        roleIds: input.roleIds,
        disabled: input.disabled ?? snapshot.data()?.disabled ?? false,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    const updated = await ref.get();
    return UserSchema.parse(updated.data());
  }

  async getDashboardSummary(auth: AuthContext) {
    const [nodes, servers, templates, backups, tasks] = await Promise.all([
      this.listNodes(),
      this.listServers(auth),
      this.listTemplates(),
      this.listCollection("backups", (data, id) =>
        BackupSchema.parse({ id, ...data }),
      ),
      this.listCollection("scheduledTasks", (data, id) =>
        ScheduledTaskSchema.parse({ id, ...data }),
      ),
    ]);
    return {
      totals: {
        nodes: nodes.length,
        servers: servers.length,
        templates: templates.length,
        onlineServers: servers.filter((server) => server.status === "running")
          .length,
        backups: backups.length,
        scheduledTasks: tasks.length,
      },
      nodes,
      servers,
      templates,
    };
  }

  async listNodes() {
    const nodes = await this.listCollection("nodes", (data, id) =>
      NodeSchema.parse({ id, ...data }),
    );
    return nodes.map(resolveNodeStatus);
  }

  async createNode(input: CreateNodeInput) {
    const bootstrapToken = generateToken("nd_bootstrap");
    const node = NodeSchema.parse({
      id: generateId("node"),
      ...input,
      status: "offline",
      maintenanceMode: false,
      platform: "linux",
      capabilities: input.capabilities,
      bootstrapTokenHash: hashToken(bootstrapToken),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("nodes").doc(node.id).set(node);
    return { node, bootstrapToken };
  }

  async rotateNodeToken(nodeId: string) {
    const bootstrapToken = generateToken("nd_bootstrap");
    await firestore
      .collection("nodes")
      .doc(nodeId)
      .set(
        {
          bootstrapTokenHash: hashToken(bootstrapToken),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    return { bootstrapToken };
  }

  async rotateDaemonToken(nodeId: string) {
    const daemonToken = generateToken("nd_live");
    const node = await this.getNode(nodeId);
    if (!node) {
      return null;
    }
    await firestore
      .collection("nodes")
      .doc(nodeId)
      .set(
        {
          daemonTokenHash: hashToken(daemonToken),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    return { daemonToken };
  }

  async updateNodeMaintenance(
    nodeId: string,
    input: UpdateNodeMaintenanceInput,
  ) {
    await firestore
      .collection("nodes")
      .doc(nodeId)
      .set(
        {
          maintenanceMode: input.maintenanceMode,
          maintenanceMessage: input.maintenanceMessage ?? null,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    return this.getNode(nodeId);
  }

  async getNode(nodeId: string) {
    const snapshot = await firestore.collection("nodes").doc(nodeId).get();
    return snapshot.exists
      ? resolveNodeStatus(
          NodeSchema.parse({ id: snapshot.id, ...snapshot.data() }),
        )
      : null;
  }

  async exchangeBootstrapToken(
    nodeId: string,
    bootstrapToken: string,
    registration?: { fingerprint?: string; version?: string },
  ) {
    const node = await this.getNode(nodeId);
    if (!node || node.bootstrapTokenHash !== hashToken(bootstrapToken)) {
      return null;
    }
    const daemonToken = generateToken("nd_live");
    await firestore
      .collection("nodes")
      .doc(nodeId)
      .set(
        {
          daemonTokenHash: hashToken(daemonToken),
          daemonFingerprint: registration?.fingerprint ?? null,
          daemonVersion: registration?.version ?? null,
          lastHeartbeatAt: nowIso(),
          lastSeenAt: nowIso(),
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    return daemonToken;
  }

  async validateDaemonToken(nodeId: string, daemonToken: string) {
    const node = await this.getNode(nodeId);
    if (!node || node.daemonTokenHash !== hashToken(daemonToken)) {
      return null;
    }
    return node;
  }

  async touchNodeHeartbeat(
    nodeId: string,
    status: NodeRecord["status"],
    extras?: {
      fingerprint?: string;
      version?: string;
      metrics?: NodeMetricRecord;
    },
  ) {
    await firestore
      .collection("nodes")
      .doc(nodeId)
      .set(
        {
          status,
          daemonFingerprint: extras?.fingerprint ?? null,
          daemonVersion: extras?.version ?? null,
          lastHeartbeatAt: nowIso(),
          lastSeenAt: nowIso(),
          lastMetrics: extras?.metrics ?? null,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
  }

  async generateDaemonConfig(nodeId: string) {
    const node = await this.getNode(nodeId);
    if (!node) {
      return null;
    }
    const rotation = await this.rotateDaemonToken(nodeId);
    if (!rotation) {
      return null;
    }
    return {
      env: {
        PANEL_URL: node.baseUrl,
        NODE_ID: node.id,
        DAEMON_TOKEN: rotation.daemonToken,
        DAEMON_BASE_DIR: "/var/lib/leviathan",
        DOCKER_SOCKET_PATH: "/var/run/docker.sock",
      },
      node: {
        id: node.id,
        name: node.name,
        publicAddress: node.publicAddress,
        region: node.region,
      },
    };
  }

  async listTemplates() {
    return this.listCollection("templates", (data, id) =>
      TemplateSchema.parse({ id, ...data }),
    );
  }

  async getTemplate(templateId: string) {
    const snapshot = await firestore
      .collection("templates")
      .doc(templateId)
      .get();
    return snapshot.exists
      ? TemplateSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async createTemplate(input: CreateTemplateInput) {
    const template = TemplateSchema.parse({
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("templates").doc(template.id).set(template);
    return template;
  }

  async listServers(auth: AuthContext) {
    const servers = await this.listCollection("servers", (data, id) =>
      ServerSchema.parse({ id, ...data }),
    );
    if (auth.permissions.includes("*")) {
      return servers;
    }
    return servers.filter(
      (server) =>
        server.ownerId === auth.user.uid ||
        auth.user.serverIds.includes(server.id) ||
        server.members.some((member) => member.userId === auth.user.uid),
    );
  }

  async getServer(serverId: string) {
    const snapshot = await firestore.collection("servers").doc(serverId).get();
    return snapshot.exists
      ? ServerSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async createServer(
    input: CreateServerInput,
    environmentDefinitions: EnvironmentVariableDefinition[],
  ) {
    const server = ServerSchema.parse({
      id: generateId("srv"),
      name: input.name,
      description: input.description,
      ownerId: input.ownerId,
      nodeId: input.nodeId,
      templateId: input.templateId,
      dockerImage: input.dockerImage,
      status: "offline",
      suspended: false,
      allocations: input.allocations,
      limits: input.limits,
      startup: { command: input.startupCommand },
      environment: input.environment,
      environmentDefinitions,
      restartPolicy: input.restartPolicy,
      members: [],
      firewallRules: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastCrashAt: null,
    });
    await firestore.collection("servers").doc(server.id).set(server);
    const ownerRef = firestore.collection("users").doc(server.ownerId);
    const ownerSnapshot = await ownerRef.get();
    if (ownerSnapshot.exists) {
      const owner = UserSchema.parse(ownerSnapshot.data());
      await ownerRef.set(
        {
          serverIds: [...new Set([...owner.serverIds, server.id])],
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    }
    return server;
  }

  async updateServer(serverId: string, update: Partial<ServerRecord>) {
    await firestore
      .collection("servers")
      .doc(serverId)
      .set(
        {
          ...update,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    return this.getServer(serverId);
  }

  async updateServerEnvironment(
    serverId: string,
    values: Record<string, string>,
    _changedBy: string,
  ) {
    void _changedBy;
    return this.updateServer(serverId, { environment: values });
  }

  async addServerMember(serverId: string, input: CreateServerMemberInput) {
    const server = await this.getServer(serverId);
    if (!server) {
      return null;
    }
    return this.updateServer(serverId, {
      members: [
        ...server.members.filter((member) => member.userId !== input.userId),
        {
          userId: input.userId,
          permissions: input.permissions,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    });
  }

  async updateServerMember(
    serverId: string,
    userId: string,
    input: UpdateServerMemberInput,
  ) {
    const server = await this.getServer(serverId);
    if (!server || !server.members.some((member) => member.userId === userId)) {
      return null;
    }
    return this.updateServer(serverId, {
      members: server.members.map((member) =>
        member.userId === userId
          ? { ...member, permissions: input.permissions, updatedAt: nowIso() }
          : member,
      ),
    });
  }

  async removeServerMember(serverId: string, userId: string) {
    const server = await this.getServer(serverId);
    if (!server) {
      return null;
    }
    return this.updateServer(serverId, {
      members: server.members.filter((member) => member.userId !== userId),
    });
  }

  async updateServerStatus(
    serverId: string,
    status: ServerRecord["status"],
    lastCrashAt?: string | null,
  ) {
    const server = await this.getServer(serverId);
    await firestore
      .collection("servers")
      .doc(serverId)
      .set(
        {
          status,
          crashCount:
            status === "errored"
              ? (server?.crashCount ?? 0) + 1
              : (server?.crashCount ?? 0),
          lastCrashAt: lastCrashAt ?? null,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
  }

  async deleteServer(serverId: string) {
    const server = await this.getServer(serverId);
    if (!server) {
      return null;
    }
    await firestore.collection("servers").doc(serverId).delete();
    return server;
  }

  async createAllocation(input: Omit<AllocationRecord, "id" | "createdAt">) {
    const allocation = AllocationSchema.parse({
      id: generateId("alloc"),
      ...input,
      createdAt: nowIso(),
    });
    await firestore
      .collection("allocations")
      .doc(allocation.id!)
      .set(allocation);
    return allocation;
  }

  async listAllocations(nodeId?: string) {
    const allocations = await this.listCollection("allocations", (data, id) =>
      AllocationSchema.parse({ id, ...data }),
    );
    return nodeId
      ? allocations.filter((allocation) => allocation.nodeId === nodeId)
      : allocations;
  }

  async assignAllocation(allocationId: string, serverId: string | null) {
    await firestore.collection("allocations").doc(allocationId).set(
      {
        assignedServerId: serverId,
      },
      { merge: true },
    );
    const snapshot = await firestore
      .collection("allocations")
      .doc(allocationId)
      .get();
    return snapshot.exists
      ? AllocationSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async createBackupRecord(
    input: Omit<BackupRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const backup = BackupSchema.parse({
      id: generateId("bkp"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("backups").doc(backup.id).set(backup);
    return backup;
  }

  async updateBackupRecord(backupId: string, update: Partial<BackupRecord>) {
    await firestore
      .collection("backups")
      .doc(backupId)
      .set(
        {
          ...update,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    return this.getBackup(backupId);
  }

  async getBackup(backupId: string) {
    const snapshot = await firestore.collection("backups").doc(backupId).get();
    return snapshot.exists
      ? BackupSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async listServerBackups(serverId: string) {
    const backups = await this.listCollection("backups", (data, id) =>
      BackupSchema.parse({ id, ...data }),
    );
    return backups.filter((backup) => backup.serverId === serverId);
  }

  async deleteBackupRecord(backupId: string) {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      return null;
    }
    await firestore.collection("backups").doc(backupId).delete();
    return backup;
  }

  async createScheduledTask(
    serverId: string,
    input: CreateScheduledTaskInput,
    createdBy: string,
  ) {
    const task = ScheduledTaskSchema.parse({
      id: generateId("task"),
      serverId,
      ...input,
      createdBy,
      executions: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("scheduledTasks").doc(task.id).set(task);
    return task;
  }

  async getScheduledTask(taskId: string) {
    const snapshot = await firestore
      .collection("scheduledTasks")
      .doc(taskId)
      .get();
    return snapshot.exists
      ? ScheduledTaskSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async listAllScheduledTasks() {
    return this.listCollection("scheduledTasks", (data, id) =>
      ScheduledTaskSchema.parse({ id, ...data }),
    );
  }

  async listScheduledTasks(serverId: string) {
    const tasks = await this.listCollection("scheduledTasks", (data, id) =>
      ScheduledTaskSchema.parse({ id, ...data }),
    );
    return tasks.filter((task) => task.serverId === serverId);
  }

  async updateScheduledTask(
    taskId: string,
    update: Partial<ScheduledTaskRecord>,
  ) {
    await firestore
      .collection("scheduledTasks")
      .doc(taskId)
      .set(
        {
          ...update,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    const snapshot = await firestore
      .collection("scheduledTasks")
      .doc(taskId)
      .get();
    return snapshot.exists
      ? ScheduledTaskSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async deleteScheduledTask(taskId: string) {
    const snapshot = await firestore
      .collection("scheduledTasks")
      .doc(taskId)
      .get();
    if (!snapshot.exists) {
      return null;
    }
    const task = ScheduledTaskSchema.parse({
      id: snapshot.id,
      ...snapshot.data(),
    });
    await firestore.collection("scheduledTasks").doc(taskId).delete();
    return task;
  }

  async appendTaskExecution(
    taskId: string,
    execution: ScheduledTaskRecord["executions"][number],
  ) {
    const task = await this.updateScheduledTask(taskId, {});
    if (!task) {
      return;
    }
    await this.updateScheduledTask(taskId, {
      lastRunAt: execution.startedAt,
      executions: [...task.executions.slice(-24), execution],
    });
  }

  async appendMetricPoints(points: MetricPointRecord[]) {
    await Promise.all(
      points.map((point) =>
        firestore
          .collection("metrics")
          .doc(point.id)
          .set(MetricPointSchema.parse(point)),
      ),
    );
  }

  async listMetrics(
    scopeType: MetricPointRecord["scopeType"],
    scopeId: string,
    limit = 100,
  ) {
    const points = await this.listCollection("metrics", (data, id) =>
      MetricPointSchema.parse({ id, ...data }),
    );
    return points
      .filter(
        (point) => point.scopeType === scopeType && point.scopeId === scopeId,
      )
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
      .slice(0, limit)
      .reverse();
  }

  async getSettings() {
    const snapshot = await firestore.collection("settings").doc("global").get();
    if (!snapshot.exists) {
      await firestore.collection("settings").doc("global").set(defaultSettings);
      return defaultSettings;
    }
    return SettingsSchema.parse(snapshot.data());
  }

  async updateSettings(input: UpdateSettingsInput) {
    const encryptedInput = encryptSettingsSecrets(input);
    const settings = await this.getSettings();
    const next = SettingsSchema.parse({
      ...settings,
      ...encryptedInput,
      backup: { ...settings.backup, ...encryptedInput.backup },
      metrics: { ...settings.metrics, ...encryptedInput.metrics },
      alerts: { ...settings.alerts, ...encryptedInput.alerts },
      cloudflare: { ...settings.cloudflare, ...encryptedInput.cloudflare },
      updatedAt: nowIso(),
    });
    await firestore.collection("settings").doc("global").set(next);
    return next;
  }

  async createBackupTarget(input: CreateBackupTargetInput) {
    const target = BackupTargetSchema.parse({
      id: generateId("bt"),
      ...encryptBackupTargetSecrets(input),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("backupTargets").doc(target.id).set(target);
    return target;
  }

  async listBackupTargets() {
    return this.listCollection("backupTargets", (data, id) =>
      BackupTargetSchema.parse({ id, ...data }),
    );
  }

  async getBackupTarget(targetId: string) {
    const snapshot = await firestore
      .collection("backupTargets")
      .doc(targetId)
      .get();
    return snapshot.exists
      ? BackupTargetSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async createApiKey(input: CreateApiKeyInput, ownerId: string) {
    const plainTextKey = `lvk_${generateToken("api")}`;
    const record = ApiKeySchema.parse({
      id: generateId("key"),
      name: input.name,
      ownerId,
      keyPrefix: plainTextKey.slice(0, 12),
      scopes: input.scopes,
      hashedKey: hashToken(plainTextKey),
      revoked: false,
      expiresAt: input.expiresAt,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("apiKeys").doc(record.id).set(record);
    return { record, plainTextKey };
  }

  async listApiKeys(ownerId?: string) {
    const keys = await this.listCollection("apiKeys", (data, id) =>
      ApiKeySchema.parse({ id, ...data }),
    );
    return ownerId ? keys.filter((key) => key.ownerId === ownerId) : keys;
  }

  async validateApiKey(plainTextKey: string): Promise<AuthContext | null> {
    const hashedKey = hashToken(plainTextKey);
    const keys = await this.listApiKeys();
    const key = keys.find((record) => record.hashedKey === hashedKey);
    if (!key || key.revoked) {
      return null;
    }
    if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
      return null;
    }
    const userSnapshot = await firestore
      .collection("users")
      .doc(key.ownerId)
      .get();
    if (!userSnapshot.exists) {
      return null;
    }
    const user = UserSchema.parse(userSnapshot.data());
    if (user.disabled) {
      return null;
    }
    await firestore.collection("apiKeys").doc(key.id).set(
      {
        lastUsedAt: nowIso(),
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    return {
      user,
      roles: [],
      permissions: key.scopes,
      authType: "apiKey",
      apiKeyId: key.id,
    };
  }

  async revokeApiKey(keyId: string) {
    await firestore.collection("apiKeys").doc(keyId).set(
      {
        revoked: true,
        updatedAt: nowIso(),
      },
      { merge: true },
    );
    const snapshot = await firestore.collection("apiKeys").doc(keyId).get();
    return snapshot.exists
      ? ApiKeySchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async createWebhook(input: CreateWebhookInput) {
    const webhook = WebhookSchema.parse({
      id: generateId("wh"),
      ...encryptWebhookSecrets(input),
      enabled: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("webhooks").doc(webhook.id).set(webhook);
    return webhook;
  }

  async listWebhooks() {
    return this.listCollection("webhooks", (data, id) =>
      WebhookSchema.parse({ id, ...data }),
    );
  }

  async createWebhookDelivery(
    input: Omit<WebhookDeliveryRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const delivery = WebhookDeliverySchema.parse({
      id: generateId("whd"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore
      .collection("webhookDeliveries")
      .doc(delivery.id)
      .set(delivery);
    return delivery;
  }

  async updateWebhookDelivery(
    deliveryId: string,
    update: Partial<WebhookDeliveryRecord>,
  ) {
    await firestore
      .collection("webhookDeliveries")
      .doc(deliveryId)
      .set(
        {
          ...update,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    const snapshot = await firestore
      .collection("webhookDeliveries")
      .doc(deliveryId)
      .get();
    return snapshot.exists
      ? WebhookDeliverySchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async listWebhookDeliveries(limit = 100) {
    const deliveries = await this.listCollection(
      "webhookDeliveries",
      (data, id) => WebhookDeliverySchema.parse({ id, ...data }),
    );
    return deliveries
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async createJob(input: Omit<JobRecord, "id" | "createdAt" | "updatedAt">) {
    if (input.dedupeKey) {
      const existing = (
        await this.listCollection("jobs", (data, id) =>
          JobRecordSchema.parse({ id, ...data }),
        )
      ).find(
        (job) =>
          job.dedupeKey === input.dedupeKey &&
          (job.status === "pending" || job.status === "running"),
      );
      if (existing) {
        return existing;
      }
    }
    const job = JobRecordSchema.parse({
      id: generateId("job"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("jobs").doc(job.id).set(job);
    return job;
  }

  async claimPendingJobs(workerId: string, limit = 10) {
    const now = Date.now();
    const snapshot = await firestore
      .collection("jobs")
      .where("status", "==", "pending")
      .orderBy("runAfter")
      .limit(limit)
      .get();
    const claimed: JobRecord[] = [];
    for (const doc of snapshot.docs) {
      const job = JobRecordSchema.parse({ id: doc.id, ...doc.data() });
      if (new Date(job.runAfter).getTime() > now) {
        continue;
      }
      if (job.lockedUntil && new Date(job.lockedUntil).getTime() > now) {
        continue;
      }
      const locked = JobRecordSchema.parse({
        ...job,
        status: "running",
        attempts: job.attempts + 1,
        lockedBy: workerId,
        lockedUntil: new Date(now + 60_000).toISOString(),
        updatedAt: nowIso(),
      });
      await doc.ref.set(locked);
      claimed.push(locked);
    }
    return claimed;
  }

  async updateJob(jobId: string, update: Partial<JobRecord>) {
    await firestore
      .collection("jobs")
      .doc(jobId)
      .set(
        {
          ...update,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    const snapshot = await firestore.collection("jobs").doc(jobId).get();
    return snapshot.exists
      ? JobRecordSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async listJobs(limit = 100) {
    const jobs = await this.listCollection("jobs", (data, id) =>
      JobRecordSchema.parse({ id, ...data }),
    );
    return jobs
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async createAlertRule(input: CreateAlertRuleInput) {
    const rule = AlertRuleSchema.parse({
      id: generateId("alr"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("alertRules").doc(rule.id).set(rule);
    return rule;
  }

  async listAlertRules() {
    return this.listCollection("alertRules", (data, id) =>
      AlertRuleSchema.parse({ id, ...data }),
    );
  }

  async createAlertEvent(
    input: Omit<AlertEventRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const event = AlertEventSchema.parse({
      id: generateId("ale"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("alertEvents").doc(event.id).set(event);
    return event;
  }

  async listAlertEvents(limit = 100) {
    const events = await this.listCollection("alertEvents", (data, id) =>
      AlertEventSchema.parse({ id, ...data }),
    );
    return events
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }

  async updateAlertEvent(alertId: string, update: Partial<AlertEventRecord>) {
    await firestore
      .collection("alertEvents")
      .doc(alertId)
      .set(
        {
          ...update,
          updatedAt: nowIso(),
        },
        { merge: true },
      );
    const snapshot = await firestore
      .collection("alertEvents")
      .doc(alertId)
      .get();
    return snapshot.exists
      ? AlertEventSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async createDomainMapping(input: CreateDomainMappingInput) {
    const mapping = DomainMappingSchema.parse({
      id: generateId("dom"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("domainMappings").doc(mapping.id).set(mapping);
    return mapping;
  }

  async listDomainMappings(serverId?: string) {
    const mappings = await this.listCollection("domainMappings", (data, id) =>
      DomainMappingSchema.parse({ id, ...data }),
    );
    return serverId
      ? mappings.filter((mapping) => mapping.serverId === serverId)
      : mappings;
  }

  async createFirewallRule(input: CreateFirewallRuleInput) {
    const rule = FirewallRuleSchema.parse({
      id: generateId("fw"),
      ...input,
      createdAt: nowIso(),
    });
    await firestore.collection("firewallRules").doc(rule.id).set(rule);
    return rule;
  }

  async listFirewallRules(scopeId?: string) {
    const rules = await this.listCollection("firewallRules", (data, id) =>
      FirewallRuleSchema.parse({ id, ...data }),
    );
    return scopeId ? rules.filter((rule) => rule.scopeId === scopeId) : rules;
  }

  async createCloudflareRoute(input: CreateCloudflareRouteInput) {
    const route = CloudflareRouteSchema.parse({
      id: generateId("cfr"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore.collection("cloudflareRoutes").doc(route.id).set(route);
    return route;
  }

  async listCloudflareRoutes() {
    return this.listCollection("cloudflareRoutes", (data, id) =>
      CloudflareRouteSchema.parse({ id, ...data }),
    );
  }

  async deleteCloudflareRoute(routeId: string) {
    const ref = firestore.collection("cloudflareRoutes").doc(routeId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    const route = CloudflareRouteSchema.parse({
      id: snapshot.id,
      ...snapshot.data(),
    });
    await ref.delete();
    return route;
  }

  async createDaemonUpdateHistory(
    input: Omit<DaemonUpdateHistoryRecord, "id" | "createdAt" | "updatedAt">,
  ) {
    const record = DaemonUpdateHistorySchema.parse({
      id: generateId("upd"),
      ...input,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    await firestore
      .collection("daemonUpdateHistory")
      .doc(record.id)
      .set(record);
    return record;
  }

  async listDaemonUpdateHistory(nodeId?: string) {
    const history = await this.listCollection(
      "daemonUpdateHistory",
      (data, id) => DaemonUpdateHistorySchema.parse({ id, ...data }),
    );
    return (
      nodeId ? history.filter((record) => record.nodeId === nodeId) : history
    ).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async upsertPluginManifest(manifest: PluginManifest) {
    const parsed = PluginManifestSchema.parse(manifest);
    await firestore.collection("pluginManifests").doc(parsed.id).set(parsed);
    return parsed;
  }

  async listPluginManifests() {
    return this.listCollection("pluginManifests", (data, id) =>
      PluginManifestSchema.parse({ id, ...data }),
    );
  }

  async setPluginEnabled(pluginId: string, enabled: boolean) {
    await firestore.collection("pluginManifests").doc(pluginId).set(
      {
        enabled,
      },
      { merge: true },
    );
    const snapshot = await firestore
      .collection("pluginManifests")
      .doc(pluginId)
      .get();
    return snapshot.exists
      ? PluginManifestSchema.parse({ id: snapshot.id, ...snapshot.data() })
      : null;
  }

  async generateSftpCredential(serverId: string) {
    const server = await this.getServer(serverId);
    if (!server) {
      throw new Error("Server not found");
    }
    const credential = SftpCredentialSchema.parse({
      id: generateId("sftp"),
      serverId,
      username: `srv_${serverId.slice(-8)}`,
      password: generateToken("sftp"),
      host: server.allocations[0]?.ip ?? "127.0.0.1",
      port: 2022,
      rootPath: `/var/lib/leviathan/servers/${serverId}`,
      revoked: false,
      generatedAt: nowIso(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      rotatedAt: nowIso(),
    });
    await firestore.collection("sftpCredentials").doc(serverId).set(credential);
    return credential;
  }

  async getSftpCredential(serverId: string) {
    const snapshot = await firestore
      .collection("sftpCredentials")
      .doc(serverId)
      .get();
    return snapshot.exists ? SftpCredentialSchema.parse(snapshot.data()) : null;
  }

  async revokeSftpCredential(serverId: string) {
    const ref = firestore.collection("sftpCredentials").doc(serverId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return null;
    }
    await ref.set(
      {
        revoked: true,
        revokedAt: nowIso(),
      },
      { merge: true },
    );
    const updated = await ref.get();
    return SftpCredentialSchema.parse(updated.data());
  }

  async appendAuditLog(record: Omit<AuditLogRecord, "id" | "createdAt">) {
    const audit = AuditLogSchema.parse({
      id: generateId("audit"),
      ...record,
      metadata: redactAuditMetadata(record.metadata),
      createdAt: nowIso(),
    });
    await firestore.collection("auditLogs").doc(audit.id).set(audit);
  }

  async listAuditLogs(limit = 100) {
    const logs = await this.listCollection("auditLogs", (data, id) =>
      AuditLogSchema.parse({ id, ...data }),
    );
    return logs
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, limit);
  }
}

const createStore = async (): Promise<Store> => {
  if (config.MOCK_DATA || !databaseEnabled) {
    const memory = new MemoryStore();
    return memory;
  }

  const sql = new SqlStore();
  const [roles, templates] = await Promise.all([
    sql.listRoles(),
    sql.listTemplates(),
  ]);
  if (roles.length === 0) {
    await firestore!.collection("roles").doc(adminRole.id).set(adminRole);
    await firestore!.collection("roles").doc(staffRole.id).set(staffRole);
    await firestore!.collection("roles").doc(userRole.id).set(userRole);
  }
  if (templates.length === 0) {
    await firestore!
      .collection("templates")
      .doc(starterTemplate.id)
      .set(starterTemplate);
  }
  await sql.getSettings();
  return sql;
};

export const store: Store = await createStore();
