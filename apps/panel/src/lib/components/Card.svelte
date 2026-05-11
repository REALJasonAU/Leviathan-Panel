<script lang="ts">
  export let title = "";
  export let subtitle = "";
</script>

<section class="card">
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

