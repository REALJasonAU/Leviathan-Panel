<script lang="ts">
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  export let open = false;
  export let title = "";
  export let subtitle = "";
  export let tone: "default" | "danger" = "default";
  export let width: "sm" | "md" | "lg" = "md";

  const close = () => dispatch("close");

  const onBackdropClick = (event: MouseEvent) => {
    if (event.target === event.currentTarget) {
      close();
    }
  };
</script>

<svelte:window on:keydown={(event) => open && event.key === "Escape" && close()} />

{#if open}
  <div class="lv-modal-backdrop" role="presentation" on:click={onBackdropClick}>
    <div
      class={`lv-modal lv-modal--${tone} lv-modal--${width}`}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Dialog"}
    >
      <header class="lv-modal__header">
        <div>
          {#if title}
            <h3>{title}</h3>
          {/if}
          {#if subtitle}
            <p>{subtitle}</p>
          {/if}
        </div>
        <button
          type="button"
          class="ghost icon-button"
          aria-label="Close dialog"
          on:click={close}
        >
          ×
        </button>
      </header>

      <div class="lv-modal__body">
        <slot />
      </div>

      <footer class="lv-modal__footer">
        <slot name="footer" />
      </footer>
    </div>
  </div>
{/if}
