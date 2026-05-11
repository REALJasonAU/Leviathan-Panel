<script lang="ts">
  export let title = "Loading Leviathan view";
  export let description = "Fetching the latest server, node, and control-plane state.";
</script>

<div class="loading-state" aria-live="polite" aria-busy="true">
  <div>
    <strong>{title}</strong>
    <p>{description}</p>
  </div>
  <div class="loading-state__grid">
    <span></span>
    <span></span>
    <span></span>
  </div>
</div>
