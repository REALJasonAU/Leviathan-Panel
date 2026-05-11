<script lang="ts">
  import { createEventDispatcher } from "svelte";

  export type TabItem = {
    id: string;
    label: string;
    disabled?: boolean;
  };

  const dispatch = createEventDispatcher<{
    change: string;
  }>();

  export let tabs: TabItem[] = [];
  export let active = "";

  const select = (tab: TabItem) => {
    if (tab.disabled || tab.id === active) {
      return;
    }
    dispatch("change", tab.id);
  };
</script>

<nav class="tab-nav" aria-label="Section tabs">
  {#each tabs as tab (tab.id)}
    <button
      class="tab-nav__item ghost"
      class:active={tab.id === active}
      disabled={tab.disabled}
      on:click={() => select(tab)}
      aria-current={tab.id === active ? "page" : undefined}
    >
      {tab.label}
    </button>
  {/each}
</nav>

