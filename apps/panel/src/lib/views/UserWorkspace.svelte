<script lang="ts">
  import ActionButton from "../components/ActionButton.svelte";
  import LoadingState from "../components/LoadingState.svelte";
  import PageHeader from "../components/PageHeader.svelte";
  import StatCard from "../components/StatCard.svelte";
  import UserServerList from "./UserServerList.svelte";
  import ServerWorkspace from "./ServerWorkspace.svelte";
  import type { UserWorkspaceModel, WorkspaceSection } from "./workspaceTypes";

  export let workspace: UserWorkspaceModel;
  export let workspaceListMode: "cards" | "table" = "cards";
  export let workspaceSection: WorkspaceSection = "console";
  export let consoleSearch = "";
  export let autoScroll = true;
  export let consoleCommand = "";
  export let currentPath = ".";
  export let currentFilePath = "";
  export let fileEditorContent = "";

  const runningCount = () =>
    workspace.servers.filter((server) => server.status === "running").length;

  const offlineCount = () =>
    workspace.servers.filter((server) => ["offline", "stopped"].includes(server.status)).length;

  const suspendedCount = () =>
    workspace.servers.filter((server) => server.suspended).length;
</script>

<PageHeader
  title="My Servers"
  description="Server-first workspace with direct console, files, backups, schedules, users, and runtime controls."
  breadcrumbs={[{ label: "Leviathan" }, { label: "Servers" }]}
>
  <svelte:fragment slot="actions">
    <div class="button-row">
      <ActionButton variant="ghost" on:click={workspace.actions.openNotifications}>Activity</ActionButton>
      <ActionButton variant="ghost" on:click={workspace.actions.openProfile}>Profile</ActionButton>
      <ActionButton variant="secondary" on:click={workspace.actions.signOut}>Sign Out</ActionButton>
    </div>
  </svelte:fragment>
</PageHeader>

{#if workspace.error}
  <Card
    tone="danger"
    compact
    title="Workspace unavailable"
    subtitle={workspace.error}
  >
    <p class="muted">
      The user workspace will recover once the panel session or daemon connection is healthy again.
    </p>
  </Card>
{/if}

{#if workspace.loading}
  <LoadingState
    title="Loading Leviathan workspace"
    description="Pulling your servers, metrics, files, and runtime controls into the workspace."
  />
{/if}

<div class="stats-grid">
  <StatCard label="Servers" value={workspace.servers.length} detail="Assigned workloads" />
  <StatCard label="Running" value={runningCount()} detail="Live containers" tone="success" />
  <StatCard label="Offline" value={offlineCount()} detail="Not currently serving" tone="warning" />
  <StatCard label="Suspended" value={suspendedCount()} detail="Access restricted" tone="danger" />
</div>

<section class="workspace-grid">
  <aside class="server-sidebar">
    <UserServerList
      servers={workspace.servers}
      selectedServerId={workspace.selectedServerId}
      bind:listMode={workspaceListMode}
      onSelectServer={workspace.actions.selectServer}
      onPowerServerById={workspace.actions.powerServerById}
    />
  </aside>

  <section class="server-detail">
    <ServerWorkspace
      workspace={workspace}
      bind:workspaceSection={workspaceSection}
      bind:consoleSearch={consoleSearch}
      bind:autoScroll={autoScroll}
      bind:consoleCommand={consoleCommand}
      bind:currentPath={currentPath}
      bind:currentFilePath={currentFilePath}
      bind:fileEditorContent={fileEditorContent}
    />
  </section>
</section>
