<script lang="ts">
  import { createEventDispatcher } from "svelte";

  import ActionButton from "./ActionButton.svelte";
  import Modal from "./Modal.svelte";

  const dispatch = createEventDispatcher<{
    cancel: void;
    confirm: void;
  }>();

  export let open = false;
  export let title = "Confirm action";
  export let description = "";
  export let confirmLabel = "Confirm";
  export let cancelLabel = "Cancel";
  export let danger = false;
  export let loading = false;
</script>

<Modal
  {open}
  {title}
  subtitle={description}
  tone={danger ? "danger" : "default"}
  width="sm"
  on:close={() => dispatch("cancel")}
>
  <div class="lv-confirm-dialog">
    <p>
      {description}
    </p>
  </div>

  <svelte:fragment slot="footer">
    <div class="button-row">
      <ActionButton variant="ghost" on:click={() => dispatch("cancel")}>
        {cancelLabel}
      </ActionButton>
      <ActionButton
        variant={danger ? "danger" : "primary"}
        {loading}
        on:click={() => dispatch("confirm")}
      >
        {confirmLabel}
      </ActionButton>
    </div>
  </svelte:fragment>
</Modal>
