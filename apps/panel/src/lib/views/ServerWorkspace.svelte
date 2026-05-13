<script lang="ts">
  import type { ServerRecord } from "@voltan/shared";

  import ActionButton from "../components/ActionButton.svelte";
  import Card from "../components/Card.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import ProgressBar from "../components/ProgressBar.svelte";
  import StatCard from "../components/StatCard.svelte";
  import StatusBadge from "../components/StatusBadge.svelte";
  import TabNav from "../components/TabNav.svelte";
  import type { ServerWorkspaceActions, UserWorkspaceModel, WorkspaceSection } from "./workspaceTypes";

  export let workspace: UserWorkspaceModel;
  export let workspaceSection: WorkspaceSection = "console";
  export let consoleSearch = "";
  export let autoScroll = true;
  export let consoleCommand = "";
  export let currentPath = ".";
  export let currentFilePath = "";
  export let fileEditorContent = "";

  const selectedServer = () => workspace.selectedServer;
  const currentMetric = () => workspace.serverMetric;
  const actions = (): ServerWorkspaceActions => workspace.actions;

  const allocationLabel = (server?: ServerRecord | null) =>
    server?.allocations[0]
      ? `${server.allocations[0].ip}:${server.allocations[0].port}`
      : "unassigned";

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

  const filteredConsoleLines = () =>
    workspace.consoleLines.filter(
      (line) => !consoleSearch || line.toLowerCase().includes(consoleSearch.toLowerCase()),
    );

  const recentConsoleLines = () => workspace.consoleLines.slice(-10).reverse();

  const latestConsoleError = () =>
    [...workspace.consoleLines]
      .reverse()
      .find((line) => /error|fail|exception/i.test(line));

  const tabSummary = (tabId: string) => {
    const descriptions: Record<string, string> = {
      console: "Realtime output, commands, and incident traces.",
      files: "Browse, edit, upload, and safely manage workspace files.",
      databases: "Credential-backed database settings and bindings.",
      schedules: "CRON-driven automation for maintenance and restarts.",
      users: "Delegated access and permission scopes for collaborators.",
      backups: "Create, restore, download, and prune snapshots.",
      network: "Allocations, routing, firewall, and SFTP access.",
      startup: "Image, startup, and resource configuration for the workload.",
      settings: "Runtime variables and lifecycle controls.",
      activity: "Audit history and recent workspace events.",
    };

    return descriptions[tabId] ?? "Workspace controls for this section.";
  };
</script>

