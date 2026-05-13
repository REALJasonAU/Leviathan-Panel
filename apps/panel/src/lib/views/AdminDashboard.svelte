<script lang="ts">
  import ActionButton from "../components/ActionButton.svelte";
  import AppShell from "../components/AppShell.svelte";
  import Card from "../components/Card.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import LoadingState from "../components/LoadingState.svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import ProgressBar from "../components/ProgressBar.svelte";
  import SidebarNav from "../components/SidebarNav.svelte";
  import StatCard from "../components/StatCard.svelte";
  import StatusBadge from "../components/StatusBadge.svelte";
  import TabNav from "../components/TabNav.svelte";
  import TopHeader from "../components/TopHeader.svelte";

  export let admin: any = {};

  let currentView = "overview";
  let currentViewTitle = "Overview";
  let currentViewSubtitle = "";
  let activeTopBreadcrumbs: Array<{ label: string; key?: string; href?: string }> = [];
  let activePageBreadcrumbs: Array<{ label: string; key?: string; href?: string }> = [];
  let sidebarGroups: any[] = [];
  let sidebarStatusLabel = "Awaiting node enrollment";
  let sidebarStatusVariant: "online" | "warning" | "offline" = "warning";
  let me: any = null;
  let loading = false;
  let error = "";
  let dashboard: any = null;
  let nodes: any[] = [];
  let templates: any[] = [];
  let servers: any[] = [];
  let users: any[] = [];
  let roles: any[] = [];
  let auditLogs: any[] = [];
  let settings: any = null;
  let apiKeys: any[] = [];
  let webhooks: any[] = [];
  let webhookDeliveries: any[] = [];
  let backupTargets: any[] = [];
  let alertEvents: any[] = [];
  let jobs: any[] = [];
  let plugins: any[] = [];
  let cloudflareRoutes: any[] = [];
  let selectedServerId = "";
  let serverListMode: "cards" | "table" = "cards";
  let createNodeForm = {
    name: "",
    region: "",
    publicAddress: "",
    baseUrl: "",
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
  let previewDefinitions: any[] = [];
  let envImportText = "";
  let validationErrors: Array<{ key: string; message: string }> = [];
  let nodeBootstrapToken = "";
  let selectedNodeConfig: any = null;
  let nodeMetrics: any[] = [];
  let serverMetrics: any[] = [];
  let serverBackups: any[] = [];
  let serverTasks: any[] = [];
  let serverFiles: any[] = [];
  let serverMembers: any[] = [];
  let serverDomains: any[] = [];
  let serverFirewallRules: any[] = [];
  let currentPath = ".";
  let currentFilePath = "";
  let fileEditorContent = "";
  let consoleLines: string[] = [];
  let consoleSearch = "";
  let consoleCommand = "";
  let commandHistory: string[] = [];
  let autoScroll = true;
  let sftpCredential: any = null;
  let selectedServerRecord: any = null;
  let topSearchValue = "";
  let serverSections: any[] = [];
  let navigateToView = (_viewId: string) => {};
  let handleHeaderSearch = async (_value: string) => {};
  let openNotifications = () => {};
  let openProfile = () => {};
  let focusCreateSurface = async (_view: string, _targetId: string) => {};
  let selectServer = async (_serverId: string) => {};
  let powerServer = async (_action: string) => {};
  let powerServerById = async (_serverId: string, _action: string) => {};
  let updateServerEnvironment = async () => {};
  let sendConsoleCommand = async () => {};
  let browseFiles = async (_path: string) => {};
  let openFile = async (_path: string) => {};
  let saveFile = async () => {};
  let confirmDeleteFile = (_path: string) => {};
  let uploadFile = async (_event: Event) => {};
  let downloadFile = async (_path: string) => {};
  let createBackup = async () => {};
  let restoreBackup = async (_backupId: string) => {};
  let deleteBackup = async (_backupId: string) => {};
  let downloadBackup = async (_backupId: string) => {};
  let createTask = async () => {};
  let runTask = async (_taskId: string) => {};
  let toggleNodeMaintenance = async (_node: any) => {};
  let loadNodeConfig = async (_nodeId: string) => {};
  let updateUserRole = async (_userId: string, _roleId: string) => {};
  let createRole = async () => {};
  let createApiKey = async () => {};
  let revokeApiKey = async (_keyId: string, _keyName: string) => {};
  let createWebhook = async () => {};
  let createBackupTarget = async () => {};
  let addSubUser = async () => {};
  let removeSubUser = async (_userId: string) => {};
  let addFirewallRule = async () => {};
  let applyFirewallRules = async () => {};
  let saveSettings = async () => {};
  let createCloudflareRoute = async () => {};
  let dryRunCloudflareRoute = async (_routeId: string) => {};
  let syncCloudflareRoute = async (_routeId: string) => {};
  let deleteCloudflareRoute = async (_routeId: string) => {};
  let importEnvExample = async () => {};
  let createNode = async () => {};
  let createTemplate = async () => {};
  let createServer = async () => {};
  let currentServerMetric = () => null;
  let formatPercent = (value: number | undefined) => `${Math.round(value ?? 0)}%`;
  let formatMegabytes = (value: number | undefined) =>
    `${Math.round(value ?? 0).toLocaleString()} MB`;
  let formatBytes = (value: number) => `${value.toLocaleString()} bytes`;
  let usagePercent = (used: number | undefined, limit: number | undefined) => {
    if (!limit || limit <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(100, Math.round(((used ?? 0) / limit) * 100)));
  };
  let latestDaemonVersion = () => null;
  let serverStripTone = (_status: string) => "offline";

  $: ({
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
    generatedApiKey,
    subUserForm,
    domainForm,
    firewallForm,
    backupTargetForm,
    cloudflareRouteForm,
    previewDefinitions,
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
  } = admin);

  $: ({
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
    addFirewallRule,
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
  } = admin);

  const selectedServer = () => selectedServerRecord;
</script>

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
        <small>{me?.user.email ?? "Leviathan session"}</small>
      </div>
    </svelte:fragment>

    <svelte:fragment slot="header">
      <TopHeader
        title="Leviathan Operations"
        subtitle="Premium infrastructure controls with local account sessions and daemon runtime telemetry."
        breadcrumbs={activeTopBreadcrumbs}
        bind:searchValue={topSearchValue}
        on:search={(event) => void handleHeaderSearch(event.detail)}
        on:notifications={openNotifications}
        on:profile={openProfile}
      >
        <svelte:fragment slot="actions">
          <button class="ghost" on:click={() => admin.signOut()}>Sign Out</button>
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
        <Card
          tone="danger"
          compact
          title="Admin data unavailable"
          subtitle={error}
        >
          <p class="muted">The command deck can continue once the panel/API connection recovers.</p>
        </Card>
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

      {#if currentViewTitle === "Servers"}
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

          <div id="create-server-surface" tabindex="-1">
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
              {#if previewDefinitions.length}
                {#each previewDefinitions as definition}
                  <div class="env-row">
                    <strong>{definition.key}</strong>
                    <small>{definition.description ?? definition.displayName}</small>
                    <StatusBadge
                      status={definition.secret ? "warning" : "online"}
                      label={definition.secret ? "Secret" : "Visible"}
                    />
                  </div>
                {/each}
              {:else}
                <p class="muted">Paste a `.env.example` file and Leviathan will preview the imported variables here.</p>
              {/if}
            </div>
          </Card>
          <div id="create-template-surface" tabindex="-1">
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
        <Card title="Users" subtitle="Local identities and role assignment">
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
            <EmptyState title="No scheduled tasks yet" description="Create tasks from the server Schedules tab to automate power actions, commands, and backups." />
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
              <ActionButton on:click={() => createApiKey(apiKeyName)}>Create API Key</ActionButton>
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
          <div id="settings-surface" tabindex="-1">
            {#if settings}
              <Card title="Settings" subtitle="Retention and alert controls">
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
              </Card>
            {:else}
              <EmptyState
                title="Settings unavailable"
                description="Leviathan is waiting for the persisted settings record to load from MariaDB."
              />
            {/if}
          </div>
          <Card title="Integrations" subtitle="API keys and webhooks">
            <label>API Key Name<input bind:value={apiKeyName} /></label>
            <ActionButton on:click={() => createApiKey(apiKeyName)}>Create API Key</ActionButton>
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
