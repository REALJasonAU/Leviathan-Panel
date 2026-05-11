<script lang="ts">
  import { onDestroy, onMount } from "svelte";
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
  import StatCard from "./lib/components/StatCard.svelte";
  import { api, consoleSocketUrl, type SessionResponse } from "./lib/api";
  import { session } from "./lib/stores/auth";

  type View =
    | "overview"
    | "servers"
    | "nodes"
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

  const selectedServer = () =>
    servers.find((server) => server.id === selectedServerId) ?? null;

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
    await api.servers.backups.restore(currentToken, backupId);
  };

  const deleteBackup = async (backupId: string) => {
    if (!currentToken || !selectedServer()) {
      return;
    }
    await api.servers.backups.remove(currentToken, backupId);
    await loadServerDetailData(selectedServer()!.id);
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
    apiKeys = await api.admin.apiKeys.list(currentToken);
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
    if (!confirm(`Remove sub-user ${userId}?`)) {
      return;
    }
    serverMembers = await api.servers.members.remove(
      currentToken,
      selectedServer()!.id,
      userId,
    );
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
    if (!currentToken || !confirm("Delete this Cloudflare route from Leviathan?")) {
      return;
    }
    await api.admin.cloudflare.deleteRoute(currentToken, routeId);
    cloudflareRoutes = cloudflareRoutes.filter((route) => route.id !== routeId);
  };

  const saveSettings = async () => {
    if (!currentToken || !settings) {
      return;
    }
    settings = await api.admin.settings.update(currentToken, settings);
  };

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
  <main class="app-shell">
    <aside class="sidebar">
      <div>
        <div class="brand-lockup">
          <span class="brand-mark" aria-hidden="true"></span>
          <div>
            <p class="eyebrow">Leviathan</p>
            <h2>Control Plane</h2>
          </div>
        </div>
        <p class="sidebar-copy">Command nodes, Docker workloads, console streams, files, backups, and admin operations from the abyss.</p>
      </div>

      <nav>
        {#each views as view}
          <a href={"#" + view.id} class:active={currentView === view.id}>{view.label}</a>
        {/each}
      </nav>

      <div class="sidebar-footer">
        <p>{me?.user.displayName}</p>
        <small>{me?.user.email ?? "Mock session"}</small>
        <button class="ghost" on:click={() => session.signOut()}>Sign Out</button>
      </div>
    </aside>

    <section class="content">
      <header class="topbar">
        <div>
          <h1>{views.find((view) => view.id === currentView)?.label}</h1>
          <p>Premium infrastructure controls with Firebase-backed identity and daemon runtime telemetry.</p>
        </div>
        {#if error}
          <p class="inline-error">{error}</p>
        {/if}
      </header>

      {#if loading}
        <p class="muted">Loading workspace data…</p>
      {/if}

      {#if currentView === "overview" && dashboard}
        <div class="stats-grid">
          <StatCard label="Nodes" value={dashboard.totals.nodes} detail="Known daemon hosts" />
          <StatCard label="Servers" value={dashboard.totals.servers} detail="Managed workloads" />
          <StatCard label="Templates" value={dashboard.totals.templates} detail="Provisioning presets" />
          <StatCard label="Online" value={dashboard.totals.onlineServers} detail="Running right now" />
        </div>
        <div class="two-column">
          <Card title="Node Overview" subtitle="Heartbeat, maintenance, and runtime status">
            {#if nodes.length}
              <div class="list">
                {#each nodes as node}
                  <button class="server-list-item" on:click={() => loadNodeConfig(node.id)}>
                    <div>
                      <strong>{node.name}</strong>
                      <small>{node.region} • {node.publicAddress}</small>
                    </div>
                    <span class="status-pill">{node.status}</span>
                  </button>
                {/each}
              </div>
            {:else}
              <EmptyState title="No nodes connected yet" description="Create your first node to generate bootstrap credentials and bring a daemon online." />
            {/if}
          </Card>
          <Card title="Recent Fleet" subtitle="Quick jump into server details">
            {#if servers.length}
              <div class="list">
                {#each servers as server}
                  <button class="server-list-item" on:click={() => selectServer(server.id)}>
                    <div>
                      <strong>{server.name}</strong>
                      <small>{server.nodeId} • {server.templateId}</small>
                    </div>
                    <span class="status-pill">{server.status}</span>
                  </button>
                {/each}
              </div>
            {:else}
              <EmptyState title="No servers provisioned yet" description="Use the server creation form to launch your first Docker workload or game server from a template." />
            {/if}
          </Card>
        </div>
      {/if}

      {#if currentView === "servers"}
        <div class="detail-layout">
          <Card title="Fleet" subtitle="Select a workload">
            {#if servers.length}
              <div class="list">
                {#each servers as server}
                  <button class:selected={selectedServerId === server.id} class="server-list-item" on:click={() => selectServer(server.id)}>
                    <div>
                      <strong>{server.name}</strong>
                      <small>{server.dockerImage}</small>
                    </div>
                    <span class="status-pill">{server.status}</span>
                  </button>
                {/each}
              </div>
            {:else}
              <EmptyState title="No workloads in the fleet" description="Create a server from a template to unlock console, files, backups, network, and environment controls." />
            {/if}
          </Card>

          <div class="detail-main">
            <Card title="Create Server" subtitle="Template-aware provisioning">
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
              <button on:click={createServer}>Create Server</button>
              {#if validationErrors.length}
                <div class="validation-list">
                  {#each validationErrors as item}
                    <p>{item.key}: {item.message}</p>
                  {/each}
                </div>
              {/if}
            </Card>

            {#if selectedServer()}
              <Card title={selectedServer()!.name} subtitle={selectedServer()!.dockerImage}>
                <svelte:fragment slot="actions">
                  <div class="button-row">
                    <button on:click={() => powerServer("start")}>Start</button>
                    <button class="ghost" on:click={() => powerServer("restart")}>Restart</button>
                    <button class="ghost" on:click={() => powerServer("stop")}>Stop</button>
                    <button class="ghost danger" on:click={() => powerServer("kill")}>Kill</button>
                  </div>
                </svelte:fragment>

                <div class="subnav">
                  {#each serverSections as section}
                    <button class:ghost={serverSection !== section.id} on:click={() => (serverSection = section.id)}>
                      {section.label}
                    </button>
                  {/each}
                </div>

                {#if serverSection === "console"}
                  <div class="console-toolbar">
                    <input placeholder="Search console output" bind:value={consoleSearch} />
                    <label class="checkbox"><input type="checkbox" bind:checked={autoScroll} /> Auto-scroll</label>
                  </div>
                  <div class="console">
                    {#each consoleLines.filter((line) => !consoleSearch || line.toLowerCase().includes(consoleSearch.toLowerCase())) as line}
                      <pre>{line}</pre>
                    {/each}
                  </div>
                  <div class="button-row">
                    <input placeholder="Enter command" bind:value={consoleCommand} on:keydown={(event) => event.key === "Enter" && void sendConsoleCommand()} />
                    <button on:click={sendConsoleCommand}>Send</button>
                  </div>
                  {#if commandHistory.length}
                    <div class="history">
                      {#each commandHistory as item}
                        <button class="ghost" on:click={() => (consoleCommand = item)}>{item}</button>
                      {/each}
                    </div>
                  {/if}
                {/if}

                {#if serverSection === "files"}
                  <div class="button-row">
                    <button class="ghost" on:click={() => browseFiles(".")}>Root</button>
                    <button class="ghost" on:click={() => api.servers.files.createFolder(currentToken!, selectedServer()!.id, `${currentPath === "." ? "" : `${currentPath}/`}new-folder`).then(() => browseFiles(currentPath))}>New Folder</button>
                    <input type="file" on:change={uploadFile} />
                  </div>
                  <div class="file-grid">
                    <div class="list">
                      {#each serverFiles as file}
                        <button class="server-list-item" on:click={() => (file.isDirectory ? browseFiles(file.path) : openFile(file.path))}>
                          <div>
                            <strong>{file.name}</strong>
                            <small>{file.isDirectory ? "Directory" : `${file.size} bytes`}</small>
                          </div>
                          <span class="status-pill">{file.modifiedAt.slice(0, 10)}</span>
                        </button>
                      {/each}
                    </div>
                    <div>
                      <p class="muted">Editing: {currentFilePath || "No file selected"}</p>
                      <textarea class="editor" bind:value={fileEditorContent}></textarea>
                      <div class="button-row">
                        <button on:click={saveFile}>Save File</button>
                        {#if currentFilePath}
                          <button class="ghost danger" on:click={() => api.servers.files.remove(currentToken!, selectedServer()!.id, currentFilePath).then(() => { currentFilePath = ""; fileEditorContent = ""; return browseFiles(currentPath); })}>Delete</button>
                        {/if}
                      </div>
                    </div>
                  </div>
                {/if}

                {#if serverSection === "backups"}
                  <div class="button-row">
                    <button on:click={createBackup}>Create Backup</button>
                  </div>
                  <div class="list">
                    {#each serverBackups as backup}
                      <div class="list-row">
                        <div>
                          <strong>{backup.name}</strong>
                          <small>{backup.status} • {backup.sizeBytes} bytes</small>
                        </div>
                        <div class="button-row">
                          <button class="ghost" on:click={() => downloadBackup(backup.id)}>Download</button>
                          <button class="ghost" on:click={() => restoreBackup(backup.id)}>Restore</button>
                          <button class="ghost danger" on:click={() => deleteBackup(backup.id)}>Delete</button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if serverSection === "schedules"}
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
                  <button on:click={createTask}>Create Task</button>
                  <div class="list">
                    {#each serverTasks as task}
                      <div class="list-row">
                        <div>
                          <strong>{task.name}</strong>
                          <small>{task.cron} • {task.action.type}</small>
                        </div>
                        <div class="button-row">
                          <button class="ghost" on:click={() => runTask(task.id)}>Run Now</button>
                        </div>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if serverSection === "network"}
                  <div class="form-grid">
                    <label>Domain<input bind:value={domainForm.domain} /></label>
                    <label>Target Port<input bind:value={domainForm.targetPort} /></label>
                    <button on:click={createDomainMapping}>Map Domain</button>
                  </div>
                  <div class="list">
                    {#each serverDomains as mapping}
                      <div class="list-row">
                        <div>
                          <strong>{mapping.domain}</strong>
                          <small>{mapping.provider} → :{mapping.targetPort}</small>
                        </div>
                        <span class="status-pill">{mapping.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                    {/each}
                  </div>
                  <div class="form-grid">
                    <label>Protocol<select bind:value={firewallForm.protocol}><option value="tcp">TCP</option><option value="udp">UDP</option></select></label>
                    <label>Port<input bind:value={firewallForm.port} /></label>
                    <label>Source<input bind:value={firewallForm.source} /></label>
                    <label>Action<select bind:value={firewallForm.action}><option value="allow">Allow</option><option value="deny">Deny</option></select></label>
                    <button on:click={createFirewallRule}>Add Firewall Rule</button>
                    <button class="ghost" on:click={() => applyFirewallRules(true)}>Dry Run Rules</button>
                    <button class="ghost danger" on:click={() => confirm("Apply firewall rules on the daemon node?") && applyFirewallRules(false)}>Apply Rules</button>
                  </div>
                  <div class="list">
                    {#each serverFirewallRules as rule}
                      <div class="list-row">
                        <strong>{rule.action.toUpperCase()} {rule.protocol}/{rule.port}</strong>
                        <small>{rule.source}</small>
                      </div>
                    {/each}
                  </div>
                  <div class="list">
                    {#each selectedServer()!.allocations as allocation}
                      <div class="list-row">
                        <div>
                          <strong>{allocation.ip}:{allocation.port}</strong>
                          <small>{allocation.ipv6 ?? "IPv4 only"}</small>
                        </div>
                        <span class="status-pill">{allocation.primary ? "Primary" : "Secondary"}</span>
                      </div>
                    {/each}
                  </div>
                  {#if sftpCredential}
                    <p class="token-box">SFTP: {sftpCredential.username}@{sftpCredential.host}:{sftpCredential.port}</p>
                    <button class="ghost" on:click={rotateSftp}>Rotate SFTP Credential</button>
                  {/if}
                {/if}

                {#if serverSection === "environment"}
                  <div class="env-editor">
                    {#each selectedServer()!.environmentDefinitions as definition}
                      <label>
                        {definition.key}
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
                      </label>
                    {/each}
                  </div>
                  <button on:click={updateServerEnvironment}>Save Environment</button>
                {/if}

                {#if serverSection === "sub-users"}
                  <div class="form-grid">
                    <label>User ID<input bind:value={subUserForm.userId} /></label>
                    <label>Permissions<input bind:value={subUserForm.permissions} /></label>
                    <button on:click={addSubUser}>Add Sub-user</button>
                  </div>
                  <div class="list">
                    {#each serverMembers as member}
                      <div class="list-row">
                        <div>
                          <strong>{member.userId}</strong>
                          <small>{member.permissions.join(", ")}</small>
                        </div>
                        <button class="ghost danger" on:click={() => removeSubUser(member.userId)}>Remove</button>
                      </div>
                    {/each}
                  </div>
                {/if}

                {#if serverSection === "settings"}
                  <div class="metrics-grid">
                    <StatCard label="CPU" value={selectedServer()!.limits.cpuPercent + "%"} detail="Assigned limit" />
                    <StatCard label="Memory" value={selectedServer()!.limits.memoryMb + " MB"} detail="Assigned limit" />
                    <StatCard label="Disk" value={selectedServer()!.limits.diskMb + " MB"} detail="Assigned limit" />
                    <StatCard label="Crashes" value={selectedServer()!.crashCount} detail="Tracked runtime faults" />
                  </div>
                {/if}
              </Card>
            {/if}
          </div>
        </div>
      {/if}

      {#if currentView === "nodes"}
        <div class="two-column">
          <Card title="Node Fleet" subtitle="Maintenance, metrics, and daemon config">
            {#if nodes.length}
              <div class="list">
                {#each nodes as node}
                  <div class="list-row">
                    <div>
                      <strong>{node.name}</strong>
                      <small>{node.region} • {node.status}</small>
                    </div>
                    <div class="button-row">
                      <button class="ghost" on:click={() => loadNodeConfig(node.id)}>Config</button>
                      <button class="ghost" on:click={() => toggleNodeMaintenance(node)}>{node.maintenanceMode ? "Disable Maintenance" : "Enable Maintenance"}</button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <EmptyState title="No registered nodes" description="Create a node to generate a bootstrap token, then install the Leviathan daemon on the target Linux host." />
            {/if}
          </Card>
          <Card title="Add Node" subtitle="Create installer credentials">
            <label>Name<input bind:value={createNodeForm.name} /></label>
            <label>Region<input bind:value={createNodeForm.region} /></label>
            <label>Public Address<input bind:value={createNodeForm.publicAddress} /></label>
            <label>Panel Base URL<input bind:value={createNodeForm.baseUrl} /></label>
            <label>Capabilities<input bind:value={createNodeForm.capabilities} /></label>
            <button on:click={createNode}>Create Node</button>
            {#if nodeBootstrapToken}
              <p class="token-box">Bootstrap token: {nodeBootstrapToken}</p>
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

        {#if nodeMetrics.length}
          <Card title="Node Metrics" subtitle="Latest retained points">
            <div class="list">
              {#each nodeMetrics as point}
                <div class="list-row">
                  <div>
                    <strong>{point.timestamp}</strong>
                    <small>CPU {point.values.cpuPercent ?? 0}% • RAM {point.values.memoryUsedMb ?? 0} MB</small>
                  </div>
                  <span class="status-pill">{Math.round(point.values.diskUsedMb ?? 0)} MB disk</span>
                </div>
              {/each}
            </div>
          </Card>
        {/if}
      {/if}

      {#if currentView === "templates"}
        <div class="two-column">
          <Card title=".env.example Import Preview" subtitle="Parse required variables before saving">
            <textarea bind:value={envImportText} rows="12"></textarea>
            <div class="button-row">
              <button on:click={importEnvExample}>Parse Import</button>
            </div>
            <div class="env-preview">
              {#each previewDefinitions as definition}
                <div class="env-row">
                  <strong>{definition.key}</strong>
                  <small>{definition.description ?? definition.displayName}</small>
                  <span>{definition.secret ? "Secret" : "Visible"}</span>
                </div>
              {/each}
            </div>
          </Card>
          <Card title="Create Template" subtitle="Images, startup, and env metadata">
            <label>ID<input bind:value={createTemplateForm.id} /></label>
            <label>Name<input bind:value={createTemplateForm.name} /></label>
            <label>Category<input bind:value={createTemplateForm.category} /></label>
            <label>Description<input bind:value={createTemplateForm.description} /></label>
            <label>Docker Images<input bind:value={createTemplateForm.dockerImages} /></label>
            <label>Startup Command<input bind:value={createTemplateForm.startupCommand} /></label>
            <button on:click={createTemplate}>Save Template</button>
          </Card>
        </div>
        <Card title="Existing Templates" subtitle="Environment-aware templates">
          {#if templates.length}
            <div class="list">
              {#each templates as template}
                <div class="template-block">
                  <div class="list-row">
                    <div>
                      <strong>{template.name}</strong>
                      <small>{template.description}</small>
                    </div>
                    <span class="status-pill">{template.category}</span>
                  </div>
                  <div class="env-preview">
                    {#each template.environmentDefinitions as definition}
                      <div class="env-row">
                        <strong>{definition.key}</strong>
                        <small>{definition.displayName}</small>
                        <span>{definition.defaultValue ?? "No default"}</span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <EmptyState title="No templates saved yet" description="Import a .env.example and create a template to standardize your first workload build." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "users"}
        <Card title="Users" subtitle="Firebase-backed identities and role assignment">
          <div class="list">
            {#each users as user}
              <div class="list-row">
                <div>
                  <strong>{user.displayName}</strong>
                  <small>{user.email ?? user.uid}</small>
                </div>
                <select on:change={(event) => updateUserRole(user.uid, (event.currentTarget as HTMLSelectElement).value)}>
                  {#each roles as role}
                    <option value={role.id} selected={user.roleIds.includes(role.id)}>{role.name}</option>
                  {/each}
                </select>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      {#if currentView === "roles"}
        <div class="two-column">
          <Card title="Roles" subtitle="Global permissions">
            <div class="list">
              {#each roles as role}
                <div class="list-row">
                  <div>
                    <strong>{role.name}</strong>
                    <small>{role.permissions.join(", ") || "No permissions"}</small>
                  </div>
                  <span class="status-pill">{role.id}</span>
                </div>
              {/each}
            </div>
          </Card>
          <Card title="Create Role" subtitle="Permission bundles for staff or automation">
            <label>ID<input bind:value={createRoleForm.id} /></label>
            <label>Name<input bind:value={createRoleForm.name} /></label>
            <label>Permissions<input bind:value={createRoleForm.permissions} /></label>
            <button on:click={createRole}>Create Role</button>
          </Card>
        </div>
      {/if}

      {#if currentView === "backups"}
        <Card title="Backups" subtitle="Current selected server backups">
          <div class="list">
            {#each serverBackups as backup}
              <div class="list-row">
                <div>
                  <strong>{backup.name}</strong>
                  <small>{backup.status} • {backup.sizeBytes} bytes</small>
                </div>
                <div class="button-row">
                  <button class="ghost" on:click={() => downloadBackup(backup.id)}>Download</button>
                  <button class="ghost" on:click={() => restoreBackup(backup.id)}>Restore</button>
                  <button class="ghost danger" on:click={() => deleteBackup(backup.id)}>Delete</button>
                </div>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      {#if currentView === "scheduled-tasks"}
        <Card title="Scheduled Tasks" subtitle="Tasks for the currently selected server">
          <div class="list">
            {#each serverTasks as task}
              <div class="list-row">
                <div>
                  <strong>{task.name}</strong>
                  <small>{task.cron} • {task.action.type}</small>
                </div>
                <button class="ghost" on:click={() => runTask(task.id)}>Run Now</button>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      {#if currentView === "audit-logs"}
        <Card title="Audit Logs" subtitle="Sensitive actions with secret-safe metadata">
          <div class="list">
            {#each auditLogs as log}
              <div class="list-row">
                <div>
                  <strong>{log.action}</strong>
                  <small>{log.actorId} • {log.targetType}:{log.targetId}</small>
                </div>
                <span class="status-pill">{log.createdAt}</span>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      {#if currentView === "alerts"}
        <Card title="Alerts" subtitle="Open, acknowledged, and resolved runtime events">
          <div class="list">
            {#each alertEvents as alert}
              <div class="list-row">
                <div>
                  <strong>{alert.title}</strong>
                  <small>{alert.message}</small>
                </div>
                <div class="button-row">
                  <span class="status-pill">{alert.status}</span>
                  {#if alert.status === "open"}
                    <button class="ghost" on:click={() => acknowledgeAlert(alert.id)}>Acknowledge</button>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      {#if currentView === "api-keys"}
        <Card title="API Keys" subtitle="Scoped automation credentials; raw keys are shown once">
          <label>API Key Name<input bind:value={apiKeyName} /></label>
          <button on:click={createApiKey}>Create API Key</button>
          {#if generatedApiKey}
            <p class="token-box">{generatedApiKey}</p>
          {/if}
          {#if apiKeys.length}
            <div class="list">
              {#each apiKeys as key}
                <div class="list-row">
                  <div>
                    <strong>{key.name}</strong>
                    <small>{key.keyPrefix} • {key.scopes.join(", ")}</small>
                  </div>
                  <span class="status-pill">{key.revoked ? "Revoked" : "Active"}</span>
                </div>
              {/each}
            </div>
          {:else}
            <EmptyState title="No API keys created" description="Create a scoped automation key when you need external provisioning, scripts, or integration access." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "webhooks"}
        <div class="two-column">
          <Card title="Webhooks" subtitle="Signed generic and Discord deliveries">
            <label>Webhook Name<input bind:value={createWebhookForm.name} /></label>
            <label>Webhook URL<input bind:value={createWebhookForm.url} /></label>
            <label>Events<input bind:value={createWebhookForm.events} /></label>
            <button on:click={createWebhook}>Create Webhook</button>
            <div class="list">
              {#each webhooks as webhook}
                <div class="list-row">
                  <div>
                    <strong>{webhook.name}</strong>
                    <small>{webhook.events.join(", ")}</small>
                  </div>
                  <span class="status-pill">{webhook.type}</span>
                </div>
              {/each}
            </div>
          </Card>
          <Card title="Deliveries" subtitle="Persistent webhook delivery records">
            <div class="list">
              {#each webhookDeliveries as delivery}
                <div class="list-row">
                  <div>
                    <strong>{delivery.event}</strong>
                    <small>{delivery.responseStatus ?? "pending"} • attempts {delivery.attempts}</small>
                  </div>
                  <span class="status-pill">{delivery.status}</span>
                </div>
              {/each}
            </div>
          </Card>
        </div>
      {/if}

      {#if currentView === "backup-targets"}
        <div class="two-column">
          <Card title="S3 Backup Target" subtitle="S3-compatible endpoint configuration">
            <label>Name<input bind:value={backupTargetForm.name} /></label>
            <label>Endpoint<input bind:value={backupTargetForm.endpoint} /></label>
            <label>Region<input bind:value={backupTargetForm.region} /></label>
            <label>Bucket<input bind:value={backupTargetForm.bucket} /></label>
            <label>Access Key ID<input bind:value={backupTargetForm.accessKeyId} /></label>
            <label>Secret Access Key<input type="password" bind:value={backupTargetForm.secretAccessKey} /></label>
            <label>Path Prefix<input bind:value={backupTargetForm.pathPrefix} /></label>
            <button on:click={createBackupTarget}>Create Target</button>
          </Card>
          <Card title="Targets" subtitle="Secrets are never returned to the browser">
            <div class="list">
              {#each backupTargets as target}
                <div class="list-row">
                  <div>
                    <strong>{target.name}</strong>
                    <small>{target.provider} • {target.s3?.bucket ?? target.local?.basePath}</small>
                  </div>
                  <span class="status-pill">{target.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              {/each}
            </div>
          </Card>
        </div>
      {/if}

      {#if currentView === "cloudflare"}
        <div class="two-column">
          <Card title="Cloudflare Route" subtitle="Create tunnel hostname routes and dry-run API changes">
            <label>Hostname<input bind:value={cloudflareRouteForm.hostname} /></label>
            <label>Service<input bind:value={cloudflareRouteForm.service} /></label>
            <label>Tunnel ID<input bind:value={cloudflareRouteForm.tunnelId} /></label>
            <label>Zone ID<input bind:value={cloudflareRouteForm.zoneId} /></label>
            <button on:click={createCloudflareRoute}>Create Route</button>
          </Card>
          <Card title="Routes" subtitle="Dry-run before applying Cloudflare changes">
            {#if cloudflareRoutes.length}
              <div class="list">
                {#each cloudflareRoutes as route}
                  <div class="list-row">
                    <div>
                      <strong>{route.hostname}</strong>
                      <small>{route.service}</small>
                    </div>
                    <div class="button-row">
                      <button class="ghost" on:click={() => dryRunCloudflareRoute(route.id)}>Dry Run</button>
                      <button class="ghost" on:click={() => syncCloudflareRoute(route.id)}>Apply</button>
                      <button class="ghost danger" on:click={() => deleteCloudflareRoute(route.id)}>Delete</button>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <EmptyState title="No Cloudflare routes configured" description="Create a hostname route, review the dry-run output, and then apply it when the zone and tunnel settings are ready." />
            {/if}
          </Card>
        </div>
      {/if}

      {#if currentView === "firewall"}
        <Card title="Firewall" subtitle="Per-server rules are managed from each server Network page">
          <p class="muted">Daemon-side UFW rule generation is available with dry-run output and explicit audit logging before enforcement.</p>
        </Card>
      {/if}

      {#if currentView === "jobs"}
        <Card title="Job Queue" subtitle="Scheduled task and background worker visibility">
          {#if jobs.length}
            <div class="list">
              {#each jobs as job}
                <div class="list-row">
                  <div>
                    <strong>{job.type}</strong>
                    <small>{job.id} • attempts {job.attempts}/{job.maxAttempts}</small>
                  </div>
                  <span class="status-pill">{job.status}</span>
                </div>
              {/each}
            </div>
          {:else}
            <EmptyState title="No background jobs recorded" description="Queued task executions, retries, and worker activity will show up here as the control plane starts processing jobs." />
          {/if}
        </Card>
      {/if}

      {#if currentView === "plugins"}
        <Card title="Plugins" subtitle="Trusted admin-installed extension manifests">
          <div class="list">
            {#each plugins as plugin}
              <div class="list-row">
                <div>
                  <strong>{plugin.name}</strong>
                  <small>{plugin.id} • {plugin.version}</small>
                </div>
                <span class="status-pill">{plugin.enabled ? "Enabled" : "Disabled"}</span>
              </div>
            {/each}
          </div>
        </Card>
      {/if}

      {#if currentView === "billing"}
        <Card title="Billing Integrations" subtitle="Stripe and WHMCS webhook interfaces">
          <p class="muted">Configure STRIPE_WEBHOOK_SECRET or WHMCS_WEBHOOK_SECRET on the API. Billing events map to provision, suspend, unsuspend, terminate, and update-limits hooks.</p>
        </Card>
      {/if}

      {#if currentView === "settings"}
        <div class="two-column">
          <Card title="Settings" subtitle="Retention and alert controls">
            {#if settings}
              <label>App Name<input bind:value={settings.appName} /></label>
              <label>Backup Retention<input type="number" bind:value={settings.backup.retentionCount} /></label>
              <label>Metrics Retention Hours<input type="number" bind:value={settings.metrics.retentionHours} /></label>
              <label>Node Offline Minutes<input type="number" bind:value={settings.alerts.nodeOfflineMinutes} /></label>
              <label>Cloudflare Account ID<input bind:value={settings.cloudflare.accountId} /></label>
              <label>Cloudflare Zone ID<input bind:value={settings.cloudflare.zoneId} /></label>
              <label>Cloudflare Tunnel ID<input bind:value={settings.cloudflare.tunnelId} /></label>
              <label>Cloudflare API Token<input type="password" bind:value={settings.cloudflare.apiToken} /></label>
              <button on:click={saveSettings}>Save Settings</button>
            {/if}
          </Card>
          <Card title="Integrations" subtitle="API keys and webhooks">
            <label>API Key Name<input bind:value={apiKeyName} /></label>
            <button on:click={createApiKey}>Create API Key</button>
            {#if generatedApiKey}
              <p class="token-box">{generatedApiKey}</p>
            {/if}
            <label>Webhook Name<input bind:value={createWebhookForm.name} /></label>
            <label>Webhook URL<input bind:value={createWebhookForm.url} /></label>
            <label>Events<input bind:value={createWebhookForm.events} /></label>
            <button class="ghost" on:click={createWebhook}>Create Webhook</button>
            <div class="list">
              {#each apiKeys as key}
                <div class="list-row">
                  <div>
                    <strong>{key.name}</strong>
                    <small>{key.keyPrefix} • {key.scopes.join(", ")}</small>
                  </div>
                  <span class="status-pill">{key.revoked ? "Revoked" : "Active"}</span>
                </div>
              {/each}
              {#each webhooks as webhook}
                <div class="list-row">
                  <div>
                    <strong>{webhook.name}</strong>
                    <small>{webhook.events.join(", ")}</small>
                  </div>
                  <span class="status-pill">{webhook.type}</span>
                </div>
              {/each}
            </div>
          </Card>
        </div>
      {/if}
    </section>
  </main>
{/if}
