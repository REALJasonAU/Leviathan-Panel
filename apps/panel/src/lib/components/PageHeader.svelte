<script lang="ts">
  export type PageCrumb = {
    label: string;
    href?: string;
    key?: string;
  };

  export let title = "";
  export let description = "";
  export let breadcrumbs: PageCrumb[] = [];
</script>

<header class="page-header">
  <div class="page-header__context">
    {#if breadcrumbs.length}
      <nav class="page-header__breadcrumbs" aria-label="Breadcrumb">
        {#each breadcrumbs as crumb, index (crumb.key ?? `${crumb.label}-${index}`)}
          {#if crumb.href}
            <a href={crumb.href}>{crumb.label}</a>
          {:else}
            <span>{crumb.label}</span>
          {/if}
        {/each}
      </nav>
    {/if}
    <h2>{title}</h2>
    {#if description}
      <p>{description}</p>
    {/if}
  </div>

  <div class="page-header__actions">
    <slot name="actions" />
  </div>
</header>

