<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import type {
    ApiKeyRecord,
    AlertEventRecord,
    BackupTargetRecord,
    AuditLogRecord,
    BackupRecord,
    DashboardSummary,
    DomainMappingRecord,
    EnvironmentVariableDefinition,
    FileEntryRecord,
    FirewallRuleRecord,
    JobRecord,
    MetricPointRecord,
    NodeRecord,
    RoleRecord,
    ScheduledTaskRecord,
    ServerRecord,
    SettingsRecord,
    SftpCredentialRecord,
    TemplateRecord,
    UserRecord,
    WebhookDeliveryRecord,
    WebhookRecord,
    PluginManifest,
    CloudflareRouteRecord,
  } from "@voltan/shared";

  import Card from "./lib/components/Card.svelte";
  import EmptyState from "./lib/components/EmptyState.svelte";
  import ActionButton from "./lib/components/ActionButton.svelte";
  import AppShell from "./lib/components/AppShell.svelte";
  import PageHeader from "./lib/components/PageHeader.svelte";
  import ConfirmDialog from "./lib/components/ConfirmDialog.svelte";
  import LoadingState from "./lib/components/LoadingState.svelte";
  import ProgressBar from "./lib/components/ProgressBar.svelte";
  import SecretRevealModal from "./lib/components/SecretRevealModal.svelte";
  import SidebarNav from "./lib/components/SidebarNav.svelte";
  import StatCard from "./lib/components/StatCard.svelte";
  import StatusBadge from "./lib/components/StatusBadge.svelte";
  import TabNav from "./lib/components/TabNav.svelte";
  import TopHeader from "./lib/components/TopHeader.svelte";
  import { isAdminSession as hasAdminAccess } from "./lib/admin-session";
  import AdminDashboard from "./lib/views/AdminDashboard.svelte";
  import UserWorkspace from "./lib/views/UserWorkspace.svelte";
  import { api, consoleSocketUrl, type SessionResponse } from "./lib/api";
  import { session } from "./lib/stores/auth";

  type View =
    | "overview"
    | "servers"
    | "nodes"
    | "daemon-updates"
    | "templates"
    | "users"
    | "roles"
    | "backups"
    | "scheduled-tasks"
    | "audit-logs"
    | "alerts"
    | "api-keys"
    | "webhooks"
    | "backup-targets"
    | "cloudflare"
    | "firewall"
    | "jobs"
    | "plugins"
    | "billing"
    | "settings";
  type ServerSection =
    | "console"
    | "files"
    | "backups"
    | "schedules"
    | "network"
    | "environment"
    | "sub-users"
    | "settings";
  type WorkspaceSection =
    | "console"
    | "files"
    | "databases"
    | "schedules"
    | "users"
    | "backups"
    | "network"
    | "startup"
    | "settings"
    | "activity";

  const views: Array<{ id: View; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "servers", label: "Servers" },
    { id: "nodes", label: "Nodes" },
    { id: "daemon-updates", label: "Daemon Updates" },
    { id: "templates", label: "Templates" },
    { id: "users", label: "Users" },
    { id: "roles", label: "Roles" },
    { id: "backups", label: "Backups" },
    { id: "scheduled-tasks", label: "Scheduled Tasks" },
    { id: "audit-logs", label: "Audit Logs" },
    { id: "alerts", label: "Alerts" },
    { id: "api-keys", label: "API Keys" },
    { id: "webhooks", label: "Webhooks" },
    { id: "backup-targets", label: "Backup Targets" },
    { id: "cloudflare", label: "Cloudflare" },
    { id: "firewall", label: "Firewall" },
    { id: "jobs", label: "Jobs" },
    { id: "plugins", label: "Plugins" },
    { id: "billing", label: "Billing" },
    { id: "settings", label: "Settings" },
  ];

  const serverSections: Array<{ id: ServerSection; label: string }> = [
    { id: "console", label: "Console" },
    { id: "files", label: "Files" },
    { id: "backups", label: "Backups" },
    { id: "schedules", label: "Schedules" },
    { id: "network", label: "Network" },
    { id: "environment", label: "Environment" },
    { id: "sub-users", label: "Sub-users" },
    { id: "settings", label: "Settings" },
  ];

  const workspaceSections: Array<{ id: WorkspaceSection; label: string }> = [
    { id: "console", label: "Console" },
    { id: "files", label: "Files" },
    { id: "databases", label: "Databases" },
    { id: "schedules", label: "Schedules" },
    { id: "users", label: "Users" },
    { id: "backups", label: "Backups" },
    { id: "network", label: "Network" },
    { id: "startup", label: "Startup" },
    { id: "settings", label: "Settings" },
    { id: "activity", label: "Activity" },
  ];

  let currentView: View = "overview";
  let serverSection: ServerSection = "console";
  let workspaceSection: WorkspaceSection = "console";
  let workspaceListMode: "cards" | "table" = "cards";
  let currentToken: string | null = null;
  let sessionHydrating = false;
  let authIdentifier = "";
  let authPassword = "";
  let authError = "";
  let me: SessionResponse | null = null;
  let dashboard: DashboardSummary | null = null;
  let nodes: NodeRecord[] = [];
  let templates: TemplateRecord[] = [];
  let servers: ServerRecord[] = [];
  let users: UserRecord[] = [];
  let roles: RoleRecord[] = [];
  let auditLogs: AuditLogRecord[] = [];
  let settings: SettingsRecord | null = null;
  let apiKeys: ApiKeyRecord[] = [];
  let webhooks: WebhookRecord[] = [];
  let webhookDeliveries: WebhookDeliveryRecord[] = [];
  let backupTargets: BackupTargetRecord[] = [];
  let alertEvents: AlertEventRecord[] = [];
  let jobs: JobRecord[] = [];
  let plugins: PluginManifest[] = [];
  let cloudflareRoutes: CloudflareRouteRecord[] = [];
  let selectedServerId = "";
  let loading = false;
  let error = "";
  let previewDefinitions: EnvironmentVariableDefinition[] = [];
  let envImportText = "";
  let validationErrors: Array<{ key: string; message: string }> = [];
  let nodeBootstrapToken = "";
  let selectedNodeConfig: { env: Record<string, string>; node: Pick<NodeRecord, "id" | "name" | "publicAddress" | "region"> } | null = null;
  let nodeMetrics: MetricPointRecord[] = [];
  let serverMetrics: MetricPointRecord[] = [];
  let serverBackups: BackupRecord[] = [];
  let serverTasks: ScheduledTaskRecord[] = [];
  let serverFiles: FileEntryRecord[] = [];
  let serverMembers: ServerRecord["members"] = [];
  let serverDomains: DomainMappingRecord[] = [];
  let serverFirewallRules: FirewallRuleRecord[] = [];
  let currentPath = ".";
  let currentFilePath = "";
  let fileEditorContent = "";
  let consoleLines: string[] = [];
  let consoleSearch = "";
  let consoleCommand = "";
  let commandHistory: string[] = [];
  let autoScroll = true;
  let sftpCredential: SftpCredentialRecord | null = null;
  let consoleSocket: WebSocket | null = null;
  let globalBackups: BackupRecord[] = [];
  let userWorkspaceModel = {};

  let createNodeForm = {
    name: "",
    region: "",
    publicAddress: "",
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? "",
    capabilities: "",
  };
  let createTemplateForm = {
    id: "",
    name: "",
    category: "",
    description: "",
    dockerImages: "",
    startupCommand: "",
  };
  let createServerForm = {
    name: "",
    description: "",
    nodeId: "",
    templateId: "",
    dockerImage: "",
    allocationIp: "",
    allocationPort: "",
    cpuPercent: "",
    memoryMb: "",
    diskMb: "",
    startupCommand: "",
    environment: {} as Record<string, string>,
  };
  let createTaskForm = {
    name: "",
    cron: "",
    actionType: "power",
    powerAction: "restart",
    command: "",
  };
  let createRoleForm = {
    id: "",
    name: "",
    permissions: "",
  };
  let createWebhookForm = {
    name: "",
    url: "",
    type: "discord",
    events: "",
  };
  let apiKeyName = "";
  let generatedApiKey = "";
  let subUserForm = { userId: "", permissions: "" };
  let domainForm = { domain: "", targetPort: "" };
  let firewallForm = {
    protocol: "tcp",
    port: "",
    source: "",
    action: "allow",
  };
  let backupTargetForm = {
    name: "",
    endpoint: "",
    region: "",
    bucket: "",
    accessKeyId: "",
    secretAccessKey: "",
    pathPrefix: "",
    forcePathStyle: true,
  };
  let cloudflareRouteForm = {
    hostname: "",
    service: "",
    tunnelId: "",
    zoneId: "",
  };
  let topSearchValue = "";
  let serverListMode: "cards" | "table" = "cards";
  let selectedServerRecord: ServerRecord | null = null;
  let admin: any = {};
  let currentViewTitle = "Overview";
  let currentViewSubtitle = "";
  let activeTopBreadcrumbs: Array<{ label: string; key?: string }> = [];
  let activePageBreadcrumbs: Array<{ label: string; href?: string; key?: string }> = [];
  let workspaceBreadcrumbs: Array<{ label: string; href?: string; key?: string }> = [];
  let sidebarStatusLabel = "Awaiting node enrollment";
  let sidebarStatusVariant: "online" | "warning" | "offline" = "warning";
  let busyAction = "";
  let confirmState: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    danger: boolean;
    onConfirm: null | (() => Promise<void> | void);
  } = {
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    danger: false,
    onConfirm: null,
  };
  let secretReveal = {
    open: false,
    title: "",
    subtitle: "",
    secret: "",
    warning: "",
    hint: "",
  };

  const pageDescriptions: Record<View, string> = {
    overview: "Fleet posture, activity, and operational quick actions.",
    servers:
      "Manage game servers and Docker workloads with live runtime controls.",
    nodes: "Node fleet health, registration, metrics, and maintenance controls.",
    "daemon-updates":
      "Daemon version posture, update readiness, and fleet rollout visibility.",
    templates:
      "Template catalog with startup defaults and environment metadata.",
    users: "Identity access control, role assignment, and account posture.",
    roles: "Permission bundles for operators, staff, and automation clients.",
    backups:
      "Backup lifecycle controls for create, restore, download, and retention.",
    "scheduled-tasks": "Recurring automation for power actions, commands, and jobs.",
    "audit-logs": "Trace every sensitive control-plane action with redacted metadata.",
    alerts: "Operational alerts for crashes, failures, thresholds, and node events.",
    "api-keys":
      "Scoped API credentials with one-time key reveal and usage visibility.",
    webhooks: "Outbound webhook endpoints, event filters, and delivery history.",
    "backup-targets":
      "Provider configuration for local and S3-compatible backup destinations.",
    cloudflare:
      "Route lifecycle controls for DNS, tunnel sync, dry-run, and apply.",
    firewall: "Firewall policy overview and server-level enforcement guidance.",
    jobs: "Background queue state across pending, running, success, and failures.",
    plugins: "Trusted plugin manifests and extension lifecycle visibility.",
    billing: "Stripe and WHMCS provisioning integration configuration guidance.",
    settings:
      "Global platform controls for retention, auth, alerts, and integrations.",
  };

  const sidebarGroups = [
    {
      id: "main",
      label: "Main",
      items: [
        { id: "overview", label: "Overview", icon: "OV", href: "#overview" },
        { id: "servers", label: "Servers", icon: "SV", href: "#servers" },
        { id: "nodes", label: "Nodes", icon: "ND", href: "#nodes" },
        { id: "templates", label: "Templates", icon: "TP", href: "#templates" },
        { id: "backups", label: "Backups", icon: "BK", href: "#backups" },
        {
          id: "scheduled-tasks",
          label: "Schedules",
          icon: "SC",
          href: "#scheduled-tasks",
        },
      ],
    },
    {
      id: "access",
      label: "Access",
      items: [
        { id: "users", label: "Users", icon: "US", href: "#users" },
        { id: "roles", label: "Roles", icon: "RL", href: "#roles" },
        { id: "api-keys", label: "API Keys", icon: "AK", href: "#api-keys" },
        {
          id: "audit-logs",
          label: "Audit Logs",
          icon: "AL",
          href: "#audit-logs",
        },
      ],
    },
    {
      id: "infrastructure",
      label: "Infrastructure",
      items: [
        {
          id: "allocations",
          label: "Allocations",
          icon: "AP",
          href: "#nodes",
        },
        {
          id: "network",
          label: "Network",
          icon: "NW",
          href: "#servers",
        },
        {
          id: "cloudflare",
          label: "Cloudflare",
          icon: "CF",
          href: "#cloudflare",
        },
        { id: "firewall", label: "Firewall", icon: "FW", href: "#firewall" },
        { id: "sftp", label: "SFTP", icon: "SF", href: "#servers" },
        {
          id: "daemon-updates",
          label: "Daemon Updates",
          icon: "DU",
          href: "#daemon-updates",
        },
        {
          id: "backup-targets",
          label: "Backup Targets",
          icon: "BT",
          href: "#backup-targets",
        },
      ],
    },
    {
      id: "system",
      label: "System",
      items: [
        { id: "alerts", label: "Alerts", icon: "AR", href: "#alerts" },
        { id: "jobs", label: "Jobs", icon: "JB", href: "#jobs" },
        { id: "webhooks", label: "Webhooks", icon: "WH", href: "#webhooks" },
        { id: "plugins", label: "Plugins", icon: "PL", href: "#plugins" },
        { id: "billing", label: "Billing", icon: "BL", href: "#billing" },
        { id: "settings", label: "Settings", icon: "ST", href: "#settings" },
      ],
    },
  ];

  const selectedServer = () => selectedServerRecord;

  const can = (permission: string) =>
    Boolean(
      me &&
        (me.permissions.includes("*") ||
          me.permissions.includes(permission) ||
          me.roles.some(
            (role) =>
              role.permissions.includes("*") ||
              role.permissions.includes(permission),
          )),
    );

  const isAdminSession = () => Boolean(hasAdminAccess(me));

  const parseApiError = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string; details?: { errors?: Array<{ key: string; message: string }> } };
      };
      validationErrors = parsed.error?.details?.errors ?? [];
      return parsed.error?.message ?? raw;
    } catch {
      return raw;
    }
  };

  const isNotFoundError = (error: unknown) =>
    error instanceof Error &&
    /not found|server not found|node not found|template not found/i.test(error.message);

  const signInLocal = async () => {
    authError = "";
    try {
      await session.signInLocal(authIdentifier, authPassword);
      authPassword = "";
    } catch (signInError) {
      authError =
        signInError instanceof Error
          ? parseApiError(signInError.message)
          : "Sign in failed";
    }
  };

  const openConfirm = (options: {
    title: string;
    description: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void> | void;
  }) => {
    confirmState = {
      open: true,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel,
      danger: options.danger ?? false,
      onConfirm: options.onConfirm,
    };
  };

  const closeConfirm = () => {
    confirmState = {
      open: false,
      title: "",
      description: "",
      confirmLabel: "Confirm",
      danger: false,
      onConfirm: null,
    };
    busyAction = "";
  };

  const executeConfirm = async () => {
    if (!confirmState.onConfirm) {
      return;
    }
    busyAction = confirmState.confirmLabel;
    try {
      await confirmState.onConfirm();
      closeConfirm();
    } catch (actionError) {
      error =
        actionError instanceof Error
          ? parseApiError(actionError.message)
          : "Requested action failed";
      busyAction = "";
    }
  };

  const revealSecret = (options: {
    title: string;
    subtitle: string;
    secret: string;
    warning: string;
    hint?: string;
  }) => {
    secretReveal = {
      open: true,
      title: options.title,
      subtitle: options.subtitle,
      secret: options.secret,
      warning: options.warning,
      hint: options.hint ?? "",
    };
  };

  const closeSecretReveal = () => {
    secretReveal = {
      open: false,
      title: "",
      subtitle: "",
      secret: "",
      warning: "",
      hint: "",
    };
  };

  const setViewFromHash = () => {
    const next = window.location.hash.replace("#", "") as View;
    currentView = views.some((item) => item.id === next) ? next : "overview";
  };

  const applyTemplateDefaults = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      return;
    }
    createServerForm.templateId = template.id;
    createServerForm.dockerImage = template.dockerImages[0] ?? "";
    createServerForm.startupCommand = template.startupCommand;
    createServerForm.environment = Object.fromEntries(
      template.environmentDefinitions.map((definition) => [
        definition.key,
        definition.defaultValue ?? "",
      ]),
    );
  };

  const loadServerDetailData = async (serverId: string) => {
    if (!currentToken) {
      return;
    }
    const [
      metricsResult,
      backupsResult,
      tasksResult,
      filesResult,
      sftpResult,
      membersResult,
      domainsResult,
      firewallResult,
    ] = await Promise.allSettled([
      api.servers.metrics(currentToken, serverId),
      api.servers.backups.list(currentToken, serverId),
      api.servers.tasks.list(currentToken, serverId),
      api.servers.files.list(currentToken, serverId, currentPath),
      api.servers.sftp(currentToken, serverId),
      api.servers.members.list(currentToken, serverId),
      api.servers.domains.list(currentToken, serverId),
      api.servers.firewall.list(currentToken, serverId),
    ]);

    serverMetrics =
      metricsResult.status === "fulfilled" ? metricsResult.value : [];
    serverBackups =
      backupsResult.status === "fulfilled" ? backupsResult.value : [];
    serverTasks = tasksResult.status === "fulfilled" ? tasksResult.value : [];
    serverFiles =
      filesResult.status === "fulfilled" ? filesResult.value.entries : [];
    sftpCredential =
      sftpResult.status === "fulfilled" ? sftpResult.value : null;
    serverMembers =
      membersResult.status === "fulfilled" ? membersResult.value : [];
    serverDomains =
      domainsResult.status === "fulfilled" ? domainsResult.value : [];
    serverFirewallRules =
      firewallResult.status === "fulfilled" ? firewallResult.value : [];

    const firstError = [
      metricsResult,
      backupsResult,
      tasksResult,
      filesResult,
      sftpResult,
      membersResult,
      domainsResult,
      firewallResult,
    ].find((result) => result.status === "rejected");

    if (firstError?.status === "rejected" && !isNotFoundError(firstError.reason)) {
      error =
        firstError.reason instanceof Error
          ? parseApiError(firstError.reason.message)
          : "Failed to load all server details";
    } else {
      error = "";
    }
  };

  const loadAdminData = async (token: string) => {
    const tasks: Array<Promise<unknown>> = [];
    const settle = <T>(promise: Promise<T>, assign: (value: T) => void) =>
      promise.then(assign).catch(() => void 0);

    if (can("users.view")) {
      tasks.push(settle(api.admin.users(token), (value) => (users = value)));
    }
    if (can("roles.view")) {
      tasks.push(settle(api.admin.roles(token), (value) => (roles = value)));
    }
    if (can("audit.view")) {
      tasks.push(settle(api.admin.auditLogs(token), (value) => (auditLogs = value)));
    }
    if (can("settings.view")) {
      tasks.push(settle(api.admin.settings.get(token), (value) => (settings = value)));
    }
    if (can("apiKeys.view")) {
      tasks.push(settle(api.admin.apiKeys.list(token), (value) => (apiKeys = value)));
    }
    if (can("webhooks.view")) {
      tasks.push(settle(api.admin.webhooks.list(token), (value) => (webhooks = value)));
      tasks.push(settle(api.admin.webhookDeliveries(token), (value) => (webhookDeliveries = value)));
    }
    if (can("backupTargets.view")) {
      tasks.push(settle(api.admin.backupTargets.list(token), (value) => (backupTargets = value)));
    }
    if (can("alerts.view")) {
      tasks.push(settle(api.admin.alerts.events(token), (value) => (alertEvents = value)));
    }
    if (can("tasks.view")) {
      tasks.push(settle(api.admin.jobs(token), (value) => (jobs = value)));
    }
    if (can("integrations.view")) {
      tasks.push(settle(api.admin.plugins.list(token), (value) => (plugins = value)));
      tasks.push(settle(api.admin.cloudflare.routes(token), (value) => (cloudflareRoutes = value)));
    }
    await Promise.all(tasks);
  };

  const loadAll = async (token: string) => {
    loading = true;
    error = "";
    try {
      const nextMe = await api.me(token);
      me = nextMe;

      if (isAdminSession()) {
        const [nextDashboard, nextNodes, nextTemplates, nextServers] = await Promise.all([
          api.dashboard(token),
          api.nodes.list(token),
          api.templates.list(token),
          api.servers.list(token),
        ]);

        dashboard = nextDashboard;
        nodes = nextNodes;
        templates = nextTemplates;
        servers = nextServers;
        globalBackups = nextServers.flatMap((server) => []);

        if (!selectedServerId && nextServers[0]) {
          selectedServerId = nextServers[0].id;
        }
        if (nextNodes[0] && !createServerForm.nodeId) {
          createServerForm.nodeId = nextNodes[0].id;
        }
        if (nextTemplates[0] && !createServerForm.templateId) {
          applyTemplateDefaults(nextTemplates[0].id);
        }
        if (selectedServerId) {
          await loadServerDetailData(selectedServerId);
        }
        await loadAdminData(token);
      } else {
        const [maybeDashboard, nextServers] = await Promise.all([
          api.dashboard(token).catch(() => null),
          api.servers.list(token),
        ]);

        dashboard = maybeDashboard;
        nodes = [];
        templates = [];
        servers = nextServers;
        globalBackups = nextServers.flatMap((server) => []);

        if (!selectedServerId && nextServers[0]) {
          selectedServerId = nextServers[0].id;
        }
        if (selectedServerId) {
          await loadServerDetailData(selectedServerId);
        }
      }
    } catch (loadError) {
      error =
        loadError instanceof Error && isNotFoundError(loadError)
          ? ""
          : loadError instanceof Error
            ? parseApiError(loadError.message)
            : "Failed to load dashboard";
    } finally {
      loading = false;
    }
  };

  const createNode = async () => {
    if (!currentToken) {
      return;
    }
    const result = await api.nodes.create(currentToken, {
      ...createNodeForm,
      capabilities: createNodeForm.capabilities.split(",").map((item) => item.trim()),
    });
    nodeBootstrapToken = result.bootstrapToken;
    revealSecret({
      title: `Bootstrap token for ${result.node.name}`,
      subtitle: "Use this token once when pairing a daemon node.",
      secret: result.bootstrapToken,
      warning:
        "Store this bootstrap token securely. It grants one-time node registration capability.",
      hint: `${result.node.publicAddress} · ${result.node.region}`,
    });
    await loadAll(currentToken);
  };

  const importEnvExample = async () => {
    if (!currentToken) {
      return;
    }
    const response = await api.templates.importEnvExample(currentToken, envImportText);
    previewDefinitions = response.definitions;
  };

  const createTemplate = async () => {
    if (!currentToken) {
      return;
    }
    await api.templates.create(currentToken, {
      ...createTemplateForm,
      dockerImages: createTemplateForm.dockerImages.split(",").map((item) => item.trim()),
      environmentDefinitions: previewDefinitions,
      importedEnvExample: envImportText,
    });
    await loadAll(currentToken);
  };

  const createServer = async () => {
    if (!currentToken || !me) {
      return;
    }
    validationErrors = [];
    try {
      const server = await api.servers.create(currentToken, {
        name: createServerForm.name,
        description: createServerForm.description,
        ownerId: me.user.uid,
        nodeId: createServerForm.nodeId,
        templateId: createServerForm.templateId,
        dockerImage: createServerForm.dockerImage,
        allocations: [
          {
            ip: createServerForm.allocationIp,
            port: Number(createServerForm.allocationPort),
            primary: true,
          },
        ],
        limits: {
          cpuPercent: Number(createServerForm.cpuPercent),
          memoryMb: Number(createServerForm.memoryMb),
          diskMb: Number(createServerForm.diskMb),
        },
        startupCommand: createServerForm.startupCommand,
        environment: createServerForm.environment,
        restartPolicy: "unless-stopped",
      });
      selectedServerId = server.id;
      await loadAll(currentToken);
    } catch (createError) {
      error =
        createError instanceof Error
          ? parseApiError(createError.message)
          : "Create server failed";
    }
  };

  const selectServer = async (serverId: string) => {
    selectedServerId = serverId;
    if (isAdminSession()) {
      currentView = "servers";
      serverSection = "console";
    } else {
      workspaceSection = "console";
    }
    if (currentToken) {
      await loadServerDetailData(serverId);
      connectConsole();
    }
  };

  const updateServerEnvironment = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    try {
      const server = selectedServer()!;
      const updated = await api.servers.updateEnvironment(
        currentToken,
        server.id,
        server.environment,
      );
      servers = servers.map((item) => (item.id === updated.id ? updated : item));
      validationErrors = [];
    } catch (saveError) {
      error =
        saveError instanceof Error ? parseApiError(saveError.message) : "Save failed";
    }
  };

  const powerServer = async (action: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.power(currentToken, selectedServer()!.id, action);
    await loadAll(currentToken);
  };

  const powerServerById = async (serverId: string, action: string) => {
    if (selectedServerId !== serverId) {
      await selectServer(serverId);
    }
    await powerServer(action);
  };

  const connectConsole = () => {
    const consoleVisible = isAdminSession()
      ? serverSection === "console"
      : workspaceSection === "console";
    if (!currentToken || !selectedServer() || !consoleVisible) {
      return;
    }
    consoleSocket?.close();
    consoleLines = [];
    consoleSocket = new WebSocket(consoleSocketUrl(currentToken, selectedServer()!.id));
    consoleSocket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as { chunk?: string };
      if (payload.chunk) {
        consoleLines = [...consoleLines.slice(-400), payload.chunk];
      }
    };
  };

  const sendConsoleCommand = async () => {
    if (!currentToken || !selectedServer() || !consoleCommand.trim()) {
      return;
    }
    await api.servers.consoleCommand(currentToken, selectedServer()!.id, consoleCommand);
    commandHistory = [consoleCommand, ...commandHistory].slice(0, 50);
    consoleCommand = "";
  };

  const browseFiles = async (path: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    currentPath = path;
    const response = await api.servers.files.list(currentToken, selectedServer()!.id, path);
    serverFiles = response.entries;
  };

  const createFolder = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.files.createFolder(
      currentToken,
      selectedServer()!.id,
      `${currentPath === "." ? "" : `${currentPath}/`}new-folder`,
    );
    await browseFiles(currentPath);
  };

  const openFile = async (path: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    currentFilePath = path;
    const response = await api.servers.files.read(currentToken, selectedServer()!.id, path);
    fileEditorContent = response.content;
  };

  const saveFile = async () => {
    if (!currentToken || !selectedServer() || !currentFilePath) {
      return;
    }
    await api.servers.files.write(
      currentToken,
      selectedServer()!.id,
      currentFilePath,
      fileEditorContent,
    );
    await browseFiles(currentPath);
  };

  const confirmDeleteFile = (path: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    const fileName = path.split("/").pop() || path;
    openConfirm({
      title: "Delete file",
      description: `Permanently remove ${fileName} from ${selectedServer()!.name}?`,
      confirmLabel: "Delete file",
      danger: true,
      onConfirm: async () => {
        await api.servers.files.remove(currentToken!, selectedServer()!.id, path);
        if (currentFilePath === path) {
          currentFilePath = "";
          fileEditorContent = "";
        }
        await browseFiles(currentPath);
      },
    });
  };

  const uploadFile = async (event: Event) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    await api.servers.files.upload(
      currentToken,
      selectedServer()!.id,
      `${currentPath === "." ? "" : `${currentPath}/`}${file.name}`,
      file,
    );
    await browseFiles(currentPath);
  };

  const downloadFile = async (path: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    const blob = await api.servers.files.downloadStream(
      currentToken,
      selectedServer()!.id,
      path,
    );
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = path.split("/").pop() || "download";
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const clearConsole = () => {
    consoleLines = [];
  };

  const copyLatestConsoleError = async () => {
    const latestError = [...consoleLines]
      .reverse()
      .find((line) => /error|fail|exception/i.test(line));
    if (latestError && navigator.clipboard) {
      await navigator.clipboard.writeText(latestError);
    }
  };

  const createBackup = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.backups.create(currentToken, selectedServer()!.id);
    await loadServerDetailData(selectedServer()!.id);
  };

  const restoreBackup = async (backupId: string) => {
    if (!currentToken) {
      return;
    }
    openConfirm({
      title: "Restore backup",
      description:
        "Restore this backup over the current server data? Existing files may be overwritten.",
      confirmLabel: "Restore backup",
      danger: true,
      onConfirm: async () => {
        await api.servers.backups.restore(currentToken, backupId);
      },
    });
  };

  const deleteBackup = async (backupId: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    openConfirm({
      title: "Delete backup",
      description: `Delete backup ${backupId} from ${selectedServer()!.name}? This cannot be undone.`,
      confirmLabel: "Delete backup",
      danger: true,
      onConfirm: async () => {
        await api.servers.backups.remove(currentToken, backupId);
        await loadServerDetailData(selectedServer()!.id);
      },
    });
  };

  const downloadBackup = async (backupId: string) => {
    if (!currentToken) {
      return;
    }
    const blob = await api.servers.backups.downloadStream(currentToken, backupId);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${backupId}.tar.gz`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  const createTask = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.tasks.create(currentToken, selectedServer()!.id, {
      name: createTaskForm.name,
      cron: createTaskForm.cron,
      enabled: true,
      action:
        createTaskForm.actionType === "power"
          ? { type: "power", powerAction: createTaskForm.powerAction }
          : { type: "command", command: createTaskForm.command },
    });
    await loadServerDetailData(selectedServer()!.id);
  };

  const runTask = async (taskId: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.tasks.run(currentToken, taskId);
    await loadServerDetailData(selectedServer()!.id);
  };

  const toggleNodeMaintenance = async (node: NodeRecord) => {
    if (!currentToken) {
      return;
    }
    await api.nodes.maintenance(currentToken, node.id, !node.maintenanceMode);
    await loadAll(currentToken);
  };

  const loadNodeConfig = async (nodeId: string) => {
    if (!currentToken) {
      return;
    }
    selectedNodeConfig = await api.nodes.config(currentToken, nodeId);
    nodeMetrics = await api.nodes.metrics(currentToken, nodeId);
  };

  const updateUserRole = async (userId: string, roleId: string) => {
    if (!currentToken) {
      return;
    }
    await api.admin.updateUser(currentToken, userId, [roleId]);
    users = await api.admin.users(currentToken);
  };

  const createRole = async () => {
    if (!currentToken) {
      return;
    }
    await api.admin.createRole(currentToken, {
      id: createRoleForm.id,
      name: createRoleForm.name,
      permissions: createRoleForm.permissions.split(",").map((item) => item.trim()),
    });
    roles = await api.admin.roles(currentToken);
  };

  const createApiKey = async (name = apiKeyName) => {
    if (!currentToken) {
      return;
    }
    const result = await api.admin.apiKeys.create(currentToken, name, [
      "servers.view",
      "servers.power",
    ]);
    generatedApiKey = result.plainTextKey;
    revealSecret({
      title: "Leviathan API key created",
      subtitle: "The raw automation credential is shown once.",
      secret: result.plainTextKey,
      warning:
        "Copy this API key now. Leviathan stores only the hashed version after this dialog closes.",
      hint: `Prefix: ${result.record.prefix ?? result.record.id}`,
    });
    apiKeys = await api.admin.apiKeys.list(currentToken);
  };

  const revokeApiKey = async (keyId: string, keyName: string) => {
    if (!currentToken) {
      return;
    }
    openConfirm({
      title: "Revoke API key",
      description: `Revoke ${keyName}? Automation using this key will lose access immediately.`,
      confirmLabel: "Revoke key",
      danger: true,
      onConfirm: async () => {
        await api.admin.apiKeys.revoke(currentToken, keyId);
        apiKeys = await api.admin.apiKeys.list(currentToken);
      },
    });
  };

  const createWebhook = async () => {
    if (!currentToken) {
      return;
    }
    await api.admin.webhooks.create(currentToken, {
      name: createWebhookForm.name,
      url: createWebhookForm.url,
      type: createWebhookForm.type,
      events: createWebhookForm.events.split(",").map((item) => item.trim()),
    });
    webhooks = await api.admin.webhooks.list(currentToken);
  };

  const createBackupTarget = async () => {
    if (!currentToken) {
      return;
    }
    await api.admin.backupTargets.create(currentToken, {
      name: backupTargetForm.name,
      provider: "s3",
      serverIds: [],
      enabled: true,
      s3: {
        endpoint: backupTargetForm.endpoint || undefined,
        region: backupTargetForm.region,
        bucket: backupTargetForm.bucket,
        accessKeyId: backupTargetForm.accessKeyId,
        secretAccessKey: backupTargetForm.secretAccessKey,
        pathPrefix: backupTargetForm.pathPrefix,
        forcePathStyle: backupTargetForm.forcePathStyle,
      },
    });
    backupTargets = await api.admin.backupTargets.list(currentToken);
  };

  const addSubUser = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    serverMembers = await api.servers.members.create(
      currentToken,
      selectedServer()!.id,
      {
        userId: subUserForm.userId,
        permissions: subUserForm.permissions.split(",").map((item) => item.trim()),
      },
    );
  };

  const removeSubUser = async (userId: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    openConfirm({
      title: "Remove sub-user access",
      description: `Remove delegated access for ${userId} from ${selectedServer()!.name}?`,
      confirmLabel: "Remove access",
      danger: true,
      onConfirm: async () => {
        serverMembers = await api.servers.members.remove(
          currentToken,
          selectedServer()!.id,
          userId,
        );
      },
    });
  };

  const createDomainMapping = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    const server = selectedServer()!;
    const mapping = await api.servers.domains.create(currentToken, server.id, {
      serverId: server.id,
      domain: domainForm.domain,
      targetPort: Number(domainForm.targetPort),
      provider: "caddy",
      tls: true,
      enabled: true,
    });
    serverDomains = [...serverDomains, mapping];
  };

  const createFirewallRule = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    const rule = await api.servers.firewall.create(
      currentToken,
      selectedServer()!.id,
      {
        protocol: firewallForm.protocol,
        port: Number(firewallForm.port),
        source: firewallForm.source,
        action: firewallForm.action,
        enabled: true,
      },
    );
    serverFirewallRules = [...serverFirewallRules, rule];
  };

  const applyFirewallRules = async (dryRun = true) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.firewall.apply(currentToken, selectedServer()!.id, dryRun);
  };

  const confirmApplyFirewallRules = () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    openConfirm({
      title: "Apply firewall rules",
      description:
        "Push the current firewall policy to the daemon node now? Incorrect rules can break connectivity.",
      confirmLabel: "Apply rules",
      danger: true,
      onConfirm: async () => {
        await applyFirewallRules(false);
      },
    });
  };

  const rotateSftp = async () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    sftpCredential = await api.servers.rotateSftp(currentToken, selectedServer()!.id);
    revealSecret({
      title: "Rotated SFTP credential",
      subtitle: `New password for ${sftpCredential.username}`,
      secret: sftpCredential.password,
      warning:
        "Copy this SFTP password now. The standard server detail view keeps credentials masked after rotation.",
      hint: `${sftpCredential.host}:${sftpCredential.port} · ${sftpCredential.rootPath}`,
    });
  };

  const deleteServer = () => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    openConfirm({
      title: "Delete server",
      description: `Delete ${selectedServer()!.name} and all related runtime state? This cannot be undone.`,
      confirmLabel: "Delete server",
      danger: true,
      onConfirm: async () => {
        await api.servers.remove(currentToken, selectedServer()!.id);
        await loadAll(currentToken);
        selectedServerId = servers[0]?.id ?? "";
      },
    });
  };

  const acknowledgeAlert = async (alertId: string) => {
    if (!currentToken) {
      return;
    }
    await api.admin.alerts.acknowledge(currentToken, alertId);
    alertEvents = await api.admin.alerts.events(currentToken);
  };

  const createCloudflareRoute = async () => {
    if (!currentToken) {
      return;
    }
    const route = await api.admin.cloudflare.createRoute(currentToken, {
      ...cloudflareRouteForm,
      enabled: true,
    });
    cloudflareRoutes = [...cloudflareRoutes, route];
  };

  const dryRunCloudflareRoute = async (routeId: string) => {
    if (!currentToken) {
      return;
    }
    await api.admin.cloudflare.syncRoute(currentToken, routeId, true);
  };

  const syncCloudflareRoute = async (routeId: string) => {
    if (!currentToken) {
      return;
    }
    await api.admin.cloudflare.syncRoute(currentToken, routeId, false);
  };

  const deleteCloudflareRoute = async (routeId: string) => {
    if (!currentToken) {
      return;
    }
    const route = cloudflareRoutes.find((item) => item.id === routeId);
    openConfirm({
      title: "Delete Cloudflare route",
      description: `Remove ${route?.hostname ?? "this route"} from Leviathan route management?`,
      confirmLabel: "Delete route",
      danger: true,
      onConfirm: async () => {
        await api.admin.cloudflare.deleteRoute(currentToken, routeId);
        cloudflareRoutes = cloudflareRoutes.filter((item) => item.id !== routeId);
      },
    });
  };

  const saveSettings = async () => {
    if (!currentToken || !settings) {
      return;
    }
    settings = await api.admin.settings.update(currentToken, settings);
  };

  const navigateToView = (viewId: string) => {
    const aliases: Record<string, View> = {
      allocations: "nodes",
      network: "servers",
      sftp: "servers",
    };
    const resolved = aliases[viewId] ?? viewId;
    if (!views.some((view) => view.id === resolved)) {
      return;
    }
    const target = resolved as View;
    currentView = target;
    window.location.hash = `#${target}`;
  };

  const focusCreateSurface = async (view: View, targetId: string) => {
    navigateToView(view);
    await tick();
    const surface = document.getElementById(targetId);
    if (!surface) {
      return;
    }
    surface.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    surface.focus();
  };

  const handleHeaderSearch = async (value: string) => {
    if (!value) {
      return;
    }
    const query = value.toLowerCase();
    const matchingServer = servers.find((server) =>
      server.name.toLowerCase().includes(query),
    );
    if (matchingServer) {
      await selectServer(matchingServer.id);
      return;
    }
    if (isAdminSession()) {
      const matchingView = views.find(
        (view) =>
          view.label.toLowerCase().includes(query) ||
          view.id.toLowerCase().includes(query),
      );
      if (matchingView) {
        navigateToView(matchingView.id);
      }
    }
  };

  const openNotifications = () => {
    if (isAdminSession()) {
      navigateToView("alerts");
    } else {
      workspaceSection = "activity";
    }
  };

  const openProfile = () => {
    if (isAdminSession()) {
      navigateToView("settings");
    } else {
      workspaceSection = "settings";
    }
  };

  const currentServerMetric = () =>
    serverMetrics.length ? serverMetrics[serverMetrics.length - 1] : null;

  $: userWorkspaceModel = {
    loading,
    error,
    userDisplayName: me?.user.displayName ?? "Leviathan user",
    userEmail: me?.user.email ?? null,
    servers,
    selectedServer: selectedServerRecord,
    selectedServerId,
    serverMetric: currentServerMetric(),
    serverBackups,
    serverTasks,
    serverFiles,
    serverMembers,
    serverDomains,
    serverFirewallRules,
    sftpCredential,
    auditLogs,
    consoleLines,
    commandHistory,
    tabs: workspaceSections,
    createTaskForm,
    subUserForm,
    domainForm,
    firewallForm,
    actions: {
      openNotifications,
      openProfile,
      signOut: () => session.signOut(),
      selectServer,
      powerServerById,
      powerServer,
      sendConsoleCommand,
      clearConsole,
      copyLatestConsoleError,
      browseFiles,
      openFile,
      saveFile,
      confirmDeleteFile,
      uploadFile,
      downloadFile,
      createFolder,
      createBackup,
      restoreBackup,
      deleteBackup,
      downloadBackup,
      createTask,
      runTask,
      addSubUser,
      removeSubUser,
      createDomainMapping,
      createFirewallRule,
      applyFirewallRules,
      confirmApplyFirewallRules,
      rotateSftp,
      updateServerEnvironment,
      deleteServer,
    },
  };

  const formatPercent = (value: number | undefined) =>
    `${Math.round(value ?? 0)}%`;

  const formatMegabytes = (value: number | undefined) =>
    `${Math.round(value ?? 0).toLocaleString()} MB`;

  const formatBytes = (value: number) => `${value.toLocaleString()} bytes`;

  const usagePercent = (used: number | undefined, limit: number | undefined) => {
    if (!limit || limit <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(((used ?? 0) / limit) * 100)));
  };

  const latestDaemonVersion = () => {
    const versions = nodes
      .map((node) => node.daemonVersion)
      .filter((version): version is string => Boolean(version));
    if (!versions.length) {
      return null;
    }
    return versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))[0];
  };

  const formatNodeCount = () => {
    const total = nodes.length;
    if (!total) {
      return "Awaiting node enrollment";
    }
    const online = nodes.filter((node) => node.status === "online").length;
    return `${online}/${total} nodes online`;
  };

  const sidebarStatusTone = () => {
    if (!nodes.length) {
      return "warning" as const;
    }
    if (nodes.some((node) => node.status === "offline")) {
      return "warning" as const;
    }
    return "online" as const;
  };

  const serverStripTone = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "online" || normalized === "running") {
      return "online";
    }
    if (
      normalized === "starting" ||
      normalized === "stopping" ||
      normalized === "installing" ||
      normalized === "updating"
    ) {
      return "updating";
    }
    if (normalized === "maintenance" || normalized === "suspended") {
      return "warning";
    }
    return "offline";
  };

  $: selectedServerRecord =
    servers.find((server) => server.id === selectedServerId) ?? null;

  $: if (
    !isAdminSession() &&
    servers.length &&
    (!selectedServerId || !servers.some((server) => server.id === selectedServerId))
  ) {
    selectedServerId = servers[0].id;
  }

  $: currentViewTitle =
    views.find((view) => view.id === currentView)?.label ?? "Overview";

  $: currentViewSubtitle = pageDescriptions[currentView];

  $: sidebarStatusLabel = formatNodeCount();

  $: sidebarStatusVariant = sidebarStatusTone();

  $: admin = {
    currentView,
    currentViewTitle,
    currentViewSubtitle,
    activeTopBreadcrumbs,
    activePageBreadcrumbs,
    sidebarGroups,
    sidebarStatusLabel,
    sidebarStatusVariant,
    me,
    loading,
    error,
    dashboard,
    nodes,
    templates,
    servers,
    users,
    roles,
    auditLogs,
    settings,
    apiKeys,
    webhooks,
    webhookDeliveries,
    backupTargets,
    alertEvents,
    jobs,
    plugins,
    cloudflareRoutes,
    selectedServerId,
    serverListMode,
    createNodeForm,
    createTemplateForm,
    createServerForm,
    createTaskForm,
    createRoleForm,
    createWebhookForm,
    apiKeyName,
    generatedApiKey,
    subUserForm,
    domainForm,
    firewallForm,
    backupTargetForm,
    cloudflareRouteForm,
    previewDefinitions,
    envImportText,
    validationErrors,
    nodeBootstrapToken,
    selectedNodeConfig,
    nodeMetrics,
    serverMetrics,
    serverBackups,
    serverTasks,
    serverFiles,
    serverMembers,
    serverDomains,
    serverFirewallRules,
    currentPath,
    currentFilePath,
    fileEditorContent,
    consoleLines,
    consoleSearch,
    consoleCommand,
    commandHistory,
    autoScroll,
    sftpCredential,
    selectedServerRecord,
    serverSections,
    currentServerMetric,
    formatPercent,
    formatMegabytes,
    formatBytes,
    usagePercent,
    latestDaemonVersion,
    serverStripTone,
    navigateToView,
    handleHeaderSearch,
    openNotifications,
    openProfile,
    focusCreateSurface,
    selectServer,
    powerServer,
    powerServerById,
    updateServerEnvironment,
    sendConsoleCommand,
    browseFiles,
    openFile,
    saveFile,
    confirmDeleteFile,
    uploadFile,
    downloadFile,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    createTask,
    runTask,
    toggleNodeMaintenance,
    loadNodeConfig,
    updateUserRole,
    createRole,
    createApiKey,
    revokeApiKey,
    createWebhook,
    createBackupTarget,
    addSubUser,
    removeSubUser,
    addFirewallRule: createFirewallRule,
    applyFirewallRules,
    saveSettings,
    createCloudflareRoute,
    dryRunCloudflareRoute,
    syncCloudflareRoute,
    deleteCloudflareRoute,
    importEnvExample,
    createNode,
    createTemplate,
    createServer,
    signOut: () => session.signOut(),
  };

  $: activeTopBreadcrumbs = (() => {
    const groups = new Map<string, string>();
    for (const group of sidebarGroups) {
      for (const item of group.items) {
        groups.set(item.id, group.label);
      }
    }
    return [
      { label: "Leviathan" },
      { label: groups.get(currentView) ?? "Main" },
      { label: currentViewTitle },
    ];
  })();

  $: activePageBreadcrumbs =
    currentView !== "servers" || !selectedServerRecord
      ? [{ label: "Leviathan" }, { label: currentViewTitle }]
      : [
          { label: "Leviathan" },
          { label: "Servers", href: "#servers" },
          { label: selectedServerRecord.name },
        ];

  $: workspaceBreadcrumbs =
    selectedServerRecord === null
      ? [{ label: "Leviathan" }, { label: "Servers" }]
      : [
          { label: "Leviathan" },
          { label: "Servers" },
          { label: selectedServerRecord.name },
        ];

  $: if (
    selectedServerId &&
    currentToken &&
    (currentView === "servers" || !isAdminSession())
  ) {
    void loadServerDetailData(selectedServerId);
  }

  $: if (
    currentToken &&
    selectedServer() &&
    ((isAdminSession() && currentView === "servers" && serverSection === "console") ||
      (!isAdminSession() && workspaceSection === "console"))
  ) {
    connectConsole();
  }

  onMount(() => {
    setViewFromHash();
    session.init();
    window.addEventListener("hashchange", setViewFromHash);

    const unsubscribe = session.subscribe(async (value) => {
      currentToken = value.token;
      if (value.token) {
        sessionHydrating = true;
        await loadAll(value.token);
        sessionHydrating = false;
      } else {
        sessionHydrating = false;
        me = null;
        dashboard = null;
        nodes = [];
        templates = [];
        servers = [];
        users = [];
        roles = [];
        auditLogs = [];
        settings = null;
        apiKeys = [];
        webhooks = [];
        webhookDeliveries = [];
        backupTargets = [];
        alertEvents = [];
        jobs = [];
        plugins = [];
        cloudflareRoutes = [];
        selectedServerId = "";
        selectedServerRecord = null;
        serverMetrics = [];
        serverBackups = [];
        serverTasks = [];
        serverFiles = [];
        serverMembers = [];
        serverDomains = [];
        serverFirewallRules = [];
        consoleLines = [];
        commandHistory = [];
        currentFilePath = "";
        fileEditorContent = "";
        consoleCommand = "";
        currentPath = ".";
        authError = "";
        error = "";
      }
    });

    return () => {
      window.removeEventListener("hashchange", setViewFromHash);
      unsubscribe();
    };
  });

  onDestroy(() => {
    consoleSocket?.close();
  });
