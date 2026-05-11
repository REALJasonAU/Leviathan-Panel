import { z } from "zod";

export const TimestampSchema = z.string().datetime().or(z.string().min(1));
export const IdSchema = z.string().min(1).max(120);
export const NullableStringSchema = z.string().min(1).nullable().optional();

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export const ResourceLimitsSchema = z.object({
  cpuPercent: z.number().int().positive(),
  memoryMb: z.number().int().positive(),
  diskMb: z.number().int().positive(),
  networkMbps: z.number().int().positive().optional(),
});

export const AllocationSchema = z.object({
  id: IdSchema.optional(),
  nodeId: IdSchema.optional(),
  ip: z.string().min(1),
  ipv6: z.string().optional(),
  port: z.number().int().min(1).max(65535),
  notes: z.string().optional(),
  primary: z.boolean().default(false),
  assignedServerId: IdSchema.nullish(),
  createdAt: TimestampSchema.optional(),
});

export const FirewallRuleSchema = z.object({
  id: IdSchema,
  scope: z.enum(["node", "server"]).default("server"),
  scopeId: IdSchema.optional(),
  protocol: z.enum(["tcp", "udp"]),
  port: z.number().int().min(1).max(65535),
  source: z.string().default("0.0.0.0/0"),
  action: z.enum(["allow", "deny"]).default("allow"),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  createdAt: TimestampSchema,
});

export const ServerScopedPermissionSchema = z.enum([
  "console.view",
  "console.send",
  "files.read",
  "files.write",
  "files.delete",
  "backups.create",
  "backups.restore",
  "backups.delete",
  "schedules.manage",
  "network.manage",
  "env.manage",
  "settings.manage",
]);

export const ServerMemberSchema = z.object({
  userId: IdSchema,
  permissions: z.array(ServerScopedPermissionSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.optional(),
});

export const EnvironmentVariableDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9_]+$/),
  displayName: z.string().min(1),
  description: z.string().optional(),
  defaultValue: z.string().optional(),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  readonly: z.boolean().default(false),
  validationRule: z.string().optional(),
  allowedValues: z.array(z.string()).default([]),
});

export const TemplateSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  dockerImages: z.array(z.string().min(1)).min(1),
  startupCommand: z.string().min(1),
  environmentDefinitions: z.array(EnvironmentVariableDefinitionSchema),
  importedEnvExample: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const NodeMetricSchema = z.object({
  cpuPercent: z.number().nonnegative(),
  memoryUsedMb: z.number().nonnegative(),
  memoryTotalMb: z.number().nonnegative(),
  diskUsedMb: z.number().nonnegative(),
  diskTotalMb: z.number().nonnegative(),
  networkRxBytes: z.number().nonnegative(),
  networkTxBytes: z.number().nonnegative(),
});

export const ServerMetricSchema = z.object({
  serverId: IdSchema,
  cpuPercent: z.number().nonnegative(),
  memoryUsedMb: z.number().nonnegative(),
  memoryLimitMb: z.number().nonnegative(),
  networkRxBytes: z.number().nonnegative(),
  networkTxBytes: z.number().nonnegative(),
  timestamp: TimestampSchema,
});

export const NodeSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  region: z.string().min(1),
  publicAddress: z.string().min(1),
  baseUrl: z.string().url(),
  status: z.enum(["online", "offline", "maintenance"]).default("offline"),
  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().optional(),
  platform: z.string().default("linux"),
  capabilities: z.array(z.string()).default([]),
  bootstrapTokenHash: z.string().optional(),
  daemonTokenHash: z.string().optional(),
  daemonVersion: z.string().optional(),
  daemonFingerprint: z.string().optional(),
  heartbeatIntervalSec: z.number().int().positive().default(15),
  lastSeenAt: TimestampSchema.optional(),
  lastHeartbeatAt: TimestampSchema.optional(),
  lastMetrics: NodeMetricSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const ServerStatusSchema = z.enum([
  "offline",
  "starting",
  "running",
  "stopping",
  "stopped",
  "errored",
  "suspended",
]);

