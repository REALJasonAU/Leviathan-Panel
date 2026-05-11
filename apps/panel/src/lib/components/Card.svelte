<script lang="ts">
  export let title = "";
  export let subtitle = "";
  export let tone: "default" | "elevated" | "console" | "danger" = "default";
  export let compact = false;
</script>

<section class={`card card-tone-${tone}`} class:card-compact={compact}>
  {#if title}
    <header class="card-header">
      <div>
        <h3>{title}</h3>
        {#if subtitle}
          <p>{subtitle}</p>
        {/if}
      </div>
      <slot name="actions" />
    </header>
  {/if}

  <div class="card-body">
    <slot />
  </div>
</section>
