<script lang="ts">
  export let value = 0;
  export let label = "";
  export let tone: "primary" | "success" | "warning" | "danger" = "primary";

  const normalized = () => Math.max(0, Math.min(100, value));
</script>

<div class="lv-progress">
  {#if label}
    <div class="lv-progress__label">
      <span>{label}</span>
      <strong>{normalized()}%</strong>
    </div>
  {/if}
  <div class="lv-progress__track" aria-hidden="true">
    <div class={`lv-progress__bar lv-progress__bar--${tone}`} style={`width: ${normalized()}%`}></div>
  </div>
</div>