export const ServerSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  ownerId: IdSchema,
  nodeId: IdSchema,
  templateId: IdSchema,
  dockerImage: z.string().min(1),
  status: ServerStatusSchema,
  suspended: z.boolean().default(false),
  allocations: z.array(AllocationSchema),
  limits: ResourceLimitsSchema,
  startup: z.object({
    command: z.string().min(1),
  }),
  environment: z.record(z.string(), z.string()),
  environmentDefinitions: z
    .array(EnvironmentVariableDefinitionSchema)
    .default([]),
  workingDirectory: z.string().default("/srv/app"),
  restartPolicy: z
    .enum(["no", "always", "unless-stopped", "on-failure"])
    .default("unless-stopped"),
  members: z.array(ServerMemberSchema).default([]),
  firewallRules: z.array(FirewallRuleSchema).default([]),
  backupLimit: z.number().int().positive().default(3),
  uptimeSeconds: z.number().int().nonnegative().default(0),
  crashCount: z.number().int().nonnegative().default(0),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastCrashAt: TimestampSchema.nullish(),
});

export const RoleSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  permissions: z.array(z.string()),
  builtin: z.boolean().default(false),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const UserSchema = z.object({
  uid: IdSchema,
  email: z.string().email().optional(),
  displayName: z.string().min(1),
  photoUrl: z.string().url().optional(),
  roleIds: z.array(z.string()).default([]),
  serverIds: z.array(z.string()).default([]),
  twoFactorRequired: z.boolean().default(false),
  disabled: z.boolean().default(false),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastLoginAt: TimestampSchema.optional(),
});

export const AuditLogSchema = z.object({
  id: IdSchema,
  actorId: IdSchema,
  actorType: z.enum(["user", "daemon", "system"]),
  action: z.string().min(1),
  targetType: z.string().min(1),
  targetId: IdSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: TimestampSchema,
});

export const BackupSchema = z.object({
  id: IdSchema,
  serverId: IdSchema,
  nodeId: IdSchema,
  name: z.string().min(1),
  status: z.enum([
    "queued",
    "running",
    "completed",
    "failed",
    "restoring",
    "deleted",
  ]),
  provider: z.enum(["local", "s3"]).default("local"),
  targetId: IdSchema.optional(),
  fileName: z.string().optional(),
  filePath: z.string().optional(),
  objectKey: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().default(0),
  progressPercent: z.number().int().min(0).max(100).default(0),
  errorMessage: z.string().optional(),
  createdBy: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
});

export const BackupTargetSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  provider: z.enum(["local", "s3"]),
  serverIds: z.array(IdSchema).default([]),
  local: z
    .object({
      basePath: z.string().min(1),
    })
    .optional(),
  s3: z
    .object({
      endpoint: z.string().url().optional(),
      region: z.string().min(1),
      bucket: z.string().min(1),
      accessKeyId: z.string().min(1),
      secretAccessKey: z.string().min(1),
      pathPrefix: z.string().default("leviathan/backups"),
      forcePathStyle: z.boolean().default(false),
    })
    .optional(),
  enabled: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const TaskActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("power"),
    powerAction: z.enum(["start", "stop", "restart", "kill"]),
  }),
  z.object({
    type: z.literal("command"),
    command: z.string().min(1),
  }),
  z.object({
    type: z.literal("backup"),
  }),
  z.object({
    type: z.literal("file_cleanup"),
    path: z.string().min(1),
    olderThanDays: z.number().int().positive(),
  }),
]);

export const ScheduledTaskExecutionSchema = z.object({
  id: IdSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
  status: z.enum(["running", "completed", "failed"]),
  message: z.string().optional(),
});

