<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import ActionButton from "./ActionButton.svelte";
  import Modal from "./Modal.svelte";

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  export let open = false;
  export let title = "One-time secret";
  export let subtitle = "This value will be hidden after you close this window.";
  export let secret = "";
  export let warning = "Store this in your password manager now. Leviathan will not show it again.";
  export let hint = "";
  let copied = false;

  $: if (!open) {
    copied = false;
  }

  const copySecret = async () => {
    if (!secret || !navigator.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(secret);
    copied = true;
  };
</script>

<Modal {open} {title} {subtitle} width="md" on:close={() => dispatch("close")}>
  <div class="secret-reveal">
    <div class="token-box secret-reveal__token">
      {secret || "No secret available"}
    </div>
    {#if hint}
      <p class="muted">{hint}</p>
    {/if}
    <div class="inline-warning">
      <strong>One-time reveal</strong>
      <p>{warning}</p>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="button-row">
      <ActionButton variant="secondary" on:click={copySecret}>
        {copied ? "Copied" : "Copy Secret"}
      </ActionButton>
      <ActionButton variant="ghost" on:click={() => dispatch("close")}>
        Close
      </ActionButton>
    </div>
  </svelte:fragment>
</Modal>
