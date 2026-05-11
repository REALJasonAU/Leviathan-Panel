<script lang="ts">
  export let sidebarCollapsed = false;
  export let sidebarLabel = "Primary";
  export let contentLabel = "Main";
</script>

<div class="deck-shell" class:deck-shell--collapsed={sidebarCollapsed}>
  <aside class="deck-shell__sidebar" aria-label={sidebarLabel}>
    <slot name="sidebar" />
  </aside>

  <div class="deck-shell__main">
    <header class="deck-shell__header">
      <slot name="header" />
    </header>

    <main class="deck-shell__content" aria-label={contentLabel}>
      <slot />
    </main>
  </div>
</div>

