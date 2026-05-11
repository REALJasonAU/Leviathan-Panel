<script lang="ts">
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{
    action: void;
  }>();

  export let title: string;
  export let description = "";
  export let actionLabel = "";
</script>

<div class="empty-state">
  <strong>{title}</strong>
  {#if description}
    <p>{description}</p>
  {/if}
  {#if actionLabel}
    <button class="ghost" on:click={() => dispatch("action")}>{actionLabel}</button>
  {/if}
</div>
