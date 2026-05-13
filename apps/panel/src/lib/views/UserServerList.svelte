<script lang="ts">
  import type { ServerRecord } from "@voltan/shared";

  import ActionButton from "../components/ActionButton.svelte";
  import Card from "../components/Card.svelte";
  import EmptyState from "../components/EmptyState.svelte";
  import StatusBadge from "../components/StatusBadge.svelte";

  export let servers: ServerRecord[] = [];
  export let selectedServerId = "";
  export let listMode: "cards" | "table" = "cards";
  export let onSelectServer: (serverId: string) => Promise<void> | void;
  export let onPowerServerById: (serverId: string, action: string) => Promise<void> | void;

  const allocationLabel = (server: ServerRecord) =>
    server.allocations[0]
      ? `${server.allocations[0].ip}:${server.allocations[0].port}`
      : "No allocation";

  const uptimeLabel = (server: ServerRecord) => {
    const hours = Math.floor(server.uptimeSeconds / 3600);
    const minutes = Math.floor((server.uptimeSeconds % 3600) / 60);
    if (!hours && !minutes) {
      return "Just started";
    }
    return [hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ");
  };

  const powerAction = (server: ServerRecord) =>
    server.status === "running" ? "stop" : "start";

  const powerLabel = (server: ServerRecord) =>
    server.status === "running" ? "Stop" : "Start";

  const toneLabel = (server: ServerRecord) => {
    if (server.status === "running") {
      return "online";
    }
    if (server.status === "starting" || server.status === "stopping") {
      return "starting";
    }
    if (server.status === "suspended") {
      return "suspended";
    }
    return "warning";
  };
</script>

<Card
  title="My Servers"
  subtitle="Select a workload to open its console, files, backups, and runtime tabs"
>
  <svelte:fragment slot="actions">
    <div class="button-row">
      <ActionButton
        variant={listMode === "cards" ? "secondary" : "ghost"}
        on:click={() => (listMode = "cards")}
      >
        Cards
      </ActionButton>
      <ActionButton
        variant={listMode === "table" ? "secondary" : "ghost"}
        on:click={() => (listMode = "table")}
      >
        Table
      </ActionButton>
    </div>
  </svelte:fragment>

  {#if servers.length}
    {#if listMode === "cards"}
      <div class="server-list-grid">
        {#each servers as server (server.id)}
          <article class={`server-list-card ${selectedServerId === server.id ? "selected" : ""}`}>
            <button
              class="server-list-card__select"
              type="button"
              on:click={() => void onSelectServer(server.id)}
            >
              <div class="server-list-card__header">
                <div>
                  <strong>{server.name}</strong>
                  <small>{server.description ?? server.dockerImage}</small>
                </div>
                <div class="server-list-card__status">
                  <StatusBadge status={server.status} />
                  <span class={`server-list-card__strip server-list-card__strip--${toneLabel(server)}`}></span>
                </div>
              </div>

              <div class="server-list-card__meta">
                <span>{allocationLabel(server)}</span>
                <span>{server.nodeId}</span>
                <span>{uptimeLabel(server)}</span>
              </div>
            </button>

            <div class="server-list-card__stats" aria-label={`${server.name} resource summary`}>
              <div>
                <span>CPU</span>
                <strong>{server.limits.cpuPercent}%</strong>
              </div>
              <div>
                <span>RAM</span>
                <strong>{server.limits.memoryMb.toLocaleString()} MB</strong>
              </div>
              <div>
                <span>Disk</span>
                <strong>{server.limits.diskMb.toLocaleString()} MB</strong>
              </div>
              <div>
                <span>Uptime</span>
                <strong>{uptimeLabel(server)}</strong>
              </div>
            </div>

            <div class="button-row server-list-card__actions">
              <ActionButton variant="ghost" on:click={() => void onSelectServer(server.id)}>
                Open
              </ActionButton>
              <ActionButton variant="secondary" on:click={() => void onSelectServer(server.id)}>
                Console
              </ActionButton>
              <ActionButton
                variant={toneLabel(server) === "online" ? "danger" : "primary"}
                on:click={() => void onPowerServerById(server.id, powerAction(server))}
              >
                {powerLabel(server)}
              </ActionButton>
            </div>
          </article>
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
                <th class="cell-numeric">CPU</th>
                <th class="cell-numeric">RAM</th>
                <th class="cell-numeric">Disk</th>
                <th>IP:Port</th>
                <th class="cell-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each servers as server (server.id)}
                <tr class:selected={selectedServerId === server.id}>
                  <td>
                    <strong>{server.name}</strong>
                    <small>{server.description ?? server.dockerImage}</small>
                  </td>
                  <td><StatusBadge status={server.status} /></td>
                  <td class="cell-numeric">{server.limits.cpuPercent}%</td>
                  <td class="cell-numeric">{server.limits.memoryMb.toLocaleString()} MB</td>
                  <td class="cell-numeric">{server.limits.diskMb.toLocaleString()} MB</td>
                  <td class="cell-mono">{allocationLabel(server)}</td>
                  <td class="cell-right">
                    <div class="button-row">
                      <ActionButton variant="ghost" on:click={() => void onSelectServer(server.id)}>
                        Open
                      </ActionButton>
                      <ActionButton variant="secondary" on:click={() => void onSelectServer(server.id)}>
                        Console
                      </ActionButton>
                      <ActionButton
                        variant={toneLabel(server) === "online" ? "danger" : "primary"}
                        on:click={() => void onPowerServerById(server.id, powerAction(server))}
                      >
                        {powerLabel(server)}
                      </ActionButton>
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
      description="Your account does not have any assigned workloads yet. Once a server is provisioned, it will appear here with console, files, backups, and runtime actions."
    />
  {/if}
</Card>

<style>
  .server-list-grid {
    display: grid;
    gap: var(--lv-space-3);
  }

  .server-list-card {
    border: 1px solid rgba(51, 65, 85, 0.82);
    border-radius: var(--lv-radius-xl);
    background:
      radial-gradient(circle at 100% 0%, rgba(0, 212, 255, 0.08), transparent 30%),
      linear-gradient(180deg, rgba(12, 18, 32, 0.94), rgba(5, 7, 13, 0.55));
    padding: var(--lv-space-4);
    display: grid;
    gap: var(--lv-space-3);
    transition:
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .server-list-card.selected {
    border-color: rgba(0, 212, 255, 0.34);
    box-shadow: var(--lv-glow);
    transform: translateY(-1px);
  }

  .server-list-card__select {
    border: 0;
    border-radius: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
    text-align: left;
    color: inherit;
    display: grid;
    gap: var(--lv-space-3);
  }

  .server-list-card__header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--lv-space-3);
  }

  .server-list-card__status {
    display: grid;
    justify-items: end;
    gap: var(--lv-space-2);
  }

  .server-list-card__header strong {
    display: block;
    font-size: 1rem;
    letter-spacing: -0.02em;
  }

  .server-list-card__header small {
    display: block;
    color: var(--lv-text-secondary);
    margin-top: 0.15rem;
  }

  .server-list-card__meta {
    display: flex;
    gap: var(--lv-space-3);
    flex-wrap: wrap;
    color: var(--lv-text-secondary);
    font-size: 0.8rem;
    overflow-wrap: anywhere;
  }

  .server-list-card__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--lv-space-3);
  }

  .server-list-card__stats div {
    padding: var(--lv-space-3);
    border-radius: var(--lv-radius-lg);
    border: 1px solid rgba(51, 65, 85, 0.78);
    background: rgba(8, 14, 28, 0.82);
    display: grid;
    gap: 0.25rem;
  }

  .server-list-card__stats span {
    color: var(--lv-text-muted);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .server-list-card__stats strong {
    font-size: 0.95rem;
    letter-spacing: -0.02em;
  }

  .server-list-card__strip {
    width: 0.45rem;
    height: 1.1rem;
    border-radius: 999px;
    background: var(--lv-border-soft);
  }

  .server-list-card__strip--online {
    background: var(--lv-success);
  }

  .server-list-card__strip--starting {
    background: var(--lv-primary);
  }

  .server-list-card__strip--warning {
    background: var(--lv-warning);
  }

  .server-list-card__strip--offline {
    background: var(--lv-danger);
  }

  .server-list-card__strip--suspended {
    background: #a78bfa;
  }

  .server-list-card__actions {
    margin-top: 0;
  }

  @media (max-width: 720px) {
    .server-list-card__stats {
      grid-template-columns: 1fr;
    }

    .server-list-card__header {
      flex-direction: column;
    }

    .server-list-card__actions > * {
      flex: 1 1 0;
      min-width: 0;
    }
  }
</style>
