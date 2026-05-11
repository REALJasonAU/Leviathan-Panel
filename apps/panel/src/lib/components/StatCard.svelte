<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let detail = "";
  export let tone: "neutral" | "primary" | "success" | "warning" | "danger" = "neutral";
</script>

<div class={`stat-card stat-card-${tone}`}>
  <span>{label}</span>
  <strong>{value}</strong>
  {#if detail}
    <small>{detail}</small>
  {/if}
</div>