</script>

<svelte:head>
  <title>Leviathan Panel</title>
  <meta
    name="description"
    content="Leviathan is a dark, premium server management panel for Docker workloads, game servers, nodes, files, backups, and live operations."
  />
</svelte:head>

{#if !currentToken}
  <main class="auth-shell">
    <div class="auth-card">
      <div class="brand-lockup auth-brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <p class="eyebrow">Leviathan</p>
          <strong>Command the depths of your infrastructure.</strong>
        </div>
      </div>
      <h1>Deep-control orchestration for game servers and Docker workloads.</h1>
      <p class="lede">
        A darker control plane for nodes, daemons, live console, files, backups,
        schedules, and infrastructure operations.
      </p>
      <div class="auth-form">
        <label>
          <span>Username or Email</span>
          <input bind:value={authIdentifier} placeholder="admin" autocomplete="username" />
        </label>
        <label>
          <span>Password</span>
          <input
            bind:value={authPassword}
            type="password"
            placeholder="Enter your Leviathan password"
            autocomplete="current-password"
            on:keydown={(event) => {
              if (event.key === "Enter") {
                void signInLocal();
              }
            }}
          />
        </label>
        {#if authError}
          <p class="inline-error">{authError}</p>
        {/if}
      </div>
  <div class="auth-actions">
        <button on:click={() => void signInLocal()}>Sign in to Leviathan</button>
      </div>
    </div>
  </main>
{:else if sessionHydrating}
  <main class="auth-shell">
    <LoadingState
      title="Loading Leviathan session"
      description="Hydrating your account, permissions, servers, and infrastructure controls."
    />
  </main>
{:else if error && !me}
  <main class="auth-shell">
    <div class="auth-card">
      <div class="brand-lockup auth-brand">
        <span class="brand-mark" aria-hidden="true"></span>
        <div>
          <p class="eyebrow">Leviathan</p>
          <strong>Session unavailable</strong>
        </div>
      </div>
      <h1>We couldn’t finish loading your workspace.</h1>
      <p class="lede">{error}</p>
      <div class="auth-actions">
        <button on:click={() => session.signOut()}>Return to sign in</button>
      </div>
    </div>
  </main>
{:else if isAdminSession()}
  <AdminDashboard admin={admin} />
{:else}
  <UserWorkspace
    workspace={userWorkspaceModel}
    bind:workspaceListMode={workspaceListMode}
    bind:workspaceSection={workspaceSection}
    bind:consoleSearch={consoleSearch}
    bind:autoScroll={autoScroll}
    bind:consoleCommand={consoleCommand}
    bind:currentPath={currentPath}
    bind:currentFilePath={currentFilePath}
    bind:fileEditorContent={fileEditorContent}
  />
  {#if false}
  <main class="user-shell">
    <PageHeader
      title="Your Servers"
      description="Server-first workspace with direct console, files, backups, schedules, users, and runtime controls."
      breadcrumbs={[{ label: "Leviathan" }, { label: "Servers" }]}
    >
      <svelte:fragment slot="actions">
        <div class="button-row">
          <ActionButton variant="ghost" on:click={openNotifications}>Activity</ActionButton>
          <ActionButton variant="ghost" on:click={openProfile}>Profile</ActionButton>
          <ActionButton variant="secondary" on:click={() => session.signOut()}>Sign Out</ActionButton>
        </div>
      </svelte:fragment>
    </PageHeader>

    {#if error}
      <p class="inline-error">{error}</p>
    {/if}

    {#if loading}
      <LoadingState
        title="Loading Leviathan workspace"
        description="Pulling your servers, metrics, files, and runtime controls into the workspace."
      />
    {/if}

    <section class="workspace-grid">
      <aside class="server-sidebar">
        <Card
          title="Servers"
          subtitle="Select a workload to open its console and configuration tabs"
        >
          <svelte:fragment slot="actions">
            <div class="button-row">
              <ActionButton
                variant={workspaceListMode === "cards" ? "secondary" : "ghost"}
                on:click={() => (workspaceListMode = "cards")}
              >
                Cards
              </ActionButton>
              <ActionButton
                variant={workspaceListMode === "table" ? "secondary" : "ghost"}
                on:click={() => (workspaceListMode = "table")}
              >
                Table
              </ActionButton>
            </div>
          </svelte:fragment>

          {#if servers.length}
            {#if workspaceListMode === "cards"}
              <div class="list">
                {#each servers as server}
                  <button
                    class="server-list-item"
                    class:selected={selectedServerId === server.id}
                    on:click={() => void selectServer(server.id)}
                  >
                    <div>
                      <strong>{server.name}</strong>
                      <small>
                        {server.allocations[0]
                          ? `${server.allocations[0].ip}:${server.allocations[0].port}`
                          : "No allocation"} • {server.nodeId}
                      </small>
                    </div>
                    <StatusBadge status={server.status} />
                    <span
                      class={`status-strip status-strip-${serverStripTone(server.status)}`}
                      aria-hidden="true"
                    ></span>
                  </button>
                {/each}
              </div>
            {:else}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Server</th>
                        <th>Status</th>
                        <th>Node</th>
                        <th>Allocation</th>
                        <th class="cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each servers as server}
                        <tr class:selected={selectedServerId === server.id}>
                          <td>
                            <strong>{server.name}</strong>
                            <small>{server.dockerImage}</small>
                          </td>
                          <td><StatusBadge status={server.status} /></td>
                          <td class="cell-mono">{server.nodeId}</td>
                          <td class="cell-mono">
                            {server.allocations[0]
                              ? `${server.allocations[0].ip}:${server.allocations[0].port}`
                              : "No allocation"}
                          </td>
                          <td class="cell-right">
                            <div class="button-row">
                              <ActionButton variant="ghost" on:click={() => void selectServer(server.id)}>Open</ActionButton>
                              <ActionButton variant="secondary" on:click={() => void selectServer(server.id)}>Console</ActionButton>
                            </div>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {/if}
          {:else}
            <EmptyState
              title="No servers available"
              description="Your account does not have any assigned workloads yet."
            />
          {/if}
        </Card>

        <div class="dashboard-grid">
          <StatCard label="Servers" value={servers.length} detail="Assigned workloads" />
          <StatCard
            label="Running"
            value={servers.filter((server) => server.status === "running").length}
            detail="Live containers"
            tone="success"
          />
          <StatCard
            label="Offline"
            value={servers.filter((server) => ["offline", "stopped"].includes(server.status)).length}
            detail="Not currently serving"
            tone="warning"
          />
          <StatCard
            label="Suspended"
            value={servers.filter((server) => server.suspended).length}
            detail="Access restricted"
            tone="danger"
          />
        </div>
      </aside>

      <section class="server-detail">
        {#if selectedServer()}
          <PageHeader
            title={selectedServer()!.name}
            description={selectedServer()!.description ?? selectedServer()!.dockerImage}
            breadcrumbs={workspaceBreadcrumbs}
          >
            <svelte:fragment slot="actions">
              <div class="button-row">
                <StatusBadge status={selectedServer()!.status} />
                <ActionButton on:click={() => powerServer("start")}>Start</ActionButton>
                <ActionButton variant="secondary" on:click={() => powerServer("restart")}>Restart</ActionButton>
                <ActionButton variant="secondary" on:click={() => powerServer("stop")}>Stop</ActionButton>
                <ActionButton variant="danger" on:click={() => powerServer("kill")}>Kill</ActionButton>
              </div>
            </svelte:fragment>
          </PageHeader>

          <div class="metrics-grid">
            <StatCard
              label="Address"
              value={
                selectedServer()!.allocations[0]
                  ? `${selectedServer()!.allocations[0].ip}:${selectedServer()!.allocations[0].port}`
                  : "unassigned"
              }
              detail="Primary allocation"
            />
            <StatCard label="Uptime" value={`${selectedServer()!.uptimeSeconds}s`} detail="Runtime lifecycle" />
            <StatCard
              label="CPU Load"
              value={formatPercent(currentServerMetric()?.values.cpuPercent)}
              detail={`${selectedServer()!.limits.cpuPercent}% limit`}
            />
            <StatCard
              label="Memory"
              value={formatMegabytes(currentServerMetric()?.values.memoryUsedMb)}
              detail={`${selectedServer()!.limits.memoryMb} MB limit`}
            />
            <StatCard
              label="Disk"
              value={formatMegabytes(currentServerMetric()?.values.diskUsedMb)}
              detail={`${selectedServer()!.limits.diskMb} MB limit`}
            />
            <StatCard label="Network In" value={formatMegabytes(currentServerMetric()?.values.networkInMb)} detail="Inbound" tone="success" />
            <StatCard label="Network Out" value={formatMegabytes(currentServerMetric()?.values.networkOutMb)} detail="Outbound" />
            <StatCard
              label="Crashes"
              value={selectedServer()!.crashCount}
              detail={selectedServer()!.lastCrashAt ?? "No crash events"}
              tone={selectedServer()!.crashCount > 0 ? "warning" : "neutral"}
            />
          </div>

          <div class="metrics-grid">
            <Card compact title="CPU Pressure" subtitle="Current usage against the configured limit">
              <ProgressBar
                label={`${currentServerMetric()?.values.cpuPercent ?? 0}% of ${selectedServer()!.limits.cpuPercent}%`}
                value={usagePercent(currentServerMetric()?.values.cpuPercent, selectedServer()!.limits.cpuPercent)}
                tone={usagePercent(currentServerMetric()?.values.cpuPercent, selectedServer()!.limits.cpuPercent) > 85 ? "warning" : "primary"}
              />
            </Card>
            <Card compact title="Memory Pressure" subtitle="Live memory consumption">
              <ProgressBar
                label={`${Math.round(currentServerMetric()?.values.memoryUsedMb ?? 0)} MB of ${selectedServer()!.limits.memoryMb} MB`}
                value={usagePercent(currentServerMetric()?.values.memoryUsedMb, selectedServer()!.limits.memoryMb)}
                tone={usagePercent(currentServerMetric()?.values.memoryUsedMb, selectedServer()!.limits.memoryMb) > 85 ? "warning" : "success"}
              />
            </Card>
            <Card compact title="Disk Pressure" subtitle="Writable volume occupancy">
              <ProgressBar
                label={`${Math.round(currentServerMetric()?.values.diskUsedMb ?? 0)} MB of ${selectedServer()!.limits.diskMb} MB`}
                value={usagePercent(currentServerMetric()?.values.diskUsedMb, selectedServer()!.limits.diskMb)}
                tone={usagePercent(currentServerMetric()?.values.diskUsedMb, selectedServer()!.limits.diskMb) > 90 ? "danger" : "primary"}
              />
            </Card>
          </div>

          <TabNav
            tabs={workspaceSections}
            active={workspaceSection}
            on:change={(event) => (workspaceSection = event.detail as WorkspaceSection)}
          />

          {#if workspaceSection === "console"}
            <Card tone="console" compact title="Live Console" subtitle="ANSI output, command history, and command input">
              <div class="console-toolbar">
                <input placeholder="Search console output" bind:value={consoleSearch} />
                <label class="checkbox"><input type="checkbox" bind:checked={autoScroll} /> Auto-scroll</label>
                <ActionButton variant="ghost" on:click={() => (consoleLines = [])}>Clear</ActionButton>
                <ActionButton
                  variant="ghost"
                  on:click={async () => {
                    const latestError = [...consoleLines].reverse().find((line) => /error|fail|exception/i.test(line));
                    if (latestError && navigator.clipboard) {
                      await navigator.clipboard.writeText(latestError);
                    }
                  }}
                >
                  Copy Latest Error
                </ActionButton>
              </div>
              <div class="console">
                {#each consoleLines.filter((line) => !consoleSearch || line.toLowerCase().includes(consoleSearch.toLowerCase())) as line}
                  <pre>{line}</pre>
                {/each}
              </div>
              <div class="button-row">
                <input
                  placeholder="Enter command"
                  bind:value={consoleCommand}
                  on:keydown={(event) => event.key === "Enter" && void sendConsoleCommand()}
                />
                <ActionButton on:click={sendConsoleCommand}>Send Command</ActionButton>
              </div>
              {#if commandHistory.length}
                <div class="history">
                  {#each commandHistory as item}
                    <ActionButton variant="ghost" on:click={() => (consoleCommand = item)}>{item}</ActionButton>
                  {/each}
                </div>
              {/if}
            </Card>
          {:else if workspaceSection === "files"}
            <div class="two-column">
              <Card title="File Manager" subtitle={`Path: ${currentPath}`}>
                <div class="button-row">
                  <ActionButton variant="ghost" on:click={() => browseFiles(".")}>Root</ActionButton>
                  <ActionButton
                    variant="secondary"
                    on:click={() =>
                      api.servers.files
                        .createFolder(currentToken!, selectedServer()!.id, `${currentPath === "." ? "" : `${currentPath}/`}new-folder`)
                        .then(() => browseFiles(currentPath))}
                  >
                    New Folder
                  </ActionButton>
                  <input type="file" on:change={uploadFile} />
                </div>
                {#if serverFiles.length}
                  <div class="table-surface">
                    <div class="table-scroll">
                      <table class="lv-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th class="cell-numeric">Size</th>
                            <th>Modified</th>
                            <th class="cell-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each serverFiles as file}
                            <tr>
                              <td class="cell-mono">{file.name}</td>
                              <td>{file.isDirectory ? "Directory" : "File"}</td>
                              <td class="cell-numeric">{file.isDirectory ? "-" : formatBytes(file.size)}</td>
                              <td>{file.modifiedAt}</td>
                              <td class="cell-right">
                                <div class="button-row">
                                  <ActionButton variant="ghost" on:click={() => (file.isDirectory ? browseFiles(file.path) : openFile(file.path))}>
                                    {file.isDirectory ? "Open" : "Edit"}
                                  </ActionButton>
                                  {#if !file.isDirectory}
                                    <ActionButton variant="secondary" on:click={() => downloadFile(file.path)}>Download</ActionButton>
                                    <ActionButton variant="danger" on:click={() => confirmDeleteFile(file.path)}>Delete</ActionButton>
                                  {/if}
                                </div>
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                {:else}
                  <EmptyState title="Folder is empty" description="Upload files or create a folder to begin managing this workspace." />
                {/if}
              </Card>
              <Card title="Editor" subtitle={currentFilePath || "Select a file from the list"}>
                <textarea class="editor" bind:value={fileEditorContent}></textarea>
                <div class="button-row">
                  <ActionButton on:click={saveFile} disabled={!currentFilePath}>Save File</ActionButton>
                  <ActionButton
                    variant="danger"
                    disabled={!currentFilePath}
                    on:click={() => currentFilePath && confirmDeleteFile(currentFilePath)}
                  >
                    Delete File
                  </ActionButton>
                </div>
              </Card>
            </div>
          {:else if workspaceSection === "databases"}
            <Card title="Databases" subtitle="Database connections and environment-backed credentials">
              {#if selectedServer()!.environmentDefinitions.some((definition) => definition.key.toLowerCase().includes("db"))}
                <div class="table-surface">
                  <div class="table-scroll">
                    <table class="lv-table">
                      <thead>
                        <tr>
                          <th>Key</th>
                          <th>Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each selectedServer()!.environmentDefinitions.filter((definition) => definition.key.toLowerCase().includes("db")) as definition}
                          <tr>
                            <td><strong>{definition.displayName}</strong><small>{definition.key}</small></td>
                            <td class="cell-mono">{definition.secret ? "••••••••" : selectedServer()!.environment[definition.key] ?? definition.defaultValue ?? "unset"}</td>
                            <td><StatusBadge status="warning" label="Configurable" /></td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {:else}
                <EmptyState title="No databases configured" description="This workload does not expose database variables yet." />
              {/if}
            </Card>
          {:else if workspaceSection === "schedules"}
            <Card title="Schedules" subtitle="CRON tasks and runtime automation">
              {#if serverTasks.length}
                <div class="table-surface">
                  <div class="table-scroll">
                    <table class="lv-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Cron</th>
                          <th>Action</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each serverTasks as task}
                          <tr>
                            <td><strong>{task.name}</strong></td>
                            <td class="cell-mono">{task.cron}</td>
                            <td>{task.actionType}</td>
                            <td><StatusBadge status={task.enabled ? "online" : "offline"} label={task.enabled ? "Enabled" : "Disabled"} /></td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {:else}
                <EmptyState title="No schedules configured" description="Create a recurring task for restarts, console commands, or maintenance workflows." />
              {/if}
            </Card>
          {:else if workspaceSection === "users"}
            <Card title="Users" subtitle="Delegated access for console and workspace operations">
              {#if serverMembers.length}
                <div class="table-surface">
                  <div class="table-scroll">
                    <table class="lv-table">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Permissions</th>
                          <th class="cell-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each serverMembers as member}
                          <tr>
                            <td><strong>{member.userId}</strong></td>
                            <td>{member.permissions.join(", ")}</td>
                            <td class="cell-right"><StatusBadge status="synced" label="Active" /></td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {:else}
                <EmptyState title="No users assigned" description="Add delegated members for console, files, backups, or schedule access." />
              {/if}
            </Card>
          {:else if workspaceSection === "backups"}
            <Card title="Backups" subtitle="Create, restore, download, and remove server snapshots">
              <div class="button-row">
                <ActionButton on:click={createBackup}>Create Backup</ActionButton>
              </div>
              {#if serverBackups.length}
                <div class="table-surface">
                  <div class="table-scroll">
                    <table class="lv-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Provider</th>
                          <th>Status</th>
                          <th class="cell-numeric">Size</th>
                          <th>Created</th>
                          <th class="cell-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each serverBackups as backup}
                          <tr>
                            <td><strong>{backup.name}</strong></td>
                            <td>{backup.provider.toUpperCase()}</td>
                            <td><StatusBadge status={backup.status} /></td>
                            <td class="cell-numeric">{formatBytes(backup.sizeBytes)}</td>
                            <td>{backup.createdAt}</td>
                            <td class="cell-right">
                              <div class="button-row">
                                <ActionButton variant="ghost" on:click={() => downloadBackup(backup.id)}>Download</ActionButton>
                                <ActionButton variant="secondary" on:click={() => restoreBackup(backup.id)}>Restore</ActionButton>
                                <ActionButton variant="danger" on:click={() => deleteBackup(backup.id)}>Delete</ActionButton>
                              </div>
                            </td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {:else}
                <EmptyState title="No backups available" description="Create your first backup to unlock restore and download operations." />
              {/if}
            </Card>
          {:else if workspaceSection === "network"}
            <div class="two-column">
              <Card title="Network" subtitle="Allocations, routes, firewall, and SFTP details">
                <div class="list">
                  <div class="list-row">
                    <div>
                      <strong>Primary Allocation</strong>
                      <small>{selectedServer()!.allocations[0] ? `${selectedServer()!.allocations[0].ip}:${selectedServer()!.allocations[0].port}` : "No allocation"}</small>
                    </div>
                    <StatusBadge status={selectedServer()!.allocations[0] ? "online" : "warning"} label={selectedServer()!.allocations[0] ? "Ready" : "Pending"} />
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>Domains</strong>
                      <small>{serverDomains.length ? `${serverDomains.length} mapped hostnames` : "No domain mappings yet"}</small>
                    </div>
                    <StatusBadge status={serverDomains.length ? "synced" : "warning"} label={serverDomains.length ? "Synced" : "Pending"} />
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>Firewall</strong>
                      <small>{serverFirewallRules.length ? `${serverFirewallRules.length} active rules` : "No rules configured"}</small>
                    </div>
                    <StatusBadge status={serverFirewallRules.length ? "synced" : "warning"} label={serverFirewallRules.length ? "Applied" : "Review"} />
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>SFTP</strong>
                      <small>{sftpCredential ? sftpCredential.username : "No credential generated"}</small>
                    </div>
                    <StatusBadge status={sftpCredential ? "online" : "warning"} label={sftpCredential ? "Ready" : "Missing"} />
                  </div>
                </div>
              </Card>
              <Card title="Route Controls" subtitle="Domain mappings and firewall state">
                {#if serverDomains.length}
                  <div class="table-surface">
                    <div class="table-scroll">
                      <table class="lv-table">
                        <thead>
                          <tr>
                            <th>Hostname</th>
                            <th>Target</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each serverDomains as mapping}
                            <tr>
                              <td><strong>{mapping.domain}</strong></td>
                              <td class="cell-mono">{mapping.targetPort}</td>
                              <td><StatusBadge status="synced" label="Synced" /></td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                {:else}
                  <EmptyState title="No route mappings" description="Create a hostname mapping to expose this server through Cloudflare or reverse proxy routing." />
                {/if}
              </Card>
            </div>
          {:else if workspaceSection === "startup"}
            <div class="two-column">
              <Card title="Startup" subtitle="Container image, launch command, and runtime limits">
                <div class="list">
                  <div class="list-row">
                    <div>
                      <strong>Docker Image</strong>
                      <small>{selectedServer()!.dockerImage}</small>
                    </div>
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>Startup Command</strong>
                      <small class="cell-mono">{selectedServer()!.startupCommand}</small>
                    </div>
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>Restart Policy</strong>
                      <small>{selectedServer()!.restartPolicy}</small>
                    </div>
                  </div>
                </div>
              </Card>
              <Card title="Resource Limits" subtitle="Provisioned capacity for this workload">
                <div class="metrics-grid">
                  <StatCard label="CPU" value={`${selectedServer()!.limits.cpuPercent}%`} detail="Provisioned limit" />
                  <StatCard label="Memory" value={`${selectedServer()!.limits.memoryMb.toLocaleString()} MB`} detail="Provisioned limit" />
                  <StatCard label="Disk" value={`${selectedServer()!.limits.diskMb.toLocaleString()} MB`} detail="Provisioned limit" />
                  <StatCard label="Primary Template" value={selectedServer()!.templateId ?? "n/a"} detail="Assigned blueprint" />
                </div>
              </Card>
            </div>
          {:else if workspaceSection === "settings"}
            <div class="two-column">
              <Card title="Environment" subtitle="Editable runtime variables">
                {#if selectedServer()!.environmentDefinitions.length}
                  <div class="table-surface">
                    <div class="table-scroll">
                      <table class="lv-table">
                        <thead>
                          <tr>
                            <th>Variable</th>
                            <th>Value</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each selectedServer()!.environmentDefinitions as definition}
                            <tr>
                              <td>
                                <strong>{definition.displayName}</strong>
                                <small>{definition.key}</small>
                              </td>
                              <td>
                                <input
                                  value={selectedServer()!.environment[definition.key] ?? definition.defaultValue ?? ""}
                                  on:input={(event) => {
                                    selectedServer()!.environment[definition.key] = (event.currentTarget as HTMLInputElement).value;
                                  }}
                                  type={definition.secret ? "password" : "text"}
                                />
                              </td>
                              <td>
                                <StatusBadge status={definition.required ? "warning" : "synced"} label={definition.required ? "Required" : "Optional"} />
                              </td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <ActionButton variant="secondary" on:click={() => void updateServerEnvironment()}>Save Environment</ActionButton>
                {:else}
                  <EmptyState title="No environment definitions" description="This template has no predefined environment variables." />
                {/if}
              </Card>
              <Card title="Danger Zone" subtitle="Lifecycle actions for the selected server">
                <div class="list">
                  <div class="list-row">
                    <div>
                      <strong>Suspend</strong>
                      <small>Block runtime activity until the workload is restored.</small>
                    </div>
                    <ActionButton variant="danger" on:click={() => powerServer("stop")}>Suspend</ActionButton>
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>Reinstall</strong>
                      <small>Rebuild the server container and redeploy its template.</small>
                    </div>
                    <ActionButton variant="secondary" on:click={() => powerServer("restart")}>Reinstall</ActionButton>
                  </div>
                  <div class="list-row">
                    <div>
                      <strong>Delete</strong>
                      <small>Remove the server and all linked runtime state.</small>
                    </div>
                    <ActionButton
                      variant="danger"
                      on:click={() =>
                        openConfirm({
                          title: "Delete server",
                          description: `Delete ${selectedServer()!.name} and all related runtime state? This cannot be undone.`,
                          confirmLabel: "Delete server",
                          danger: true,
                          onConfirm: async () => {
                            if (!currentToken || !selectedServer()) {
                              return;
                            }
                            await api.servers.remove(currentToken, selectedServer()!.id);
                            await loadAll(currentToken);
                            selectedServerId = servers[0]?.id ?? "";
                          },
                        })}
                    >
                      Delete
                    </ActionButton>
                  </div>
                </div>
              </Card>
            </div>
          {:else if workspaceSection === "activity"}
            <Card title="Activity" subtitle="Recent audit events and runtime changes">
              {#if auditLogs.length}
                <div class="table-surface">
                  <div class="table-scroll">
                    <table class="lv-table">
                      <thead>
                        <tr>
                          <th>Action</th>
                          <th>Actor</th>
                          <th>Target</th>
                          <th class="cell-right">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each auditLogs.slice(0, 10) as log}
                          <tr>
                            <td><strong>{log.action}</strong></td>
                            <td class="cell-mono">{log.actorId}</td>
                            <td class="cell-mono">{log.targetType}:{log.targetId}</td>
                            <td class="cell-right">{log.createdAt}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                  </div>
                </div>
              {:else}
                <EmptyState title="No activity yet" description="Server actions and operator events will appear here over time." />
              {/if}
            </Card>
          {/if}
        {:else}
          <EmptyState
            title="No server selected"
            description="Pick one of your servers from the list to open its console, files, backups, and configuration tabs."
          />
        {/if}
      </section>
    </section>
  </main>
  {/if}
{/if}

<ConfirmDialog
  open={confirmState.open}
  title={confirmState.title}
  description={confirmState.description}
  confirmLabel={confirmState.confirmLabel}
  danger={confirmState.danger}
  loading={busyAction === confirmState.confirmLabel}
  on:cancel={closeConfirm}
  on:confirm={() => void executeConfirm()}
/>

<SecretRevealModal
  open={secretReveal.open}
  title={secretReveal.title}
  subtitle={secretReveal.subtitle}
  secret={secretReveal.secret}
  warning={secretReveal.warning}
  hint={secretReveal.hint}
  on:close={closeSecretReveal}
/>
