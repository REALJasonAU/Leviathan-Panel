<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export type SidebarItem = {
    id: string;
    label: string;
    icon?: string;
    href?: string;
    disabled?: boolean;
    badge?: string | number;
  };

  export type SidebarGroup = {
    id: string;
    label: string;
    items: SidebarItem[];
    collapsed?: boolean;
  };

  const dispatch = createEventDispatcher<{
    navigate: string;
  }>();

  export let groups: SidebarGroup[] = [];
  export let activeId = "";
  export let brand = "Leviathan";
  export let brandTagline = "Command Deck";
  export let statusLabel = "Daemon Online";
  export let statusTone: "online" | "warning" | "offline" = "online";

  let collapsed = new Set<string>();

  $: {
    const next = new Set<string>();
    for (const group of groups) {
      if (group.collapsed) {
        next.add(group.id);
      }
    }
    collapsed = next;
  }

  const toggle = (groupId: string) => {
    const next = new Set(collapsed);
    if (next.has(groupId)) {
      next.delete(groupId);
    } else {
      next.add(groupId);
    }
    collapsed = next;
  };

  const navigate = (item: SidebarItem) => {
    if (item.disabled) {
      return;
    }
    dispatch("navigate", item.id);
  };
</script>

<div class="sidebar-nav">
  <div class="sidebar-nav__brand">
    <div class="brand-mark" aria-hidden="true"></div>
    <div>
      <p class="eyebrow">Leviathan</p>
      <strong>{brand}</strong>
      <small>{brandTagline}</small>
    </div>
  </div>

  <div class="sidebar-nav__groups">
    {#each groups as group (group.id)}
      <section class="sidebar-nav__group">
        <button class="sidebar-nav__group-toggle ghost" on:click={() => toggle(group.id)} aria-expanded={!collapsed.has(group.id)}>
          <span>{group.label}</span>
          <small>{collapsed.has(group.id) ? "+" : "-"}</small>
        </button>

        {#if !collapsed.has(group.id)}
          <ul>
            {#each group.items as item (item.id)}
              <li>
                {#if item.href && !item.disabled}
                  <a
                    href={item.href}
                    class:active={item.id === activeId}
                    on:click|preventDefault={() => navigate(item)}
                  >
                    <span class="sidebar-nav__icon">{item.icon ?? "•"}</span>
                    <span>{item.label}</span>
                    {#if item.badge !== undefined}
                      <span class="sidebar-nav__badge">{item.badge}</span>
                    {/if}
                  </a>
                {:else}
                  <button
                    class="sidebar-nav__item ghost"
                    class:active={item.id === activeId}
                    class:disabled={item.disabled}
                    aria-disabled={item.disabled}
                    tabindex={item.disabled ? -1 : 0}
                    disabled={item.disabled}
                    on:click={() => navigate(item)}
                  >
                    <span class="sidebar-nav__icon">{item.icon ?? "•"}</span>
                    <span>{item.label}</span>
                    {#if item.badge !== undefined}
                      <span class="sidebar-nav__badge">{item.badge}</span>
                    {/if}
                  </button>
                {/if}
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/each}
  </div>

  <div class={`sidebar-nav__status sidebar-nav__status--${statusTone}`}>
    <span>{statusLabel}</span>
  </div>
</div>