export const ScheduledTaskSchema = z.object({
  id: IdSchema,
  serverId: IdSchema,
  enabled: z.boolean().default(true),
  name: z.string().min(1),
  cron: z.string().min(1),
  action: TaskActionSchema,
  createdBy: IdSchema,
  lastRunAt: TimestampSchema.optional(),
  executions: z.array(ScheduledTaskExecutionSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const MetricPointSchema = z.object({
  id: IdSchema,
  scopeType: z.enum(["node", "server"]),
  scopeId: IdSchema,
  timestamp: TimestampSchema,
  values: z.record(z.string(), z.number()),
});

export const JobStatusSchema = z.enum([
  "pending",
  "running",
  "success",
  "failed",
  "cancelled",
]);

export const JobRecordSchema = z.object({
  id: IdSchema,
  type: z.string().min(1),
  dedupeKey: z.string().optional(),
  status: JobStatusSchema.default("pending"),
  payload: z.record(z.string(), z.unknown()).default({}),
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(1),
  runAfter: TimestampSchema,
  lockedBy: z.string().optional(),
  lockedUntil: TimestampSchema.optional(),
  errorMessage: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  completedAt: TimestampSchema.optional(),
});

export const QueueDriverSchema = z.enum(["local", "bullmq"]);

export const ApiKeySchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  ownerId: IdSchema,
  keyPrefix: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  hashedKey: z.string().min(1),
  revoked: z.boolean().default(false),
  expiresAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastUsedAt: TimestampSchema.optional(),
});

export const WebhookSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).default([]),
  type: z.enum(["generic", "discord"]).default("generic"),
  enabled: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const WebhookDeliverySchema = z.object({
  id: IdSchema,
  webhookId: IdSchema,
  event: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["pending", "delivered", "failed"]).default("pending"),
  attempts: z.number().int().nonnegative().default(0),
  nextAttemptAt: TimestampSchema.optional(),
  responseStatus: z.number().int().optional(),
  errorMessage: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const AlertSeveritySchema = z.enum(["info", "warning", "critical"]);

export const AlertRuleSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  type: z.enum([
    "node.offline",
    "server.crashed",
    "cpu.high",
    "ram.high",
    "disk.high",
    "backup.failed",
    "daemon.reconnect_loop",
  ]),
  scopeType: z.enum(["global", "node", "server"]).default("global"),
  scopeId: IdSchema.optional(),
  threshold: z.number().optional(),
  severity: AlertSeveritySchema.default("warning"),
  enabled: z.boolean().default(true),
  channels: z.array(z.enum(["discord", "webhook", "email"])).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const AlertEventSchema = z.object({
  id: IdSchema,
  ruleId: IdSchema.optional(),
  type: AlertRuleSchema.shape.type,
  severity: AlertSeveritySchema,
  scopeType: z.enum(["node", "server", "global"]),
  scopeId: IdSchema.optional(),
  title: z.string().min(1),
  message: z.string().min(1),
  status: z.enum(["open", "acknowledged", "resolved"]).default("open"),
  acknowledgedBy: IdSchema.optional(),
  acknowledgedAt: TimestampSchema.optional(),
  resolvedAt: TimestampSchema.optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const DomainMappingSchema = z.object({
  id: IdSchema,
  serverId: IdSchema,
  domain: z.string().min(1),
  targetPort: z.number().int().min(1).max(65535),
  provider: z.enum(["caddy", "traefik"]).default("caddy"),
  tls: z.boolean().default(true),
  enabled: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const CloudflareSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  accountId: z.string().optional(),
  zoneId: z.string().optional(),
  tunnelId: z.string().optional(),
  apiToken: z.string().optional(),
  tunnelName: z.string().optional(),
});

export const CloudflareRouteSchema = z.object({
  id: IdSchema,
  hostname: z.string().min(1),
  service: z.string().min(1),
  tunnelId: z.string().min(1),
  zoneId: z.string().min(1),
  dnsRecordId: z.string().optional(),
  enabled: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const DaemonUpdateManifestSchema = z.object({
  version: z.string().min(1),
  url: z.string().url(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  signature: z.string().min(1),
  publishedAt: TimestampSchema,
});

export const DaemonUpdateHistorySchema = z.object({
  id: IdSchema,
  nodeId: IdSchema,
  fromVersion: z.string().optional(),
  toVersion: z.string().min(1),
  status: z.enum(["planned", "running", "success", "failed", "rolled_back"]),
  message: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

export const PluginManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  entry: z.string().min(1),
  enabled: z.boolean().default(true),
  trusted: z.boolean().default(false),
  permissions: z.array(z.string()).default([]),
  contributes: z
    .object({
      apiRoutes: z.array(z.string()).default([]),
      webhookHandlers: z.array(z.string()).default([]),
      notificationProviders: z.array(z.string()).default([]),
      serverTemplateProviders: z.array(z.string()).default([]),
      adminNavigation: z.array(z.string()).default([]),
      userNavigation: z.array(z.string()).default([]),
    })
    .default({}),
});

export const SettingsSchema = z.object({
  id: z.literal("global"),
  appName: z.string().default("Leviathan"),
  backup: z.object({
    retentionCount: z.number().int().positive().default(3),
    defaultProvider: z.enum(["local", "s3"]).default("local"),
    s3Bucket: z.string().optional(),
    s3Region: z.string().optional(),
    defaultTargetId: IdSchema.optional(),
  }),
  metrics: z.object({
    retentionHours: z.number().int().positive().default(72),
  }),
  alerts: z.object({
    nodeOfflineMinutes: z.number().int().positive().default(2),
  }),
  cloudflare: CloudflareSettingsSchema.default({}),
  updatedAt: TimestampSchema,
});

export const SftpCredentialSchema = z.object({
  id: IdSchema.optional(),
  serverId: IdSchema,
  username: z.string().min(1),
  password: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().positive().default(2022),
  rootPath: z.string().min(1),
  revoked: z.boolean().default(false),
  generatedAt: TimestampSchema,
  expiresAt: TimestampSchema.optional(),
  rotatedAt: TimestampSchema.optional(),
  revokedAt: TimestampSchema.optional(),
});

export const FileEntrySchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  isDirectory: z.boolean(),
  size: z.number().int().nonnegative(),
  modifiedAt: TimestampSchema,
});

export const FileReadResponseSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
});

export const DashboardSummarySchema = z.object({
  totals: z.object({
    nodes: z.number().int().nonnegative(),
    servers: z.number().int().nonnegative(),
    templates: z.number().int().nonnegative(),
    onlineServers: z.number().int().nonnegative(),
    backups: z.number().int().nonnegative().default(0),
    scheduledTasks: z.number().int().nonnegative().default(0),
  }),
  nodes: z.array(NodeSchema),
  servers: z.array(ServerSchema),
  templates: z.array(TemplateSchema),
});

export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const IdParamSchema = z.object({
  id: IdSchema,
});

export const CreateNodeInputSchema = z.object({
  name: z.string().min(1),
  region: z.string().min(1),
  publicAddress: z.string().min(1),
  baseUrl: z.string().url(),
  capabilities: z.array(z.string()).default(["docker"]),
});

export const UpdateNodeMaintenanceInputSchema = z.object({
  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().optional(),
});

export const RotateNodeDaemonTokenInputSchema = z.object({
  revokeCurrent: z.boolean().default(true),
});

export const CreateTemplateInputSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  dockerImages: z.array(z.string()).min(1),
  startupCommand: z.string().min(1),
  environmentDefinitions: z
    .array(EnvironmentVariableDefinitionSchema)
    .default([]),
  importedEnvExample: z.string().optional(),
});