{#if selectedServer()}
  <PageHeader
    title={selectedServer()!.name}
    description={selectedServer()!.description ?? selectedServer()!.dockerImage}
    breadcrumbs={[{ label: "Leviathan" }, { label: "Servers" }, { label: selectedServer()!.name }]}
  >
    <svelte:fragment slot="actions">
      <div class="button-row">
        <StatusBadge status={selectedServer()!.status} />
        <ActionButton on:click={() => actions().powerServer("start")}>Start</ActionButton>
        <ActionButton variant="secondary" on:click={() => actions().powerServer("restart")}>
          Restart
        </ActionButton>
        <ActionButton variant="secondary" on:click={() => actions().powerServer("stop")}>
          Stop
        </ActionButton>
        <ActionButton variant="danger" on:click={() => actions().powerServer("kill")}>
          Kill
        </ActionButton>
      </div>
    </svelte:fragment>
  </PageHeader>

  <div class="metrics-grid">
    <StatCard label="Address" value={allocationLabel(selectedServer())} detail="Primary allocation" />
    <StatCard
      label="Uptime"
      value={`${selectedServer()!.uptimeSeconds}s`}
      detail="Runtime lifecycle"
    />
    <StatCard
      label="CPU Load"
      value={formatPercent(currentMetric()?.values.cpuPercent)}
      detail={`${selectedServer()!.limits.cpuPercent}% limit`}
    />
    <StatCard
      label="Memory"
      value={formatMegabytes(currentMetric()?.values.memoryUsedMb)}
      detail={`${selectedServer()!.limits.memoryMb} MB limit`}
    />
    <StatCard
      label="Disk"
      value={formatMegabytes(currentMetric()?.values.diskUsedMb)}
      detail={`${selectedServer()!.limits.diskMb} MB limit`}
    />
    <StatCard
      label="Network In"
      value={formatMegabytes(currentMetric()?.values.networkInMb)}
      detail="Inbound"
      tone="success"
    />
    <StatCard
      label="Network Out"
      value={formatMegabytes(currentMetric()?.values.networkOutMb)}
      detail="Outbound"
    />
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
        label={`${currentMetric()?.values.cpuPercent ?? 0}% of ${selectedServer()!.limits.cpuPercent}%`}
        value={usagePercent(currentMetric()?.values.cpuPercent, selectedServer()!.limits.cpuPercent)}
        tone={usagePercent(currentMetric()?.values.cpuPercent, selectedServer()!.limits.cpuPercent) > 85 ? "warning" : "primary"}
      />
    </Card>
    <Card compact title="Memory Pressure" subtitle="Live memory consumption">
      <ProgressBar
        label={`${Math.round(currentMetric()?.values.memoryUsedMb ?? 0)} MB of ${selectedServer()!.limits.memoryMb} MB`}
        value={usagePercent(currentMetric()?.values.memoryUsedMb, selectedServer()!.limits.memoryMb)}
        tone={usagePercent(currentMetric()?.values.memoryUsedMb, selectedServer()!.limits.memoryMb) > 85 ? "warning" : "success"}
      />
    </Card>
    <Card compact title="Disk Pressure" subtitle="Writable volume occupancy">
      <ProgressBar
        label={`${Math.round(currentMetric()?.values.diskUsedMb ?? 0)} MB of ${selectedServer()!.limits.diskMb} MB`}
        value={usagePercent(currentMetric()?.values.diskUsedMb, selectedServer()!.limits.diskMb)}
        tone={usagePercent(currentMetric()?.values.diskUsedMb, selectedServer()!.limits.diskMb) > 90 ? "danger" : "primary"}
      />
    </Card>
  </div>

  <TabNav
    tabs={workspace.tabs}
    active={workspaceSection}
    on:change={(event) => (workspaceSection = event.detail as WorkspaceSection)}
  />

  {#if workspaceSection === "console"}
    <Card
      tone="console"
      compact
      title="Live Console"
      subtitle="Realtime terminal feed, command history, and recent logs"
    >
      <svelte:fragment slot="actions">
        <div class="button-row">
          <ActionButton variant="ghost" on:click={() => actions().clearConsole()}>Clear</ActionButton>
          <ActionButton variant="ghost" on:click={() => void actions().copyLatestConsoleError()}>
            Copy Latest Error
          </ActionButton>
        </div>
      </svelte:fragment>

      <div class="console-workspace">
        <div class="metrics-grid console-metrics">
          <StatCard label="Address" value={allocationLabel(selectedServer())} detail="Primary allocation" />
          <StatCard label="Uptime" value={`${selectedServer()!.uptimeSeconds}s`} detail="Lifecycle" />
          <StatCard
            label="CPU"
            value={formatPercent(currentMetric()?.values.cpuPercent)}
            detail={`${selectedServer()!.limits.cpuPercent}% limit`}
          />
          <StatCard
            label="Memory"
            value={formatMegabytes(currentMetric()?.values.memoryUsedMb)}
            detail={`${selectedServer()!.limits.memoryMb} MB limit`}
          />
          <StatCard
            label="Disk"
            value={formatMegabytes(currentMetric()?.values.diskUsedMb)}
            detail={`${selectedServer()!.limits.diskMb} MB limit`}
          />
        </div>

        <div class="console-layout">
          <section class="console-panel">
            <div class="console-toolbar">
              <input placeholder="Search console output" bind:value={consoleSearch} />
              <label class="checkbox">
                <input type="checkbox" bind:checked={autoScroll} />
                Auto-scroll
              </label>
              <div class="console-toolbar__actions">
                <ActionButton on:click={() => void actions().sendConsoleCommand()}>Send</ActionButton>
                <ActionButton variant="secondary" on:click={() => actions().powerServer("restart")}>
                  Restart
                </ActionButton>
              </div>
            </div>

            <div class="console" aria-label="Terminal output">
              {#each filteredConsoleLines() as line}
                <pre>{line}</pre>
              {/each}
            </div>

            <div class="button-row console-command-row">
              <input
                placeholder="Enter command"
                bind:value={consoleCommand}
                on:keydown={(event) => event.key === "Enter" && void actions().sendConsoleCommand()}
              />
              <ActionButton on:click={() => void actions().sendConsoleCommand()}>Send Command</ActionButton>
            </div>

            {#if workspace.commandHistory.length}
              <div class="history">
                {#each workspace.commandHistory as item}
                  <ActionButton variant="ghost" on:click={() => (consoleCommand = item)}>
                    {item}
                  </ActionButton>
                {/each}
              </div>
            {/if}
          </section>

          <Card title="Recent Logs" subtitle="Most recent output and incident traces" compact>
            {#if recentConsoleLines().length}
              <div class="recent-log-list">
                {#each recentConsoleLines() as line, index (index)}
                  <div class="recent-log-item">
                    <span>{line}</span>
                  </div>
                {/each}
              </div>
            {:else}
              <EmptyState
                title="No console output yet"
                description="Once the workload starts emitting output, the latest messages will appear here."
              />
            {/if}
            {#if latestConsoleError()}
              <div class="inline-warning console-note">
                <strong>Latest error</strong>
                <p>{latestConsoleError()}</p>
              </div>
            {/if}
          </Card>
        </div>
      </div>
    </Card>
  {:else if workspaceSection === "files"}
    <div class="two-column">
      <Card title="File Manager" subtitle={`Path: ${currentPath}`}>
        <div class="button-row">
          <ActionButton variant="ghost" on:click={() => void actions().browseFiles(".")}>Root</ActionButton>
          <ActionButton variant="secondary" on:click={() => void actions().createFolder()}>
            New Folder
          </ActionButton>
          <input type="file" on:change={actions().uploadFile} />
        </div>
        {#if workspace.serverFiles.length}
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
                  {#each workspace.serverFiles as file}
                    <tr>
                      <td class="cell-mono">{file.name}</td>
                      <td>{file.isDirectory ? "Directory" : "File"}</td>
                      <td class="cell-numeric">{file.isDirectory ? "-" : formatBytes(file.size)}</td>
                      <td>{file.modifiedAt}</td>
                      <td class="cell-right">
                        <div class="button-row">
                          <ActionButton
                            variant="ghost"
                            on:click={() => (file.isDirectory ? actions().browseFiles(file.path) : actions().openFile(file.path))}
                          >
                            {file.isDirectory ? "Open" : "Edit"}
                          </ActionButton>
                          {#if !file.isDirectory}
                            <ActionButton variant="secondary" on:click={() => void actions().downloadFile(file.path)}>
                              Download
                            </ActionButton>
                            <ActionButton variant="danger" on:click={() => actions().confirmDeleteFile(file.path)}>
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
          <EmptyState
            title="Folder is empty"
            description="Upload files or create a folder to begin managing this workspace."
          />
        {/if}
      </Card>

      <Card title="Editor" subtitle={currentFilePath || "Select a file from the list"}>
        <textarea class="editor" bind:value={fileEditorContent}></textarea>
        <div class="button-row">
          <ActionButton on:click={() => void actions().saveFile()} disabled={!currentFilePath}>
            Save File
          </ActionButton>
          <ActionButton
            variant="danger"
            disabled={!currentFilePath}
            on:click={() => currentFilePath && actions().confirmDeleteFile(currentFilePath)}
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
                    <td>
                      <strong>{definition.displayName}</strong>
                      <small>{definition.key}</small>
                    </td>
                    <td class="cell-mono">
                      {definition.secret
                        ? "••••••••"
                        : selectedServer()!.environment[definition.key] ?? definition.defaultValue ?? "unset"}
                    </td>
                    <td><StatusBadge status="warning" label="Configurable" /></td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {:else}
        <EmptyState
          title="No databases configured"
          description="This workload does not expose database variables yet."
        />
      {/if}
    </Card>
  {:else if workspaceSection === "schedules"}
    <div class="two-column">
      <Card title="Create Schedule" subtitle="CRON-driven command and power tasks">
        <div class="form-grid">
          <label>Name<input bind:value={workspace.createTaskForm.name} /></label>
          <label>CRON<input bind:value={workspace.createTaskForm.cron} /></label>
          <label>
            Action
            <select bind:value={workspace.createTaskForm.actionType}>
              <option value="power">Power Action</option>
              <option value="command">Console Command</option>
            </select>
          </label>
          {#if workspace.createTaskForm.actionType === "power"}
            <label>
              Power Action
              <select bind:value={workspace.createTaskForm.powerAction}>
                <option value="restart">Restart</option>
                <option value="start">Start</option>
                <option value="stop">Stop</option>
                <option value="kill">Kill</option>
              </select>
            </label>
          {:else}
            <label>Command<input bind:value={workspace.createTaskForm.command} /></label>
          {/if}
        </div>
        <ActionButton on:click={() => void actions().createTask()}>Create Schedule</ActionButton>
      </Card>

      <Card title="Scheduled Tasks" subtitle="Next actions and immediate run controls">
        {#if workspace.serverTasks.length}
          <div class="list">
            {#each workspace.serverTasks as task}
              <div class="list-row">
                <div>
                  <strong>{task.name}</strong>
                  <small>{task.cron} • {task.action.type} • last run {task.lastRunAt ?? "never"}</small>
                </div>
                <div class="button-row">
                  <StatusBadge status={task.enabled ? "online" : "offline"} label={task.enabled ? "Enabled" : "Disabled"} />
                  <ActionButton variant="ghost" on:click={() => void actions().runTask(task.id)}>
                    Run Now
                  </ActionButton>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <EmptyState
            title="No schedules configured"
            description="Create a recurring task for restarts, console commands, or maintenance workflows."
          />
        {/if}
      </Card>
    </div>
  {:else if workspaceSection === "users"}
    <div class="two-column">
      <Card title="Invite Sub-user" subtitle="Grant scoped access by user id and permission set">
        <div class="form-grid">
          <label>User ID<input bind:value={workspace.subUserForm.userId} /></label>
          <label>Permissions<input bind:value={workspace.subUserForm.permissions} /></label>
        </div>
        <ActionButton on:click={() => void actions().addSubUser()}>Add Sub-user</ActionButton>
      </Card>

      <Card title="Server Access" subtitle="Current delegated members and permission scopes">
        {#if workspace.serverMembers.length}
          <div class="list">
            {#each workspace.serverMembers as member}
              <div class="list-row">
                <div>
                  <strong>{member.userId}</strong>
                  <small>{member.permissions.join(", ")}</small>
                </div>
                <ActionButton variant="danger" on:click={() => actions().removeSubUser(member.userId)}>
                  Remove
                </ActionButton>
              </div>
            {/each}
          </div>
        {:else}
          <EmptyState
            title="No sub-users assigned"
            description="Add delegated members for console, files, backups, or schedule access."
          />
        {/if}
      </Card>
    </div>
  {:else if workspaceSection === "backups"}
    <Card title="Backups" subtitle="Create, restore, download, and remove server snapshots">
      <div class="button-row">
        <ActionButton on:click={() => void actions().createBackup()}>Create Backup</ActionButton>
      </div>
      {#if workspace.serverBackups.length}
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
                {#each workspace.serverBackups as backup}
                  <tr>
                    <td>
                      <strong>{backup.name}</strong>
                    </td>
                    <td>{backup.provider.toUpperCase()}</td>
                    <td><StatusBadge status={backup.status} /></td>
                    <td class="cell-numeric">{formatBytes(backup.sizeBytes)}</td>
                    <td>{backup.createdAt}</td>
                    <td class="cell-right">
                      <div class="button-row">
                        <ActionButton variant="ghost" on:click={() => void actions().downloadBackup(backup.id)}>
                          Download
                        </ActionButton>
                        <ActionButton variant="secondary" on:click={() => actions().restoreBackup(backup.id)}>
                          Restore
                        </ActionButton>
                        <ActionButton variant="danger" on:click={() => actions().deleteBackup(backup.id)}>
                          Delete
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
        <EmptyState
          title="No backups available"
          description="Create your first backup to unlock restore and download operations."
        />
      {/if}
    </Card>
  {:else if workspaceSection === "network"}
    <div class="two-column">
      <Card title="Domain Mapping" subtitle="Reverse-proxy routes and allocation overview">
        <div class="form-grid">
          <label>Domain<input bind:value={workspace.domainForm.domain} /></label>
          <label>Target Port<input bind:value={workspace.domainForm.targetPort} /></label>
        </div>
        <div class="button-row">
          <ActionButton on:click={() => void actions().createDomainMapping()}>Map Domain</ActionButton>
        </div>
        {#if workspace.serverDomains.length}
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
                  {#each workspace.serverDomains as mapping}
                    <tr>
                      <td class="cell-mono">{mapping.domain}</td>
                      <td>{mapping.provider}</td>
                      <td class="cell-numeric">{mapping.targetPort}</td>
                      <td>
                        <StatusBadge
                          status={mapping.enabled ? "synced" : "out-of-sync"}
                          label={mapping.enabled ? "Enabled" : "Disabled"}
                        />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
        {:else}
          <EmptyState
            title="No domain mappings"
            description="Add a hostname route to expose this server through your proxy provider."
          />
        {/if}
      </Card>

      <Card title="Firewall + SFTP" subtitle="Port policies, daemon apply modes, and SFTP credentials">
        <div class="form-grid">
          <label>
            Protocol
            <select bind:value={workspace.firewallForm.protocol}>
              <option value="tcp">TCP</option>
              <option value="udp">UDP</option>
            </select>
          </label>
          <label>Port<input bind:value={workspace.firewallForm.port} /></label>
          <label>Source<input bind:value={workspace.firewallForm.source} /></label>
          <label>
            Action
            <select bind:value={workspace.firewallForm.action}>
              <option value="allow">Allow</option>
              <option value="deny">Deny</option>
            </select>
          </label>
        </div>
        <div class="button-row">
          <ActionButton variant="secondary" on:click={() => void actions().createFirewallRule()}>
            Add Rule
          </ActionButton>
          <ActionButton variant="ghost" on:click={() => void actions().applyFirewallRules(true)}>
            Dry Run
          </ActionButton>
          <ActionButton variant="danger" on:click={() => actions().confirmApplyFirewallRules()}>
            Apply
          </ActionButton>
        </div>
        {#if workspace.serverFirewallRules.length}
          <div class="list">
            {#each workspace.serverFirewallRules as rule}
              <div class="list-row">
                <div>
                  <strong>{rule.action.toUpperCase()} {rule.protocol}/{rule.port}</strong>
                  <small>{rule.source}</small>
                </div>
                <StatusBadge
                  status={rule.enabled ? "applied" : "warning"}
                  label={rule.enabled ? "Enabled" : "Disabled"}
                />
              </div>
            {/each}
          </div>
        {/if}
        {#if workspace.sftpCredential}
          <div class="inline-warning">
            <strong>SFTP access details</strong>
            <p>
              {workspace.sftpCredential.username}@{workspace.sftpCredential.host}:{workspace.sftpCredential.port}
              {" · "}
              {workspace.sftpCredential.rootPath}
            </p>
          </div>
          <ActionButton variant="ghost" on:click={() => void actions().rotateSftp()}>
            Rotate SFTP Credential
          </ActionButton>
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
                    <td>
                      <StatusBadge
                        status={allocation.primary ? "online" : "starting"}
                        label={allocation.primary ? "Primary" : "Secondary"}
                      />
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/if}
    </Card>
  {:else if workspaceSection === "startup"}
    <div class="two-column">
      <Card title="Runtime Settings" subtitle="Startup, image, and resource posture for this workload">
        <div class="form-grid">
          <label>Startup Command<input value={selectedServer()!.startup.command} readonly /></label>
          <label>Docker Image<input value={selectedServer()!.dockerImage} readonly /></label>
          <label>CPU Limit<input value={`${selectedServer()!.limits.cpuPercent}%`} readonly /></label>
          <label>Memory Limit<input value={`${selectedServer()!.limits.memoryMb} MB`} readonly /></label>
          <label>Disk Limit<input value={`${selectedServer()!.limits.diskMb} MB`} readonly /></label>
          <label>Restart Policy<input value={selectedServer()!.restartPolicy} readonly /></label>
        </div>
      </Card>

      <Card title="Resource Limits" subtitle="Provisioned capacity for this workload">
        <div class="metrics-grid">
          <StatCard label="CPU" value={`${selectedServer()!.limits.cpuPercent}%`} detail="Assigned limit" />
          <StatCard
            label="Memory"
            value={`${selectedServer()!.limits.memoryMb.toLocaleString()} MB`}
            detail="Assigned limit"
          />
          <StatCard
            label="Disk"
            value={`${selectedServer()!.limits.diskMb.toLocaleString()} MB`}
            detail="Assigned limit"
          />
          <StatCard
            label="Crashes"
            value={selectedServer()!.crashCount}
            detail="Tracked runtime faults"
            tone={selectedServer()!.crashCount > 0 ? "warning" : "neutral"}
          />
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
                        <StatusBadge
                          status={definition.required ? "warning" : "synced"}
                          label={definition.required ? "Required" : "Optional"}
                        />
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          </div>
          <ActionButton variant="secondary" on:click={() => void actions().updateServerEnvironment()}>
            Save Environment
          </ActionButton>
        {:else}
          <EmptyState
            title="No environment definitions"
            description="This template has no predefined environment variables."
          />
        {/if}
      </Card>

      <Card title="Danger Zone" subtitle="Lifecycle actions for the selected server">
        <div class="list">
          <div class="list-row">
            <div>
              <strong>Suspend</strong>
              <small>Block runtime activity until the workload is restored.</small>
            </div>
            <ActionButton variant="danger" on:click={() => actions().powerServer("stop")}>
              Suspend
            </ActionButton>
          </div>
          <div class="list-row">
            <div>
              <strong>Reinstall</strong>
              <small>Rebuild the server container and redeploy its template.</small>
            </div>
            <ActionButton variant="secondary" on:click={() => actions().powerServer("restart")}>
              Reinstall
            </ActionButton>
          </div>
          <div class="list-row">
            <div>
              <strong>Delete</strong>
              <small>Remove the server and all linked runtime state.</small>
            </div>
            <ActionButton variant="danger" on:click={() => actions().deleteServer()}>
              Delete
            </ActionButton>
          </div>
        </div>
      </Card>
    </div>
  {:else if workspaceSection === "activity"}
    <Card title="Activity" subtitle="Recent audit events and runtime changes">
      {#if workspace.auditLogs.length}
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
                {#each workspace.auditLogs.slice(0, 10) as log}
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
        <EmptyState
          title="No activity yet"
          description="Server actions and operator events will appear here over time."
        />
      {/if}
    </Card>
  {/if}
{:else}
  <Card
    tone="elevated"
    title="Server Workspace"
    subtitle="Pick one of your servers to open its console, files, backups, network, startup, and configuration tabs."
  >
    <div class="workspace-empty">
      <div class="workspace-empty__lead">
        <strong>No server selected</strong>
        <p>
          Select a workload from the list to start managing its runtime, storage, networking, and access controls.
        </p>
      </div>

      <div class="workspace-placeholder-grid">
        {#each workspace.tabs as tab}
          <div class="workspace-placeholder-tile">
            <span>{tab.label}</span>
            <small>{tabSummary(tab.id)}</small>
          </div>
        {/each}
      </div>

      <div class="button-row">
        {#if workspace.servers.length}
          <ActionButton on:click={() => void workspace.actions.selectServer(workspace.servers[0].id)}>
            Open First Server
          </ActionButton>
        {/if}
        <ActionButton variant="ghost" on:click={() => workspace.actions.openNotifications()}>
          View Activity
        </ActionButton>
      </div>
    </div>
  </Card>
{/if}

<style>
  .console-workspace {
    display: grid;
    gap: var(--lv-space-4);
  }

  .console-metrics {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }

  .console-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.6fr) minmax(18rem, 0.9fr);
    gap: var(--lv-space-4);
  }

  .console-panel {
    display: grid;
    gap: var(--lv-space-4);
  }

  .console-toolbar {
    display: flex;
    align-items: center;
    gap: var(--lv-space-2);
    flex-wrap: wrap;
  }

  .console-toolbar__actions {
    display: flex;
    align-items: center;
    gap: var(--lv-space-2);
    flex-wrap: wrap;
    margin-left: auto;
  }

  .console-command-row {
    margin-top: 0;
  }

  .recent-log-list {
    display: grid;
    gap: var(--lv-space-2);
  }

  .recent-log-item {
    padding: var(--lv-space-3);
    border-radius: var(--lv-radius-md);
    border: 1px solid rgba(51, 65, 85, 0.72);
    background: rgba(8, 14, 28, 0.82);
    color: #c9f6ff;
    font-family: var(--lv-font-mono);
    font-size: 0.78rem;
    line-height: 1.45;
    overflow: hidden;
  }

  .console-note {
    margin-top: var(--lv-space-4);
  }

  .workspace-empty {
    display: grid;
    gap: var(--lv-space-4);
  }

  .workspace-empty__lead {
    display: grid;
    gap: var(--lv-space-2);
  }

  .workspace-empty__lead strong {
    font-size: 1.05rem;
  }

  .workspace-placeholder-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--lv-space-3);
  }

  .workspace-placeholder-tile {
    display: grid;
    gap: var(--lv-space-2);
    padding: var(--lv-space-4);
    border-radius: var(--lv-radius-lg);
    border: 1px solid rgba(51, 65, 85, 0.78);
    background: rgba(8, 14, 28, 0.82);
  }

  .workspace-placeholder-tile span {
    font-weight: 650;
    color: var(--lv-text);
  }

  .workspace-placeholder-tile small {
    color: var(--lv-text-secondary);
    line-height: 1.5;
  }

  @media (max-width: 1100px) {
    .console-layout,
    .console-metrics {
      grid-template-columns: 1fr;
    }

    .workspace-placeholder-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
