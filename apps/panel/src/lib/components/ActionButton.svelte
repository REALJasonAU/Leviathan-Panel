<script lang="ts">
  export let variant: "primary" | "secondary" | "ghost" | "danger" = "primary";
  export let type: "button" | "submit" | "reset" = "button";
  export let disabled = false;
  export let loading = false;
  export let block = false;
</script>

<button
  {...$$restProps}
  type={type}
  disabled={disabled || loading}
  class={`lv-button lv-button-${variant} ${$$props.class ?? ""}`.trim()}
  class:lv-button-block={block}
  aria-busy={loading}
  on:click
  on:dblclick
  on:mousedown
  on:mouseup
  on:keydown
  on:keyup
  on:keypress
  on:focus
  on:blur
  on:input
  on:change
>
  {#if loading}
    <span class="lv-button__spinner" aria-hidden="true"></span>
  {/if}
  <span><slot /></span>
</button>