export const ImportEnvExampleInputSchema = z.object({
  content: z.string().min(1),
});

export const CreateServerInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerId: IdSchema,
  nodeId: IdSchema,
  templateId: IdSchema,
  dockerImage: z.string().min(1),
  allocations: z.array(AllocationSchema).min(1),
  limits: ResourceLimitsSchema,
  startupCommand: z.string().min(1),
  environment: z.record(z.string(), z.string()),
  restartPolicy: ServerSchema.shape.restartPolicy.default("unless-stopped"),
});

export const UpdateServerEnvironmentInputSchema = z.object({
  values: z.record(z.string(), z.string()),
});

export const ServerPowerActionInputSchema = z.object({
  action: z.enum(["start", "stop", "restart", "kill"]),
});

export const ConsoleCommandInputSchema = z.object({
  command: z.string().min(1).max(4000),
});

export const FileListQuerySchema = z.object({
  path: z.string().default("."),
});

export const FileReadQuerySchema = z.object({
  path: z.string().min(1),
});

export const FileWriteInputSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
});

export const FileDeleteInputSchema = z.object({
  path: z.string().min(1),
});

export const FileMoveInputSchema = z.object({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1),
});

export const FileCopyInputSchema = z.object({
  sourcePath: z.string().min(1),
  destinationPath: z.string().min(1),
});

