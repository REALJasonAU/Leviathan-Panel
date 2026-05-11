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

  let currentView: View = "overview";
  let serverSection: ServerSection = "console";
  let currentToken: string | null = null;
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
  let envImportText = "# Example service variables\nAPP_PORT=25565\nRCON_PASSWORD=\n";
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

  let createNodeForm = {
    name: "Sydney-01",
    region: "ap-southeast-2",
    publicAddress: "203.0.113.10",
    baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000",
    capabilities: "docker,backups,cloudflare-tunnel",
  };
  let createTemplateForm = {
    id: "tpl_custom_app",
    name: "Custom App",
    category: "docker",
    description: "Generic Docker workload template",
    dockerImages: "node:20-alpine",
    startupCommand: "npm start",
  };
  let createServerForm = {
    name: "Survival EU",
    description: "Primary survival workload",
    nodeId: "",
    templateId: "",
    dockerImage: "",
    allocationIp: "0.0.0.0",
    allocationPort: "25565",
    cpuPercent: "200",
    memoryMb: "4096",
    diskMb: "16384",
    startupCommand: "",
    environment: {} as Record<string, string>,
  };
  let createTaskForm = {
    name: "Nightly Restart",
    cron: "0 4 * * *",
    actionType: "power",
    powerAction: "restart",
    command: "say Scheduled maintenance",
  };
  let createRoleForm = {
    id: "support",
    name: "Support",
    permissions: "dashboard.view,servers.view,servers.console.view",
  };
  let createWebhookForm = {
    name: "Discord Alerts",
    url: "https://discord.com/api/webhooks/example",
    type: "discord",
    events: "server.create,server.power.start,node.rotate_token",
  };
  let apiKeyName = "Automation Key";
  let generatedApiKey = "";
  let subUserForm = { userId: "", permissions: "console.view,files.read" };
  let domainForm = { domain: "play.example.com", targetPort: "25565" };
  let firewallForm = {
    protocol: "tcp",
    port: "25565",
    source: "0.0.0.0/0",
    action: "allow",
  };
  let backupTargetForm = {
    name: "S3 Backups",
    endpoint: "",
    region: "us-east-1",
    bucket: "",
    accessKeyId: "",
    secretAccessKey: "",
    pathPrefix: "leviathan/backups",
    forcePathStyle: true,
  };
  let cloudflareRouteForm = {
    hostname: "play.example.com",
    service: "http://localhost:25565",
    tunnelId: "",
    zoneId: "",
  };
  let topSearchValue = "";
  let serverListMode: "cards" | "table" = "cards";
  let selectedServerRecord: ServerRecord | null = null;
  let currentViewTitle = "Overview";
  let currentViewSubtitle = "";
  let activeTopBreadcrumbs: Array<{ label: string; key?: string }> = [];
  let activePageBreadcrumbs: Array<{ label: string; href?: string; key?: string }> = [];
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
        (me.permissions.includes("*") || me.permissions.includes(permission)),
    );

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

    if (firstError?.status === "rejected") {
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
    if (can("users.view")) {
      tasks.push(api.admin.users(token).then((value) => (users = value)));
    }
    if (can("roles.view")) {
      tasks.push(api.admin.roles(token).then((value) => (roles = value)));
    }
    if (can("audit.view")) {
      tasks.push(api.admin.auditLogs(token).then((value) => (auditLogs = value)));
    }
    if (can("settings.view")) {
      tasks.push(api.admin.settings.get(token).then((value) => (settings = value)));
    }
    if (can("apiKeys.view")) {
      tasks.push(api.admin.apiKeys.list(token).then((value) => (apiKeys = value)));
    }
    if (can("webhooks.view")) {
      tasks.push(api.admin.webhooks.list(token).then((value) => (webhooks = value)));
      tasks.push(api.admin.webhookDeliveries(token).then((value) => (webhookDeliveries = value)));
    }
    if (can("backupTargets.view")) {
      tasks.push(api.admin.backupTargets.list(token).then((value) => (backupTargets = value)));
    }
    if (can("alerts.view")) {
      tasks.push(api.admin.alerts.events(token).then((value) => (alertEvents = value)));
    }
    if (can("tasks.view")) {
      tasks.push(api.admin.jobs(token).then((value) => (jobs = value)));
    }
    if (can("integrations.view")) {
      tasks.push(api.admin.plugins.list(token).then((value) => (plugins = value)));
      tasks.push(api.admin.cloudflare.routes(token).then((value) => (cloudflareRoutes = value)));
    }
    await Promise.all(tasks);
  };

  const loadAll = async (token: string) => {
    loading = true;
    error = "";
    try {
      const nextMe = await api.me(token);
      me = nextMe;

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
    } catch (loadError) {
      error = loadError instanceof Error ? parseApiError(loadError.message) : "Failed to load dashboard";
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
    currentView = "servers";
    serverSection = "console";
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
    if (!currentToken || !selectedServer() || serverSection !== "console") {
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

  const createApiKey = async () => {
    if (!currentToken) {
      return;
    }
    const result = await api.admin.apiKeys.create(currentToken, apiKeyName, [
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
    const matchingView = views.find(
      (view) =>
        view.label.toLowerCase().includes(query) ||
        view.id.toLowerCase().includes(query),
    );
    if (matchingView) {
      navigateToView(matchingView.id);
    }
  };

  const openNotifications = () => {
    navigateToView("alerts");
  };

  const openProfile = () => {
    navigateToView("settings");
  };

  const currentServerMetric = () =>
    serverMetrics.length ? serverMetrics[serverMetrics.length - 1] : null;

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

  $: currentViewTitle =
    views.find((view) => view.id === currentView)?.label ?? "Overview";

  $: currentViewSubtitle = pageDescriptions[currentView];

  $: sidebarStatusLabel = formatNodeCount();

  $: sidebarStatusVariant = sidebarStatusTone();

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

  $: if (selectedServerId && currentToken && currentView === "servers") {
    void loadServerDetailData(selectedServerId);
  }

  $: if (currentView === "servers" && serverSection === "console" && currentToken && selectedServer()) {
    connectConsole();
  }

  onMount(() => {
    setViewFromHash();
    session.init();
    window.addEventListener("hashchange", setViewFromHash);

    const unsubscribe = session.subscribe(async (value) => {
      currentToken = value.token;
      if (value.token) {
        await loadAll(value.token);
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
      <div class="auth-actions">
        <button on:click={() => session.signInGoogle()}>Sign in with Google</button>
        <button class="ghost" on:click={() => session.useMockAdmin()}>Use Mock Admin</button>
        <button class="ghost" on:click={() => session.useMockUser()}>Use Mock User</button>
      </div>
    </div>
  </main>
{:else}
  <AppShell>
    <svelte:fragment slot="sidebar">
      <SidebarNav
        groups={sidebarGroups}
        activeId={currentView}
        brand="Leviathan"
        brandTagline="Control Plane"
        statusLabel={sidebarStatusLabel}
        statusTone={sidebarStatusVariant}
        on:navigate={(event) => navigateToView(event.detail)}
      />
      <div class="sidebar-footer">
        <p>{me?.user.displayName}</p>
        <small>{me?.user.email ?? "Mock session"}</small>
      </div>
    </svelte:fragment>

    <svelte:fragment slot="header">
      <TopHeader
        title="Leviathan Operations"
        subtitle="Premium infrastructure controls with Firebase-backed identity and daemon runtime telemetry."
        breadcrumbs={activeTopBreadcrumbs}
        bind:searchValue={topSearchValue}
        on:search={(event) => void handleHeaderSearch(event.detail)}
        on:notifications={openNotifications}
        on:profile={openProfile}
      >
        <svelte:fragment slot="actions">
          <button class="ghost" on:click={() => session.signOut()}>Sign Out</button>
        </svelte:fragment>
      </TopHeader>
    </svelte:fragment>

    <section class="content">
      <PageHeader
        title={currentViewTitle}
        description={currentViewSubtitle}
        breadcrumbs={activePageBreadcrumbs}
      >
        <svelte:fragment slot="actions">
          {#if currentView === "nodes"}
            <ActionButton
              variant="secondary"
              on:click={() => focusCreateSurface("nodes", "create-node-surface")}
            >
              Create Node
            </ActionButton>
          {/if}
          {#if currentView === "users"}
            <ActionButton variant="ghost" on:click={() => navigateToView("roles")}>Open Roles</ActionButton>
          {/if}
          {#if currentView === "roles"}
            <ActionButton
              variant="secondary"
              on:click={() => focusCreateSurface("roles", "create-role-surface")}
            >
              Create Role
            </ActionButton>
          {/if}
          {#if currentView === "api-keys"}
            <ActionButton
              variant="secondary"
              on:click={() => focusCreateSurface("api-keys", "create-api-key-surface")}
            >
              Create API Key
            </ActionButton>
          {/if}
          {#if currentView === "audit-logs"}
            <ActionButton variant="ghost" on:click={() => navigateToView("alerts")}>Open Alerts</ActionButton>
          {/if}
          {#if currentView === "jobs"}
            <ActionButton variant="ghost" on:click={() => navigateToView("scheduled-tasks")}>Open Schedules</ActionButton>
          {/if}
          {#if currentView === "servers" && selectedServer()}
            <StatusBadge status={selectedServer()!.status} />
          {/if}
        </svelte:fragment>
      </PageHeader>
      {#if error}
        <p class="inline-error">{error}</p>
      {/if}

      {#if loading}
        <LoadingState
          title="Loading Leviathan workspace"
          description="Pulling nodes, servers, templates, and control-plane telemetry into the command deck."
        />
      {/if}

      {#if currentView === "overview" && dashboard}
        <div class="stats-grid">
          <StatCard label="Total Servers" value={servers.length} detail="Assigned workloads" />
          <StatCard label="Online" value={servers.filter((server) => server.status === "running").length} detail="Running workloads" tone="success" />
          <StatCard label="Offline" value={servers.filter((server) => ["offline", "stopped"].includes(server.status)).length} detail="Not serving traffic" tone="warning" />
          <StatCard label="Suspended" value={servers.filter((server) => server.suspended).length} detail="Access-restricted workloads" tone="danger" />
          <StatCard label="Fleet CPU Limit" value={`${servers.reduce((sum, server) => sum + server.limits.cpuPercent, 0)}%`} detail="Configured cap" />
          <StatCard label="Fleet RAM Limit" value={`${servers.reduce((sum, server) => sum + server.limits.memoryMb, 0).toLocaleString()} MB`} detail="Configured cap" />
          <StatCard label="Fleet Disk Limit" value={`${servers.reduce((sum, server) => sum + server.limits.diskMb, 0).toLocaleString()} MB`} detail="Configured cap" />
        </div>

        <div class="three-column">
          <Card title="Quick Actions" subtitle="Move straight to frequent server-management workflows">
            <div class="button-row">
              <ActionButton on:click={() => navigateToView("servers")}>Create Server</ActionButton>
              <ActionButton variant="secondary" on:click={() => { navigateToView("servers"); serverSection = "backups"; }}>
                View Backups
              </ActionButton>
              <ActionButton
                variant="ghost"
                on:click={async () => {
                  navigateToView("servers");
                  serverSection = "console";
                  if (selectedServerId) {
                    await selectServer(selectedServerId);
                  }
                }}
              >
                Open Console
              </ActionButton>
            </div>
            <div class="list">
              <div class="list-row">
                <div>
                  <strong>Node Reachability</strong>
                  <small>{nodes.filter((node) => node.status === "online").length}/{nodes.length} daemon nodes online</small>
                </div>
                <StatusBadge status={nodes.some((node) => node.status === "offline") ? "warning" : "online"} label={nodes.some((node) => node.status === "offline") ? "Degraded" : "Healthy"} />
              </div>
              <div class="list-row">
                <div>
                  <strong>Open Alerts</strong>
                  <small>{alertEvents.filter((alert) => alert.status === "open").length} unacknowledged events</small>
                </div>
                <StatusBadge status={alertEvents.some((alert) => alert.status === "open") ? "warning" : "online"} label={alertEvents.some((alert) => alert.status === "open") ? "Action Needed" : "Clear"} />
              </div>
              <div class="list-row">
                <div>
                  <strong>Recent Crashes</strong>
                  <small>{servers.filter((server) => server.crashCount > 0).length} workloads with crash history</small>
                </div>
                <StatusBadge status={servers.some((server) => server.crashCount > 0) ? "warning" : "online"} label={servers.some((server) => server.crashCount > 0) ? "Review" : "Stable"} />
              </div>
            </div>
          </Card>

          <Card title="Recent Activity" subtitle="Latest operational actions and events">
            {#if auditLogs.length}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th class="cell-right">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each auditLogs.slice(0, 6) as log}
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
              <EmptyState title="No recent activity" description="Runtime actions and admin events will appear here as you manage workloads." />
            {/if}
          </Card>

          <Card title="Alerts" subtitle="Thresholds, failures, and safety events">
            {#if alertEvents.length}
              <div class="list">
                {#each alertEvents.slice(0, 6) as alert}
                  <div class="list-row">
                    <div>
                      <strong>{alert.type}</strong>
                      <small>{alert.message}</small>
                    </div>
                    <StatusBadge status={alert.status === "open" ? "warning" : "online"} label={alert.status} />
                  </div>
                {/each}
              </div>
            {:else}
              <EmptyState title="No active alerts" description="Leviathan will surface node and server incidents here when they occur." />
            {/if}
          </Card>
        </div>

        <Card title="Recent Servers" subtitle="Operational posture across your newest workloads">
          {#if servers.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Server</th>
                      <th>Status</th>
                      <th>Node</th>
                      <th>Allocation</th>
                      <th class="cell-numeric">CPU</th>
                      <th class="cell-numeric">RAM</th>
                      <th class="cell-numeric">Disk</th>
                      <th class="cell-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each servers.slice(0, 8) as server}
                      <tr>
                        <td>
                          <strong>{server.name}</strong>
                          <small>{server.templateId}</small>
                        </td>
                        <td><StatusBadge status={server.status} /></td>
                        <td class="cell-mono">{server.nodeId}</td>
                        <td class="cell-mono">{server.allocations[0] ? `${server.allocations[0].ip}:${server.allocations[0].port}` : "unassigned"}</td>
                        <td class="cell-numeric">{server.limits.cpuPercent}%</td>
                        <td class="cell-numeric">{server.limits.memoryMb.toLocaleString()} MB</td>
                        <td class="cell-numeric">{server.limits.diskMb.toLocaleString()} MB</td>
                        <td class="cell-right">
                          <div class="button-row">
                            <ActionButton variant="ghost" on:click={() => selectServer(server.id)}>Open</ActionButton>
                            <ActionButton variant="secondary" on:click={() => powerServerById(server.id, "restart")}>Restart</ActionButton>
                          </div>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No servers provisioned yet" description="Create a server from a template to unlock console, files, backups, and runtime controls." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "servers"}
        <div class="stats-grid">
          <StatCard label="Servers" value={servers.length} detail="Total managed workloads" />
          <StatCard label="Running" value={servers.filter((server) => server.status === "running").length} detail="Live runtime containers" tone="success" />
          <StatCard label="Starting/Stopping" value={servers.filter((server) => ["starting", "stopping"].includes(server.status)).length} detail="Transitioning runtime state" tone="warning" />
          <StatCard label="Suspended" value={servers.filter((server) => server.suspended).length} detail="Restricted workloads" tone="danger" />
        </div>

        <div class="two-column">
          <Card title="Server Inventory" subtitle="Switch between compact card and table layout">
            <svelte:fragment slot="actions">
              <div class="button-row">
                <ActionButton
                  variant={serverListMode === "cards" ? "secondary" : "ghost"}
                  on:click={() => (serverListMode = "cards")}
                >
                  Cards
                </ActionButton>
                <ActionButton
                  variant={serverListMode === "table" ? "secondary" : "ghost"}
                  on:click={() => (serverListMode = "table")}
                >
                  Table
                </ActionButton>
              </div>
            </svelte:fragment>
            {#if servers.length}
              {#if serverListMode === "cards"}
                <div class="list">
                  {#each servers as server}
                    <div class="list-row server-row-card">
                      <button class:selected={selectedServerId === server.id} class="server-list-item" on:click={() => selectServer(server.id)}>
                        <div>
                          <strong>{server.name}</strong>
                          <small>{server.allocations[0] ? `${server.allocations[0].ip}:${server.allocations[0].port}` : "No allocation"} • {server.nodeId}</small>
                        </div>
                        <StatusBadge status={server.status} />
                      </button>
                      <span class={`status-strip status-strip-${serverStripTone(server.status)}`} aria-hidden="true"></span>
                      <div class="button-row">
                        <ActionButton variant="ghost" on:click={() => powerServerById(server.id, "start")}>Start</ActionButton>
                        <ActionButton variant="ghost" on:click={() => powerServerById(server.id, "restart")}>Restart</ActionButton>
                        <ActionButton variant="ghost" on:click={() => powerServerById(server.id, "stop")}>Stop</ActionButton>
                        <ActionButton variant="secondary" on:click={() => selectServer(server.id)}>Console</ActionButton>
                      </div>
                    </div>
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
                          <th class="cell-numeric">CPU</th>
                          <th class="cell-numeric">RAM</th>
                          <th class="cell-numeric">Disk</th>
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
                            <td>
                              <div class="status-with-strip">
                                <span class={`status-strip status-strip-${serverStripTone(server.status)}`} aria-hidden="true"></span>
                                <StatusBadge status={server.status} />
                              </div>
                            </td>
                            <td class="cell-mono">{server.nodeId}</td>
                            <td class="cell-mono">{server.allocations[0] ? `${server.allocations[0].ip}:${server.allocations[0].port}` : "No allocation"}</td>
                            <td class="cell-numeric">{server.limits.cpuPercent}%</td>
                            <td class="cell-numeric">{server.limits.memoryMb.toLocaleString()} MB</td>
                            <td class="cell-numeric">{server.limits.diskMb.toLocaleString()} MB</td>
                            <td class="cell-right">
                              <div class="button-row">
                                <ActionButton variant="ghost" on:click={() => selectServer(server.id)}>Open</ActionButton>
                                <ActionButton variant="secondary" on:click={() => powerServerById(server.id, "restart")}>Restart</ActionButton>
                                <ActionButton variant="danger" on:click={() => powerServerById(server.id, "stop")}>Stop</ActionButton>
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
              <EmptyState title="No workloads in the fleet" description="Create a server from a template to unlock console, files, backups, network, and environment controls." />
            {/if}
          </Card>

          <Card title="Create Server" subtitle="Template-aware provisioning with environment defaults">
            <div class="form-grid">
              <label>Name<input bind:value={createServerForm.name} /></label>
              <label>Description<input bind:value={createServerForm.description} /></label>
              <label>
                Template
                <select bind:value={createServerForm.templateId} on:change={(event) => applyTemplateDefaults((event.currentTarget as HTMLSelectElement).value)}>
                  {#each templates as template}
                    <option value={template.id}>{template.name}</option>
                  {/each}
                </select>
              </label>
              <label>
                Node
                <select bind:value={createServerForm.nodeId}>
                  {#each nodes as node}
                    <option value={node.id}>{node.name}</option>
                  {/each}
                </select>
              </label>
              <label>Docker Image<input bind:value={createServerForm.dockerImage} /></label>
              <label>Startup Command<input bind:value={createServerForm.startupCommand} /></label>
              <label>Allocation IP<input bind:value={createServerForm.allocationIp} /></label>
              <label>Allocation Port<input bind:value={createServerForm.allocationPort} /></label>
              <label>CPU %<input bind:value={createServerForm.cpuPercent} /></label>
              <label>Memory MB<input bind:value={createServerForm.memoryMb} /></label>
              <label>Disk MB<input bind:value={createServerForm.diskMb} /></label>
            </div>
            <div class="env-editor">
              {#each Object.entries(createServerForm.environment) as [key, value]}
                <label>{key}<input value={value} on:input={(event) => (createServerForm.environment[key] = (event.currentTarget as HTMLInputElement).value)} /></label>
              {/each}
            </div>
            <ActionButton on:click={createServer}>Create Server</ActionButton>
            {#if validationErrors.length}
              <div class="validation-list">
                {#each validationErrors as item}
                  <p>{item.key}: {item.message}</p>
                {/each}
              </div>
            {/if}
          </Card>
        </div>

        {#if selectedServer()}
          <Card title={selectedServer()!.name} subtitle={selectedServer()!.description ?? selectedServer()!.dockerImage}>
            <svelte:fragment slot="actions">
              <div class="button-row">
                <StatusBadge status={selectedServer()!.status} />
                <ActionButton on:click={() => powerServer("start")}>Start</ActionButton>
                <ActionButton variant="secondary" on:click={() => powerServer("restart")}>Restart</ActionButton>
                <ActionButton variant="secondary" on:click={() => powerServer("stop")}>Stop</ActionButton>
                <ActionButton variant="danger" on:click={() => powerServer("kill")}>Kill</ActionButton>
              </div>
            </svelte:fragment>

            <p class="muted">Servers / {selectedServer()!.name} / {serverSection}</p>

            <div class="metrics-grid">
              <StatCard label="Address" value={selectedServer()!.allocations[0] ? `${selectedServer()!.allocations[0].ip}:${selectedServer()!.allocations[0].port}` : "unassigned"} detail="Primary allocation" />
              <StatCard label="Uptime" value={`${selectedServer()!.uptimeSeconds}s`} detail="Current lifecycle" />
              <StatCard label="CPU Load" value={formatPercent(currentServerMetric()?.values.cpuPercent)} detail={`${selectedServer()!.limits.cpuPercent}% limit`} />
              <StatCard label="Memory" value={formatMegabytes(currentServerMetric()?.values.memoryUsedMb)} detail={`${selectedServer()!.limits.memoryMb} MB limit`} />
              <StatCard label="Disk" value={formatMegabytes(currentServerMetric()?.values.diskUsedMb)} detail={`${selectedServer()!.limits.diskMb} MB limit`} />
              <StatCard label="Network In" value={formatMegabytes(currentServerMetric()?.values.networkInMb)} detail="Inbound throughput" tone="success" />
              <StatCard label="Network Out" value={formatMegabytes(currentServerMetric()?.values.networkOutMb)} detail="Outbound throughput" />
              <StatCard label="Crashes" value={selectedServer()!.crashCount} detail={selectedServer()!.lastCrashAt ?? "No crash events"} tone={selectedServer()!.crashCount > 0 ? "warning" : "neutral"} />
            </div>

            <div class="metrics-grid">
              <Card compact title="CPU Pressure" subtitle="Current usage against provisioned limit">
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
              tabs={serverSections}
              active={serverSection}
              on:change={(event) => (serverSection = event.detail as ServerSection)}
            />

            {#if serverSection === "console"}
              <Card tone="console" compact title="Live Console" subtitle="ANSI output stream, command history, and runtime command input">
                <div class="console-toolbar">
                  <input placeholder="Search console output" bind:value={consoleSearch} />
                  <label class="checkbox"><input type="checkbox" bind:checked={autoScroll} /> Auto-scroll</label>
                  <ActionButton variant="ghost" on:click={() => (consoleLines = [])}>Clear</ActionButton>
                  <ActionButton
                    variant="ghost"
                    on:click={async () => {
                      const latestError = [...consoleLines]
                        .reverse()
                        .find((line) => /error|fail|exception/i.test(line));
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
            {/if}

            {#if serverSection === "files"}
              <div class="two-column">
                <Card title="File Manager" subtitle={`Path: ${currentPath}`}>
                  <div class="button-row">
                    <ActionButton variant="ghost" on:click={() => browseFiles(".")}>Root</ActionButton>
                    <ActionButton
                      variant="secondary"
                      on:click={() =>
                        api.servers.files
                          .createFolder(
                            currentToken!,
                            selectedServer()!.id,
                            `${currentPath === "." ? "" : `${currentPath}/`}new-folder`,
                          )
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
                                    <ActionButton
                                      variant="ghost"
                                      on:click={() =>
                                        file.isDirectory
                                          ? browseFiles(file.path)
                                          : openFile(file.path)}
                                    >
                                      {file.isDirectory ? "Open" : "Edit"}
                                    </ActionButton>
                                    {#if !file.isDirectory}
                                      <ActionButton
                                        variant="secondary"
                                        on:click={() => downloadFile(file.path)}
                                      >
                                        Download
                                      </ActionButton>
                                      <ActionButton
                                        variant="danger"
                                        on:click={() => confirmDeleteFile(file.path)}
                                      >
                                        Delete
                                      </ActionButton>
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
            {/if}

            {#if serverSection === "backups"}
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
            {/if}

            {#if serverSection === "schedules"}
              <div class="two-column">
                <Card title="Create Schedule" subtitle="CRON-driven command and power tasks">
                  <div class="form-grid">
                    <label>Name<input bind:value={createTaskForm.name} /></label>
                    <label>CRON<input bind:value={createTaskForm.cron} /></label>
                    <label>
                      Action
                      <select bind:value={createTaskForm.actionType}>
                        <option value="power">Power Action</option>
                        <option value="command">Console Command</option>
                      </select>
                    </label>
                    {#if createTaskForm.actionType === "power"}
                      <label>
                        Power Action
                        <select bind:value={createTaskForm.powerAction}>
                          <option value="restart">Restart</option>
                          <option value="start">Start</option>
                          <option value="stop">Stop</option>
                          <option value="kill">Kill</option>
                        </select>
                      </label>
                    {:else}
                      <label>Command<input bind:value={createTaskForm.command} /></label>
                    {/if}
                  </div>
                  <ActionButton on:click={createTask}>Create Schedule</ActionButton>
                </Card>
                <Card title="Scheduled Tasks" subtitle="Next actions and immediate run controls">
                  {#if serverTasks.length}
                    <div class="list">
                      {#each serverTasks as task}
                        <div class="list-row">
                          <div>
                            <strong>{task.name}</strong>
                            <small>{task.cron} • {task.action.type} • last run {task.lastRunAt ?? "never"}</small>
                          </div>
                          <div class="button-row">
                            <StatusBadge status={task.enabled ? "online" : "offline"} label={task.enabled ? "Enabled" : "Disabled"} />
                            <ActionButton variant="ghost" on:click={() => runTask(task.id)}>Run Now</ActionButton>
                          </div>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <EmptyState title="No schedules configured" description="Create a recurring task for restarts, console commands, or maintenance workflows." />
                  {/if}
                </Card>
              </div>
            {/if}

            {#if serverSection === "network"}
              <div class="two-column">
                <Card title="Domain Mapping" subtitle="Reverse-proxy routes and allocation overview">
                  <div class="form-grid">
                    <label>Domain<input bind:value={domainForm.domain} /></label>
                    <label>Target Port<input bind:value={domainForm.targetPort} /></label>
                  </div>
                  <div class="button-row">
                    <ActionButton on:click={createDomainMapping}>Map Domain</ActionButton>
                  </div>
                  {#if serverDomains.length}
                    <div class="table-surface">
                      <div class="table-scroll">
                        <table class="lv-table">
                          <thead>
                            <tr>
                              <th>Domain</th>
                              <th>Provider</th>
                              <th class="cell-numeric">Port</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each serverDomains as mapping}
                              <tr>
                                <td class="cell-mono">{mapping.domain}</td>
                                <td>{mapping.provider}</td>
                                <td class="cell-numeric">{mapping.targetPort}</td>
                                <td><StatusBadge status={mapping.enabled ? "synced" : "out-of-sync"} label={mapping.enabled ? "Enabled" : "Disabled"} /></td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  {:else}
                    <EmptyState title="No domain mappings" description="Add a hostname route to expose this server through your proxy provider." />
                  {/if}
                </Card>

                <Card title="Firewall + SFTP" subtitle="Port policies, daemon apply modes, and SFTP credentials">
                  <div class="form-grid">
                    <label>Protocol<select bind:value={firewallForm.protocol}><option value="tcp">TCP</option><option value="udp">UDP</option></select></label>
                    <label>Port<input bind:value={firewallForm.port} /></label>
                    <label>Source<input bind:value={firewallForm.source} /></label>
                    <label>Action<select bind:value={firewallForm.action}><option value="allow">Allow</option><option value="deny">Deny</option></select></label>
                  </div>
                  <div class="button-row">
                    <ActionButton variant="secondary" on:click={createFirewallRule}>Add Rule</ActionButton>
                    <ActionButton variant="ghost" on:click={() => applyFirewallRules(true)}>Dry Run</ActionButton>
                    <ActionButton
                      variant="danger"
                      on:click={() =>
                        openConfirm({
                          title: "Apply firewall rules",
                          description:
                            "Push the current firewall policy to the daemon node now? Incorrect rules can break connectivity.",
                          confirmLabel: "Apply rules",
                          danger: true,
                          onConfirm: async () => {
                            await applyFirewallRules(false);
                          },
                        })}
                    >
                      Apply
                    </ActionButton>
                  </div>
                  {#if serverFirewallRules.length}
                    <div class="list">
                      {#each serverFirewallRules as rule}
                        <div class="list-row">
                          <div>
                            <strong>{rule.action.toUpperCase()} {rule.protocol}/{rule.port}</strong>
                            <small>{rule.source}</small>
                          </div>
                          <StatusBadge status={rule.enabled ? "applied" : "warning"} label={rule.enabled ? "Enabled" : "Disabled"} />
                        </div>
                      {/each}
                    </div>
                  {/if}
                  {#if sftpCredential}
                    <div class="inline-warning">
                      <strong>SFTP access details</strong>
                      <p>
                        {sftpCredential.username}@{sftpCredential.host}:{sftpCredential.port}
                        {" · "}
                        {sftpCredential.rootPath}
                      </p>
                    </div>
                    <ActionButton variant="ghost" on:click={rotateSftp}>Rotate SFTP Credential</ActionButton>
                  {/if}
                </Card>
              </div>

              <Card title="Allocations" subtitle="Primary and secondary addresses assigned to this server">
                {#if selectedServer()!.allocations.length}
                  <div class="table-surface">
                    <div class="table-scroll">
                      <table class="lv-table">
                        <thead>
                          <tr>
                            <th>Address</th>
                            <th>Stack</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each selectedServer()!.allocations as allocation}
                            <tr>
                              <td class="cell-mono">{allocation.ip}:{allocation.port}</td>
                              <td>{allocation.ipv6 ?? "IPv4 only"}</td>
                              <td><StatusBadge status={allocation.primary ? "online" : "starting"} label={allocation.primary ? "Primary" : "Secondary"} /></td>
                            </tr>
                          {/each}
                        </tbody>
                      </table>
                    </div>
                  </div>
                {/if}
              </Card>
            {/if}

            {#if serverSection === "environment"}
              <Card title="Environment Variables" subtitle="Required and secret values are masked and validated before save">
                {#if selectedServer()!.environmentDefinitions.length}
                  <div class="table-surface">
                    <div class="table-scroll">
                      <table class="lv-table">
                        <thead>
                          <tr>
                            <th>Key</th>
                            <th>Value</th>
                            <th>Flags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {#each selectedServer()!.environmentDefinitions as definition}
                            <tr>
                              <td class="cell-mono">{definition.key}</td>
                              <td>
                                <input
                                  type={definition.secret ? "password" : "text"}
                                  value={selectedServer()!.environment[definition.key] ?? ""}
                                  readonly={definition.readonly}
                                  on:input={(event) => {
                                    const server = selectedServer();
                                    if (server) {
                                      server.environment[definition.key] = (event.currentTarget as HTMLInputElement).value;
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <div class="button-row">
                                  <StatusBadge status={definition.required ? "applied" : "dry-run"} label={definition.required ? "Required" : "Optional"} />
                                  {#if definition.secret}
                                    <StatusBadge status="warning" label="Secret" />
                                  {/if}
                                  {#if definition.readonly}
                                    <StatusBadge status="maintenance" label="Readonly" />
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
                  <EmptyState title="No environment definitions" description="This template has no predefined environment variables." />
                {/if}
                <div class="button-row">
                  <ActionButton on:click={updateServerEnvironment}>Save Environment</ActionButton>
                </div>
              </Card>
            {/if}

            {#if serverSection === "sub-users"}
              <div class="two-column">
                <Card title="Invite Sub-user" subtitle="Grant scoped access by user id and permission set">
                  <div class="form-grid">
                    <label>User ID<input bind:value={subUserForm.userId} /></label>
                    <label>Permissions<input bind:value={subUserForm.permissions} /></label>
                  </div>
                  <ActionButton on:click={addSubUser}>Add Sub-user</ActionButton>
                </Card>
                <Card title="Server Access" subtitle="Current delegated members and permission scopes">
                  {#if serverMembers.length}
                    <div class="list">
                      {#each serverMembers as member}
                        <div class="list-row">
                          <div>
                            <strong>{member.userId}</strong>
                            <small>{member.permissions.join(", ")}</small>
                          </div>
                          <ActionButton variant="danger" on:click={() => removeSubUser(member.userId)}>Remove</ActionButton>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <EmptyState title="No sub-users assigned" description="Add delegated members for console, files, backups, or schedule access." />
                  {/if}
                </Card>
              </div>
            {/if}

            {#if serverSection === "settings"}
              <div class="two-column">
                <Card title="Runtime Settings" subtitle="Startup, image, and resource posture for this workload">
                  <div class="form-grid">
                    <label>Startup Command<input value={selectedServer()!.startup.command} readonly /></label>
                    <label>Docker Image<input value={selectedServer()!.dockerImage} readonly /></label>
                    <label>CPU Limit<input value={`${selectedServer()!.limits.cpuPercent}%`} readonly /></label>
                    <label>Memory Limit<input value={`${selectedServer()!.limits.memoryMb} MB`} readonly /></label>
                    <label>Disk Limit<input value={`${selectedServer()!.limits.diskMb} MB`} readonly /></label>
                  </div>
                  <div class="metrics-grid">
                    <StatCard label="CPU" value={`${selectedServer()!.limits.cpuPercent}%`} detail="Assigned limit" />
                    <StatCard label="Memory" value={`${selectedServer()!.limits.memoryMb} MB`} detail="Assigned limit" />
                    <StatCard label="Disk" value={`${selectedServer()!.limits.diskMb} MB`} detail="Assigned limit" />
                    <StatCard label="Crashes" value={selectedServer()!.crashCount} detail="Tracked runtime faults" tone={selectedServer()!.crashCount > 0 ? "warning" : "neutral"} />
                  </div>
                </Card>
                <Card tone="danger" title="Danger Zone" subtitle="High-impact lifecycle controls for this server">
                  <div class="button-row">
                    <ActionButton
                      variant="danger"
                      on:click={() =>
                        openConfirm({
                          title: "Suspend runtime",
                          description: `Stop ${selectedServer()!.name} and leave the workload unavailable until it is started again.`,
                          confirmLabel: "Suspend runtime",
                          danger: true,
                          onConfirm: async () => {
                            await powerServer("stop");
                          },
                        })}
                    >
                      Suspend Runtime
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      on:click={() =>
                        openConfirm({
                          title: "Reinstall or restart workload",
                          description: `Restart ${selectedServer()!.name} now? Use this only when you are ready for a service interruption.`,
                          confirmLabel: "Restart workload",
                          danger: true,
                          onConfirm: async () => {
                            await powerServer("restart");
                          },
                        })}
                    >
                      Reinstall/Restart
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      on:click={() =>
                        openConfirm({
                          title: "Rebuild container",
                          description: `Kill and rebuild the container for ${selectedServer()!.name}? Active sessions will be dropped immediately.`,
                          confirmLabel: "Rebuild container",
                          danger: true,
                          onConfirm: async () => {
                            await powerServer("kill");
                          },
                        })}
                    >
                      Rebuild Container
                    </ActionButton>
                    <ActionButton variant="danger" disabled>Delete Server (Protected)</ActionButton>
                  </div>
                </Card>
              </div>
            {/if}
          </Card>
        {/if}
      {/if}

      {#if currentView === "nodes"}
        <div class="two-column">
          <Card title="Node Fleet" subtitle="Maintenance, metrics, and daemon configuration controls">
            {#if nodes.length}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Node</th>
                        <th>Region</th>
                        <th>Status</th>
                        <th>Daemon</th>
                        <th class="cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each nodes as node}
                        <tr>
                          <td>
                            <strong>{node.name}</strong>
                            <small>{node.publicAddress}</small>
                          </td>
                          <td>{node.region}</td>
                          <td>
                            <StatusBadge status={node.maintenanceMode ? "maintenance" : node.status} label={node.maintenanceMode ? "Maintenance" : node.status} />
                          </td>
                          <td>{node.daemonVersion ?? "unknown"}</td>
                          <td class="cell-right">
                            <div class="button-row">
                              <ActionButton variant="ghost" on:click={() => loadNodeConfig(node.id)}>Config</ActionButton>
                              <ActionButton variant="secondary" on:click={() => toggleNodeMaintenance(node)}>
                                {node.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else}
              <EmptyState title="No registered nodes" description="Create a node to generate a bootstrap token, then install the Leviathan daemon on the target Linux host." />
            {/if}
          </Card>
          <div id="create-node-surface" tabindex="-1">
            <Card title="Add Node" subtitle="Create installer credentials">
              <div class="form-grid">
                <label>Name<input bind:value={createNodeForm.name} /></label>
                <label>Region<input bind:value={createNodeForm.region} /></label>
                <label>Public Address<input bind:value={createNodeForm.publicAddress} /></label>
                <label>Panel Base URL<input bind:value={createNodeForm.baseUrl} /></label>
                <label>Capabilities<input bind:value={createNodeForm.capabilities} /></label>
              </div>
              <ActionButton on:click={createNode}>Create Node</ActionButton>
              {#if nodeBootstrapToken}
                <p class="muted">The latest bootstrap token was revealed in a one-time modal and should now be stored with your node deployment notes.</p>
              {/if}
              {#if selectedNodeConfig}
                <div class="token-box">
                  {#each Object.entries(selectedNodeConfig.env) as [key, value]}
                    <p>{key}={value}</p>
                  {/each}
                </div>
              {/if}
            </Card>
          </div>
        </div>

        {#if nodeMetrics.length}
          <Card title="Node Metrics" subtitle="Latest retained points">
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th class="cell-numeric">CPU</th>
                      <th class="cell-numeric">Memory</th>
                      <th class="cell-numeric">Disk Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each nodeMetrics as point}
                      <tr>
                        <td>{point.timestamp}</td>
                        <td class="cell-numeric">{Math.round(point.values.cpuPercent ?? 0)}%</td>
                        <td class="cell-numeric">{Math.round(point.values.memoryUsedMb ?? 0)} MB</td>
                        <td class="cell-numeric">{Math.round(point.values.diskUsedMb ?? 0)} MB</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        {/if}
      {/if}

      {#if currentView === "daemon-updates"}
        <div class="stats-grid">
          <StatCard label="Nodes Reporting" value={nodes.length} detail="Nodes with daemon registration" />
          <StatCard label="Latest Version Seen" value={latestDaemonVersion() ?? "unknown"} detail="Fleet-derived version baseline" tone="primary" />
          <StatCard label="Updates Needed" value={nodes.filter((node) => latestDaemonVersion() && node.daemonVersion && node.daemonVersion !== latestDaemonVersion()).length} detail="Nodes behind latest seen version" tone="warning" />
          <StatCard label="Maintenance Nodes" value={nodes.filter((node) => node.maintenanceMode).length} detail="Currently in maintenance mode" />
        </div>
        <Card title="Daemon Update Surface" subtitle="Fleet version posture without backend contract changes">
          {#if nodes.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Node</th>
                      <th>Current Version</th>
                      <th>Status</th>
                      <th>Update Posture</th>
                      <th class="cell-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each nodes as node}
                      <tr>
                        <td>
                          <strong>{node.name}</strong>
                          <small>{node.region} • {node.publicAddress}</small>
                        </td>
                        <td>{node.daemonVersion ?? "unknown"}</td>
                        <td><StatusBadge status={node.maintenanceMode ? "maintenance" : node.status} /></td>
                        <td>
                          {#if latestDaemonVersion() && node.daemonVersion && node.daemonVersion !== latestDaemonVersion()}
                            <StatusBadge status="warning" label="Update Available" />
                          {:else}
                            <StatusBadge status="online" label="Current" />
                          {/if}
                        </td>
                        <td class="cell-right">
                          <ActionButton variant="ghost" on:click={() => loadNodeConfig(node.id)}>View Config</ActionButton>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No daemon nodes available" description="Create and bootstrap a node to start collecting daemon version posture." />
          {/if}
          <div class="button-row">
            <ActionButton variant="secondary" on:click={() => navigateToView("nodes")}>Manage Nodes</ActionButton>
          </div>
        </Card>
      {/if}

      {#if currentView === "templates"}
        <div class="two-column">
          <Card title=".env.example Import Preview" subtitle="Parse required variables before saving">
            <textarea bind:value={envImportText} rows="12"></textarea>
            <div class="button-row">
              <ActionButton on:click={importEnvExample}>Parse Import</ActionButton>
            </div>
            <div class="env-preview">
              {#each previewDefinitions as definition}
                <div class="env-row">
                  <strong>{definition.key}</strong>
                  <small>{definition.description ?? definition.displayName}</small>
                  <StatusBadge status={definition.secret ? "warning" : "online"} label={definition.secret ? "Secret" : "Visible"} />
                </div>
              {/each}
            </div>
          </Card>
          <Card title="Create Template" subtitle="Images, startup, and env metadata">
            <div class="form-grid">
              <label>ID<input bind:value={createTemplateForm.id} /></label>
              <label>Name<input bind:value={createTemplateForm.name} /></label>
              <label>Category<input bind:value={createTemplateForm.category} /></label>
              <label>Description<input bind:value={createTemplateForm.description} /></label>
              <label>Docker Images<input bind:value={createTemplateForm.dockerImages} /></label>
              <label>Startup Command<input bind:value={createTemplateForm.startupCommand} /></label>
            </div>
            <ActionButton on:click={createTemplate}>Save Template</ActionButton>
          </Card>
        </div>
        <Card title="Existing Templates" subtitle="Environment-aware templates">
          {#if templates.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Template</th>
                      <th>Category</th>
                      <th>Docker Image</th>
                      <th class="cell-numeric">Env Vars</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each templates as template}
                      <tr>
                        <td>
                          <strong>{template.name}</strong>
                          <small>{template.description}</small>
                        </td>
                        <td><StatusBadge status="synced" label={template.category} /></td>
                        <td class="cell-mono">{template.dockerImages[0] ?? "n/a"}</td>
                        <td class="cell-numeric">{template.environmentDefinitions.length}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No templates saved yet" description="Import a .env.example and create a template to standardize your first workload build." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "users"}
        <Card title="Users" subtitle="Firebase-backed identities and role assignment">
          <div class="table-surface">
            <div class="table-scroll">
              <table class="lv-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role Assignment</th>
                    <th class="cell-center">2FA Required</th>
                    <th class="cell-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {#each users as user}
                    <tr>
                      <td>
                        <strong>{user.displayName}</strong>
                        <small>{user.email ?? user.uid}</small>
                      </td>
                      <td>
                        <select on:change={(event) => updateUserRole(user.uid, (event.currentTarget as HTMLSelectElement).value)}>
                          {#each roles as role}
                            <option value={role.id} selected={user.roleIds.includes(role.id)}>{role.name}</option>
                          {/each}
                        </select>
                      </td>
                      <td class="cell-center">
                        <StatusBadge status={user.twoFactorRequired ? "synced" : "warning"} label={user.twoFactorRequired ? "Enforced" : "Optional"} />
                      </td>
                      <td class="cell-center">
                        <StatusBadge status={user.disabled ? "offline" : "online"} label={user.disabled ? "Disabled" : "Active"} />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      {/if}

      {#if currentView === "roles"}
        <div class="two-column">
          <Card title="Roles" subtitle="Global permissions">
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>ID</th>
                      <th class="cell-numeric">Permissions</th>
                      <th class="cell-center">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each roles as role}
                      <tr>
                        <td>
                          <strong>{role.name}</strong>
                          <small>{role.permissions.join(", ") || "No permissions"}</small>
                        </td>
                        <td class="cell-mono">{role.id}</td>
                        <td class="cell-numeric">{role.permissions.length}</td>
                        <td class="cell-center">
                          <StatusBadge status={role.builtin ? "maintenance" : "online"} label={role.builtin ? "Built-in" : "Custom"} />
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
          <div id="create-role-surface" tabindex="-1">
            <Card title="Create Role" subtitle="Permission bundles for staff or automation">
              <div class="form-grid">
                <label>ID<input bind:value={createRoleForm.id} /></label>
                <label>Name<input bind:value={createRoleForm.name} /></label>
                <label>Permissions<input bind:value={createRoleForm.permissions} /></label>
              </div>
              <ActionButton on:click={createRole}>Create Role</ActionButton>
              <Card tone="danger" compact title="Privilege Warning" subtitle="Administrative permissions affect the entire control plane.">
                <p class="muted">Grant high-impact permissions only to trusted operators and automation clients.</p>
              </Card>
            </Card>
          </div>
        </div>
      {/if}

      {#if currentView === "backups"}
        <Card title="Backups" subtitle="Current selected server backups with provider and lifecycle controls">
          {#if serverBackups.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Backup</th>
                      <th>Provider</th>
                      <th>Status</th>
                      <th class="cell-numeric">Size</th>
                      <th class="cell-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each serverBackups as backup}
                      <tr>
                        <td>
                          <strong>{backup.name}</strong>
                          <small>{backup.createdAt}</small>
                        </td>
                        <td>{backup.provider.toUpperCase()}</td>
                        <td><StatusBadge status={backup.status} /></td>
                        <td class="cell-numeric">{formatBytes(backup.sizeBytes)}</td>
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
            <EmptyState title="No backups for current server" description="Create a backup from the server detail page and it will appear in this admin overview list." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "scheduled-tasks"}
        <Card title="Scheduled Tasks" subtitle="Cron-driven runtime operations for the selected server">
          {#if serverTasks.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Task</th>
                      <th>CRON</th>
                      <th>Action</th>
                      <th>Status</th>
                      <th class="cell-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each serverTasks as task}
                      <tr>
                        <td>
                          <strong>{task.name}</strong>
                          <small>Last run: {task.lastRunAt ?? "never"}</small>
                        </td>
                        <td class="cell-mono">{task.cron}</td>
                        <td>{task.action.type}</td>
                        <td><StatusBadge status={task.enabled ? "online" : "offline"} label={task.enabled ? "Enabled" : "Disabled"} /></td>
                        <td class="cell-right"><ActionButton variant="ghost" on:click={() => runTask(task.id)}>Run Now</ActionButton></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No scheduled tasks found" description="Create tasks from the server Schedules tab to automate power actions, commands, and backups." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "audit-logs"}
        <Card title="Audit Logs" subtitle="Sensitive actions with secret-safe metadata">
          <div class="table-surface">
            <div class="table-scroll">
              <table class="lv-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th class="cell-center">Type</th>
                    <th class="cell-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {#each auditLogs as log}
                    <tr>
                      <td><strong>{log.action}</strong></td>
                      <td class="cell-mono">{log.actorId}</td>
                      <td class="cell-mono">{log.targetType}:{log.targetId}</td>
                      <td class="cell-center"><StatusBadge status="synced" label={log.actorType} /></td>
                      <td class="cell-right">{log.createdAt}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      {/if}

      {#if currentView === "alerts"}
        <Card title="Alerts" subtitle="Open, acknowledged, and resolved runtime events">
          {#if alertEvents.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Alert</th>
                      <th>Scope</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th class="cell-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each alertEvents as alert}
                      <tr>
                        <td>
                          <strong>{alert.title}</strong>
                          <small>{alert.message}</small>
                        </td>
                        <td>{alert.scopeType}</td>
                        <td><StatusBadge status={alert.severity === "critical" ? "failed" : alert.severity === "warning" ? "warning" : "online"} label={alert.severity} /></td>
                        <td><StatusBadge status={alert.status} /></td>
                        <td class="cell-right">
                          {#if alert.status === "open"}
                            <ActionButton variant="secondary" on:click={() => acknowledgeAlert(alert.id)}>Acknowledge</ActionButton>
                          {/if}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No active alerts" description="Leviathan will surface crash events, node outages, and threshold triggers here." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "api-keys"}
        <div class="two-column">
          <div id="create-api-key-surface" tabindex="-1">
            <Card title="Create API Key" subtitle="Scoped automation credentials; raw secret is shown once">
              <label>API Key Name<input bind:value={apiKeyName} /></label>
              <div class="button-row">
                <ActionButton on:click={createApiKey}>Create API Key</ActionButton>
              </div>
              {#if generatedApiKey}
                <p class="muted">The latest API key was opened in the one-time secret modal and is now hidden from the page.</p>
              {/if}
            </Card>
          </div>
          <Card tone="danger" title="One-time Secret Warning" subtitle="Generated API key secrets cannot be shown again.">
            <p class="muted">Store the generated key immediately. Existing records only keep the key prefix and hash for security.</p>
          </Card>
        </div>
        <Card title="API Key Inventory" subtitle="Prefixes, scopes, expiry posture, and revoke state">
          {#if apiKeys.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Prefix</th>
                      <th>Scopes</th>
                      <th>Last Used</th>
                      <th>Status</th>
                      <th class="cell-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each apiKeys as key}
                      <tr>
                        <td><strong>{key.name}</strong></td>
                        <td class="cell-mono">{key.keyPrefix}</td>
                        <td><small>{key.scopes.join(", ") || "No scopes"}</small></td>
                        <td>{key.lastUsedAt ?? "never"}</td>
                        <td><StatusBadge status={key.revoked ? "revoked" : "online"} label={key.revoked ? "Revoked" : "Active"} /></td>
                        <td class="cell-right">
                          <ActionButton
                            variant="danger"
                            disabled={key.revoked}
                            on:click={() => revokeApiKey(key.id, key.name)}
                          >
                            Revoke
                          </ActionButton>
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No API keys created" description="Create a scoped automation key when you need external provisioning, scripts, or integration access." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "webhooks"}
        <div class="two-column">
          <Card title="Webhooks" subtitle="Signed generic and Discord deliveries">
            <div class="form-grid">
              <label>Webhook Name<input bind:value={createWebhookForm.name} /></label>
              <label>Webhook URL<input bind:value={createWebhookForm.url} /></label>
              <label>Events<input bind:value={createWebhookForm.events} /></label>
            </div>
            <ActionButton on:click={createWebhook}>Create Webhook</ActionButton>
            {#if webhooks.length}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Events</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each webhooks as webhook}
                        <tr>
                          <td><strong>{webhook.name}</strong></td>
                          <td>{webhook.type}</td>
                          <td><small>{webhook.events.join(", ")}</small></td>
                          <td><StatusBadge status={webhook.enabled ? "online" : "offline"} label={webhook.enabled ? "Enabled" : "Disabled"} /></td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else}
              <EmptyState title="No webhook endpoints" description="Create a webhook endpoint to receive provisioning and runtime events." />
            {/if}
          </Card>
          <Card title="Deliveries" subtitle="Persistent webhook delivery records">
            {#if webhookDeliveries.length}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Status</th>
                        <th class="cell-numeric">Attempts</th>
                        <th class="cell-right">HTTP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each webhookDeliveries as delivery}
                        <tr>
                          <td><strong>{delivery.event}</strong></td>
                          <td><StatusBadge status={delivery.status === "delivered" ? "applied" : delivery.status === "failed" ? "failed" : "starting"} label={delivery.status} /></td>
                          <td class="cell-numeric">{delivery.attempts}</td>
                          <td class="cell-right">{delivery.responseStatus ?? "pending"}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else}
              <EmptyState title="No deliveries recorded" description="Webhook delivery attempts and retry state will appear here." />
            {/if}
          </Card>
        </div>
      {/if}

      {#if currentView === "backup-targets"}
        <div class="two-column">
          <Card title="S3 Backup Target" subtitle="S3-compatible endpoint configuration">
            <div class="form-grid">
              <label>Name<input bind:value={backupTargetForm.name} /></label>
              <label>Endpoint<input bind:value={backupTargetForm.endpoint} /></label>
              <label>Region<input bind:value={backupTargetForm.region} /></label>
              <label>Bucket<input bind:value={backupTargetForm.bucket} /></label>
              <label>Access Key ID<input bind:value={backupTargetForm.accessKeyId} /></label>
              <label>Secret Access Key<input type="password" bind:value={backupTargetForm.secretAccessKey} /></label>
              <label>Path Prefix<input bind:value={backupTargetForm.pathPrefix} /></label>
            </div>
            <ActionButton on:click={createBackupTarget}>Create Target</ActionButton>
          </Card>
          <Card title="Targets" subtitle="Secrets are never returned to the browser">
            {#if backupTargets.length}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Target</th>
                        <th>Provider</th>
                        <th>Location</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each backupTargets as target}
                        <tr>
                          <td><strong>{target.name}</strong></td>
                          <td>{target.provider.toUpperCase()}</td>
                          <td class="cell-mono">{target.s3?.bucket ?? target.local?.basePath}</td>
                          <td><StatusBadge status={target.enabled ? "online" : "offline"} label={target.enabled ? "Enabled" : "Disabled"} /></td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else}
              <EmptyState title="No backup targets configured" description="Configure local or S3-compatible destinations for backup retention and restore flows." />
            {/if}
          </Card>
        </div>
      {/if}

      {#if currentView === "cloudflare"}
        <div class="two-column">
          <Card title="Cloudflare Route" subtitle="Create tunnel hostname routes and dry-run API changes">
            <div class="form-grid">
              <label>Hostname<input bind:value={cloudflareRouteForm.hostname} /></label>
              <label>Service<input bind:value={cloudflareRouteForm.service} /></label>
              <label>Tunnel ID<input bind:value={cloudflareRouteForm.tunnelId} /></label>
              <label>Zone ID<input bind:value={cloudflareRouteForm.zoneId} /></label>
            </div>
            <ActionButton on:click={createCloudflareRoute}>Create Route</ActionButton>
          </Card>
          <Card title="Routes" subtitle="Dry-run before applying Cloudflare changes">
            {#if cloudflareRoutes.length}
              <div class="table-surface">
                <div class="table-scroll">
                  <table class="lv-table">
                    <thead>
                      <tr>
                        <th>Hostname</th>
                        <th>Service</th>
                        <th>Tunnel</th>
                        <th>Status</th>
                        <th class="cell-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each cloudflareRoutes as route}
                        <tr>
                          <td class="cell-mono">{route.hostname}</td>
                          <td class="cell-mono">{route.service}</td>
                          <td class="cell-mono">{route.tunnelId}</td>
                          <td><StatusBadge status={route.enabled ? "synced" : "out-of-sync"} label={route.enabled ? "Enabled" : "Disabled"} /></td>
                          <td class="cell-right">
                            <div class="button-row">
                              <ActionButton variant="ghost" on:click={() => dryRunCloudflareRoute(route.id)}>Dry Run</ActionButton>
                              <ActionButton variant="secondary" on:click={() => syncCloudflareRoute(route.id)}>Apply</ActionButton>
                              <ActionButton variant="danger" on:click={() => deleteCloudflareRoute(route.id)}>Delete</ActionButton>
                            </div>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              </div>
            {:else}
              <EmptyState title="No Cloudflare routes configured" description="Create a hostname route, review the dry-run output, and then apply it when the zone and tunnel settings are ready." />
            {/if}
          </Card>
        </div>
      {/if}

      {#if currentView === "firewall"}
        <div class="two-column">
          <Card title="Firewall Policy" subtitle="Per-server rules are managed from each server Network page">
            <div class="list">
              <div class="list-row">
                <div>
                  <strong>Provider Status</strong>
                  <small>UFW and nftables provider abstractions are available on daemon nodes.</small>
                </div>
                <StatusBadge status="maintenance" label="Best Effort" />
              </div>
              <div class="list-row">
                <div>
                  <strong>Dry-run First</strong>
                  <small>Generate and review command plans before enforcing any rule changes.</small>
                </div>
                <StatusBadge status="dry-run" />
              </div>
            </div>
          </Card>
          <Card tone="danger" title="Danger Zone" subtitle="Firewall changes can break connectivity if applied incorrectly.">
            <p class="muted">Apply policies from the server Network surface with audited actions and controlled dry-run output.</p>
            <ActionButton variant="secondary" on:click={() => navigateToView("servers")}>Open Server Network Controls</ActionButton>
          </Card>
        </div>
      {/if}

      {#if currentView === "jobs"}
        <div class="stats-grid">
          <StatCard label="Pending" value={jobs.filter((job) => job.status === "pending").length} detail="Awaiting worker lock" />
          <StatCard label="Running" value={jobs.filter((job) => job.status === "running").length} detail="In-flight operations" tone="primary" />
          <StatCard label="Failed" value={jobs.filter((job) => job.status === "failed").length} detail="Retry candidates" tone="danger" />
          <StatCard label="Success" value={jobs.filter((job) => job.status === "success").length} detail="Completed jobs" tone="success" />
        </div>
        <Card title="Job Queue" subtitle="Scheduled task and background worker visibility">
          {#if jobs.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Job ID</th>
                      <th>Status</th>
                      <th class="cell-numeric">Attempts</th>
                      <th class="cell-right">Last Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each jobs as job}
                      <tr>
                        <td><strong>{job.type}</strong></td>
                        <td class="cell-mono">{job.id}</td>
                        <td><StatusBadge status={job.status} /></td>
                        <td class="cell-numeric">{job.attempts}/{job.maxAttempts}</td>
                        <td class="cell-right">{job.errorMessage ?? "none"}</td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No background jobs recorded" description="Queued task executions, retries, and worker activity will show up here as the control plane starts processing jobs." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "plugins"}
        <Card title="Plugins" subtitle="Trusted admin-installed extension manifests">
          {#if plugins.length}
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Plugin</th>
                      <th>ID</th>
                      <th>Version</th>
                      <th>Trust</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each plugins as plugin}
                      <tr>
                        <td><strong>{plugin.name}</strong></td>
                        <td class="cell-mono">{plugin.id}</td>
                        <td>{plugin.version}</td>
                        <td><StatusBadge status={plugin.trusted ? "synced" : "warning"} label={plugin.trusted ? "Trusted" : "Untrusted"} /></td>
                        <td><StatusBadge status={plugin.enabled ? "online" : "offline"} label={plugin.enabled ? "Enabled" : "Disabled"} /></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          {:else}
            <EmptyState title="No plugins installed" description="Trusted plugin manifests will appear here after registration and load." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "billing"}
        <div class="two-column">
          <Card title="Billing Integrations" subtitle="Stripe and WHMCS webhook interfaces">
            <div class="list">
              <div class="list-row">
                <div>
                  <strong>Stripe</strong>
                  <small>Provision, suspend, unsuspend, terminate, and limits update mappings.</small>
                </div>
                <StatusBadge status="warning" label="Configure Secret" />
              </div>
              <div class="list-row">
                <div>
                  <strong>WHMCS</strong>
                  <small>Shared-secret validation and modular action mapping handlers.</small>
                </div>
                <StatusBadge status="warning" label="Configure Secret" />
              </div>
            </div>
          </Card>
          <Card title="Webhook Guidance" subtitle="Secrets must stay server-side only">
            <p class="muted">Configure <code>STRIPE_WEBHOOK_SECRET</code> or <code>WHMCS_WEBHOOK_SECRET</code> on the API service. Leviathan never exposes these values in the panel UI.</p>
          </Card>
        </div>
      {/if}

      {#if currentView === "settings"}
        <div class="two-column">
          <Card title="Settings" subtitle="Retention and alert controls">
            {#if settings}
              <div class="form-grid">
                <label>App Name<input bind:value={settings.appName} /></label>
                <label>Backup Retention<input type="number" bind:value={settings.backup.retentionCount} /></label>
                <label>Metrics Retention Hours<input type="number" bind:value={settings.metrics.retentionHours} /></label>
                <label>Node Offline Minutes<input type="number" bind:value={settings.alerts.nodeOfflineMinutes} /></label>
                <label>Cloudflare Account ID<input bind:value={settings.cloudflare.accountId} /></label>
                <label>Cloudflare Zone ID<input bind:value={settings.cloudflare.zoneId} /></label>
                <label>Cloudflare Tunnel ID<input bind:value={settings.cloudflare.tunnelId} /></label>
                <label>Cloudflare API Token<input type="password" bind:value={settings.cloudflare.apiToken} /></label>
              </div>
              <ActionButton on:click={saveSettings}>Save Settings</ActionButton>
            {/if}
          </Card>
          <Card title="Integrations" subtitle="API keys and webhooks">
            <label>API Key Name<input bind:value={apiKeyName} /></label>
            <ActionButton on:click={createApiKey}>Create API Key</ActionButton>
            {#if generatedApiKey}
              <p class="muted">The latest API key was revealed in a modal and is now hidden from this settings surface.</p>
            {/if}
            <label>Webhook Name<input bind:value={createWebhookForm.name} /></label>
            <label>Webhook URL<input bind:value={createWebhookForm.url} /></label>
            <label>Events<input bind:value={createWebhookForm.events} /></label>
            <ActionButton variant="secondary" on:click={createWebhook}>Create Webhook</ActionButton>
            <div class="table-surface">
              <div class="table-scroll">
                <table class="lv-table">
                  <thead>
                    <tr>
                      <th>Integration Item</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {#each apiKeys as key}
                      <tr>
                        <td>
                          <strong>{key.name}</strong>
                          <small>{key.keyPrefix}</small>
                        </td>
                        <td>API Key</td>
                        <td><StatusBadge status={key.revoked ? "revoked" : "online"} label={key.revoked ? "Revoked" : "Active"} /></td>
                      </tr>
                    {/each}
                    {#each webhooks as webhook}
                      <tr>
                        <td>
                          <strong>{webhook.name}</strong>
                          <small>{webhook.events.join(", ")}</small>
                        </td>
                        <td>Webhook ({webhook.type})</td>
                        <td><StatusBadge status={webhook.enabled ? "online" : "offline"} label={webhook.enabled ? "Enabled" : "Disabled"} /></td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </div>
      {/if}
    </section>
  </AppShell>

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
{/if}
