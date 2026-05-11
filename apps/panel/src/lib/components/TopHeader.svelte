<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export type HeaderCrumb = {
    label: string;
    key?: string;
  };

  const dispatch = createEventDispatcher<{
    search: string;
    notifications: void;
    profile: void;
  }>();

  export let title = "";
  export let subtitle = "";
  export let breadcrumbs: HeaderCrumb[] = [];
  export let searchValue = "";
  export let searchPlaceholder = "Search servers, nodes, users, jobs...";
  export let showSearch = true;

  const submitSearch = () => {
    dispatch("search", searchValue.trim());
  };
</script>

<div class="top-header">
  <div class="top-header__context">
    {#if breadcrumbs.length}
      <nav class="top-header__breadcrumbs" aria-label="Breadcrumb">
        {#each breadcrumbs as crumb, index (crumb.key ?? `${crumb.label}-${index}`)}
          <span class="top-header__crumb">{crumb.label}</span>
        {/each}
      </nav>
    {/if}

    {#if title}
      <h1>{title}</h1>
    {/if}

    {#if subtitle}
      <p>{subtitle}</p>
    {/if}
  </div>

  <div class="top-header__actions">
    {#if showSearch}
      <label class="top-header__search" aria-label="Search">
        <span>Search</span>
        <input
          type="search"
          bind:value={searchValue}
          placeholder={searchPlaceholder}
          on:keydown={(event) => event.key === "Enter" && submitSearch()}
        />
      </label>
    {/if}

    <slot name="actions" />

    <button class="ghost icon-button" on:click={() => dispatch("notifications")} aria-label="Notifications">
      <span aria-hidden="true">N</span>
    </button>
    <button class="ghost icon-button" on:click={() => dispatch("profile")} aria-label="User profile">
      <span aria-hidden="true">U</span>
    </button>
  </div>
</div>