export const FileRenameInputSchema = z.object({
  sourcePath: z.string().min(1),
  newName: z.string().min(1),
});

export const FileCreateFolderInputSchema = z.object({
  path: z.string().min(1),
});

export const FileArchiveInputSchema = z.object({
  sourcePath: z.string().min(1),
  archivePath: z.string().min(1),
});

export const FileExtractInputSchema = z.object({
  archivePath: z.string().min(1),
  destinationPath: z.string().min(1),
});

export const CreateBackupInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  provider: z.enum(["local", "s3"]).default("local"),
  targetId: IdSchema.optional(),
});

export const RestoreBackupInputSchema = z.object({
  overwrite: z.boolean().default(true),
});

export const CreateScheduledTaskInputSchema = z.object({
  name: z.string().min(1),
  cron: z.string().min(1),
  enabled: z.boolean().default(true),
  action: TaskActionSchema,
});

export const UpdateScheduledTaskInputSchema =
  CreateScheduledTaskInputSchema.partial();

export const UpdateUserRolesInputSchema = z.object({
  roleIds: z.array(z.string()).default([]),
  disabled: z.boolean().optional(),
});

export const CreateRoleInputSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  permissions: z.array(z.string()).default([]),
});

export const CreateApiKeyInputSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expiresAt: TimestampSchema.optional(),
});

export const CreateServerMemberInputSchema = z.object({
  userId: IdSchema,
  permissions: z.array(ServerScopedPermissionSchema).default([]),
});

export const UpdateServerMemberInputSchema = z.object({
  permissions: z.array(ServerScopedPermissionSchema).default([]),
});

export const CreateBackupTargetInputSchema = BackupTargetSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).refine(
  (value) =>
    (value.provider === "local" && Boolean(value.local)) ||
    (value.provider === "s3" && Boolean(value.s3)),
  "Backup target configuration must match the selected provider.",
);

export const CreateAlertRuleInputSchema = AlertRuleSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const AcknowledgeAlertInputSchema = z.object({
  status: z.enum(["acknowledged", "resolved"]).default("acknowledged"),
});

export const CreateDomainMappingInputSchema = DomainMappingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const UpdateCloudflareSettingsInputSchema =
  CloudflareSettingsSchema.partial();

export const CreateCloudflareRouteInputSchema = CloudflareRouteSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const CloudflareSyncInputSchema = z.object({
  dryRun: z.boolean().default(true),
});

export const CreateFirewallRuleInputSchema = FirewallRuleSchema.omit({
  id: true,
  createdAt: true,
});

export const FirewallApplyInputSchema = z.object({
  nodeId: IdSchema.optional(),
  serverId: IdSchema.optional(),
  dryRun: z.boolean().default(true),
});

export const DaemonUpdateInputSchema = z.object({
  manifest: DaemonUpdateManifestSchema,
  publicKeyPem: z.string().min(1),
  apply: z.boolean().default(false),
});

