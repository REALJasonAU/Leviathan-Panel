<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let detail = "";
</script>

<div class="stat-card">
  <span>{label}</span>
  <strong>{value}</strong>
  {#if detail}
    <small>{detail}</small>
  {/if}
</div>