export const PluginInstallInputSchema = z.object({
  manifest: PluginManifestSchema,
});

export const BillingWebhookEnvelopeSchema = z.object({
  provider: z.enum(["stripe", "whmcs"]),
  event: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const CreateWebhookInputSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).default([]),
  type: z.enum(["generic", "discord"]).default("generic"),
});

export const UpdateSettingsInputSchema = SettingsSchema.omit({
  id: true,
  updatedAt: true,
}).partial();

export const MeResponseSchema = z.object({
  user: UserSchema,
  roles: z.array(RoleSchema),
  permissions: z.array(z.string()),
});

export const DaemonRegisterInputSchema = z.object({
  nodeId: IdSchema,
  bootstrapToken: z.string().min(1),
  fingerprint: z.string().min(1),
  version: z.string().optional(),
});

export const DaemonRegisterResponseSchema = z.object({
  daemonToken: z.string().min(1),
  node: NodeSchema.pick({
    id: true,
    name: true,
    region: true,
    publicAddress: true,
  }),
});

export const DaemonRotateTokenInputSchema = z.object({
  nodeId: IdSchema,
});

export const DaemonConfigResponseSchema = z.object({
  env: z.record(z.string(), z.string()),
  node: NodeSchema.pick({
    id: true,
    name: true,
    publicAddress: true,
    region: true,
  }),
});

export const DaemonEnvelopeSchema = z.object({
  type: z.string().min(1),
  requestId: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const ConsoleEventSchema = z.object({
  serverId: IdSchema,
  chunk: z.string(),
  timestamp: TimestampSchema,
});

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
export type NodeRecord = z.infer<typeof NodeSchema>;
export type NodeMetricRecord = z.infer<typeof NodeMetricSchema>;
export type ServerMetricRecord = z.infer<typeof ServerMetricSchema>;
export type ServerRecord = z.infer<typeof ServerSchema>;
export type TemplateRecord = z.infer<typeof TemplateSchema>;
export type UserRecord = z.infer<typeof UserSchema>;
export type RoleRecord = z.infer<typeof RoleSchema>;
export type AuditLogRecord = z.infer<typeof AuditLogSchema>;
export type BackupRecord = z.infer<typeof BackupSchema>;
export type ScheduledTaskRecord = z.infer<typeof ScheduledTaskSchema>;
export type MetricPointRecord = z.infer<typeof MetricPointSchema>;
export type JobRecord = z.infer<typeof JobRecordSchema>;
export type QueueDriver = z.infer<typeof QueueDriverSchema>;
export type ApiKeyRecord = z.infer<typeof ApiKeySchema>;
export type WebhookRecord = z.infer<typeof WebhookSchema>;
export type WebhookDeliveryRecord = z.infer<typeof WebhookDeliverySchema>;
export type SettingsRecord = z.infer<typeof SettingsSchema>;
export type AllocationRecord = z.infer<typeof AllocationSchema>;
export type SftpCredentialRecord = z.infer<typeof SftpCredentialSchema>;
export type FileEntryRecord = z.infer<typeof FileEntrySchema>;
export type BackupTargetRecord = z.infer<typeof BackupTargetSchema>;
export type AlertRuleRecord = z.infer<typeof AlertRuleSchema>;
export type AlertEventRecord = z.infer<typeof AlertEventSchema>;
export type DomainMappingRecord = z.infer<typeof DomainMappingSchema>;
export type FirewallRuleRecord = z.infer<typeof FirewallRuleSchema>;
export type CloudflareRouteRecord = z.infer<typeof CloudflareRouteSchema>;
export type DaemonUpdateManifest = z.infer<typeof DaemonUpdateManifestSchema>;
export type DaemonUpdateHistoryRecord = z.infer<
  typeof DaemonUpdateHistorySchema
>;
export type PluginManifest = z.infer<typeof PluginManifestSchema>;
export type EnvironmentVariableDefinition = z.infer<
  typeof EnvironmentVariableDefinitionSchema
>;
